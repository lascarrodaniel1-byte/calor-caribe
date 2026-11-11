import { writeFileSync } from "node:fs";
import { nuevaPartida, normalizarPartida } from "../../../src/estado.ts";
import { ejecutar } from "../../../src/herramientas.ts";
const p = nuevaPartida(); normalizarPartida(p); const E = (n: string, d: object): any => ejecutar(n, d, p);
E("tirar_don_arcano", { jugador: "Ana" });
E("guardar_personaje", { nombre: "Aldo", jugador: "Ana", raza: "Humano del Faro", clase: "Cazador de Brujas", nivel: 3, pv_max: 40, ca: 14, atributos: { fue: 12, des: 16, con: 14, int: 10, sab: 14, car: 10 }, inventario: ["Daga"], don_arcano: false, dote: "Terco" });
E("trama", { objetivo: "Hallar el relicario del Lich en la Marca Hueca" });
E("aparecer_criatura", { nombre: "Wendigo" });
writeFileSync(process.argv[2], JSON.stringify(p));
