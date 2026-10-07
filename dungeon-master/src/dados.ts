// Tiradas de dados con notación estándar de D&D: "1d20+5", "2d6", "4d6kh3", "d100-1".
import { randomInt } from "node:crypto";

export type Modo = "normal" | "ventaja" | "desventaja";

export interface Tirada {
  expresion: string;
  dados: number[];
  /** Solo con ventaja/desventaja: la otra tirada de d20 que se descartó. */
  descartados: number[];
  modificador: number;
  total: number;
}

const PATRON = /^(\d*)d(\d+)(?:k([hl])(\d+))?([+-]\d+)?$/i;

export function tirar(expresion: string, modo: Modo = "normal"): Tirada {
  const limpia = expresion.replace(/\s+/g, "").toLowerCase();
  const m = PATRON.exec(limpia);
  if (!m) throw new Error(`Expresión de dados no válida: "${expresion}" (usa algo como 1d20+3)`);

  const cantidad = m[1] ? Number(m[1]) : 1;
  const caras = Number(m[2]);
  const modificador = m[5] ? Number(m[5]) : 0;
  if (cantidad < 1 || cantidad > 100) throw new Error("Se pueden tirar entre 1 y 100 dados");
  if (caras < 2 || caras > 1000) throw new Error("Un dado debe tener entre 2 y 1000 caras");

  const tiraUno = () => randomInt(1, caras + 1);
  let dados = Array.from({ length: cantidad }, tiraUno);
  let descartados: number[] = [];

  // Ventaja/desventaja: se tira dos veces el d20 y se queda el mayor/menor.
  if (modo !== "normal" && cantidad === 1 && caras === 20) {
    const otro = tiraUno();
    const quedarse = modo === "ventaja" ? Math.max(dados[0], otro) : Math.min(dados[0], otro);
    descartados = [quedarse === dados[0] ? otro : dados[0]];
    dados = [quedarse];
  }

  // "kh3" = quedarse con los 3 más altos, "kl1" = con el más bajo.
  if (m[3] && m[4]) {
    const n = Math.min(Number(m[4]), dados.length);
    const ordenados = [...dados].sort((a, b) => (m[3] === "h" ? b - a : a - b));
    descartados = ordenados.slice(n);
    dados = ordenados.slice(0, n);
  }

  const total = dados.reduce((s, d) => s + d, 0) + modificador;
  return { expresion: limpia, dados, descartados, modificador, total };
}

export function describir(t: Tirada): string {
  const mod = t.modificador ? (t.modificador > 0 ? ` + ${t.modificador}` : ` - ${-t.modificador}`) : "";
  const desc = t.descartados.length ? ` (descartado: ${t.descartados.join(", ")})` : "";
  return `${t.expresion}: [${t.dados.join(", ")}]${mod} = ${t.total}${desc}`;
}
