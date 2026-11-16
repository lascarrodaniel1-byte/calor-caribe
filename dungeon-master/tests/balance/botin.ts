// Simulación del botín (docs/BALANCE.md §16): antes (generador antiguo, que no mira peligro, región ni criatura) y después (generarBotinDe).
// 200 llamadas por peligro y origen (cantidad 3): diversidad, % por categoría, oro medio y % de equipo mágico; y una campaña de niveles 1-8.
// Uso: npx tsx tests/balance/botin.ts [--semilla 1] [--n 200] [--cantidad 3] [--campanas 300]
import { nuevaPartida, normalizarPartida } from "../../src/estado.ts";
import { generarBotin, BASES, type Origen } from "../../src/equipo.ts";
import { generarBotinDe } from "../../src/botin.ts";
import { TESORO } from "../../src/tesoro.ts";

const argv = process.argv.slice(2);
const opt = (n: string, def: string) => { const i = argv.indexOf(`--${n}`); return i >= 0 && argv[i + 1] ? argv[i + 1] : def; };
const SEMILLA = Number(opt("semilla", "1")), N = Number(opt("n", "200")), CANT = Number(opt("cantidad", "3")), CAMPANAS = Number(opt("campanas", "300"));

let estado = (SEMILLA * 2654435761) | 0 || 1;
const mulberry = (): number => { estado = (estado + 0x6d2b79f5) | 0; let t = Math.imul(estado ^ (estado >>> 15), 1 | estado); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return (t ^ (t >>> 14)) >>> 0; };
(globalThis.crypto as unknown as { getRandomValues: (b: Uint32Array) => Uint32Array }).getRandomValues = (b: Uint32Array) => { b[0] = mulberry(); return b; };
const azar = () => mulberry() / 0x100000000;

const nueva = () => { const p = nuevaPartida(); normalizarPartida(p); return p; };
const MAGICAS = ["encantado", "maldito", "reliquia", "legendario"];
const sinId = (n: string) => n.replace(/\s*\[[^\]]*\]\s*$/, "").replace(/\s*\(\d+\)\s*$/, "").trim();
const porNombre = new Map(TESORO.map((x) => [x.nombre.toLowerCase(), x]));

interface Lectura { cats: Record<string, number>; tipos: string[]; oro: number; equipo: number; magico: number; valorCatalogo: number; objetos: number }

/** Clasifica lo que salió en una llamada: líneas del texto del DM y objetos nuevos registrados. */
function leer(p: ReturnType<typeof nueva>, antes: number, dm: string): Lectura {
  const r: Lectura = { cats: {}, tipos: [], oro: 0, equipo: 0, magico: 0, valorCatalogo: 0, objetos: 0 };
  const suma = (k: string) => { r.cats[k] = (r.cats[k] ?? 0) + 1; r.objetos++; };
  for (const l of dm.split("\n").slice(1)) {
    const m = /^- (.*?)(?: — (\d+) po| \((?:[^,)]+), (\d+) po\)|:|$)/.exec(l);
    if (!m) continue;
    const nombre = sinId(m[1]);
    if (/^- Oro:/.test(l)) { r.oro += Number(/Oro: (\d+)/.exec(l)![1]); continue; }
    if (/^- Vial:/.test(l)) { suma("vial"); r.tipos.push("vial:" + l.slice(8)); continue; }
    if (/^- Catalizador:/.test(l)) { suma("catalizador"); r.tipos.push("cat:" + nombre); continue; }
    if (/^- Huevo de piedra/.test(l)) { suma("behelit"); continue; }
    const x = porNombre.get(nombre.toLowerCase());
    if (x) { suma(x.categoria); r.tipos.push(x.id); r.valorCatalogo += Number(m[2] ?? x.valor_po); }
  }
  const nuevos = Object.values(p.objetos).slice(antes);
  for (const o of nuevos) {
    if (o.nombre.startsWith("Huevo de piedra")) continue;
    const u = TESORO.find((x) => x.unico && o.nombre.startsWith(x.nombre));
    if (u) continue; // un único ya se contó por su línea
    const base = BASES.find((b) => o.nombre.startsWith(b.nombre));
    suma(base?.clase ?? "equipo"); r.equipo++; r.tipos.push("eq:" + (base?.nombre ?? o.nombre));
    if (MAGICAS.includes(o.calidad)) r.magico++;
  }
  return r;
}

const pct = (a: number, b: number) => (b ? `${((100 * a) / b).toFixed(0)}%` : "0%");
const CATS = ["arma", "armadura", "accesorio", "material", "ingrediente", "comida_bebida", "herramienta", "documento", "gema_arte", "curiosidad", "trofeo", "llave_sello", "objeto_trama", "moneda", "nautico", "vial", "catalizador"];

function simular(origen: Origen, peligro: number | undefined, nuevoGenerador: boolean, region?: string, cofre?: boolean) {
  const tot: Lectura = { cats: {}, tipos: [], oro: 0, equipo: 0, magico: 0, valorCatalogo: 0, objetos: 0 };
  for (let i = 0; i < N; i++) {
    const p = nueva();
    const antes = Object.keys(p.objetos).length;
    const b = nuevoGenerador ? generarBotinDe(p, { origen, cantidad: CANT, peligro, region, cofre }) : generarBotin(p, { origen, cantidad: CANT });
    const l = leer(p, antes, b.dm);
    for (const [k, v] of Object.entries(l.cats)) tot.cats[k] = (tot.cats[k] ?? 0) + v;
    tot.tipos.push(...l.tipos); tot.oro += l.oro; tot.equipo += l.equipo; tot.magico += l.magico; tot.valorCatalogo += l.valorCatalogo; tot.objetos += l.objetos;
  }
  return tot;
}

const fila = (t: Lectura) => {
  const distintos = new Set(t.tipos).size;
  return `${distintos} | ${pct(t.magico, t.equipo)} | ${pct(t.magico, t.objetos)} | ${(t.oro / N).toFixed(1)} | ${(t.valorCatalogo / N).toFixed(1)} | ${CATS.filter((c) => t.cats[c]).map((c) => `${c} ${pct(t.cats[c], t.objetos)}`).join(", ")}`;
};

console.log(`### Simulación del botín (semilla ${SEMILLA}, ${N} llamadas por celda, cantidad ${CANT})\n`);
console.log("| Generador | Origen | Peligro | Tipos distintos | % mágico del equipo | % mágico del botín | Oro medio | Valor catálogo medio | Categorías (% de los objetos) |\n|---|---|---|---|---|---|---|---|---|");
for (const origen of ["saqueo", "hallazgo", "jefe"] as const) console.log(`| antes | ${origen} | (ignora) | ${fila(simular(origen, undefined, false))} |`);
for (const origen of ["saqueo", "hallazgo", "jefe"] as const)
  for (const peligro of [1, 2, 3, 4, 5]) console.log(`| después | ${origen} | P${peligro} | ${fila(simular(origen, peligro, true))} |`);
console.log(`| después | saqueo | P3 mar | ${fila(simular("saqueo", 3, true, "mar"))} |`);
console.log(`| después | compra | P2 | ${fila(simular("compra", 2, true))} |`);
for (const origen of ["saqueo", "hallazgo", "jefe"] as const) console.log(`| después | ${origen} | sin peligro (P2) | ${fila(simular(origen, undefined, true))} |`);
for (const peligro of [1, 2, 3, 4, 5]) console.log(`| después | hallazgo cofre | P${peligro} | ${fila(simular("hallazgo", peligro, true, undefined, true))} |`);

// ---- Campaña de niveles 1-8 (solo moneda y valor del catálogo; el equipo, que se queda o se vende aparte, no cuenta)
interface Evento { origen: Origen; peligro: number; cofre?: boolean }
/** `cofres`: uno de los 2 hallazgos de cada nivel es un cofre (trampa con cofre, pecio, guarida). */
function campana(cofres: boolean): Evento[] {
  const ev: Evento[] = [];
  for (let nivel = 1; nivel <= 8; nivel++) {
    const tope = nivel <= 2 ? 2 : nivel <= 4 ? 3 : nivel <= 8 ? 4 : 5;
    const saqueos = 6;
    for (let i = 0; i < saqueos; i++) ev.push({ origen: "saqueo", peligro: Math.max(1, tope - (azar() < 0.45 ? 1 : 0) - (azar() < 0.2 ? 1 : 0)) });
    for (let i = 0; i < 2; i++) ev.push({ origen: "hallazgo", peligro: Math.max(1, tope - (azar() < 0.4 ? 1 : 0)), cofre: cofres && i === 0 });
  }
  ev.push({ origen: "jefe", peligro: 4 }, { origen: "jefe", peligro: 4 }, { origen: "jefe", peligro: 5 }, { origen: "jefe", peligro: 5 });
  return ev;
}
function correr(cofres: boolean) {
  const totales: number[] = [], conCatalogo: number[] = [];
  for (let c = 0; c < CAMPANAS; c++) {
    const p = nueva(); let oro = 0, cat = 0;
    for (const e of campana(cofres)) {
      const antes = Object.keys(p.objetos).length;
      const l = leer(p, antes, generarBotinDe(p, { origen: e.origen, cantidad: e.origen === "saqueo" ? 3 : 4, peligro: e.peligro, cofre: e.cofre }).dm);
      oro += l.oro; cat += l.valorCatalogo;
    }
    totales.push(oro); conCatalogo.push(oro + cat);
  }
  return { totales, conCatalogo };
}
const q = (a: number[], f: number) => [...a].sort((x, y) => x - y)[Math.floor(f * (a.length - 1))];
const media = (a: number[]) => a.reduce((s, x) => s + x, 0) / a.length;
console.log(`\n### Campaña niveles 1-8 (${CAMPANAS} campañas: 6 saqueos y 2 hallazgos por nivel, 4 jefes)\n`);
console.log("| Campaña | Qué suma | Media | p10 | p90 |\n|---|---|---|---|---|");
for (const cofres of [false, true]) {
  const { totales, conCatalogo } = correr(cofres);
  const n = cofres ? "1 hallazgo de 2 es cofre" : "sin cofres";
  console.log(`| ${n} | Solo moneda sugerida (oro_cambio) | ${media(totales).toFixed(0)} | ${q(totales, 0.1)} | ${q(totales, 0.9)} |`);
  console.log(`| ${n} | Moneda + valor de los objetos del catálogo | ${media(conCatalogo).toFixed(0)} | ${q(conCatalogo, 0.1)} | ${q(conCatalogo, 0.9)} |`);
}
