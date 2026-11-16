// Nivel del DM compartido por mesa: el dueño lo fija en el documento «mesa/config» ({ nivel, por, ts }) y quien narra lo usa;
// sin config vale el selector local de cada navegador (compatibilidad con las partidas antiguas).
export const NIVELES_DM = ["quick", "default", "complex"] as const;
export type NivelDM = (typeof NIVELES_DM)[number];

const valido = (x: unknown): x is NivelDM => typeof x === "string" && (NIVELES_DM as readonly string[]).includes(x);

/** Nivel con el que se llama al modelo y de dónde sale: «mesa» si hay config válida; si no, el selector local (o «quick»). */
export function nivelEfectivo(config: { nivel?: unknown } | null | undefined, local: unknown): { nivel: NivelDM; origen: "mesa" | "local" } {
  if (config && valido(config.nivel)) return { nivel: config.nivel, origen: "mesa" };
  return { nivel: valido(local) ? local : "quick", origen: "local" };
}
