// Nivel del DM compartido por mesa (documento «mesa/config»): el dueño lo fija desde el selector y quien narra lo usa aunque su localStorage diga otra cosa;
// el no editor ve el selector deshabilitado con la nota; sin config todo funciona como antes; un cambio del dueño vale para el siguiente turno sin recargar
// (la lectura es fresca, justo antes de llamar a sample). El mock tiene una base por página: «otro navegador» se simula escribiendo mesa/config en la base de la página.
import { lanzar, MOCK, salida, paginaDe } from "./_comun.mjs";
const S = await paginaDe();
const b = await lanzar();
const errs = [];
let fallos = 0;
const t = (c, m) => { console.log(c ? "ok  " : "FALLA", m); if (!c) fallos++; };

/** Página como jugador «Ana»; `editor`=false → no es dueño ni editor; `local` = lo que dice su localStorage. */
async function montar({ editor = true, local = null, ancho = 1280, alto = 860 } = {}) {
  const ctx = await b.newContext({ viewport: { width: ancho, height: alto }, hasTouch: ancho < 600 });
  const pg = await ctx.newPage();
  pg.on("pageerror", (e) => errs.push(e.message));
  await pg.addInitScript({ path: MOCK });
  await pg.addInitScript(([editor, local]) => {
    if (local) { try { localStorage.setItem("velmora-nivel", local); } catch {} }
    if (!editor) { const usar = window.claude.use; window.claude.use = async (n) => (n === "user" ? { id: async () => "u2", isOwner: async () => false, canEdit: async () => false, can: async () => true } : usar(n)); }
  }, [editor, local]);
  await pg.goto("file://" + S + "/mesa-de-velmora.html"); await pg.waitForTimeout(800);
  await pg.click("#form-tutorial button[type=submit]").catch(() => {}); await pg.fill("#nombre", "Ana"); await pg.click("#form-nombre button"); await pg.waitForTimeout(700);
  return pg;
}
const turnos = (pg) => pg.evaluate(() => [...window.__store.keys()].filter((k) => k.startsWith("turnos/")).length);
const tiers = (pg) => pg.evaluate(() => (window.__tiers || []).filter((x) => !x.repaso).map((x) => x.tier));
async function narrar(pg, txt) {
  const n = await turnos(pg);
  await pg.fill("#accion", txt); await pg.keyboard.press("Enter");
  await pg.waitForFunction((n) => [...window.__store.keys()].filter((k) => k.startsWith("turnos/")).length > n, n, { timeout: 20000 }).catch(() => {});
  await pg.waitForTimeout(400);
}
const menu = async (pg) => { if (await pg.evaluate(() => document.getElementById("menu-panel").hidden)) await pg.click("#menu-barra"); };
const sel = (pg) => pg.evaluate(() => { const s = document.getElementById("nivel"), n = document.getElementById("nota-nivel"); return { v: s.value, off: s.disabled, nota: n.hidden ? "" : n.textContent }; });
const cfg = (pg) => pg.evaluate(() => window.__store.get("mesa/config") ?? null);
const consumo = (pg) => pg.evaluate(() => [...window.__store.entries()].filter(([k]) => k.startsWith("consumo/")).map(([, v]) => v));

// 1. Sin config: como hoy (selector local, «quick» por defecto); el dueño ve la pista y no se escribe nada solo
{
  const pg = await montar({ editor: true });
  await menu(pg);
  let s = await sel(pg);
  t(s.v === "quick" && !s.off, "sin config (dueño): selector local en «quick», habilitado");
  t(/toda la mesa/.test(s.nota), `sin config (dueño): pista «${s.nota}»`);
  t((await cfg(pg)) === null, "sin config: no se escribe mesa/config por sí sola");
  await narrar(pg, "Miro la sala");
  t((await tiers(pg)).slice(-1)[0] === "quick", "sin config: sample recibe «quick» (el selector local)");
  const c = await consumo(pg);
  t(c.length > 0 && c.every((x) => x.origen === "local"), "consumo: origen «local»");
  await pg.context().close();
}

// 2. El dueño fija «default» y lo cambia después: vale para el siguiente turno, sin recargar
{
  const pg = await montar({ editor: true });
  await menu(pg);
  await pg.selectOption("#nivel", "default");
  await pg.waitForTimeout(300);
  const c = await cfg(pg);
  t(c && c.nivel === "default" && c.por === "Ana" && c.ts > 0, `el dueño fija «default»: mesa/config = ${JSON.stringify(c)}`);
  const s = await sel(pg);
  t(!s.off && /toda la mesa/.test(s.nota), `el dueño sigue pudiendo cambiarlo (nota «${s.nota}»)`);
  await narrar(pg, "Abro la puerta");
  t((await tiers(pg)).slice(-1)[0] === "default", "el siguiente turno usa «default»");
  await pg.selectOption("#nivel", "complex"); await pg.waitForTimeout(300);
  await narrar(pg, "Subo la escalera");
  t((await tiers(pg)).slice(-1)[0] === "complex", "cambio del dueño → el turno siguiente usa «complex» sin recargar");
  const k = await consumo(pg);
  t(k.length > 0 && k.every((x) => x.origen === "mesa"), "consumo: origen «mesa»");
  await pg.context().close();
}

// 3. Otro jugador (no editor) con su localStorage en «quick»: narra con el nivel de la mesa
{
  const pg = await montar({ editor: false, local: "quick" });
  await menu(pg);
  let s = await sel(pg);
  t(s.v === "quick" && !s.off && s.nota === "", "no editor sin config: selector local habilitado y sin nota");
  // «el dueño» fija default desde otro navegador: llega por la suscripción
  await pg.evaluate(() => window.__db.doc("mesa/config").set({ nivel: "default", por: "Fabián", ts: Date.now() }));
  await pg.waitForTimeout(400);
  s = await sel(pg);
  t(s.v === "default" && s.off, `no editor: el selector muestra «default» deshabilitado (${JSON.stringify(s)})`);
  t(/lo fija el due/i.test(s.nota), `no editor: nota «${s.nota}»`);
  t(await pg.evaluate(() => localStorage.getItem("velmora-nivel")) === "quick", "su localStorage sigue diciendo «quick»");
  await narrar(pg, "Hablo con el posadero");
  t((await tiers(pg)).slice(-1)[0] === "default", "no editor: sample recibe «default» aunque su localStorage diga «quick»");
  // un cambio que su pestaña NO ha visto (sin aviso en directo): la lectura fresca lo recoge antes del siguiente turno
  await pg.evaluate(() => window.__store.set("mesa/config", { nivel: "complex", por: "Fabián", ts: Date.now() }));
  await narrar(pg, "Pido una cerveza");
  t((await tiers(pg)).slice(-1)[0] === "complex", "cambio del dueño sin aviso en directo → el siguiente turno usa «complex»");
  const s2 = await sel(pg);
  t(s2.v === "complex" && s2.off, "y el selector se actualiza solo");
  // el no editor no puede cambiarlo aunque lo intente
  await pg.evaluate(() => { const e = document.getElementById("nivel"); e.disabled = false; e.value = "quick"; e.dispatchEvent(new Event("change")); });
  await pg.waitForTimeout(300);
  t((await cfg(pg)).nivel === "complex", "no editor: un cambio forzado no escribe mesa/config");
  t((await sel(pg)).v === "complex", "no editor: el selector vuelve al nivel de la mesa");
  // se actualiza al cambiar en directo
  await pg.evaluate(() => window.__db.doc("mesa/config").set({ nivel: "quick", por: "Fabián", ts: Date.now() }));
  await pg.waitForTimeout(300);
  t((await sel(pg)).v === "quick", "el selector sigue los cambios en directo");
  await pg.context().close();
}

// 4. Móvil a 390 px: sin desbordes con el menú abierto (dueño con la pista y no editor con la nota); capturas
for (const [editor, n] of [[true, "dueno"], [false, "jugador"]]) {
  const pg = await montar({ editor, ancho: 390, alto: 844 });
  if (!editor) { await pg.evaluate(() => window.__db.doc("mesa/config").set({ nivel: "default", por: "Fabián", ts: Date.now() })); await pg.waitForTimeout(300); }
  await menu(pg);
  const m = await pg.evaluate(() => { const p = document.getElementById("menu-panel").getBoundingClientRect(), f = document.querySelector("footer.redaccion").getBoundingClientRect(); return { desborde: document.documentElement.scrollWidth > innerWidth + 1, panelDentro: p.left >= -1 && p.right <= innerWidth + 1, barra: Math.round(f.height), vh: innerHeight }; });
  t(!m.desborde && m.panelDentro, `390 px (${n}): sin desbordes y el menú cabe (barra ${m.barra}px de ${m.vh})`);
  t(m.barra <= 0.15 * m.vh, `390 px (${n}): la barra no supera el 15 % (${m.barra}px)`);
  await pg.screenshot({ path: salida(`nivel-mesa-${n}-390.png`) });
  await pg.context().close();
}

console.log("errores de página:", errs.length, errs.slice(0, 3).join(" | "));
await b.close();
process.exit(fallos || errs.length ? 1 : 0);
