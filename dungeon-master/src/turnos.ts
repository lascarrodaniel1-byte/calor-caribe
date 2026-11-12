// Turnos de la mesa: cada jugador habla cuando le toca, de uno en uno y en orden,
// para que el DM reciba una sola acción cada vez y la secuencia sea siempre clara
// (acción → respuesta del DM → siguiente jugador). Aquí vive solo la lógica; la
// página guarda a los jugadores en `jugadores/<id>` y el turno en `mesa/orden`.
// En combate (solo en modo «turnos») la mesa sigue la iniciativa del motor: ver `ordenDeCombate`.

import { condsDe, igual, localizar, type Combatiente } from "./combate.js";
import { efectos } from "./condiciones.js";
import type { Partida } from "./estado.js";
import { MAX_ACCION } from "./formulario.js";

export interface Jugador {
  id: string;
  nombre: string;
  /** Cuándo se sentó a la mesa: fija su puesto en el orden. */
  entrada: number;
  /** Última vez que su página dio señales de vida (0 si se fue). */
  visto: number;
}

export interface Orden {
  modo: "turnos" | "libre";
  /** Id del jugador al que le toca. */
  turno: string;
  /** Ronda de la MESA (no es el asalto del combate: son contadores distintos). */
  ronda: number;
  /** Desde cuándo le toca. */
  desde: number;
  /** En combate: nombre de la entrada de la iniciativa con la que actúa (un jugador puede llevar dos personajes). */
  entrada?: string;
}

/** Una página en segundo plano late poco: se da bastante margen antes de dar a alguien por ausente. */
export const ACTIVO_MS = 150_000;
/** Cuánto hay que esperar a quien tiene el turno (y sigue conectado) antes de poder saltarlo. */
export const ESPERA_SALTO_MS = 120_000;

export const ordenInicial = (): Orden => ({ modo: "turnos", turno: "", ronda: 1, desde: 0 });

export const activo = (j: Jugador, ahora: number) => ahora - (j.visto || 0) < ACTIVO_MS;

/** Los jugadores sentados a la mesa, en el orden en que llegaron. */
export function ordenar(js: Jugador[]): Jugador[] {
  return js.filter((j) => j.nombre).sort((a, b) => (a.entrada || 0) - (b.entrada || 0) || a.id.localeCompare(b.id));
}

/** Los que participan en la ronda: los conectados (y quien tiene el turno, aunque se haya ido). */
export function enRonda(js: Jugador[], o: Orden, ahora: number): Jugador[] {
  return ordenar(js).filter((j) => activo(j, ahora) || j.id === o.turno);
}

/** ¿Se juega por turnos? Con un solo jugador no hay nada que ordenar. */
export function porTurnos(js: Jugador[], o: Orden, ahora: number): boolean {
  return o.modo !== "libre" && enRonda(js, o, ahora).length > 1;
}

/** A quién le toca ahora: el guardado, o el primero conectado si aún no hay turno (o se fue de la lista). */
export function quienToca(js: Jugador[], o: Orden, ahora: number): Jugador | null {
  const l = ordenar(js);
  if (!l.length) return null;
  return l.find((j) => j.id === o.turno) ?? l.find((j) => activo(j, ahora)) ?? l[0];
}

export interface Siguiente {
  jugador: Jugador;
  /** Con este paso se completa la ronda y empieza otra. */
  nuevaRonda: boolean;
}

/**
 * A quién pasa la palabra: el siguiente conectado en el orden; al dar la vuelta, empieza otra ronda.
 * `conProgramada`: ids de jugadores desconectados con una acción programada por ejecutar: también cuentan (su turno no se salta).
 */
export function siguiente(js: Jugador[], actualId: string, ahora: number, conProgramada?: ReadonlySet<string>): Siguiente | null {
  const l = ordenar(js).filter((j) => activo(j, ahora) || j.id === actualId || !!conProgramada?.has(j.id));
  if (!l.length) return null;
  const i = l.findIndex((j) => j.id === actualId);
  if (i < 0) return { jugador: l[0], nuevaRonda: false };
  const n = (i + 1) % l.length;
  return { jugador: l[n], nuevaRonda: n <= i };
}

/** ¿Puede este jugador saltar el turno del que le toca? Si éste se fue, enseguida; si sigue ahí, tras esperar. */
export function puedeSaltar(js: Jugador[], o: Orden, yoId: string, ahora: number, conProgramada?: ReadonlySet<string>): boolean {
  const t = quienToca(js, o, ahora);
  if (!t || t.id === yoId) return false;
  if (conProgramada?.has(t.id)) return false; // tiene una acción programada: se ejecuta, no se salta
  return !activo(t, ahora) || (o.desde > 0 && ahora - o.desde >= ESPERA_SALTO_MS);
}

export interface InfoTurno {
  actuante: string;
  /** Nombres en el orden de la ronda. */
  orden: string[];
  ronda: number;
  /** Quien recibe la palabra después. */
  siguiente: string;
  /** El actuante es el último de la ronda. */
  cierraRonda: boolean;
  /** El actuante aún no tiene personaje guardado. */
  creando?: boolean;
  /** Personajes de jugadores ausentes que el actuante lleva ahora (control prestado). */
  controla?: { personaje: string; dueno: string }[];
  /** Solo en combate (modo turnos): la mesa sigue la iniciativa. Sin esto, el texto es el de siempre. */
  combate?: InfoCombate;
  /** La acción de este turno es una acción programada antes de tener la palabra. */
  preparada?: boolean;
  /** Solo en combate: reacciones preparadas de jugadores con la reacción libre (ya resumidas por `textoReaccionesPreparadas`). */
  reacciones?: string;
}

export interface InfoCombate {
  /** Asalto del motor (no es la ronda de la mesa). */
  asalto: number;
  orden: { nombre: string; tipo: TipoEntrada; tocaAlDM: boolean }[];
  /** Turnos de no-jugadores que el DM resuelve en su respuesta, entre el actuante y el siguiente jugador. */
  resolverAntes: { nombre: string; tipo: TipoEntrada; motivo?: string; nuevoAsalto?: boolean }[];
  /** Tras ellos se acaba la ronda de iniciativa (el siguiente jugador ya es del asalto siguiente). */
  cierraAsalto: boolean;
  /** Entrada de la iniciativa con la que actúa el actuante (para marcarla en el orden). */
  entrada?: string;
}

/** Lo que se le dice al DM de la secuencia, para que narre una acción cada vez y dé la palabra bien. */
export function bloqueTurnos(t: InfoTurno): string {
  const lleva = t.controla?.length
    ? [`${t.actuante} LLEVA ahora ${t.controla.map((c) => `a ${c.personaje} (cuyo jugador, ${c.dueno}, está ausente)`).join(" y ")}: sus acciones son las de ${t.controla.length === 1 ? "ese personaje" : "esos personajes"}. Aplica lo que diga a ${t.controla.map((c) => c.personaje).join(" / ")} (tiras, daños, objetos y heridas son de ${t.controla.length === 1 ? "él" : "ellos"}), no a un personaje propio de ${t.actuante}.`]
    : [];
  if (t.creando)
    return [
      "# TURNOS (la mesa juega por turnos: una acción cada vez, en orden)",
      `Orden de la ronda ${t.ronda}: ${t.orden.join(" → ")}.`,
      `${t.actuante} está CREANDO su personaje (aún no tiene ficha guardada). Dile que pulse «📜 Crear personaje» (formulario que lo pide todo de una vez) o, si prefiere escribirlo, guíale con todas las opciones válidas a la vez, solo a él, y NO pases la palabra a nadie: el turno sigue siendo suyo hasta que su ficha esté completa. Cuando tengas todos los datos, guárdala con guardar_personaje (jugador: «${t.actuante}») y entonces sí, cierra el turno dando la palabra a ${t.siguiente}. No avances la trama ni mandes a los demás.`,
    ].join("\n");
  if (t.combate) return bloqueCombate(t, lleva);
  return [
    "# TURNOS (la mesa juega por turnos: una acción cada vez, en orden)",
    `Orden de la ronda ${t.ronda}: ${t.orden.join(" → ")}.`,
    ...lleva,
    `Acaba de actuar: ${t.actuante}. Narra SOLO su acción y su consecuencia inmediata (tiradas, heridas, lo que dicen los PNJ). No hables, decidas ni muevas a los demás jugadores, y no avances el tiempo más allá de lo que dura su acción.`,
    t.cierraRonda
      ? `${t.actuante} es el último de la ronda: tras narrar su acción, cierra la ronda: el mundo responde (los enemigos y los PNJ actúan, pasa el tiempo, la amenaza avanza) y la trama avanza un paso. Luego da la palabra a ${t.siguiente}, que abre la ronda siguiente.`
      : `Termina dándole la palabra a ${t.siguiente} por su nombre («¿Qué hace ${t.siguiente}?»), y deja abierta la situación para que le toque actuar.`,
    ...(t.preparada ? [REGLA_PREPARADA] : []),
  ].join("\n");
}

/** Una acción programada es una intención de antes: el DM la juzga con la situación de ahora. */
export const REGLA_PREPARADA = "Una acción preparada es una intención de antes: si la situación ha cambiado y ya no es posible o no tiene sentido, no la ejecutes; cuéntale qué cambió y deja que elija otra.";
const REGLA_REACCIONES = "Cuando resuelvas turnos de enemigos que encajen con una reacción preparada de un jugador cuya reacción no se haya gastado, aplícala con las herramientas (reaccion, o atacar con reaccion: true…) y cuéntalo.";

const ETIQUETA: Record<TipoEntrada, string> = { pj: "PJ", enemigo: "criatura", pnj: "PNJ" };

/** El orden de la iniciativa en una línea: quien actúa va en negrita y MAYÚSCULAS; las rachas largas de no-jugadores se resumen. */
function lineaOrden(c: InfoCombate): string {
  const ps: string[] = [];
  let racha: string[] = [];
  const vaciar = () => {
    if (racha.length > 3) ps.push(`${racha[0]}, ${racha[1]}… (+${racha.length - 2})`);
    else ps.push(...racha);
    racha = [];
  };
  for (const e of c.orden) {
    if (c.entrada && igual(e.nombre, c.entrada)) { vaciar(); ps.push(`**${e.nombre.toUpperCase()}**`); }
    else if (e.tocaAlDM && e.tipo !== "pj") racha.push(e.nombre);
    else { vaciar(); ps.push(e.nombre); }
  }
  vaciar();
  return ps.join(" → ");
}

function bloqueCombate(t: InfoTurno, lleva: string[]): string {
  const c = t.combate!;
  const rs = c.resolverAntes;
  const hay = rs.length > 0;
  const lista = rs.length > 6
    ? rs.map((r) => r.nombre).join(", ") + ` (${rs.length} turnos)`
    : rs.map((r) => `${r.nombre} (${r.motivo ?? ETIQUETA[r.tipo]})`).join(", ");
  const nuevos = rs.filter((r) => r.nuevoAsalto);
  const delAsalto = rs.length - nuevos.length;
  const cierre = !c.cierraAsalto
    ? ""
    : nuevos.length
      ? ` Al acabar${delAsalto ? ` con los del asalto ${c.asalto}` : " de narrar su acción"}, llama UNA vez a siguiente_asalto (empieza el asalto ${c.asalto + 1}) y sigue con: ${nuevos.map((r) => r.nombre).join(", ")}.`
      : ` Tras ellos el asalto ${c.asalto} termina y empieza el ${c.asalto + 1}: el programa avanza el asalto solo; NO llames a siguiente_asalto.`;
  return [
    "# TURNOS DE COMBATE (iniciativa; la mesa sigue este orden)",
    `Asalto ${c.asalto}: ${lineaOrden(c)}.`,
    ...lleva,
    `Acaba de actuar: ${t.actuante}. 1) Narra SOLO su acción y su consecuencia inmediata; no decidas por los demás jugadores. 2) ${hay ? `Después resuelve, en este mismo mensaje y en este orden, el turno de: ${lista} — cada uno con UNA sola acción (atacar/hechizo/habilidad; el programa rechaza el exceso), sin dar la palabra mientras no acabes.` : "Nadie más actúa entre él y el siguiente jugador."} 3) Entrega la palabra a ${t.siguiente} por su nombre. No resuelvas a quienes van después de ${t.siguiente}.${cierre}`,
    ...(t.reacciones ? [t.reacciones, REGLA_REACCIONES] : []),
    ...(t.preparada ? [REGLA_PREPARADA] : []),
  ].join("\n");
}

/** Mensaje al jugador que intenta hablar fuera de su turno (cuando no puede programar su acción: aún se está sentando a la mesa). */
export function textoFueraDeTurno(quien: string): string {
  return `No es tu turno: le toca a ${quien}. Ve preparando tu acción en la caja de texto; podrás enviarla en cuanto te llegue la palabra.`;
}

// ------------------------------------------------------------------ jugadores ausentes
const sinTildes = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

/** Quién lleva a qué personaje: personaje → jugador que lo lleva (control prestado, mientras su dueño está ausente). */
export type Controles = Record<string, string>;
type PartidaT = { personajes: Record<string, { nombre: string; jugador?: string; condiciones: string[] }> };

/** Control prestado que vale AHORA: el personaje está vivo, su dueño ausente y quien lo lleva presente. Al volver el dueño, el control se le devuelve solo. */
export function controlesVigentes(partida: PartidaT, presentes: string[], controles: Controles = {}): Record<string, string> {
  const aqui = new Set(presentes.map(sinTildes));
  const out: Record<string, string> = {};
  for (const [nombre, quien] of Object.entries(controles)) {
    const p = partida.personajes[nombre];
    if (!p || !quien || p.condiciones.includes("muerto")) continue;
    if (p.jugador && aqui.has(sinTildes(p.jugador))) continue; // su dueño está aquí
    if (!aqui.has(sinTildes(quien))) continue; // quien lo llevaba se fue
    out[nombre] = quien;
  }
  return out;
}

/** Personajes que lleva un jugador por control prestado. */
export const personajesLlevadosPor = (partida: PartidaT, jugador: string, presentes: string[], controles: Controles = {}): string[] =>
  Object.entries(controlesVigentes(partida, presentes, controles)).filter(([, q]) => sinTildes(q) === sinTildes(jugador)).map(([n]) => n);

/** Personajes cuyo jugador está ausente y que ningún otro jugador lleva (los lleva el DM como PNJ aliados). */
export function personajesAusentes(partida: PartidaT, presentes: string[], controles: Controles = {}): string[] {
  const aqui = new Set(presentes.map(sinTildes));
  const prestados = controlesVigentes(partida, presentes, controles);
  return Object.values(partida.personajes)
    .filter((p) => p.jugador && !p.condiciones.includes("muerto") && !aqui.has(sinTildes(p.jugador)) && !prestados[p.nombre])
    .map((p) => p.nombre);
}

/** Personajes que un jugador podría tomar: de jugadores ausentes, vivos y sin otro jugador que los lleve ya. */
export function personajesTomables(partida: PartidaT, presentes: string[], controles: Controles = {}): string[] {
  return personajesAusentes(partida, presentes, controles);
}

/** Lo que se le dice al DM de los personajes de jugadores ausentes y de quien acaba de volver. */
export function bloqueAusentes(partida: PartidaT, presentes: string[], volvieron: string[] = [], controles: Controles = {}): string {
  const llevados = personajesAusentes(partida, presentes, controles);
  const prestados = Object.entries(controlesVigentes(partida, presentes, controles));
  const lineas: string[] = [];
  if (prestados.length)
    lineas.push(
      "# PERSONAJES LLEVADOS POR OTRO JUGADOR (control prestado)",
      ...prestados.map(([n, q]) => `- ${n} (de ${partida.personajes[n]?.jugador}, ausente) lo lleva ahora ${q}: ${q} decide sus acciones. No lo muevas tú ni hables por él; si ${partida.personajes[n]?.jugador} vuelve, recupera el control.`),
    );
  if (llevados.length)
    lineas.push(
      "# PERSONAJES LLEVADOS POR EL DM (su jugador está ausente)",
      `Los jugadores de ${llevados.map((n) => `${n} (${partida.personajes[n]?.jugador})`).join(", ")} no están en la mesa: mientras dure su ausencia tú llevas a sus personajes como PNJ aliados.`,
      "- Tú tiras por ellos y decides sus acciones con las herramientas de siempre (atacar, prueba, hechizos…), en su iniciativa y sin esperar a nadie.",
      "- Actúan acorde a su ficha, clase y personalidad, de forma cooperativa y prudente: siguen al grupo, ayudan en combate, se defienden y curan si pueden.",
      "- No gastan recursos únicos ni objetos valiosos sin necesidad, y no toman decisiones irreversibles o de peso (jurar o romper un juramento, vender o regalar objetos, traicionar, aceptar un behelit, dar su nombre, subir de nivel eligiendo dote o aumento…): si se les plantea, quedan en suspenso o siguen lo que haga el grupo.",
      "- No hablan largo por el jugador ni revelan sus secretos; no los sacrifiques sin motivo ni los protejas de más: corren los mismos riesgos que si estuvieran.",
    );
  if (volvieron.length)
    lineas.push(`# HAN VUELTO A LA MESA: ${volvieron.join(", ")}. Recuperan el control de sus personajes: cuéntales en una o dos frases lo que hicieron mientras estaban fuera.`);
  return lineas.join("\n");
}

// ------------------------------------------------------------------ combate: la mesa sigue la iniciativa
export type TipoEntrada = "pj" | "enemigo" | "pnj";

export interface EntradaCombate {
  nombre: string;
  tipo: TipoEntrada;
  /** Jugador humano que actúa por esta entrada (dueño presente, o quien lleva el personaje por control prestado). */
  jugador?: string;
  /** El DM resuelve este turno: criaturas, PNJ, personajes de ausentes, caídos o incapacitados, y sorprendidos en el asalto 1. */
  tocaAlDM: boolean;
  motivo?: string;
  /** Solo para pintar la barra: «ileso/herido/malherido» de criaturas y PNJ (sin cifras); en los PJ, ☠ (0 PV) o 💤 (incapacitado o sorprendido). */
  estado?: string;
}

const estadoPublico = (pv: number | undefined, max: number | undefined): string | undefined =>
  pv === undefined ? undefined : max === undefined || pv >= max ? "ileso" : pv > max / 2 ? "herido" : "malherido";

/**
 * La iniciativa completa del combate en curso, en el orden de `combate.orden` (mayor iniciativa primero), con quién
 * resuelve cada turno. Sin combate, lista vacía. Quien ya no está en escena (criatura o PNJ caído, personaje muerto) se omite.
 * `asalto`: el asalto al que se refiere (por omisión el actual); la sorpresa solo cuenta en el primero.
 */
export function ordenDeCombate(partida: Partida, presentes: string[], controles: Controles = {}, asalto?: number): EntradaCombate[] {
  const c = partida.combate;
  if (!c) return [];
  const n = asalto ?? c.ronda;
  const aqui = new Set(presentes.map(sinTildes));
  const prestados = controlesVigentes(partida, presentes, controles);
  const out: EntradaCombate[] = [];
  for (const o of c.orden) {
    let cb: Combatiente;
    try { cb = localizar(partida, o.nombre); } catch { continue; } // ya no está en escena
    const inc = efectos(condsDe(cb));
    const sorprendido = n === 1 && !!c.sorprendidos?.some((s) => igual(s, cb.nombre));
    if (cb.tipo === "pj") {
      if (cb.p.condiciones.includes("muerto")) continue;
      const dueno = cb.p.jugador && aqui.has(sinTildes(cb.p.jugador)) ? cb.p.jugador : prestados[cb.nombre];
      const caido = cb.p.pv <= 0;
      const motivo = caido ? "a 0 PV: el DM resuelve su salvación contra muerte" : inc.incapacitado ? `incapacitado (${inc.motivos.join(", ")}): no actúa` : sorprendido ? "sorprendido: pierde su turno del asalto 1" : !dueno ? `su jugador${cb.p.jugador ? `, ${cb.p.jugador},` : ""} está ausente: lo lleva el DM` : undefined;
      out.push({ nombre: cb.nombre, tipo: "pj", ...(dueno ? { jugador: dueno } : {}), tocaAlDM: !dueno || caido || inc.incapacitado || sorprendido, ...(motivo ? { motivo } : {}), ...(caido ? { estado: "☠" } : inc.incapacitado || sorprendido ? { estado: "💤" } : {}) });
      continue;
    }
    if (cb.tipo === "criatura" ? cb.j.pv <= 0 : (cb.n.pv ?? 1) <= 0) continue;
    const motivo = inc.incapacitado ? `incapacitado (${inc.motivos.join(", ")}): no actúa` : sorprendido ? "sorprendido: no actúa en el asalto 1" : undefined;
    out.push({
      nombre: cb.nombre, tipo: cb.tipo === "criatura" ? "enemigo" : "pnj", tocaAlDM: true, ...(motivo ? { motivo } : {}),
      ...(cb.tipo === "criatura" ? { estado: estadoPublico(cb.j.pv, cb.j.pv_max) } : { estado: estadoPublico(cb.n.pv, cb.n.pv_max) }),
    });
  }
  return out;
}

export interface SiguienteCombate {
  /** El siguiente jugador humano que debe actuar (si no queda otro, el propio actuante). */
  jugador: string;
  /** Su entrada en la iniciativa (el personaje con el que actúa). */
  entrada: string;
  /** Los turnos del DM entre el actuante y ese jugador, en orden. `nuevoAsalto`: ya pertenecen al asalto siguiente. */
  resolverAntes: (EntradaCombate & { nuevoAsalto?: boolean })[];
  /** Tras esos turnos se acaba la ronda de iniciativa: el siguiente jugador ya es del asalto N+1 (o no queda ninguno más). */
  cierraAsalto: boolean;
  /** Asalto actual del motor. */
  asalto: number;
  /** Entrada del actuante en la iniciativa. */
  entradaActuante: string;
  /** La iniciativa completa (para pintarla o dársela al DM). */
  orden: EntradaCombate[];
}

/**
 * Dado el jugador que actúa, a quién se da la palabra en combate: el siguiente jugador humano (saltando las entradas
 * que resuelve el DM) y los turnos del DM que quedan entre ambos. `entrada` fija con qué personaje actúa si lleva más de uno.
 * Devuelve null si no hay combate o el actuante no está en la iniciativa (entonces rige el orden normal de la mesa).
 */
export function siguienteEnCombate(partida: Partida, presentes: string[], controles: Controles, actuante: string, entrada?: string): SiguienteCombate | null {
  const c = partida.combate;
  if (!c) return null;
  const A = ordenDeCombate(partida, presentes, controles, c.ronda);
  if (!A.length) return null;
  const B = ordenDeCombate(partida, presentes, controles, c.ronda + 1); // mismas posiciones; solo cambia la sorpresa
  const suyo = (e: EntradaCombate) => !!e.jugador && sinTildes(e.jugador) === sinTildes(actuante);
  let i = entrada ? A.findIndex((e) => igual(e.nombre, entrada) && suyo(e)) : -1;
  if (i < 0) i = A.findIndex((e) => suyo(e) && !e.tocaAlDM);
  if (i < 0) i = A.findIndex(suyo);
  if (i < 0) return null;
  const N = A.length;
  const resolverAntes: SiguienteCombate["resolverAntes"] = [];
  for (let k = 1; k <= N; k++) {
    const envuelve = i + k >= N;
    const e = (envuelve ? B : A)[(i + k) % N];
    if (!e.tocaAlDM) return { jugador: e.jugador!, entrada: e.nombre, resolverAntes, cierraAsalto: envuelve, asalto: c.ronda, entradaActuante: A[i].nombre, orden: A };
    resolverAntes.push({ ...e, ...(envuelve ? { nuevoAsalto: true } : {}) });
  }
  // Nadie más puede actuar (todos caídos o del DM): la palabra vuelve al propio actuante, y el DM resuelve a todos.
  return { jugador: A[i].jugador!, entrada: A[i].nombre, resolverAntes, cierraAsalto: true, asalto: c.ronda, entradaActuante: A[i].nombre, orden: A };
}

// ------------------------------------------------------------------ acciones programadas y reacciones preparadas
// Un jugador puede dejar su acción escrita antes de tener la palabra (se envía sola en su turno) y una reacción preparada
// (persistente mientras dure el combate). La página las guarda en `programadas/<idJugador>` con la forma de `Programada`.

/** Cuántas rondas (de mesa; asaltos si se programó en combate) puede esperar una acción programada. */
export const MAX_RONDAS_PROGRAMADA = 2;
/** Tope de la reacción preparada (una línea) y de todas las reacciones juntas en el bloque del DM. */
export const MAX_REACCION = 140;
export const MAX_REACCIONES_BLOQUE = 300;
/** Una programada abandonada (sesión muerta) caduca por antigüedad aunque la ronda no avance. */
export const MAX_EDAD_PROGRAMADA_MS = 12 * 3_600_000;

export interface Programada {
  /** Acción programada ("" si solo hay reacción preparada). */
  texto: string;
  /** Reacción preparada: persiste mientras dure el combate. */
  reaccion?: string;
  ts: number;
  /** Ronda de la mesa al programar la acción. */
  ronda: number;
  /** Asalto del combate al programar la acción; ausente si se programó fuera de combate. */
  asalto?: number;
  /** Asalto en que se dejó la reacción (siempre en combate). */
  reaccionAsalto?: number;
}

/** Dónde está la mesa ahora: ronda de la mesa y, en combate, asalto del motor. */
export interface ContextoProgramada {
  ahora?: number;
  ronda: number;
  asalto?: number;
}

const limpia = (t: string | undefined, max: number) => String(t ?? "").replace(/[«»]/g, '"').replace(/\s+/g, " ").trim().slice(0, max);

export type ResultadoProgramar = { ok: true; programada: Programada } | { ok: false; motivo: string };

/**
 * Programa (o sustituye) la acción de un jugador y/o su reacción preparada. Una sola programada por jugador: la nueva sustituye a la anterior.
 * `texto` undefined deja la acción como estaba; `reaccion` undefined deja la reacción como estaba y "" la quita.
 * La reacción solo se admite en combate (`ctx.asalto` definido).
 */
export function programarAccion(previa: Programada | null | undefined, entrada: { texto?: string; reaccion?: string }, ctx: ContextoProgramada): ResultadoProgramar {
  const p: Programada = previa ? { ...previa } : { texto: "", ts: ctx.ahora ?? Date.now(), ronda: ctx.ronda };
  if (entrada.texto !== undefined) {
    const t = entrada.texto.trim();
    if (!t) return { ok: false, motivo: "Escribe qué haces para programarlo." };
    if (t.length > MAX_ACCION) return { ok: false, motivo: `La acción es demasiado larga (máximo ${MAX_ACCION} caracteres).` };
    p.texto = t; p.ts = ctx.ahora ?? Date.now(); p.ronda = ctx.ronda;
    if (ctx.asalto !== undefined) p.asalto = ctx.asalto; else delete p.asalto;
  }
  if (entrada.reaccion !== undefined) {
    const r = limpia(entrada.reaccion, MAX_REACCION);
    if (r && ctx.asalto === undefined) return { ok: false, motivo: "La reacción preparada solo se deja durante un combate." };
    if (r) { p.reaccion = r; p.reaccionAsalto = ctx.asalto; } else { delete p.reaccion; delete p.reaccionAsalto; }
  }
  if (!p.texto && !p.reaccion) return { ok: false, motivo: "No hay nada que programar." };
  return { ok: true, programada: p };
}

/** ¿Ha caducado la ACCIÓN programada? Si el combate acabó (o empezó otro, o uno que no estaba), si pasaron más de 2 rondas, o por antigüedad. */
export function caducada(p: Programada, ctx: ContextoProgramada): boolean {
  if (ctx.ahora !== undefined && ctx.ahora - p.ts > MAX_EDAD_PROGRAMADA_MS) return true;
  if (p.asalto !== undefined) {
    // Programada en combate: vale mientras siga ese combate, y hasta 2 asaltos después.
    if (ctx.asalto === undefined || ctx.asalto < p.asalto) return true;
    return ctx.asalto - p.asalto > MAX_RONDAS_PROGRAMADA;
  }
  if (ctx.asalto !== undefined) return true; // programada antes de que empezara el combate: ya es otra situación
  return ctx.ronda - p.ronda > MAX_RONDAS_PROGRAMADA;
}

/** ¿Sigue vigente la REACCIÓN preparada? Solo mientras dure el combate. */
export function reaccionVigente(p: Programada, ctx: ContextoProgramada): boolean {
  if (!p.reaccion || ctx.asalto === undefined) return false;
  return p.reaccionAsalto === undefined || ctx.asalto >= p.reaccionAsalto;
}

/** ¿Está caído (0 PV, incapacitado) o muerto el personaje con el que actúa el jugador? Si lleva varios y `entrada` no lo aclara, solo si lo están todos. */
export function jugadorCaido(partida: Partida, jugador: string, entrada?: string): boolean {
  const mios = Object.values(partida.personajes).filter((p) => p.jugador && sinTildes(p.jugador) === sinTildes(jugador));
  const elegidos = entrada ? mios.filter((p) => igual(p.nombre, entrada)) : [];
  const candidatos = elegidos.length ? elegidos : mios;
  if (!candidatos.length) return true;
  return candidatos.every((p) => p.condiciones.includes("muerto") || p.pv <= 0 || efectos(p.condiciones).incapacitado);
}

/** ¿Hay que entregar ahora esta acción programada? Con texto, sin caducar y con el personaje en pie (si no, ese turno lo resuelve el DM). */
export function debeEntregarse(p: Programada | null | undefined, ctx: ContextoProgramada, caido: boolean): boolean {
  return !!p && !!p.texto.trim() && !caducada(p, ctx) && !caido;
}

/** Lo que se guarda tras entregar la acción: la reacción preparada sigue (si el combate sigue); si no hay nada más, el documento se borra (null). */
export function restoTrasEntregar(p: Programada, ctx: ContextoProgramada): Programada | null {
  if (!reaccionVigente(p, ctx)) return null;
  const { texto: _t, ts: _s, ronda: _r, asalto: _a, ...resto } = p;
  return { ...resto, texto: "", ts: p.ts, ronda: p.ronda };
}

/** Ids de los jugadores con una acción programada por ejecutar (si están desconectados, su turno no se salta). */
export function idsConProgramada(progs: Record<string, Programada>, ctx: ContextoProgramada, partida: Partida, jugadores: { id: string; nombre: string }[]): Set<string> {
  const out = new Set<string>();
  for (const j of jugadores) {
    const p = progs[j.id];
    if (p && debeEntregarse(p, ctx, jugadorCaido(partida, j.nombre))) out.add(j.id);
  }
  return out;
}

/** Línea de una acción para el DM: «Ana: texto», o, si la programó antes de tener la palabra, «Ana (acción preparada antes, de cuando aún no era su turno): texto». */
export const lineaAccion = (a: { nombre: string; texto: string; programada?: boolean }): string =>
  a.programada ? `${a.nombre} (acción preparada antes, de cuando aún no era su turno): ${a.texto}` : `${a.nombre}: ${a.texto}`;

/**
 * «Reacciones preparadas: Ana: «…»; Beto: «…»» de los jugadores en combate cuya reacción está libre este asalto (máx. ~300 caracteres).
 * Vacío si no hay ninguna. `progs` va por nombre de jugador.
 */
export function textoReaccionesPreparadas(partida: Partida, progs: Record<string, Pick<Programada, "reaccion" | "reaccionAsalto">>): string {
  const c = partida.combate;
  if (!c) return "";
  const gastada = (nombre: string) => {
    const k = Object.keys(c.turnos ?? {}).find((x) => igual(x, nombre));
    return !!(k && c.turnos![k].reaccion);
  };
  const piezas: string[] = [];
  for (const [jugador, p] of Object.entries(progs)) {
    if (!reaccionVigente({ texto: "", ts: 0, ronda: 0, ...p }, { ronda: 0, asalto: c.ronda })) continue;
    // Algún personaje suyo en el orden de iniciativa, vivo, consciente y con la reacción sin gastar.
    const libre = c.orden.some((o) => {
      let cb: Combatiente;
      try { cb = localizar(partida, o.nombre); } catch { return false; }
      return cb.tipo === "pj" && !!cb.p.jugador && sinTildes(cb.p.jugador) === sinTildes(jugador) && !cb.p.condiciones.includes("muerto") && cb.p.pv > 0 && !efectos(condsDe(cb)).incapacitado && !gastada(cb.nombre);
    });
    if (libre) piezas.push(`${jugador}: «${limpia(p.reaccion, MAX_REACCION)}»`);
  }
  if (!piezas.length) return "";
  let linea = "Reacciones preparadas: ";
  const cabe: string[] = [];
  for (const x of piezas) {
    if ((linea + [...cabe, x].join("; ")).length > MAX_REACCIONES_BLOQUE) break;
    cabe.push(x);
  }
  if (!cabe.length) cabe.push(piezas[0].slice(0, MAX_REACCIONES_BLOQUE - linea.length - 2) + "…»");
  return linea + cabe.join("; ") + (cabe.length < piezas.length ? "…" : ".");
}

/**
 * Cuántos turnos faltan para el jugador y quién va antes: «Eres el siguiente tras Aldo» / «Faltan 2 turnos para ti».
 * `yo`: posiciones del jugador en el orden (puede llevar dos personajes); se toma la más cercana. Vacío si es su turno o no se sabe.
 */
export function textoCuentaAtras(orden: { nombre: string }[], actual: number, yo: number | number[]): string {
  const N = orden.length;
  const mias = (Array.isArray(yo) ? yo : [yo]).filter((i) => i >= 0 && i < N);
  if (actual < 0 || actual >= N || !mias.length || mias.includes(actual)) return "";
  const faltan = Math.min(...mias.map((i) => (((i - actual) % N) + N) % N)); // turnos hasta el mío, contando el actual como 0
  return faltan === 1 ? `Eres el siguiente tras ${orden[actual].nombre}` : `Faltan ${faltan} turnos para ti`;
}
