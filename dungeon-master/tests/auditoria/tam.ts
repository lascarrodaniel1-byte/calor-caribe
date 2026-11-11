import { nuevaPartida, normalizarPartida } from "../../src/estado.ts";
import { ejecutar } from "../../src/herramientas.ts";
import { estadoParaDM } from "../../src/navegador.ts";
const P = nuevaPartida(); normalizarPartida(P);
for (const [n, c, r] of [["Ana", "Flagelante", "Varg"], ["Bo", "Mercenario del Cuervo", "Humano del Faro"], ["Cy", "Hechicero", "Elfo Marchito"], ["Di", "Degollador", "Tritón de las Mareas"]] as const)
  ejecutar("guardar_personaje", { don_arcano: false, nombre: n, jugador: n, genero: "Femenino", raza: r, clase: c, nivel: 9, pv_max: 70, ca: 14, atributos: { fue: 16, des: 14, con: 14, int: 14, sab: 12, car: 10 }, inventario: ["Espada larga", "Daga", "Raciones de viaje (5)", "Odre de agua (2)"], dote: "Terco", ...(c === "Hechicero" ? { tipos_magia: ["fuego"], linaje: "noble" } : {}) }, P);
ejecutar("arte_marcial", { accion: "aprender", quien: "Bo", arte: "Filo del Cuervo", via: "clase" }, P);
const e = estadoParaDM(P); console.log("estado para el DM:", e.length, "caracteres ≈", Math.round(e.length / 4), "tokens");
console.log(e.split("\n").map((l) => [l.length, l.slice(0, 70)]).sort((a: any, b: any) => b[0] - a[0]).slice(0, 6).map((x: any) => x.join("  ")).join("\n"));
