// Los resultados del motor no se cuelan en el relato: ni al pintar, ni al guardar, ni en la entrada que se envía al modelo.
import { lanzar, MOCK, paginaDe } from "./_comun.mjs";
const S = await paginaDe();
const b = await lanzar();
const pg = await b.newPage({ viewport: { width: 1280, height: 860 } });
const errs = []; pg.on("pageerror", (e) => errs.push(e.message));
await pg.addInitScript({ path: MOCK });
await pg.goto("file://" + S + "/mesa-de-velmora.html"); await pg.waitForTimeout(800);
await pg.click("#form-tutorial button[type=submit]").catch(() => {}); await pg.fill("#nombre", "Ana"); await pg.click("#form-nombre button"); await pg.waitForTimeout(500);
const turnosDocs = () => pg.evaluate(() => [...window.__store.entries()].filter(([k]) => k.startsWith("turnos/")).map(([, v]) => v));
const enviar = async (txt) => { await pg.fill("#accion", txt); await pg.keyboard.press("Enter"); };
const RELATO = "Varok recorre las estanterías hasta dar con el lomo negro del Índice.";
const BLOQUE = "[Resultados del motor en ese turno]\n🎲 Investigación de Varok (INT +3, competencia +2) vs CD 12 — buscar → 1d20+5: [17] + 5 = 22 → ÉXITO (+10)\n🕒 Día 1, 18:02 (anochecer cercano) — Varok busca el Índice en la biblioteca y lo halla…";
// 1. el modelo copia el bloque en su relato
await pg.evaluate(([r, bl]) => { window.__textoDM = r + "\n\n" + bl; window.__entradas = []; }, [RELATO, BLOQUE]);
await enviar("Busco el Índice");
await pg.waitForFunction(() => [...window.__store.keys()].some((k) => k.startsWith("turnos/")), null, { timeout: 15000 }).catch(() => {});
await pg.waitForTimeout(800);
const reg = await pg.evaluate(() => document.getElementById("registro")?.innerText || "");
const docs = await turnosDocs();
console.log("1. el relato se ve:", reg.includes("lomo negro"), "· el bloque no se ve:", !/Resultados del motor|vs CD 12|Día 1, 18:02/.test(reg));
console.log("   el turno se guarda limpio:", docs.length === 1 && docs[0].texto === RELATO, "· secuencia sin el bloque:", !/Resultados del motor/.test(JSON.stringify(await pg.evaluate(() => window.__store.get("mesa/estado")?.partida?.secuencia || {}))));
// 2. el turno siguiente: la entrada al modelo no tiene el marcador en ningún mensaje assistant
await pg.evaluate(() => { window.__textoDM = "El bibliotecario alza la vista."; window.__entradas = []; });
await enviar("Pregunto por el Índice");
await pg.waitForFunction(() => (window.__entradas || []).length > 0, null, { timeout: 15000 }).catch(() => {});
const entrada = await pg.evaluate(() => JSON.parse(window.__entradas.slice(-1)[0] || "[]"));
const asist = entrada.filter((m) => m.role === "assistant");
console.log("2. mensajes assistant en la entrada:", asist.length, "· sin «Resultados del motor» ni 🎲:", asist.every((m) => !/Resultados del motor|🎲/.test(m.content)), "· el relato sigue ahí:", asist.some((m) => m.content.includes("lomo negro")));
// 3. un turno viejo ya guardado con el bloque pegado se pinta limpio (la base no se toca)
await pg.evaluate(async ([r, bl]) => { await window.__db.collection("turnos").add({ ts: Date.now() + 5000, acciones: [], texto: "Turno viejo y sucio. " + r + "\n\n" + bl, avisos: [] }); }, [RELATO, BLOQUE]);
await pg.waitForTimeout(1200);
const reg3 = await pg.evaluate(() => document.getElementById("registro")?.innerText || "");
const viejo = (await turnosDocs()).find((d) => /Turno viejo/.test(d.texto || ""));
console.log("3. turno viejo: se ve el relato:", reg3.includes("Turno viejo y sucio"), "· sin el bloque:", !/Resultados del motor/.test(reg3), "· la base conserva el original:", /Resultados del motor/.test(viejo?.texto || ""));
console.log("errores de página:", errs.length, errs.slice(0, 2));
await b.close();
