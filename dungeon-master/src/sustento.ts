// Viaje, raciones, hambre y sed. El tiempo corre por el reloj de la partida: lo que pasa se calcula con él
// (cada herramienta, al terminar, revisa el sustento), así que da igual cómo avance el tiempo.
import { agregarCondicion, nivelAgotamiento } from "./condiciones.js";
import type { Partida, Personaje } from "./estado.js";
import { salvacion, marcarMuerto, mod, valor } from "./reglas.js";
import { textoReloj } from "./espacio.js";

const DIA = 86400;
/** Días que se aguanta sin comer: 3 + mod. de CON (mínimo 1). Sin beber, un día entero. */
export const diasSinComer = (p: Personaje) => Math.max(1, 3 + mod(valor(p, "con")));
export const DIAS_SIN_BEBER = 1;

export interface Sustento {
  /** Segundos del reloj en que comió y bebió por última vez. */
  comida: number;
  agua: number;
  /** Niveles de agotamiento ya cobrados por el hambre y por la sed desde entonces. */
  hambre: number;
  sed: number;
}

const vivos = (partida: Partida) => Object.values(partida.personajes).filter((p) => !p.condiciones.includes("muerto"));

function estado(partida: Partida, p: Personaje): Sustento {
  return (p.sustento ??= { comida: partida.reloj?.segundos ?? 0, agua: partida.reloj?.segundos ?? 0, hambre: 0, sed: 0 });
}

function subirAgotamiento(p: Personaje, causa: string): string {
  const nivel = Math.min(6, nivelAgotamiento(p.condiciones) + 1);
  agregarCondicion(p.condiciones, `agotamiento ${nivel}`);
  if (nivel >= 6) { marcarMuerto(p); return `☠ ${p.nombre} muere de agotamiento (${causa}).`; }
  return `${p.nombre}: agotamiento ${nivel} (${causa}).`;
}

/** Revisa el hambre y la sed con el reloj; devuelve lo que ha pasado desde la última vez. */
export function revisarSustento(partida: Partida): string[] {
  if (!partida.reloj) return [];
  const ahora = partida.reloj.segundos;
  const out: string[] = [];
  for (const p of vivos(partida)) {
    const s = estado(partida, p);
    const sinComer = Math.floor((ahora - s.comida) / DIA);
    const sinBeber = Math.floor((ahora - s.agua) / DIA);
    const excesoH = Math.max(0, sinComer - diasSinComer(p));
    const excesoS = Math.max(0, sinBeber - DIAS_SIN_BEBER);
    for (let i = s.hambre; i < excesoH; i++) out.push(subirAgotamiento(p, `lleva ${sinComer} días sin comer`));
    for (let i = s.sed; i < excesoS; i++) out.push(subirAgotamiento(p, `lleva ${sinBeber + 1} días sin beber`));
    s.hambre = Math.max(s.hambre, excesoH);
    s.sed = Math.max(s.sed, excesoS);
  }
  return out;
}

/** Cómo van de comida y agua (lo que ve el DM en el estado). */
export function textoSustento(p: Personaje, partida: Partida): string {
  if (!partida.reloj) return "";
  const s = p.sustento;
  if (!s) return "";
  const h = Math.floor((partida.reloj.segundos - s.comida) / 3600), a = Math.floor((partida.reloj.segundos - s.agua) / 3600);
  const limH = diasSinComer(p) * 24;
  const avisos = [h >= limH ? "¡HAMBRE!" : h >= limH - 24 ? "hambre cerca" : "", a >= 24 ? "¡SED!" : a >= 16 ? "sed cerca" : ""].filter(Boolean);
  if (h < 12 && a < 12 && !avisos.length) return "";
  return `  Sustento: ${h} h sin comer, ${a} h sin beber${avisos.length ? ` — ${avisos.join(", ")}` : ""}`;
}

const CANTIDAD = /(?:\(\s*(\d+)\s*\)|[x×]\s*(\d+)|(\d+)\s*[x×])\s*$/i;

/** Gasta una unidad de un objeto del inventario ("Raciones de viaje (5)" → "(4)"; sin cantidad, lo quita). */
export function gastarUnidad(p: Personaje, buscar: RegExp, vacio?: string): string | null {
  const i = p.inventario.findIndex((x) => buscar.test(x) && !/vac[ií]o/i.test(x));
  if (i < 0) return null;
  const nombre = p.inventario[i];
  const m = CANTIDAD.exec(nombre);
  if (m) {
    const n = Number(m[1] ?? m[2] ?? m[3]);
    if (n > 1) p.inventario[i] = nombre.replace(CANTIDAD, (t) => t.replace(String(n), String(n - 1)));
    else if (vacio) p.inventario[i] = vacio;
    else p.inventario.splice(i, 1);
  } else if (vacio) p.inventario[i] = vacio;
  else p.inventario.splice(i, 1);
  return nombre;
}

export interface DatosSustento {
  accion: "comer" | "beber" | "ver";
  /** Quién; por defecto, todo el grupo. */
  quienes?: string[];
  /** Comió o bebió de algo que no está en el inventario (una posada, un río, la caza): no gasta provisiones. */
  libre?: boolean;
}

export function sustento(partida: Partida, d: DatosSustento): string {
  if (!partida.reloj) throw new Error("El reloj no está fijado (tiempo fijar): sin él no se cuenta el hambre ni la sed.");
  const todos = vivos(partida);
  const pjs = d.quienes?.length
    ? d.quienes.map((n) => {
        const p = todos.find((x) => x.nombre.toLowerCase() === n.toLowerCase() || x.jugador?.toLowerCase() === n.toLowerCase());
        if (!p) throw new Error(`No hay ningún personaje vivo «${n}».`);
        return p;
      })
    : todos;
  if (!pjs.length) throw new Error("No hay personajes.");
  const ahora = partida.reloj.segundos;
  const lineas: string[] = [];
  for (const p of pjs) {
    const s = estado(partida, p);
    if (d.accion === "ver") {
      const h = Math.floor((ahora - s.comida) / 3600), a = Math.floor((ahora - s.agua) / 3600);
      lineas.push(`${p.nombre}: ${h} h sin comer (aguanta ${diasSinComer(p)} días), ${a} h sin beber (aguanta ${DIAS_SIN_BEBER} día)${s.hambre || s.sed ? ` · agotamiento por hambre ${s.hambre}, por sed ${s.sed}` : ""}. Provisiones: ${p.inventario.filter((x) => /raci[oó]n|provisi|agua|odre|cantimplora/i.test(x)).join(", ") || "ninguna"}.`);
      continue;
    }
    if (d.accion === "comer") {
      const gastado = d.libre ? "lo que encontró" : gastarUnidad(p, /raci[oó]n|raciones|provisi[oó]n|pan\b|carne seca|queso/i);
      if (!gastado) { lineas.push(`${p.nombre}: no tiene qué comer (sin raciones en el inventario; si come de una posada o de la caza, pasa libre=true).`); continue; }
      s.comida = ahora; s.hambre = 0;
      lineas.push(`${p.nombre} come (${gastado}).`);
    } else {
      const gastado = d.libre ? "una fuente" : gastarUnidad(p, /agua|odre|cantimplora/i, "Odre vacío");
      if (!gastado) { lineas.push(`${p.nombre}: no tiene qué beber (sin agua ni odre lleno; si bebe de un río o un pozo, pasa libre=true).`); continue; }
      s.agua = ahora; s.sed = 0;
      lineas.push(`${p.nombre} bebe (${gastado}).`);
    }
  }
  return `${textoReloj(partida.reloj)}\n${lineas.join("\n")}`;
}

/** Con comida y bebida en las últimas 24 h, un descanso largo quita un nivel de agotamiento. */
export function recuperarAgotamiento(partida: Partida, p: Personaje): string {
  const s = p.sustento;
  const nivel = nivelAgotamiento(p.condiciones);
  if (!nivel || !partida.reloj || !s) return "";
  if (partida.reloj.segundos - s.comida > DIA || partida.reloj.segundos - s.agua > DIA) return `${p.nombre}: sin comer y beber en el último día, el descanso no le quita agotamiento.`;
  p.condiciones = p.condiciones.filter((c) => !/^agotamiento/i.test(c));
  if (nivel > 1) agregarCondicion(p.condiciones, `agotamiento ${nivel - 1}`);
  return `${p.nombre}: el descanso, tras comer y beber, le quita un nivel de agotamiento (${nivel - 1 || "ninguno"}).`;
}

// ------------------------------------------------------------------ viaje
export type Ritmo = "lento" | "normal" | "rapido";
export type Terreno = "camino" | "abierto" | "dificil";
const KM_H: Record<Ritmo, number> = { lento: 3.2, normal: 4.8, rapido: 6.4 };
const FACTOR: Record<Terreno, number> = { camino: 1, abierto: 1, dificil: 0.5 };

export interface DatosViaje {
  horas: number;
  ritmo: Ritmo;
  terreno: Terreno;
  motivo?: string;
}

/** Caminar: avanza el reloj, calcula la distancia y cobra la marcha forzada pasadas las 8 horas del día. */
export function viajar(partida: Partida, d: DatosViaje): string {
  if (!partida.reloj) throw new Error("El reloj no está fijado (tiempo fijar): sin él no se puede viajar.");
  const pjs = vivos(partida).filter((p) => p.pv > 0);
  if (!pjs.length) throw new Error("No hay nadie en pie para viajar.");
  const km = Math.round(d.horas * KM_H[d.ritmo] * FACTOR[d.terreno] * 10) / 10;
  const hora = Math.floor((partida.reloj.segundos % DIA) / 3600);
  const lineas = [`Viaje de ${d.horas} h a ritmo ${d.ritmo} por terreno ${d.terreno}${d.motivo ? ` (${d.motivo})` : ""}: unos ${km} km.`];
  // Marcha forzada: cada hora pasada de las 8 del día exige salvación de CON (CD 10 + horas de más) o un nivel de agotamiento.
  for (let h = 9; h <= d.horas; h++) {
    for (const p of pjs) {
      const s = salvacion(p, "con", 10 + (h - 8));
      if (!s.exito) lineas.push(`Marcha forzada (hora ${h}) — ${p.nombre}: ${s.texto}. ${subirAgotamiento(p, "marcha forzada")}`);
    }
  }
  partida.reloj.segundos += d.horas * 3600;
  if (d.ritmo === "rapido") lineas.push("Ritmo rápido: −5 a la Percepción pasiva del grupo (no ven las trampas ni los rastros) y no pueden ir en sigilo.");
  if (d.ritmo === "lento") lineas.push("Ritmo lento: pueden ir en sigilo y buscar comida o rastros mientras caminan.");
  if (d.terreno === "dificil") lineas.push("Terreno difícil: mitad de distancia.");
  lineas.push(`Ahora: ${textoReloj(partida.reloj)} (salieron a las ${String(hora).padStart(2, "0")}:00). Tira un posible encuentro (encuentro) si el trayecto es largo o peligroso.`);
  return lineas.join("\n");
}

export const REGLAS_SUSTENTO = `## Viaje, raciones, hambre y sed
- El reloj (tiempo) cuenta el hambre y la sed solo: sin comer, un personaje aguanta 3 + mod. de CON días (mínimo 1) y después sube un nivel de agotamiento por cada día; sin beber aguanta un día y luego sube un nivel por día. Al llegar a agotamiento 6, muere. Comer y beber (sustento {accion: comer|beber}) gasta una ración o una unidad de agua del inventario («Raciones de viaje (5)», «Odre de agua (2)»); si come en una posada o bebe de un río, pasa libre=true. Dale a cada personaje al empezar «Raciones de viaje (5)» y «Odre de agua (2)» si su equipo no las trae.
- Para ir de un sitio a otro usa viajar {horas, ritmo, terreno}: calcula los km (lento 3,2 km/h, normal 4,8, rápido 6,4; terreno difícil, la mitad), avanza el reloj y cobra la marcha forzada pasadas 8 horas (salvación de CON, CD 10 + horas de más, o agotamiento). Rápido: −5 a la Percepción pasiva y sin sigilo; lento: sigilo y forrajeo. Buscar comida por el camino es una prueba de Supervivencia (CD 10 fértil, 15 normal, 20 árido): si sale, comen con libre=true.
- Un descanso largo quita un nivel de agotamiento solo si en el último día comió y bebió.`;
