// Viaje, raciones, hambre y sed. El tiempo corre por el reloj de la partida: lo que pasa se calcula con él
// (cada herramienta, al terminar, revisa el sustento), así que da igual cómo avance el tiempo.
import { agregarCondicion, nivelAgotamiento } from "./condiciones.js";
import type { Partida, Personaje } from "./estado.js";
import { salvacion, marcarMuerto, mod, valor } from "./reglas.js";
import { textoReloj } from "./espacio.js";
import { alAireLibre, condicionesDe, diaDePartida, factorHambreDe, factorSedDe, factorViajeGrupo, lluviaAbierta, regionActual } from "./clima.js";

const DIA = 86400;
/** El Tritón de las Mareas se seca en tierra: la sed corre el doble de rápido mientras no está en el agua. */
export const FACTOR_SED_TRITON = 2;
const esTriton = (p: Personaje) => p.raza === "Tritón de las Mareas";
/** Segundos «de sed» que lleva: los reales desde que bebió, más los extra por estar en tierra (Tritón). */
const segSinBeber = (p: Personaje, s: Sustento, ahora: number) => Math.max(0, Math.max(0, ahora - s.agua) + (esTriton(p) ? s.seco ?? 0 : 0) + (s.extraSed ?? 0));
/** Segundos «de hambre»: los reales desde que comió más el extra del frío (solo con calendario). */
const segSinComer = (s: Pick<Sustento, "comida" | "extraHambre">, ahora: number) => Math.max(0, ahora - s.comida) + (s.extraHambre ?? 0);
/** Tramos de un intervalo, uno por día de la partida: [día, segundos, fin]. Sin calendario, un solo tramo. */
function tramos(partida: Partida, ini: number, fin: number): [number, number, number][] {
  if (fin <= ini) return [];
  if (!partida.calendario) return [[0, fin - ini, fin]];
  const out: [number, number, number][] = [];
  for (let t = Math.max(ini, fin - 400 * DIA); t < fin;) { const dia = Math.floor(t / DIA) + 1, f = Math.min(fin, dia * DIA); out.push([dia, f - t, f]); t = f; }
  return out;
}
/** Extra de sed por calor y de hambre por frío (con la adaptación de cada uno), mientras el reloj corre y solo con calendario. */
function acumularClima(partida: Partida, p: Personaje, s: Sustento, ahora: number): void {
  if (!partida.calendario) return;
  const ini = s.vistoClima; s.vistoClima = ahora;
  if (ini === undefined) return;
  const region = regionActual(partida);
  const cubierto = !alAireLibre(partida) || !!p.sumergido || p.condiciones.some((c) => /^(en el agua|sumergido)/i.test(c)); // en el agua o sumergido (como en agua.ts)
  for (const [dia, seg] of tramos(partida, ini, ahora)) {
    const c = condicionesDe(partida, region, dia);
    if (!c) continue;
    const lluvia = esTriton(p) && !!lluviaAbierta(partida, dia);
    if (lluvia) s.extraSed = (s.extraSed ?? 0) - seg; // la lluvia sacia al Tritón: el tiempo de lluvia no cuenta como sed
    else if (!cubierto) s.extraSed = (s.extraSed ?? 0) + seg * (factorSedDe(c, p) - 1);
    s.extraHambre = (s.extraHambre ?? 0) + seg * (factorHambreDe(c, p) - 1);
  }
}
const ES_PIEL = /^piel reseca/i;
/** Un Tritón en tierra acumula sed extra y, tras un día sin mojarse, se le reseca la piel. */
function secarTriton(partida: Partida, p: Personaje, s: Sustento, ahora: number): string[] {
  if (!esTriton(p)) return [];
  const ini = s.visto ?? ahora;
  const dt = Math.max(0, ahora - ini);
  s.visto = ahora;
  const enAgua = !!p.sumergido;
  const avisos: string[] = [];
  if (enAgua) s.mojado = ahora;
  else {
    s.mojado ??= ahora - dt;
    let seco = 0;
    // Con llovizna, lluvia o tormenta al aire libre (y calendario) el Tritón no se seca: no acumula sed y la piel cuenta como mojada.
    for (const [dia, seg, fin] of tramos(partida, ini, ahora)) {
      if (lluviaAbierta(partida, dia)) {
        s.mojado = fin;
        if (!s.lluvia) { s.lluvia = true; avisos.push(`🌧 La lluvia sacia a ${p.nombre}: no pasa sed mientras dure.`); }
      } else { s.lluvia = false; seco += seg; }
    }
    s.seco = (s.seco ?? 0) + seco * (FACTOR_SED_TRITON - 1);
  }
  const reseca = !enAgua && ahora - (s.mojado ?? ahora) >= DIA;
  const tiene = p.condiciones.some((c) => ES_PIEL.test(c));
  if (reseca && !tiene) { p.condiciones.push("piel reseca"); return [...avisos, `🐟 La piel de ${p.nombre} se agrieta: lleva un día entero sin mojarse (desventaja en pruebas de característica hasta que se sumerja).`]; }
  if (!reseca && tiene) { p.condiciones = p.condiciones.filter((c) => !ES_PIEL.test(c)); return [...avisos, `💧 ${p.nombre} se moja y la piel se le recompone.`]; }
  return avisos;
}
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
  /** Tritón: segundos de sed extra acumulados por estar en tierra (la sed corre al doble). */
  seco?: number;
  /** Con calendario: segundos extra de sed (calor) y de hambre (frío) acumulados, y última revisión del clima. */
  extraSed?: number;
  extraHambre?: number;
  vistoClima?: number;
  /** Tritón: ¿está sacándole la sed la lluvia (para no repetir el aviso)? */
  lluvia?: boolean;
  /** Tritón: última vez que el reloj se revisó y última vez que se mojó del todo. */
  visto?: number;
  mojado?: number;
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

const ESTADOS_HAMBRE = /^(con hambre|famélico)/i, ESTADOS_SED = /^(con sed|deshidratado)/i;

/** Pone (o quita) el estado de hambre y de sed que le toca por las horas que lleva sin comer y sin beber. */
function ponerEstados(p: Personaje, horasSinComer: number, horasSinBeber: number): string[] {
  const lim = diasSinComer(p) * 24;
  const hambre = horasSinComer >= lim ? "famélico" : horasSinComer >= Math.max(24, lim / 2) ? "con hambre" : "";
  const sed = horasSinBeber >= 24 ? "deshidratado" : horasSinBeber >= 12 ? "con sed" : "";
  const antesH = p.condiciones.find((c) => ESTADOS_HAMBRE.test(c)) ?? "", antesS = p.condiciones.find((c) => ESTADOS_SED.test(c)) ?? "";
  p.condiciones = p.condiciones.filter((c) => !ESTADOS_HAMBRE.test(c) && !ESTADOS_SED.test(c));
  if (hambre) p.condiciones.push(hambre);
  if (sed) p.condiciones.push(sed);
  // Cuando se pasa de una etapa a otra, se avisa (a la mesa y al DM).
  const avisos: string[] = [];
  if (hambre && hambre !== antesH) avisos.push(hambre === "famélico" ? `🍖 ${p.nombre} está famélico: lleva ${Math.floor(horasSinComer)} h sin comer y ya no aguanta más (desventaja en ataques y pruebas; desde mañana, agotamiento).` : `🍖 ${p.nombre} tiene hambre: lleva ${Math.floor(horasSinComer)} h sin comer (desventaja en pruebas; aguanta ${lim} h).`);
  if (sed && sed !== antesS) avisos.push(sed === "deshidratado" ? `💧 ${p.nombre} está deshidratado: lleva ${Math.floor(horasSinBeber)} h sin beber (desventaja en ataques y pruebas; desde dentro de un día, agotamiento).` : `💧 ${p.nombre} tiene sed: lleva ${Math.floor(horasSinBeber)} h sin beber (desventaja en pruebas).`);
  return avisos;
}

/** Revisa el hambre y la sed con el reloj; devuelve lo que ha pasado desde la última vez. */
export function revisarSustento(partida: Partida): string[] {
  if (!partida.reloj) return [];
  const ahora = partida.reloj.segundos;
  const out: string[] = [];
  for (const p of vivos(partida)) {
    const s = estado(partida, p);
    acumularClima(partida, p, s, ahora);
    const piel = secarTriton(partida, p, s, ahora);
    const sinComer = Math.floor(segSinComer(s, ahora) / DIA);
    const sinBeber = Math.floor(segSinBeber(p, s, ahora) / DIA);
    const excesoH = Math.max(0, sinComer - diasSinComer(p));
    const excesoS = Math.max(0, sinBeber - DIAS_SIN_BEBER);
    for (let i = s.hambre; i < excesoH; i++) out.push(subirAgotamiento(p, `lleva ${sinComer} días sin comer`));
    for (let i = s.sed; i < excesoS; i++) out.push(subirAgotamiento(p, `lleva ${sinBeber + 1} días sin beber`));
    s.hambre = Math.max(s.hambre, excesoH);
    s.sed = Math.max(s.sed, excesoS);
    if (!p.condiciones.includes("muerto")) out.push(...ponerEstados(p, segSinComer(s, ahora) / 3600, segSinBeber(p, s, ahora) / 3600));
    out.push(...piel);
  }
  return out;
}

/** Cómo van de comida y agua (lo que ve el DM en el estado). */
export function textoSustento(p: Personaje, partida: Partida): string {
  if (!partida.reloj || !p.sustento) return "";
  const v = sustentoVisible(partida, p)!;
  return `  Sustento: ${v.hambre.horas} h sin comer (el agotamiento empieza a las ${v.hambre.limite} h), ${v.sed.horas} h sin beber (a las ${v.sed.limite} h)${[v.hambre.estado, v.sed.estado].filter(Boolean).length ? ` — ${[v.hambre.estado, v.sed.estado].filter(Boolean).join(", ")}` : ""}`;
}

export interface Medidor { horas: number; limite: number; fraccion: number; estado: string; nivel: "bien" | "aviso" | "grave" }

/** Cuánto llevan sin comer y sin beber, frente a lo que aguantan (para los medidores de la ficha y el estado del DM). */
export function sustentoVisible(partida: Partida, p: Personaje): { hambre: Medidor; sed: Medidor } | null {
  if (!partida.reloj) return null;
  const s = p.sustento ?? { comida: partida.reloj.segundos, agua: partida.reloj.segundos };
  const hh = Math.floor(segSinComer(s, partida.reloj.segundos) / 3600), ha = Math.floor(segSinBeber(p, p.sustento ?? { comida: 0, agua: partida.reloj.segundos, hambre: 0, sed: 0 }, partida.reloj.segundos) / 3600);
  const limH = (diasSinComer(p) + 1) * 24, limA = (DIAS_SIN_BEBER + 1) * 24; // horas hasta que empieza el agotamiento
  const estH = p.condiciones.find((c) => ESTADOS_HAMBRE.test(c)) ?? "", estA = p.condiciones.find((c) => ESTADOS_SED.test(c)) ?? "";
  const limFam = diasSinComer(p) * 24;
  const nivelH = hh >= limFam ? "grave" : hh >= Math.max(24, limFam / 2) ? "aviso" : "bien";
  const nivelA = ha >= 24 ? "grave" : ha >= 12 ? "aviso" : "bien";
  return { hambre: { horas: hh, limite: limH, fraccion: Math.min(1, hh / limH), estado: estH, nivel: nivelH }, sed: { horas: ha, limite: limA, fraccion: Math.min(1, ha / limA), estado: estA, nivel: nivelA } };
}

const CANTIDAD = /(?:\(\s*(\d+)\s*\)|[x×]\s*(\d+)|(\d+)\s*[x×])\s*$/i;

/** Gasta una unidad de un objeto del inventario ("Raciones de viaje (5)" → "(4)"; sin cantidad, lo quita). */
export function gastarUnidad(p: Personaje, buscar: RegExp, vacio?: string): string | null {
  const i = p.inventario.findIndex((x) => buscar.test(x) && !/vac[ií]o/i.test(x));
  if (i < 0) return null;
  const nombre = p.inventario[i];
  const pre = /^(\d+)\s+(?=\D)/.exec(nombre); // «5 frascos de sal»
  if (pre) {
    const n = Number(pre[1]);
    if (n > 1) p.inventario[i] = nombre.replace(/^\d+/, String(n - 1));
    else p.inventario.splice(i, 1);
    return nombre;
  }
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
      const h = Math.floor(segSinComer(s, ahora) / 3600), a = Math.floor(segSinBeber(p, s, ahora) / 3600);
      lineas.push(`${p.nombre}: ${h} h sin comer (aguanta ${diasSinComer(p)} días), ${a} h sin beber (aguanta ${DIAS_SIN_BEBER} día)${s.hambre || s.sed ? ` · agotamiento por hambre ${s.hambre}, por sed ${s.sed}` : ""}. Provisiones: ${p.inventario.filter((x) => /raci[oó]n|provisi|agua|odre|cantimplora/i.test(x)).join(", ") || "ninguna"}.`);
      continue;
    }
    if (d.accion === "comer") {
      const gastado = d.libre ? "lo que encontró" : gastarUnidad(p, /raci[oó]n|raciones|provisi[oó]n|pan\b|carne seca|queso/i);
      if (!gastado) { lineas.push(`${p.nombre}: no tiene qué comer (sin raciones en el inventario; si come de una posada o de la caza, pasa libre=true).`); continue; }
      s.comida = ahora; s.hambre = 0; s.extraHambre = 0;
      p.condiciones = p.condiciones.filter((c) => !ESTADOS_HAMBRE.test(c));
      lineas.push(`${p.nombre} come (${gastado}).`);
    } else {
      const gastado = d.libre ? "una fuente" : gastarUnidad(p, /agua|odre|cantimplora/i, "Odre vacío");
      if (!gastado) { lineas.push(`${p.nombre}: no tiene qué beber (sin agua ni odre lleno; si bebe de un río o un pozo, pasa libre=true).`); continue; }
      s.agua = ahora; s.sed = 0; s.seco = 0; s.extraSed = 0;
      p.condiciones = p.condiciones.filter((c) => !ESTADOS_SED.test(c));
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
  const cond = condicionesDe(partida, regionActual(partida), diaDePartida(partida));
  const clima = cond ? factorViajeGrupo(cond, pjs) : { factor: 1, notas: [] as string[] };
  const km = Math.round(d.horas * KM_H[d.ritmo] * FACTOR[d.terreno] * clima.factor * 10) / 10;
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
  if (cond && clima.factor < 1) lineas.push(`🌨 ${cond.etiqueta}: el camino rinde ×${String(clima.factor).replace(".", ",")} de km (las horas no cambian).${clima.notas.length ? ` ${clima.notas.join("; ")}.` : ""}`);
  lineas.push(`Ahora: ${textoReloj(partida.reloj)} (salieron a las ${String(hora).padStart(2, "0")}:00). Tira un posible encuentro (encuentro) si el trayecto es largo o peligroso.`);
  return lineas.join("\n");
}

export const REGLAS_SUSTENTO = `## Viaje, raciones, hambre y sed
- El reloj corre siempre (si no lo mueves en un turno, pasan 10 minutos de escena) y cuenta el hambre y la sed solo. Cuando el programa avise de que alguien tiene hambre, sed, está famélico o deshidratado, narra los síntomas y recuérdales comer y beber. El hambre y la sed: sin comer, un personaje aguanta 3 + mod. de CON días (mínimo 1) y después sube un nivel de agotamiento por cada día (y antes, el hambre pasa por dos estados con castigo: «con hambre» —desventaja en pruebas— a partir de la mitad del plazo y «famélico» —también en ataques— al cumplirlo); sin beber aguanta un día y luego sube un nivel por día («con sed» a las 12 h y «deshidratado» a las 24 h, con los mismos castigos). Comer o beber los quita. Al llegar a agotamiento 6, muere. Comer y beber (sustento {accion: comer|beber}) gasta una ración o una unidad de agua del inventario («Raciones de viaje (5)», «Odre de agua (2)»); si come en una posada o bebe de un río, pasa libre=true. Dale a cada personaje al empezar «Raciones de viaje (5)» y «Odre de agua (2)» si su equipo no las trae.
- Para ir de un sitio a otro usa viajar {horas, ritmo, terreno}: calcula los km (lento 3,2 km/h, normal 4,8, rápido 6,4; terreno difícil, la mitad), avanza el reloj y cobra la marcha forzada pasadas 8 horas (salvación de CON, CD 10 + horas de más, o agotamiento). Rápido: −5 a la Percepción pasiva y sin sigilo; lento: sigilo y forrajeo. Buscar comida por el camino es una prueba de Supervivencia (CD 10 fértil, 15 normal, 20 árido): si sale, comen con libre=true.
- Un descanso largo quita un nivel de agotamiento solo si en el último día comió y bebió.`;
