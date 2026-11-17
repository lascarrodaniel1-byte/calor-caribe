// Avance automático del reloj (bloque 1; 3 minutos = propuesta a confirmar). Se engancha tras la narración y las herramientas, antes de guardar el turno,
// dentro del mismo guardado atómico (mesa/estado con `pendiente`). Comprueba: un turno sin `tiempo` del DM suma 3 min y deja el aviso «🕒 … ⏱ automático»;
// un turno con `tiempo` no se duplica; en combate no avanza; con la creación de personajes (jugador sin ficha) no avanza; sin reloj no hace nada;
// y el turno queda guardado de una vez (estado, aviso y turno coherentes, sin pendiente a medias).
import { lanzar, fixture, MOCK, paginaDe } from "./_comun.mjs";
import { readFileSync } from "node:fs";
const S = await paginaDe();
const base = JSON.parse(readFileSync(fixture("partida-mesa.json"), "utf8"));
const b = await lanzar();
let fallos = 0, erroresPagina = 0;
const t = (c, m, x = "") => { console.log(c ? "ok  " : "FALLA", m, x); if (!c) fallos++; };

/** Monta una página como `jugador`, con la partida dada ya en la base; manda una acción y devuelve lo guardado. */
async function turno({ nombre = "Ana", editar = () => {}, combate = false, acciones = null, antes = null }) {
  const pg = await b.newPage({ viewport: { width: 1280, height: 860 } });
  pg.on("pageerror", (e) => { erroresPagina++; console.log("  error de página:", e.message.slice(0, 160)); });
  await pg.addInitScript({ path: MOCK });
  await pg.goto("file://" + S + "/mesa-de-velmora.html"); await pg.waitForTimeout(800);
  await pg.click("#form-tutorial button[type=submit]").catch(() => {}); await pg.fill("#nombre", nombre); await pg.click("#form-nombre button"); await pg.waitForTimeout(500);
  const p = JSON.parse(JSON.stringify(base)); editar(p);
  await pg.evaluate(async ([p, t0, combate]) => {
    if (combate) { // un combate de verdad, por el motor
      const V = window.Velmora;
      V.ejecutar("aparecer_criatura", { nombre: "Ogro", repetir: true }, p);
      V.ejecutar("iniciativa", { participantes: ["Aldo", "Bruna", ...Object.values(p.jefes).map((j) => j.nombre)] }, p);
    }
    await window.__db.doc("mesa/estado").set({ partida: p, cronica: "", actualizado: t0 });
  }, [p, Date.now(), combate]);
  await pg.waitForTimeout(1200);
  if (antes) await pg.evaluate(antes);
  await pg.evaluate((a) => { window.__textoDM = "El tabernero se encoge de hombros y sigue puliendo un vaso."; window.__accionesDM = a; }, acciones);
  await pg.fill("#accion", "Hablo con el tabernero"); await pg.keyboard.press("Enter");
  await pg.waitForFunction(() => [...window.__store.keys()].some((k) => k.startsWith("turnos/")), null, { timeout: 20000 }).catch(() => {});
  await pg.waitForTimeout(600);
  const r = await pg.evaluate(() => {
    const turnos = [...window.__store.entries()].filter(([k]) => k.startsWith("turnos/")).map(([, v]) => v);
    const e = window.__store.get("mesa/estado");
    return { turnos, reloj: e?.partida?.reloj, pendiente: e?.pendiente ?? null, colaAcciones: [...window.__store.keys()].filter((k) => k.startsWith("acciones/")).length, combate: !!e?.partida?.combate, version: e?.actualizado, texto: document.getElementById("registro")?.innerText || "" };
  });
  await pg.close();
  return r;
}
const avisosReloj = (r) => (r.turnos[0]?.avisos || []).map((a) => a.texto).filter((x) => /^🕒/.test(x));
const T0 = base.reloj.segundos;

// 1. turno de exploración o diálogo sin `tiempo` del DM: +3 minutos y aviso «⏱ automático»
{
  const r = await turno({});
  t(r.turnos.length === 1 && r.reloj?.segundos === T0 + 180, "sin `tiempo` del DM el reloj avanza 3 minutos", `${r.reloj?.segundos - T0} s`);
  const av = avisosReloj(r);
  t(av.length === 1 && /^🕒 Día 1, 08:03 \(mañana\) · ⏱ automático$/.test(av[0]), "el aviso público «🕒 Día 1, 08:03 … · ⏱ automático» queda en el turno", av.join(" | "));
  t(/⏱ automático/.test(r.texto), "el aviso se ve en el registro de la página");
  // Guardado atómico: el aviso automático y el reloj nuevo van en la MISMA escritura de mesa/estado (`pendiente.doc` es el turno), y el turno y la cola se completan después.
  t(r.pendiente?.tipo === "turno" && (r.pendiente.doc?.avisos || []).some((a) => /⏱ automático/.test(a.texto)) && r.version > 0, "el aviso y el reloj nuevo van en el mismo guardado atómico de mesa/estado");
  t(JSON.stringify(r.turnos[0].avisos) === JSON.stringify(r.pendiente?.doc?.avisos) && r.colaAcciones === 0, "el turno guardado coincide con el del guardado atómico y la cola quedó vacía", `cola=${r.colaAcciones}`);
  t(r.turnos[0].avisos.every((a) => Number.isFinite(a.pos)), "los avisos del turno están completos (posición y texto)");
}
// 2. el DM movió el reloj con `tiempo`: no se duplica y no hay aviso automático
{
  const r = await turno({ acciones: [{ accion: "tiempo", datos: { avanzar: { minutos: 30 }, motivo: "conversación larga" } }] });
  const av = avisosReloj(r);
  t(r.reloj?.segundos === T0 + 1800, "con `tiempo` del DM (30 min) el reloj avanza solo esos 30 min", `${r.reloj?.segundos - T0} s`);
  t(av.length === 1 && !/automático/.test(av[0]), "un solo aviso 🕒 (el del DM), sin «automático»", av.join(" | "));
}
// 3. en combate no avanza (los asaltos ya cuentan 6 s)
{
  const r = await turno({
    combate: true,
  });
  t(r.combate && r.turnos.length === 1 && r.reloj?.segundos === T0 && avisosReloj(r).length === 0, "con combate en curso no avanza ni avisa", `${r.reloj?.segundos - T0} s`);
}
// 4. creación de personaje: un jugador sin ficha no mueve el reloj
{
  const r = await turno({ nombre: "Zoe" });
  t(r.turnos.length === 1 && r.reloj?.segundos === T0 && avisosReloj(r).length === 0, "con un jugador aún sin ficha (creación) no avanza", `${r.reloj?.segundos - T0} s`);
}
// 5. sin reloj en lo guardado (partida antigua): la página lo crea en modo «auto» (día 1, 08:00: el tiempo siempre corre) y ese reloj sí avanza;
//    el caso «sin reloj» de verdad (partida.reloj ausente → 0) lo cubre la prueba del motor (t-tiempo-auto).
{
  const r = await turno({ editar: (p) => { delete p.reloj; } });
  t(r.turnos.length === 1 && r.reloj?.auto === true && r.reloj?.segundos === 8 * 3600 + 180, "partida antigua sin reloj: se crea el reloj automático y avanza 3 minutos", JSON.stringify(r.reloj));
}
await b.close();
console.log("errores de página:", erroresPagina);
process.exit(fallos || erroresPagina ? 1 : 0);
