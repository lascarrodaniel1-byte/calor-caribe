// Herramientas que el Dungeon Master (Claude) puede usar. Los dados los tira
// este programa, no el modelo, para que los resultados sean realmente aleatorios.
import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { describir, tirar } from "./dados.js";
import { aparecer, buscarCriatura, danar, estadoTexto, usarHabilidad, type Criatura } from "./bestiario.js";
import { CALIDADES_OBJETO, crearObjeto, generarBotin, ORIGENES } from "./equipo.js";
import { fichaTexto, normalizar, type Partida, type Personaje } from "./estado.js";
import {
  CALIDADES,
  avanzarAsaltos,
  CAUSAS,
  ENTORNOS,
  GRAVEDADES,
  infligir,
  METODOS,
  pasarTiempo,
  RECURSOS,
  TIPOS,
  tratar,
  UBICACIONES,
} from "./heridas.js";
import { NOMBRES_CLASES, NOMBRES_RAZAS } from "./mundo.js";
import { ATRIBUTOS } from "./reglas.js";
import { NOMBRES_VIALES, usarVial } from "./viales.js";

const habilidad = z.object({
  nombre: z.string(),
  descripcion: z.string(),
  salvacion: z.enum(ATRIBUTOS).optional().describe("Salvación de los objetivos; omítela si el efecto no admite salvación"),
  cd: z.number().int().optional(),
  dano: z.string().optional().describe('Dados de daño, p. ej. "8d10"'),
  tipo_dano: z.string().optional(),
  mitad_si_exito: z.boolean().optional(),
  muerte_si_falla_por: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe("Muerte instantánea si falla la salvación por este margen o más (0 = cualquier fallo). Úsalo con cuidado"),
  condicion: z.string().optional().describe("Condición que sufre quien falla"),
  herida: z.enum(CAUSAS).optional().describe("Herida que inflige al fallar"),
  sangre: z.number().int().min(1).optional().describe("Sangre perdida al fallar (riesgo de anemia)"),
  ceniza: z.number().int().min(1).optional(),
  recarga: z.number().int().min(2).max(6).optional().describe("Recarga X-6 en 1d6"),
});

const criatura = z.object({
  nombre: z.string(),
  categoria: z.enum(["bestia", "monstruo", "jefe"]),
  peligro: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
  region: z.string(),
  descripcion: z.string(),
  ca: z.number().int(),
  pv: z.string().describe('Número fijo ("180") o dados ("8d10+40")'),
  velocidad: z.string(),
  atributos: z.string(),
  ataques: z.array(z.string()),
  rasgos: z.array(z.string()),
  habilidades: z.array(habilidad),
  botin: z.string().optional(),
});

const atributo = z.number().int().min(1).max(30);

const esquemas = {
  tirar_dados: z.object({
    expresion: z.string().describe('Notación de dados, p. ej. "1d20+5", "2d6+3", "4d6kh3", "1d100"'),
    motivo: z.string().describe('Para qué es la tirada, p. ej. "Ataque con espada larga de Thorin contra el goblin"'),
    modo: z.enum(["normal", "ventaja", "desventaja"]).optional().describe("Ventaja o desventaja (solo aplica a 1d20)"),
    oculta: z.boolean().optional().describe("true si es una tirada secreta del DM que los jugadores no deben ver"),
  }),
  guardar_personaje: z.object({
    nombre: z.string(),
    jugador: z.string().optional().describe("Nombre de la persona que lo juega"),
    raza: z.enum(NOMBRES_RAZAS),
    clase: z.enum(NOMBRES_CLASES),
    nivel: z.number().int().min(1).max(20),
    pv_max: z.number().int().min(1),
    pv: z.number().int().optional().describe("PV actuales; por defecto, igual a pv_max"),
    ca: z.number().int().min(1),
    atributos: z
      .object({ fue: atributo, des: atributo, con: atributo, int: atributo, sab: atributo, car: atributo })
      .describe("Valores finales, con el bonificador racial ya sumado"),
    inventario: z.array(z.string()).optional(),
    oro: z.number().int().min(0).optional(),
    notas: z.string().optional().describe("Trasfondo, rasgos, conjuros, competencias…"),
  }),
  modificar_personaje: z.object({
    nombre: z.string(),
    pv_cambio: z.number().int().optional().describe("Negativo para daño, positivo para curación"),
    oro_cambio: z.number().int().optional(),
    agregar_objetos: z.array(z.string()).optional(),
    quitar_objetos: z.array(z.string()).optional(),
    agregar_condiciones: z.array(z.string()).optional().describe('p. ej. "envenenado", "derribado"'),
    quitar_condiciones: z.array(z.string()).optional(),
    nivel: z.number().int().min(1).max(20).optional(),
    pv_max: z.number().int().min(1).optional(),
    agregar_secuelas: z.array(z.string()).optional().describe("Secuelas narrativas fuera del sistema de heridas"),
    quitar_secuelas: z.array(z.string()).optional().describe("Solo con magia o ritos extraordinarios"),
    ceniza_cambio: z.number().int().optional().describe("Ceniza ganada o purgada por medios narrativos"),
    notas: z.string().optional().describe("Reemplaza las notas de la ficha"),
  }),
  infligir_herida: z.object({
    nombre: z.string().describe("Personaje jugador herido"),
    causa: z.enum(CAUSAS).describe("critico, golpe_masivo (≥ mitad de PV máx. en un golpe), cero_pv o menor"),
    tipo: z.enum(TIPOS),
    gravedad: z.enum(GRAVEDADES).optional().describe("Omítela para que se tire según la causa"),
    ubicacion: z.enum(UBICACIONES).optional().describe("Omítela para que se tire al azar"),
    de_no_muerto: z.boolean().optional().describe("true si la causa un no-muerto: transmite la Podre"),
    descripcion: z.string().optional().describe('Breve, p. ej. "tajo de hacha oxidada en el antebrazo"'),
  }),
  tratar_herida: z.object({
    paciente: z.string(),
    herida: z.string().describe('Id de la herida, p. ej. "H2"'),
    metodo: z.enum(METODOS),
    sanador: z.string().describe("Quién trata: un personaje jugador o un PNJ"),
    bono_medicina: z
      .number()
      .int()
      .describe("Bonificador de Sabiduría (Medicina) del sanador; para PNJ, +2 aficionado, +5 Hermana de la Sutura, +7 maestra cirujana"),
    recursos: z.array(z.enum(RECURSOS)).describe("Material que se usa de verdad (compruébalo en el inventario)"),
    entorno: z.enum(Object.keys(ENTORNOS) as [keyof typeof ENTORNOS, ...(keyof typeof ENTORNOS)[]]),
    usar_mano_firme: z.boolean().optional().describe("Barbero-Cirujano: repetir si falla (1 vez por descanso largo)"),
  }),
  pasar_tiempo: z.object({
    dias: z.number().int().min(1).max(90),
    calidad: z.enum(CALIDADES),
    personajes: z.array(z.string()).optional().describe("Por defecto, todos los personajes"),
  }),
  avanzar_asaltos: z.object({
    asaltos: z.number().int().min(1).max(600).describe("Asaltos de 6 s; 10 = 1 minuto"),
    personajes: z.array(z.string()).optional().describe("Por defecto, todos los que sangran"),
  }),
  usar_vial: z.object({
    vial: z.enum(NOMBRES_VIALES),
    receptor: z.string().optional().describe("Personaje jugador que lo bebe o lo recibe"),
    portador: z.string().optional().describe("Personaje de cuyo inventario sale el vial (se descuenta)"),
    objetivo_pnj: z
      .object({ nombre: z.string(), bono_con: z.number().int() })
      .optional()
      .describe("Solo para envenenar a un PNJ"),
    via: z.enum(["bebido", "arma"]).optional().describe("Hiel: bebida (CD 15) o en un arma (CD 13)"),
    dosis: z.number().int().min(1).max(10).optional().describe("Leche de Amapola: dosis que toma ahora"),
    herida: z.string().optional().describe("Sangre de Santo: herida que cerrar (por defecto, la más grave)"),
  }),
  generar_botin: z.object({
    origen: z.enum(ORIGENES),
    cantidad: z.number().int().min(1).max(10),
    clase: z.enum(["arma", "armadura", "accesorio"]).optional(),
    calidad: z.enum(CALIDADES_OBJETO).optional().describe("Fuerza una calidad (p. ej. el arma encantada de una misión)"),
    incluir_viales: z.boolean().optional(),
  }),
  crear_objeto: z.object({
    nombre: z.string(),
    calidad: z.enum(CALIDADES_OBJETO),
    apariencia: z.string().describe("Lo que ven y saben los jugadores"),
    verdad: z.string().optional().describe("La verdad completa, con maldiciones ocultas"),
    precio: z.number().int().min(0).optional(),
  }),
  examinar_objeto: z.object({
    id: z.string().describe('Id del objeto, p. ej. "O4"'),
    revelar: z.boolean().optional().describe("true cuando los jugadores descubren su verdadera naturaleza"),
  }),
  aparecer_criatura: z.object({
    nombre: z.string().describe("Nombre de la criatura (del bestiario o nueva) o alias de esta instancia, p. ej. \"Ogro tuerto\""),
    plantilla: z.string().optional().describe("Criatura del bestiario en la que se basa (si el nombre es un alias)"),
    definicion: criatura.optional().describe("Para criaturas nuevas inventadas por ti"),
  }),
  danar_criatura: z.object({
    nombre: z.string(),
    cantidad: z.number().int().describe("Daño final tras resistencias; negativo para curarla o regenerar"),
  }),
  habilidad_criatura: z.object({
    criatura: z.string().describe("Nombre de la criatura en escena"),
    habilidad: z.string().optional().describe("Nombre de una de sus habilidades registradas"),
    habilidad_nueva: habilidad.optional().describe("Habilidad improvisada que no está en su ficha"),
    objetivos: z.array(z.string()).min(1).describe("Personajes jugadores afectados"),
  }),
  anotar_mundo: z.object({
    nota: z.string().describe("Hecho importante de la campaña: PNJ, misión, lugar, pista, deuda, promesa…"),
  }),
};

type Nombre = keyof typeof esquemas;

const descripciones: Record<Nombre, string> = {
  tirar_dados:
    "Tira dados de verdad. Úsala SIEMPRE que haya que tirar (ataques, daño, salvaciones, pruebas, iniciativa, " +
    "tablas aleatorias). Nunca inventes un resultado de dados.",
  guardar_personaje:
    "Crea o reemplaza la ficha completa de un personaje jugador. Úsala al terminar la creación de personaje.",
  modificar_personaje:
    "Aplica cambios a la ficha de un personaje: daño/curación, oro, objetos, condiciones, subida de nivel.",
  infligir_herida:
    "Causa una herida física real a un personaje jugador (críticos recibidos, golpes masivos, caer a 0 PV, accidentes). " +
    "El programa tira gravedad y ubicación y aplica efectos, hemorragia y Podre.",
  tratar_herida:
    "Intenta tratar una herida: detener hemorragia, medicina/cirugía, cauterizar, magia divina o remedio raro. El programa tira y aplica el resultado.",
  pasar_tiempo:
    "Hace avanzar días: convalecencia, infecciones, agravamientos, recuperación de PV y secuelas al cerrar las heridas.",
  avanzar_asaltos:
    "Hace avanzar las hemorragias asalto a asalto: PV perdidos y riesgo creciente de perder FUE por anemia. Llámala al final de cada asalto si alguien sangra.",
  usar_vial:
    "Usa un vial (Sangre de Santo, Ceniza Viva, Hiel de Víbora Gris, Leche de Amapola Negra). El programa aplica efectos y riesgos y lo descuenta del inventario del portador.",
  generar_botin:
    "Genera equipo y viales al azar según el origen (compra, saqueo, hallazgo, jefe), con calidades normales, encantadas, malditas o reliquias.",
  crear_objeto: "Registra un objeto único inventado por ti (con su verdad oculta si está maldito).",
  examinar_objeto: "Consulta la verdad de un objeto registrado; con revelar=true, los jugadores la descubren.",
  aparecer_criatura:
    "Pone en escena una criatura peligrosa (del bestiario, basada en una plantilla o inventada con definicion) y lleva sus PV.",
  danar_criatura: "Aplica daño (o curación) a una criatura en escena.",
  habilidad_criatura:
    "Resuelve una habilidad especial de una criatura (registrada o improvisada): salvaciones reales, daño, condiciones, heridas, anemia y muerte instantánea.",
  anotar_mundo:
    "Guarda un hecho importante de la campaña para no olvidarlo en sesiones futuras.",
};

export const herramientas: Anthropic.Beta.BetaTool[] = (Object.keys(esquemas) as Nombre[]).map((nombre) => {
  const { $schema: _ignorado, ...schema } = z.toJSONSchema(esquemas[nombre]) as Record<string, unknown>;
  return {
    name: nombre,
    description: descripciones[nombre],
    input_schema: schema as Anthropic.Beta.BetaTool.InputSchema,
    // Con streaming, los argumentos llegan a medida que se generan; por eso
    // los validamos nosotros con zod antes de ejecutar.
    eager_input_streaming: true,
  };
});

export interface Resultado {
  contenido: string;
  /** Lo que se le muestra al jugador en pantalla (null = nada). */
  aviso: string | null;
  error?: boolean;
}

function buscar(partida: Partida, nombre: string): Personaje {
  const p =
    partida.personajes[nombre] ??
    Object.values(partida.personajes).find((x) => x.nombre.toLowerCase() === nombre.toLowerCase());
  if (!p) {
    const hay = Object.keys(partida.personajes).join(", ") || "ninguno";
    throw new Error(`No existe el personaje "${nombre}". Personajes: ${hay}`);
  }
  return p;
}

export function ejecutar(nombre: string, entrada: unknown, partida: Partida): Resultado {
  if (!(nombre in esquemas)) return { contenido: `Herramienta desconocida: ${nombre}`, aviso: null, error: true };
  const validado = esquemas[nombre as Nombre].safeParse(entrada);
  if (!validado.success) {
    return { contenido: `Argumentos no válidos: ${z.prettifyError(validado.error)}`, aviso: null, error: true };
  }

  try {
    switch (nombre as Nombre) {
      case "tirar_dados": {
        const e = validado.data as z.infer<typeof esquemas.tirar_dados>;
        const t = tirar(e.expresion, e.modo ?? "normal");
        const linea = describir(t);
        const modo = e.modo && e.modo !== "normal" ? ` con ${e.modo}` : "";
        return {
          contenido: JSON.stringify({ ...t, motivo: e.motivo }),
          aviso: e.oculta ? "🎲 (el DM tira en secreto…)" : `🎲 ${e.motivo}${modo} → ${linea}`,
        };
      }
      case "guardar_personaje": {
        const e = validado.data as z.infer<typeof esquemas.guardar_personaje>;
        const p: Personaje = normalizar({
          ...e,
          pv: e.pv ?? e.pv_max,
          inventario: e.inventario ?? [],
          oro: e.oro ?? 0,
          condiciones: [],
          notas: e.notas ?? "",
          heridas: partida.personajes[e.nombre]?.heridas ?? [],
          secuelas: partida.personajes[e.nombre]?.secuelas ?? [],
          ceniza: partida.personajes[e.nombre]?.ceniza ?? 0,
          anemia: partida.personajes[e.nombre]?.anemia ?? 0,
          sangrado: partida.personajes[e.nombre]?.sangrado ?? 0,
          anemia_progreso: partida.personajes[e.nombre]?.anemia_progreso ?? 0,
          dosis: partida.personajes[e.nombre]?.dosis ?? { curacion: 0, sueno: 0 },
        });
        partida.personajes[p.nombre] = p;
        return { contenido: `Ficha guardada:\n${fichaTexto(p)}`, aviso: `📜 Ficha guardada:\n${fichaTexto(p)}` };
      }
      case "modificar_personaje": {
        const e = validado.data as z.infer<typeof esquemas.modificar_personaje>;
        const p = buscar(partida, e.nombre);
        const cambios: string[] = [];
        if (e.pv_max !== undefined) p.pv_max = e.pv_max;
        if (e.nivel !== undefined) {
          p.nivel = e.nivel;
          cambios.push(`nivel ${p.nivel}`);
        }
        if (e.pv_cambio) {
          p.pv = Math.max(0, Math.min(p.pv_max, p.pv + e.pv_cambio));
          cambios.push(`${e.pv_cambio > 0 ? "+" : ""}${e.pv_cambio} PV (${p.pv}/${p.pv_max})`);
        }
        if (e.oro_cambio) {
          p.oro = Math.max(0, p.oro + e.oro_cambio);
          cambios.push(`${e.oro_cambio > 0 ? "+" : ""}${e.oro_cambio} oro`);
        }
        for (const o of e.agregar_objetos ?? []) {
          p.inventario.push(o);
          cambios.push(`+ ${o}`);
        }
        for (const o of e.quitar_objetos ?? []) {
          const i = p.inventario.findIndex((x) => x.toLowerCase() === o.toLowerCase());
          if (i >= 0) {
            p.inventario.splice(i, 1);
            cambios.push(`- ${o}`);
          }
        }
        for (const c of e.agregar_condiciones ?? []) if (!p.condiciones.includes(c)) p.condiciones.push(c);
        if (e.quitar_condiciones) p.condiciones = p.condiciones.filter((c) => !e.quitar_condiciones!.includes(c));
        for (const x of e.agregar_secuelas ?? []) p.secuelas.push(x);
        if (e.quitar_secuelas) p.secuelas = p.secuelas.filter((x) => !e.quitar_secuelas!.includes(x));
        if (e.ceniza_cambio) {
          p.ceniza = Math.max(0, p.ceniza + e.ceniza_cambio);
          cambios.push(`Ceniza ${p.ceniza}`);
        }
        if (e.notas !== undefined) p.notas = e.notas;
        if (p.pv === 0) cambios.push("¡a 0 PV! (inconsciente)");
        return {
          contenido: `Ficha actualizada:\n${fichaTexto(p)}`,
          aviso: cambios.length ? `✏️  ${p.nombre}: ${cambios.join(" · ")}` : null,
        };
      }
      case "infligir_herida": {
        const e = validado.data as z.infer<typeof esquemas.infligir_herida>;
        const texto = infligir(buscar(partida, e.nombre), e);
        return { contenido: texto, aviso: `🩸 ${texto}` };
      }
      case "tratar_herida": {
        const e = validado.data as z.infer<typeof esquemas.tratar_herida>;
        const p = buscar(partida, e.paciente);
        const h = p.heridas.find((x) => x.id.toLowerCase() === e.herida.toLowerCase());
        if (!h) {
          const hay = p.heridas.map((x) => x.id).join(", ") || "ninguna";
          throw new Error(`${p.nombre} no tiene la herida ${e.herida}. Heridas abiertas: ${hay}`);
        }
        const sanador = Object.values(partida.personajes).find((x) => x.nombre.toLowerCase() === e.sanador.toLowerCase());
        const texto = tratar(p, h, { ...e, sanador, nombre_sanador: e.sanador });
        return { contenido: `${texto}\n\nFicha actual:\n${fichaTexto(p)}`, aviso: `🩹 ${texto}` };
      }
      case "pasar_tiempo": {
        const e = validado.data as z.infer<typeof esquemas.pasar_tiempo>;
        const ps = e.personajes?.length ? e.personajes.map((n) => buscar(partida, n)) : Object.values(partida.personajes);
        const texto = ps.map((p) => `## ${p.nombre}\n${pasarTiempo(p, e.dias, e.calidad)}`).join("\n\n");
        return { contenido: texto, aviso: `⏳ ${e.dias} día(s), ${e.calidad}\n${texto}` };
      }
      case "avanzar_asaltos": {
        const e = validado.data as z.infer<typeof esquemas.avanzar_asaltos>;
        const ps = e.personajes?.length
          ? e.personajes.map((n) => buscar(partida, n))
          : Object.values(partida.personajes).filter((p) => p.heridas.some((h) => h.sangrando));
        if (!ps.length) return { contenido: "Nadie está sangrando.", aviso: null };
        const texto = ps.map((p) => avanzarAsaltos(p, e.asaltos)).join("\n");
        return { contenido: texto, aviso: `🩸 ${texto}` };
      }
      case "usar_vial": {
        const e = validado.data as z.infer<typeof esquemas.usar_vial>;
        const port = e.portador ? buscar(partida, e.portador) : undefined;
        const i = port ? port.inventario.findIndex((x) => x.toLowerCase().includes(e.vial.toLowerCase())) : -1;
        if (port && i < 0) throw new Error(`${port.nombre} no lleva ${e.vial} en el inventario.`);
        const receptor = e.receptor ? buscar(partida, e.receptor) : undefined;
        const texto = usarVial({ ...e, receptor });
        if (port) port.inventario.splice(i, 1);
        return { contenido: texto + (receptor ? `\n\nFicha:\n${fichaTexto(receptor)}` : ""), aviso: `🧪 ${texto}` };
      }
      case "generar_botin": {
        const e = validado.data as z.infer<typeof esquemas.generar_botin>;
        const b = generarBotin(partida, e);
        return { contenido: b.dm, aviso: b.jugadores ? `💰 ${e.origen === "compra" ? "A la venta" : "Botín"}:\n${b.jugadores}` : null };
      }
      case "crear_objeto": {
        const e = validado.data as z.infer<typeof esquemas.crear_objeto>;
        const o = crearObjeto(partida, e);
        return { contenido: `Registrado ${o.nombre}: ${o.verdad}`, aviso: `✨ ${o.nombre}: ${o.apariencia}` };
      }
      case "examinar_objeto": {
        const e = validado.data as z.infer<typeof esquemas.examinar_objeto>;
        const o = partida.objetos[e.id.toUpperCase()];
        if (!o) throw new Error(`No hay ningún objeto ${e.id}.`);
        if (e.revelar) o.identificado = true;
        return {
          contenido: `${o.nombre} (${o.calidad}, ${o.precio} po). Verdad: ${o.verdad}. ${o.identificado ? "Los jugadores lo conocen." : "Los jugadores solo conocen: " + o.apariencia}`,
          aviso: e.revelar ? `🔍 ${o.nombre}: ${o.verdad}` : null,
        };
      }
      case "aparecer_criatura": {
        const e = validado.data as z.infer<typeof esquemas.aparecer_criatura>;
        const def: Criatura | undefined = e.definicion ?? buscarCriatura(e.plantilla ?? e.nombre);
        if (!def) throw new Error(`"${e.plantilla ?? e.nombre}" no está en el bestiario: pasa una definicion completa para crearla.`);
        const texto = aparecer(partida, def, e.nombre);
        return { contenido: texto, aviso: `⚠️  ${e.nombre}${def.categoria === "jefe" ? " (JEFE)" : ""}` };
      }
      case "danar_criatura": {
        const e = validado.data as z.infer<typeof esquemas.danar_criatura>;
        const j = partida.jefes[e.nombre] ?? Object.values(partida.jefes).find((x) => x.nombre.toLowerCase() === e.nombre.toLowerCase());
        if (!j) throw new Error(`${e.nombre} no está en escena. En escena: ${Object.keys(partida.jefes).join(", ") || "nadie"}`);
        const texto = danar(j, e.cantidad);
        if (j.pv <= 0) delete partida.jefes[j.nombre];
        return { contenido: texto, aviso: `⚔️  ${j.nombre}: ${estadoTexto(j)}` };
      }
      case "habilidad_criatura": {
        const e = validado.data as z.infer<typeof esquemas.habilidad_criatura>;
        const j = partida.jefes[e.criatura] ?? Object.values(partida.jefes).find((x) => x.nombre.toLowerCase() === e.criatura.toLowerCase());
        const h =
          e.habilidad_nueva ??
          j?.definicion.habilidades.find((x) => x.nombre.toLowerCase() === (e.habilidad ?? "").toLowerCase());
        if (!h) {
          const hay = j?.definicion.habilidades.map((x) => x.nombre).join(", ") || "ninguna registrada";
          throw new Error(`No encuentro esa habilidad. Habilidades de ${e.criatura}: ${hay}. Usa habilidad_nueva para improvisar.`);
        }
        const objetivos = e.objetivos.map((n) => buscar(partida, n));
        const texto = usarHabilidad(j, h, objetivos);
        return { contenido: texto, aviso: `💀 ${texto}` };
      }
      case "anotar_mundo": {
        const e = validado.data as z.infer<typeof esquemas.anotar_mundo>;
        partida.notas_mundo.push(e.nota);
        return { contenido: "Nota guardada.", aviso: null };
      }
    }
  } catch (err) {
    return { contenido: (err as Error).message, aviso: null, error: true };
  }
}
