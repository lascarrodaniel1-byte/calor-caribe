// Acciones programadas y reacciones preparadas: fuera de turno el botón dice «Programar para mi turno», la acción queda en una ficha (sin llamar al DM)
// y se envía sola, con la marca «acción preparada», cuando llega la palabra; Editar/Cancelar/sustituir, entrega con el jugador desconectado,
// sin duplicados (enviar con una programada, corregir al DM), modo libre sin botón, reacción preparada en el bloque de combate, caducidad,
// título de la pestaña, cuenta atrás y 390 px sin desbordes.
import { lanzar, fixture, MOCK, salida, paginaDe } from "./_comun.mjs";
import { readFileSync } from "node:fs";
const S = await paginaDe();
const partida = JSON.parse(readFileSync(fixture("partida-mesa.json"), "utf8"));
const b = await lanzar();
const errs = [];
let fallos = 0;
const t = (c, m) => { console.log(c ? "ok  " : "FALLA", m); if (!c) fallos++; };

/**
 * Abre la página como `yo` (id u1). `otros`: [{id, nombre, entrada, visto?}]; `turno`: id de a quién le toca;
 * `combate`: enemigos (con Aldo de Ana, Ogro…, Bruna de Beto); `progs`: documentos de «programadas».
 */
async function montar({ yo = "Beto", otros = [{ id: "uAna", nombre: "Ana", entrada: 1 }], turno = "uAna", modo = "turnos", combate = null, progs = {}, ancho = 1280, alto = 860, ronda = 1 } = {}) {
  const pg = await b.newPage({ viewport: { width: ancho, height: alto } });
  pg.on("pageerror", (e) => errs.push(e.message));
  await pg.addInitScript({ path: MOCK });
  await pg.goto("file://" + S + "/mesa-de-velmora.html"); await pg.waitForTimeout(800);
  await pg.click("#form-tutorial button[type=submit]").catch(() => {}); await pg.fill("#nombre", yo); await pg.click("#form-nombre button"); await pg.waitForTimeout(500);
  const ahora = Date.now();
  const nombres = await pg.evaluate(async ([p, ahora, otros, turno, modo, combate, progs, ronda]) => {
    const V = window.Velmora;
    let ns = [];
    if (combate) {
      for (const e of combate) V.ejecutar("aparecer_criatura", { nombre: e, repetir: true }, p);
      ns = Object.values(p.jefes).map((j) => j.nombre);
      V.ejecutar("iniciativa", { participantes: ["Aldo", "Bruna", ...ns] }, p);
      p.combate.orden = ["Aldo", ...ns, "Bruna"].map((n, i) => ({ nombre: n, total: 30 - i }));
    }
    await window.__db.doc("mesa/estado").set({ partida: p, cronica: "", actualizado: ahora });
    for (const o of otros) await window.__db.doc("jugadores/" + o.id).set({ nombre: o.nombre, entrada: o.entrada, visto: o.visto === undefined ? ahora : o.visto });
    await window.__db.doc("mesa/orden").set({ modo, turno, ronda, desde: ahora });
    for (const [id, d] of Object.entries(progs)) await window.__db.doc("programadas/" + id).set(d);
    return ns;
  }, [partida, ahora, otros, turno, modo, combate, progs, ronda]);
  await pg.waitForTimeout(1500);
  return { pg, nombres };
}
const store = (pg, ruta) => pg.evaluate((r) => window.__store.get(r) ?? null, ruta);
const claves = (pg, pref) => pg.evaluate((p) => [...window.__store.keys()].filter((k) => k.startsWith(p)), pref);
// Lo que recibe el DM en cada llamada: el último mensaje de la entrada (el estado, los bloques de turnos y las acciones nuevas).
const entradas = (pg) => pg.evaluate(() => (window.__entradas || []).map((e) => { try { const m = JSON.parse(e); return Array.isArray(m) ? String(m[m.length - 1].content) : String(e); } catch { return String(e); } }));
const ultimaEntrada = async (pg) => (await entradas(pg)).slice(-1)[0] || "";
const texto = (pg, sel) => pg.evaluate((s) => document.querySelector(s)?.innerText.replace(/\s+/g, " ").trim() ?? "", sel);
const visible = (pg, sel) => pg.evaluate((s) => { const e = document.querySelector(s); return !!e && !e.hidden && e.offsetParent !== null; }, sel);
const accionDe = async (pg, jid, nombre, x) => pg.evaluate(async ([jid, nombre, x]) => { await window.__db.collection("acciones").add({ nombre, uid: "x", jid, texto: x, ts: Date.now() + 5 }); }, [jid, nombre, x]);
const narrar = async (pg) => { await pg.getByRole("button", { name: "Que el DM responda" }).click({ timeout: 5000 }).catch(() => {}); };
async function programar(pg, x) { await pg.fill("#accion", x); await pg.keyboard.press("Enter"); await pg.waitForTimeout(400); }

// ---- 1. fuera de turno: programar, editar, cancelar, sustituir, comandos
{
  const { pg } = await montar();
  t((await texto(pg, "#enviar")) === "Programar para mi turno", "fuera de turno el botón dice «Programar para mi turno»");
  t((await pg.getAttribute("#accion", "placeholder")) === "Escribe tu acción: se enviará sola cuando te toque", "el placeholder invita a escribir y avisa de que se enviará sola");
  t(!(await pg.isDisabled("#enviar")), "el botón está activo");
  await pg.evaluate(() => { window.__llamadas = []; });
  await programar(pg, "Sigo a Ana y vigilo la puerta");
  t((await pg.inputValue("#accion")) === "", "al programar, el texto sale de la caja");
  t(await visible(pg, "#ficha-programada") && /⏳ Programada: «Sigo a Ana y vigilo la puerta»/.test(await texto(pg, "#ficha-programada")), "aparece la ficha «⏳ Programada: «…»»");
  const d = await store(pg, "programadas/u1");
  t(d?.texto === "Sigo a Ana y vigilo la puerta" && d.jid === "u1" && d.nombre === "Beto" && d.ronda === 1 && !("asalto" in d), "se guarda en programadas/<id> con texto, ronda y nombre");
  t((await pg.evaluate(() => window.__llamadas.length)) === 0 && (await claves(pg, "acciones/")).length === 0, "NO se llama al DM ni se encola nada");

  // una nueva sustituye a la anterior
  await programar(pg, "Mejor: registro el cuarto");
  t(/registro el cuarto/.test(await texto(pg, "#ficha-programada")) && (await store(pg, "programadas/u1")).texto === "Mejor: registro el cuarto" && (await claves(pg, "programadas/")).length === 1, "programar de nuevo sustituye a la anterior (una sola por jugador)");

  // Editar la devuelve a la caja
  await pg.click("#editar-programada"); await pg.waitForTimeout(400);
  t((await pg.inputValue("#accion")) === "Mejor: registro el cuarto" && !(await visible(pg, "#ficha-programada")) && (await store(pg, "programadas/u1")) === null, "Editar devuelve el texto a la caja y quita la programada");
  // Editar con la caja ocupada no pisa nada
  await programar(pg, "Otra"); await pg.fill("#accion", "algo a medias"); await pg.click("#editar-programada"); await pg.waitForTimeout(300);
  t((await pg.inputValue("#accion")) === "algo a medias" && (await store(pg, "programadas/u1"))?.texto === "Otra", "Editar con la caja ocupada no pisa lo escrito");
  // Cancelar
  await pg.fill("#accion", ""); await pg.click("#cancelar-programada"); await pg.waitForTimeout(400);
  t(!(await visible(pg, "#ficha-programada")) && (await store(pg, "programadas/u1")) === null && !(await visible(pg, "#programada-caja")), "Cancelar quita la ficha y el documento");
  // vacío y comandos
  await pg.fill("#accion", "   "); await pg.keyboard.press("Enter"); await pg.waitForTimeout(300);
  t((await store(pg, "programadas/u1")) === null, "un texto vacío no se programa");
  await pg.fill("#accion", "/ayuda"); await pg.keyboard.press("Enter"); await pg.waitForTimeout(400);
  t((await store(pg, "programadas/u1")) === null && /Comandos:/.test(await pg.evaluate(() => document.body.innerText)), "los comandos no se programan: se ejecutan como siempre");
  await pg.close();
}

// ---- 2. la palabra pasa a Beto: su acción se encola sola con la marca y el DM la recibe; sin duplicados
{
  const { pg } = await montar();
  await programar(pg, "Abro la puerta con cuidado");
  await pg.evaluate(() => { window.__textoDM = "El Aldo de Ana avanza."; window.__entradas = []; });
  await accionDe(pg, "uAna", "Ana", "Avanzo por el pasillo");
  await narrar(pg);
  await pg.waitForFunction(() => [...window.__store.keys()].filter((k) => k.startsWith("turnos/")).length >= 2, null, { timeout: 25000 }).catch(() => {});
  await pg.waitForTimeout(800);
  const es = await entradas(pg);
  t(es.length === 2 && /ACCIONES NUEVAS\nAna: Avanzo por el pasillo/.test(es[0]), "el DM recibe primero la acción de Ana (sin marca)");
  t(/ACCIONES NUEVAS\nBeto \(acción preparada antes, de cuando aún no era su turno\): Abro la puerta con cuidado/.test(es[1] || ""), "y la de Beto con la marca «acción preparada antes»");
  t(/Una acción preparada es una intención de antes: si la situación ha cambiado y ya no es posible o no tiene sentido, no la ejecutes/.test(es[1] || "") && !/intención de antes/.test(es[0] || ""), "el bloque de turnos de esa acción lleva la regla (y el de Ana no)");
  t((await claves(pg, "acciones/")).length === 0 && (await store(pg, "programadas/u1")) === null, "sin duplicados: cola vacía y la programada borrada");
  const ts = (await claves(pg, "turnos/")).map((k) => k);
  t(ts.length === 2, "se narraron exactamente dos turnos");
  const o = await store(pg, "mesa/orden");
  t(o.turno === "uAna", "tras la acción de Beto la palabra vuelve a Ana", o.turno);
  t(!(await visible(pg, "#ficha-programada")), "la ficha desaparece");

  // 3. corregir al DM (la última respuesta es la de Beto, que venía de una programada): no se pierde ni se duplica
  await pg.evaluate(() => { window.__textoDM = "Esta vez la puerta chirría."; window.__entradas = []; });
  await pg.fill("#accion", "/corregir la puerta no chirría"); await pg.keyboard.press("Enter"); await pg.waitForTimeout(600);
  const abierto = await pg.evaluate(() => !document.getElementById("velo-corregir").hidden);
  if (abierto) {
    await pg.fill("#texto-correccion", "La puerta no chirría"); await pg.click("#confirmar-corregir");
    await pg.waitForFunction(() => (window.__entradas || []).length >= 1, null, { timeout: 25000 }).catch(() => {});
    await pg.waitForTimeout(1200);
  }
  const ec = await entradas(pg);
  t(abierto && ec.length === 1 && (ec[0].match(/acción preparada antes/g) || []).length === 1 && /CORRECCIÓN DE LOS JUGADORES/.test(ec[0]), "corregir al DM repite la acción de Beto (con su marca) una sola vez");
  t((await claves(pg, "acciones/")).length === 0 && (await store(pg, "programadas/u1")) === null && (await claves(pg, "turnos/")).length === 2, "tras corregir: ni acciones duplicadas, ni programada resucitada, ni turnos de más");
  await pg.close();
}

// ---- 4. jugador desconectado con una programada: su turno no se salta y se ejecuta
{
  const ahora = Date.now();
  const { pg } = await montar({
    yo: "Ana", turno: "u1",
    otros: [{ id: "uBeto", nombre: "Beto", entrada: ahora + 5000, visto: 0 }, { id: "uCris", nombre: "Cris", entrada: ahora + 6000 }],
    progs: { uBeto: { nombre: "Beto", jid: "uBeto", texto: "Disparo mi arco al vigía", ts: ahora - 5000, ronda: 1 } },
  });
  await pg.evaluate(() => { window.__textoDM = "Narración del turno, lo bastante larga."; window.__entradas = []; });
  t(!(await visible(pg, "#saltar-turno")), "sin turno de Beto, no hay botón de saltar");
  await pg.fill("#accion", "Empujo la roca"); await pg.keyboard.press("Enter");
  await pg.waitForFunction(() => [...window.__store.keys()].filter((k) => k.startsWith("turnos/")).length >= 2, null, { timeout: 25000 }).catch(() => {});
  await pg.waitForTimeout(800);
  const es = await entradas(pg);
  t(es.length === 2 && /Beto \(acción preparada antes, de cuando aún no era su turno\): Disparo mi arco al vigía/.test(es[1] || ""), "Beto está desconectado pero recibe la palabra y su acción preparada se ejecuta", String(es.length));
  const o = await store(pg, "mesa/orden");
  t(o.turno === "uCris", "después de Beto la palabra pasa a Cris", o.turno);
  t((await store(pg, "programadas/uBeto")) === null && (await claves(pg, "acciones/")).length === 0, "la programada se borra y no queda nada en la cola");
  await pg.close();
}

// ---- 5. enviar con la programada pendiente: una sola acción, la que escribo ahora; si ya está en cola, avisa y no duplica
{
  const ahora = Date.now();
  const { pg } = await montar({ turno: "u1", progs: { u1: { nombre: "Beto", jid: "u1", texto: "Plan viejo", ts: ahora, ronda: 1 } } });
  await pg.evaluate(() => { window.__textoDM = "Narración del turno, lo bastante larga."; window.__entradas = []; });
  t((await texto(pg, "#enviar")) === "Enviar", "con su turno el botón dice «Enviar»");
  await pg.fill("#accion", "Plan nuevo"); await pg.keyboard.press("Enter");
  await pg.waitForFunction(() => (window.__entradas || []).length >= 1, null, { timeout: 25000 }).catch(() => {});
  await pg.waitForTimeout(700);
  const es = await entradas(pg);
  t(es.length === 1 && /Beto: Plan nuevo/.test(es[0]) && !/Plan viejo/.test(es[0]), "se envía una sola acción: la nueva sustituye a la programada");
  t((await store(pg, "programadas/u1")) === null && /sustituido por esta/.test(await pg.evaluate(() => document.body.innerText)), "la programada se borra y se avisa de la sustitución");
  await pg.close();

  const m = await montar({ turno: "u1" });
  await m.pg.evaluate(async () => { await window.__db.doc("acciones/prog_u1_1").set({ nombre: "Beto", uid: "", jid: "u1", texto: "Ya en cola", ts: Date.now() + 100000, programada: true }); });
  await m.pg.waitForTimeout(500);
  await m.pg.evaluate(() => { window.__colgarDM = true; });
  await m.pg.fill("#accion", "Otra más"); await m.pg.keyboard.press("Enter"); await m.pg.waitForTimeout(500);
  t((await claves(m.pg, "acciones/")).length === 1 && (await m.pg.inputValue("#accion")) === "Otra más" && /ya está en cola/.test(await m.pg.evaluate(() => document.body.innerText)), "si la programada ya está en la cola, no se envía otra: se avisa y el texto se conserva");
  await m.pg.close();
}

// ---- 6. entrega tardía: el turno ya es suyo y la programada sigue ahí (el guardado de otro se cortó): su propia página la entrega, una sola vez
{
  const ahora = Date.now();
  const { pg } = await montar({ turno: "u1", progs: { u1: { nombre: "Beto", jid: "u1", texto: "Aprovecho el hueco", ts: ahora, ronda: 1 } } });
  await pg.evaluate(() => { window.__textoDM = "Narración del turno, lo bastante larga."; window.__entradas = []; });
  await pg.waitForFunction(() => (window.__entradas || []).length >= 1, null, { timeout: 30000 }).catch(() => {});
  await pg.waitForTimeout(800);
  const es = await entradas(pg);
  t(es.length === 1 && /Beto \(acción preparada antes/.test(es[0]) && /Aprovecho el hueco/.test(es[0]), "si le toca y la programada sigue ahí, su página la entrega sola");
  t((await claves(pg, "acciones/")).length === 0 && (await store(pg, "programadas/u1")) === null && (await entradas(pg)).length === 1, "sin duplicados");
  await pg.close();
}

// ---- 7. modo libre y jugador solo: sin botón de programar
{
  const { pg } = await montar({ modo: "libre" });
  t((await texto(pg, "#enviar")) === "Enviar" && (await pg.getAttribute("#accion", "placeholder")) === "¿Qué haces?" && !(await visible(pg, "#programada-caja")), "en modo libre no hay botón de programar");
  await pg.close();
  const s = await montar({ otros: [] });
  t((await texto(s.pg, "#enviar")) === "Enviar" && !(await visible(s.pg, "#programada-caja")), "un jugador solo (sin turnos) tampoco");
  await s.pg.close();
}

// ---- 8. caducidad
{
  const ahora = Date.now();
  const { pg } = await montar({ ronda: 6, progs: { u1: { nombre: "Beto", jid: "u1", texto: "Algo viejo", ts: ahora, ronda: 1 } } });
  await pg.waitForTimeout(800);
  t((await store(pg, "programadas/u1")) === null && /Tu acción programada caducó/.test(await pg.evaluate(() => document.body.innerText)), "pasadas más de 2 rondas la programada caduca, se borra y se avisa");
  await pg.close();
  const c = await montar({ progs: { u1: { nombre: "Beto", jid: "u1", texto: "Programada en un combate que ya acabó", ts: ahora, ronda: 1, asalto: 2 } } });
  await c.pg.waitForTimeout(800);
  t((await store(c.pg, "programadas/u1")) === null && /Tu acción programada caducó/.test(await c.pg.evaluate(() => document.body.innerText)), "si el combate acaba, caduca");
  await c.pg.close();
  const v = await montar({ ronda: 3, progs: { u1: { nombre: "Beto", jid: "u1", texto: "Aún vale", ts: ahora, ronda: 1 } } });
  await v.pg.waitForTimeout(600);
  t((await store(v.pg, "programadas/u1"))?.texto === "Aún vale", "dentro de las 2 rondas sigue vigente");
  await v.pg.close();
  // personaje caído: se descarta y ese turno lo resuelve el DM
  const caido = JSON.parse(JSON.stringify(partida)); caido.personajes.Bruna.pv = 0;
  const m = await montar({ yo: "Ana", turno: "u1", otros: [{ id: "uBeto", nombre: "Beto", entrada: Date.now() + 5000 }, { id: "uCris", nombre: "Cris", entrada: Date.now() + 6000 }], progs: { uBeto: { nombre: "Beto", jid: "uBeto", texto: "Me levanto y ataco", ts: ahora, ronda: 1 } } });
  await m.pg.evaluate(async (p) => { await window.__db.doc("mesa/estado").set({ partida: p, cronica: "", actualizado: Date.now() + 10 }); }, caido);
  await m.pg.waitForTimeout(800);
  await m.pg.evaluate(() => { window.__textoDM = "Narración del turno, lo bastante larga."; window.__entradas = []; });
  await m.pg.fill("#accion", "Avanzo"); await m.pg.keyboard.press("Enter");
  await m.pg.waitForFunction(() => [...window.__store.keys()].filter((k) => k.startsWith("turnos/")).length >= 1, null, { timeout: 25000 }).catch(() => {});
  await m.pg.waitForTimeout(1200);
  t((await entradas(m.pg)).length === 1 && !/Me levanto/.test(await ultimaEntrada(m.pg)) && (await store(m.pg, "programadas/uBeto")) === null && (await claves(m.pg, "acciones/")).length === 0, "si su personaje está caído (0 PV) la programada se descarta y no se ejecuta");
  await m.pg.close();
}

// ---- 9. combate: reacción preparada en el bloque del DM (persistente, solo con la reacción libre)
{
  const { pg, nombres } = await montar({ combate: ["Ogro"] });
  t(await visible(pg, "#reaccion"), "en combate aparece el campo «Reacción preparada (si…)»");
  await pg.fill("#reaccion", "Si el ogro me ataca, me cubro con el escudo"); await pg.keyboard.press("Enter"); await pg.waitForTimeout(500);
  const d = await store(pg, "programadas/u1");
  t(d?.reaccion === "Si el ogro me ataca, me cubro con el escudo" && d.texto === "" && d.reaccionAsalto === 1, "la reacción se guarda en la misma programada");
  t(!(await visible(pg, "#ficha-programada")), "una reacción sola no muestra la ficha de acción programada");
  // el DM la recibe al narrar el turno de Ana; la acción de Beto programada se envía y la reacción persiste
  await programar(pg, "Hostigo al ogro con mi daga");
  const dd = await store(pg, "programadas/u1");
  t(dd.texto === "Hostigo al ogro con mi daga" && dd.asalto === 1 && dd.reaccion, "programar la acción conserva la reacción y anota el asalto");
  await pg.evaluate(() => { window.__textoDM = "Aldo ataca al ogro con toda su fuerza."; window.__entradas = []; });
  await accionDe(pg, "uAna", "Ana", "Ataco al ogro");
  await narrar(pg);
  await pg.waitForFunction(() => (window.__entradas || []).length >= 2, null, { timeout: 25000 }).catch(() => {});
  await pg.waitForTimeout(800);
  const es = await entradas(pg);
  t(/Reacciones preparadas: Beto: «Si el ogro me ataca, me cubro con el escudo»\./.test(es[0] || "") && /reacción preparada de un jugador cuya reacción no se haya gastado/.test(es[0] || ""), "el bloque de combate incluye «Reacciones preparadas» y la regla");
  t(/Beto \(acción preparada antes/.test(es[1] || "") && /Hostigo al ogro/.test(es[1] || ""), "la acción programada de Beto se envía en su turno");
  const r = await store(pg, "programadas/u1");
  t(r?.reaccion === "Si el ogro me ataca, me cubro con el escudo" && r.texto === "", "la reacción NO se consume al enviar la acción: sigue guardada", JSON.stringify(r));
  // reacción gastada: no aparece
  await pg.evaluate(async () => { const e = window.__store.get("mesa/estado"); e.partida.combate.turnos = { ...(e.partida.combate.turnos || {}), Bruna: { reaccion: true } }; await window.__db.doc("mesa/estado").set({ ...e, actualizado: Date.now() + 500 }); });
  await pg.waitForTimeout(800);
  await pg.evaluate(() => { window.__entradas = []; });
  await accionDe(pg, "uAna", "Ana", "Vuelvo a atacar");
  await narrar(pg);
  await pg.waitForFunction(() => (window.__entradas || []).length >= 1, null, { timeout: 25000 }).catch(() => {});
  await pg.waitForTimeout(500);
  t(!/Reacciones preparadas/.test((await entradas(pg))[0] || ""), "con la reacción ya gastada este asalto no se menciona");
  // quitarla
  await pg.fill("#reaccion", ""); await pg.keyboard.press("Enter"); await pg.waitForTimeout(500);
  t((await store(pg, "programadas/u1"))?.reaccion === undefined, "el jugador puede quitar la reacción");
  void nombres;
  await pg.close();
  // fin del combate: la reacción caduca
  const f = await montar({ combate: ["Ogro"], progs: { u1: { nombre: "Beto", jid: "u1", texto: "", ts: Date.now(), ronda: 1, reaccion: "Me cubro", reaccionAsalto: 1 } } });
  await f.pg.evaluate(async () => { const e = window.__store.get("mesa/estado"); delete e.partida.combate; await window.__db.doc("mesa/estado").set({ ...e, actualizado: Date.now() + 1000 }); });
  await f.pg.waitForTimeout(1500);
  t((await store(f.pg, "programadas/u1")) === null, "al acabar el combate la reacción preparada se borra");
  await f.pg.close();
}

// ---- 10. título de la pestaña y cuenta atrás
{
  const ahora = Date.now();
  const { pg } = await montar({ turno: "uCris", otros: [{ id: "uAna", nombre: "Ana", entrada: 1 }, { id: "uCris", nombre: "Cris", entrada: ahora + 5000 }] });
  t(/Faltan 2 turnos para ti/.test(await texto(pg, "#aviso-turno")), "cuenta atrás: «Faltan 2 turnos para ti»");
  await pg.evaluate(async () => { await window.__db.doc("mesa/orden").update({ turno: "uAna", desde: Date.now() }); });
  await pg.waitForTimeout(500);
  t(/Eres el siguiente tras Ana/.test(await texto(pg, "#aviso-turno")), "cuenta atrás: «Eres el siguiente tras Ana»");
  // pestaña en segundo plano
  await pg.evaluate(() => { Object.defineProperty(document, "hidden", { get: () => true, configurable: true }); document.dispatchEvent(new Event("visibilitychange")); });
  const base = await pg.title();
  await pg.evaluate(async () => { await window.__db.doc("mesa/orden").update({ turno: "u1", desde: Date.now() }); });
  await pg.waitForTimeout(500);
  t((await pg.title()) === "⚔ ¡Tu turno! — Mesa de Velmora", "al llegarle el turno con la pestaña en segundo plano el título avisa");
  t(!/Faltan|siguiente tras/.test(await texto(pg, "#aviso-turno")), "con su turno no hay cuenta atrás");
  await pg.waitForTimeout(2300);
  t((await pg.title()) === base, "parpadea suave: a los 2 s vuelve al título normal");
  await pg.waitForTimeout(2000);
  t((await pg.title()) === "⚔ ¡Tu turno! — Mesa de Velmora", "y a los 2 s siguientes vuelve a avisar");
  await pg.evaluate(() => { Object.defineProperty(document, "hidden", { get: () => false, configurable: true }); document.dispatchEvent(new Event("visibilitychange")); });
  await pg.waitForTimeout(300);
  t((await pg.title()) === base, "al volver a la pestaña se detiene y queda el título normal");
  await pg.close();
  // enviar detiene el aviso
  const e = await montar({ turno: "uAna" });
  await e.pg.evaluate(() => { Object.defineProperty(document, "hidden", { get: () => true, configurable: true }); document.dispatchEvent(new Event("visibilitychange")); window.__colgarDM = true; });
  await e.pg.evaluate(async () => { await window.__db.doc("mesa/orden").update({ turno: "u1", desde: Date.now() }); });
  await e.pg.waitForTimeout(400);
  const avisando = (await e.pg.title()) === "⚔ ¡Tu turno! — Mesa de Velmora";
  await e.pg.fill("#accion", "Hago algo"); await e.pg.keyboard.press("Enter"); await e.pg.waitForTimeout(500);
  t(avisando && (await e.pg.title()) === base, "al enviar la acción el título vuelve al normal");
  await e.pg.close();
  // en combate cuenta también los turnos del DM
  const c = await montar({ combate: ["Ogro"], turno: "uAna" });
  t(/Faltan 2 turnos para ti/.test(await texto(c.pg, "#aviso-turno")), "en combate la cuenta atrás incluye los turnos del DM (Aldo, Ogro, Bruna: faltan 2)");
  await c.pg.close();
}

// ---- 11. móvil (390 px): ficha larga + reacción en combate, sin desbordes
{
  const { pg } = await montar({ ancho: 390, alto: 844, combate: ["Ogro"] });
  await pg.fill("#reaccion", "Si el ogro me ataca, me cubro con el escudo y retrocedo un paso"); await pg.keyboard.press("Enter"); await pg.waitForTimeout(400);
  const pieAntes = await pg.evaluate(() => Math.round(document.querySelector(".redaccion").getBoundingClientRect().height));
  await programar(pg, "Aprovecho que el ogro está distraído con Ana para rodearlo por la izquierda, saltar sobre el barril y clavarle la daga entre las costillas mientras grito para que los demás sepan dónde estoy");
  const r = await pg.evaluate(() => {
    const f = document.getElementById("ficha-programada"), c = document.querySelector(".redaccion .columna"), form = document.getElementById("form-accion"), bt = document.getElementById("enviar");
    const caja = document.getElementById("programada-caja").getBoundingClientRect();
    return { pagina: document.documentElement.scrollWidth, vw: innerWidth, ficha: f.scrollWidth <= f.clientWidth + 1 || getComputedStyle(f.querySelector(".texto-programada")).textOverflow === "ellipsis", colDesborda: c.scrollWidth > c.clientWidth + 1, formDesborda: form.scrollWidth > form.clientWidth + 1, boton: bt.textContent, btnW: Math.round(bt.getBoundingClientRect().width), pie: Math.round(document.querySelector(".redaccion").getBoundingClientRect().height), cajaH: Math.round(caja.height), botonesVisibles: ["editar-programada", "cancelar-programada"].every((id) => { const x = document.getElementById(id).getBoundingClientRect(); return x.right <= innerWidth && x.width > 0; }) };
  });
  console.log("   390 px:", JSON.stringify(r));
  t(r.pagina <= r.vw && !r.colDesborda && !r.formDesborda && r.ficha && r.botonesVisibles, "a 390 px sin desbordes: página, pie, formulario y botones Editar/Cancelar visibles");
  t(r.boton === "Programar para mi turno" && r.pie - pieAntes < 60 && r.pie < 380, `el botón entra en el pie y la ficha solo añade una línea (pie ${pieAntes} → ${r.pie} px de alto)`);
  await pg.screenshot({ path: salida("programada-movil.png") });
  await pg.close();
  const e = await montar({ ancho: 1280, alto: 860, combate: ["Ogro"] });
  await programar(e.pg, "Rodeo al ogro por la izquierda");
  await e.pg.screenshot({ path: salida("programada-escritorio.png") });
  const w = await e.pg.evaluate(() => ({ pagina: document.documentElement.scrollWidth, vw: innerWidth }));
  t(w.pagina <= w.vw, "escritorio sin scroll horizontal");
  await e.pg.close();
}

console.log("capturas en:", salida("").replace(/\/$/, ""));
console.log("fallos:", fallos);
console.log("errores de página:", errs.length, errs.slice(0, 3).map((x) => x.slice(0, 160)).join(" | "));
await b.close();
if (fallos) process.exitCode = 1;
