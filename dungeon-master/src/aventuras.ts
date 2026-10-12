// Archivo de aventuras anteriores: al reiniciar la partida se guarda un resumen de la que acaba (su gancho, su
// objetivo, su amenaza, sus PNJ y lugares) en un documento que el reinicio NO borra, y el DM lo recibe como lista
// de lo que no debe repetir. Así cada aventura nueva es de verdad nueva.
import type { Partida } from "./estado.js";

export interface AventuraPrevia {
  ts: number;
  resumen: string;
}

export const MAX_AVENTURAS = 8;
const MAX_RESUMEN = 1100;

const corta = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s);

/** Resumen de la aventura en curso. `inicio` es lo que narró el DM al empezar. */
export function resumenAventura(p: Partida, inicio = ""): string {
  const t = p.trama;
  const pnjs = Object.values(p.pnjs ?? {}).slice(0, 10).map((x) => `${x.nombre} (${x.rol || "?"})`);
  const lugares = Object.keys(p.mapa?.lugares ?? {}).slice(0, 8);
  const pjs = Object.values(p.personajes).map((x) => `${x.nombre} (${x.clase})`);
  const partes = [
    inicio ? `Apertura: ${corta(inicio.replace(/\s+/g, " "), 260)}` : "",
    t?.objetivo ? `Objetivo: ${corta(t.objetivo, 140)}` : "",
    t?.amenaza ? `Amenaza: ${corta(t.amenaza, 120)}` : "",
    t?.hilos?.length ? `Hilos: ${t.hilos.map((h) => corta(h, 110)).join(" | ")}` : "",
    t?.pistas?.length ? `Giros: ${t.pistas.slice(-3).map((h) => corta(h, 110)).join(" | ")}` : "",
    pnjs.length ? `PNJ: ${pnjs.join(", ")}` : "",
    lugares.length ? `Lugares: ${lugares.join(", ")}` : "",
    pjs.length ? `Personajes: ${pjs.join(", ")}` : "",
  ].filter(Boolean);
  return corta(partes.join(". "), MAX_RESUMEN);
}

/** Añade una aventura al archivo (las más antiguas se olvidan) sin repetir la misma. */
export function archivar(lista: AventuraPrevia[], nueva: AventuraPrevia): AventuraPrevia[] {
  if (!nueva.resumen) return lista;
  const sin = lista.filter((a) => a.resumen !== nueva.resumen);
  return [...sin, nueva].slice(-MAX_AVENTURAS);
}

export function leerArchivo(doc: unknown): AventuraPrevia[] {
  const arr = (doc as { aventuras?: unknown } | null)?.aventuras;
  if (!Array.isArray(arr)) return [];
  return arr
    .map((a) => ({ ts: Number((a as AventuraPrevia)?.ts) || 0, resumen: String((a as AventuraPrevia)?.resumen ?? "") }))
    .filter((a) => a.resumen)
    .slice(-MAX_AVENTURAS);
}

/** Bloque para el DM con lo que ya se jugó en la mesa. */
export function textoAventurasPrevias(lista: AventuraPrevia[]): string {
  if (!lista.length) return "";
  return [
    "# AVENTURAS ANTERIORES DE ESTA MESA (no las repitas)",
    "Esta mesa ya jugó lo siguiente. La aventura de ahora debe ser distinta en gancho, conflicto, estructura (no otro encargo de escolta o recado como el de antes), PNJ con otros nombres y lugares nuevos. Puedes aludir al mundo y a su pasado, pero no reciclar tramas, giros ni personajes.",
    ...lista.map((a, i) => `${i + 1}. ${a.resumen}`),
  ].join("\n");
}
