// Construye la página de la Mesa de Velmora para publicarla como artifact de claude.ai:
// empaqueta el motor (src/navegador.ts) y lo incrusta en web/artifact.template.html.
// Uso: npm run artifact -- [ruta de salida]   (por defecto, dist/mesa-de-velmora.html)
import { build } from "esbuild";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const salida = process.argv[2] ?? join(raiz, "dist", "mesa-de-velmora.html");

const r = await build({
  entryPoints: [join(raiz, "src", "navegador.ts")],
  bundle: true,
  format: "iife",
  globalName: "Velmora",
  platform: "browser",
  target: "es2020",
  minify: true,
  legalComments: "none",
  write: false,
});
// Un "</script" dentro del código cerraría la etiqueta antes de tiempo.
const motor = r.outputFiles[0].text.replace(/<\/script/gi, "<\\/script");
const plantilla = readFileSync(join(raiz, "web", "artifact.template.html"), "utf8");
const html = plantilla.replace("/*__MOTOR__*/", () => motor);
mkdirSync(dirname(salida), { recursive: true });
writeFileSync(salida, html);
console.log(`Página generada: ${salida} (${Math.round(html.length / 1024)} KB)`);
