// Pruebas de navegador (Playwright): construye la página en un directorio temporal y lanza cada script en serie.
// Uso: npm run test:ui   (variables: PLAYWRIGHT_MODULE, CHROMIUM_PATH; ver tests/README.md)
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { cargarPlaywright, chromiumDisponible } from "./ui/_comun.mjs";
import { construirPagina } from "./ui/construir.mjs";

const AQUI = fileURLToPath(new URL(".", import.meta.url));
const SCRIPTS = ["flujo", "bestiario", "run", "control", "genero", "sinnarracion", "clima", "combate", "programada"];
const LIMITE_MS = 150_000;

if (!(await cargarPlaywright())) {
  console.log("AVISO: no se encuentra Playwright (PLAYWRIGHT_MODULE o paquete 'playwright'); se omiten las pruebas de navegador.");
  process.exit(0);
}
if (!chromiumDisponible()) console.log("Aviso: no existe CHROMIUM_PATH; se usará el Chromium que traiga Playwright (si no hay ninguno, fallará el lanzamiento).");

const dir = construirPagina();
console.log("Página construida en " + dir);

const ejecutar = (nombre) => new Promise((resolve) => {
  const t0 = Date.now();
  const hijo = spawn(process.execPath, [AQUI + "ui/" + nombre + ".mjs", dir], { stdio: ["ignore", "pipe", "pipe"] });
  let salida = "", vencido = false;
  hijo.stdout.on("data", (d) => (salida += d)); hijo.stderr.on("data", (d) => (salida += d));
  const reloj = setTimeout(() => { vencido = true; hijo.kill("SIGKILL"); }, LIMITE_MS);
  hijo.on("close", (codigo) => { clearTimeout(reloj); resolve({ nombre, codigo, salida, vencido, seg: ((Date.now() - t0) / 1000).toFixed(1) }); });
});

const filas = [];
for (const n of SCRIPTS) {
  const r = await ejecutar(n);
  // Regla: código 0 y ninguna línea "errores de página: N" / "errores: N" con N > 0.
  const conErrores = [...r.salida.matchAll(/errores(?: de página)?: (\d+)/g)].filter((m) => Number(m[1]) > 0);
  const falla = r.vencido || r.codigo !== 0 || conErrores.length > 0;
  const motivo = r.vencido ? "tiempo agotado" : r.codigo !== 0 ? `salida ${r.codigo}` : conErrores.length ? `${conErrores.length} línea(s) con errores` : "";
  console.log(`\n=== ${n} ===\n${r.salida.trim()}`);
  filas.push({ n, estado: falla ? "FALLA" : "ok", motivo, seg: r.seg });
}

console.log("\nscript          estado  tiempo");
for (const f of filas) console.log(f.n.padEnd(14) + "  " + f.estado.padEnd(6) + "  " + f.seg + " s" + (f.motivo ? "  (" + f.motivo + ")" : ""));
const malas = filas.filter((f) => f.estado !== "ok").length;
console.log(`\n${filas.length - malas}/${filas.length} correctos`);
process.exit(malas ? 1 : 0);
