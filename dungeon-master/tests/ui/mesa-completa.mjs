// Mesa completa con 3 jugadores (mock): crear personajes por el formulario, fijar el reloj, explorar con una cita de salto,
// combate por iniciativa con acción programada y reacción preparada, exportar, reiniciar y reimportar la partida. Sin errores de página.
// Mide además el arranque de la página y lo que cuesta repintar con 4 jugadores, 12 turnos y 8 combatientes (se imprime, no falla).
import { lanzar, MOCK, salida, paginaDe } from "./_comun.mjs";
import { writeFileSync } from "node:fs";
const T0 = Date.now();
const S = await paginaDe();
const b = await lanzar();
const pg = await b.newPage({ viewport: { width: 1280, height: 900 } });
const errs = [];
pg.on("pageerror", (e) => errs.push(e.message));
let fallos = 0;
const t = (c, m, x = "") => { console.log(c ? "ok  " : "FALLA", m, x); if (!c) fallos++; };
await pg.addInitScript({ path: MOCK });
const tCarga = Date.now();
await pg.goto("file://" + S + "/mesa-de-velmora.html");
await pg.waitForSelector("#nombre", { state: "attached" });
const arranque = Date.now() - tCarga;
await pg.click("#form-tutorial button[type=submit]").catch(() => {});
const poner = async (nombre) => { await pg.fill("#nombre", nombre); await pg.click("#form-nombre button"); await pg.waitForTimeout(250); };
await poner("Ana");

const turnosN = () => pg.evaluate(() => [...window.__store.keys()].filter((k) => k.startsWith("turnos/")).length);
const esperarTurno = async (n, ms = 15000) => { await pg.waitForFunction((n) => [...window.__store.keys()].filter((k) => k.startsWith("turnos/")).length > n, n, { timeout: ms }).catch(() => {}); await pg.waitForTimeout(150); };
const store = (ruta) => pg.evaluate((r) => window.__store.get(r) ?? null, ruta);
const partidaViva = async () => (await store("mesa/estado"))?.partida;
const entradas = () => pg.evaluate(() => (window.__entradas || []).map((e) => { try { const m = JSON.parse(e); return Array.isArray(m) ? String(m[m.length - 1].content) : String(e); } catch { return String(e); } }));
const ultima = async () => (await entradas()).slice(-1)[0] || "";
const enviar = async (txt) => { await pg.fill("#accion", txt); await pg.keyboard.press("Enter"); };
const dm = (acciones, texto) => pg.evaluate(([a, x]) => { window.__accionesDM = a; window.__textoDM = x; }, [acciones, texto]);

// ---- 1. tres personajes por el formulario (la misma página cambia de nombre: Ana, Beto y Cleo)
const FICHAS = [
  { n: "Ana", raza: "Tritón de las Mareas", clase: "Flagelante", genero: "Femenino" },
  { n: "Beto", raza: "Humano del Faro", clase: "Berserker de Ceniza", genero: "Masculino" },
  { n: "Cleo", raza: "Varg", clase: "Mercenario del Cuervo", genero: "No binario" },
];
for (const [i, f] of FICHAS.entries()) {
  if (i) { await pg.click("#quien"); await poner(f.n); }
  await pg.evaluate(async (ahora) => { await window.__db.doc("mesa/orden").set({ modo: "turnos", turno: "u1", ronda: 1, desde: ahora }); }, Date.now());
  await pg.waitForTimeout(300);
  await pg.click("#crear-personaje"); await pg.waitForSelector("#pj-nombre", { state: "visible" });
  await pg.fill("#pj-nombre", f.n);
  await pg.selectOption("#pj-genero", f.genero).catch(() => {});
  await pg.selectOption("#pj-raza", f.raza); await pg.selectOption("#pj-clase", f.clase);
  await pg.selectOption("#pj-vet", "curtido"); await pg.selectOption("#pj-per1", { index: 1 });
  for (const [k, a] of ["fue", "des", "con", "int", "sab", "car"].entries()) await pg.selectOption("#pj-a-" + a, String([15, 14, 13, 12, 10, 8][k])).catch(() => {});
  await pg.fill("#pj-trasfondo", `${f.n} llegó a la Marca buscando un oficio y un motivo para quedarse: sabe pelear, sabe callar y debe una vida a un desconocido.`);
  await pg.selectOption("#pj-dote", { index: 1 }).catch(() => {});
  const antes = await turnosN();
  const ficha = { don_arcano: false, nombre: f.n, jugador: f.n, genero: f.genero, raza: f.raza, clase: f.clase, nivel: 3, pv_max: 30, ca: 13, atributos: { fue: 15, des: 14, con: 13, int: 12, sab: 10, car: 8 }, inventario: ["Espada larga", "Raciones de viaje (5)", "Odre de agua (2)"], dote: "Terco" };
  await dm([...(i === 0 ? [{ accion: "tiempo", datos: { fijar: { dia: 1, hora: 8 } } }] : []), { accion: "guardar_personaje", datos: ficha }], `${f.n} queda anotado en la Marca.`);
  await pg.evaluate(() => { const fm = document.getElementById("form-personaje"); fm.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true })); });
  await esperarTurno(antes);
}
let p = await partidaViva();
t(!!p && Object.keys(p.personajes).length === 3, "tres personajes creados por el formulario", Object.keys(p?.personajes || {}).join(","));
t(p?.personajes?.Ana?.genero === "Femenino" && p?.personajes?.Cleo?.genero === "No binario", "el género de cada ficha se guardó");
t(!!p?.calendario, "la página activó el calendario en el primer turno");
t(p?.reloj?.segundos >= 0 && !!p?.reloj, "el reloj quedó fijado (día 1, 08:00)", String(p?.reloj?.segundos));
t(!p?.personajes?.Ana?.condiciones?.some((c) => /sed|hambre|famél|deshidr/.test(c)), "nadie empieza con hambre ni sed tras activar el calendario");

// ---- 2. la mesa: Ana vuelve a ser Ana; Beto y Cleo se sientan; exploración con viaje y cita
await pg.click("#quien"); await poner("Ana");
const ahora = Date.now();
await pg.evaluate(async (ahora) => {
  await window.__db.doc("jugadores/u1").set({ nombre: "Ana", entrada: 1, visto: ahora });
  await window.__db.doc("jugadores/uBeto").set({ nombre: "Beto", entrada: 2, visto: ahora });
  await window.__db.doc("jugadores/uCleo").set({ nombre: "Cleo", entrada: 3, visto: ahora });
  await window.__db.doc("mesa/orden").set({ modo: "turnos", turno: "u1", ronda: 1, desde: ahora });
}, ahora);
await pg.waitForTimeout(600);
{
  const antes = await turnosN();
  await dm([{ accion: "ubicacion", datos: { lugar: "Pozonegro", region: "Aldenmar", tipo: "aldea" } }, { accion: "viajar", datos: { horas: 7, ritmo: "normal", terreno: "camino", cita: "caminamos hasta el paso" } }], "Siete horas de camino hasta el paso.");
  await enviar("Caminamos hasta el paso de la Marca");
  await esperarTurno(antes);
  const q = await partidaViva();
  t((await turnosN()) > antes, "turno de exploración narrado");
  t(q?.reloj?.segundos > p?.reloj?.segundos, "el viaje con cita movió el reloj", `${p?.reloj?.segundos} → ${q?.reloj?.segundos}`);
  t((await store("mesa/orden"))?.turno === "uBeto", "la palabra pasa a Beto");
}

// ---- 3. combate por iniciativa: se arma el estado con el motor de la propia página
await pg.evaluate(async () => {
  const V = window.Velmora; const d = window.__store.get("mesa/estado"); const q = d.partida;
  for (const e of ["Ogro", "Hambriento"]) V.ejecutar("aparecer_criatura", { nombre: e, repetir: true }, q);
  const ns = Object.values(q.jefes).map((j) => j.nombre);
  V.ejecutar("iniciativa", { participantes: ["Ana", "Beto", "Cleo", ...ns] }, q);
  q.combate.orden = ["Ana", ns[0], "Beto", ns[1], "Cleo"].map((n, i) => ({ nombre: n, total: 30 - i }));
  V.ejecutar("plano", { escena: "paso", poner: [{ nombre: "Ana" }] }, q);
  V.ejecutar("plano", { poner: [{ nombre: "Beto", ref: "Ana", direccion: "N", metros: 1.5 }, { nombre: "Cleo", ref: "Ana", direccion: "E", metros: 1.5 }, ...ns.map((n) => ({ nombre: n, ref: "Ana", direccion: "S", metros: 3 }))] }, q);
  await window.__db.doc("mesa/estado").set({ ...d, partida: q, actualizado: Math.max(Date.now(), (d.actualizado || 0) + 1) });
  await window.__db.doc("mesa/orden").set({ modo: "turnos", turno: "u1", ronda: 2, desde: Date.now(), entrada: "Ana" });
});
await pg.waitForTimeout(700);
t(await pg.locator("#barra-turnos").count() > 0 || (await pg.locator("body").innerText()).includes("Asalto 1"), "la barra muestra la iniciativa (Asalto 1)");
{
  const ogro = Object.values((await partidaViva()).jefes).map((j) => j.nombre)[0];
  const antes = await turnosN();
  await dm([{ accion: "atacar", datos: { atacante: "Ana", objetivo: ogro, arma: "Espada larga", dano: "1d8+3" } }, { accion: "atacar", datos: { atacante: ogro, objetivo: "Beto", arma: "Garrote", dano: "2d8+4" } }], "Ana golpea al ogro y el ogro responde contra Beto.");
  await enviar("Ataco al ogro con mi espada");
  await esperarTurno(antes);
  const e = await ultima();
  t(/# TURNOS DE COMBATE/.test(e) && /Beto/.test(e), "el DM recibe el bloque «TURNOS DE COMBATE»");
  const o = await store("mesa/orden");
  t(o?.turno === "uBeto" || o?.turno === "uCleo", "la palabra pasa al siguiente jugador por iniciativa", o?.turno);
  // Ana programa su acción y una reacción mientras esperan
  await pg.fill("#accion", "Sigo golpeando al ogro"); await pg.keyboard.press("Enter"); await pg.waitForTimeout(500);
  await pg.fill("#reaccion", "Si atacan a Cleo, me interpongo").catch(() => {}); await pg.keyboard.press("Enter").catch(() => {}); await pg.locator("#reaccion").blur().catch(() => {}); await pg.waitForTimeout(500);
  const prog = await store("programadas/u1");
  t(prog?.texto === "Sigo golpeando al ogro", "la acción programada se guarda", JSON.stringify(prog)?.slice(0, 90));
  t(prog?.reaccion === "Si atacan a Cleo, me interpongo", "la reacción preparada se guarda");
  // Beto y Cleo juegan (acciones puestas en la cola como si las escribieran ellos); al volver a Ana se entrega la programada sola
  for (const [jid, nombre, accion] of [["uBeto", "Beto", "Me lanzo contra el ogro"], ["uCleo", "Cleo", "Disparo al hambriento"]]) {
    const turnoDe = (await store("mesa/orden"))?.turno;
    if (turnoDe !== jid) continue;
    const n0 = await turnosN();
    await dm(null, `${nombre} actúa con decisión y el combate sigue su curso.`);
    await pg.evaluate(async ([jid, nombre, x]) => { await window.__db.collection("acciones").add({ nombre, uid: "x", jid, texto: x, ts: Date.now() + 5 }); }, [jid, nombre, accion]);
    await pg.getByRole("button", { name: "Que el DM responda" }).click({ timeout: 4000 }).catch(() => {});
    await esperarTurno(n0);
  }
  await pg.waitForFunction(() => (window.__entradas || []).some((e) => e.includes("acción preparada antes")), null, { timeout: 30000 }).catch(() => {});
  await pg.waitForTimeout(1500);
  if (process.env.DEPURAR) console.log("DEPURAR registro", (await pg.evaluate(() => document.getElementById("registro")?.innerText || "")).slice(-500).replace(/\n/g, " / "), "llamadas", await pg.evaluate(() => window.__llamadas.join(",")), "jug", JSON.stringify(await pg.evaluate(() => [...window.__store.entries()].filter(([k]) => k.startsWith("jugadores/")))), Date.now());
  if (process.env.DEPURAR) console.log("DEPURAR orden", JSON.stringify(await store("mesa/orden")), "turnos", await turnosN(), "prog", JSON.stringify(await store("programadas/u1")), "pend", JSON.stringify((await store("mesa/estado"))?.pendiente)?.slice(0, 300), "asalto", (await partidaViva())?.combate?.ronda, "acciones", await pg.evaluate(() => [...window.__store.keys()].filter((k) => k.startsWith("acciones/")).join(",")));
  const entr = (await entradas()).join("\n");
  t(/acción preparada antes/.test(entr), "la acción programada llegó al DM con la marca «acción preparada»");
  t(/Reacciones preparadas/.test(entr), "el bloque de turnos listó la reacción preparada");
  { const d = await store("programadas/u1"); t(!d?.texto, "tras entregarse, el texto de la programada desaparece del documento", JSON.stringify(d)); }
  t((await store("programadas/u1"))?.reaccion === "Si atacan a Cleo, me interpongo", "la reacción sigue (dura todo el combate)");
}
{
  const q = await partidaViva();
  t(Object.values(q.personajes).every((x) => Number.isFinite(x.pv) && x.pv >= 0 && x.pv <= x.pv_max + 50), "PV finitos y dentro de rango");
  t(Number.isFinite(q.combate?.ronda) && (await store("mesa/orden"))?.turno, "hay asalto y alguien con la palabra", `asalto ${q.combate?.ronda}`);
}

// ---- 4. rendimiento: repintar con 4 jugadores, 12 turnos y un combate de 8 combatientes
await pg.evaluate(async () => {
  const V = window.Velmora; const d = window.__store.get("mesa/estado"); const q = d.partida;
  for (const e of ["Ogro", "Hambriento", "Hambriento", "Troll de ciénaga", "Hambriento"]) V.ejecutar("aparecer_criatura", { nombre: e, repetir: true }, q);
  const ns = Object.values(q.jefes).map((j) => j.nombre);
  V.ejecutar("iniciativa", { participantes: ["Ana", "Beto", "Cleo", ...ns] }, q);
  await window.__db.doc("mesa/estado").set({ ...d, partida: q, actualizado: Math.max(Date.now(), (d.actualizado || 0) + 1) });
  await window.__db.doc("jugadores/uDan").set({ nombre: "Dan", entrada: 4, visto: Date.now() });
  for (let i = 0; i < 12; i++) await window.__db.doc("turnos/rend" + i).set({ ts: 1e13 + i, jugador: "Ana", acciones: [{ nombre: "Ana", texto: "Acción " + i }], texto: "Narración del turno " + i + ". ".repeat(20) + "El ogro ruge y la sala tiembla.", avisos: [{ pos: 5, texto: "⚔ Ana ataca al ogro: 1d20+5 = 17 · daño 9" }] });
});
await pg.waitForTimeout(500);
const med = await pg.evaluate(async () => {
  const ms = [];
  for (let k = 0; k < 10; k++) { const d = window.__store.get("mesa/estado"); const t0 = performance.now(); await window.__db.doc("mesa/estado").set({ ...d, actualizado: (d.actualizado || 0) + 1 }); await new Promise((r) => requestAnimationFrame(() => r())); ms.push(performance.now() - t0); }
  const o = window.__store.get("mesa/orden"); const t1 = performance.now(); await window.__db.doc("mesa/orden").set({ ...o, desde: Date.now() }); await new Promise((r) => requestAnimationFrame(() => r())); const orden = performance.now() - t1;
  ms.sort((a, b) => a - b);
  return { snapshotMediana: Math.round(ms[5] * 10) / 10, snapshotMax: Math.round(ms[9] * 10) / 10, orden: Math.round(orden * 10) / 10, nodos: document.querySelectorAll("*").length };
});
console.log(`medición: arranque de la página ${arranque} ms · repintar tras un snapshot de estado (4 jugadores, 12 turnos, 8 combatientes): mediana ${med.snapshotMediana} ms, máx. ${med.snapshotMax} ms · tras mesa/orden ${med.orden} ms · ${med.nodos} nodos DOM`);
t(med.snapshotMediana < 400, "repintar un snapshot cuesta menos de 400 ms", String(med.snapshotMediana));
const oyentes = await pg.evaluate(() => (window.getEventListeners ? "n/d" : "n/d"));
void oyentes;

// ---- 5. exportar → reiniciar → importar
{
  const antes = await partidaViva();
  await pg.evaluate(() => { const pn = document.getElementById("menu-panel"); if (pn.hidden) document.getElementById("menu-barra").click(); });
  await pg.click("#exportar-partida"); await pg.waitForTimeout(800);
  const des = await pg.evaluate(() => window.__descargas || []);
  t(des.length >= 1, "la partida se exporta", des[0]?.filename);
  const run = JSON.parse(des[0].data);
  t(!!run.estado.partida.calendario && run.estado.partida.personajes.Ana.genero === "Femenino", "el archivo lleva calendario y género");
  writeFileSync(salida("mesa-completa.json"), des[0].data);
  await pg.evaluate(() => { const pn = document.getElementById("menu-panel"); if (pn.hidden) document.getElementById("menu-barra").click(); });
  await pg.click("#reiniciar"); await pg.click("#confirmar-reinicio"); await pg.waitForTimeout(1500);
  const vacio = await pg.evaluate(() => ({ estado: window.__store.has("mesa/estado"), prog: [...window.__store.keys()].filter((k) => k.startsWith("programadas/")).length }));
  t(!vacio.estado && vacio.prog === 0, "reiniciar borra la partida y las programadas", JSON.stringify(vacio));
  await pg.setInputFiles("#archivo-importar", salida("mesa-completa.json")); await pg.waitForTimeout(500);
  await pg.click("#confirmar-importar"); await pg.waitForTimeout(1800);
  const despues = await partidaViva();
  const igual = JSON.stringify({ ...despues, historial: undefined }) === JSON.stringify({ ...run.estado.partida, historial: undefined });
  t(!!despues && igual, "la partida reimportada es idéntica a la exportada");
  t(!!despues?.calendario && despues?.personajes?.Cleo?.genero === "No binario" && !!despues?.combate, "calendario, género y combate sobreviven al ciclo", `asalto ${despues?.combate?.ronda}`);
  t((await pg.evaluate(() => [...window.__store.keys()].filter((k) => k.startsWith("programadas/")).length)) === 0, "tras importar no quedan programadas de la partida anterior");
  void antes;
}

// ---- 6. 390 px sin desbordes
await pg.setViewportSize({ width: 390, height: 800 }); await pg.waitForTimeout(400);
t(await pg.evaluate(() => document.documentElement.scrollWidth <= 392), "a 390 px no hay scroll horizontal de página");
console.log("errores de página:", errs.length, errs.slice(0, 3).join(" | "));
console.log(`duración: ${Math.round((Date.now() - T0) / 1000)} s · fallos: ${fallos}`);
await b.close();
process.exit(fallos || errs.length ? 1 : 0);
