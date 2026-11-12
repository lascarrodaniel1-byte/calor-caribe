// Partida completa simulada a nivel de motor, con el contexto de turno de la página activado (`fijarAccionesDelTurno`):
// 4 personajes (razas y clases variadas, género, estilos, un Tritón y un Berserker), calendario con anomalía, exploración con viaje y cita,
// clima y sustento, combate por iniciativa (multiataque, jefe con legendarias y un PNJ) con la mesa que sigue la iniciativa
// (`siguienteEnCombate` / `cerrarAsalto`), acciones programadas entregadas, reacciones preparadas, agua, descanso con cita,
// subida de nivel y fin del combate. Comprueba invariantes tras cada paso. Uso: npx tsx tests/auditoria/partida-completa.ts [semilla]
// Imprime «problemas: N» (0 = bien).
import { nuevaPartida, normalizarPartida } from "../../src/estado.ts";
import { ejecutar, fijarAccionesDelTurno, cerrarAsalto } from "../../src/herramientas.ts";
import { estadoParaDM, activarCalendario } from "../../src/navegador.ts";
import { turnoDe } from "../../src/combate.ts";
import { bloqueTurnos, siguienteEnCombate, ordenDeCombate, programarAccion, debeEntregarse, restoTrasEntregar, textoReaccionesPreparadas, lineaAccion, type Programada } from "../../src/turnos.ts";
import { Buffer } from "node:buffer";

let seed = Number(process.argv[2] || 11);
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
const pick = <T,>(a: readonly T[]) => a[Math.floor(rnd() * a.length)];
const problemas: string[] = [];
const mal = (m: string) => problemas.push(m);
const ALARMA_ESTADO = 800 * 1024;
const malos = /TypeError|Cannot read|is not a function|undefined is not|is not iterable|Maximum call stack|RangeError|ReferenceError|NaN|\[object Object\]/;
let llamadas = 0;

const P: any = nuevaPartida(); normalizarPartida(P);
/** Llama a una herramienta: nunca debe lanzar; un resultado con error es legítimo (rechazo del motor), pero no un fallo interno. */
const E = (n: string, d: object): any => {
  llamadas++;
  try { const r = ejecutar(n, d, P); const s = typeof r === "string" ? r : JSON.stringify(r); if (malos.test(s)) mal(`${n} → ${s.slice(0, 140)}`); return r; }
  catch (e: any) { mal(`${n} LANZA ${String(e?.message).slice(0, 140)}`); return { error: true, contenido: "" }; }
};
const vivosPJ = () => Object.values<any>(P.personajes);

/** Invariantes que deben cumplirse tras cualquier paso. */
function invariantes(donde: string) {
  for (const p of vivosPJ()) {
    if (!Number.isFinite(p.pv) || p.pv < 0 || p.pv > p.pv_max + 200) mal(`${donde}: PV fuera de rango ${p.nombre} ${p.pv}/${p.pv_max}`);
    if (p.condiciones.length !== new Set(p.condiciones).size) mal(`${donde}: condiciones duplicadas en ${p.nombre}`);
  }
  for (const j of Object.values<any>(P.jefes)) if (!Number.isFinite(j.pv)) mal(`${donde}: PV no finitos de ${j.nombre}`);
  if (P.combate) {
    if (!Number.isFinite(P.combate.ronda) || P.combate.ronda < 1) mal(`${donde}: asalto no válido ${P.combate.ronda}`);
    const orden = ordenDeCombate(P, vivosPJ().map((p) => p.jugador), {});
    const hayVivo = orden.length > 0;
    if (!hayVivo && vivosPJ().some((p) => p.pv > 0 && !p.condiciones.includes("muerto")) && Object.values<any>(P.jefes).some((j) => j.pv > 0)) mal(`${donde}: el orden de mesa quedó vacío con combatientes vivos`);
  }
  const tam = Buffer.byteLength(JSON.stringify({ ...P, historial: undefined }));
  if (tam > ALARMA_ESTADO) mal(`${donde}: el estado pesa ${Math.round(tam / 1024)} KB (alarma 800 KB)`);
  const e = estadoParaDM(P, "Ana"); if (malos.test(e)) mal(`${donde}: estadoParaDM contiene ${(malos.exec(e) || [""])[0]}`);
  const clon = JSON.parse(JSON.stringify(P)); normalizarPartida(clon);
  if (JSON.stringify({ ...clon, historial: undefined }) !== JSON.stringify({ ...P, historial: undefined })) mal(`${donde}: exportar → importar no deja la partida idéntica`);
}
/** Una «respuesta del DM»: con el contexto de turno activado y las acciones de los jugadores. */
function turno(acciones: { nombre: string; texto: string; programada?: boolean }[], cuerpo: () => void, donde: string) {
  fijarAccionesDelTurno(acciones.map((a) => a.nombre + ": " + a.texto));
  try { cuerpo(); } finally { fijarAccionesDelTurno(null); }
  invariantes(donde);
}

// ============================================================ sesión 1: creación
const GRUPO = [
  { n: "Ana", raza: "Tritón de las Mareas", clase: "Flagelante", genero: "Femenino" },
  { n: "Beto", raza: "Humano del Faro", clase: "Berserker de Ceniza", genero: "Masculino" },
  { n: "Cleo", raza: "Elfo Marchito", clase: "Hechicero", genero: "No binario" },
  { n: "Dan", raza: "Varg", clase: "Mercenario del Cuervo", genero: "Masculino" },
] as const;
turno([{ nombre: "Ana", texto: "Creo mi personaje" }], () => {
  for (const g of GRUPO)
    E("guardar_personaje", { don_arcano: false, nombre: g.n, jugador: g.n, genero: g.genero, raza: g.raza, clase: g.clase, nivel: 3, pv_max: 38 + Math.floor(rnd() * 10), ca: 13, atributos: { fue: 15, des: 14, con: 14, int: 12, sab: 12, car: 10 }, inventario: ["Espada larga", "Raciones de viaje (5)", "Odre de agua (3)"], dote: "Terco", ...(g.clase === "Hechicero" ? { tipos_magia: ["fuego"], linaje: "noble" } : {}) });
  for (const g of GRUPO) { E("empunar", { quien: g.n, principal: "Espada larga" }); }
  E("arte_marcial", { accion: "aprender", quien: "Dan", arte: "Filo del Cuervo", via: "clase" });
  E("arte_marcial", { accion: "aprender", quien: "Ana", arte: "Haemajitsu", via: "clase" });
  E("tiempo", { fijar: { dia: 1, hora: 8 } });
  E("ubicacion", { lugar: "Pozonegro", region: "Aldenmar", tipo: "aldea" });
  if (activarCalendario(P) === false) mal("el calendario no se activó con reloj");
}, "creación");
for (const g of GRUPO) if (!P.personajes[g.n]) mal(`no se creó ${g.n}`);
if (P.personajes.Ana?.genero !== "Femenino") mal("el género no se guardó");

// ============================================================ sesión 2: exploración, clima, sustento, anomalía
turno([{ nombre: "Beto", texto: "Salimos al amanecer hacia el paso, son siete horas de camino" }], () => {
  const r = E("viajar", { horas: 7, ritmo: "normal", terreno: "camino" });
  if (!r.error) mal("viajar 7 h sin cita no fue rechazado por la guarda");
  const r2 = E("viajar", { horas: 7, ritmo: "normal", terreno: "camino", cita: "siete horas de camino" });
  if (r2.error) mal("viajar 7 h con cita fue rechazado: " + String(r2.contenido).slice(0, 80));
  E("clima", { accion: "ver" }); E("clima", { accion: "pronostico" });
  for (const g of GRUPO) { E("sustento", { accion: "comer", quienes: [g.n] }); E("sustento", { accion: "beber", quienes: [g.n] }); }
}, "viaje");
turno([{ nombre: "Cleo", texto: "Recordamos que una antigua maldición alarga el invierno en estas tierras" }], () => {
  const r = E("clima", { accion: "anomalia", nombre: "El invierno del Cuervo", causa: "Una maldición antigua despierta con la sangre derramada en el paso", tipo: "ambas", extra_dias: 15, intensidad: 2, cita: "una antigua maldición alarga el invierno" });
  if (r.error) mal("anomalía con cita rechazada: " + String(r.contenido).slice(0, 80));
}, "anomalía");
// salto de tiempo sin cita: debe rechazarse y no mover el reloj
turno([{ nombre: "Dan", texto: "Miro alrededor" }], () => {
  const s = P.reloj.segundos; const r = E("pasar_tiempo", { dias: 2, calidad: "esfuerzo" });
  if (!r.error || P.reloj.segundos !== s) mal("pasar_tiempo sin cita no fue rechazado o movió el reloj");
}, "guarda sin cita");

// ============================================================ sesión 3: combate por iniciativa
const presentes = GRUPO.map((g) => g.n);
const progs: Record<string, Programada> = {};
turno([{ nombre: "Ana", texto: "Un troll y un ogro nos cierran el paso; Vaskar aparece tras ellos" }], () => {
  for (const c of ["Troll de ciénaga", "Ogro", "Vaskar"]) E("aparecer_criatura", { nombre: c, repetir: true });
  const ns = Object.values<any>(P.jefes).map((j) => j.nombre);
  E("iniciativa", { participantes: [...presentes, ...ns], pnj: [{ nombre: "Mercader", bono_ataque: 3, ca: 12, pv: 20, veterania: "curtido", ataques_por_asalto: 2 }] });
  E("plano", { escena: "el paso", poner: [{ nombre: "Ana" }] });
  E("plano", { poner: [...["Beto", "Cleo", "Dan"].map((n, i) => ({ nombre: n, ref: "Ana", direccion: "N", metros: 1.5 * (i + 1) })), ...[...ns, "Mercader"].map((n, i) => ({ nombre: n, ref: "Ana", direccion: "S", metros: 1.5 }))] });
}, "inicio de combate");
if (!P.combate) mal("no hay combate tras iniciativa");
const nombresEnemigos = () => Object.values<any>(P.jefes).filter((j) => j.pv > 0).map((j) => j.nombre);

let asaltos = 0, hizoAgua = false, programadaEntregada = 0, reaccionUsada = 0;
progs.Beto = { texto: "", ts: Date.now(), ronda: 1 } as Programada;
for (let guard = 0; guard < 160 && P.combate; guard++) {
  const sig0 = siguienteEnCombate(P, presentes, {}, "Ana");
  if (!sig0) { mal("siguienteEnCombate devolvió null con combate y personajes en pie"); break; }
  // el jugador que tiene la palabra (el primero humano del orden actual)
  const orden = ordenDeCombate(P, presentes, {});
  const humanos = orden.filter((e) => !e.tocaAlDM);
  if (!humanos.length) { P.pv0 = 1; break; }
  const actor = humanos[guard % humanos.length];
  const sig = siguienteEnCombate(P, presentes, {}, actor.jugador!, actor.nombre);
  if (!sig) { mal(`sin siguiente para ${actor.nombre}`); break; }
  const asaltoAntes = P.combate.ronda;
  const enemigos = nombresEnemigos();
  const objetivo = enemigos.length ? pick(enemigos) : null;
  // acción programada entregada: en un turno de cada tres, el actor la tenía escrita de antes
  const programada = guard % 3 === 1;
  let texto = `Ataco a ${objetivo ?? "nadie"} con todas mis fuerzas`;
  if (programada) {
    const r = programarAccion(null, { texto, reaccion: "Si atacan a Cleo, me interpongo" }, { ronda: 1, asalto: asaltoAntes });
    if (!r.ok) mal("programarAccion falló: " + r.motivo); else {
      const prog = r.programada;
      if (!debeEntregarse(prog, { ronda: 1, asalto: asaltoAntes }, false)) mal("una programada vigente no se entrega");
      if (restoTrasEntregar(prog, { ronda: 1, asalto: asaltoAntes })?.reaccion === undefined) mal("la reacción preparada no sobrevive a la entrega");
      programadaEntregada++;
    }
  }
  const acciones = [{ nombre: actor.jugador!, texto, ...(programada ? { programada: true } : {}) }];
  turno(acciones, () => {
    if (programada && !lineaAccion(acciones[0]).includes("acción preparada antes")) mal("la línea de acción programada no lleva la marca");
    const bloque = bloqueTurnos({ actuante: actor.jugador!, orden: presentes, ronda: 1, siguiente: sig.jugador, cierraRonda: false, preparada: programada, reacciones: programada ? textoReaccionesPreparadas(P, { [actor.jugador!]: { reaccion: "Si atacan a Cleo, me interpongo", reaccionAsalto: asaltoAntes } }) : undefined, combate: { asalto: sig.asalto, orden: sig.orden, resolverAntes: sig.resolverAntes, cierraAsalto: sig.cierraAsalto, entrada: sig.entradaActuante } });
    if (!/TURNOS DE COMBATE/.test(bloque)) mal("el bloque de turnos no es el de combate");
    if (programada && !/Reacciones preparadas/.test(bloque) && turnoDe(P, actor.nombre).reaccion) { /* reacción gastada: no se lista (correcto) */ }
    // 1) el jugador actúa (una acción: Atacar con sus ataques; si no puede, el motor lo rechaza)
    if (objetivo) { const nAt = rnd() < 0.5 ? 2 : 1; for (let k = 0; k < nAt; k++) E("atacar", { atacante: actor.nombre, objetivo, arma: "Espada larga", dano: "1d8+3" }); }
    if (programada && objetivo) { // reacción preparada: se aplica con las herramientas existentes
      const r = E("atacar", { atacante: actor.nombre, objetivo, arma: "Espada larga", dano: "1d8+2", reaccion: true });
      if (!r.error) reaccionUsada++;
      const r2 = E("atacar", { atacante: actor.nombre, objetivo, arma: "Espada larga", dano: "1d8+2", reaccion: true });
      if (!r2.error) mal("un PJ atacó dos veces como reacción en el mismo asalto");
    }
    // 2) el DM resuelve, en este mismo mensaje, los turnos que van antes del siguiente jugador
    for (const r of sig.resolverAntes) {
      if (r.nuevoAsalto && !(P.combate.ronda > asaltoAntes)) E("siguiente_asalto", {}); // los enemigos que abren el asalto siguiente
      const quien = r.nombre; const blanco = pick(presentes.filter((n) => P.personajes[n].pv > 0)) ;
      if (!blanco) continue;
      if (r.tipo === "enemigo") {
        const j = Object.values<any>(P.jefes).find((x) => x.nombre === quien);
        if (!j || j.pv <= 0) continue;
        const a1 = E("atacar", { atacante: quien, objetivo: blanco, arma: "Ataque", dano: "1d6+2" });
        const a2 = E("atacar", { atacante: quien, objetivo: pick(presentes), arma: "Ataque", dano: "1d6" });
        // el exceso de ataques se rechaza sin efecto: el segundo solo vale si la criatura tiene multiataque o legendarias
        void a1; void a2;
        if (/Vaskar/.test(quien)) { const l = E("atacar", { atacante: quien, objetivo: blanco, arma: "Garra", dano: "1d6", legendaria: true }); void l; }
      } else if (r.tipo === "pnj") E("atacar", { atacante: quien, objetivo: blanco, arma: "Daga", dano: "1d4+1" });
      else if (r.tipo === "pj") { const p = P.personajes[quien]; if (p?.pv <= 0 && !p.condiciones.includes("muerto")) E("salvacion_muerte", { quien }); }
    }
    // movimiento y agua
    if (guard === 3) { E("plano", { mover: [{ nombre: actor.nombre, direccion: "E", metros: 12 }] }); }
    if (guard === 5 && !hizoAgua) { E("agua", { accion: "entrar", quienes: [...presentes, ...enemigos] }); hizoAgua = true; }
    if (guard === 9 && hizoAgua) { E("agua", { accion: "salir", quienes: [...presentes, ...enemigos] }); }
    // 3) cierre del asalto por el programa (idempotente)
    if (sig.cierraAsalto) {
      const cierre = cerrarAsalto(P, asaltoAntes);
      if (P.combate && P.combate.ronda !== asaltoAntes + 1 && sig.resolverAntes.every((r) => !r.nuevoAsalto)) mal(`el asalto no avanzó (${asaltoAntes} → ${P.combate?.ronda})`);
      if (cierre && P.combate && Object.values<any>(P.combate.turnos ?? {}).some((t) => t.movido)) mal("movido no se reinició al cerrar el asalto");
      if (cerrarAsalto(P, asaltoAntes) !== null) mal("cerrarAsalto no es idempotente");
      asaltos++;
    }
  }, `combate paso ${guard}`);
  // curación entre asaltos para que dure y nadie quede bloqueado
  for (const n of presentes) { const p = P.personajes[n]; if (p && p.pv <= 0 && !p.condiciones.includes("muerto") && rnd() < 0.6) E("estabilizar", { quien: pick(presentes.filter((x) => P.personajes[x].pv > 0).concat([n])), objetivo: n, automatico: true }); }
  if (guard > 6) for (const n of presentes) { const p = P.personajes[n]; if (p && !p.condiciones.includes("muerto") && p.pv < 15) E("modificar_personaje", { nombre: n, pv_cambio: 40 }); }
  if (!nombresEnemigos().length || (guard > 25 && asaltos >= 4)) break;
}
if (asaltos < 3) mal(`el asalto avanzó solo ${asaltos} veces en la simulación`);
if (programadaEntregada === 0) mal("no se simuló ninguna programada entregada");
void reaccionUsada;

// fin del combate, experiencia y subida de nivel
turno([{ nombre: "Ana", texto: "Rematamos lo que queda y recogemos el paso" }], () => {
  E("terminar_combate", {});
  E("experiencia", { accion: "dar", px: 16000, motivo: "el paso despejado" });
}, "fin del combate");
if (P.combate) mal("el combate no terminó");
if (!(Object.values<any>(P.personajes).some((p) => p.nivel > 3))) mal("nadie subió de nivel con 16.000 PX");
for (const p of vivosPJ()) if (p.condiciones.some((c: string) => /^(agarrado|derribado|aturdido)/.test(c))) mal(`${p.nombre} conserva una condición de combate tras terminar`);

// ============================================================ sesión 4: descanso con cita y vuelta al reloj
turno([{ nombre: "Dan", texto: "Acampamos y dormimos hasta que amanezca de nuevo" }], () => {
  const r = E("pasar_tiempo", { dias: 1, calidad: "descanso", cita: "dormimos hasta que amanezca" });
  void r;
  const r2 = E("pasar_tiempo", { dias: 1, calidad: "esfuerzo", cita: "dormimos hasta que amanezca" });
  if (r2.error) mal("pasar_tiempo con cita fue rechazado: " + String(r2.contenido).slice(0, 80));
  for (const g of GRUPO) { E("sustento", { accion: "comer", quienes: [g.n] }); E("sustento", { accion: "beber", quienes: [g.n] }); }
  E("descanso", { tipo: "largo" });
}, "descanso");
for (const p of vivosPJ()) if (p.pv <= 0 && !p.condiciones.includes("muerto")) mal(`${p.nombre} sigue a 0 PV tras un descanso largo`);

// ============================================================ cierre: serialización, tamaño y bloqueos
invariantes("final");
const bytes = Buffer.byteLength(JSON.stringify({ ...P, historial: undefined }));
if (!estadoParaDM(P).length) mal("estadoParaDM vacío");
console.log(`${llamadas} llamadas · asaltos cerrados: ${asaltos} · programadas entregadas: ${programadaEntregada} · estado: ${Math.round(bytes / 1024)} KB · día ${Math.floor(P.reloj.segundos / 86400) + 1}`);
console.log([...new Set(problemas)].slice(0, 25).join("\n"));
console.log(`problemas: ${new Set(problemas).size}`);
