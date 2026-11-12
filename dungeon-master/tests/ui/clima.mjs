// Estaciones y clima en el panel del mapa: tras situar al grupo y fijar el reloj, el panel muestra la estación y el clima de hoy,
// sin ensanchar la cabecera ni romper el móvil (390 px). Con captura en el directorio temporal.
import { lanzar, fixture, MOCK, salida, paginaDe } from "./_comun.mjs";
import { readFileSync } from "node:fs";
const S = await paginaDe();
const partida = JSON.parse(readFileSync(fixture("partida-mesa.json"), "utf8"));
delete partida.calendario; delete partida.reloj; // una partida «antigua»: la página activa las estaciones sola
const b = await lanzar();
let errores = 0;
for (const [w, h, n] of [[1280, 860, "escritorio"], [390, 844, "movil"]]) {
  const pg = await b.newPage({ viewport: { width: w, height: h } });
  const errs = []; pg.on("pageerror", (e) => errs.push(e.message)); pg.on("console", (c) => { if (c.type() === "error") console.log("  consola:", c.text().slice(0, 200)); });
  await pg.addInitScript({ path: MOCK });
  await pg.goto("file://" + S + "/mesa-de-velmora.html"); await pg.waitForTimeout(800);
  await pg.click("#form-tutorial button[type=submit]").catch(() => {}); await pg.fill("#nombre", "Ana"); await pg.click("#form-nombre button"); await pg.waitForTimeout(500);
  await pg.evaluate(async ([p, t]) => { await window.__db.doc("mesa/estado").set({ partida: p, cronica: "", actualizado: t }); }, [partida, Date.now()]);
  await pg.waitForTimeout(1500);
  await pg.evaluate(() => {
    window.__textoDM = "La lluvia de ceniza cae sobre Aldenmar.";
    window.__accionesDM = [
      { accion: "ubicacion", datos: { lugar: "La Catedral", region: "Aldenmar", tipo: "templo" } },
      { accion: "tiempo", datos: { fijar: { dia: 1, hora: 14, minuto: 52 } } },
    ];
  });
  await pg.fill("#accion", "Entramos en la ciudad"); await pg.keyboard.press("Enter");
  await pg.waitForFunction(() => window.__store.get("mesa/estado")?.partida?.calendario, null, { timeout: 15000 }).catch(() => {});
  await pg.waitForTimeout(1500);
  // Vuelve a aplicar el estado ya guardado (así el panel se pinta con él, como al abrir la página o al llegar el estado de otro jugador).
  await pg.evaluate(async () => { const e = window.__store.get("mesa/estado"); await window.__db.doc("mesa/estado").set({ ...e, actualizado: (e.actualizado || 0) + 1, pendiente: undefined }); });
  await pg.waitForFunction(() => document.getElementById("mapa-estacion"), null, { timeout: 8000 }).catch(() => {});
  const m = await pg.evaluate(() => {
    const e = document.getElementById("mapa-estacion"), d = document.getElementById("mapa-donde"), cab = document.querySelector("header");
    return { estacion: e ? e.textContent : null, donde: d ? d.innerText.replace(/\n/g, " | ") : null, anchoPagina: document.documentElement.scrollWidth, ancho: innerWidth, cabecera: cab ? Math.round(cab.getBoundingClientRect().height) : null };
  });
  console.log(n, JSON.stringify(m));
  const bien = !!m.estacion && /^(🌱|☀️|🍂|❄️)/.test(m.estacion) && /Otoño/.test(m.estacion) && m.anchoPagina <= m.ancho;
  console.log(`  panel con la estación: ${bien ? "ok" : "FALLA"}`);
  if (!bien) errores++;
  if (n === "movil") { await pg.getByText("Ver mapa").first().click().catch(() => {}); await pg.waitForTimeout(600); }
  await pg.screenshot({ path: salida(`clima-${n}.png`) });
  console.log("  captura:", salida(`clima-${n}.png`));
  errores += errs.length;
  console.log("  errores de página:", errs.length, errs.join(" | ").slice(0, 200));
  await pg.close();
}
await b.close();
console.log("errores de página:", errores);
process.exit(errores ? 1 : 0);
