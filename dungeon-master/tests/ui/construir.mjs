// Construye la página (mesa-de-velmora.html) en un directorio temporal del sistema para las pruebas de navegador.
// Uso directo: node tests/ui/construir.mjs [directorio]   (imprime el directorio usado)
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = fileURLToPath(new URL("../../", import.meta.url));

export function construirPagina(dir) {
  dir ??= mkdtempSync(join(tmpdir(), "velmora-ui-"));
  mkdirSync(dir, { recursive: true });
  execFileSync(process.execPath, [join(RAIZ, "scripts", "construir-artifact.mjs"), join(dir, "mesa-de-velmora.html")], { cwd: RAIZ, stdio: ["ignore", "ignore", "inherit"] });
  return dir;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) console.log(construirPagina(process.argv[2]));
