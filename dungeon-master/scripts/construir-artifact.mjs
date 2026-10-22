// Construye la página de la Mesa de Velmora para publicarla como artifact de claude.ai:
// empaqueta el motor (src/navegador.ts) y lo incrusta en web/artifact.template.html.
// Uso: npm run artifact -- [ruta de salida]   (por defecto, dist/mesa-de-velmora.html)
import { build } from "esbuild";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const salida = process.argv[2] ?? join(raiz, "dist", "mesa-de-velmora.html");

// zod empaqueta sus 50 traducciones de mensajes de error aunque solo se use el inglés: se queda solo con «en».
const soloIngles = {
  name: "zod-solo-ingles",
  setup(b) {
    b.onResolve({ filter: /locales\/index\.js$/ }, (a) => (a.importer.includes("node_modules/zod") ? { path: "zod-locales", namespace: "zod-locales" } : undefined));
    b.onLoad({ filter: /.*/, namespace: "zod-locales" }, () => ({
      contents: `export { default as en } from ${JSON.stringify(join(raiz, "node_modules", "zod", "v4", "locales", "en.js"))};`,
      resolveDir: raiz,
    }));
  },
};

const r = await build({
  plugins: [soloIngles],
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
// La ilustración del mapa va dentro de la página, para que sea un único archivo.
const mapa = "data:image/jpeg;base64," + readFileSync(join(raiz, "web", "mapa-velmora.jpg")).toString("base64");
const html = plantilla.replace("/*__MOTOR__*/", () => motor).replace("/*__MAPA__*/", () => mapa);
mkdirSync(dirname(salida), { recursive: true });
writeFileSync(salida, html);
console.log(`Página generada: ${salida} (${Math.round(html.length / 1024)} KB)`);
