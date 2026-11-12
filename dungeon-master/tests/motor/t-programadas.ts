// Acciones programadas y reacciones preparadas: lógica pura de src/turnos.ts (programarAccion, caducada, debeEntregarse, restoTrasEntregar,
// textoReaccionesPreparadas, cuenta atrás, lineaAccion y el bloque de turnos con la regla de la acción preparada).
import { nuevaPartida, normalizarPartida } from "../../src/estado.ts";
import { ejecutar } from "../../src/herramientas.ts";
import { MAX_ACCION } from "../../src/formulario.ts";
import {
  bloqueTurnos, siguienteEnCombate, siguiente, puedeSaltar, programarAccion, caducada, reaccionVigente, debeEntregarse, restoTrasEntregar,
  jugadorCaido, idsConProgramada, lineaAccion, textoReaccionesPreparadas, textoCuentaAtras, REGLA_PREPARADA, MAX_REACCION, MAX_REACCIONES_BLOQUE,
  type InfoTurno, type Jugador, type Programada,
} from "../../src/turnos.ts";
let ok = 0, mal = 0; const t = (c: boolean, m: string, x = "") => { console.log(c ? "ok   " : "FALLA", m, x); c ? ok++ : mal++; };

/** Partida con tres PJ (Aldo de Ana, Bruna de Beto, Carl de Cris) y las criaturas dadas; el orden de iniciativa se fija a mano. */
const mk = (criaturas: string[], orden: string[]) => {
  const p = nuevaPartida(); normalizarPartida(p);
  const E = (n: string, d: object): any => ejecutar(n, d, p);
  ["Aldo", "Bruna", "Carl"].forEach((n, i) => E("guardar_personaje", { don_arcano: false, nombre: n, jugador: ["Ana", "Beto", "Cris"][i], raza: "Humano del Faro", clase: "Mercenario del Cuervo", nivel: 5, pv_max: 40, ca: 12, atributos: { fue: 16, des: 14, con: 14, int: 10, sab: 14, car: 10 }, inventario: [], dote: "Terco" }));
  for (const c of criaturas) E("aparecer_criatura", { nombre: c, repetir: true });
  const nombres = Object.values(p.jefes).map((j) => j.nombre);
  if (criaturas.length) {
    E("iniciativa", { participantes: ["Aldo", "Bruna", "Carl", ...nombres] });
    const real = (x: string) => (x.startsWith("@") ? nombres[Number(x.slice(1))] : x);
    p.combate!.orden = orden.map((x, i) => ({ nombre: real(x), total: 30 - i }));
  }
  return { p, E, nombres };
};

// ---- programarAccion
{
  const ctx = { ahora: 1000, ronda: 3 };
  const r = programarAccion(null, { texto: "  Ataco al ogro  " }, ctx);
  t(r.ok && r.programada.texto === "Ataco al ogro" && r.programada.ronda === 3 && r.programada.ts === 1000 && r.programada.asalto === undefined, "programa y recorta el texto; fuera de combate no lleva asalto");
  t(!programarAccion(null, { texto: "   " }, ctx).ok, "un texto vacío no se programa");
  t(!programarAccion(null, { texto: "x".repeat(MAX_ACCION + 1) }, ctx).ok && programarAccion(null, { texto: "x".repeat(MAX_ACCION) }, ctx).ok, "respeta el límite MAX_ACCION");
  const a = programarAccion(null, { texto: "Primera" }, ctx);
  const b = programarAccion(a.ok ? a.programada : null, { texto: "Segunda" }, { ahora: 2000, ronda: 3 });
  t(b.ok && b.programada.texto === "Segunda" && b.programada.ts === 2000, "una programada nueva sustituye a la anterior (una sola por jugador)");
  // reacción
  const fuera = programarAccion(null, { reaccion: "Si me atacan, me cubro" }, ctx);
  t(!fuera.ok, "la reacción preparada no se admite fuera de combate");
  const en = { ahora: 1000, ronda: 3, asalto: 2 };
  const c1 = programarAccion(null, { reaccion: "Si el ogro me ataca, me cubro con el escudo" }, en);
  t(c1.ok && c1.programada.reaccion === "Si el ogro me ataca, me cubro con el escudo" && c1.programada.texto === "" && c1.programada.reaccionAsalto === 2, "una reacción sola se guarda sin acción");
  const c2 = programarAccion(c1.ok ? c1.programada : null, { texto: "Ataco" }, en);
  t(c2.ok && c2.programada.reaccion === "Si el ogro me ataca, me cubro con el escudo" && c2.programada.texto === "Ataco" && c2.programada.asalto === 2, "programar la acción no toca la reacción ya preparada");
  const c3 = programarAccion(c2.ok ? c2.programada : null, { reaccion: "" }, en);
  t(c3.ok && !c3.programada.reaccion && c3.programada.texto === "Ataco", "se puede quitar la reacción sin perder la acción");
  const c4 = programarAccion(c1.ok ? c1.programada : null, { reaccion: "" }, en);
  t(!c4.ok, "quitar la reacción cuando no hay acción deja sin nada que guardar (el documento se borra)");
  t(programarAccion(null, { reaccion: "y".repeat(500) }, en).ok && (programarAccion(null, { reaccion: "y".repeat(500) }, en) as any).programada.reaccion.length === MAX_REACCION, "la reacción se recorta a una línea corta");
  t(!/[«»\n]/.test((programarAccion(null, { reaccion: "Si «él»\nme ataca" }, en) as any).programada.reaccion), "la reacción no lleva saltos de línea ni comillas angulares");
}

// ---- caducidad
{
  const P = (o: Partial<Programada> = {}): Programada => ({ texto: "Ataco", ts: 1000, ronda: 3, ...o });
  t(!caducada(P(), { ahora: 2000, ronda: 3 }), "fuera de combate vale en la misma ronda");
  t(!caducada(P(), { ahora: 2000, ronda: 5 }), "y hasta 2 rondas después");
  t(caducada(P(), { ahora: 2000, ronda: 6 }), "con más de 2 rondas de mesa de diferencia caduca");
  t(!caducada(P({ asalto: 1 }), { ahora: 2000, ronda: 3, asalto: 3 }), "programada en combate: vale hasta 2 asaltos después");
  t(caducada(P({ asalto: 1 }), { ahora: 2000, ronda: 3, asalto: 4 }), "programada en combate: caduca al tercer asalto siguiente (la ronda de la mesa no avanza en combate)");
  t(caducada(P({ asalto: 2 }), { ahora: 2000, ronda: 3 }), "si el combate acaba, caduca");
  t(caducada(P({ asalto: 5 }), { ahora: 2000, ronda: 3, asalto: 1 }), "si empieza otro combate (el asalto vuelve a 1), caduca");
  t(caducada(P(), { ahora: 2000, ronda: 3, asalto: 1 }), "programada antes de que empezara un combate: ya es otra situación, caduca");
  t(caducada(P(), { ahora: 1000 + 13 * 3_600_000, ronda: 3 }), "una programada de hace más de 12 horas caduca aunque la ronda no avance");
  t(reaccionVigente({ texto: "", ts: 0, ronda: 0, reaccion: "x", reaccionAsalto: 2 }, { ronda: 1, asalto: 7 }), "la reacción sigue vigente por muchos asaltos que pasen");
  t(!reaccionVigente({ texto: "", ts: 0, ronda: 0, reaccion: "x", reaccionAsalto: 2 }, { ronda: 1 }), "la reacción se acaba con el combate");
  t(!reaccionVigente({ texto: "", ts: 0, ronda: 0, reaccion: "x", reaccionAsalto: 5 }, { ronda: 1, asalto: 1 }), "y no pasa a un combate nuevo");
  t(!reaccionVigente({ texto: "Ataco", ts: 0, ronda: 0 }, { ronda: 1, asalto: 1 }), "sin reacción no hay reacción vigente");
}

// ---- debeEntregarse, caídos y lo que queda tras entregar
{
  const { p } = mk([], []);
  const ctx = { ahora: 2000, ronda: 3 };
  const P: Programada = { texto: "Ataco", ts: 1000, ronda: 3 };
  t(debeEntregarse(P, ctx, jugadorCaido(p, "Beto")), "se entrega a quien tiene su personaje en pie");
  t(debeEntregarse(P, ctx, false) && !debeEntregarse(P, ctx, true), "no se entrega si el personaje está caído");
  t(!debeEntregarse(null, ctx, false) && !debeEntregarse({ ...P, texto: "" }, ctx, false), "ni sin programada ni con solo reacción");
  t(!debeEntregarse(P, { ahora: 2000, ronda: 9 }, false), "ni si ha caducado");
  t(!jugadorCaido(p, "Beto") && jugadorCaido(p, "Nadie"), "un jugador con personaje vivo no está caído; sin personaje, sí (no hay nada que ejecutar)");
  p.personajes.Bruna.pv = 0;
  t(jugadorCaido(p, "Beto"), "a 0 PV está caído");
  p.personajes.Bruna.pv = 10; p.personajes.Bruna.condiciones.push("paralizado");
  t(jugadorCaido(p, "Beto"), "incapacitado (paralizado) cuenta como caído");
  p.personajes.Bruna.condiciones = ["muerto"];
  t(jugadorCaido(p, "Beto"), "muerto está caído");
  // dos personajes (control prestado): solo cuenta el de la entrada
  const q = mk([], []).p; q.personajes.Carl.jugador = "Ana"; q.personajes.Aldo.pv = 0;
  t(jugadorCaido(q, "Ana", "Aldo") && !jugadorCaido(q, "Ana", "Carl") && !jugadorCaido(q, "Ana"), "con dos personajes se mira el de la entrada; sin entrada, solo si lo están todos");
  // resto
  const c = { ahora: 2000, ronda: 3, asalto: 2 };
  const con = { texto: "Ataco", ts: 1000, ronda: 3, asalto: 2, reaccion: "Me cubro", reaccionAsalto: 1 };
  const resto = restoTrasEntregar(con, c);
  t(!!resto && resto.texto === "" && resto.reaccion === "Me cubro" && resto.asalto === undefined, "tras entregar, la reacción preparada se conserva y la acción se vacía", JSON.stringify(resto));
  t(restoTrasEntregar({ texto: "Ataco", ts: 1, ronda: 1 }, { ronda: 1 }) === null, "sin reacción, el documento se borra");
  t(restoTrasEntregar(con, { ronda: 3 }) === null, "con el combate acabado, la reacción tampoco se conserva");
  // ids con programada (presentes para el orden)
  const js = [{ id: "a", nombre: "Ana" }, { id: "b", nombre: "Beto" }, { id: "c", nombre: "Cris" }];
  const mapa = idsConProgramada({ b: { texto: "Hola", ts: 1500, ronda: 3 }, c: { texto: "", ts: 1500, ronda: 3, reaccion: "x" } }, ctx, mk([], []).p, js);
  t(mapa.has("b") && !mapa.has("c") && !mapa.has("a"), "idsConProgramada: solo quien tiene una acción por ejecutar");
}

// ---- un jugador desconectado con programada no se salta
{
  const ahora = 1_000_000;
  const js: Jugador[] = [
    { id: "a", nombre: "Ana", entrada: 1, visto: ahora },
    { id: "b", nombre: "Beto", entrada: 2, visto: 0 }, // se fue
    { id: "c", nombre: "Cris", entrada: 3, visto: ahora },
  ];
  t(siguiente(js, "a", ahora)!.jugador.id === "c", "sin programada, Beto desconectado se salta");
  t(siguiente(js, "a", ahora, new Set(["b"]))!.jugador.id === "b", "con programada, Beto desconectado recibe la palabra y su acción se ejecuta");
  const o = { modo: "turnos" as const, turno: "b", ronda: 1, desde: ahora - 500_000 };
  t(puedeSaltar(js, o, "a", ahora) && !puedeSaltar(js, o, "a", ahora, new Set(["b"])), "no se puede saltar el turno de quien tiene una programada");
  // en combate: su PJ cuenta como presente
  const { p } = mk(["Ogro"], ["Aldo", "Bruna", "@0", "Carl"]);
  const sin = siguienteEnCombate(p, ["Ana", "Cris"], {}, "Ana")!;
  const con = siguienteEnCombate(p, ["Ana", "Cris", "Beto"], {}, "Ana")!;
  t(sin.jugador === "Cris" && con.jugador === "Beto" && con.entrada === "Bruna", "en combate, con su programada Beto cuenta como presente y recibe la palabra con Bruna", `${sin.jugador} ${con.jugador}`);
}

// ---- lineaAccion
{
  t(lineaAccion({ nombre: "Ana", texto: "Abro la puerta" }) === "Ana: Abro la puerta", "una acción normal se presenta como siempre");
  t(lineaAccion({ nombre: "Ana", texto: "Abro la puerta", programada: true }) === "Ana (acción preparada antes, de cuando aún no era su turno): Abro la puerta", "una programada lleva la marca de acción preparada");
}

// ---- reacciones preparadas en el bloque de combate
{
  const { p, E } = mk(["Ogro", "Lobo"], ["Aldo", "@0", "Bruna", "@1", "Carl"]);
  const progs = { Ana: { reaccion: "Si el ogro me ataca, me cubro con el escudo", reaccionAsalto: 1 }, Beto: { reaccion: "Si el lobo salta, lo golpeo", reaccionAsalto: 1 } };
  const l = textoReaccionesPreparadas(p, progs);
  t(l === "Reacciones preparadas: Ana: «Si el ogro me ataca, me cubro con el escudo»; Beto: «Si el lobo salta, lo golpeo».", "una línea con las reacciones de quienes las tienen libres", l);
  t(textoReaccionesPreparadas(nuevaPartida(), progs) === "", "sin combate no hay reacciones");
  t(textoReaccionesPreparadas(p, {}) === "", "sin reacciones no hay línea");
  // reacción gastada → fuera
  p.combate!.turnos = { ...(p.combate!.turnos ?? {}), Aldo: { reaccion: true } };
  t(!/Ana/.test(textoReaccionesPreparadas(p, progs)) && /Beto/.test(textoReaccionesPreparadas(p, progs)), "quien ya gastó su reacción este asalto no aparece");
  delete p.combate!.turnos!.Aldo;
  p.personajes.Bruna.pv = 0;
  t(!/Beto/.test(textoReaccionesPreparadas(p, progs)), "un personaje caído no reacciona");
  p.personajes.Bruna.pv = 30;
  // máximo
  const largas: Record<string, { reaccion: string; reaccionAsalto: number }> = { Ana: { reaccion: "a".repeat(140), reaccionAsalto: 1 }, Beto: { reaccion: "b".repeat(140), reaccionAsalto: 1 }, Cris: { reaccion: "c".repeat(140), reaccionAsalto: 1 } };
  const big = textoReaccionesPreparadas(p, largas);
  t(big.length <= MAX_REACCIONES_BLOQUE && /Ana/.test(big) && !/Cris/.test(big) && big.endsWith("…"), "con muchas reacciones largas se corta en ~300 caracteres", String(big.length));
  // reacción de un combate anterior no vale
  t(textoReaccionesPreparadas(p, { Ana: { reaccion: "x", reaccionAsalto: 9 } }) === "", "una reacción de otro combate (asalto posterior al actual) no vale");
  void E;

  // bloque: sin programadas ni reacciones es idéntico al de siempre; con ellas añade solo las líneas nuevas
  const s = siguienteEnCombate(p, ["Ana", "Beto", "Cris"], {}, "Ana")!;
  const info: InfoTurno = { actuante: "Ana", orden: ["Ana", "Beto", "Cris"], ronda: 3, siguiente: s.jugador, cierraRonda: false, combate: { asalto: s.asalto, orden: s.orden, resolverAntes: s.resolverAntes, cierraAsalto: s.cierraAsalto, entrada: s.entradaActuante } };
  const base = bloqueTurnos(info);
  t(bloqueTurnos({ ...info, preparada: false, reacciones: "" }) === base && !/preparada/.test(base), "sin programadas ni reacciones el bloque de combate es idéntico");
  const con = bloqueTurnos({ ...info, reacciones: l, preparada: true });
  t(con.startsWith(base) && con.includes(l) && /reacción preparada de un jugador cuya reacción no se haya gastado/.test(con) && /reaccion: true/.test(con), "con reacciones añade la línea y la regla");
  t(con.endsWith(REGLA_PREPARADA) && /ya no es posible o no tiene sentido, no la ejecutes; cuéntale qué cambió y deja que elija otra/.test(con), "y la regla de la acción preparada");
  t(con.length - base.length < 700, "las líneas nuevas son cortas", String(con.length - base.length));
  const soloReg = bloqueTurnos({ ...info, reacciones: l });
  t(soloReg.includes(l) && !soloReg.includes(REGLA_PREPARADA), "las reacciones no traen la regla de la acción preparada");
}

// ---- bloque sin combate: idéntico, y con regla solo si la acción es preparada
{
  const base: InfoTurno = { actuante: "Ana", orden: ["Ana", "Beto"], ronda: 2, siguiente: "Beto", cierraRonda: false };
  const sin = bloqueTurnos(base);
  t(bloqueTurnos({ ...base, preparada: false }) === sin, "fuera de combate sin programada es idéntico");
  const con = bloqueTurnos({ ...base, preparada: true });
  t(con === `${sin}\n${REGLA_PREPARADA}`, "con acción preparada añade solo la regla");
  const crea = bloqueTurnos({ ...base, creando: true, preparada: true });
  t(!/preparada/.test(crea), "quien crea su personaje no recibe la regla");
}

// ---- cuenta atrás
{
  const o = [{ nombre: "Aldo", jugador: "Ana", tocaAlDM: false }, { nombre: "Ogro", tocaAlDM: true }, { nombre: "Bruna", jugador: "Beto", tocaAlDM: false }, { nombre: "Carl", jugador: "Cris", tocaAlDM: false }];
  t(textoCuentaAtras(o, 0, 0) === "", "si es mi turno no hay cuenta atrás");
  t(textoCuentaAtras(o, 0, 1) === "Eres el siguiente tras Aldo", "el siguiente");
  t(textoCuentaAtras(o, 0, 2) === "Faltan 2 turnos para ti", "cuenta también los turnos del DM", textoCuentaAtras(o, 0, 2));
  t(textoCuentaAtras(o, 2, 0) === "Faltan 2 turnos para ti", "da la vuelta al orden", textoCuentaAtras(o, 2, 0));
  t(textoCuentaAtras(o, 3, 0) === "Eres el siguiente tras Carl" && textoCuentaAtras(o, -1, 0) === "", "da la vuelta y, sin datos, calla");
}

console.log(`${ok} ok, ${mal} fallas`);
