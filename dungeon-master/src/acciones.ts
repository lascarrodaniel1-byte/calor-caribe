// Acciones de combate (esquivar, correr, retirarse, ayudar, preparar…), reacciones y ataques de oportunidad de las
// reglas básicas de D&D 5e. El programa lleva quién ha usado su reacción este asalto, quién esquiva o se retiró y quién
// ayuda a quién, y avisa cuando un movimiento sobre el plano provoca un ataque de oportunidad.
import type { Partida } from "./estado.js";
import { esDegollador } from "./degollador_base.js";
import { condsDe, igual, localizar, puedeActuar, turnoDe, type Combatiente, type DatosAtaque } from "./combate.js";

export const ACCIONES = ["esquivar", "correr", "retirarse", "ayudar", "preparar", "esconderse", "usar_objeto", "otra"] as const;
export type AccionCombate = (typeof ACCIONES)[number];

const ALCANCE = 2; // metros: el cuerpo a cuerpo normal llega a 1,5 m

function exigirCombate(partida: Partida) {
  if (!partida.combate) throw new Error("No hay ningún combate en curso: empieza con iniciativa.");
}

export interface DatosAccionCombate {
  quien: string;
  accion: AccionCombate;
  /** ayudar: a quién; preparar: no se usa. */
  objetivo?: string;
  /** ayudar: contra quién (opcional); preparar: no se usa. */
  contra?: string;
  /** preparar: «cuando…»; otras: descripción. */
  disparador?: string;
  detalle?: string;
}

export function accionCombate(partida: Partida, d: DatosAccionCombate): string {
  exigirCombate(partida);
  const c = localizar(partida, d.quien);
  const motivo = puedeActuar(c);
  if (motivo) throw new Error(motivo + ".");
  const t = turnoDe(partida, c.nombre);
  // Empieza su turno: lo que hizo en el turno anterior caduca.
  t.esquiva = false; t.retirada = false; t.corrio = false;
  switch (d.accion) {
    case "esquivar": {
      t.esquiva = true;
      // Degollador: esquivar le resulta fácil; lo hace como acción adicional si aún la tiene libre.
      if (c.tipo === "pj" && esDegollador(c.p) && !t.adicional) {
        t.adicional = "esquivar";
        return `${c.nombre} esquiva con la soltura de su oficio, como acción adicional (puede además atacar con su acción): hasta su próximo turno los ataques contra él tienen desventaja (si ve al atacante) y tiene ventaja en las salvaciones de DES.`;
      }
      return `${c.nombre} esquiva: hasta su próximo turno los ataques contra él tienen desventaja (si ve al atacante) y tiene ventaja en las salvaciones de DES. Pierde el efecto si queda incapacitado.`;
    }
    case "correr":
      t.corrio = true;
      return `${c.nombre} corre: mueve el doble de su velocidad este turno (suele ser 18 m en vez de 9) y no ataca con esta acción. Muévelo con plano.`;
    case "retirarse":
      t.retirada = true;
      return `${c.nombre} se retira: su movimiento este turno no provoca ataques de oportunidad.`;
    case "ayudar": {
      if (!d.objetivo) throw new Error("ayudar: di a quién ayuda (objetivo) y, si es un ataque, contra quién (contra).");
      const a = localizar(partida, d.objetivo);
      const ta = turnoDe(partida, a.nombre);
      ta.ayuda = { por: c.nombre, ...(d.contra ? { contra: d.contra } : {}) };
      return `${c.nombre} ayuda a ${a.nombre}${d.contra ? ` contra ${d.contra}` : ""}: su próximo ataque (o prueba que ${c.nombre} pueda ayudar) tiene ventaja. Se gasta en cuanto lo usa.`;
    }
    case "preparar": {
      if (!d.disparador || !d.detalle) throw new Error("preparar: di el disparador («cuando el bandido abra la puerta») y qué hará (detalle).");
      if (t.reaccion) throw new Error(`${c.nombre} ya usó su reacción este asalto: no puede preparar una acción.`);
      t.preparada = { disparador: d.disparador, accion: d.detalle };
      return `${c.nombre} prepara: «${d.detalle}» cuando ${d.disparador}. Cuando ocurra, usa reaccion {tipo: "preparada"} (gasta su reacción). Si no ocurre antes de su próximo turno, se pierde.`;
    }
    case "esconderse":
      return `${c.nombre} intenta esconderse: llama a prueba (Sigilo) contra la Percepción pasiva o la prueba de quien busca. No se esconde de quien lo está viendo, y atacar desde el escondite lo revela.`;
    case "usar_objeto":
      return `${c.nombre} usa un objeto como su acción${d.detalle ? `: ${d.detalle}` : ""}. Resuélvelo con la herramienta que corresponda (usar_vial, modificar_personaje…).`;
    default:
      return `${c.nombre}: ${d.detalle ?? "otra acción"}. Resuélvela con la herramienta que corresponda.`;
  }
}

export interface DatosReaccion {
  quien: string;
  tipo: "ataque_oportunidad" | "preparada" | "otra";
  objetivo?: string;
  arma?: string;
  dano?: string;
  detalle?: string;
}

export type AtacarFn = (d: DatosAtaque) => { texto: string; aviso: string };

export function reaccion(partida: Partida, d: DatosReaccion, atacarFn: AtacarFn): { texto: string; aviso: string } {
  exigirCombate(partida);
  const c = localizar(partida, d.quien);
  const motivo = puedeActuar(c);
  if (motivo) throw new Error(motivo + ".");
  const t = turnoDe(partida, c.nombre);
  if (t.reaccion) throw new Error(`${c.nombre} ya usó su reacción este asalto (solo tiene una por asalto; la recupera en el siguiente_asalto).`);
  if (d.tipo === "preparada" && !t.preparada) throw new Error(`${c.nombre} no tiene ninguna acción preparada: usa accion_combate {accion: "preparar"} en su turno.`);
  let cabecera: string;
  let ataque: { texto: string; aviso: string } | null = null;
  if (d.tipo === "ataque_oportunidad") {
    if (!d.objetivo) throw new Error("ataque_oportunidad: di contra quién (objetivo), el que sale de su alcance.");
    const o = localizar(partida, d.objetivo);
    if (turnoDe(partida, o.nombre).retirada) throw new Error(`${o.nombre} se retiró este turno: su movimiento no provoca ataques de oportunidad.`);
    if (d.dano) ataque = atacarFn({ atacante: c.nombre, objetivo: d.objetivo, arma: d.arma, dano: d.dano, reaccion: true });
    cabecera = `⚔ Ataque de oportunidad de ${c.nombre} contra ${d.objetivo}. Reacción gastada.`;
  } else if (d.tipo === "preparada") {
    if (d.objetivo && d.dano) ataque = atacarFn({ atacante: c.nombre, objetivo: d.objetivo, arma: d.arma, dano: d.dano, reaccion: true });
    cabecera = `${c.nombre} ejecuta su acción preparada (${t.preparada!.accion}, al ocurrir «${t.preparada!.disparador}»). Reacción gastada.`;
  } else cabecera = `${c.nombre} usa su reacción${d.detalle ? `: ${d.detalle}` : ""}. Gastada hasta el siguiente asalto.`;
  // Solo si todo salió bien se gasta la reacción (y la acción preparada).
  t.reaccion = true;
  if (d.tipo === "preparada") delete t.preparada;
  const resto = ataque ? `\n${ataque.texto}` : d.tipo === "ataque_oportunidad" ? "\n(Resuélvelo con atacar: un solo ataque cuerpo a cuerpo.)" : "";
  return { texto: cabecera + resto, aviso: ataque ? `${cabecera}\n${ataque.aviso}` : cabecera };
}

/** Posiciones en el plano de los combatientes, para detectar quién sale del alcance de quién. */
export function instantanea(partida: Partida): Record<string, { x: number; y: number }> {
  const out: Record<string, { x: number; y: number }> = {};
  for (const [k, p] of Object.entries(partida.plano?.puntos ?? {})) out[k] = { x: p.x, y: p.y };
  return out;
}

const bando = (c: Combatiente) => (c.tipo === "pj" || (c.tipo === "pnj" && c.n.aliado) ? "jugadores" : "enemigos");

/** Tras mover en el plano durante un combate: ¿quién provoca un ataque de oportunidad y a quién? */
export function provocados(partida: Partida, antes: Record<string, { x: number; y: number }>): string[] {
  if (!partida.combate || !partida.plano) return [];
  const despues = partida.plano.puntos;
  const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
  const nombres = Object.keys(despues).filter((k) => antes[k]);
  const combatientes: Combatiente[] = [];
  for (const k of nombres) {
    try { combatientes.push(localizar(partida, k)); } catch { /* una cosa del plano, no un combatiente */ }
  }
  const avisos: string[] = [];
  for (const m of combatientes) {
    const pa = antes[m.nombre] ?? antes[Object.keys(antes).find((x) => igual(x, m.nombre)) ?? ""];
    const pd = despues[m.nombre] ?? despues[Object.keys(despues).find((x) => igual(x, m.nombre)) ?? ""];
    if (!pa || !pd || (pa.x === pd.x && pa.y === pd.y)) continue;
    if (turnoDe(partida, m.nombre).retirada) continue;
    for (const o of combatientes) {
      if (o === m || bando(o) === bando(m)) continue;
      const oa = antes[o.nombre] ?? antes[Object.keys(antes).find((x) => igual(x, o.nombre)) ?? ""];
      const od = despues[o.nombre] ?? despues[Object.keys(despues).find((x) => igual(x, o.nombre)) ?? ""];
      if (!oa || !od) continue;
      if (dist(pa, oa) <= ALCANCE && dist(pd, od) > ALCANCE) {
        if (puedeActuar(o) !== null || turnoDe(partida, o.nombre).reaccion) continue;
        avisos.push(`⚔ ${m.nombre} sale del alcance de ${o.nombre} sin retirarse: ${o.nombre} puede hacerle un ataque de oportunidad (reaccion {quien: «${o.nombre}», tipo: ataque_oportunidad, objetivo: «${m.nombre}»}).`);
      }
    }
  }
  return avisos;
}

export const REGLAS_ACCIONES = `## Acciones, reacciones y ataques de oportunidad (combate)
- En su turno cada combatiente mueve, hace UNA acción, y puede hacer una acción adicional si algún rasgo se la da. Además tiene UNA reacción por asalto. Las acciones sin ataque —esquivar, correr, retirarse, ayudar, preparar, esconderse, usar un objeto— van con accion_combate (el programa recuerda quién esquiva, quién se retiró y a quién ayuda).
- Esquivar: ataques contra él con desventaja hasta su próximo turno. Retirarse: su movimiento no provoca ataques de oportunidad. Ayudar: el aliado ataca con ventaja. Preparar: dice el disparador y la acción; al ocurrir se ejecuta con reaccion {tipo: preparada}.
- Ataque de oportunidad: quien sale del alcance de un enemigo (más de 1,5 m) sin haberse retirado le da a ese enemigo un ataque cuerpo a cuerpo como reacción. Al mover en el plano durante un combate, el programa te avisa de quién lo provoca; úsalo con reaccion {tipo: ataque_oportunidad}, o decide que el enemigo no puede/quiere. Una reacción por asalto: no se repite hasta siguiente_asalto.
- Quien está incapacitado (aturdido, paralizado, inconsciente…) no tiene acciones ni reacciones.`;
