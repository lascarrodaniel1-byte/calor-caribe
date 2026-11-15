// Reacción preparada que no llega: el narrador lee «programadas» fresco justo antes de armar el bloque de combate (aunque la caché de su pestaña vaya por detrás)
// y el jugador ve una nota corta si su reacción no va a entregarse (reacción ya gastada, personaje fuera de la iniciativa o caído). Móvil sin desbordes.
import { lanzar, fixture, MOCK, salida, paginaDe } from "./_comun.mjs";
import { readFileSync } from "node:fs";
const S = await paginaDe();
const partida = JSON.parse(readFileSync(fixture("partida-mesa.json"), "utf8"));
const b = await lanzar();
const errs = [];
let fallos = 0;
const t = (c, m) => { console.log(c ? "ok  " : "FALLA", m); if (!c) fallos++; };

/**
 * Abre la página como `yo` (id u1). `otros`: [{id, nombre, entrada, visto?}]; `turno`: id de a quién le toca;
 * `combate`: enemigos (con Aldo de Ana, Ogro…, Bruna de Beto); `progs`: documentos de «programadas».
 */
async function montar({ yo = "Beto", otros = [{ id: "uAna", nombre: "Ana", entrada: 1 }], turno = "uAna", modo = "turnos", combate = null, progs = {}, ancho = 1280, alto = 860, ronda = 1 } = {}) {
  const pg = await b.newPage({ viewport: { width: ancho, height: alto } });
  pg.on("pageerror", (e) => errs.push(e.message));
  await pg.addInitScript({ path: MOCK });
  await pg.goto("file://" + S + "/mesa-de-velmora.html"); await pg.waitForTimeout(800);
  await pg.click("#form-tutorial button[type=submit]").catch(() => {}); await pg.fill("#nombre", yo); await pg.click("#form-nombre button"); await pg.waitForTimeout(500);
  const ahora = Date.now();
  const nombres = await pg.evaluate(async ([p, ahora, otros, turno, modo, combate, progs, ronda]) => {
    const V = window.Velmora;
    let ns = [];
    if (combate) {
      for (const e of combate) V.ejecutar("aparecer_criatura", { nombre: e, repetir: true }, p);
      ns = Object.values(p.jefes).map((j) => j.nombre);
      V.ejecutar("iniciativa", { participantes: ["Aldo", "Bruna", ...ns] }, p);
      p.combate.orden = ["Aldo", ...ns, "Bruna"].map((n, i) => ({ nombre: n, total: 30 - i }));
    }
    await window.__db.doc("mesa/estado").set({ partida: p, cronica: "", actualizado: ahora });
    for (const o of otros) await window.__db.doc("jugadores/" + o.id).set({ nombre: o.nombre, entrada: o.entrada, visto: o.visto === undefined ? ahora : o.visto });
    await window.__db.doc("mesa/orden").set({ modo, turno, ronda, desde: ahora });
    for (const [id, d] of Object.entries(progs)) await window.__db.doc("programadas/" + id).set(d);
    return ns;
  }, [partida, ahora, otros, turno, modo, combate, progs, ronda]);
  await pg.waitForTimeout(1500);
  return { pg, nombres };
}
const store = (pg, ruta) => pg.evaluate((r) => window.__store.get(r) ?? null, ruta);
const claves = (pg, pref) => pg.evaluate((p) => [...window.__store.keys()].filter((k) => k.startsWith(p)), pref);
// Lo que recibe el DM en cada llamada: el último mensaje de la entrada (el estado, los bloques de turnos y las acciones nuevas).
const entradas = (pg) => pg.evaluate(() => (window.__entradas || []).map((e) => { try { const m = JSON.parse(e); return Array.isArray(m) ? String(m[m.length - 1].content) : String(e); } catch { return String(e); } }));
const ultimaEntrada = async (pg) => (await entradas(pg)).slice(-1)[0] || "";
const texto = (pg, sel) => pg.evaluate((s) => document.querySelector(s)?.innerText.replace(/\s+/g, " ").trim() ?? "", sel);
const visible = (pg, sel) => pg.evaluate((s) => { const e = document.querySelector(s); return !!e && !e.hidden && e.offsetParent !== null; }, sel);
const accionDe = async (pg, jid, nombre, x) => pg.evaluate(async ([jid, nombre, x]) => { await window.__db.collection("acciones").add({ nombre, uid: "x", jid, texto: x, ts: Date.now() + 5 }); }, [jid, nombre, x]);
const narrar = async (pg) => { await pg.getByRole("button", { name: "Que el DM responda" }).click({ timeout: 5000 }).catch(() => {}); };
async function programar(pg, x) { await pg.fill("#accion", x); await pg.keyboard.press("Enter"); await pg.waitForTimeout(400); }

// ---- la reacción preparada llega al DM aunque la caché de esta pestaña vaya por detrás, y el jugador sabe por qué no vale la suya
{
  const { pg } = await montar({ combate: ["Ogro"], turno: "uAna" });
  // Otro jugador (Ana) prepara su reacción justo antes de que empiece su turno; el aviso en directo no llega a esta pestaña (caché vieja).
  await pg.evaluate(() => { window.__store.set("programadas/uAna", { nombre: "Ana", jid: "uAna", texto: "", ts: Date.now(), ronda: 1, reaccion: "Si el ogro ataca a Bruna, lo intercepto con el escudo", reaccionAsalto: 1 }); });
  // La lectura de «programadas» que hace el sincronizado al empezar el turno llega vieja (sin la reacción): solo una lectura posterior la ve.
  await pg.evaluate(() => {
    const col = window.__db.collection.bind(window.__db); let n = 0;
    window.__db.collection = (c) => { const q = col(c); if (c !== "programadas" || n > 0) return q; return { ...q, get: async () => { n++; const s = await q.get(); return { ...s, docs: [], size: 0, empty: true }; } }; };
  });
  await pg.evaluate(() => { window.__textoDM = "Aldo avanza hacia el ogro con el escudo en alto."; window.__entradas = []; });
  await accionDe(pg, "uAna", "Ana", "Avanzo hacia el ogro");
  await narrar(pg);
  await pg.waitForFunction(() => (window.__entradas || []).length >= 1, null, { timeout: 25000 }).catch(() => {});
  await pg.waitForTimeout(800);
  t(/Reacciones preparadas: Ana: «Si el ogro ataca a Bruna, lo intercepto con el escudo»/.test((await entradas(pg))[0] || ""), "con la caché vieja, el bloque de combate lleva igualmente la reacción recién preparada (lectura fresca)", ((await entradas(pg))[0] || "").slice(0, 200));
  await pg.close();
  // su personaje no está en la iniciativa: la reacción escrita no se entregará y el campo lo dice
  const f = await montar({ combate: ["Ogro"], progs: { u1: { nombre: "Beto", jid: "u1", texto: "", ts: Date.now(), ronda: 1, reaccion: "Me cubro", reaccionAsalto: 1 } } });
  t(!(await visible(f.pg, "#nota-reaccion")), "con su personaje en el combate y la reacción libre no hay nota");
  await f.pg.evaluate(async () => { const e = window.__store.get("mesa/estado"); e.partida.combate.orden = e.partida.combate.orden.filter((o) => o.nombre !== "Bruna"); await window.__db.doc("mesa/estado").set({ ...e, actualizado: Date.now() + 500 }); });
  await f.pg.waitForTimeout(900);
  t(/^no vigente: tu personaje no está en el combate$/.test(await texto(f.pg, "#nota-reaccion")), "si su personaje no está en el combate: «no vigente: tu personaje no está en el combate»", await texto(f.pg, "#nota-reaccion"));
  await f.pg.screenshot({ path: salida("programada-reaccion-nota.png") });
  await f.pg.close();
  // móvil: la nota cabe en una línea y no desborda
  const g = await montar({ ancho: 390, alto: 844, combate: ["Ogro"], progs: { u1: { nombre: "Beto", jid: "u1", texto: "", ts: Date.now(), ronda: 1, reaccion: "Me cubro", reaccionAsalto: 1 } } });
  await g.pg.evaluate(async () => { const e = window.__store.get("mesa/estado"); e.partida.combate.turnos = { ...(e.partida.combate.turnos || {}), Bruna: { reaccion: true } }; await window.__db.doc("mesa/estado").set({ ...e, actualizado: Date.now() + 500 }); });
  await g.pg.waitForTimeout(900);
  const mm = await g.pg.evaluate(() => { const n = document.getElementById("nota-reaccion"); return { texto: n.innerText, alto: Math.round(n.getBoundingClientRect().height), pagina: document.documentElement.scrollWidth, vw: innerWidth, pie: Math.round(document.querySelector(".redaccion").getBoundingClientRect().height) }; });
  t(/ya gastaste tu reacción/.test(mm.texto) && mm.alto <= 18 && mm.pagina <= mm.vw && mm.pie <= 150, `móvil: nota de una línea, sin desbordes y barra ≤ 150 px (nota ${mm.alto} px, barra ${mm.pie} px)`);
  await g.pg.screenshot({ path: salida("programada-reaccion-nota-movil.png") });
  await g.pg.close();
}

console.log("capturas en:", salida("").replace(/\/$/, ""));
console.log("fallos:", fallos);
console.log("errores de página:", errs.length, errs.slice(0, 3).map((x) => x.slice(0, 160)).join(" | "));
await b.close();
if (fallos) process.exitCode = 1;
