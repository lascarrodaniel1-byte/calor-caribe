import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { normalizarPartida } from "../../src/estado.ts";
import { ejecutar } from "../../src/herramientas.ts";
import { estadoParaDM } from "../../src/navegador.ts";
// Sin argumentos, recorre las partidas de tests/fixtures.
const fix = (n: string) => fileURLToPath(new URL("../fixtures/" + n, import.meta.url));
const ficheros = process.argv.length > 2 ? process.argv.slice(2) : ["partida-mesa.json", "partida-run.json", "partida-codice.json"].map(fix);
for (const f of ficheros) {
  const P = JSON.parse(readFileSync(f, "utf8")); const base = P.partida ?? P.estado?.partida ?? P; normalizarPartida(base);
  const e = estadoParaDM(base); const nombres = Object.keys(base.personajes ?? {});
  console.log(f.split("/").pop(), "· personajes:", nombres.join(", ") || "(ninguno)", "· estado", e.length, "car · sin género:", (e.match(/género sin definir/g) || []).length);
  for (const n of nombres.slice(0, 3)) { const r = ejecutar("arte_marcial", { accion: "ver", quien: n }, base); const r2 = ejecutar("prueba", { quien: n, habilidad: "percepcion", cd: 10, motivo: "mira" }, base); console.log("  ", n, String((r as any).contenido ?? r).slice(0, 60).replace(/\n/g, " "), "|", String((r2 as any).contenido ?? r2).slice(0, 70)); }
  JSON.parse(JSON.stringify(base));
}
