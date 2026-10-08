// Estado persistente de la partida: historial de la conversación, fichas y notas del mundo.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import type Anthropic from "@anthropic-ai/sdk";
import type { EstadoJefe } from "./bestiario.js";
import type { Objeto } from "./equipo.js";
import { pvMaxEfectivo, resumenHerida, type Herida } from "./heridas.js";
import { valor } from "./reglas.js";

export interface Personaje {
  nombre: string;
  jugador?: string;
  raza: string;
  clase: string;
  nivel: number;
  pv: number;
  pv_max: number;
  ca: number;
  atributos: Record<"fue" | "des" | "con" | "int" | "sab" | "car", number>;
  inventario: string[];
  oro: number;
  condiciones: string[];
  notas: string;
  heridas: Herida[];
  /** Secuelas permanentes o de larga duración de heridas ya cerradas. */
  secuelas: string[];
  /** Marcas de Ceniza por recibir magia divina. */
  ceniza: number;
  /** Puntos de Fuerza perdidos por pérdida de sangre (falta de hierro). */
  anemia: number;
  /** Sangre perdida en el episodio de hemorragia actual: cuanto más alto, más fácil perder Fuerza. */
  sangrado: number;
  /** Progreso hacia recuperar 1 punto de anemia. */
  anemia_progreso: number;
  /** Puntos de atributo robados por criaturas (vuelven cuando muere el ladrón). */
  robado: Partial<Record<"fue" | "des" | "con" | "int" | "sab" | "car", number>>;
  /** Viales tomados en las últimas 24 h (se reinician con pasar_tiempo). */
  dosis: { curacion: number; sueno: number };
}

export interface Partida {
  creada: string;
  historial: Anthropic.Beta.BetaMessageParam[];
  personajes: Record<string, Personaje>;
  notas_mundo: string[];
  /** Registro de objetos generados (incluye la verdad oculta de los malditos). */
  objetos: Record<string, Objeto>;
  /** Jefes que han aparecido, con su estado. */
  jefes: Record<string, EstadoJefe>;
}

export function nuevaPartida(): Partida {
  return { creada: new Date().toISOString(), historial: [], personajes: {}, notas_mundo: [], objetos: {}, jefes: {} };
}

/** Rellena los campos que faltan en fichas y partidas guardadas con versiones anteriores. */
export function normalizar(p: Personaje): Personaje {
  p.heridas ??= [];
  p.secuelas ??= [];
  p.ceniza ??= 0;
  p.anemia ??= 0;
  p.sangrado ??= 0;
  p.anemia_progreso ??= 0;
  p.dosis ??= { curacion: 0, sueno: 0 };
  p.robado ??= {};
  return p;
}

export function cargar(ruta: string): Partida | null {
  if (!existsSync(ruta)) return null;
  const partida = JSON.parse(readFileSync(ruta, "utf8")) as Partida;
  partida.objetos ??= {};
  partida.jefes ??= {};
  for (const j of Object.values(partida.jefes)) {
    j.presagios ??= [];
    j.robos ??= [];
  }
  Object.values(partida.personajes).forEach(normalizar);
  return partida;
}

export function guardar(ruta: string, partida: Partida): void {
  writeFileSync(ruta, JSON.stringify(partida, null, 2));
}

export function fichaTexto(p: Personaje): string {
  const mod = (v: number) => {
    const m = Math.floor((v - 10) / 2);
    return m >= 0 ? `+${m}` : `${m}`;
  };
  const maxEf = pvMaxEfectivo(p);
  return [
    `${p.nombre}${p.jugador ? ` (${p.jugador})` : ""} — ${p.raza} ${p.clase} nv. ${p.nivel}`,
    `  PV ${p.pv}/${maxEf}${maxEf < p.pv_max ? ` (máx. ${p.pv_max} sin heridas)` : ""} · CA ${p.ca} · Oro ${p.oro}`,
    "  " +
      (["fue", "des", "con", "int", "sab", "car"] as const)
        .map((k) => {
          const v = valor(p, k);
          const marcas = [k === "fue" && p.anemia ? `anemia −${p.anemia}` : "", p.robado[k] ? `robado −${p.robado[k]}` : ""].filter(Boolean);
          return `${k.toUpperCase()} ${v}(${mod(v)})${marcas.length ? ` [${marcas.join(", ")}]` : ""}`;
        })
        .join(" "),
    `  Inventario: ${p.inventario.join(", ") || "—"}`,
    p.condiciones.length ? `  Condiciones: ${p.condiciones.join(", ")}` : "",
    p.heridas.length ? `  Heridas:\n${p.heridas.map((h) => `    ${resumenHerida(h)}`).join("\n")}` : "",
    p.secuelas.length ? `  Secuelas: ${p.secuelas.join("; ")}` : "",
    p.ceniza ? `  Ceniza: ${p.ceniza}` : "",
    p.notas ? `  Notas: ${p.notas}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}
