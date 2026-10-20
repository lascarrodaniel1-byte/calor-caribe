// Pruebas de característica, de habilidad y salvaciones: cada habilidad usa SU característica, y el programa lo
// comprueba (no vale una tirada de Carisma para algo que no es de Carisma). Suma la competencia solo si la clase
// o el trasfondo del personaje la justifican.
import { describir, tirar } from "./dados.js";
import type { Partida } from "./estado.js";
import { clase } from "./mundo.js";
import { efectos } from "./condiciones.js";
import { ATRIBUTOS, competencia, mod, salvacion, salvacionCompetente, signo, valor, type Atributo } from "./reglas.js";

export const HABILIDADES: Record<string, { nombre: string; atributo: Atributo }> = {
  atletismo: { nombre: "Atletismo", atributo: "fue" },
  acrobacias: { nombre: "Acrobacias", atributo: "des" },
  juego_de_manos: { nombre: "Juego de manos", atributo: "des" },
  sigilo: { nombre: "Sigilo", atributo: "des" },
  arcanos: { nombre: "Arcanos", atributo: "int" },
  historia: { nombre: "Historia", atributo: "int" },
  investigacion: { nombre: "Investigación", atributo: "int" },
  naturaleza: { nombre: "Naturaleza", atributo: "int" },
  religion: { nombre: "Religión", atributo: "int" },
  medicina: { nombre: "Medicina", atributo: "sab" },
  percepcion: { nombre: "Percepción", atributo: "sab" },
  perspicacia: { nombre: "Perspicacia", atributo: "sab" },
  supervivencia: { nombre: "Supervivencia", atributo: "sab" },
  trato_con_animales: { nombre: "Trato con animales", atributo: "sab" },
  engano: { nombre: "Engaño", atributo: "car" },
  intimidacion: { nombre: "Intimidación", atributo: "car" },
  interpretacion: { nombre: "Interpretación", atributo: "car" },
  persuasion: { nombre: "Persuasión", atributo: "car" },
};
export const NOMBRES_HABILIDADES = Object.keys(HABILIDADES) as [string, ...string[]];

export const NOMBRE_ATRIBUTO: Record<Atributo, string> = { fue: "la Fuerza", des: "la Destreza", con: "la Constitución", int: "la Inteligencia", sab: "la Sabiduría", car: "el Carisma" };
const ATR_CORTO: Record<Atributo, string> = { fue: "FUE", des: "DES", con: "CON", int: "INT", sab: "SAB", car: "CAR" };

/** Habilidades en las que cada clase es competente de salida (las demás, solo si el trasfondo del personaje lo justifica). */
export const COMPETENCIAS_CLASE: Record<string, string[]> = {
  "Mercenario del Cuervo": ["atletismo", "intimidacion", "percepcion", "supervivencia"],
  "Berserker de Ceniza": ["atletismo", "supervivencia", "intimidacion", "trato_con_animales"],
  "Caballero Juramentado": ["atletismo", "persuasion", "historia", "religion"],
  "Cazador de Brujas": ["investigacion", "percepcion", "supervivencia", "arcanos", "intimidacion"],
  Degollador: ["sigilo", "engano", "juego_de_manos", "acrobacias", "percepcion", "perspicacia"],
  Flagelante: ["atletismo", "religion", "intimidacion", "perspicacia"],
  Segador: ["religion", "intimidacion", "percepcion", "medicina"],
  Hechicero: ["arcanos", "historia", "investigacion", "perspicacia", "religion"],
  "Barbero-Cirujano": ["medicina", "percepcion", "perspicacia", "investigacion", "supervivencia"],
};

const sinTildes = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

export interface DatosPrueba {
  quien: string;
  habilidad?: string;
  atributo?: Atributo;
  tipo?: "habilidad" | "salvacion";
  cd: number;
  competente?: boolean;
  ventaja?: boolean;
  desventaja?: boolean;
  /** PNJ o ajuste de situación: bonificador total (PNJ) o extra (PJ). */
  bono?: number;
  /** Salvación de DES a cubierto: +2 (media) o +5 (tres cuartos). */
  cobertura?: "media" | "tres_cuartos";
  /** Quien oye conoce el nombre del personaje: una leyenda tiene ventaja social (Persuasión si es de gloria, Intimidación si es de infamia). */
  conoce_su_nombre?: boolean;
  motivo: string;
}

export function clave(h: string): string {
  const n = sinTildes(h).replace(/\s+/g, "_");
  const k = Object.keys(HABILIDADES).find((x) => x === n || sinTildes(HABILIDADES[x].nombre).replace(/\s+/g, "_") === n);
  if (!k) throw new Error(`"${h}" no es una habilidad de este juego. Habilidades: ${Object.values(HABILIDADES).map((x) => `${x.nombre} (${ATR_CORTO[x.atributo]})`).join(", ")}.`);
  return k;
}

export function resolverPrueba(partida: Partida, d: DatosPrueba): { texto: string; exito: boolean } {
  const n = sinTildes(d.quien);
  const pj = Object.values(partida.personajes).find((p) => sinTildes(p.nombre) === n || (p.jugador && sinTildes(p.jugador) === n));
  const salv = d.tipo === "salvacion";
  let attr: Atributo | undefined = d.atributo;
  let nombrePrueba: string;
  let hab: string | undefined;
  if (salv) {
    if (!attr) throw new Error("Una salvación necesita su característica (atributo).");
    nombrePrueba = `salvación de ${ATR_CORTO[attr]}`;
  } else if (d.habilidad) {
    hab = clave(d.habilidad);
    const h = HABILIDADES[hab];
    if (attr && attr !== h.atributo)
      throw new Error(`${NOMBRE_ATRIBUTO[attr][0].toUpperCase() + NOMBRE_ATRIBUTO[attr].slice(1)} no influye en ${h.nombre}: esa habilidad usa ${NOMBRE_ATRIBUTO[h.atributo]} (${ATR_CORTO[h.atributo]}). Si el jugador propuso otra característica, díselo («${NOMBRE_ATRIBUTO[attr]} no influye en esta habilidad») y tira con ${ATR_CORTO[h.atributo]}.`);
    attr = h.atributo;
    nombrePrueba = h.nombre;
  } else {
    if (!attr) throw new Error("Di la habilidad (p. ej. persuasion) o, si es una prueba pura de característica, el atributo.");
    nombrePrueba = `prueba de ${ATR_CORTO[attr]}`;
  }
  const modo = d.ventaja && !d.desventaja ? "ventaja" : d.desventaja && !d.ventaja ? "desventaja" : "normal";

  if (!pj) {
    // PNJ o criatura: el DM da el bonificador total.
    const bono = d.bono ?? 0;
    const t = tirar(`1d20${signo(bono)}`, modo);
    const exito = t.dados[0] === 20 || (t.dados[0] !== 1 && t.total >= d.cd);
    return { texto: `🎲 ${nombrePrueba} de ${d.quien} (PNJ, bono ${signo(bono)}) vs CD ${d.cd} — ${d.motivo} → ${describir(t)}${modo !== "normal" ? ` (${modo})` : ""} → ${exito ? "ÉXITO" : "FALLO"} (${t.total - d.cd >= 0 ? "+" : ""}${t.total - d.cd})`, exito };
  }
  if (pj.pv <= 0 || pj.condiciones.includes("inconsciente") || pj.condiciones.includes("muerto"))
    throw new Error(`${pj.nombre} está ${pj.condiciones.includes("muerto") ? "muerto" : "inconsciente o a 0 PV"}: no puede intentar ${salv ? "esa salvación" : "una prueba"} (en una salvación contra muerte usa salvacion_muerte, no esta herramienta).`);

  if (salv) {
    const esquiva = attr === "des" && !!partida.combate?.turnos && Object.entries(partida.combate.turnos).some(([k, t]) => t.esquiva && k.toLowerCase() === pj.nombre.toLowerCase());
    const s = salvacion(pj, attr!, d.cd, { extra: (d.bono ?? 0) + (attr === "des" ? (d.cobertura === "media" ? 2 : d.cobertura === "tres_cuartos" ? 5 : 0) : 0), ventaja: d.ventaja || esquiva, desventaja: d.desventaja });
    return { texto: `🎲 ${pj.nombre}: ${s.texto} — ${d.motivo} (${s.exito ? "ÉXITO" : "FALLO"}, ${s.margen >= 0 ? "+" : ""}${s.margen})`, exito: s.exito };
  }
  const efP = efectos(pj.condiciones);
  const hayD = !!d.desventaja || efP.pruebas === "desventaja";
  const ley = pj.leyenda?.coronada && d.conoce_su_nombre && ((hab === "persuasion" && pj.leyenda.tono !== "infamia") || (hab === "intimidacion" && pj.leyenda.tono !== "gloria"));
  const modoP = (d.ventaja || ley) && !hayD ? "ventaja" : hayD && !(d.ventaja || ley) ? "desventaja" : "normal";
  const m = mod(valor(pj, attr!));
  const comp = competencia(pj);
  const deClase = hab ? (COMPETENCIAS_CLASE[pj.clase] ?? []).includes(hab) : false;
  const competente = d.competente ?? deClase;
  const pericia = pj.clase === "Barbero-Cirujano" && hab === "medicina";
  const bonoComp = hab && competente ? comp * (pericia ? 2 : 1) : 0;
  const extra = d.bono ?? 0;
  const bono = m + bonoComp + extra;
  const t = tirar(`1d20${signo(bono)}`, modoP);
  const natural = t.dados[0];
  const exito = natural === 20 || (natural !== 1 && t.total >= d.cd);
  const desglose = [`${ATR_CORTO[attr!]} ${signo(m)}`, bonoComp ? `competencia ${signo(bonoComp)}${pericia ? " (pericia)" : ""}` : hab ? "sin competencia" : "", extra ? `ajuste ${signo(extra)}` : ""].filter(Boolean).join(", ");
  return { texto: `🎲 ${nombrePrueba} de ${pj.nombre} (${desglose}) vs CD ${d.cd} — ${d.motivo} → ${describir(t)}${modoP !== "normal" ? ` (${modoP})` : ""} → ${exito ? "ÉXITO" : "FALLO"} (${t.total - d.cd >= 0 ? "+" : ""}${t.total - d.cd})`, exito };
}

/** ¿La tirada genérica parece una prueba de característica de un PJ? (para dirigirla a la herramienta `prueba`) */
export function pareceUnaPrueba(partida: Partida, expresion: string, motivo: string): boolean {
  if (!/^\s*\d*d20/i.test(expresion)) return false;
  const m = sinTildes(motivo);
  if (/(ataque|iniciativa|contra muerte|salvacion de muerte|dano|daño|hechizo|lanzamiento)/.test(m)) return false;
  const habilidades = Object.values(HABILIDADES).map((h) => sinTildes(h.nombre)).concat(["fuerza", "destreza", "constitucion", "inteligencia", "sabiduria", "carisma"]);
  const dicePrueba = /\b(prueba|tirada|chequeo|salvacion|control)\b/.test(m) || habilidades.some((h) => m.includes(h));
  if (!dicePrueba) return false;
  const nombres = Object.values(partida.personajes).flatMap((p) => [p.nombre, p.jugador].filter(Boolean) as string[]).map(sinTildes);
  return nombres.some((nombre) => nombre.length > 1 && m.includes(nombre));
}

export const REGLAS_PRUEBAS = `## Pruebas y límites (sé estricto con lo que se puede y no se puede hacer)
- Cada prueba usa SU característica, y se hace con la herramienta prueba (habilidad, quien, cd, motivo); no uses tirar_dados para pruebas, habilidades o salvaciones de un PJ. Fuerza: Atletismo. Destreza: Acrobacias, Juego de manos, Sigilo. Inteligencia: Arcanos, Historia, Investigación, Naturaleza, Religión. Sabiduría: Medicina, Percepción, Perspicacia, Supervivencia, Trato con animales. Carisma: Engaño, Intimidación, Interpretación, Persuasión. Las pruebas puras de característica (derribar una puerta = FUE) y las salvaciones (tipo salvacion + atributo) también van con prueba.
- Si un jugador propone otra característica («uso mi inteligencia para convencerle»), díselo claro: «la Inteligencia no influye en Persuasión; es de Carisma» (la herramienta lo comprueba y te lo recuerda), y tira con la correcta. Lo mismo si pide una habilidad que no sirve para lo que quiere (no se fuerza una cerradura con Persuasión).
- Antes de resolver cualquier acción comprueba que se PUEDE hacer: ¿lo tiene (objeto en el inventario, hechizo conocido, munición)? ¿está al alcance (plano de la escena: distancia real)? ¿lo permite su estado (inconsciente, atado, sin manos, a 0 PV) y su turno? Si no se puede, dilo sin rodeos («no lo tienes», «está a 12 m: fuera de alcance», «estás inconsciente») y ofrece qué sí puede hacer. Nada de dejarlo pasar por simpatía.
- No pidas tirada si no hay incertidumbre ni coste (éxito automático) ni si es imposible (se niega y se explica). Antes de cada prueba di la característica, la habilidad y la CD. La competencia solo cuenta si su clase o su trasfondo (ficha) la justifican (competente: true/false lo fijas tú con criterio).`;
