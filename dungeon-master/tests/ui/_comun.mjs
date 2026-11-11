// Utilidades comunes de las pruebas de navegador (Playwright).
//   PLAYWRIGHT_MODULE: ruta al módulo de Playwright (por defecto /opt/node-tools/node_modules/playwright/index.mjs; si no existe, "playwright").
//   CHROMIUM_PATH: ejecutable de Chromium (por defecto /opt/pw-browsers/chromium; si no existe, el que traiga Playwright).
import { existsSync, mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { construirPagina } from "./construir.mjs";

const AQUI = fileURLToPath(new URL(".", import.meta.url));

export const MOCK = join(AQUI, "mock.js");
export const fixture = (nombre) => join(AQUI, "..", "fixtures", nombre);

const rutaModulo = process.env.PLAYWRIGHT_MODULE ?? "/opt/node-tools/node_modules/playwright/index.mjs";
const rutaChromium = process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium";

/** Ejecutable de Chromium si existe; undefined → Playwright usa el suyo. */
export const chromiumDisponible = () => (existsSync(rutaChromium) ? rutaChromium : undefined);

/** Carga Playwright; devuelve null si no está instalado. */
export async function cargarPlaywright() {
  try {
    if (existsSync(rutaModulo)) return await import(pathToFileURL(rutaModulo).href);
    return await import("playwright");
  } catch {
    return null;
  }
}

/** Lanza Chromium (headless). */
export async function lanzar() {
  const pw = await cargarPlaywright();
  if (!pw) throw new Error("No se encuentra Playwright (define PLAYWRIGHT_MODULE o instala 'playwright')");
  const executablePath = chromiumDisponible();
  return pw.chromium.launch(executablePath ? { executablePath } : {});
}

/** Directorio con mesa-de-velmora.html: el del argumento 2 o, si falta, uno construido ahora en un directorio temporal. */
export async function paginaDe() {
  return process.argv[2] ?? construirPagina();
}

/** Ruta de un fichero de salida (capturas, exportaciones) en un directorio temporal propio de esta ejecución. */
let dirSalida;
export function salida(nombre) {
  dirSalida ??= mkdtempSync(join(process.env.VELMORA_SALIDA ?? tmpdir(), "velmora-salida-"));
  mkdirSync(dirSalida, { recursive: true });
  return join(dirSalida, nombre);
}
