import { lanzar, fixture, MOCK, salida, paginaDe } from "./_comun.mjs";
import { readFileSync, writeFileSync } from "node:fs";
const S = await paginaDe();
const partida = JSON.parse(readFileSync(fixture("partida-run.json"), "utf8"));
const b = await lanzar();
const pg = await b.newPage({ viewport: { width: 1280, height: 900 } });
const errs = []; pg.on("pageerror", (e) => errs.push(e.message));
await pg.addInitScript({ path: MOCK });
await pg.goto("file://" + S + "/mesa-de-velmora.html"); await pg.waitForTimeout(800);
await pg.click("#form-tutorial button[type=submit]").catch(() => {}); await pg.fill("#nombre", "Ana"); await pg.click("#form-nombre button"); await pg.waitForTimeout(500);
// run A
await pg.evaluate(async (p) => { await window.__db.doc("mesa/estado").set({ partida: p, cronica: "CRONICA-A", actualizado: 100 }); await window.__db.doc("mesa/memoria").set({ diario: "DIARIO-A", anales: ["anal A"], detalles: [], compactado_hasta: 0 }); await window.__db.doc("turnos/t1").set({ ts: 1, acciones: [{ nombre: "Ana", texto: "entro" }], texto: "Turno A1: la posada huele a cerveza.", avisos: [] }); await window.__db.doc("turnos/t2").set({ ts: 2, acciones: [], texto: "Turno A2: llega la noche.", avisos: [] }); }, partida);
await pg.waitForTimeout(1500);
await pg.click("#menu-barra");
console.log("botones: exportar", await pg.locator("#exportar-partida").isVisible(), "· importar", await pg.locator("#importar-partida").isVisible());
const reg = () => pg.evaluate(() => document.getElementById("registro")?.innerText || "");
console.log("A en pantalla:", /Turno A1/.test(await reg()), /Aldo/.test(await pg.evaluate(() => document.getElementById("lista-fichas")?.innerText || "")));
// exportar
await pg.evaluate(()=>{const p=document.getElementById("menu-panel");if(p.hidden)document.getElementById("menu-barra").click()}); await pg.click("#exportar-partida"); await pg.waitForTimeout(800);
const des = await pg.evaluate(() => window.__descargas || []);
console.log("exportación:", des.length, des[0]?.filename);
const run = JSON.parse(des[0].data);
console.log("  formato:", run.formato, "· turnos:", run.turnos.length, "· cronica:", run.estado.cronica, "· memoria:", run.memoria?.diario, "· resumen:", run.resumen.slice(0, 90));
writeFileSync(salida("run-A.json"), des[0].data);
// reiniciar (el diálogo ofrece exportar antes)
await pg.evaluate(()=>{const p=document.getElementById("menu-panel");if(p.hidden)document.getElementById("menu-barra").click()}); await pg.click("#reiniciar"); await pg.waitForTimeout(200);
console.log("el diálogo de reinicio ofrece exportar:", await pg.locator("#exportar-desde-reinicio").isVisible());
await pg.click("#confirmar-reinicio"); await pg.waitForTimeout(1500);
const vacio = await pg.evaluate(() => ({ estado: window.__store.has("mesa/estado"), turnos: [...window.__store.keys()].filter((k) => k.startsWith("turnos/")).length }));
console.log("tras reiniciar:", JSON.stringify(vacio), "· Aldo en pantalla:", /Aldo/.test(await pg.evaluate(() => document.getElementById("lista-fichas")?.innerText || "")));
// importar un archivo inválido
writeFileSync(salida("malo.json"), JSON.stringify({ hola: 1 }));
await pg.setInputFiles("#archivo-importar", salida("malo.json")); await pg.waitForTimeout(500);
console.log("archivo inválido → avisa:", /no es una partida exportada/.test(await reg()), "· diálogo cerrado:", await pg.evaluate(() => document.getElementById("velo-importar").hidden));
// importar A
await pg.setInputFiles("#archivo-importar", salida("run-A.json")); await pg.waitForTimeout(500);
console.log("diálogo de importar:", !(await pg.evaluate(() => document.getElementById("velo-importar").hidden)), "·", (await pg.textContent("#resumen-importar")).slice(0, 110));
await pg.click("#confirmar-importar"); await pg.waitForTimeout(2000);
const despues = await pg.evaluate(() => ({ estado: window.__store.get("mesa/estado")?.cronica, memoria: window.__store.get("mesa/memoria")?.diario, turnos: [...window.__store.keys()].filter((k) => k.startsWith("turnos/")).length, pendiente: window.__store.get("mesa/estado")?.pendiente }));
console.log("tras importar:", JSON.stringify(despues));
const texto = await reg(); const fichas = await pg.evaluate(() => document.getElementById("lista-fichas")?.innerText || "");
console.log("  historia:", /Turno A1/.test(texto) && /Turno A2/.test(texto), "· ficha Aldo:", /Aldo/.test(fichas), "· objetivo:", /relicario del Lich/.test(await pg.evaluate(() => document.body.innerText)), "· aviso:", /Partida importada/.test(texto));
// una segunda run, B, y volver a A
await pg.evaluate(()=>{const p=document.getElementById("menu-panel");if(p.hidden)document.getElementById("menu-barra").click()}); await pg.click("#reiniciar"); await pg.click("#confirmar-reinicio"); await pg.waitForTimeout(1200);
await pg.evaluate(async () => { await window.__db.doc("turnos/b1").set({ ts: 5, acciones: [], texto: "Turno B1", avisos: [] }); });
await pg.setInputFiles("#archivo-importar", salida("run-A.json")); await pg.waitForTimeout(400); await pg.click("#confirmar-importar"); await pg.waitForTimeout(1800);
const fin = await reg(); console.log("A de nuevo tras una run B:", /Turno A2/.test(fin) && !/Turno B1/.test(fin));
console.log("errores de página:", errs.length, errs.slice(0, 2));
await b.close();
