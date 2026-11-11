import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
const RAIZ = fileURLToPath(new URL("../../", import.meta.url));
const dir = RAIZ + "src/";
const files = readdirSync(dir).filter((f) => f.endsWith(".ts"));
const src = Object.fromEntries(files.map((f) => [f, readFileSync(dir + f, "utf8")]));
const all = Object.values(src).join("\n") + readFileSync(RAIZ + "web/artifact.template.html", "utf8");
const out = [];
for (const [f, s] of Object.entries(src)) {
  for (const m of s.matchAll(/^export (?:async )?(?:function|const|let|class|interface|type) ([A-Za-z0-9_]+)/gm)) {
    const n = m[1]; const re = new RegExp(`\\b${n}\\b`, "g");
    const total = (all.match(re) || []).length;
    const propio = (s.match(re) || []).length;
    if (total === propio && propio <= 1) out.push(`${f}: ${n}`);
  }
}
console.log(out.length ? out.join("\n") : "sin exports muertos");
