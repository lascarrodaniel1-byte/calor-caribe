// Parte sin dependencias del Cazador de Brujas (la usa la ficha).
import type { Personaje } from "./estado.js";

export const esCazador = (p: Personaje) => p.clase === "Cazador de Brujas";
export const HOJAS_INICIALES = 10, ESTACAS_INICIALES = 6, MAX_HOJAS = 40;

export interface Runas {
  potencia: number;
  cerrado: boolean;
  hojas: number;
  creador: string;
  curacion: boolean;
}

export interface RegistroMagia {
  id: string;
  hechizo: string;
  escuela?: string;
  lanzador: string;
  victima?: string;
  objeto?: string;
  negra: boolean;
  /** Dónde está de verdad quien lo lanzó (un lugar del mapa): secreto del DM. */
  lugar?: string;
  amarrado?: boolean;
}

/** Potencia de los papeles: 1 con nivel 1-2, y sube con el nivel (hasta 5 a nivel 12). */
export const potenciaDe = (p: Personaje) => Math.min(5, 1 + Math.floor(p.nivel / 3));
export const curaConRunas = (p: Personaje) => p.nivel >= 8;
export const papelesDe = (p: Personaje) => (p.papeles ??= { hojas: HOJAS_INICIALES, estacas: ESTACAS_INICIALES });

export function textoCazador(p: Personaje): string {
  if (!esCazador(p)) return "";
  const pa = papelesDe(p);
  return `  📜 Papeles de runas: ${pa.hojas} hoja(s), ${pa.estacas} estaca(s) · potencia ${potenciaDe(p)}${curaConRunas(p) ? " · curan en combate" : ""}${p.mascota ? ` · mascota: ${p.mascota.nombre} (${p.mascota.tipo === "halcon" ? "halcón" : "ratón"})` : " · aún sin mascota (mascota {accion: elegir})"}`;
}
