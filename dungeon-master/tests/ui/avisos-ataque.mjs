// Avisos de ataque en pantalla: el turno guardado y pintado lleva la tirada del d20 y la de daño (sin CA ni PV de la criatura), el relato que copia
// esa línea se limpia, pero los avisos nunca se limpian (limpiarNarracion solo toca el relato).
import { lanzar, fixture, MOCK, salida, paginaDe } from "./_comun.mjs";
import { readFileSync } from "node:fs";
const S = await paginaDe();
const partida = JSON.parse(readFileSync(fixture("partida-mesa.json"), "utf8"));
const b = await lanzar();
const errs = [];
let fallos = 0;
const t = (c, m, x = "") => { console.log(c ? "ok  " : "FALLA", m, x); if (!c) fallos++; };
const pg = await b.newPage({ viewport: { width: 1280, height: 860 } });
pg.on("pageerror", (e) => errs.push(e.message));
await pg.addInitScript({ path: MOCK });
await pg.goto("file://" + S + "/mesa-de-velmora.html"); await pg.waitForTimeout(800);
await pg.click("#form-tutorial button[type=submit]").catch(() => {}); await pg.fill("#nombre", "Ana"); await pg.click("#form-nombre button"); await pg.waitForTimeout(500);
const ahora = Date.now();
await pg.evaluate(async ([p, ahora]) => {
  const V = window.Velmora;
  V.ejecutar("aparecer_criatura", { nombre: "Ogro", repetir: true }, p);
  const ns = Object.values(p.jefes).map((j) => j.nombre);
  V.ejecutar("iniciativa", { participantes: ["Aldo", "Bruna", ...ns] }, p);
  V.ejecutar("plano", { escena: "sala", poner: [{ nombre: "Aldo" }] }, p);
  V.ejecutar("plano", { poner: ns.map((n) => ({ nombre: n, ref: "Aldo", direccion: "N", metros: 1.5 })) }, p);
  await window.__db.doc("mesa/estado").set({ partida: p, cronica: "", actualizado: ahora });
}, [partida, ahora]);
await pg.waitForTimeout(1200);
const nombreOgro = await pg.evaluate(() => Object.values(window.__store.get("mesa/estado").partida.jefes)[0].nombre);
const LINEA = /Aldo → Ogro[^\n]*🎲 d20 (?:(?:ventaja|desventaja) )?\[[\d, |]+\][+-]\d+ = \d+ → (?:impacto|fallo|roce|torpeza|¡crítico!)/;
await pg.evaluate((og) => {
  window.__accionesDM = [{ accion: "atacar", datos: { atacante: "Aldo", objetivo: og, arma: "Daga", dano: "1d4+3" } }];
  // El modelo copia además la línea del aviso al final de su relato: el relato debe quedar limpio.
  window.__textoDM = "Aldo carga contra el ogro con un grito.\n\n⚔️ Aldo → Ogro: 🎲 d20 [14]+8 = 22 → impacto · daño 1d4[2]+3 = 5 perforante (herido)";
  window.__entradas = [];
}, nombreOgro);
await pg.fill("#accion", "Ataco al ogro con mi espada"); await pg.keyboard.press("Enter");
await pg.waitForFunction(() => [...window.__store.keys()].some((k) => k.startsWith("turnos/")), null, { timeout: 20000 }).catch(() => {});
await pg.waitForTimeout(1000);
const doc = await pg.evaluate(() => [...window.__store.entries()].filter(([k]) => k.startsWith("turnos/")).map(([, v]) => v).pop());
const avisos = (doc?.avisos || []).map((a) => a.texto).join("\n");
console.log("  aviso guardado:", avisos.replace(/\n/g, " ⏎ "));
t(LINEA.test(avisos), "el aviso guardado lleva la tirada del d20 y el resultado");
t(/→ (?:impacto|¡crítico![^·]*|roce) · daño \d+d4\[[\d,]+\]\+3 = \d+ perforante|→ (?:fallo|torpeza)/.test(avisos), "y, si impacta, la tirada de daño con su tipo (los dados son reales: también vale un fallo)");
t(!/vs CA/.test(avisos), "sin la CA de la criatura");
t(doc?.texto === "Aldo carga contra el ogro con un grito.", "el relato se guarda limpio (sin la línea copiada)", JSON.stringify(doc?.texto));
const reg = await pg.evaluate(() => document.getElementById("registro")?.innerText || "");
t(/🎲 d20 \[\d+\]/.test(reg) && /Aldo → /.test(reg), "la pantalla muestra el aviso con la tirada");
await pg.screenshot({ path: salida("avisos-ataque.png") });
console.log("capturas en:", salida("").replace(/\/$/, ""));
console.log("fallos:", fallos);
console.log("errores de página:", errs.length, errs.slice(0, 3).join(" | "));
await b.close();
if (fallos) process.exitCode = 1;
