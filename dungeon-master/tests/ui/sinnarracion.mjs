import { lanzar, fixture, MOCK, salida, paginaDe } from "./_comun.mjs";
const S = await paginaDe();
const b = await lanzar();
const pg = await b.newPage({ viewport: { width: 1280, height: 860 } });
const errs = []; pg.on("pageerror", (e) => errs.push(e.message));
await pg.addInitScript({ path: MOCK });
await pg.goto("file://" + S + "/mesa-de-velmora.html"); await pg.waitForTimeout(800);
await pg.click("#form-tutorial button[type=submit]").catch(() => {}); await pg.fill("#nombre", "Ana"); await pg.click("#form-nombre button"); await pg.waitForTimeout(500);
const turnos = () => pg.evaluate(() => [...window.__store.keys()].filter((k) => k.startsWith("turnos/")).length);
const enviar = async (txt) => { await pg.fill("#accion", txt); await pg.keyboard.press("Enter"); };
// 1. el DM termina sin narración, pero la segunda petición sí narra: el turno se guarda con esa narración
await pg.evaluate(() => { window.__sinTexto = true; window.__textoNarrar = "Tu espada abre un surco en el hombro del bandido, que retrocede maldiciendo."; window.__llamadas.length = 0; });
await enviar("Ataco al bandido"); await pg.waitForFunction(() => [...window.__store.keys()].some((k) => k.startsWith("turnos/")), null, { timeout: 15000 }).catch(() => {});
const reg = await pg.evaluate(() => document.getElementById("registro")?.innerText || "");
console.log("1. sin narración → se pide otra vez:", (await pg.evaluate(() => window.__llamadas)).join(","), "· turnos:", await turnos(), "· aparece la narración:", /surco en el hombro/.test(reg));
// 2. tampoco narra la segunda vez: no se guarda nada, avisa y las acciones siguen en cola
await pg.evaluate(() => { window.__textoNarrar = ""; window.__llamadas.length = 0; });
const t1 = await turnos(); await enviar("Ataco otra vez"); await pg.waitForTimeout(4000);
const reg2 = await pg.evaluate(() => document.getElementById("registro")?.innerText || "");
console.log("2. sigue sin narrar → turnos sin cambio:", (await turnos()) === t1, "· avisa:", /no llegó a escribir la narración/.test(reg2), "· cola:", await pg.evaluate(() => [...window.__store.keys()].filter((k) => k.startsWith("acciones/")).length));
// 3. con el DM normal, todo vuelve a funcionar
await pg.evaluate(() => { window.__sinTexto = false; window.__textoDM = "El bandido cae de rodillas."; });
const bot = pg.getByRole("button", { name: "Que el DM responda" }); if (await bot.count()) await bot.click(); await pg.waitForTimeout(6000);
console.log("3. el DM vuelve a narrar:", (await turnos()) > t1);
console.log("errores de página:", errs.length, errs.slice(0, 2));
await b.close();
