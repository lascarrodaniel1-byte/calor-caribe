// La mesa sigue la iniciativa: ordenDeCombate, siguienteEnCombate, bloqueTurnos de combate y avance automático del asalto (cerrarAsalto).
import { nuevaPartida, normalizarPartida } from "../../src/estado.ts";
import { ejecutar, cerrarAsalto } from "../../src/herramientas.ts";
import { estadoParaDM } from "../../src/navegador.ts";
import { ordenDeCombate, siguienteEnCombate, bloqueTurnos, type InfoTurno } from "../../src/turnos.ts";
import { iniciarRegistroDados, liberarDados } from "../../src/dados.ts";
let ok = 0, mal = 0; const t = (c: boolean, m: string, x = "") => { console.log(c ? "ok   " : "FALLA", m, x); c ? ok++ : mal++; };

/** Partida con tres PJ (Aldo de Ana, Bruna de Beto, Carl de Cris) y las criaturas dadas; el orden de iniciativa se fija a mano. */
const mk = (criaturas: string[], orden: string[], jug = ["Ana", "Beto", "Cris"]) => {
  const p = nuevaPartida(); normalizarPartida(p);
  const E = (n: string, d: object): any => ejecutar(n, d, p);
  ["Aldo", "Bruna", "Carl"].forEach((n, i) => E("guardar_personaje", { don_arcano: false, nombre: n, jugador: jug[i], raza: "Humano del Faro", clase: "Mercenario del Cuervo", nivel: 5, pv_max: 40, ca: 12, atributos: { fue: 16, des: 14, con: 14, int: 10, sab: 14, car: 10 }, inventario: [], dote: "Terco" }));
  for (const c of criaturas) E("aparecer_criatura", { nombre: c, repetir: true });
  const nombres = Object.values(p.jefes).map((j) => j.nombre);
  E("iniciativa", { participantes: ["Aldo", "Bruna", "Carl", ...nombres] });
  const real = (x: string) => (x.startsWith("@") ? nombres[Number(x.slice(1))] : x);
  p.combate!.orden = orden.map((x, i) => ({ nombre: real(x), total: 30 - i }));
  return { p, E, nombres, real };
};
const nm = (l: { nombre: string }[]) => l.map((e) => e.nombre).join(">");
const TODOS = ["Ana", "Beto", "Cris"];

// ---- orden completo con los enemigos intercalados
{
  const { p, nombres } = mk(["Ogro", "Lobo"], ["Aldo", "@0", "Bruna", "@1", "Carl"]);
  const [ogro, lobo] = nombres;
  const o = ordenDeCombate(p, TODOS);
  t(nm(o) === `Aldo>${ogro}>Bruna>${lobo}>Carl`, "el orden de la mesa es el de la iniciativa, con los enemigos intercalados", nm(o));
  t(o[0].tipo === "pj" && o[0].jugador === "Ana" && !o[0].tocaAlDM, "un PJ de un jugador presente: lo lleva su jugador");
  t(o[1].tipo === "enemigo" && o[1].tocaAlDM && !o[1].jugador, "una criatura: la resuelve el DM");
  t(o[1].estado === "ileso", "estado público de una criatura sin heridas: ileso");
  t(ordenDeCombate(nuevaPartida(), TODOS).length === 0, "sin combate, el orden de combate está vacío");

  // siguiente: de Aldo a Bruna, el Ogro entre medias
  const s = siguienteEnCombate(p, TODOS, {}, "Ana")!;
  t(s.jugador === "Beto" && s.entrada === "Bruna" && nm(s.resolverAntes) === ogro && !s.cierraAsalto, "Ana → Beto, con el Ogro entre ambos y sin cerrar el asalto", JSON.stringify([s.jugador, nm(s.resolverAntes), s.cierraAsalto]));
  // de Bruna a Carl: el Lobo
  const s2 = siguienteEnCombate(p, TODOS, {}, "Beto")!;
  t(s2.jugador === "Cris" && nm(s2.resolverAntes) === lobo && !s2.cierraAsalto, "Beto → Cris, con el Lobo entre ambos");
  // de Carl a Aldo: da la vuelta y cierra el asalto
  const s3 = siguienteEnCombate(p, TODOS, {}, "Cris")!;
  t(s3.jugador === "Ana" && s3.resolverAntes.length === 0 && s3.cierraAsalto, "Cris → Ana: se acaba la ronda de iniciativa (cierra el asalto)");
}

// ---- el DM resuelve antes de la vuelta: el enemigo que va primero es del asalto siguiente
{
  const { p, nombres } = mk(["Ogro"], ["@0", "Aldo", "Bruna", "Carl"]);
  const s = siguienteEnCombate(p, TODOS, {}, "Cris")!;
  t(s.jugador === "Ana" && s.cierraAsalto && s.resolverAntes.length === 1 && s.resolverAntes[0].nuevoAsalto === true, "el Ogro que abre la ronda se resuelve ya en el asalto siguiente (nuevoAsalto)", JSON.stringify(s.resolverAntes.map((e) => e.nombre)));
  const b = bloqueTurnos({ actuante: "Cris", orden: TODOS, ronda: 1, siguiente: "Ana", cierraRonda: false, combate: { asalto: 1, orden: s.orden, resolverAntes: s.resolverAntes, cierraAsalto: s.cierraAsalto, entrada: "Carl" } });
  t(/llama UNA vez a siguiente_asalto \(empieza el asalto 2\)/.test(b) && !/NO llames/.test(b), "con enemigos del asalto siguiente por resolver, el DM avanza el asalto él mismo en medio");
  void nombres;
}

// ---- el único jugador humano: el DM resuelve a todos y la palabra vuelve a él
{
  const { p, nombres } = mk(["Ogro", "Lobo"], ["Aldo", "@0", "Bruna", "@1", "Carl"]);
  const s = siguienteEnCombate(p, ["Ana"], {}, "Ana")!;
  t(s.jugador === "Ana" && s.entrada === "Aldo", "único humano: el siguiente jugador eres tú mismo");
  t(nm(s.resolverAntes) === `${nombres[0]}>Bruna>${nombres[1]}>Carl` && s.cierraAsalto, "el DM resuelve a todos (enemigos y PJ de ausentes) y se cierra el asalto", nm(s.resolverAntes));
  t(s.resolverAntes.filter((e) => e.tipo === "pj").every((e) => /ausente/.test(e.motivo ?? "")), "los PJ de ausentes llevan el motivo «ausente»");
  t(ordenDeCombate(p, ["Ana"]).filter((e) => e.tipo === "pj" && e.tocaAlDM).length === 2, "un PJ de un jugador ausente toca al DM");
}

// ---- un solo enemigo, y enemigo que muere en medio
{
  const { p, nombres, E } = mk(["Ogro"], ["Aldo", "@0", "Bruna", "Carl"]);
  t(nm(siguienteEnCombate(p, TODOS, {}, "Ana")!.resolverAntes) === nombres[0], "un solo enemigo: lo resuelve el DM entre Ana y Beto");
  // muere: sale de combate.orden (retirarCaido) o queda a 0 PV
  p.jefes[nombres[0]].pv = 0;
  t(ordenDeCombate(p, TODOS).every((e) => e.tipo === "pj"), "un enemigo a 0 PV ya no aparece en el orden");
  const s = siguienteEnCombate(p, TODOS, {}, "Ana")!;
  t(s.jugador === "Beto" && s.resolverAntes.length === 0, "el enemigo caído se salta: Ana pasa directo a Beto");
  p.jefes[nombres[0]].pv = 10; p.combate!.orden = p.combate!.orden.filter((o) => o.nombre !== nombres[0]);
  t(nm(ordenDeCombate(p, TODOS)) === "Aldo>Bruna>Carl", "un enemigo que ya no está en combate.orden no aparece aunque esté vivo");
  void E;
}

// ---- PNJ en combate (sin ficha)
{
  const p = nuevaPartida(); normalizarPartida(p);
  const E = (n: string, d: object): any => ejecutar(n, d, p);
  for (const [n, j] of [["Aldo", "Ana"], ["Bruna", "Beto"]]) E("guardar_personaje", { don_arcano: false, nombre: n, jugador: j, raza: "Humano del Faro", clase: "Mercenario del Cuervo", nivel: 1, pv_max: 20, ca: 12, atributos: { fue: 16, des: 14, con: 14, int: 10, sab: 14, car: 10 }, inventario: [], dote: "Terco" });
  E("iniciativa", { participantes: ["Aldo", "Bruna"], pnj: [{ nombre: "Guardia", pv: 12, ca: 12, bono_ataque: 3, dano: "1d6" }] });
  p.combate!.orden = [{ nombre: "Aldo", total: 20 }, { nombre: "Guardia", total: 15 }, { nombre: "Bruna", total: 10 }];
  const o = ordenDeCombate(p, ["Ana", "Beto"]);
  t(o[1].tipo === "pnj" && o[1].tocaAlDM && o[1].estado === "ileso", "un PNJ de combate: lo resuelve el DM");
  p.combate!.pnj["Guardia"].pv = 4;
  t(ordenDeCombate(p, ["Ana", "Beto"])[1].estado === "malherido", "estado público de un PNJ con menos de la mitad de PV: malherido");
  p.combate!.pnj["Guardia"].pv = 9;
  t(ordenDeCombate(p, ["Ana", "Beto"])[1].estado === "herido", "estado público: herido");
}

// ---- control prestado: otro jugador actúa por el PJ del ausente
{
  const { p } = mk(["Ogro"], ["Aldo", "@0", "Bruna", "Carl"]);
  const pres = ["Ana", "Cris", "Cam"]; // Beto se fue; Cam lleva a Bruna
  const o = ordenDeCombate(p, pres, { Bruna: "Cam" });
  t(o.find((e) => e.nombre === "Bruna")!.jugador === "Cam" && !o.find((e) => e.nombre === "Bruna")!.tocaAlDM, "con control prestado, Cam actúa por Bruna (no toca al DM)");
  const s = siguienteEnCombate(p, pres, { Bruna: "Cam" }, "Ana")!;
  t(s.jugador === "Cam" && s.entrada === "Bruna", "Ana pasa la palabra a Cam, que lleva a Bruna");
  const sin = ordenDeCombate(p, pres, {});
  t(sin.find((e) => e.nombre === "Bruna")!.tocaAlDM, "sin control prestado, Bruna la lleva el DM");
  // un jugador con dos personajes (el suyo y el prestado): actúa en cada una de sus entradas
  const p2 = mk(["Ogro"], ["Aldo", "Bruna", "@0", "Carl"]).p;
  const dos = siguienteEnCombate(p2, ["Ana", "Cris"], { Bruna: "Ana" }, "Ana", "Aldo")!;
  t(dos.jugador === "Ana" && dos.entrada === "Bruna" && dos.resolverAntes.length === 0, "quien lleva dos personajes actúa dos veces: de Aldo pasa a Bruna (misma persona)");
  const dos2 = siguienteEnCombate(p2, ["Ana", "Cris"], { Bruna: "Ana" }, "Ana", "Bruna")!;
  t(dos2.jugador === "Cris" && dos2.resolverAntes.length === 1, "y tras Bruna, el Ogro y luego Cris");
}

// ---- caídos e incapacitados: toca al DM (salvación contra muerte)
{
  const { p } = mk(["Ogro"], ["Aldo", "@0", "Bruna", "Carl"]);
  p.personajes.Bruna.pv = 0;
  const o = ordenDeCombate(p, TODOS);
  const b = o.find((e) => e.nombre === "Bruna")!;
  t(b.tocaAlDM && /salvación contra muerte/.test(b.motivo ?? "") && b.estado === "☠", "un PJ a 0 PV: toca al DM (salvación contra muerte) y se pinta ☠");
  const s = siguienteEnCombate(p, TODOS, {}, "Ana")!;
  t(s.jugador === "Cris" && s.resolverAntes.length === 2 && s.resolverAntes[1].nombre === "Bruna", "Ana → Cris: el DM resuelve al Ogro y la salvación de Bruna");
  p.personajes.Bruna.pv = 20; p.personajes.Bruna.condiciones.push("paralizado");
  const b2 = ordenDeCombate(p, TODOS).find((e) => e.nombre === "Bruna")!;
  t(b2.tocaAlDM && /incapacitado/.test(b2.motivo ?? "") && b2.estado === "💤", "un PJ paralizado: toca al DM y se pinta 💤", b2.motivo);
  p.personajes.Bruna.condiciones = ["muerto"];
  t(!ordenDeCombate(p, TODOS).some((e) => e.nombre === "Bruna"), "un PJ muerto sale del orden");
}

// ---- sorprendidos en el asalto 1
{
  const { p, nombres } = mk(["Ogro"], ["Aldo", "@0", "Bruna", "Carl"]);
  p.combate!.sorprendidos = ["Bruna", nombres[0]];
  const o = ordenDeCombate(p, TODOS);
  t(o.find((e) => e.nombre === "Bruna")!.tocaAlDM && /sorprendido/.test(o.find((e) => e.nombre === "Bruna")!.motivo ?? ""), "un PJ sorprendido en el asalto 1: toca al DM (pierde su turno)");
  const s = siguienteEnCombate(p, TODOS, {}, "Ana")!;
  t(s.jugador === "Cris" && nm(s.resolverAntes) === `${nombres[0]}>Bruna`, "Ana → Cris: el DM resuelve al Ogro y la sorpresa de Bruna");
  // en el asalto 2 ya no
  p.combate!.ronda = 2;
  t(!ordenDeCombate(p, TODOS).find((e) => e.nombre === "Bruna")!.tocaAlDM, "en el asalto 2 la sorpresa ya no cuenta");
  // al envolver desde el asalto 1, el asalto 2 ya no lleva sorprendidos
  p.combate!.ronda = 1;
  const v = siguienteEnCombate(p, TODOS, {}, "Cris")!;
  t(v.jugador === "Ana" && v.cierraAsalto, "la vuelta al asalto 2 cierra el asalto");
}

// ---- cuando el actuante no está en la iniciativa (aún no tiene personaje): rige el orden de la mesa
{
  const { p } = mk(["Ogro"], ["Aldo", "@0", "Bruna", "Carl"]);
  t(siguienteEnCombate(p, TODOS, {}, "Nuevo") === null, "un actuante sin entrada en la iniciativa: null (orden normal de la mesa)");
  t(siguienteEnCombate(nuevaPartida(), TODOS, {}, "Ana") === null, "sin combate: null");
}

// ---- nadie más puede actuar: la palabra vuelve a quien actuó
{
  const { p } = mk(["Ogro"], ["Aldo", "@0", "Bruna", "Carl"]);
  const s = siguienteEnCombate(p, ["Ana"], {}, "Ana")!;
  t(s.jugador === "Ana" && s.cierraAsalto, "solo Ana presente: la palabra vuelve a Ana");
  p.personajes.Aldo.pv = 0;
  const s2 = siguienteEnCombate(p, ["Ana"], {}, "Ana")!;
  t(s2.jugador === "Ana" && s2.cierraAsalto && s2.resolverAntes.some((e) => e.nombre === "Aldo"), "incluso caída, la palabra vuelve a ella (el DM resuelve su salvación)");
}

// ---- bloqueTurnos: sin combate, idéntico al de siempre
{
  const base: InfoTurno = { actuante: "Ana", orden: ["Ana", "Beto"], ronda: 2, siguiente: "Beto", cierraRonda: false };
  const esperado = [
    "# TURNOS (la mesa juega por turnos: una acción cada vez, en orden)",
    "Orden de la ronda 2: Ana → Beto.",
    "Acaba de actuar: Ana. Narra SOLO su acción y su consecuencia inmediata (tiradas, heridas, lo que dicen los PNJ). No hables, decidas ni muevas a los demás jugadores, y no avances el tiempo más allá de lo que dura su acción.",
    "Termina dándole la palabra a Beto por su nombre («¿Qué hace Beto?»), y deja abierta la situación para que le toque actuar.",
  ].join("\n");
  t(bloqueTurnos(base) === esperado, "sin combate el bloque de turnos es idéntico al de siempre");
  const cierra = bloqueTurnos({ ...base, actuante: "Beto", siguiente: "Ana", cierraRonda: true });
  t(/es el último de la ronda: tras narrar su acción, cierra la ronda/.test(cierra) && !/COMBATE/.test(cierra), "sin combate, la ronda de la mesa sigue cerrándose como antes");
  const crea = bloqueTurnos({ ...base, creando: true, combate: { asalto: 1, orden: [], resolverAntes: [], cierraAsalto: false } });
  t(/CREANDO su personaje/.test(crea) && !/COMBATE/.test(crea), "quien está creando su personaje no recibe el bloque de combate");
}

// ---- bloqueTurnos de combate
{
  const { p, nombres } = mk(["Ogro", "Lobo"], ["Aldo", "@0", "Bruna", "@1", "Carl"]);
  const s = siguienteEnCombate(p, TODOS, {}, "Ana")!;
  const info: InfoTurno = { actuante: "Ana", orden: TODOS, ronda: 3, siguiente: s.jugador, cierraRonda: false, combate: { asalto: s.asalto, orden: s.orden, resolverAntes: s.resolverAntes, cierraAsalto: s.cierraAsalto, entrada: s.entradaActuante } };
  const b = bloqueTurnos(info);
  t(b.startsWith("# TURNOS DE COMBATE (iniciativa; la mesa sigue este orden)"), "encabezado de combate");
  t(b.includes(`Asalto 1: **ALDO** → ${nombres[0]} → Bruna → ${nombres[1]} → Carl.`), "el orden con quien actúa en negrita y mayúsculas", b.split("\n")[1]);
  t(b.includes(`el turno de: ${nombres[0]} (criatura)`) && /UNA sola acción/.test(b) && /Entrega la palabra a Beto por su nombre/.test(b) && /No resuelvas a quienes van después de Beto/.test(b), "pasos 1-3: narrar, resolver enemigos, dar la palabra");
  t(!/NO llames a siguiente_asalto/.test(b), "sin cierre de asalto no habla del asalto");
  t(b.length <= 900, "el bloque cabe en 900 caracteres", String(b.length));
  const c = bloqueTurnos({ ...info, actuante: "Cris", siguiente: "Ana", combate: { ...info.combate!, cierraAsalto: true, resolverAntes: [], entrada: "Carl" } });
  t(/Nadie más actúa entre él y el siguiente jugador/.test(c) && /el asalto 1 termina y empieza el 2: el programa avanza el asalto solo; NO llames a siguiente_asalto/.test(c), "al cerrar el asalto avisa de que lo avanza el programa");
  const l = bloqueTurnos({ ...info, controla: [{ personaje: "Bruna", dueno: "Beto" }] });
  t(/Ana LLEVA ahora a Bruna/.test(l), "el control prestado sigue apareciendo en el bloque de combate");
}

// ---- muchos enemigos: el bloque se resume y no pasa de ~900 caracteres
{
  const p = nuevaPartida(); normalizarPartida(p);
  const E = (n: string, d: object): any => ejecutar(n, d, p);
  for (const [n, j] of [["Aldo", "Ana"], ["Bruna", "Beto"]]) E("guardar_personaje", { don_arcano: false, nombre: n, jugador: j, raza: "Humano del Faro", clase: "Mercenario del Cuervo", nivel: 1, pv_max: 20, ca: 12, atributos: { fue: 16, des: 14, con: 14, int: 10, sab: 14, car: 10 }, inventario: [], dote: "Terco" });
  const pnj = Array.from({ length: 12 }, (_, i) => ({ nombre: `Bandido ${i + 1}`, pv: 8, ca: 11, bono_ataque: 3, dano: "1d6" }));
  E("iniciativa", { participantes: ["Aldo", "Bruna"], pnj });
  p.combate!.orden = [{ nombre: "Aldo", total: 30 }, ...pnj.map((x, i) => ({ nombre: x.nombre, total: 20 - i })), { nombre: "Bruna", total: 1 }];
  const s = siguienteEnCombate(p, ["Ana", "Beto"], {}, "Ana")!;
  t(s.resolverAntes.length === 12, "doce enemigos entre dos jugadores");
  const b = bloqueTurnos({ actuante: "Ana", orden: ["Ana", "Beto"], ronda: 1, siguiente: "Beto", cierraRonda: false, combate: { asalto: 1, orden: s.orden, resolverAntes: s.resolverAntes, cierraAsalto: false, entrada: "Aldo" } });
  t(b.length <= 900 && /Bandido 1, Bandido 2/.test(b) && /12 turnos/.test(b), "con muchos enemigos se resume (nombres separados por comas) y cabe", String(b.length));
}

// ---- cerrarAsalto: avanza una sola vez y arrastra los avisos
{
  const { p, E, nombres } = mk(["Ogro"], ["Aldo", "@0", "Bruna", "Carl"]);
  E("condicion", { objetivo: "Bruna", accion: "aplicar", condicion: "asustado" });
  const antes = p.combate!.ronda;
  const r = cerrarAsalto(p, antes)!;
  t(!!r && p.combate!.ronda === antes + 1 && r.avisos[0] === `⚔ Asalto ${antes + 1}`, "cerrarAsalto avanza el asalto una vez y devuelve el aviso público");
  t(/Condiciones activas \(¿alguna debe terminar\?\)/.test(r.texto) && /Bruna/.test(r.texto), "arrastra los avisos de condiciones activas", r.texto.split("\n").slice(0, 3).join(" | "));
  t(p.combate!.avisoAsalto === r.texto, "el aviso queda en el estado del combate para el DM del turno siguiente");
  t(cerrarAsalto(p, antes) === null && p.combate!.ronda === antes + 1, "idempotente: repetir con el mismo asalto no avanza otra vez");
  t(/AVISO DEL ASALTO/.test(estadoParaDM(p)) && /Condiciones activas/.test(estadoParaDM(p)), "estadoParaDM entrega el aviso al DM");
  delete p.combate!.avisoAsalto;
  t(!/AVISO DEL ASALTO/.test(estadoParaDM(p)), "una vez leído (borrado), no se repite");
  // el DM ya llamó a siguiente_asalto en este turno: no se avanza dos veces
  const p2 = mk(["Ogro"], ["Aldo", "@0", "Bruna", "Carl"]);
  const a0 = p2.p.combate!.ronda;
  p2.E("siguiente_asalto", {});
  t(cerrarAsalto(p2.p, a0) === null && p2.p.combate!.ronda === a0 + 1, "si el DM ya llamó a siguiente_asalto, el programa no avanza el asalto otra vez");
  t(p2.p.combate!.avisoAsalto === undefined, "y no deja aviso");
  // llamar a siguiente_asalto a mano borra un aviso viejo
  p2.p.combate!.avisoAsalto = "viejo"; p2.E("siguiente_asalto", {});
  t(p2.p.combate!.avisoAsalto === undefined, "llamar a siguiente_asalto a mano borra un aviso viejo");
  // sin combate o terminado
  const q = nuevaPartida(); normalizarPartida(q);
  t(cerrarAsalto(q, 1) === null, "sin combate no hace nada");
  p.combate = undefined;
  t(cerrarAsalto(p, antes + 1) === null, "con el combate terminado no hace nada");
  // economía: tras cerrar, el Ogro recupera su acción
  const m = mk(["Ogro"], ["Aldo", "@0", "Bruna", "Carl"]);
  const og = m.nombres[0];
  iniciarRegistroDados(Array.from({ length: 60 }, () => ({ caras: 20, valor: 10 })));
  m.E("plano", { escena: "sala", poner: [{ nombre: "Aldo" }] });
  m.E("plano", { poner: [{ nombre: og, ref: "Aldo", direccion: "N", metros: 1.5 }] });
  m.E("atacar", { atacante: og, objetivo: "Aldo", arma: "Ataque", dano: "1d4" });
  const segundo = m.E("atacar", { atacante: og, objetivo: "Aldo", arma: "Ataque", dano: "1d4" });
  t(!!segundo.error, "el Ogro no puede atacar dos veces en el mismo asalto");
  cerrarAsalto(m.p, m.p.combate!.ronda);
  const tercero = m.E("atacar", { atacante: og, objetivo: "Aldo", arma: "Ataque", dano: "1d4" });
  t(!tercero.error, "tras cerrarAsalto el Ogro vuelve a tener su acción", String(tercero.contenido).slice(0, 80));
  liberarDados();
}

// ---- combate nuevo con otro ya en marcha: cerrarAsalto compara el asalto, y la identidad del combate la comprueba la página
{
  const { p, E } = mk(["Ogro"], ["Aldo", "@0", "Bruna", "Carl"]);
  const viejo = p.combate;
  E("iniciativa", { participantes: ["Aldo", "Bruna"] });
  t(p.combate !== viejo && p.combate!.ronda === 1, "un combate nuevo sustituye al anterior (la página lo detecta por identidad y no cierra el asalto)");
}

console.log(`${ok} ok, ${mal} fallas`);
