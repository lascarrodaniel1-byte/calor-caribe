// Botes, balsas y barcos: navegar, aguantar el mar, el casco, los incendios, hundirse y el abordaje.
import { alAgua } from "./agua.js";
import { condsDe, localizar } from "./combate.js";
import { tirar } from "./dados.js";
import type { Partida, Personaje } from "./estado.js";
import { avanzarSiHay, textoReloj } from "./espacio.js";
import { resolverPrueba } from "./pruebas.js";
import { salvacion } from "./reglas.js";

export type Mar = "calmo" | "picado" | "tormenta";
export type Viento = "favorable" | "normal" | "calmo" | "contrario" | "tormenta";

export interface Nave {
  nombre: string;
  tipo: string;
  casco: number;
  casco_max: number;
  ca: number;
  /** Km/h a ritmo normal con viento normal (remos o velas). */
  vel_kmh: number;
  capacidad: number;
  /** Marineros necesarios para manejarla a toda velocidad. */
  tripulacion_min: number;
  /** Marineros PNJ que ya lleva (los jugadores a bordo se suman). */
  tripulacion: number;
  a_bordo: string[];
  mar: Mar;
  estado: "a flote" | "escorada" | "hundiéndose" | "hundida";
  /** Asaltos que faltan para que se hunda del todo (solo hundiéndose). */
  asaltos_hundir?: number;
  incendio?: boolean;
  /** Pegada a otra nave (abordaje). */
  abordada?: string;
}

/** Tipos de nave (valores míos, a confirmar). */
export const TIPOS_NAVE: Record<string, Pick<Nave, "casco_max" | "ca" | "vel_kmh" | "capacidad" | "tripulacion_min" | "tripulacion">> = {
  balsa: { casco_max: 20, ca: 9, vel_kmh: 2.5, capacidad: 4, tripulacion_min: 1, tripulacion: 0 },
  bote: { casco_max: 40, ca: 11, vel_kmh: 4, capacidad: 6, tripulacion_min: 1, tripulacion: 0 },
  barca: { casco_max: 70, ca: 12, vel_kmh: 9, capacidad: 8, tripulacion_min: 2, tripulacion: 0 },
  carraca: { casco_max: 220, ca: 14, vel_kmh: 11, capacidad: 40, tripulacion_min: 6, tripulacion: 8 },
  galera: { casco_max: 400, ca: 15, vel_kmh: 13, capacidad: 80, tripulacion_min: 20, tripulacion: 30 },
};

const FACTOR_VIENTO: Record<Viento, number> = { favorable: 1.5, normal: 1, calmo: 0.6, contrario: 0.5, tormenta: 0.3 };
const norm = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

function hallar(partida: Partida, nombre: string): Nave {
  const n = Object.values(partida.naves ?? {}).find((x) => norm(x.nombre) === norm(nombre)) ?? Object.values(partida.naves ?? {}).find((x) => norm(x.nombre).includes(norm(nombre)));
  if (!n) throw new Error(`No hay ninguna nave «${nombre}». Naves: ${Object.values(partida.naves ?? {}).map((x) => x.nombre).join(", ") || "ninguna"}.`);
  return n;
}
const pj = (partida: Partida, n: string): Personaje => {
  const p = Object.values(partida.personajes).find((x) => norm(x.nombre) === norm(n) || (x.jugador && norm(x.jugador) === norm(n)));
  if (!p) throw new Error(`No hay ningún personaje «${n}».`);
  return p;
};
const tripulantes = (n: Nave) => n.a_bordo.length + n.tripulacion;

function actualizarEstado(n: Nave): string {
  if (n.estado === "hundida") return "";
  const frac = n.casco / n.casco_max;
  if (n.casco <= 0) return "";
  if (frac <= 0.25 && n.estado !== "hundiéndose") { n.estado = "hundiéndose"; n.asaltos_hundir = tirar("2d6").total; return `⚠ ${n.nombre} hace agua a chorros: se hunde en ${n.asaltos_hundir} asaltos si no se achica o se repara.`; }
  if (frac > 0.25 && n.estado === "hundiéndose") { n.estado = "escorada"; n.asaltos_hundir = undefined; return `${n.nombre} deja de hundirse (escorada).`; }
  if (frac <= 0.5 && n.estado === "a flote") { n.estado = "escorada"; return `${n.nombre} se escora: a la mitad de su casco, anda a medio ritmo.`; }
  if (frac > 0.5 && n.estado === "escorada") { n.estado = "a flote"; return `${n.nombre} se endereza.`; }
  return "";
}

/** Se va a pique: todos los de a bordo caen al agua. */
function hundir(partida: Partida, n: Nave): string[] {
  n.estado = "hundida"; n.casco = 0; n.incendio = false; n.asaltos_hundir = undefined;
  const lineas = [`💥 ${n.nombre} se hunde.`];
  const aBordo = [...n.a_bordo];
  n.a_bordo = [];
  for (const nombre of aBordo) { const p = pj(partida, nombre); p.nave = undefined; }
  if (aBordo.length) lineas.push(...alAgua(partida, aBordo));
  return lineas;
}

export interface DatosNave {
  accion: "crear" | "abordar" | "desembarcar" | "navegar" | "danar" | "reparar" | "mar" | "abordaje" | "ver";
  nave?: string;
  tipo?: string;
  casco?: number;
  quienes?: string[];
  horas?: number;
  viento?: Viento;
  cantidad?: number;
  tipo_dano?: string;
  mar?: Mar;
  /** reparar: achicar (gana tiempo), remendar (repara casco) o apagar (el fuego). */
  tarea?: "achicar" | "remendar" | "apagar";
  /** abordaje: la otra nave a la que se pega. */
  otra?: string;
}

export function nave(partida: Partida, d: DatosNave): { texto: string; publico: string | null } {
  const todas = (partida.naves ??= {});
  if (d.accion === "ver") {
    const l = Object.values(todas);
    return { texto: l.length ? l.map((n) => `${n.nombre} (${n.tipo}): casco ${n.casco}/${n.casco_max}, CA ${n.ca}, ${n.estado}${n.asaltos_hundir !== undefined ? ` (${n.asaltos_hundir} asaltos)` : ""}${n.incendio ? ", EN LLAMAS" : ""}, mar ${n.mar}, a bordo ${n.a_bordo.join(", ") || "nadie"} + ${n.tripulacion} tripulantes${n.abordada ? `, abordada con ${n.abordada}` : ""}`).join("\n") : "No hay naves.", publico: null };
  }
  if (d.accion === "crear") {
    if (!d.nave) throw new Error("crear: di el nombre de la nave.");
    const tipo = norm(d.tipo ?? "bote");
    const t = TIPOS_NAVE[tipo];
    if (!t) throw new Error(`Tipo de nave «${d.tipo}» desconocido. Tipos: ${Object.keys(TIPOS_NAVE).join(", ")}.`);
    if (Object.values(todas).some((x) => norm(x.nombre) === norm(d.nave!))) throw new Error(`Ya existe la nave «${d.nave}».`);
    const casco = d.casco ?? t.casco_max;
    todas[d.nave] = { nombre: d.nave, tipo, ...t, casco, casco_max: Math.max(casco, t.casco_max), a_bordo: [], mar: "calmo", estado: "a flote" };
    return { texto: `${d.nave} (${tipo}): casco ${casco}, CA ${t.ca}, ${t.vel_kmh} km/h, ${t.capacidad} plazas, tripulación mínima ${t.tripulacion_min} (lleva ${t.tripulacion}).`, publico: `⛵ ${d.nave}` };
  }
  const n = hallar(partida, d.nave ?? "");
  if (n.estado === "hundida") throw new Error(`${n.nombre} está hundida.`);
  if (d.accion === "abordar") {
    const lineas: string[] = [];
    for (const q of d.quienes ?? []) {
      const p = pj(partida, q);
      if (p.sumergido) { lineas.push(`${p.nombre} está en el agua: primero tiene que salir (agua emerger) y subir a bordo.`); continue; }
      if (n.a_bordo.includes(p.nombre)) continue;
      if (tripulantes(n) >= n.capacidad) { lineas.push(`${n.nombre} está llena (${n.capacidad} plazas): ${p.nombre} no cabe.`); continue; }
      if (p.nave) { const otra = todas[p.nave]; if (otra) otra.a_bordo = otra.a_bordo.filter((x) => x !== p.nombre); }
      n.a_bordo.push(p.nombre); p.nave = n.nombre;
      lineas.push(`${p.nombre} sube a ${n.nombre}.`);
    }
    return { texto: lineas.join("\n") || "Nadie sube.", publico: null };
  }
  if (d.accion === "desembarcar") {
    const nombres = d.quienes?.length ? d.quienes : [...n.a_bordo];
    for (const q of nombres) { const p = pj(partida, q); n.a_bordo = n.a_bordo.filter((x) => x !== p.nombre); p.nave = undefined; }
    return { texto: `${nombres.join(", ") || "Nadie"} baja de ${n.nombre}.`, publico: null };
  }
  if (d.accion === "mar") {
    if (!d.mar) throw new Error("mar: calmo, picado o tormenta.");
    n.mar = d.mar;
    return { texto: `El mar de ${n.nombre} está ${d.mar}.${d.mar === "tormenta" ? " Cada asalto, quien va en cubierta hace una salvación de DES (CD 10) o cae por la borda; los ataques a distancia se hacen con desventaja y cualquier otro, también." : d.mar === "picado" ? " Los ataques a distancia desde cubierta tienen desventaja." : ""}`, publico: `🌊 ${d.mar}` };
  }
  if (d.accion === "navegar") {
    if (!partida.reloj) throw new Error("El reloj no está fijado (tiempo fijar).");
    if (!d.horas || !d.viento) throw new Error("navegar: di horas y viento (favorable, normal, calmo, contrario, tormenta).");
    if (n.estado === "hundiéndose") throw new Error(`${n.nombre} se hunde: no puede navegar hasta que se achique y se repare.`);
    const tripu = tripulantes(n);
    let f = FACTOR_VIENTO[d.viento];
    const notas: string[] = [];
    if (tripu < n.tripulacion_min) { f *= tripu / n.tripulacion_min; notas.push(`falta tripulación (${tripu}/${n.tripulacion_min}): menos velocidad`); }
    if (n.estado === "escorada") { f *= 0.5; notas.push("escorada: mitad de ritmo"); }
    const km = Math.round(n.vel_kmh * d.horas * f * 10) / 10;
    avanzarSiHay(partida, d.horas * 3600);
    const lineas = [`${n.nombre} navega ${d.horas} h con viento ${d.viento}: unos ${km} km${notas.length ? ` (${notas.join("; ")})` : ""}. Ahora: ${textoReloj(partida.reloj)}.`];
    if (d.viento === "tormenta") {
      n.mar = "tormenta";
      const dano = tirar(`${Math.max(1, d.horas)}d6`).total;
      n.casco = Math.max(0, n.casco - dano);
      lineas.push(`🌩 La tormenta castiga el casco: −${dano} (casco ${n.casco}/${n.casco_max}).`);
      for (const nombre of [...n.a_bordo]) {
        const p = pj(partida, nombre);
        const s = salvacion(p, "des", 10);
        if (!s.exito) { n.a_bordo = n.a_bordo.filter((x) => x !== p.nombre); p.nave = undefined; lineas.push(`${p.nombre}: ${s.texto} → cae por la borda.`, ...alAgua(partida, [p.nombre])); }
      }
      if (n.casco <= 0) lineas.push(...hundir(partida, n)); else { const e = actualizarEstado(n); if (e) lineas.push(e); }
    }
    return { texto: lineas.join("\n"), publico: `⛵ ${lineas[0]}` };
  }
  if (d.accion === "danar") {
    if (!d.cantidad) throw new Error("danar: di cuánto daño recibe el casco (cantidad).");
    const fuego = /fuego|llama|incendi/i.test(d.tipo_dano ?? "");
    const total = fuego ? d.cantidad * 2 : d.cantidad; // la madera arde
    n.casco = Math.max(0, n.casco - total);
    const lineas = [`${n.nombre} recibe ${total} de daño${fuego ? " (fuego: doble contra la madera)" : ""} → casco ${n.casco}/${n.casco_max}.`];
    if (fuego && !n.incendio && n.casco > 0) { n.incendio = true; lineas.push(`🔥 ${n.nombre} prende fuego: −1d6 de casco por asalto hasta apagarlo (reparar apagar).`); }
    if (n.casco <= 0) lineas.push(...hundir(partida, n)); else { const e = actualizarEstado(n); if (e) lineas.push(e); }
    return { texto: lineas.join("\n"), publico: `💥 ${lineas[0]}` };
  }
  if (d.accion === "reparar") {
    if (!d.tarea) throw new Error("reparar: tarea achicar, remendar o apagar.");
    const quien = (d.quienes ?? [])[0];
    if (!quien) throw new Error("reparar: di quién lo hace (quienes).");
    const p = pj(partida, quien);
    if (d.tarea === "achicar") {
      if (n.estado !== "hundiéndose") return { texto: `${n.nombre} no se hunde: no hay nada que achicar.`, publico: null };
      n.asaltos_hundir = Math.min(12, (n.asaltos_hundir ?? 0) + 1);
      return { texto: `${p.nombre} achica: ${n.nombre} aguanta un asalto más (${n.asaltos_hundir}).`, publico: null };
    }
    const r = resolverPrueba(partida, { quien: p.nombre, atributo: d.tarea === "apagar" ? "des" : "fue", cd: d.tarea === "apagar" ? 10 : 12, motivo: d.tarea === "apagar" ? "apagar el fuego" : "remendar el casco" });
    const lineas = [r.texto];
    if (r.exito) {
      if (d.tarea === "apagar") { n.incendio = false; lineas.push(`${n.nombre} deja de arder.`); }
      else { const c = tirar("2d6").total; n.casco = Math.min(n.casco_max, n.casco + c); lineas.push(`Remienda el casco: +${c} (casco ${n.casco}/${n.casco_max}).`); const e = actualizarEstado(n); if (e) lineas.push(e); }
    }
    return { texto: lineas.join("\n"), publico: null };
  }
  // abordaje
  if (!d.otra) throw new Error("abordaje: di la otra nave (otra).");
  const o = hallar(partida, d.otra);
  n.abordada = o.nombre; o.abordada = n.nombre;
  return { texto: `${n.nombre} y ${o.nombre} quedan unidas por garfios: se puede cruzar de una a otra con una acción de movimiento (Acrobacias CD 10 si el mar no está calmo) y combatir cuerpo a cuerpo en las cubiertas.`, publico: "⚓ ¡Abordaje!" };
}

/** Cada asalto: el fuego quema, el agua entra y la tormenta tira gente por la borda. */
export function pasarAsaltoNave(partida: Partida): string[] {
  const out: string[] = [];
  for (const n of Object.values(partida.naves ?? {})) {
    if (n.estado === "hundida") continue;
    if (n.incendio) {
      const d = tirar("1d6").total; n.casco = Math.max(0, n.casco - d);
      out.push(`🔥 ${n.nombre} arde: −${d} (casco ${n.casco}/${n.casco_max}).`);
      if (n.casco <= 0) { out.push(...hundir(partida, n)); continue; }
      const e = actualizarEstado(n); if (e) out.push(e);
    }
    if (n.estado === "hundiéndose" && n.asaltos_hundir !== undefined) {
      n.asaltos_hundir--;
      if (n.asaltos_hundir <= 0) { out.push(...hundir(partida, n)); continue; }
      out.push(`${n.nombre} se hunde en ${n.asaltos_hundir} asalto(s).`);
    }
    if (n.mar === "tormenta") {
      for (const nombre of [...n.a_bordo]) {
        const p = pj(partida, nombre);
        if (p.condiciones.includes("muerto") || p.pv <= 0) continue;
        const s = salvacion(p, "des", 10);
        if (!s.exito) { n.a_bordo = n.a_bordo.filter((x) => x !== p.nombre); p.nave = undefined; out.push(`${p.nombre}: ${s.texto} → cae por la borda.`, ...alAgua(partida, [p.nombre])); }
      }
    }
  }
  return out;
}

/** Desventaja a los ataques a distancia (mar picado o tormenta) y a todos (tormenta) desde una nave. */
export function ajusteMar(partida: Partida, atacante: string, distancia: boolean): string | null {
  const p = Object.values(partida.personajes).find((x) => norm(x.nombre) === norm(atacante));
  const n = p?.nave ? partida.naves?.[p.nave] : undefined;
  if (!n || n.estado === "hundida") return null;
  if (n.mar === "tormenta") return `desventaja: tormenta sobre la cubierta de ${n.nombre}`;
  if (n.mar === "picado" && distancia) return `desventaja: el mar picado mueve la cubierta de ${n.nombre}`;
  return null;
}

export function textoNaves(partida: Partida): string {
  const l = Object.values(partida.naves ?? {}).filter((n) => n.estado !== "hundida");
  if (!l.length) return "";
  return `## Naves\n${l.map((n) => `- ${n.nombre} (${n.tipo}): casco ${n.casco}/${n.casco_max}, ${n.estado}${n.asaltos_hundir !== undefined ? ` (${n.asaltos_hundir} asaltos)` : ""}${n.incendio ? ", EN LLAMAS" : ""}, mar ${n.mar}; a bordo: ${n.a_bordo.join(", ") || "nadie"} (+${n.tripulacion} de tripulación)`).join("\n")}`;
}

export const REGLAS_NAVES = `## Botes, barcos y combate naval
- Crea la nave con nave {accion: crear, nave, tipo: balsa|bote|barca|carraca|galera} (casco 20, 40, 70, 220, 400; km/h 2,5, 4, 9, 11, 13) y sube al grupo con abordar. navegar {horas, viento} calcula los km (viento favorable ×1,5, calmo ×0,6, contrario ×0,5, tormenta ×0,3), avanza el reloj y exige tripulación mínima (menos, va más lenta). Si va escorada, a medio ritmo. En tormenta daña el casco y cada pasajero tira DES CD 10 o cae al agua.
- Mar: nave {accion: mar, mar: calmo|picado|tormenta}. Picado: desventaja en los ataques a distancia desde cubierta. Tormenta: desventaja en todos los ataques y, cada asalto, DES CD 10 o cae por la borda (queda bajo el agua: reglas de agua).
- Combate naval: dañar el casco con nave {accion: danar, cantidad, tipo_dano} (fuego: doble, y prende fuego: −1d6 de casco por asalto hasta apagarlo). Un casco a la mitad escora la nave; a un cuarto se hunde en 2d6 asaltos salvo que se achique (reparar achicar: +1 asalto cada vez) y se remiende (reparar remendar: prueba de FUE CD 12, repara 2d6). Una embestida causa 2d10 al casco por cada 5 km/h de velocidad. A 0 se hunde y todos caen al agua.
- Abordaje: nave {accion: abordaje, nave, otra} une las naves con garfios; se cruza con una acción de movimiento y se combate en cubierta. Atacar el casco con armas pequeñas apenas lo daña: solo máquinas, embestidas, fuego o armas de gran tamaño.`;
