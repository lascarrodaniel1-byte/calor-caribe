// Dotes: capacidades que el jugador ELIGE en lugar del aumento de característica (niveles 4, 8, 12, 16 y 19), más una gratis
// para el Humano del Faro al crearlo. Cada una tiene requisito, un efecto sencillo y, a veces, +1 a una característica.
import type { Partida, Personaje } from "./estado.js";
import { ALDESCANSAR } from "./recursos.js";
import { ATRIBUTOS, valor, type Atributo } from "./reglas.js";
import { tiene } from "./dotes_base.js";

export { tiene, opcionDe } from "./dotes_base.js";

export interface Dote {
  id: string;
  nombre: string;
  /** Requisito: alguna de estas características al mínimo (basta una), y/o una clase. */
  requisito: { atributos: Atributo[]; minimo: number; clase?: string };
  mas1?: Atributo;
  opciones?: string[];
  efecto: string;
}

export const DOTES: Dote[] = [
  { id: "cicatrizado", nombre: "Cicatrizado", requisito: { atributos: ["con"], minimo: 13 }, mas1: "con", efecto: "+2 a las tiradas de recuperación de heridas y ventaja en las salvaciones contra infección y Podre" },
  { id: "terco", nombre: "Terco", requisito: { atributos: ["con"], minimo: 13 }, efecto: "ventaja en las salvaciones contra muerte; una vez por descanso largo, al caer a 0 PV se queda en pie con 1 PV" },
  { id: "duro_de_pelar", nombre: "Duro de pelar", requisito: { atributos: ["con"], minimo: 13 }, efecto: "+2 PV máximos por nivel (también los ya ganados)" },
  { id: "golpe_demoledor", nombre: "Golpe demoledor", requisito: { atributos: ["fue"], minimo: 13 }, efecto: "con arma pesada o a dos manos puede atacar con −5 al ataque y +10 al daño (atacar {golpe_demoledor: true})" },
  { id: "centinela", nombre: "Centinela", requisito: { atributos: ["des"], minimo: 13 }, efecto: "sus ataques de oportunidad dejan al objetivo con velocidad 0; puede reaccionar contra quien ataca a un aliado cercano (reaccion {tipo: centinela})" },
  { id: "esgrimista", nombre: "Esgrimista", requisito: { atributos: ["des"], minimo: 13 }, mas1: "des", efecto: "con un arma sutil y la otra mano libre, +1 CA y ventaja en el primer ataque de un duelo uno contra uno (atacar {duelo: true})" },
  { id: "maestro_del_escudo", nombre: "Maestro del escudo", requisito: { atributos: ["fue"], minimo: 13 }, efecto: "con escudo empuñado, +1 CA; puede empujar con él como acción adicional (maniobra {escudo: true})" },
  { id: "pendenciero", nombre: "Pendenciero", requisito: { atributos: ["fue"], minimo: 11 }, efecto: "los puños hacen 1d6, ventaja al agarrar y puede agarrar como acción adicional (maniobra {adicional: true})" },
  { id: "ojo_de_cazador", nombre: "Ojo de cazador", requisito: { atributos: ["sab"], minimo: 13 }, mas1: "sab", efecto: "+5 a la Percepción pasiva (sin el −5 de ir deprisa) y ventaja al buscar trampas a propósito" },
  { id: "marinero", nombre: "Marinero", requisito: { atributos: ["des", "con"], minimo: 11 }, efecto: "cuenta como nadador, aguanta el doble sin aire, ventaja contra la tormenta y las caídas por la borda, y el mar picado no le estorba" },
  { id: "jinete", nombre: "Jinete", requisito: { atributos: ["des"], minimo: 11 }, efecto: "si lo derriban de la montura aterriza de pie sin tirada; su montura controlada también puede atacar" },
  { id: "pasos_de_gato", nombre: "Pasos de gato", requisito: { atributos: ["des"], minimo: 13 }, mas1: "des", efecto: "ventaja en Sigilo" },
  { id: "lengua_de_plata", nombre: "Lengua de plata", requisito: { atributos: ["car"], minimo: 13 }, mas1: "car", opciones: ["persuasion", "intimidacion"], efecto: "ventaja en Persuasión o en Intimidación (la que elija al tomarla)" },
  { id: "manos_de_cirujano", nombre: "Manos de cirujano", requisito: { atributos: ["int", "sab"], minimo: 13 }, efecto: "+2 al tratar heridas y el kit de sanador le vale como herramientas de cirujano" },
  { id: "discipulo_de_escuela", nombre: "Discípulo de escuela", requisito: { atributos: ["int"], minimo: 15, clase: "Hechicero" }, efecto: "puede dominar un tipo de magia más de los que le tocan por nivel (aprender_tipo)" },
];

const norm = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, "_").trim();
export const buscarDote = (n: string): Dote | undefined => DOTES.find((d) => d.id === norm(n) || norm(d.nombre) === norm(n));

function topeAtributo(p: Personaje, a: Atributo): number {
  return p.don === "fisico" && (a === "fue" || a === "des" || a === "con") ? 28 : p.clase === "Hechicero" && p.magia?.don && a === "int" ? 24 : 20;
}

/** Por qué no puede tomarla (null = puede). */
export function motivoNoDote(p: Personaje, d: Dote): string | null {
  if (tiene(p, d.id)) return `${p.nombre} ya tiene ${d.nombre}.`;
  if (d.requisito.clase && p.clase !== d.requisito.clase) return `${d.nombre} es solo para ${d.requisito.clase}.`;
  if (!d.requisito.atributos.some((a) => valor(p, a) >= d.requisito.minimo))
    return `${d.nombre} pide ${d.requisito.atributos.map((a) => a.toUpperCase()).join(" o ")} ${d.requisito.minimo} (${d.requisito.atributos.map((a) => `${a.toUpperCase()} ${valor(p, a)}`).join(", ")}).`;
  return null;
}

/** La toma: efectos inmediatos (+1 a la característica, PV) y la anota en la ficha. */
export function tomarDote(p: Personaje, nombre: string, opcion?: string): string {
  const d = buscarDote(nombre);
  if (!d) throw new Error(`No existe la dote «${nombre}». Dotes: ${DOTES.map((x) => x.nombre).join(", ")}.`);
  const no = motivoNoDote(p, d);
  if (no) throw new Error(no);
  let id = d.id;
  if (d.opciones) {
    const o = opcion ? norm(opcion) : "";
    if (!d.opciones.includes(o)) throw new Error(`${d.nombre} necesita una opción: ${d.opciones.join(" o ")} (opcion).`);
    id = `${d.id}:${o}`;
  }
  const lineas = [`${p.nombre} toma la dote ${d.nombre}${d.opciones ? ` (${id.split(":")[1]})` : ""}: ${d.efecto}.`];
  if (d.mas1) {
    const antes = p.atributos[d.mas1];
    p.atributos[d.mas1] = Math.min(topeAtributo(p, d.mas1), antes + 1);
    if (p.atributos[d.mas1] > antes) lineas.push(`${d.mas1.toUpperCase()} +1 (${p.atributos[d.mas1]}).`);
  }
  if (d.id === "duro_de_pelar") {
    const mas = 2 * p.nivel;
    p.pv_max += mas;
    if (p.pv > 0) p.pv += mas;
    lineas.push(`+${mas} PV máximos (${p.pv_max}).`);
  }
  (p.dotes ??= []).push(id);
  return lineas.join("\n");
}

export interface DatosDote {
  accion: "lista" | "elegir" | "ver";
  quien?: string;
  dote?: string;
  opcion?: string;
}

/** La dote gratis del Humano del Faro (al crearlo o después) y las consultas. Las demás se eligen al subir de nivel. */
export function dote(partida: Partida, d: DatosDote): string {
  if (d.accion === "lista")
    return DOTES.map((x) => `- ${x.nombre} (${x.requisito.atributos.map((a) => a.toUpperCase()).join(" o ")} ${x.requisito.minimo}${x.requisito.clase ? `, solo ${x.requisito.clase}` : ""}${x.mas1 ? `, +1 ${x.mas1.toUpperCase()}` : ""}): ${x.efecto}${x.opciones ? ` [opcion: ${x.opciones.join("/")}]` : ""}`).join("\n");
  const p = Object.values(partida.personajes).find((x) => x.nombre.toLowerCase() === (d.quien ?? "").toLowerCase() || x.jugador?.toLowerCase() === (d.quien ?? "").toLowerCase());
  if (!p) throw new Error(`No hay ningún personaje «${d.quien ?? ""}».`);
  if (d.accion === "ver") return `${p.nombre}: ${p.dotes?.length ? p.dotes.map((id) => { const o = buscarDote(id.split(":")[0]); return `${o?.nombre ?? id}${id.includes(":") ? ` (${id.split(":")[1]})` : ""}`; }).join(", ") : "sin dotes"}${p.raza === "Humano del Faro" && !p.dote_humano ? " · dote gratis del Humano sin elegir" : ""}.`;
  if (p.raza !== "Humano del Faro") throw new Error("Las dotes se eligen al subir de nivel (subir_nivel {dote}) en los niveles 4, 8, 12, 16 y 19; solo el Humano del Faro empieza con una gratis.");
  if (p.dote_humano) throw new Error(`${p.nombre} ya usó su dote gratis (${p.dote_humano}).`);
  if (!d.dote) throw new Error("elegir: di la dote.");
  const t = tomarDote(p, d.dote, d.opcion);
  p.dote_humano = p.dotes![p.dotes!.length - 1];
  return t;
}

// Terco: se recupera con el descanso largo.
ALDESCANSAR.push((p, tipo) => { if (tipo === "largo" && p.gastados) delete p.gastados["Terco"]; });

export const REGLAS_DOTES = `## Dotes
- En los niveles 4, 8, 12, 16 y 19 el jugador elige: un aumento de característica (aumento) O una dote (subir_nivel {dote, opcion}). El Humano del Faro empieza con una dote gratis (se elige al crearlo; si falta, dote {accion: elegir}). Cada dote pide una característica mínima y algunas dan +1 a una; no se repiten. dote {accion: lista} las enseña.
- Las dotes: ${DOTES.map((x) => `${x.nombre} (${x.efecto})`).join("; ")}.
- Recuerda aplicarlas en la mesa: pasa golpe_demoledor, duelo, escudo y adicional donde toque; el programa pone el resto solo.`;
