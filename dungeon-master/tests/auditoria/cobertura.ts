import { ESTILOS } from "../../src/estilos.ts";
let n = 0, sin = 0;
for (const e of ESTILOS) { console.log(`${e.nombre}: principio ${/automático/.test(e.principio) || e.id === "haemajitsu" || e.id === "contracorriente" ? "✔" : "?"}`); for (const [i, t] of e.tecnicas.entries()) { n++; const ok = /automático|pasivo/.test(t.efecto) || e.id === "contracorriente"; if (!ok) sin++; console.log(`   ${["Iniciado", "Practicante", "Maestro"][i]}: ${t.nombre} ${ok ? "✔" : "✘ " + t.efecto.slice(0, 80)}`); } }
console.log(`técnicas: ${n}, sin automatizar: ${sin}`);
