// Catálogo de tipos de daño (puro, sin dependencias de la página). Una sola lista de tipos canónicos con
// sus alias, para que «perforante», «punta», «hielo» o «Frio» signifiquen lo mismo en cualquier herramienta.
// Fase A cableada: atacar, habilidades, guardas, trampas, naves, tragado y modificar_personaje aceptan cualquier alias y
// trabajan con el tipo canónico; tipoHerida y las resistencias raciales y de la Furia usan este catálogo (ver docs/DANOS.md).
import { z } from "zod";
import type { TipoDanoArmadura } from "./armadura.js";

/** Tipos canónicos (con tilde, tal como se muestran). Los tres primeros son los físicos. */
export const TIPOS_DANO_CANONICOS = [
  "cortante", "perforante", "contundente",
  "fuego", "frío", "eléctrico", "trueno", "ácido", "veneno", "necrótico", "radiante", "psíquico", "fuerza",
] as const;
export type TipoDano = (typeof TIPOS_DANO_CANONICOS)[number];

const FISICOS: readonly TipoDano[] = ["cortante", "perforante", "contundente"];

/** Un alias reconocido. `dudoso` explica por qué se decidió así (lo revisa el dueño). */
export interface AliasDano { alias: string; tipo: TipoDano; dudoso?: string }

const a = (tipo: TipoDano, ...alias: string[]): AliasDano[] => alias.map((x) => ({ alias: x, tipo }));
const d = (tipo: TipoDano, alias: string, dudoso: string): AliasDano => ({ alias, tipo, dudoso });

/** Alias reconocidos además del propio nombre canónico (que siempre vale). Se comparan sin tildes ni mayúsculas. */
export const ALIAS_DE_DANO: readonly AliasDano[] = [
  ...a("cortante", "corte", "filo", "tajo", "cortantes"),
  ...a("perforante", "punta", "penetrante", "perforacion", "pinchazo", "perforantes"),
  ...a("contundente", "contusion", "golpe", "aplastante", "contundentes"),
  ...a("fuego", "llama", "llamas", "igneo", "abrasador", "ardiente", "incendiario", "incendiaria"),
  d("fuego", "calor", "El calor ambiental (desierto, horno) se trata como fuego; no hay tipo «calor»."),
  ...a("frío", "frio", "gelido", "helado", "congelante", "escarcha"),
  d("frío", "hielo", "«hielo» es también un id de magia (herramientas.ts); como tipo de daño es frío."),
  ...a("eléctrico", "electrico", "electrica", "electricidad", "relampago", "voltaico"),
  d("eléctrico", "rayo", "«rayo» es también un id de magia; como tipo de daño es eléctrico (no hay «rayo» aparte). Trueno es otro tipo."),
  ...a("trueno", "sonico", "sonora", "sonoro", "atronador"),
  ...a("ácido", "acido", "corrosivo", "corrosion"),
  ...a("veneno", "toxico", "toxina", "ponzona", "venenoso"),
  ...a("necrótico", "necrotico", "necrosis"),
  ...a("radiante", "sagrado", "sagrada", "resplandeciente"),
  d("radiante", "luz", "La luz que quema (Grieta de luz) es radiante; la luz sin daño no es un tipo."),
  ...a("psíquico", "psiquico", "mental"),
  ...a("fuerza", "energia de fuerza"),
];

/** Pseudo-tipos que NO son tipos de daño: describen la fuente (magia, material), no el elemento. Ver FuenteDano. */
export const PSEUDO_TIPOS_NO_DANO: readonly string[] = ["mágico", "no mágico", "plata", "adamantina"];

/** La fuente del daño (no su elemento): lo que hoy se escribe como «mágico», «no mágico», «plata»… va aparte del tipo y decide las resistencias «no mágicas». */
export interface FuenteDano {
  /** true si el daño es mágico (por conjuro, arma mágica o criatura mágica); omitido = no se sabe. */
  magico?: boolean;
  /** Material del arma que cuenta para vulnerabilidades o inmunidades («no mágico salvo plata»). */
  material?: "plata" | "adamantina" | "hierro frío" | "hierro caliente" | "sal" | "agua" | "madera" | (string & {});
}

/** Minúsculas, sin tildes, espacios colapsados y sin «daño de/por» delante. */
function limpiar(s: string): string {
  return s
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/\s+/g, " ").trim()
    .replace(/^danos? (?:de |por |del )?/, "").replace(/ damage$/, "").trim();
}

const INDICE: Map<string, TipoDano> = new Map();
for (const t of TIPOS_DANO_CANONICOS) INDICE.set(limpiar(t), t);
for (const x of ALIAS_DE_DANO) INDICE.set(limpiar(x.alias), x.tipo);

/** El tipo canónico de un texto libre, o undefined si no es un tipo de daño (incluye «mágico», «plata», vacío…). */
export function normalizarTipo(s: string | null | undefined): TipoDano | undefined {
  if (typeof s !== "string") return undefined;
  return INDICE.get(limpiar(s));
}

export const esFisico = (t: TipoDano | undefined): boolean => !!t && FISICOS.includes(t);

/** Puente con el vocabulario de armadura.ts (`TIPOS_DANO`): cortante→corte, perforante→punta; undefined si no es físico. */
export function aVocabularioArmadura(t: TipoDano | undefined): TipoDanoArmadura | undefined {
  if (!esFisico(t)) return undefined;
  return t === "cortante" ? "corte" : t === "perforante" ? "punta" : "contundente";
}

/** Al revés: el tipo de un arma reconocida por armadura.ts (corte/punta/contundente) en el vocabulario canónico. */
export const deVocabularioArmadura = (t: TipoDanoArmadura | undefined): TipoDano | undefined =>
  t === "corte" ? "cortante" : t === "punta" ? "perforante" : t;

/** Tipos de herida de heridas.ts (solo descriptivos, salvo que corte, perforación y mordedura se pueden cauterizar). */
export type TipoHerida = "corte" | "perforacion" | "contusion" | "quemadura" | "mordedura" | "necrotica";
/** Qué herida deja cada tipo de daño. Decisión de criterio (a confirmar): lo que quema o abrasa (fuego, ácido, frío, eléctrico, radiante) es
 *  «quemadura»; el veneno y lo necrótico, «necrotica» (tejido muerto); el trueno es una onda de choque (contusión); y lo psíquico y la fuerza
 *  no abren la carne: «contusion» es el valor neutro (el de siempre cuando no se sabe). Sin tipo: contusión. */
const HERIDA_DE_TIPO: Record<TipoDano, TipoHerida> = {
  cortante: "corte", perforante: "perforacion", contundente: "contusion",
  fuego: "quemadura", ácido: "quemadura", frío: "quemadura", eléctrico: "quemadura", radiante: "quemadura",
  veneno: "necrotica", necrótico: "necrotica",
  trueno: "contusion", psíquico: "contusion", fuerza: "contusion",
};
export const tipoHeridaDe = (t: TipoDano | undefined): TipoHerida => (t ? HERIDA_DE_TIPO[t] : "contusion");

/** Nombre para mostrar (con tilde). */
export function etiqueta(t: TipoDano): string {
  return t;
}

/** Esquema zod para `tipo_dano`: acepta cualquier alias y devuelve el canónico; rechaza lo desconocido con mensaje claro. */
export const tipoDanoSchema = z.string().transform((s, ctx): TipoDano => {
  const t = normalizarTipo(s);
  if (!t) {
    ctx.addIssue({
      code: "custom",
      message: `Tipo de daño «${s}» desconocido: usa ${TIPOS_DANO_CANONICOS.map(etiqueta).join(", ")} (o un alias como corte, punta, hielo, rayo). ${PSEUDO_TIPOS_NO_DANO.map((p) => `«${p}»`).join(", ")} no son tipos de daño.`,
    });
    return z.NEVER;
  }
  return t;
});

// ---------------------------------------------------------------- aplicación del daño (fase B)

/** Una resistencia, inmunidad o vulnerabilidad: a qué tipo se aplica, por qué (texto para el aviso) y, si hace falta, bajo qué condición de la fuente. */
export interface ReglaDano {
  tipo: TipoDano;
  /** Motivo que sale en el aviso («Resistencia enana al veneno», «Furia: resiste el daño físico»). */
  motivo: string;
  /** Solo vale si el daño NO es mágico (`fuente.magico !== true`). Sin dato de la fuente se trata como no mágico. */
  soloNoMagico?: boolean;
  /** No vale si la fuente es de este material («resiste el corte no mágico salvo plata»). */
  salvoMaterial?: string;
  /** Solo vale si la fuente es de este material («vulnerable a la plata»). */
  soloMaterial?: string;
}
/** La regla tal como se escribe en la ficha de una criatura (sin motivo: lo genera `perfilDeCriatura` en bestiario.ts). */
export type ReglaFicha = Omit<ReglaDano, "motivo">;
/** Lo que un objetivo resiste, no sufre o sufre doble. Lo construyen `perfilDePersonaje` (rasgos.ts) y, para criaturas, su ficha. */
export interface PerfilDano { resiste?: readonly ReglaDano[]; inmune?: readonly ReglaDano[]; vulnerable?: readonly ReglaDano[] }
export interface ResultadoDano {
  final: number;
  /** Una línea por cada paso que cambió el daño por su tipo (inmunidad, resistencia, vulnerabilidad), con «antes → después»; vacío si no cambió nada. La mitad por salvación no sale aquí. */
  detalle: string[];
}

/** Materiales con alias («hierro cálido/candente/al rojo» = «hierro caliente»; «sal gorda/en abundancia» = «sal»). Mismo criterio que los tipos: sin tildes ni mayúsculas. */
export function normalizarMaterial(s: string): string {
  const m = limpiar(s);
  if (/^hierro (calido|caliente|candente|al rojo|rusiente|calentado)$/.test(m)) return "hierro caliente";
  if (/^sal( gorda| gruesa| en abundancia| marina)?$/.test(m)) return "sal";
  return m;
}
const mismoMaterial = (a: string | undefined, b: string | undefined) => !!a && !!b && normalizarMaterial(a) === normalizarMaterial(b);
function aplica(r: ReglaDano, tipo: TipoDano | undefined, fuente: FuenteDano | undefined, sinTipoEsFisico: boolean): boolean {
  if (tipo ? r.tipo !== tipo : !(sinTipoEsFisico && esFisico(r.tipo))) return false;
  if (r.soloNoMagico && fuente?.magico === true) return false;
  if (r.salvoMaterial && mismoMaterial(fuente?.material, r.salvoMaterial)) return false;
  if (r.soloMaterial && !mismoMaterial(fuente?.material, r.soloMaterial)) return false;
  return true;
}

/** ¿El objetivo resiste este tipo de daño de esta fuente? (para dar ventaja en la salvación de un estado). */
export function resiste(objetivo: PerfilDano, tipo: TipoDano, fuente?: FuenteDano): boolean {
  return (objetivo.resiste ?? []).some((r) => aplica(r, tipo, fuente, false));
}

/** UNA sola función para aplicar el daño por su tipo, con el orden de 5e:
 *  1. los bonificadores y la armadura ya vienen incluidos en `cantidad`; `mitadSalvacion` aplica la mitad (redondeada abajo) de la salvación;
 *  2. inmunidad: 0;
 *  3. resistencia (mitad, redondeada abajo) y vulnerabilidad (doble): si coinciden en el mismo tipo SE ANULAN; varias resistencias al mismo tipo
 *     no se acumulan (una sola mitad), ni varias vulnerabilidades (un solo doble).
 *  Sin tipo no se aplica nada (salvo `sinTipoEsFisico`: «sin tipo se supone físico», como la Furia en atacar). */
export function aplicarDano(a: { objetivo: PerfilDano; cantidad: number; tipo?: TipoDano; fuente?: FuenteDano; mitadSalvacion?: boolean; sinTipoEsFisico?: boolean }): ResultadoDano {
  let c = Math.max(0, Math.trunc(a.cantidad));
  if (a.mitadSalvacion) c = Math.floor(c / 2);
  const detalle: string[] = [];
  if (c === 0) return { final: 0, detalle };
  const f = (rs: readonly ReglaDano[] | undefined) => (rs ?? []).find((r) => aplica(r, a.tipo, a.fuente, !!a.sinTipoEsFisico));
  const inm = f(a.objetivo.inmune);
  if (inm) return { final: 0, detalle: [`${inm.motivo}: ${c} → 0`] };
  const res = f(a.objetivo.resiste), vul = f(a.objetivo.vulnerable);
  if (res && vul) return { final: c, detalle: [`${res.motivo} y ${vul.motivo} se anulan: ${c}`] };
  if (res) { const n = Math.floor(c / 2); return { final: n, detalle: [`${res.motivo}: ${c} → ${n}`] }; }
  if (vul) return { final: c * 2, detalle: [`${vul.motivo}: ${c} → ${c * 2}`] };
  return { final: c, detalle };
}

/** El detalle de `aplicarDano` como nota breve de una línea para el aviso: « (Resistencia al frío del Tritón: 10 → 5)»; vacío si no hubo nada. */
export const notaDano = (detalle: readonly string[]): string => (detalle.length ? ` (${detalle.join("; ")})` : "");
