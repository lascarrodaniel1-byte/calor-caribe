// Varias acciones por vuelta (bloque 2): `motor` ya acepta una lista `acciones` (en orden, una que falla no corta las demás y devuelve su error).
// Con el mock se comparan un DM que agrupa (1 vuelta con 3 acciones) y otro que las reparte (3 vueltas con 1): lo guardado es lo mismo, los avisos
// salen igual y en orden, y `consumo/` anota las vueltas (el ahorro es de 2 vueltas por turno; cada vuelta reenvía todo el contexto).
import { lanzar, fixture, MOCK, paginaDe } from "./_comun.mjs";
import { readFileSync } from "node:fs";
const S = await paginaDe();
const partida = JSON.parse(readFileSync(fixture("partida-mesa.json"), "utf8"));
const b = await lanzar();
let fallos = 0, erroresPagina = 0;
const t = (c, m, x = "") => { console.log(c ? "ok  " : "FALLA", m, x); if (!c) fallos++; };
const pg = await b.newPage({ viewport: { width: 1280, height: 860 } });
pg.on("pageerror", (e) => { erroresPagina++; console.log("  error de página:", e.message.slice(0, 160)); });
await pg.addInitScript({ path: MOCK });
await pg.goto("file://" + S + "/mesa-de-velmora.html"); await pg.waitForTimeout(800);
await pg.click("#form-tutorial button[type=submit]").catch(() => {}); await pg.fill("#nombre", "Ana"); await pg.click("#form-nombre button"); await pg.waitForTimeout(500);
await pg.evaluate(async ([p, t0]) => { await window.__db.doc("mesa/estado").set({ partida: p, cronica: "", actualizado: t0 }); }, [partida, Date.now()]);
await pg.waitForTimeout(1200);
const n = (pref) => pg.evaluate((pref) => [...window.__store.keys()].filter((k) => k.startsWith(pref)).length, pref);
const LISTA = [
  { accion: "tirar_dados", datos: { expresion: "1d8", motivo: "daño del hacha" } },
  { accion: "tirar_dados", datos: {} },                                                  // datos inválidos: falla sin cortar las demás
  { accion: "ubicacion", datos: { lugar: "Puente del Cuervo", region: "Aldenmar", tipo: "aldea" } },
];
async function turno(cfg, txt) {
  const antes = await n("turnos/");
  await pg.evaluate(([c]) => { window.__textoDM = "El puente cruje bajo vuestros pasos."; window.__accionesDM = c.agrupado ? c.lista : null; window.__vueltasDM = c.agrupado ? null : c.lista.map((x) => [x]); window.__resultadosMotor = []; }, [cfg]);
  await pg.fill("#accion", txt); await pg.keyboard.press("Enter");
  await pg.waitForFunction((a) => [...window.__store.keys()].filter((k) => k.startsWith("turnos/")).length > a, antes, { timeout: 20000 }).catch(() => {});
  await pg.waitForTimeout(500);
  return pg.evaluate(() => {
    const ts = [...window.__store.entries()].filter(([k]) => k.startsWith("turnos/")).map(([, v]) => v).sort((a, b) => a.ts - b.ts);
    const cs = [...window.__store.entries()].filter(([k]) => k.startsWith("consumo/")).map(([, v]) => v).sort((a, b) => a.ts - b.ts);
    return { turno: ts[ts.length - 1], consumo: cs[cs.length - 1], resultados: window.__resultadosMotor, lugar: window.__store.get("mesa/estado")?.partida?.mapa?.actual ?? null };
  });
}
// 1. todo junto: una vuelta, tres acciones; la mala falla sola
const A = await turno({ agrupado: true, lista: LISTA }, "Cruzamos el puente mirando alrededor");
const r = A.resultados?.[0] || [];
t(r.length === 3 && !r[0].error && r[1].error === true && !r[2].error, "agrupado: la lista devuelve un resultado por acción; solo la inválida lleva error", r.map((x) => x.accion + (x.error ? "!" : "")).join(", "));
t(/Argumentos no válidos/.test(String(r[1]?.resultado)) && /Puente del Cuervo/.test(String(r[2]?.resultado)), "agrupado: la acción mala dice qué falló y la siguiente se ejecutó");
const avA = (A.turno?.avisos || []).map((a) => a.texto);
t(avA.length >= 2 && /🎲|1d8/.test(avA[0]) && /Puente del Cuervo/.test(avA.join("\n")) && avA.findIndex((x) => /🎲|1d8/.test(x)) < avA.findIndex((x) => /Puente del Cuervo/.test(x)), "agrupado: los avisos de pantalla salen en el orden de la lista", JSON.stringify(avA).slice(0, 160));
t(A.consumo?.vueltas === 1 && A.consumo?.acc === 3 && A.consumo?.uso?.tirar_dados === 2 && A.consumo?.uso?.ubicacion === 1, "agrupado: consumo/ anota 1 vuelta con 3 acciones", JSON.stringify([A.consumo?.vueltas, A.consumo?.acc, A.consumo?.uso]));
// 2. repartido: tres vueltas con una acción cada una
const B = await turno({ agrupado: false, lista: LISTA }, "Cruzamos el puente otra vez");
t(B.consumo?.vueltas === 3 && B.consumo?.acc === 3, "repartido: consumo/ anota 3 vueltas con 3 acciones", JSON.stringify([B.consumo?.vueltas, B.consumo?.acc]));
const avB = (B.turno?.avisos || []).map((a) => a.texto);
t(JSON.stringify(avB.filter((x) => !/⏱ automático|🎲/.test(x)).map((x) => x.slice(0, 20))) === JSON.stringify(avA.filter((x) => !/⏱ automático|🎲/.test(x)).map((x) => x.slice(0, 20))), "mismos avisos de pantalla (salvo las tiradas, que cambian de dados) en una o en tres vueltas", `${avA.length} vs ${avB.length}`);
console.log(`vueltas por turno: agrupado ${A.consumo?.vueltas}, repartido ${B.consumo?.vueltas} (ahorro: ${B.consumo?.vueltas - A.consumo?.vueltas} vueltas de narración)`);
await b.close();
console.log("errores de página:", erroresPagina);
process.exit(fallos || erroresPagina ? 1 : 0);
