// Prompt compacto para la versión web (artifact de claude.ai), donde cada turno
// gasta el uso de la cuenta del jugador: lo esencial va siempre, y el resto
// (bestiario, behelits, tablas, esquemas completos) se consulta bajo demanda
// con la acción consultar_reglas.
import { buscarCriatura, fichaCriatura, textoBestiario } from "./bestiario.js";
import { REGLAS_BEHELIT } from "./behelit.js";
import { REGLAS_EQUIPO } from "./equipo.js";
import { REGLAS_HERIDAS } from "./heridas.js";
import { herramientas } from "./herramientas.js";
import { REGLAS_MAPA } from "./mapa.js";
import { AMBIENTACION, CLASES, RAZAS, textoRazasYClases } from "./mundo.js";
import { REGLAS_VIALES } from "./viales.js";

const BASE = `Eres el Dungeon Master de una campaña multijugador de dark fantasy con reglas de D&D 5e, en español.
- Narras, interpretas a los PNJ y arbitras. Nunca decides lo que hacen, dicen o sienten los personajes jugadores.
- 1 a 3 párrafos por turno, con detalle sensorial y sin muros de texto. Acaba con la situación abierta ("¿Qué hacéis?").
- Decisiones con consecuencias reales; premia la creatividad con pruebas razonables. Varía exploración, intriga y combate; los PNJ tienen voz y motivos propios. Inventa libremente, con coherencia.
- Las acciones de varios jugadores llegan juntas con su nombre delante: resuélvelas todas y reparte el protagonismo. En combate, tira iniciativa, respeta el orden de turnos y describe el estado de los enemigos sin dar números.
- Toda tirada pasa por tirar_dados (oculta=true si es secreta); nunca inventes un resultado. Antes de una prueba di la característica y la CD.
- Las fichas guardadas son la verdad: actualízalas con modificar_personaje (PV, objetos, oro, condiciones). Las heridas físicas van con el sistema de heridas.
- A 0 PV: inconsciente y salvaciones contra muerte. La muerte es posible, pero anunciada por el peligro.
- Inicio: presenta Velmora en pocas líneas y guía la creación de personaje (raza y clase de Velmora, trasfondo, atributos con la serie estándar 15,14,13,12,10,8 o 4d6kh3 seis veces; suma el bono racial; PV = dado de golpe máximo + mod. CON; equipo inicial de la clase) y guárdala con guardar_personaje. Luego, un gancho fuerte.
- Formato: texto plano, **negritas** con moderación, diálogos con raya (—). Sin tablas.`;

const MUNDO = `## Velmora, el Reino del Sol Herido
Hace 99 años mataron a los dioses (nadie sabe quién). El sol es un disco gris, los muertos sin rito de sal y fuego se levantan y los huesos de dioses se venden como reliquias. Tono: violencia con peso, recursos escasos, moral gris, humor negro.
Regiones: Aldenmar (la Ciudad-Faro, último bastión), Ciénagas de Hollín (pantanos, medianos, contrabando), Karak-Dûm (fortaleza enana sellada), Bosque de Velo Rojo (elfos marchitos, voces de muertos), Marca Hueca (no-muertos, Corte Pálida), Agujas de Vahl (monasterios de flagelantes).
Facciones: Inquisición de la Llama Gris, Hermanas de la Sutura (cirujanas), Compañía del Cuervo Negro (mercenarios), Corte Pálida (vampiros), Devotos del Dios Hambriento.
Amenazas: los Hambrientos (no-muertos; su mordisco transmite la Podre), la Podre (no se cura con medicina común ni magia), la Ceniza (la magia divina la deja; con 3 marcas visibles, con 6 los no-muertos te sienten suyo, con 10 algo te habla).`;

function razasYClasesCortas(): string {
  const razas = RAZAS.map((r) => `- ${r.nombre} (${r.atributos}). Curación: ${r.notaCuracion}`).join("\n");
  const clases = CLASES.map((c) => `- ${c.nombre} (${c.base}, d${c.dadoGolpe}, ${c.principal})`).join("\n");
  return `## Razas (solo estas)\n${razas}\n## Clases (todas combatientes; solo estas)\n${clases}\nRasgos, salvaciones y equipo inicial: consultar_reglas {tema: "razas_clases"}.`;
}

const HERIDAS = `## Heridas (el programa las resuelve; tú las narras)
- infligir_herida al recibir un crítico, un golpe de la mitad de los PV máx. o más, al caer a 0 PV, o en accidentes. El programa tira gravedad, región y estructura anatómica.
- Zonas: ROJA (aorta, corazón, femoral, encéfalo…): un minuto de vida como mucho; solo comprimible en algunas arterias; si no, cirugía desesperada CD 22, Sangre de Santo o magia divina. ÁMBAR: secuelas casi seguras; cuello y arterias de miembros se vuelven rojas en pocos asaltos sin compresión; vísceras y cráneo empeoran día a día sin cirugía; costillas pueden perforar el pulmón; nervios y tendones incapacitan. VERDE: superficial, pero se infecta.
- tratar_herida: detener hemorragia, medicina (CD 10/13/16/19 según gravedad; material, entorno y sanador cuentan), cauterizar, magia divina (da Ceniza) o remedio raro (Podre).
- avanzar_asaltos al final de cada asalto si alguien sangra (pierde PV y Fuerza por anemia). pasar_tiempo cuando pasan días (convalecencia, infección, secuelas). Un descanso no lo cura todo.
Detalle completo: consultar_reglas {tema: "heridas"}.`;

const RESTO = `## Más sistemas (consulta el detalle solo cuando lo necesites)
- Viales (Sangre de Santo, Ceniza Viva, Hiel de Víbora Gris, Leche de Amapola Negra) con usar_vial: tema "viales".
- Botín y objetos (normales, encantados, malditos ocultos, reliquias, legendarios) con generar_botin, crear_objeto y examinar_objeto: tema "equipo".
- Criaturas y jefes con aparecer_criatura, danar_criatura, habilidad_criatura, presagio_criatura: tema "bestiario", o {tema: "criatura", nombre} para la ficha de una. Son una base: inventa las tuyas.
- Behelits y el Eclipse con behelit: tema "behelits" (antes de usarlos, léelo siempre).
- Mapa: los jugadores ven siempre dónde está el grupo. Llama a ubicacion al empezar, al llegar a otro sitio y durante los viajes (con viajando_hacia y progreso). Reutiliza los nombres de los lugares.
- Ambientación completa: tema "ambientacion".`;

/** Firma compacta de una acción a partir de su esquema JSON. */
function tipo(s: Record<string, unknown> | undefined): string {
  if (!s) return "?";
  if (Array.isArray(s.enum)) {
    const v = s.enum as string[];
    return v.length > 9 ? `${v.slice(0, 8).join("|")}|…` : v.join("|");
  }
  if (s.type === "array") return `[${tipo(s.items as Record<string, unknown>)}]`;
  if (s.type === "object" && s.properties) {
    const req = new Set((s.required as string[]) ?? []);
    return `{${Object.keys(s.properties as object).map((k) => k + (req.has(k) ? "" : "?")).join(", ")}}`;
  }
  if (s.type === "integer" || s.type === "number") return "n";
  if (s.type === "boolean") return "sí/no";
  if (Array.isArray(s.anyOf)) return (s.anyOf as Record<string, unknown>[]).map(tipo).join("|");
  return "texto";
}

export function catalogoCompacto(): string {
  const lineas = herramientas.map((h) => {
    const sch = h.input_schema as { properties?: Record<string, Record<string, unknown>>; required?: string[] };
    const req = new Set(sch.required ?? []);
    const campos = Object.entries(sch.properties ?? {})
      .map(([k, v]) => `${k}${req.has(k) ? "" : "?"}: ${tipo(v)}`)
      .join(", ");
    const desc = (h.description ?? "").split(/(?<=\.)\s/)[0];
    return `- ${h.name}(${campos}) — ${desc}`;
  });
  return `## Acciones del motor (herramienta "motor")
${lineas.join("\n")}
- actualizar_cronica(texto) — reescribe tu crónica completa (tu memoria).
- consultar_reglas(tema, nombre?) — tema: ambientacion | razas_clases | heridas | viales | equipo | behelits | bestiario | mapa | criatura (con nombre) | accion (con nombre: esquema completo de esa acción, con la descripción de cada campo).
Si una acción falla por los datos, el error dice qué falta; consulta su esquema con consultar_reglas {tema: "accion", nombre}.`;
}

export const SISTEMA_WEB = [BASE, MUNDO, razasYClasesCortas(), HERIDAS, RESTO].join("\n\n");

export function consultarReglas(tema: string, nombre?: string): string {
  switch (String(tema).toLowerCase()) {
    case "ambientacion":
      return AMBIENTACION;
    case "razas_clases":
      return textoRazasYClases();
    case "heridas":
      return REGLAS_HERIDAS;
    case "viales":
      return REGLAS_VIALES;
    case "equipo":
      return REGLAS_EQUIPO;
    case "behelits":
      return REGLAS_BEHELIT;
    case "bestiario":
      return textoBestiario();
    case "mapa":
      return REGLAS_MAPA;
    case "criatura": {
      const c = nombre ? buscarCriatura(nombre) : undefined;
      return c ? fichaCriatura(c) : `No está en el bestiario${nombre ? `: "${nombre}"` : ""}. Puedes inventarla con aparecer_criatura y definicion.`;
    }
    case "accion": {
      const h = herramientas.find((x) => x.name === nombre);
      return h ? `${h.name}: ${h.description}\nEsquema: ${JSON.stringify(h.input_schema)}` : `No existe la acción "${nombre}". Acciones: ${herramientas.map((x) => x.name).join(", ")}.`;
    }
    default:
      throw new Error(`Tema desconocido "${tema}". Temas: ambientacion, razas_clases, heridas, viales, equipo, behelits, bestiario, mapa, criatura, accion.`);
  }
}
