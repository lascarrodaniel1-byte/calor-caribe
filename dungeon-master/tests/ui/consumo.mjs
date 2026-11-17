// Medición del consumo (bloque 4): un turno del DM con varias acciones en UNA llamada a `motor` anota en consumo/ las herramientas llamadas (`uso`),
// el desglose de la entrada (`partes`, que suma lo mismo que `entrada`) y las vueltas (`vueltas`, `acc`); y el panel «📊 Consumo del DM» del menú ☰
// (solo lectura) las resume, también con documentos antiguos sin esos campos, sin ensanchar la barra ni desbordar el móvil.
import { lanzar, fixture, MOCK, paginaDe } from "./_comun.mjs";
import { readFileSync } from "node:fs";
const S = await paginaDe();
const partida = JSON.parse(readFileSync(fixture("partida-mesa.json"), "utf8"));
const b = await lanzar();
let fallos = 0, erroresPagina = 0;
const t = (c, m, x = "") => { console.log(c ? "ok  " : "FALLA", m, x); if (!c) fallos++; };
for (const [w, h, n] of [[1280, 860, "escritorio"], [390, 844, "móvil"]]) {
  const pg = await b.newPage({ viewport: { width: w, height: h } });
  pg.on("pageerror", (e) => { erroresPagina++; console.log("  error de página:", e.message.slice(0, 160)); });
  await pg.addInitScript({ path: MOCK });
  await pg.goto("file://" + S + "/mesa-de-velmora.html"); await pg.waitForTimeout(800);
  await pg.click("#form-tutorial button[type=submit]").catch(() => {}); await pg.fill("#nombre", "Ana"); await pg.click("#form-nombre button"); await pg.waitForTimeout(500);
  await pg.evaluate(async ([p, t0]) => { await window.__db.doc("mesa/estado").set({ partida: p, cronica: "", actualizado: t0 }); }, [partida, Date.now()]);
  await pg.waitForTimeout(1200);
  const anchoBarra = await pg.evaluate(() => document.querySelector("header").getBoundingClientRect().height);
  // 1. un turno con tres acciones en una sola llamada
  await pg.evaluate(() => {
    window.__textoDM = "La lluvia de ceniza cae sobre Aldenmar.";
    window.__accionesDM = [
      { accion: "tirar_dados", datos: { dados: "1d20" } },
      { accion: "tirar_dados", datos: { dados: "1d6" } },
      { accion: "consultar_reglas", datos: { tema: "clima" } },
    ];
  });
  await pg.fill("#accion", "Miro alrededor"); await pg.keyboard.press("Enter");
  await pg.waitForFunction(() => [...window.__store.keys()].some((k) => k.startsWith("consumo/")), null, { timeout: 15000 }).catch(() => {});
  const docs = await pg.evaluate(() => [...window.__store.entries()].filter(([k]) => k.startsWith("consumo/")).map(([, v]) => v));
  const d = docs[0] || {};
  t(docs.length === 1, `${n}: un documento de consumo por turno`, String(docs.length));
  t(d.uso?.tirar_dados === 2 && d.uso?.consultar_reglas === 1 && Object.keys(d.uso || {}).length <= 12, `${n}: uso = acciones llamadas por nombre`, JSON.stringify(d.uso));
  t(d.vueltas === 1 && d.acc === 3, `${n}: una vuelta de herramientas con 3 acciones`, `vueltas=${d.vueltas} acc=${d.acc}`);
  const suma = d.partes ? Object.values(d.partes).reduce((a, x) => a + x, 0) : -1;
  t(d.partes && ["reglas", "catalogo", "estado", "historial", "cronica", "acciones"].every((k) => Number.isFinite(d.partes[k])) && suma === d.entrada, `${n}: el desglose de la entrada suma la entrada`, `suma=${suma} entrada=${d.entrada}`);
  t(d.partes?.reglas > 20000 && d.partes?.catalogo > 5000 && d.partes?.estado > 500, `${n}: reglas, catálogo y estado con tamaños razonables`, JSON.stringify(d.partes));
  t(JSON.stringify(d).length < 900, `${n}: el documento no engorda (≈ 300 bytes más)`, String(JSON.stringify(d).length));
  // 2. un documento antiguo, sin los campos nuevos, conviviendo en el registro
  await pg.evaluate(async () => { await window.__db.doc("consumo/cviejo").set({ ts: 1, jugador: "Ana", entrada: 90000, salida: 800, herramientas: 3, repaso: false, sinNarracion: false, nivel: "quick", origen: "local" }); });
  // 3. el panel del menú
  await pg.click("#menu-barra");
  t(await pg.locator("#ver-consumo").isVisible(), `${n}: el botón «Consumo del DM» está en el menú ☰`);
  await pg.click("#ver-consumo"); await pg.waitForSelector("#consumo-cuerpo table", { timeout: 5000 }).catch(() => {});
  const txt = await pg.evaluate(() => document.getElementById("consumo-cuerpo").innerText);
  t(/2 turnos registrados/.test(txt), `${n}: cuenta los turnos (nuevo + antiguo)`);
  t(/Herramientas por turno/.test(txt) && /tirar_dados: 2 llamadas en 1 turnos/.test(txt), `${n}: herramientas por turno y las más llamadas`);
  t(/Reglas del sistema/.test(txt) && /Catálogo de acciones/.test(txt) && /Estado del DM/.test(txt) && /Acciones del turno/.test(txt) && /Media de 1 turnos con desglose/.test(txt), `${n}: reparto de la entrada por parte (solo con el turno que lo trae)`);
  const m = await pg.evaluate(() => ({ ancho: document.documentElement.scrollWidth, vp: innerWidth, cab: document.querySelector("header").getBoundingClientRect().height, vel: document.getElementById("velo-consumo").getBoundingClientRect().width }));
  t(m.ancho <= m.vp && m.cab === anchoBarra, `${n}: la barra no se ensancha ni la página desborda`, JSON.stringify(m));
  await pg.keyboard.press("Escape");
  t(await pg.evaluate(() => document.getElementById("velo-consumo").hidden), `${n}: Esc cierra el panel`);
  await pg.close();
}
await b.close();
console.log("errores de página:", erroresPagina);
process.exit(fallos || erroresPagina ? 1 : 0);
