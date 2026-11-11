import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
const RAIZ = fileURLToPath(new URL("../../", import.meta.url));
import { BESTIARIO, VD } from "../../src/bestiario.ts";
import { TABLA } from "../../src/encuentros.ts";
import { RAZAS, CLASES } from "../../src/mundo.ts";
import { TEMPLES, PERSONALIDADES } from "../../src/combate.ts";
import { PIEZAS } from "../../src/armadura.ts";
import { AFINIDAD } from "../../src/magia.ts";
import { ESTILOS } from "../../src/estilos.ts";
import { sistemaWeb } from "../../src/prompt-web.ts";
const prob: string[] = [];
const P = (c: boolean, m: string) => { if (!c) prob.push(m); };
// herramientas: esquema ↔ descripción ↔ case
const src = readFileSync(RAIZ + "src/herramientas.ts", "utf8");
const ei = src.indexOf("const esquemas = {"), di = src.indexOf("const descripciones: Record<Nombre, string> = {");
const bloque = (a: number) => { let n = 0, i = src.indexOf("{", a); const ini = i; for (; i < src.length; i++) { if (src[i] === "{") n++; else if (src[i] === "}") { n--; if (!n) break; } } return src.slice(ini, i); };
const nivel1 = (b: string) => { const out: string[] = []; let n = 0; for (const l of b.split("\n")) { const d0 = n; for (const ch of l) { if (ch === "{" || ch === "(" || ch === "[") n++; else if (ch === "}" || ch === ")" || ch === "]") n--; } const m = /^  ([a-z_0-9]+):/.exec(l); if (m && d0 === 1) out.push(m[1]); } return out; };
const esq = nivel1(bloque(ei)), des = nivel1(bloque(di));
const cases = new Set([...src.matchAll(/case "([a-z_0-9]+)":/g)].map((m) => m[1]));
for (const k of esq) { P(des.includes(k), `herramienta sin descripción: ${k}`); P(cases.has(k), `herramienta sin case: ${k}`); }
for (const k of des) P(esq.includes(k), `descripción sin esquema: ${k}`);
console.log(`herramientas: ${esq.length}`);
// razas
for (const r of RAZAS) { P(r.nombre in TEMPLES, `raza sin TEMPLE: ${r.nombre}`); P(r.nombre in AFINIDAD, `raza sin AFINIDAD: ${r.nombre}`); P(/^(\+\d [A-Z]{3}(, )?)+$|todos los atributos/.test(r.atributos), `bonos de raza raros: ${r.nombre} ${r.atributos}`); }
const idi = readFileSync(RAIZ + "src/idiomas_base.ts", "utf8");
for (const r of RAZAS) if (r.nombre !== "Humano del Faro") P(idi.includes(`"${r.nombre}"`) || new RegExp(`\\b${r.nombre}:`).test(idi), `raza sin idioma: ${r.nombre}`);
// bestiario
const nombres = new Set<string>();
for (const c of BESTIARIO) {
  P(!nombres.has(c.nombre), `criatura duplicada: ${c.nombre}`); nombres.add(c.nombre);
  P(!!c.vd, `sin VD: ${c.nombre}`); P(c.ataques.length > 0, `sin ataques: ${c.nombre}`); P(c.rasgos.length > 0, `sin rasgos: ${c.nombre}`);
  P(/^\d+d\d+([+-]\d+)?$/.test(c.pv) || /^\d+$/.test(c.pv), `PV raros: ${c.nombre} ${c.pv}`);
  P(!c.temple || c.temple in TEMPLES || ["bestia", "no-muerto", "no-muerto torpe", "vampiro", "espectro", "constructo", "elemental", "demonio"].includes(c.temple), `temple raro: ${c.nombre} ${c.temple}`);
  for (const b of c.blindaje ?? []) P(b in PIEZAS, `blindaje inexistente: ${c.nombre} ${b}`);
  for (const pe of c.personalidad ?? []) P(pe in PERSONALIDADES, `personalidad inexistente: ${c.nombre} ${pe}`);
  P(/FUE \d+ DES \d+ CON \d+ INT \d+ SAB \d+ CAR \d+/.test(c.atributos), `atributos raros: ${c.nombre}`);
}
for (const k of Object.keys(VD)) P(nombres.has(k), `VD de criatura inexistente: ${k}`);
// encuentros
for (const e of TABLA) { P(!e.bestiario || nombres.has(e.bestiario), `encuentro con plantilla inexistente: ${e.id}`); P(e.peso > 0, `encuentro sin peso: ${e.id}`); P(e.cuantos[0] <= e.cuantos[1], `cuantos al revés: ${e.id}`); }
const ids = TABLA.map((e) => e.id); P(new Set(ids).size === ids.length, "ids de encuentro duplicados");
// estilos
const clases = new Set(CLASES.map((c) => c.nombre));
for (const e of ESTILOS) for (const c of e.clases) P(clases.has(c), `estilo con clase inexistente: ${e.nombre} → ${c}`);
// README numeración
const readme = readFileSync(RAIZ + "README.md", "utf8");
const nums = [...readme.matchAll(/^(\d+)\. \*\*/gm)].map((m) => Number(m[1]));
for (let i = 1; i < nums.length; i++) P(nums[i] === nums[i - 1] + 1 || nums[i] < 5, `README numeración rota: ${nums[i - 1]} → ${nums[i]}`);
console.log(`prompt del DM: ${sistemaWeb().length} caracteres (${Math.round(sistemaWeb().length / 4)} tokens aprox.)`);
console.log(prob.length ? "PROBLEMAS:\n- " + prob.join("\n- ") : "sin problemas");
