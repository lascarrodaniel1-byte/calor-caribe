// Comandos de mesa (sin pasar por el DM), compartidos por la terminal, el servidor y la web.
import { describir, tirar } from "./dados.js";
import { fichaTexto, type Partida } from "./estado.js";
import { AMBIENTACION, textoRazasYClases } from "./mundo.js";
import { VIALES } from "./viales.js";

export const AYUDA = `Comandos:
  /fichas          fichas de los personajes (con heridas y secuelas)
  /mundo           ambientación de Velmora
  /razas           razas y clases disponibles
  /viales          qué hace cada vial
  /notas           notas de campaña del DM
  /tirar 1d20+3    tira dados tú mismo (sin pasar por el DM)
  /ayuda           esta ayuda`;

/** Comandos de mesa (sin pasar por el DM). Devuelve null si no es un comando conocido. */
export function comando(partida: Partida, texto: string): { texto: string; publico: boolean } | null {
  const [cmd, ...args] = texto.trim().split(/\s+/);
  switch (cmd) {
    case "/ayuda":
      return { texto: AYUDA, publico: false };
    case "/fichas": {
      const ps = Object.values(partida.personajes);
      return { texto: ps.length ? ps.map(fichaTexto).join("\n\n") : "Aún no hay personajes.", publico: false };
    }
    case "/mundo":
      return { texto: AMBIENTACION.replace(/\*\*/g, ""), publico: false };
    case "/razas":
      return { texto: textoRazasYClases().replace(/\*\*/g, ""), publico: false };
    case "/viales":
      return { texto: Object.entries(VIALES).map(([n, v]) => `- ${n} (${v.tipo}): ${v.descripcion}`).join("\n"), publico: false };
    case "/notas":
      return { texto: partida.notas_mundo.length ? partida.notas_mundo.map((n) => `- ${n}`).join("\n") : "Sin notas todavía.", publico: false };
    case "/tirar":
      try {
        return { texto: `🎲 ${describir(tirar(args.join("") || "1d20"))}`, publico: true };
      } catch (e) {
        return { texto: (e as Error).message, publico: false };
      }
    default:
      return null;
  }
}
