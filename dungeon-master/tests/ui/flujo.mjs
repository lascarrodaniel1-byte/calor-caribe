import { lanzar, fixture, MOCK, salida, paginaDe } from "./_comun.mjs";
const S = await paginaDe();
const b = await lanzar();
const pg = await b.newPage({ viewport: { width: 1280, height: 860 } });
const errs = []; pg.on("pageerror", (e) => errs.push(e.message));
await pg.addInitScript({ path: MOCK });
await pg.goto("file://" + S + "/mesa-de-velmora.html"); await pg.waitForTimeout(800);
await pg.click("#form-tutorial button[type=submit]").catch(() => {}); await pg.fill("#nombre", "Ana"); await pg.click("#form-nombre button"); await pg.waitForTimeout(500);
const turnos = () => pg.evaluate(() => [...window.__store.keys()].filter((k) => k.startsWith("turnos/")).length);
const llamadas = () => pg.evaluate(() => window.__llamadas.slice());
const enviar = async (txt) => { await pg.fill("#accion", txt); await pg.keyboard.press("Enter"); };
// 1. turno tranquilo: ni una sola llamada de repaso
await pg.evaluate(() => { window.__textoDM = "La posada huele a cerveza y nadie levanta la vista."; });
await enviar("Miro la sala"); await pg.waitForFunction(() => [...window.__store.keys()].some((k) => k.startsWith("turnos/")), null, { timeout: 15000 }).catch(() => {});
console.log("1. turno tranquilo → turnos:", await turnos(), "· llamadas:", (await llamadas()).join(","));
// 2. narración con omisiones: se hace el repaso
await pg.evaluate(() => { window.__textoDM = "Pasan tres horas de camino. Llegan a Pozonegro y el posadero, llamado Berta la Gorda, les cobra 5 platas."; window.__llamadas.length = 0; });
const t1 = await turnos(); await enviar("Seguimos el camino"); await pg.waitForFunction((n) => [...window.__store.keys()].filter((k) => k.startsWith("turnos/")).length > n, t1, { timeout: 15000 }).catch(() => {});
console.log("2. con omisiones → turnos:", await turnos(), "· llamadas:", (await llamadas()).join(","));
// 3. repaso colgado: el turno se guarda igual (≤ ~45 s)
await pg.evaluate(() => { window.__colgarRepaso = true; window.__llamadas.length = 0; });
const t2 = await turnos(); const t0 = Date.now(); await enviar("Pedimos de comer"); await pg.waitForFunction((n) => [...window.__store.keys()].filter((k) => k.startsWith("turnos/")).length > n, t2, { timeout: 60000 }).catch(() => {});
console.log("3. repaso colgado → turno guardado:", (await turnos()) > t2, "en", Math.round((Date.now() - t0) / 1000), "s");
// 4. «Detener al DM» durante el repaso: el turno NO se guarda
await pg.evaluate(() => { window.__llamadas.length = 0; });
const t3 = await turnos(); await enviar("Dormimos"); await pg.waitForFunction(() => window.__llamadas.includes("repaso"), null, { timeout: 15000 }).catch(() => {});
await pg.click("#detener-dm").catch(() => {}); await pg.waitForTimeout(1500);
console.log("4. detener durante el repaso → turnos sin cambio:", (await turnos()) === t3, "· botón oculto:", !(await pg.locator("#detener-dm").isVisible()));
// 5. DM colgado: detener lo libera y se puede reintentar
await pg.evaluate(() => { window.__colgarRepaso = false; window.__colgarDM = true; });
await enviar("Pido una cerveza").catch(() => {}); await pg.waitForTimeout(1500);
console.log("5. DM colgado → botón visible:", await pg.locator("#detener-dm").isVisible());
await pg.click("#detener-dm"); await pg.waitForTimeout(800);
await pg.evaluate(() => { window.__colgarDM = false; window.__textoDM = "El posadero sirve la cerveza."; });
const t4 = await turnos(); const bot = pg.getByRole("button", { name: "Que el DM responda" }); if (await bot.count()) await bot.click(); await pg.waitForFunction((n) => [...window.__store.keys()].filter((k) => k.startsWith("turnos/")).length > n, t4, { timeout: 15000 }).catch(() => {}); // espera por condición, no 7 s fijos
console.log("   tras detener, el DM vuelve a responder:", (await turnos()) > t4);
console.log("errores de página:", errs.length, errs.map((e) => e.slice(0, 160)).join(" | "));
console.log("registro:", (await pg.evaluate(() => document.getElementById("registro")?.innerText || "")).slice(-500).replace(/\n/g, " / "));
console.log("llamadas:", (await llamadas()).join(","), "· acciones en cola:", await pg.evaluate(() => [...window.__store.keys()].filter((k) => k.startsWith("acciones/")).length));
await b.close();
