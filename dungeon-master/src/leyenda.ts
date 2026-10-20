// Leyenda: un nivel extra, al alcance de cualquier raza o clase, que solo se gana con hazañas ENORMES. Da un título y
// una fama que cambian cómo reacciona el mundo —para bien o para mal—. Las hazañas las registra el DM con `hazana`; con
// suficientes, `coronar_leyenda` convierte al personaje en leyenda.
import type { Partida, Personaje } from "./estado.js";
import { pvMaxEfectivo } from "./heridas.js";
import { CLASES } from "./mundo.js";
import { mod } from "./reglas.js";

export interface Hazana {
  descripcion: string;
  /** 1 (la conoce el pueblo) a 5 (cambia el reino). */
  magnitud: number;
  tono: "gloria" | "infamia";
  ts?: number;
}

export interface Leyenda {
  hazanas: Hazana[];
  coronada?: boolean;
  titulo?: string;
  tono?: "gloria" | "infamia" | "ambigua";
  razon?: string;
}

export const NIVEL_MINIMO = 5;
/** Puntos de hazañas épicas (magnitud 4 y 5) para ser leyenda, y cuántas deben ser de magnitud 5. */
export const PUNTOS_LEYENDA = 20;
export const EPICAS_MINIMAS = 2;

const norm = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

export function puntos(l?: Leyenda) {
  const h = l?.hazanas ?? [];
  const gloria = h.filter((x) => x.tono === "gloria").reduce((s, x) => s + x.magnitud, 0);
  const infamia = h.filter((x) => x.tono === "infamia").reduce((s, x) => s + x.magnitud, 0);
  const epicas = h.filter((x) => x.magnitud >= 4);
  return {
    gloria,
    infamia,
    total: gloria + infamia,
    epicos: epicas.reduce((s, x) => s + x.magnitud, 0),
    cincos: epicas.filter((x) => x.magnitud >= 5).length,
  };
}

export function nivelDeFama(p: Personaje): string {
  const t = puntos(p.leyenda).total;
  return t >= 40 ? "legendaria" : t >= 25 ? "famoso en todo el reino" : t >= 12 ? "renombrado" : t >= 4 ? "conocido por su región" : "desconocido";
}

export function puedeSerLeyenda(p: Personaje): { puede: boolean; faltan: string[] } {
  const q = puntos(p.leyenda);
  const faltan: string[] = [];
  if (p.nivel < NIVEL_MINIMO) faltan.push(`nivel ${NIVEL_MINIMO} (tiene ${p.nivel})`);
  if (q.epicos < PUNTOS_LEYENDA) faltan.push(`${PUNTOS_LEYENDA - q.epicos} puntos más de hazañas épicas (magnitud 4-5; lleva ${q.epicos}/${PUNTOS_LEYENDA})`);
  if (q.cincos < EPICAS_MINIMAS) faltan.push(`${EPICAS_MINIMAS - q.cincos} hazaña(s) más de magnitud 5 (lleva ${q.cincos}/${EPICAS_MINIMAS})`);
  return { puede: !faltan.length && !p.leyenda?.coronada, faltan };
}

export function textoLeyenda(p: Personaje): string {
  const l = p.leyenda;
  if (!l || (!l.hazanas.length && !l.coronada)) return "";
  const q = puntos(l);
  const cab = l.coronada
    ? `  ★ LEYENDA: «${l.titulo}» (${l.tono === "gloria" ? "de gloria" : l.tono === "infamia" ? "de infamia" : "de gloria e infamia"})`
    : `  Fama: ${nivelDeFama(p)} (gloria ${q.gloria}, infamia ${q.infamia}; hazañas épicas ${q.epicos}/${PUNTOS_LEYENDA})${puedeSerLeyenda(p).puede ? " ⬆ PUEDE SER LEYENDA (coronar_leyenda)" : ""}`;
  return l.coronada ? `${cab} · fama ${nivelDeFama(p)} (gloria ${q.gloria}, infamia ${q.infamia})` : cab;
}

function personaje(partida: Partida, quien: string): Personaje {
  const n = norm(quien);
  const p = Object.values(partida.personajes).find((x) => norm(x.nombre) === n || (x.jugador && norm(x.jugador) === n));
  if (!p) throw new Error(`No hay ningún personaje llamado «${quien}».`);
  return p;
}

export interface DatosHazana {
  quienes: string[];
  descripcion: string;
  magnitud: number;
  tono: "gloria" | "infamia";
}

export function registrarHazana(partida: Partida, d: DatosHazana): string {
  if (!d.quienes.length) throw new Error("Di quién(es) la hicieron.");
  if (d.descripcion.trim().length < 15) throw new Error("Describe la hazaña con algo más de detalle: qué hicieron y qué cambió.");
  const lineas: string[] = [];
  for (const q of d.quienes) {
    const p = personaje(partida, q);
    const l = (p.leyenda ??= { hazanas: [] });
    if (l.hazanas.some((h) => norm(h.descripcion) === norm(d.descripcion))) { lineas.push(`${p.nombre}: esa hazaña ya estaba anotada.`); continue; }
    l.hazanas.push({ descripcion: d.descripcion.trim().slice(0, 240), magnitud: d.magnitud, tono: d.tono });
    if (l.hazanas.length > 40) l.hazanas.splice(0, l.hazanas.length - 40);
    const antes = nivelDeFama({ ...p, leyenda: { ...l, hazanas: l.hazanas.slice(0, -1) } } as Personaje);
    lineas.push(`${p.nombre}: +${d.magnitud} de ${d.tono}. Fama: ${nivelDeFama(p)}${antes !== nivelDeFama(p) ? ` (antes: ${antes}) — que se note en cómo lo trata la gente` : ""}.${puedeSerLeyenda(p).puede ? " ⬆ Ya cumple para ser leyenda: decide si ocurre ahora (coronar_leyenda)." : ""}`);
  }
  return `Hazaña de magnitud ${d.magnitud} (${d.tono}): ${d.descripcion}\n${lineas.join("\n")}`;
}

export interface DatosCoronar {
  quien: string;
  titulo: string;
  tono: "gloria" | "infamia" | "ambigua";
  razon: string;
  /** El aumento de característica de la leyenda: +2 a una (máx. 22). */
  atributo: "fue" | "des" | "con" | "int" | "sab" | "car";
}


export function coronarLeyenda(partida: Partida, d: DatosCoronar): string {
  const p = personaje(partida, d.quien);
  if (p.condiciones.includes("muerto")) throw new Error(`${p.nombre} está muerto: una leyenda póstuma se cuenta, no se corona.`);
  const c = puedeSerLeyenda(p);
  if (p.leyenda?.coronada) throw new Error(`${p.nombre} ya es una leyenda: «${p.leyenda.titulo}».`);
  if (!c.puede) throw new Error(`${p.nombre} todavía no es leyenda. Le falta: ${c.faltan.join("; ")}.`);
  if (d.titulo.trim().length < 4) throw new Error("Ponle un título: «el Matador de Reyes», «la Viuda de Hollín»…");
  if (p.atributos[d.atributo] + 2 > 22) throw new Error(`${d.atributo.toUpperCase()} no puede pasar de 22.`);
  const l = p.leyenda!;
  l.coronada = true;
  l.titulo = d.titulo.trim().slice(0, 60);
  l.tono = d.tono;
  l.razon = d.razon.trim().slice(0, 300);
  p.atributos[d.atributo] += 2;
  const dado = CLASES.find((x) => x.nombre === p.clase)?.dadoGolpe ?? 8;
  const pv = Math.max(1, Math.floor(dado / 2) + 1 + mod(p.atributos.con) + 2);
  p.pv_max += pv;
  if (p.pv > 0) p.pv += pv;
  return [
    `★ ${p.nombre} se convierte en LEYENDA: «${l.titulo}» (${d.tono === "gloria" ? "de gloria" : d.tono === "infamia" ? "de infamia" : "de gloria e infamia"}).`,
    `Por qué: ${l.razon}`,
    `Nivel de Leyenda: +1 al bonificador de competencia, +${pv} PV máximos (${p.pv}/${pvMaxEfectivo(p)}), ${d.atributo.toUpperCase()} +2 (máx. 22), el rasgo Aliento de leyenda (1 por descanso largo: convierte en éxito una tirada de ataque, prueba o salvación que acaba de fallar) y ventaja en ${d.tono === "infamia" ? "Intimidación" : "Persuasión"} ante quien conozca su nombre.`,
    `Ahora el mundo lo sabe: los pueblos hablan de ${p.nombre}, y ${d.tono === "gloria" ? "unos lo admiran y otros quieren medirse con él o ella" : d.tono === "infamia" ? "unos lo temen y otros ponen precio a su cabeza" : "unos lo adoran y otros lo maldicen"}. Haz que su fama llegue a la historia (retadores, admiradores, cazadores de leyendas como Kuru, regentes que lo cortejan o lo quieren muerto).`,
  ].join("\n");
}

export const REGLAS_LEYENDA = `## Fama y Leyenda (el nivel extra, para cualquier raza o clase)
- Cuando alguien hace algo notable, anótalo con hazana (descripción concreta, magnitud 1-5 y tono: gloria o infamia). Magnitud 1: lo cuenta el pueblo; 2: toda la región; 3: el reino entero lo comenta; 4: ÉPICA —derrotar a un jefe o a un ejército, salvar o hundir una ciudad—; 5: cambia el reino —matar a un regente, romper una maldición del mundo, un acto que se cantará siglos—. Sé muy tacaño: casi nunca pasa de 3. La fama se nota: la gente reconoce, admira o teme según el nivel de fama que ves en la ficha.
- Ser LEYENDA es muy difícil: nivel 5 o más, 20 puntos de hazañas de magnitud 4 y 5 y al menos dos de magnitud 5. Cuando la ficha lo avise y la historia lo merezca, corónalo con coronar_leyenda: título (que el jugador puede proponer), tono (gloria, infamia o ambigua) y un +2 a una característica. La leyenda da competencia +1, más PV, un Aliento de leyenda (1 por descanso largo) y ventaja social ante quien conozca su nombre; y cobra su precio: retadores, cazadores de leyendas, enemigos que la buscan y regentes que la cortejan o la quieren muerta.`;
