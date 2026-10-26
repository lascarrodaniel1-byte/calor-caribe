// Combate montado: montar, desmontar, caer de la montura y la ventaja de cargar desde lo alto.
import { agregarCondicion } from "./condiciones.js";
import { localizar, condsDe } from "./combate.js";
import type { Partida, Personaje } from "./estado.js";
import { caida } from "./maniobras.js";
import { salvacion } from "./reglas.js";
import { motivoNoActua } from "./condiciones.js";

export interface Montura {
  nombre: string;
  /** controlada: actúa en la iniciativa del jinete y solo corre, se retira o esquiva; independiente: lo suyo. */
  control: "controlada" | "independiente";
  /** Mayor que quien va a pie (un caballo, un oso): da ventaja al jinete contra los de a pie. */
  grande: boolean;
  /** Es una criatura o PNJ de la escena (si cae, el jinete cae con ella). */
  enEscena?: boolean;
}

const norm = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
const jinete = (partida: Partida, n: string): Personaje => {
  const p = Object.values(partida.personajes).find((x) => norm(x.nombre) === norm(n) || (x.jugador && norm(x.jugador) === norm(n)));
  if (!p) throw new Error(`No hay ningún personaje «${n}».`);
  return p;
};

export interface DatosMontura {
  accion: "montar" | "desmontar" | "caer";
  jinete: string;
  montura?: string;
  control?: "controlada" | "independiente";
  grande?: boolean;
  motivo?: string;
}

/** ¿Sigue en pie lo que monta? (sin criatura o PNJ de escena, se da por vivo). */
function montaViva(partida: Partida, m: Montura): boolean {
  if (!m.enEscena) return true;
  try {
    const c = localizar(partida, m.nombre);
    return c.tipo === "criatura" ? c.j.pv > 0 : c.tipo === "pnj" ? c.n.pv === undefined || c.n.pv > 0 : true;
  } catch { return false; } // ya no está en escena: murió y salió del combate
}

export function montura(partida: Partida, d: DatosMontura): string {
  const p = jinete(partida, d.jinete);
  if (d.accion === "montar") {
    const no = motivoNoActua(p);
    if (no) throw new Error(`${no}: no puede montar.`);
    if (p.montura) throw new Error(`${p.nombre} ya va montado en ${p.montura.nombre}.`);
    if (!d.montura) throw new Error("montar: di la montura.");
    let enEscena = false;
    try { const c = localizar(partida, d.montura); enEscena = c.tipo !== "pj"; if (c.tipo === "pj") throw new Error("Un personaje jugador no es una montura."); if (!montaViva(partida, { nombre: c.nombre, control: "controlada", grande: true, enEscena: true })) throw new Error(`${c.nombre} ha caído.`); } catch (e) { if (e instanceof Error && /Un personaje|ha caído/.test(e.message)) throw e; }
    const nombreMontura = d.montura;
    p.montura = { nombre: nombreMontura, control: d.control ?? "controlada", grande: d.grande ?? true, enEscena };
    return `${p.nombre} monta ${nombreMontura} (${p.montura.control}${p.montura.grande ? ", grande" : ""}). Subir cuesta la mitad de su movimiento. ${p.montura.control === "controlada" ? "La montura actúa en la iniciativa del jinete y solo puede correr, retirarse o esquivar." : "La montura actúa por su cuenta, con su propia iniciativa."} Cuerpo a cuerpo contra los de a pie (más pequeños que la montura): ventaja.`;
  }
  if (!p.montura) throw new Error(`${p.nombre} no va montado.`);
  if (d.accion === "desmontar") {
    const n = p.montura.nombre;
    delete p.montura;
    return `${p.nombre} desmonta de ${n} (cuesta la mitad de su movimiento).`;
  }
  return caerDeLaMontura(partida, p, d.motivo ?? "lo derriban de la montura");
}

/** Cae de la montura: salvación de DES CD 10 o cae derribado y se hace daño (1,5 m); si aguanta, aterriza de pie. */
export function caerDeLaMontura(partida: Partida, p: Personaje, motivo: string): string {
  const n = p.montura?.nombre ?? "la montura";
  delete p.montura;
  const s = salvacion(p, "des", 10);
  const lineas = [`${p.nombre} se cae de ${n} (${motivo}): ${s.texto}.`];
  if (s.exito) { lineas.push(`${p.nombre} aterriza de pie junto a ${n}.`); return lineas.join("\n"); }
  lineas.push(caida(partida, { quien: p.nombre, metros: 3 }));
  agregarCondicion(p.condiciones, "derribado");
  return lineas.join("\n");
}

/** Tras cada herramienta: quien iba sobre una montura que ha caído o ha muerto, cae con ella. */
export function revisarMonturas(partida: Partida): string[] {
  const out: string[] = [];
  for (const p of Object.values(partida.personajes)) {
    if (!p.montura || p.condiciones.includes("muerto")) continue;
    if (!montaViva(partida, p.montura)) out.push(caerDeLaMontura(partida, p, `${p.montura.nombre} ha caído`));
  }
  return out;
}

/** Ventaja del jinete con montura grande contra un enemigo a pie (no montado) y de un cuerpo a cuerpo. */
export function ventajaMontada(partida: Partida, atacante: string, objetivo: string, distancia: boolean): string | null {
  if (distancia) return null;
  const a = Object.values(partida.personajes).find((x) => norm(x.nombre) === norm(atacante));
  if (!a?.montura?.grande) return null;
  const o = Object.values(partida.personajes).find((x) => norm(x.nombre) === norm(objetivo));
  if (o?.montura) return null;
  try { if (localizar(partida, objetivo).tipo === "criatura") return null; } catch { /* PNJ o nada */ }
  return `ventaja: ${a.nombre} ataca desde ${a.montura.nombre} a alguien a pie`;
}

export const REGLAS_MONTURA = `## Combate montado
- Montar y desmontar cuestan la mitad del movimiento (montura {accion: montar|desmontar, jinete, montura, control, grande}). Una montura entrenada (controlada) actúa en la iniciativa del jinete y solo corre, se retira o esquiva; una independiente (un grifo, un lobo de guerra) tiene su turno y sus ataques. El jinete a caballo ataca cuerpo a cuerpo con ventaja a quien va a pie y es más pequeño que la montura (lo aplica el programa si grande=true).
- Si derriban a la montura, la matan o la empujan, el jinete cae (montura {accion: caer}; el programa lo hace solo si la montura es una criatura o PNJ de la escena que cae): salvación de DES CD 10 o cae derribado y se hace daño; si la pasa, aterriza de pie. Quien ataca a un jinete puede elegir golpear al jinete o a la montura.`;
