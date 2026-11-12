// Combate con la mesa por turnos: la barra muestra la iniciativa con el enemigo intercalado, el DM recibe el bloque «TURNOS DE COMBATE»,
// la palabra pasa al jugador correcto y el asalto avanza una sola vez al cerrarse la ronda. Revisa también 390 px (sin desbordes).
import { lanzar, fixture, MOCK, salida, paginaDe } from "./_comun.mjs";
import { readFileSync } from "node:fs";
const S = await paginaDe();
const partida = JSON.parse(readFileSync(fixture("partida-mesa.json"), "utf8"));
const b = await lanzar();
const errs = [];

/** Abre la página como Ana, con Beto conectado y un combate Aldo (Ana) → enemigos → Bruna (Beto). */
async function montar(ancho, alto, enemigos = ["Ogro"], extra = {}) {
  const pg = await b.newPage({ viewport: { width: ancho, height: alto } });
  pg.on("pageerror", (e) => errs.push(e.message));
  await pg.addInitScript({ path: MOCK });
  await pg.goto("file://" + S + "/mesa-de-velmora.html"); await pg.waitForTimeout(800);
  await pg.click("#form-tutorial button[type=submit]").catch(() => {}); await pg.fill("#nombre", "Ana"); await pg.click("#form-nombre button"); await pg.waitForTimeout(500);
  const t = Date.now();
  const nombres = await pg.evaluate(async ([p, t, enemigos, sinCombate]) => {
    const V = window.Velmora;
    for (const e of enemigos) V.ejecutar("aparecer_criatura", { nombre: e, repetir: true }, p);
    const ns = Object.values(p.jefes).map((j) => j.nombre);
    if (!sinCombate) {
      V.ejecutar("iniciativa", { participantes: ["Aldo", "Bruna", ...ns] }, p);
      // Orden fijo: Aldo, la mitad de los enemigos, Bruna y el resto.
      const mitad = Math.ceil(ns.length / 2);
      p.combate.orden = ["Aldo", ...ns.slice(0, mitad), "Bruna", ...ns.slice(mitad)].map((n, i) => ({ nombre: n, total: 30 - i }));
    }
    await window.__db.doc("mesa/estado").set({ partida: p, cronica: "", actualizado: t });
    await window.__db.doc("jugadores/uBeto").set({ nombre: "Beto", entrada: 2, visto: t });
    await window.__db.doc("mesa/orden").set({ modo: "turnos", turno: "u1", ronda: 1, desde: t });
    return ns;
  }, [partida, t, enemigos, !!extra.sinCombate]);
  await pg.waitForTimeout(1500);
  return { pg, nombres };
}
const estado = (pg) => pg.evaluate(() => window.__store.get("mesa/estado")?.partida?.combate?.ronda);
const orden = (pg) => pg.evaluate(() => window.__store.get("mesa/orden"));
const nTurnos = (pg) => pg.evaluate(() => [...window.__store.keys()].filter((k) => k.startsWith("turnos/")).length);
const ultimaEntrada = (pg) => pg.evaluate(() => (window.__entradas || []).slice(-1)[0] || "");
const barra = (pg) => pg.evaluate(() => document.getElementById("orden-turnos").innerText.replace(/\s+/g, " ").trim());
// La acción de Beto llega a la cola desde «su pestaña»; aquí la narra esta página al pulsar «Que el DM responda».
const accionDeBeto = async (x) => {
  await pgActual.evaluate(async (x) => { await window.__db.collection("acciones").add({ nombre: "Beto", uid: "ub", jid: "uBeto", texto: x, ts: Date.now() + 5 }); }, x);
  await pgActual.getByRole("button", { name: "Que el DM responda" }).click({ timeout: 5000 }).catch(() => {});
};
let pgActual;
async function turno(pg, accionDe, texto) {
  const n = await nTurnos(pg);
  await accionDe(texto);
  await pg.waitForFunction((n) => [...window.__store.keys()].filter((k) => k.startsWith("turnos/")).length > n, n, { timeout: 20000 }).catch(() => {});
  await pg.waitForTimeout(700);
}

// ---- 1. escritorio: la barra, el bloque que recibe el DM y el avance del asalto
{
  const { pg, nombres } = await montar(1280, 860);
  pgActual = pg;
  const ogro = nombres[0];
  const txt = await barra(pg);
  console.log("1. barra:", txt);
  console.log("   muestra el asalto y los tres en el orden de iniciativa:", /Asalto 1/i.test(txt) && txt.indexOf("Ana (tú)") < txt.indexOf(ogro) && txt.indexOf(ogro) < txt.indexOf("Beto"));
  console.log("   el enemigo va apagado con su estado público (sin cifras):", await pg.evaluate(() => !!document.querySelector("#orden-turnos .ficha-turno.npc") && /🐺/.test(document.querySelector("#orden-turnos .ficha-turno.npc").innerText) && /ileso/.test(document.querySelector("#orden-turnos .ficha-turno.npc").innerText) && !/\d+\/\d+/.test(document.querySelector("#orden-turnos").innerText)));
  console.log("   resaltado el turno de Ana:", await pg.evaluate(() => document.querySelector("#orden-turnos .ficha-turno.actual")?.innerText));
  const m = await pg.evaluate(() => { const f = document.querySelector(".fila-meta"), o = document.getElementById("orden-turnos"); return { filaDesborda: f.scrollWidth > f.clientWidth + 1, pagina: document.documentElement.scrollWidth > innerWidth, ordenDesborda: o.scrollWidth > o.clientWidth + 1 }; });
  console.log("   fila meta sin ensanchar:", !m.filaDesborda, "· página sin scroll horizontal:", !m.pagina);
  await pg.screenshot({ path: salida("combate-escritorio.png") });

  // Turno de Ana: el DM recibe el bloque y la palabra pasa a Beto, con el Ogro por resolver.
  await pg.evaluate(() => { window.__textoDM = "Aldo golpea y el Ogro ruge."; window.__entradas = []; });
  await turno(pg, async (x) => { await pg.fill("#accion", x); await pg.keyboard.press("Enter"); }, "Ataco al Ogro con mi espada");
  const e1 = await ultimaEntrada(pg);
  console.log("2. entrada al DM con «TURNOS DE COMBATE»:", /# TURNOS DE COMBATE/.test(e1), "· enemigo a resolver:", e1.includes(`el turno de: ${ogro}`), "· palabra a Beto:", /Entrega la palabra a Beto/.test(e1), "· sin cierre de asalto:", !/NO llames a siguiente_asalto/.test(e1));
  const o1 = await orden(pg);
  console.log("   el turno pasa a Beto (Bruna):", o1.turno === "uBeto" && o1.entrada === "Bruna", "· ronda de la mesa sin tocar:", o1.ronda === 1, "· asalto del motor:", await estado(pg));

  // Turno de Beto (otra pestaña escribe su acción): cierra la ronda de iniciativa.
  await pg.evaluate(() => { window.__textoDM = "Bruna remata al Ogro herido."; window.__entradas = []; });
  await turno(pg, accionDeBeto, "Ataco con mi daga");
  const e2 = await ultimaEntrada(pg);
  console.log("3. turno de Beto: último de la ronda de iniciativa:", /Nadie más actúa entre él y el siguiente jugador/.test(e2) && /NO llames a siguiente_asalto/.test(e2), "· palabra a Ana:", /Entrega la palabra a Ana/.test(e2));
  const o2 = await orden(pg);
  console.log("   el asalto avanza solo a 2:", (await estado(pg)) === 2, "· turno vuelve a Ana:", o2.turno === "u1" && o2.entrada === "Aldo", "· aviso público «Asalto 2»:", await pg.evaluate(() => [...window.__store.entries()].some(([k, v]) => k.startsWith("turnos/") && (v.avisos || []).some((a) => /Asalto 2/.test(a.texto)))));

  // Segundo asalto: Ana otra vez; no se duplica el avance.
  await pg.evaluate(() => { window.__textoDM = "El Ogro cae de rodillas."; window.__entradas = []; });
  await turno(pg, async (x) => { await pg.fill("#accion", x); await pg.keyboard.press("Enter"); }, "Vuelvo a atacar");
  const e3 = await ultimaEntrada(pg);
  console.log("4. segundo asalto: el bloque dice «Asalto 2»:", /Asalto 2:/.test(e3), "· asalto sigue en 2 (sin doble avance):", (await estado(pg)) === 2);

  // Si el DM ya llamó a siguiente_asalto en el turno que cierra la ronda, el programa no avanza otra vez.
  await pg.evaluate(() => { window.__textoDM = "Todo se detiene un instante."; window.__accionesDM = [{ accion: "siguiente_asalto", datos: {} }]; });
  await turno(pg, accionDeBeto, "Me cubro");
  await pg.evaluate(() => { window.__accionesDM = null; });
  console.log("5. el DM llama a siguiente_asalto en el cierre: asalto 3, no 4:", (await estado(pg)) === 3);

  // Pasar turno en combate: pasa por el DM (los enemigos actúan).
  await pg.evaluate(() => { window.__textoDM = "Aldo se aparta y el Ogro gruñe."; window.__entradas = []; });
  const t5 = await nTurnos(pg);
  await pg.click("#pasar-turno"); await pg.waitForFunction((n) => [...window.__store.keys()].filter((k) => k.startsWith("turnos/")).length > n, t5, { timeout: 20000 }).catch(() => {});
  await pg.waitForTimeout(600);
  const e4 = await ultimaEntrada(pg);
  console.log("6. «Pasar turno» en combate va por el DM:", /pasa su turno sin actuar/.test(e4) && /# TURNOS DE COMBATE/.test(e4), "· turno a Beto:", (await orden(pg)).turno === "uBeto");

  // Fin del combate: vuelve el orden normal de la mesa sin tocar la ronda.
  await pg.evaluate(async () => { const e = window.__store.get("mesa/estado"); delete e.partida.combate; await window.__db.doc("mesa/estado").set({ ...e, actualizado: Date.now() + 1000 }); });
  await pg.waitForTimeout(1500);
  const sin = await barra(pg);
  console.log("7. sin combate la barra vuelve al orden de la mesa:", sin, "·", !/Asalto/.test(sin) && /Ana \(tú\)/.test(sin) && /Beto/.test(sin) && !/🐺/.test(sin));
  // Modo libre: nada cambia.
  await pg.evaluate(async () => { await window.__db.doc("mesa/orden").update({ modo: "libre" }); });
  await pg.waitForTimeout(600);
  console.log("8. modo libre: barra oculta:", await pg.evaluate(() => document.getElementById("barra-turnos").hidden));
  await pg.close();
}

// ---- 2. móvil (390 px) y muchos enemigos: sin desbordes
for (const [w, h, n, enemigos] of [[390, 844, "movil", ["Ogro", "Hambriento", "Lobo de Ceniza", "Ghul de las fosas", "Troll de ciénaga", "Gárgola"]], [1280, 860, "escritorio-muchos", ["Ogro", "Hambriento", "Lobo de Ceniza", "Ghul de las fosas", "Troll de ciénaga", "Gárgola"]]]) {
  const { pg } = await montar(w, h, enemigos);
  const r = await pg.evaluate(() => {
    const o = document.getElementById("orden-turnos"), f = document.querySelector(".fila-meta");
    return { paginaAncho: document.documentElement.scrollWidth, vw: innerWidth, ordenVisible: o.offsetParent !== null, ordenScroll: o.scrollWidth, ordenCliente: o.clientWidth, filaDesborda: f.scrollWidth > f.clientWidth + 1, texto: o.innerText.replace(/\s+/g, " ").slice(0, 160) };
  });
  console.log(`9. ${n}: página ${r.paginaAncho}/${r.vw} px · sin desborde de página: ${r.paginaAncho <= r.vw} · lista ${r.ordenScroll}/${r.ordenCliente} (con scroll horizontal propio) · fila meta sin ensanchar: ${!r.filaDesborda} · visible: ${r.ordenVisible}`);
  console.log("   ", r.texto);
  await pg.screenshot({ path: salida(`combate-${n}.png`) });
  await pg.close();
}
console.log("capturas en:", salida("").replace(/\/$/, ""));
console.log("errores de página:", errs.length, errs.slice(0, 3).map((e) => e.slice(0, 160)).join(" | "));
await b.close();
