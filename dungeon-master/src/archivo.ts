// Guardar y cargar la partida en disco (solo terminal y servidor; la versión web usa la base de datos del artifact).
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { normalizarPartida, type Partida } from "./estado.js";

export function cargar(ruta: string): Partida | null {
  if (!existsSync(ruta)) return null;
  return normalizarPartida(JSON.parse(readFileSync(ruta, "utf8")) as Partida);
}

export function guardar(ruta: string, partida: Partida): void {
  writeFileSync(ruta, JSON.stringify(partida, null, 2));
}
