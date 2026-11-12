// Lanza las suites del motor (tests/motor), la auditoría, el fuzz y el soak, e imprime una tabla.
// Código de salida 0 solo si todo pasa. Uso: npm test   (o: node tests/ejecutar-motor.mjs [filtro])
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = fileURLToPath(new URL("../", import.meta.url));
const TSX = join(RAIZ, "node_modules", ".bin", process.platform === "win32" ? "tsx.cmd" : "tsx");
if (!existsSync(TSX)) { console.error("Falta tsx: ejecuta `npm install` primero."); process.exit(2); }

// Fuera del runner: t-enc2 y t-enc-wen son sondeos estadísticos con dados reales (no imprimen "N ok, M fallas").
const FUERA = /^t-enc/;
const suites = readdirSync(join(RAIZ, "tests", "motor")).filter((f) => /^t-.*\.ts$/.test(f) && !FUERA.test(f)).sort();

// Cada caso: nombre, argumentos y cómo leer el resultado de la salida (devuelve { ok, resumen } o null si no hay resumen).
const casos = suites.map((f) => ({
  nombre: "motor/" + f,
  args: ["tests/motor/" + f],
  leer: (salida) => {
    const m = [...salida.matchAll(/(\d+) ok, (\d+) fallas/g)].at(-1); // el último resumen es el válido
    return m ? { ok: Number(m[2]) === 0, resumen: `${m[1]} ok, ${m[2]} fallas` } : null;
  },
}));
casos.push({
  nombre: "auditoria/auditoria.ts", args: ["tests/auditoria/auditoria.ts"],
  leer: (s) => { const l = s.trim().split("\n").at(-1); return /sin problemas/.test(l) ? { ok: true, resumen: "sin problemas" } : /PROBLEMAS|problemas/i.test(s) ? { ok: false, resumen: "con problemas" } : null; },
});
const sinProblemas = (s) => { const m = /problemas: (\d+)/.exec(s); return m ? { ok: Number(m[1]) === 0, resumen: `${m[1]} problemas` } : null; };
casos.push({ nombre: "auditoria/fuzz.ts", args: ["tests/auditoria/fuzz.ts"], leer: sinProblemas });
for (const semilla of [1, 2, 3]) casos.push({ nombre: `auditoria/soak.ts ${semilla}`, args: ["tests/auditoria/soak.ts", String(semilla)], leer: sinProblemas });
casos.push({ nombre: "auditoria/soak.ts 4 calendario", args: ["tests/auditoria/soak.ts", "4", "calendario"], leer: sinProblemas }); // estaciones, clima y anomalías activos

const filtro = process.argv[2];
const elegidos = filtro ? casos.filter((c) => c.nombre.includes(filtro)) : casos;
const filas = [];
for (const c of elegidos) {
  const t0 = Date.now();
  const r = spawnSync(TSX, c.args, { cwd: RAIZ, encoding: "utf8", timeout: 300_000, maxBuffer: 64 * 1024 * 1024 });
  const salida = (r.stdout ?? "") + (r.stderr ?? "");
  const leido = c.leer(salida);
  let estado, resumen;
  if (r.error || r.status !== 0) { estado = "FALLA"; resumen = r.error ? String(r.error.message) : `salida ${r.status}`; }
  else if (!leido) { estado = "FALLA"; resumen = "sin resumen"; }
  else { estado = leido.ok ? "ok" : "FALLA"; resumen = leido.resumen; }
  if (estado !== "ok") console.log(`\n--- ${c.nombre}: últimas líneas ---\n` + salida.trim().split("\n").filter((l) => !/^ok /.test(l)).slice(-15).map((l) => l.slice(0, 220)).join("\n") + "\n");
  filas.push({ nombre: c.nombre, estado, resumen, seg: ((Date.now() - t0) / 1000).toFixed(1) });
}

const ancho = Math.max(...filas.map((f) => f.nombre.length));
console.log("\n" + "suite".padEnd(ancho) + "  estado  resultado            tiempo");
for (const f of filas) console.log(f.nombre.padEnd(ancho) + "  " + f.estado.padEnd(6) + "  " + f.resumen.padEnd(19) + "  " + f.seg + " s");
const malas = filas.filter((f) => f.estado !== "ok").length;
console.log(`\n${filas.length - malas}/${filas.length} correctas` + (malas ? `, ${malas} con fallos` : ""));
process.exit(malas ? 1 : 0);
