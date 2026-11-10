// Parte sin dependencias de las artes marciales (la usan la ficha, el combate, las salvaciones y las maniobras).
import type { Personaje } from "./estado.js";
import type { Combatiente } from "./combate.js";
import { nvl } from "./niveles.js";

/** Los estilos que conoce un personaje (el Flagelante lleva el Haemajitsu de serie). */
export function artesDe(p: Personaje): string[] {
  const l = [...(p.artes ?? [])];
  if (p.clase === "Flagelante" && !l.includes("haemajitsu")) l.unshift("haemajitsu");
  return l;
}
export const tieneArte = (p: Personaje, id: string): boolean => artesDe(p).includes(id);

/** Maestría: Iniciado de entrada, Practicante a nivel 3 (+2 de desplazamiento) y Maestro a nivel 7 (+2). */
export function maestria(p: Personaje): 1 | 2 | 3 {
  return p.nivel >= nvl(7) ? 3 : p.nivel >= nvl(3) ? 2 : 1;
}
export const NOMBRE_MAESTRIA = ["", "Iniciado", "Practicante", "Maestro"];

/** ¿Domina este estilo un combatiente? (PJ por ficha; criatura por su plantilla; «todos» salvo Haemajitsu y Contracorriente.) */
export function arteDeCombatiente(c: Combatiente, id: string): boolean {
  if (c.tipo === "pj") return tieneArte(c.p, id);
  if (c.tipo === "criatura") { const a = c.j.definicion.artes ?? []; return a.includes(id) || (a.includes("todos") && id !== "haemajitsu" && id !== "contracorriente"); }
  return false;
}
/** Maestría de un combatiente: PJ por nivel, criatura (Kuru) siempre Maestro. */
export const maestriaDe = (c: Combatiente): 1 | 2 | 3 => (c.tipo === "pj" ? maestria(c.p) : 3);

/** El dado de los golpes del Flagelante crece con el nivel: 1d6 (como una maza), 1d8, 1d10 y 1d12. */
export function dadoHaemajitsu(p: Personaje): string {
  return p.nivel >= nvl(13) ? "1d12" : p.nivel >= nvl(9) ? "1d10" : p.nivel >= nvl(5) ? "1d8" : "1d6";
}
