// Herramientas que el Dungeon Master (Claude) puede usar. Los dados los tira
// este programa, no el modelo, para que los resultados sean realmente aleatorios.
import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { describir, tirar } from "./dados.js";
import { fichaTexto, type Partida, type Personaje } from "./estado.js";
import {
  CALIDADES,
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
        const p: Personaje = {
          ...e,
          pv: e.pv ?? e.pv_max,
          inventario: e.inventario ?? [],
          oro: e.oro ?? 0,
          condiciones: [],
          notas: e.notas ?? "",
          heridas: partida.personajes[e.nombre]?.heridas ?? [],
          secuelas: partida.personajes[e.nombre]?.secuelas ?? [],
          ceniza: partida.personajes[e.nombre]?.ceniza ?? 0,
        };
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
