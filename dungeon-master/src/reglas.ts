// Utilidades de reglas compartidas: modificadores y tiradas de salvación de los personajes.
import { describir, tirar } from "./dados.js";
import type { Personaje } from "./estado.js";
import { clase } from "./mundo.js";
import { efectos } from "./condiciones.js";

export type Atributo = "fue" | "des" | "con" | "int" | "sab" | "car";
export const ATRIBUTOS = ["fue", "des", "con", "int", "sab", "car"] as const;

export const signo = (n: number) => (n >= 0 ? `+${n}` : `${n}`);
export const mod = (v: number) => Math.floor((v - 10) / 2);

/** Atributo efectivo: la anemia resta Fuerza y algunas criaturas roban atributos. */
export function valor(p: Personaje, a: Atributo): number {
  const base = p.atributos[a] - (a === "fue" ? (p.anemia ?? 0) : 0) - (p.robado?.[a] ?? 0);
  // La furia del Berserker: la mitad de INT y CAR a cambio de +2 a FUE mientras dura.
  if (p.furia?.activa) {
    if (a === "int" || a === "car") return Math.floor(base / 2);
    if (a === "fue") return base + 2;
  }
  return base;
}

export const competencia = (p: Personaje) => 2 + Math.floor((p.nivel - 1) / 4) + (p.leyenda?.coronada ? 1 : 0);

/** ¿Tiene competencia en esa salvación según su clase? */
export function salvacionCompetente(p: Personaje, a: Atributo): boolean {
  const s = clase(p.clase)?.salvaciones.toLowerCase() ?? "";
  return s.includes(a);
}

export interface Salvacion {
  exito: boolean;
  total: number;
  natural: number;
  margen: number;
  texto: string;
}

export function salvacion(
  p: Personaje,
  a: Atributo,
  cd: number,
  opciones: { extra?: number; ventaja?: boolean; desventaja?: boolean } = {},
): Salvacion {
  const ef = efectos(p.condiciones);
  if (ef.falla.has(a))
    return { exito: false, total: 0, natural: 0, margen: -99, texto: `salvación de ${a.toUpperCase()}: fallo automático (${ef.motivos.join(", ")})` };
  const bono = mod(valor(p, a)) + (salvacionCompetente(p, a) ? competencia(p) : 0) + (opciones.extra ?? 0);
  const desv = !!opciones.desventaja || ef.salvDesv || (a === "des" && ef.salvDesDesv);
  // La fortaleza del Berserker de Ceniza: ventaja en las salvaciones de CON.
  const vent = !!opciones.ventaja || (a === "con" && p.clase === "Berserker de Ceniza");
  const modo = vent && !desv ? "ventaja" : desv && !vent ? "desventaja" : "normal";
  const t = tirar(`1d20${signo(bono)}`, modo);
  const natural = t.dados[0];
  const exito = natural === 20 || (natural !== 1 && t.total >= cd);
  return {
    exito,
    total: t.total,
    natural,
    margen: t.total - cd,
    texto: `salvación de ${a.toUpperCase()} ${describir(t)}${modo !== "normal" ? ` (${modo})` : ""} vs CD ${cd} → ${exito ? "éxito" : "fallo"}`,
  };
}

export function marcarMuerto(p: Personaje) {
  p.pv = 0;
  if (!p.condiciones.includes("muerto")) p.condiciones.push("muerto");
}
