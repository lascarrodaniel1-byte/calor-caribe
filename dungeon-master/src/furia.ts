// La furia del Berserker de Ceniza: un vestigio de la conexión con Æsir, el dios más antiguo. Al invocarla el pelo se vuelve del
// color de la ceniza. Nivel 1-2: entra en trance y no distingue aliados de enemigos. Desde el nivel 3, el trance se
// aclara. En el nivel 5 la furia cierra temporalmente las heridas rojas. Siempre: +2 al daño cuerpo a cuerpo, resistencia
// al daño físico y las penalizaciones de las heridas no cuentan mientras dura. Siempre cobra su precio: INT y CAR
// a la mitad (para +2 a FUE) mientras dura. Es el fuego de Æsir, el dios más antiguo.
import { tirar } from "./dados.js";
import type { Partida, Personaje } from "./estado.js";
import { pvMaxEfectivo } from "./heridas.js";
import { localizar, puedeActuar, type Combatiente } from "./combate.js";
import { distanciaPlano } from "./espacio.js";
import { agregarCondicion } from "./condiciones.js";
import { salvacion } from "./reglas.js";
import { RECURSOS_CLASE } from "./recursos.js";

RECURSOS_CLASE["Berserker de Ceniza"] = [
  { nombre: "Furia", adicional: true, desde: 1, max: (p) => usosFuria(p.nivel), recarga: "largo", efecto: (p) => entrarFuria(p) },
];

export interface Furia {
  activa: boolean;
  /** A quién ya ha marcado con Ceniza en esta furia (una marca por individuo y furia). */
  marcados?: string[];
  /** Asaltos que le quedan (1 minuto = 10). */
  asaltos: number;
}

export const ASALTOS_FURIA = 10;
export const esBerserker = (p: Personaje) => p.clase === "Berserker de Ceniza";
export const enFuria = (p: Personaje) => !!p.furia?.activa;
/** Nivel 1-2: el trance lo ciega. */
export const enTrance = (p: Personaje) => enFuria(p) && p.nivel < 3;
/** Nivel 5: la furia cierra las heridas rojas mientras dura. */
export const cierraRojas = (p: Personaje) => enFuria(p) && p.nivel >= 5;
export const usosFuria = (nivel: number) => (nivel >= 12 ? 5 : nivel >= 6 ? 4 : nivel >= 3 ? 3 : 2);

export function entrarFuria(p: Personaje): string {
  if (enFuria(p)) throw new Error(`${p.nombre} ya está en furia.`);
  p.furia = { activa: true, asaltos: ASALTOS_FURIA };
  const base = `${p.nombre} invoca la furia: su pelo se vuelve del color de la ceniza y los ojos le arden como brasas. Durante 1 minuto: +2 al modificador de FUE (a cambio, INT y CAR a la mitad), +2 al daño cuerpo a cuerpo, resistencia al daño contundente, cortante y perforante, y las penalizaciones de sus heridas no cuentan.`;
  if (p.nivel < 3)
    return `${base}\nEN TRANCE: a este nivel la furia lo ciega. No distingue aliados de enemigos: cada ataque suyo cae sobre quien tenga a su alcance, amigo o enemigo (el programa lo decide al atacar). Narra su mirada vacía y los gritos de sus compañeros intentando que vuelva en sí.`;
  if (p.nivel >= 5) {
    const rojas = p.heridas.filter((h) => h.zona_vital === "roja");
    return `${base}\nLucidez de furia: distingue a aliados de enemigos. Sus heridas ROJAS se cierran mientras dura${rojas.length ? ` (${rojas.map((h) => h.id).join(", ")} dejan de sangrar y no avanzan)` : ""}: se reabrirán al terminar.`;
  }
  return `${base}\nLucidez de furia: distingue a aliados de enemigos (el trance de los primeros niveles ya no lo ciega).`;
}

export function terminarFuria(p: Personaje, motivo = "se apaga"): string {
  if (!enFuria(p)) return "";
  const cerradas = cierraRojas(p) ? p.heridas.filter((h) => h.zona_vital === "roja") : [];
  p.furia = undefined;
  const lineas = [`La furia de ${p.nombre} ${motivo}: el pelo recobra su color, y el cuerpo cobra lo que la furia ignoró.`];
  // Las penalizaciones de las heridas vuelven.
  p.pv = Math.min(p.pv, pvMaxEfectivo(p));
  // Salvación de CON: si falla, una herida moderada sin tratar se agrava.
  const cd = 10 + 2 * cerradas.length;
  const s = salvacion(p, "con", cd);
  lineas.push(`Salvación de CON al terminar (CD ${cd}${cerradas.length ? `, +2 por cada herida roja reabierta` : ""}): ${s.texto}.`);
  if (!s.exito) {
    const mod = p.heridas.find((h) => h.gravedad === "moderada" && h.estado === "sin tratar");
    if (mod) {
      mod.gravedad = "grave";
      lineas.push(`${mod.id} (${mod.descripcion}) se agrava: ahora es GRAVE.`);
    }
    if (cerradas.length) {
      for (const h of cerradas) if (h.reloj !== undefined) h.reloj = Math.max(1, h.reloj - 2);
      agregarCondicion(p.condiciones, "agotamiento 1");
      lineas.push(`Las heridas rojas se reabren peor de lo que se cerraron (−2 asaltos de vida cada una) y queda con agotamiento 1.`);
    }
  }
  if (cerradas.length) lineas.push(`Las heridas rojas (${cerradas.map((h) => h.id).join(", ")}) vuelven a sangrar: ¡atiéndelas ya!`);
  return lineas.join("\n");
}

/** Cada asalto nuevo, la furia se acorta; al llegar a 0 se apaga. */
export function pasarAsaltoFuria(partida: Partida): string[] {
  const out: string[] = [];
  for (const p of Object.values(partida.personajes)) {
    if (!enFuria(p)) continue;
    p.furia!.asaltos -= 1;
    if (p.furia!.asaltos <= 0) out.push(terminarFuria(p, "se acaba (ha pasado un minuto)"));
  }
  return out;
}

export function terminarTodas(partida: Partida, motivo: string): string[] {
  return Object.values(partida.personajes).filter(enFuria).map((p) => terminarFuria(p, motivo)).filter(Boolean);
}

/** En trance, el golpe cae sobre cualquiera que tenga cerca. Devuelve el objetivo real y el aviso. */
export function redirigirTrance(partida: Partida, atacante: string, objetivo: string): { objetivo: string; aviso: string } {
  let at: Combatiente;
  try { at = localizar(partida, atacante); } catch { return { objetivo, aviso: "" }; }
  if (at.tipo !== "pj" || !enTrance(at.p)) return { objetivo, aviso: "" };
  const nombres = (partida.combate?.orden ?? []).map((o) => o.nombre).filter((n) => n.toLowerCase() !== at.nombre.toLowerCase());
  const candidatos = nombres.filter((n) => {
    try {
      const c = localizar(partida, n);
      if (puedeActuar(c) !== null && !(c.tipo === "pj" && c.p.pv <= 0)) return false; // los caídos no se pisotean en su trance
      if (c.tipo === "pj" && c.p.pv <= 0) return false;
      const d = distanciaPlano(partida, at.nombre, n);
      return d ? d.metros <= 2 : true;
    } catch { return false; }
  });
  if (!candidatos.includes(objetivo) && candidatos.length === 0) return { objetivo, aviso: "" };
  const lista = candidatos.includes(objetivo) ? candidatos : [...candidatos, objetivo];
  const elegido = lista.length === 1 ? lista[0] : lista[tirar(`1d${lista.length}`).total - 1];
  return {
    objetivo: elegido,
    aviso: `🔥 ${at.nombre} está en trance de furia y no distingue amigos de enemigos: quería golpear a ${objetivo}${elegido.toLowerCase() === objetivo.toLowerCase() ? " y es a quien alcanza" : `, pero su golpe cae sobre ${elegido}`}.`,
  };
}

export function textoFuria(p: Personaje): string {
  if (!esBerserker(p)) return "";
  return enFuria(p)
    ? `  🔥 EN FURIA (pelo cenizo, ${p.furia!.asaltos} asalto(s))${enTrance(p) ? " · EN TRANCE: no distingue aliados de enemigos" : ""}${cierraRojas(p) ? " · heridas rojas cerradas mientras dure" : ""}`
    : "";
}

export const REGLAS_FURIA = `## Furia del Berserker de Ceniza
- Se invoca con usar_recurso {recurso: "Furia"} (acción adicional; se acaba sola a los 10 asaltos o con usar_recurso {accion: terminar}). Mientras dura: el pelo se vuelve del color de la ceniza; INT y CAR a la mitad y +2 al modificador de FUE (se suma al bono base) (lo aplica el programa en todas las tiradas); +2 al daño cuerpo a cuerpo (lo suma atacar); resistencia al daño contundente, cortante y perforante (lo aplica atacar); las penalizaciones de las heridas no cuentan.
- Niveles 1-2: es un TRANCE. No distingue aliados de enemigos: al atacar, el programa hace caer el golpe sobre cualquiera a su alcance. Narra su mirada vacía y a los compañeros intentando contenerlo. Desde el nivel 3 el trance se aclara. En el nivel 5 la furia cierra las heridas rojas mientras dura; al terminar se reabren.
- Al acabar la furia, el programa pide salvación de CON: si falla, una herida moderada sin tratar se agrava (y, en nivel 5, las rojas reabiertas empeoran).`;
