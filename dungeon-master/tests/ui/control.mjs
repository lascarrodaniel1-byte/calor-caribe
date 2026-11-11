import { lanzar, fixture, MOCK, salida, paginaDe } from "./_comun.mjs";
import { readFileSync } from "node:fs";
const S = await paginaDe();
const partida = JSON.parse(readFileSync(fixture("partida-mesa.json"), "utf8"));
const b = await lanzar();
const pg = await b.newPage({ viewport: { width: 1280, height: 900 } });
const errs = []; pg.on("pageerror", (e) => errs.push(e.message));
await pg.addInitScript({ path: MOCK });
await pg.goto("file://" + S + "/mesa-de-velmora.html"); await pg.waitForTimeout(800);
await pg.click("#form-tutorial button[type=submit]").catch(() => {}); await pg.fill("#nombre", "Cam"); await pg.click("#form-nombre button"); await pg.waitForTimeout(600);
const ahora = Date.now();
await pg.evaluate(async ([p, t]) => {
  await window.__db.doc("mesa/estado").set({ partida: p, cronica: "", actualizado: t });
  await window.__db.doc("jugadores/uAna").set({ nombre: "Ana", entrada: 1, visto: t });
  await window.__db.doc("jugadores/uBeto").set({ nombre: "Beto", entrada: 2, visto: 0 });
  await window.__db.doc("mesa/orden").set({ modo: "turnos", turno: "u1", ronda: 1, desde: t });
}, [partida, ahora]);
await pg.waitForTimeout(1500);
const vis = (id) => pg.locator(id).isVisible();
console.log("1. sin personaje: «Crear personaje»", await vis("#crear-personaje"), "· «Llevar un personaje ausente»", await vis("#llevar-personaje"));
// pasar el turno sin personaje
console.log("   «Pasar turno» visible sin personaje:", await vis("#pasar-turno"));
await pg.click("#pasar-turno"); await pg.waitForTimeout(1200);
const orden1 = await pg.evaluate(() => window.__store.get("mesa/orden")?.turno);
console.log("   pasar sin personaje →", orden1 === "u1" ? "NO pasa" : "pasa el turno a " + orden1);
await pg.evaluate(async (t) => { await window.__db.doc("mesa/orden").set({ modo: "turnos", turno: "u1", ronda: 2, desde: t }); }, Date.now()); await pg.waitForTimeout(500);
// diálogo
await pg.click("#llevar-personaje"); await pg.waitForTimeout(300);
const filas = await pg.locator("#lista-control .fila-control").allInnerTexts();
console.log("2. diálogo ofrece:", JSON.stringify(filas.map((f) => f.split("\n")[0])), "· ¿Aldo (jugador presente)?", filas.some((f) => /Aldo/.test(f)));
await pg.locator("#lista-control .fila-control button").first().click(); await pg.waitForTimeout(800);
console.log("3. control guardado:", JSON.stringify(await pg.evaluate(() => window.__store.get("mesa/control"))));
await pg.click("#cerrar-control");
console.log("   tras llevarlo: «Crear personaje»", await vis("#crear-personaje"), "· nota de la ficha:", (await pg.locator('.ficha[data-nombre="Bruna"] .ausente-nota').innerText()).slice(0, 60));
// el DM recibe el control
await pg.evaluate(() => { window.__textoDM = "Bruna avanza."; window.__entradas = []; });
await pg.fill("#accion", "Desenvaino y me coloco junto a Ana"); await pg.keyboard.press("Enter");
await pg.waitForFunction(() => (window.__entradas || []).length > 0, null, { timeout: 15000 }).catch(() => {});
const ent = await pg.evaluate(() => (window.__entradas || []).join("\n"));
console.log("4. el DM sabe quién lleva a quién:", /LLEVA ahora a Bruna \(cuyo jugador, Beto, está ausente\)/.test(ent), "· bloque de control prestado:", /PERSONAJES LLEVADOS POR OTRO JUGADOR/.test(ent), "· Bruna no la lleva el DM:", !/PERSONAJES LLEVADOS POR EL DM/.test(ent), "· no «creando»:", !/está CREANDO su personaje/.test(ent));
// vuelve su dueño: el control se le devuelve solo
await pg.evaluate(async (t) => { await window.__db.doc("jugadores/uBeto").set({ nombre: "Beto", entrada: 2, visto: t }); }, Date.now()); await pg.waitForTimeout(1200);
const nota = await pg.locator('.ficha[data-nombre="Bruna"] .ausente-nota').isVisible().catch(() => false);
console.log("5. vuelve Beto: nota de ausente visible:", nota, "· «Crear personaje» otra vez:", await vis("#crear-personaje"));
console.log("errores de página:", errs.length, errs.slice(0, 2));
await b.close();
