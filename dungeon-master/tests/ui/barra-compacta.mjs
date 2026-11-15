// Barra inferior compacta (formulario de acción, botones, ficha «Programada», reacción preparada): con el estado más cargado posible
// (combate, programada + reacción, todos los botones visibles) no supera ~15 % de la pantalla en móvil (390×844) ni 140 px en escritorio (1280×800);
// los objetivos táctiles miden ≥ 40 px en móvil, no hay desbordes y el textarea crece hasta un tope bajo. Capturas en el directorio de salida.
import { lanzar, fixture, MOCK, salida, paginaDe } from "./_comun.mjs";
import { readFileSync } from "node:fs";
const S = await paginaDe(), tag = process.argv[3] || "despues";
const partida = JSON.parse(readFileSync(fixture("partida-mesa.json"), "utf8"));
const b = await lanzar();
const errs = [];
let fallos = 0;
const t = (c, m) => { console.log(c ? "ok  " : "FALLA", m); if (!c) fallos++; };

async function montar(ancho, alto, tema, miTurno = false) {
  const ctx = await b.newContext({ viewport: { width: ancho, height: alto }, deviceScaleFactor: 1, hasTouch: ancho < 600, colorScheme: tema });
  const pg = await ctx.newPage();
  pg.on("pageerror", (e) => errs.push(e.message));
  await pg.addInitScript({ path: MOCK });
  await pg.goto("file://" + S + "/mesa-de-velmora.html"); await pg.waitForTimeout(800);
  await pg.click("#form-tutorial button[type=submit]").catch(() => {}); await pg.fill("#nombre", "Beto"); await pg.click("#form-nombre button"); await pg.waitForTimeout(500);
  const ahora = Date.now();
  await pg.evaluate(async ([p, ahora, miTurno]) => {
    const V = window.Velmora;
    V.ejecutar("aparecer_criatura", { nombre: "Ogro", repetir: true }, p);
    const ns = Object.values(p.jefes).map((j) => j.nombre);
    V.ejecutar("iniciativa", { participantes: ["Aldo", "Bruna", ...ns] }, p);
    p.combate.orden = ["Aldo", ...ns, "Bruna"].map((n, i) => ({ nombre: n, total: 30 - i }));
    await window.__db.doc("mesa/estado").set({ partida: p, cronica: "", actualizado: ahora });
    await window.__db.doc("jugadores/uAna").set({ nombre: "Ana", entrada: 1, visto: ahora });
    await window.__db.doc("mesa/orden").set({ modo: "turnos", turno: miTurno ? "u1" : "uAna", ronda: 1, desde: ahora });
    if (!miTurno) await window.__db.doc("programadas/u1").set({ nombre: "Beto", jid: "u1", texto: "Hostigo al ogro con mi daga desde la distancia y me cubro tras la columna", ts: ahora, ronda: 1, asalto: 1, reaccion: "Si el ogro me ataca, me cubro con el escudo", reaccionAsalto: 1 });
    for (let i = 1; i <= 6; i++) await window.__db.doc("turnos/t" + i).set({ ts: i, acciones: [{ nombre: "Ana", texto: "Avanzo " + i }], texto: "La antorcha chisporrotea. ".repeat(30), avisos: [] });
  }, [partida, ahora, miTurno]);
  await pg.waitForTimeout(1500);
  // El estado más cargado, como en la partida real: fuera de turno (saltar el turno, ficha «Programada» y reacción) con todos los botones de
  // personaje a la vista. (Pasar turno solo aparece en el turno propio, cuando no hay ficha programada.)
  await pg.evaluate((mio) => {
    if (mio) { for (const id of ["crear-personaje", "llevar-personaje"]) document.getElementById(id).hidden = false; return; }
    for (const id of ["crear-personaje", "llevar-personaje", "saltar-turno"]) document.getElementById(id).hidden = false;
    const sb = document.getElementById("saltar-turno"); sb.textContent = "";
    const i = document.createElement("span"); i.textContent = "⏭"; const l = document.createElement("span"); l.className = "largo"; l.textContent = " el turno de Ana";
    sb.append(i, " Saltar", l);
  }, miTurno);
  return pg;
}
const medir = (pg) => pg.evaluate(() => {
  const f = document.querySelector("footer.redaccion").getBoundingClientRect();
  const peque = [...document.querySelectorAll("footer.redaccion button, footer.redaccion input, footer.redaccion textarea")].filter((e) => e.offsetParent !== null && !e.closest("[hidden]")).map((e) => { const h = e.getBoundingClientRect().height, pa = parseFloat(getComputedStyle(e, "::after").height) || 0; return { b: e.tagName === "BUTTON", id: e.id || e.textContent.trim().slice(0, 20), h: Math.round(Math.max(h, e.tagName === "BUTTON" ? pa : 0)) }; });
  const cr = document.getElementById("registro")?.getBoundingClientRect() || document.querySelector(".cronica").getBoundingClientRect();
  return { vh: innerHeight, alto: Math.round(f.height), desborde: document.documentElement.scrollWidth > innerWidth + 1 || document.documentElement.scrollHeight > innerHeight + 1, peque, cronica: Math.round(document.querySelector(".cronica").getBoundingClientRect().height), btnMin: Math.min(...peque.filter((x) => x.b).map((x) => x.h)), campoMin: Math.min(...peque.filter((x) => !x.b).map((x) => x.h)) };
});

for (const tema of ["dark"]) {
  for (const [w, h, n0, tope, mio] of [[390, 844, "movil", 0.15 * 844, false], [1280, 800, "escritorio", 140, false], [390, 844, "movil", 0.15 * 844, true], [1280, 800, "escritorio", 140, true]]) {
    const n = n0 + (mio ? "-mi-turno" : "");
    const pg = await montar(w, h, tema, mio);
    const m = await medir(pg);
    console.log(`${tag} ${n} ${tema}: barra ${m.alto}px de ${m.vh} (${(100 * m.alto / m.vh).toFixed(1)} %), crónica ${m.cronica}px; botones: ${m.peque.map((x) => x.id + ":" + x.h).join(", ")}`);
    await pg.screenshot({ path: salida(`barra-${tag}-${n}-${tema}.png`) });
    t(m.alto <= tope, `${n}/${tema}: la barra mide ${m.alto}px (tope ${Math.round(tope)})`);
    t(!m.desborde, `${n}/${tema}: sin desbordes (la página no hace scroll)`);
    if (n0 === "movil") t(m.btnMin >= 40, `${n}/${tema}: botones con zona de pulsación ≥ 40 px (mínimo ${m.btnMin})`);
    t(m.campoMin >= 30, `${n}/${tema}: campos de texto ≥ 30 px (mínimo ${m.campoMin})`);
    if (tema === "dark" && !mio) {
      await pg.fill("#accion", "línea\n".repeat(12));
      await pg.dispatchEvent("#accion", "input");
      const ta = await pg.evaluate(() => Math.round(document.getElementById("accion").getBoundingClientRect().height));
      t(ta <= 100, `${n0}: el textarea crece con tope bajo (${ta}px con 12 líneas)`);
      await pg.fill("#accion", ""); await pg.dispatchEvent("#accion", "input");
      const ta1 = await pg.evaluate(() => Math.round(document.getElementById("accion").getBoundingClientRect().height));
      t(ta1 <= 48, `${n0}: el textarea vacío mide ${ta1}px`);
    }
    await pg.context().close();
  }
}
console.log("errores de página:", errs.length, errs.slice(0, 3).join(" | "));
await b.close();
process.exit(fallos || errs.length ? 1 : 0);
