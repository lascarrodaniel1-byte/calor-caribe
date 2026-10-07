// Estado persistente de la partida: historial de la conversación, fichas y notas del mundo.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import type Anthropic from "@anthropic-ai/sdk";

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
}

export interface Partida {
  creada: string;
  historial: Anthropic.Beta.BetaMessageParam[];
  personajes: Record<string, Personaje>;
  notas_mundo: string[];
}

export function nuevaPartida(): Partida {
  return { creada: new Date().toISOString(), historial: [], personajes: {}, notas_mundo: [] };
}

export function cargar(ruta: string): Partida | null {
  if (!existsSync(ruta)) return null;
  return JSON.parse(readFileSync(ruta, "utf8")) as Partida;
}

export function guardar(ruta: string, partida: Partida): void {
  writeFileSync(ruta, JSON.stringify(partida, null, 2));
}

export function fichaTexto(p: Personaje): string {
  const a = p.atributos;
  const mod = (v: number) => {
    const m = Math.floor((v - 10) / 2);
    return m >= 0 ? `+${m}` : `${m}`;
  };
  return [
    `${p.nombre}${p.jugador ? ` (${p.jugador})` : ""} — ${p.raza} ${p.clase} nv. ${p.nivel}`,
    `  PV ${p.pv}/${p.pv_max} · CA ${p.ca} · Oro ${p.oro}`,
    `  FUE ${a.fue}(${mod(a.fue)}) DES ${a.des}(${mod(a.des)}) CON ${a.con}(${mod(a.con)}) ` +
      `INT ${a.int}(${mod(a.int)}) SAB ${a.sab}(${mod(a.sab)}) CAR ${a.car}(${mod(a.car)})`,
    `  Inventario: ${p.inventario.join(", ") || "—"}`,
    p.condiciones.length ? `  Condiciones: ${p.condiciones.join(", ")}` : "",
    p.notas ? `  Notas: ${p.notas}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}
