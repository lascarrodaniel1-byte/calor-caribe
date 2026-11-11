import { writeFileSync } from "node:fs";
import { nuevaPartida, normalizarPartida } from "../../../src/estado.ts";
import { ejecutar } from "../../../src/herramientas.ts";
const p = nuevaPartida(); normalizarPartida(p); const E = (n: string, d: object): any => ejecutar(n, d, p);
for (const [n, j, c] of [["Aldo", "Ana", "Cazador de Brujas"], ["Bruna", "Beto", "Mercenario del Cuervo"]]) { E("tirar_don_arcano", { jugador: j }); E("guardar_personaje", { nombre: n, jugador: j, raza: "Humano del Faro", clase: c, nivel: 2, pv_max: 30, ca: 13, atributos: { fue: 12, des: 14, con: 14, int: 10, sab: 12, car: 10 }, inventario: ["Daga"], don_arcano: false, dote: "Terco" }); }
writeFileSync(process.argv[2], JSON.stringify(p));
