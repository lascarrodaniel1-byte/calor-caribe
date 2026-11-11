import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { nuevaPartida, normalizarPartida } from "../../src/estado.ts";
import { ejecutar } from "../../src/herramientas.ts";
const src = readFileSync(fileURLToPath(new URL("../../src/herramientas.ts", import.meta.url)), "utf8");
const nombres = [...new Set([...src.matchAll(/^      case "([a-z_0-9]+)": \{/gm)].map((m) => m[1]))];
const mk = () => {
  const P = nuevaPartida(); normalizarPartida(P);
  for (const [n, c] of [["Ana", "Flagelante"], ["Bo", "Mercenario del Cuervo"], ["Cy", "Hechicero"]] as const)
    ejecutar("guardar_personaje", { don_arcano: false, nombre: n, jugador: n, genero: "Femenino", raza: "Humano del Faro", clase: c, nivel: 5, pv_max: 40, ca: 14, atributos: { fue: 16, des: 14, con: 14, int: 14, sab: 12, car: 10 }, inventario: ["Espada larga"], dote: "Terco", ...(c === "Hechicero" ? { tipos_magia: ["fuego"], linaje: "noble" } : {}) }, P);
  ejecutar("tiempo", { fijar: { dia: 1, hora: 8 } }, P);
  ejecutar("aparecer_criatura", { nombre: "Hambriento", repetir: true }, P);
  ejecutar("iniciativa", { participantes: ["Ana", "Bo", "Hambriento"] }, P);
  ejecutar("plano", { escena: "sala", poner: [{ nombre: "Ana" }] }, P); ejecutar("plano", { poner: [{ nombre: "Hambriento", ref: "Ana", direccion: "N", metros: 1.5 }, { nombre: "Bo", ref: "Ana", direccion: "E", metros: 1.5 }] }, P);
  return P;
};
const malos = /TypeError|Cannot read|is not a function|undefined is not|is not iterable|Maximum call stack|RangeError|ReferenceError|NaN/;
const entradas: any[] = [{}, { nombre: "Ana" }, { quien: "Ana" }, { quien: "Ana", accion: "ver" }, { atacante: "Ana", objetivo: "Hambriento" }, { objetivo: "Hambriento", accion: "ver" }, { accion: "ver" }, { accion: "catalogo" }, { nombre: "Ana", accion: "ver", pv_cambio: -3 }, { texto: "x" }];
let n = 0; const fallos: string[] = [];
for (const nom of nombres) for (const e of entradas) {
  const P = mk(); n++;
  try { const r: any = ejecutar(nom, e, P); const t = typeof r === "string" ? r : JSON.stringify(r); if (malos.test(t)) fallos.push(`${nom} ${JSON.stringify(e)} → ${t.slice(0, 140)}`); }
  catch (err: any) { fallos.push(`${nom} ${JSON.stringify(e)} LANZA ${String(err?.message).slice(0, 120)}`); }
}
console.log(`${nombres.length} herramientas × ${entradas.length} entradas = ${n} llamadas; problemas: ${fallos.length}`);
console.log([...new Set(fallos)].slice(0, 40).join("\n"));
