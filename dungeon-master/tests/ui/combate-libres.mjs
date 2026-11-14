// Mesa de 3 jugadores con un solo combatiente (Aldo, de Ana): Beto y Cris no quedan bloqueados, y al acabar el combate
// la mesa vuelve a la rotación normal (Ana → Beto → Cris → Ana) sin saltarse ni repetir a nadie.
import { lanzar, fixture, MOCK, paginaDe } from "./_comun.mjs";
import { readFileSync } from "node:fs";
const S = await paginaDe();
const partida = JSON.parse(readFileSync(fixture("partida-mesa.json"), "utf8"));
const b = await lanzar();
const errs = [];
let fallos = 0;
const t = (c, m) => { console.log(c ? "ok   " : "FALLA", m); if (!c) fallos++; };

const pg = await b.newPage({ viewport: { width: 1280, height: 860 } });
pg.on("pageerror", (e) => errs.push(e.message));
await pg.addInitScript({ path: MOCK });
await pg.goto("file://" + S + "/mesa-de-velmora.html"); await pg.waitForTimeout(800);
await pg.click("#form-tutorial button[type=submit]").catch(() => {}); await pg.fill("#nombre", "Ana"); await pg.click("#form-nombre button"); await pg.waitForTimeout(500);
const ahora = Date.now();
const ogro = await pg.evaluate(async ([p, t]) => {
  const V = window.Velmora;
  V.ejecutar("guardar_personaje", { don_arcano: false, nombre: "Carl", jugador: "Cris", raza: "Humano del Faro", clase: "Mercenario del Cuervo", nivel: 5, pv_max: 40, ca: 12, atributos: { fue: 16, des: 14, con: 14, int: 10, sab: 14, car: 10 }, inventario: [], dote: "Terco" }, p);
  V.ejecutar("aparecer_criatura", { nombre: "Ogro", repetir: true }, p);
  const ns = Object.values(p.jefes).map((j) => j.nombre);
  V.ejecutar("iniciativa", { participantes: ["Aldo", ...ns] }, p); // solo Aldo (Ana) está en la iniciativa
  p.combate.orden = ["Aldo", ...ns].map((n, i) => ({ nombre: n, total: 30 - i }));
  await window.__db.doc("mesa/estado").set({ partida: p, cronica: "", actualizado: t });
  await window.__db.doc("jugadores/u1").update({ entrada: 1 }); // Ana abre la ronda
  await window.__db.doc("jugadores/uBeto").set({ nombre: "Beto", entrada: 2, visto: t });
  await window.__db.doc("jugadores/uCris").set({ nombre: "Cris", entrada: 3, visto: t });
  await window.__db.doc("mesa/orden").set({ modo: "turnos", turno: "u1", ronda: 1, desde: t });
  return ns[0];
}, [partida, ahora]);
await pg.waitForTimeout(1500);

const orden = () => pg.evaluate(() => window.__store.get("mesa/orden"));
const combate = () => pg.evaluate(() => window.__store.get("mesa/estado")?.partida?.combate?.ronda ?? null);
const nTurnos = () => pg.evaluate(() => [...window.__store.keys()].filter((k) => k.startsWith("turnos/")).length);
const ultimaEntrada = () => pg.evaluate(() => (window.__entradas || []).slice(-1)[0] || "");
async function turno(accion) {
  const n = await nTurnos();
  await accion();
  await pg.waitForFunction((n) => [...window.__store.keys()].filter((k) => k.startsWith("turnos/")).length > n, n, { timeout: 7000 }).catch(() => {});
  await pg.waitForTimeout(700);
}
const deOtro = (jid, nombre) => async () => {
  await pg.evaluate(async ([jid, nombre]) => { await window.__db.collection("acciones").add({ nombre, uid: "x" + jid, jid, texto: "Hago algo", ts: Date.now() + 5 }); }, [jid, nombre]);
  await pg.getByRole("button", { name: "Que el DM responda" }).click({ timeout: 5000 }).catch(() => {});
};
const deAna = (txt) => async () => { await pg.fill("#accion", txt); await pg.keyboard.press("Enter"); };

// 1. Ana (única en la iniciativa) actúa: el DM resuelve al Ogro y la palabra pasa a Beto, que no combate.
await pg.evaluate(() => { window.__textoDM = "Aldo golpea al Ogro y la bestia ruge de dolor."; window.__entradas = []; });
await turno(deAna("Ataco al Ogro"));
let e = await ultimaEntrada(), o = await orden();
t(/# TURNOS DE COMBATE/.test(e) && e.includes(`el turno de: ${ogro}`), "turno de Ana: bloque de combate con el Ogro por resolver");
t(o.turno === "uBeto" && o.ronda === 1, "la palabra pasa a Beto (no vuelve a Ana): " + JSON.stringify(o));
t((await combate()) === 2, "el asalto del motor avanza a 2");

// 2. Beto (fuera del combate) juega su turno normal.
await pg.evaluate(() => { window.__textoDM = "Bruna explora el pasillo con calma y cuidado."; window.__entradas = []; });
await turno(deOtro("uBeto", "Beto"));
e = await ultimaEntrada(); o = await orden();
t(!/# TURNOS DE COMBATE/.test(e) && /NO participa/.test(e) && /Cris/.test(e), "turno de Beto: el DM sabe que no participa en el combate y da la palabra a Cris");
t(o.turno === "uCris", "la palabra pasa a Cris");
t((await combate()) === 2, "el turno de Beto no toca el asalto");

// 3. Cris juega y la palabra vuelve a Ana con su entrada de iniciativa.
await pg.evaluate(() => { window.__textoDM = "Carl vigila la puerta mientras el combate sigue."; window.__entradas = []; });
await turno(deOtro("uCris", "Cris"));
o = await orden();
t(o.turno === "u1" && o.entrada === "Aldo" && o.ronda === 1, "tras Cris, la palabra vuelve a Ana (Aldo): " + JSON.stringify(o));

// 4. Ana acaba el combate: el orden vuelve a la rotación normal desde ella (Beto), sin tocar a nadie dos veces.
await pg.evaluate(() => { window.__textoDM = "El Ogro huye aterrorizado hacia el bosque y se acaba."; window.__accionesDM = [{ accion: "terminar_combate", datos: {} }]; window.__entradas = []; });
await turno(deAna("Remato al Ogro"));
await pg.evaluate(() => { window.__accionesDM = null; });
o = await orden();
t((await combate()) === null, "el combate ha terminado");
t(o.turno === "uBeto" && o.ronda === 1 && !o.entrada, "tras terminar el combate sigue la rotación normal: toca a Beto: " + JSON.stringify(o));
await pg.evaluate(() => { window.__textoDM = "Bruna sigue buscando huellas por el camino."; window.__entradas = []; });
await turno(deOtro("uBeto", "Beto"));
t((await orden()).turno === "uCris", "después Cris");
await pg.evaluate(() => { window.__textoDM = "Carl sigue de guardia junto al fuego del campamento."; });
await turno(deOtro("uCris", "Cris"));
o = await orden();
t(o.turno === "u1" && o.ronda === 2, "y Ana abre la ronda 2: " + JSON.stringify(o));

console.log("errores de página:", errs.length + fallos, errs.slice(0, 3).map((x) => x.slice(0, 160)).join(" | "));
await b.close();
