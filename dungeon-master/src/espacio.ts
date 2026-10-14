// El espacio y el tiempo de la escena, para que el DM no se confunda de sitio ni de hora.
// - PLANO: los puntos de la escena (personajes, PNJ, criaturas y cosas) en metros, con el norte ARRIBA. El DM los coloca y
//   mueve con la herramienta `plano`; el programa calcula quién está a cuánto y hacia dónde de quién y se lo devuelve como verdad.
// - RELOJ: el día y la hora del mundo, que solo avanza con `tiempo` (y con los asaltos y los días de reposo).
import type { Partida } from "./estado.js";
import { DIRECCIONES, NOMBRE_DIRECCION, VECTOR, type Direccion } from "./mapa.js";

export interface Punto {
  x: number;
  y: number;
  tipo: "pj" | "pnj" | "cosa";
  nota?: string;
}

export interface Plano {
  escena: string;
  puntos: Record<string, Punto>;
}

const MAX_PUNTOS = 30;
const sinTildes = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
const r1 = (n: number) => Math.round(n * 10) / 10;

export const planoVacio = (): Plano => ({ escena: "", puntos: {} });

/** Rumbo de a hacia b (el norte es arriba: y menor). */
export function rumbo(a: { x: number; y: number }, b: { x: number; y: number }): { dir: Direccion; metros: number } {
  const dx = b.x - a.x, dy = b.y - a.y;
  const ang = (Math.atan2(dx, -dy) * 180) / Math.PI;
  return { dir: DIRECCIONES[Math.round(((ang + 360) % 360) / 45) % 8], metros: r1(Math.hypot(dx, dy)) };
}

function buscar(plano: Plano, nombre: string): string | undefined {
  const n = sinTildes(nombre);
  const claves = Object.keys(plano.puntos);
  return claves.find((k) => sinTildes(k) === n) ?? claves.find((k) => sinTildes(k).includes(n) || n.includes(sinTildes(k)));
}

/** Nombre canónico (personaje por su nombre o su jugador) y tipo del que se coloca. */
function identificar(partida: Partida, nombre: string): { nombre: string; tipo: Punto["tipo"] } {
  const n = sinTildes(nombre);
  for (const p of Object.values(partida.personajes)) if (sinTildes(p.nombre) === n || (p.jugador && sinTildes(p.jugador) === n)) return { nombre: p.nombre, tipo: "pj" };
  for (const k of Object.keys(partida.pnjs ?? {})) if (sinTildes(k) === n) return { nombre: k, tipo: "pnj" };
  for (const k of [...Object.keys(partida.combate?.pnj ?? {}), ...Object.values(partida.jefes ?? {}).map((j) => j.nombre)]) if (sinTildes(k) === n) return { nombre: k, tipo: "pnj" };
  return { nombre: nombre.trim().slice(0, 50), tipo: "cosa" };
}

export interface DatosPlano {
  escena?: string;
  poner?: { nombre: string; tipo?: Punto["tipo"]; ref?: string; direccion?: Direccion; metros?: number; nota?: string }[];
  mover?: { nombre: string; direccion?: Direccion; hacia?: string; de?: string; metros: number }[];
  quitar?: string[];
}

export function actualizarPlano(partida: Partida, d: DatosPlano): string {
  const plano = (partida.plano ??= planoVacio());
  const log: string[] = [];
  if (d.escena !== undefined && sinTildes(d.escena) !== sinTildes(plano.escena)) {
    plano.escena = d.escena.slice(0, 120);
    plano.puntos = {};
    log.push(`Escena nueva: ${plano.escena}. El plano empieza de cero: coloca de nuevo a los presentes.`);
  }
  for (const q of d.quitar ?? []) {
    const k = buscar(plano, q);
    if (k) {
      delete plano.puntos[k];
      log.push(`${k} sale del plano.`);
    }
  }
  for (const c of d.poner ?? []) {
    const id = identificar(partida, c.nombre);
    const previo = buscar(plano, c.nombre);
    let x = 0, y = 0;
    if (c.ref) {
      const k = buscar(plano, c.ref);
      if (!k) throw new Error(`No hay nadie ni nada llamado "${c.ref}" en el plano. Presentes: ${Object.keys(plano.puntos).join(", ") || "nadie (coloca primero un punto de referencia sin ref)"}`);
      if (!c.direccion || !c.metros) throw new Error(`Para colocar a ${id.nombre} respecto a ${k} di la direccion (${DIRECCIONES.join(", ")}) y los metros.`);
      const [vx, vy] = VECTOR[c.direccion];
      x = plano.puntos[k].x + vx * c.metros;
      y = plano.puntos[k].y + vy * c.metros;
      log.push(`${id.nombre} queda a ${c.metros} m al ${NOMBRE_DIRECCION[c.direccion]} de ${k}.`);
    } else if (Object.keys(plano.puntos).filter((p) => p !== previo).length) {
      throw new Error(`Para colocar a ${id.nombre} di respecto a quién o a qué: ref + direccion + metros.`);
    } else log.push(`${id.nombre} es el punto de partida del plano.`);
    if (previo && previo !== id.nombre) delete plano.puntos[previo];
    plano.puntos[id.nombre] = { x: r1(x), y: r1(y), tipo: c.tipo ?? id.tipo, ...(c.nota ? { nota: c.nota.slice(0, 80) } : {}) };
  }
  for (const m of d.mover ?? []) {
    const k = buscar(plano, m.nombre);
    if (!k) throw new Error(`${m.nombre} no está en el plano: colócalo antes con poner. Presentes: ${Object.keys(plano.puntos).join(", ") || "nadie"}`);
    const p = plano.puntos[k];
    let vx: number, vy: number, texto: string;
    let metros = m.metros;
    if (m.hacia || m.de) {
      const ref = buscar(plano, (m.hacia ?? m.de)!);
      if (!ref) throw new Error(`No hay nadie ni nada llamado "${m.hacia ?? m.de}" en el plano.`);
      const o = plano.puntos[ref];
      const dist = Math.hypot(o.x - p.x, o.y - p.y);
      if (dist < 0.01) throw new Error(`${k} y ${ref} están en el mismo punto: no hay dirección hacia/desde.`);
      const sentido = m.hacia ? 1 : -1;
      vx = ((o.x - p.x) / dist) * sentido;
      vy = ((o.y - p.y) / dist) * sentido;
      if (m.hacia) metros = Math.min(metros, Math.max(0, dist - 1)); // se queda a 1 m como mucho: no se pisan
      texto = `${m.hacia ? "avanza hacia" : "se aleja de"} ${ref}`;
    } else {
      if (!m.direccion) throw new Error(`Para mover a ${k} di una direccion (${DIRECCIONES.join(", ")}) o hacia/de otro punto.`);
      [vx, vy] = VECTOR[m.direccion];
      texto = `se mueve al ${NOMBRE_DIRECCION[m.direccion]}`;
    }
    p.x = r1(p.x + vx * metros);
    p.y = r1(p.y + vy * metros);
    log.push(`${k} ${texto} ${r1(metros)} m.`);
  }
  if (Object.keys(plano.puntos).length > MAX_PUNTOS) throw new Error(`Demasiados puntos en el plano (máx. ${MAX_PUNTOS}): quita los que ya no importan (quitar).`);
  if (!log.length) throw new Error("No hay nada que cambiar en el plano (escena, poner, mover o quitar).");
  return `${log.join("\n")}\n${textoPlano(plano)}`;
}

/** Distancia en metros entre dos puntos del plano (null si alguno no está colocado). */
export function distanciaPlano(partida: Partida, a: string, b: string): { metros: number; dir: Direccion; de: string; a: string } | null {
  const plano = partida.plano;
  if (!plano) return null;
  const ka = buscar(plano, a), kb = buscar(plano, b);
  if (!ka || !kb || ka === kb) return null;
  const r = rumbo(plano.puntos[ka], plano.puntos[kb]);
  return { metros: r.metros, dir: r.dir, de: ka, a: kb };
}

/** El plano para el DM: cada punto con sus coordenadas y su relación con los demás. */
export function textoPlano(plano: Plano | undefined): string {
  if (!plano || !Object.keys(plano.puntos).length) return "";
  const entradas = Object.entries(plano.puntos);
  const orden = { pj: 0, pnj: 1, cosa: 2 } as const;
  entradas.sort((a, b) => orden[a[1].tipo] - orden[b[1].tipo]);
  const lineas = entradas.map(([nombre, p]) => {
    const otros = entradas.filter(([n]) => n !== nombre).map(([n, q]) => ({ n, q, ...rumbo(p, q) }));
    const cerca = [...otros].sort((a, b) => a.metros - b.metros).slice(0, 3);
    const pjs = otros.filter((o) => o.q.tipo === "pj" && p.tipo === "pj" && !cerca.includes(o));
    const rel = [...cerca, ...pjs].map((o) => `${o.n}: ${o.metros} m al ${NOMBRE_DIRECCION[o.dir]}`).join("; ");
    return `- ${nombre}${p.tipo === "pj" ? " (PJ)" : p.tipo === "pnj" ? " (PNJ/criatura)" : ""} [x=${p.x}, y=${p.y}]${p.nota ? ` ${p.nota}` : ""}${rel ? ` → ${rel}` : ""}`;
  });
  return [`## PLANO DE LA ESCENA: ${plano.escena || "(sin nombre)"} (metros; norte ARRIBA; este derecha). Es la verdad espacial: narra de acuerdo con él`, ...lineas].join("\n");
}

// ---------------------------------------------------------------- reloj

export interface Reloj {
  /** Segundos desde las 00:00 del día 1. */
  segundos: number;
}
const DIA = 86400;

export function momentoDelDia(hora: number): string {
  return hora < 5 ? "madrugada" : hora < 8 ? "amanecer" : hora < 12 ? "mañana" : hora < 14 ? "mediodía" : hora < 19 ? "tarde" : hora < 21 ? "atardecer" : "noche";
}

export function textoReloj(r: Reloj | undefined): string {
  if (!r) return "";
  const dia = Math.floor(r.segundos / DIA) + 1;
  const h = Math.floor((r.segundos % DIA) / 3600);
  const m = Math.floor((r.segundos % 3600) / 60);
  return `Día ${dia}, ${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")} (${momentoDelDia(h)})`;
}

export interface DatosTiempo {
  fijar?: { dia?: number; hora: number; minuto?: number };
  avanzar?: { segundos?: number; minutos?: number; horas?: number; dias?: number };
  motivo?: string;
}

export function actualizarReloj(partida: Partida, d: DatosTiempo): string {
  const antes = partida.reloj;
  if (d.fijar) {
    const dia = d.fijar.dia ?? (antes ? Math.floor(antes.segundos / DIA) + 1 : 1);
    const nuevo = (dia - 1) * DIA + d.fijar.hora * 3600 + (d.fijar.minuto ?? 0) * 60;
    if (antes && nuevo < antes.segundos) throw new Error(`El tiempo no retrocede: ahora es ${textoReloj(antes)}. Usa avanzar, o corrige la hora solo hacia delante.`);
    partida.reloj = { segundos: nuevo };
  } else if (d.avanzar) {
    if (!antes) throw new Error("El reloj no está fijado: empieza con fijar {dia, hora, minuto}.");
    const s = (d.avanzar.segundos ?? 0) + (d.avanzar.minutos ?? 0) * 60 + (d.avanzar.horas ?? 0) * 3600 + (d.avanzar.dias ?? 0) * DIA;
    if (s <= 0) throw new Error("Di cuánto avanza el tiempo (segundos, minutos, horas o dias).");
    partida.reloj = { segundos: antes.segundos + s };
  } else throw new Error("Usa fijar (primera vez) o avanzar.");
  return `🕒 ${textoReloj(partida.reloj)}${d.motivo ? ` — ${d.motivo}` : ""}`;
}

/** Hace avanzar el reloj si ya está fijado (asaltos de combate, días de reposo). */
export function avanzarSiHay(partida: Partida, segundos: number): void {
  if (partida.reloj) partida.reloj.segundos += segundos;
}

export const REGLAS_ESPACIO_TIEMPO = `## Dónde y cuándo (no te confundas de sitio ni de hora)
- ORIENTACIÓN FIJA: el NORTE es ARRIBA, el sur abajo, el este a la derecha y el oeste a la izquierda, siempre, en el mapa y en el plano de la escena. Para situar a alguien o dar direcciones usa puntos cardinales (N, NE, E, SE, S, SO, O, NO) y puntos de referencia concretos («al oeste del carro», «a tres pasos de la puerta norte»). «Delante», «detrás», «a la izquierda» solo respecto a algo que hayas fijado antes («mirando al norte»); si no, no los uses.
- PLANO: al empezar una escena (combate, calle, sala…) llama a plano con escena y coloca a los presentes y los puntos de referencia importantes (el fuego, el carro, la puerta, el enemigo), con metros. Cada vez que alguien se mueva, llama a plano mover ANTES de narrarlo. El plano que recibes en el estado es la verdad espacial: si dices que alguien está «detrás del fuego», debe cuadrar con las coordenadas. Cambia de escena (otro sitio) y el plano se reinicia.
- RUMBOS: cuando mandes a alguien a un lugar conocido, mira el rumbo real desde donde está («desde el grupo: al norte, cerca») y dilo bien. No mandes al norte a quien ya está al norte de su destino.
- RELOJ: el estado trae «Día N, HH:MM (momento)». Fíjalo al empezar (tiempo fijar) y avánzalo cada turno según lo que dura lo hecho (tiempo avanzar: una conversación, 10 min; registrar una sala, 5 min; viajar, horas); los asaltos de combate (6 s) y los días de reposo lo mueven solos. Describe la luz y el ambiente según la hora y no saltes de la tarde a la noche sin avanzar el reloj. Cuando haya un plazo («antes de la tercera vuelta del faro»), anótalo en los pendientes con su hora límite y compáralo con el reloj.
- Si el tablero, el plano o el reloj dicen una cosa y tu memoria otra, vale el programa.`;
