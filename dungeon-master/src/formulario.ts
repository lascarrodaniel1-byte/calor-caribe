// Formulario de personaje: el jugador rellena todo de una vez y el DM recibe una ficha completa,
// con los valores ya calculados (bono racial, PV), para guardarla sin hacer más preguntas.
import { PERSONALIDADES, VETERANIAS } from "./combate.js";
import { ESCUELAS } from "./magia.js";
import { CLASES, RAZAS } from "./mundo.js";

export const ATRIBUTOS = ["fue", "des", "con", "int", "sab", "car"] as const;
export type Atributo = (typeof ATRIBUTOS)[number];
export const SERIE_ESTANDAR = [15, 14, 13, 12, 10, 8];
export const MAX_ACCION = 2000;

export const mod = (v: number) => Math.floor((v - 10) / 2);
const firma = (v: number) => (v >= 0 ? `+${v}` : `${v}`);

/** "+2 CON, +1 FUE" o "+1 a todos los atributos" → bono por atributo. */
export function bonosDeRaza(texto: string): Record<Atributo, number> {
  const b = { fue: 0, des: 0, con: 0, int: 0, sab: 0, car: 0 };
  if (/todos los atributos/i.test(texto)) {
    const n = Number(/([+-]\d+)/.exec(texto)?.[1] ?? 0);
    for (const a of ATRIBUTOS) b[a] = n;
    return b;
  }
  for (const m of texto.matchAll(/([+-]\d+)\s*(FUE|DES|CON|INT|SAB|CAR)/gi)) b[m[2].toLowerCase() as Atributo] += Number(m[1]);
  return b;
}

const DESCRIPCION_VETERANIA: Record<string, string> = {
  recluta: "pocas peleas a la espalda (los nervios te afectan mucho)",
  curtido: "unos años de oficio",
  veterano: "muchos años de oficio (cuesta sorprenderte)",
  leyenda: "una vida entera de batallas",
};

export const DATOS_FORMULARIO = {
  razas: RAZAS.map((r) => ({ nombre: r.nombre, bonos: r.atributos, valores: bonosDeRaza(r.atributos), descripcion: r.descripcion })),
  clases: CLASES.map((c) => ({ nombre: c.nombre, dado: c.dadoGolpe, principal: c.principal, equipo: c.equipo, mago: c.nombre === "Hechicero" })),
  personalidades: Object.entries(PERSONALIDADES).map(([nombre, p]) => ({ nombre, nota: p.nota })),
  veteranias: VETERANIAS.map((v) => ({ nombre: v, nota: DESCRIPCION_VETERANIA[v] ?? "" })),
  escuelas: [...ESCUELAS],
  serie: SERIE_ESTANDAR,
};

export interface DatosFicha {
  nombre: string;
  jugador: string;
  raza: string;
  clase: string;
  veterania: string;
  personalidad: string[];
  /** Valores antes del bono racial. */
  base: Record<Atributo, number>;
  /** "estandar" (15,14,13,12,10,8 una vez cada uno) o "tirada" (4d6kh3 seis veces). */
  metodo: "estandar" | "tirada";
  escuelas: string[];
  trasfondo: string;
  extra: string;
}

export function finales(f: DatosFicha): Record<Atributo, number> {
  const r = RAZAS.find((x) => x.nombre === f.raza);
  const b = r ? bonosDeRaza(r.atributos) : bonosDeRaza("");
  return Object.fromEntries(ATRIBUTOS.map((a) => [a, f.base[a] + b[a]])) as Record<Atributo, number>;
}

export function pvIniciales(f: DatosFicha): number {
  const c = CLASES.find((x) => x.nombre === f.clase);
  return Math.max(1, (c?.dadoGolpe ?? 8) + mod(finales(f).con));
}

/** Errores del formulario (vacío = se puede enviar). */
export function validarFicha(f: DatosFicha): string[] {
  const e: string[] = [];
  if (f.nombre.trim().length < 2) e.push("Ponle nombre a tu personaje.");
  if (!RAZAS.some((r) => r.nombre === f.raza)) e.push("Elige una raza.");
  const clase = CLASES.find((c) => c.nombre === f.clase);
  if (!clase) e.push("Elige una clase.");
  if (!(VETERANIAS as readonly string[]).includes(f.veterania)) e.push("Elige cuánta veteranía tiene.");
  if (f.personalidad.length < 1 || f.personalidad.length > 2 || new Set(f.personalidad).size !== f.personalidad.length || f.personalidad.some((p) => !(p in PERSONALIDADES)))
    e.push("Elige uno o dos rasgos de personalidad distintos.");
  const valores = ATRIBUTOS.map((a) => f.base[a]);
  if (valores.some((v) => !Number.isInteger(v) || v < 3 || v > 18)) e.push("Asigna un valor a cada atributo.");
  else if (f.metodo === "estandar" && [...valores].sort((a, b) => b - a).join() !== SERIE_ESTANDAR.join())
    e.push("Con la serie estándar usa cada valor (15, 14, 13, 12, 10, 8) una sola vez.");
  if (clase?.nombre === "Hechicero") {
    if (f.escuelas.length !== 2 || new Set(f.escuelas).size !== 2 || f.escuelas.some((s) => !(ESCUELAS as readonly string[]).includes(s))) e.push("El Hechicero elige dos escuelas de magia distintas.");
  }
  if (f.trasfondo.trim().length < 20) e.push("Cuenta en unas líneas quién fue tu personaje y qué busca.");
  if (textoFicha(f).length > MAX_ACCION) e.push("El texto es demasiado largo: acorta el trasfondo o el equipo extra.");
  return e;
}

/** El mensaje que recibe el DM: todo lo necesario para guardar la ficha sin preguntar nada más. */
export function textoFicha(f: DatosFicha): string {
  const c = CLASES.find((x) => x.nombre === f.clase);
  const fin = finales(f);
  const r = RAZAS.find((x) => x.nombre === f.raza);
  const attrs = ATRIBUTOS.map((a) => `${a.toUpperCase()} ${fin[a]} (${firma(mod(fin[a]))})`).join(", ");
  return [
    `FICHA DE PERSONAJE (formulario completo de ${f.jugador}). Guárdala YA con guardar_personaje, con jugador «${f.jugador}», sin pedir ningún dato más ni confirmar nada: usa exactamente estos valores.`,
    `Nombre: ${f.nombre.trim()}`,
    `Raza: ${f.raza} (${r?.atributos ?? ""}) · Clase: ${f.clase} (d${c?.dadoGolpe}) · Nivel 1 · Veteranía: ${f.veterania}`,
    `Personalidad: ${f.personalidad.join(" y ")}`,
    `Atributos finales (${f.metodo === "tirada" ? "tiradas 4d6kh3" : "serie estándar"}, con el bono racial ya sumado): ${attrs}`,
    `PV: ${pvIniciales(f)} (dado de golpe máximo + mod. CON)`,
    f.escuelas.length ? `Escuelas de magia: ${f.escuelas.join(" y ")}` : "",
    `Equipo: el inicial de la clase (${c?.equipo})${f.extra.trim() ? `; además: ${f.extra.trim()}` : ""}`,
    `Trasfondo: ${f.trasfondo.trim()}`,
    f.clase === "Cazador de Brujas" ? "Mascota: si el jugador nombró un halcón o un ratón (en el trasfondo o en el equipo extra), ese; si no, elige tú según su trasfondo, y guárdala con mascota {accion: elegir} justo después de guardar la ficha." : "",
    f.clase === "Caballero Juramentado" ? "Juramento: elige tú, sin preguntar, 1 a 3 votos de Ka'i (Verdad, Amparo, Lealtad, Luz, Descanso, Merced) acordes a su trasfondo y guárdalos con juramento {accion: jurar} justo después de guardar la ficha." : "",
  ]
    .filter(Boolean)
    .join("\n");
}
