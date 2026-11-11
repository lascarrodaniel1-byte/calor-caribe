import { writeFileSync } from "node:fs";
import { nuevaPartida, normalizarPartida } from "../../../src/estado.ts";
import { ejecutar } from "../../../src/herramientas.ts";
const p = nuevaPartida(); normalizarPartida(p); const E = (n: string, d: object): any => ejecutar(n, d, p);
E("aparecer_criatura", { nombre: "Wendigo" }); E("danar_criatura", { nombre: "Wendigo", cantidad: 9999 });
E("aparecer_criatura", { nombre: "Ghul de las fosas" });
E("aparecer_criatura", { nombre: "Ysolde" });
E("saber", { accion: "descubrir", tema: "Lich", texto: "Un erudito de Aldenmar asegura que su relicario es un hueso de dios." });
writeFileSync(process.argv[2], JSON.stringify(p));
