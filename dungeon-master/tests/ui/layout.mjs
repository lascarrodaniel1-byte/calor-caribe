import { lanzar, fixture, MOCK, salida, paginaDe } from "./_comun.mjs";
import { readFileSync } from "node:fs";
const S = await paginaDe(), tag = process.argv[3] || "antes";
const partida = JSON.parse(readFileSync(fixture("partida-mesa.json"), "utf8"));
const b = await lanzar();
for (const [w, h, n] of [[1366, 768, "escritorio"], [390, 844, "movil"]]) {
  const pg = await b.newPage({ viewport: { width: w, height: h } });
  const errs = []; pg.on("pageerror", (e) => errs.push(e.message));
  await pg.addInitScript({ path: MOCK });
  await pg.goto("file://" + S + "/mesa-de-velmora.html"); await pg.waitForTimeout(800);
  await pg.click("#form-tutorial button[type=submit]").catch(() => {}); await pg.fill("#nombre", "Ana"); await pg.click("#form-nombre button"); await pg.waitForTimeout(500);
  const t = Date.now();
  await pg.evaluate(async ([p, t]) => {
    await window.__db.doc("mesa/estado").set({ partida: p, cronica: "", actualizado: t });
    await window.__db.doc("jugadores/uBeto").set({ nombre: "Beto", entrada: 2, visto: t });
    for (let i = 1; i <= 6; i++) await window.__db.doc("turnos/t" + i).set({ ts: i, acciones: [{ nombre: "Ana", texto: "Avanzo con cuidado por el pasillo " + i }], texto: "La antorcha chisporrotea y el pasillo se estrecha. ".repeat(8), avisos: [] });
  }, [partida, t]);
  await pg.waitForTimeout(1500);
  const m = await pg.evaluate(() => {
    const r = (sel) => { const e = document.querySelector(sel); if (!e) return null; const b = e.getBoundingClientRect(); return { top: Math.round(b.top), alto: Math.round(b.height), ancho: Math.round(b.width) }; };
    return { vh: innerHeight, cabecera: r("header"), registro: r("#registro"), entrada: r("#accion"), barraTurnos: r("#barra-turnos"), franja: r("#franja-mapa") };
  });
  console.log(n, JSON.stringify(m));
  await pg.screenshot({ path: salida(`layout-${tag}-${n}.png`) });
  console.log("  errores:", errs.length);
  await pg.close();
}
await b.close();
