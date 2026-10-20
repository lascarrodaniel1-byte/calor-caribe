// Salvaciones contra muerte y estabilizar (reglas básicas de D&D 5e). Un personaje que cae a 0 PV queda inconsciente y
// lleva la cuenta de éxitos y fallos: 10 o más en el d20 es un éxito; menos de 10, un fallo; un 1 son dos fallos; un 20
// lo levanta con 1 PV. Tres éxitos lo estabilizan; tres fallos lo matan. Cada golpe que recibe en el suelo es un fallo
// (dos si es crítico) y un golpe de tantos PV como su máximo lo mata en el acto.
import { describir, tirar } from "./dados.js";
import type { Partida, Personaje } from "./estado.js";
import { resolverPrueba } from "./pruebas.js";
import { marcarMuerto } from "./reglas.js";

export interface Muerte {
  exitos: number;
  fallos: number;
  estable: boolean;
  /** Tira las salvaciones con desventaja (p. ej. tras un paro cardíaco). */
  desventaja?: boolean;
}

const quitarInconsciente = (p: Personaje) => {
  p.condiciones = p.condiciones.filter((c) => c !== "inconsciente");
};

const vivo = (p: Personaje) => !p.condiciones.includes("muerto");

/** Un personaje acaba de caer a 0 PV: inconsciente y con la cuenta a cero. */
export function caerA0(p: Personaje): string {
  if (!vivo(p)) return "";
  if (p.condiciones.some((c) => /atrapado en el Eclipse/i.test(c))) {
    marcarMuerto(p);
    return `☠ ${p.nombre} cae a 0 PV atrapado en el Eclipse: muere sin salvaciones.`;
  }
  p.muerte = { exitos: 0, fallos: 0, estable: false, ...(p.muerte?.desventaja ? { desventaja: true } : {}) };
  if (!p.condiciones.includes("inconsciente")) p.condiciones.push("inconsciente");
  return `⚠ ${p.nombre} cae a 0 PV: inconsciente. Cada asalto, en su turno, salvación contra muerte (herramienta salvacion_muerte); un compañero puede estabilizarlo (herramienta estabilizar). Mientras no sea estable, cada golpe que reciba es un fallo (dos si es crítico).`;
}

/** Recupera PV (curación): sale del suelo. */
export function levantarse(p: Personaje, motivo = "recupera el conocimiento"): string {
  if (!p.muerte && !p.condiciones.includes("inconsciente")) return "";
  delete p.muerte;
  quitarInconsciente(p);
  return `${p.nombre} ${motivo} (ya no está a 0 PV).`;
}

/** Daño recibido estando a 0 PV: fallos de salvación contra muerte, o muerte instantánea. */
export function danoEnSuelo(p: Personaje, dano: number, critico: boolean): string {
  if (!vivo(p) || p.pv > 0) return "";
  if (dano >= p.pv_max) {
    marcarMuerto(p);
    return `☠ ${p.nombre} recibe ${dano} de daño a 0 PV, tanto como sus PV máximos (${p.pv_max}): muerte instantánea.`;
  }
  const m = (p.muerte ??= { exitos: 0, fallos: 0, estable: false });
  m.estable = false;
  m.fallos += critico ? 2 : 1;
  if (m.fallos >= 3) {
    marcarMuerto(p);
    return `☠ ${p.nombre} recibe un golpe en el suelo (${critico ? "crítico: 2 fallos" : "1 fallo"}) y llega a 3 fallos: ha muerto.`;
  }
  return `${p.nombre} recibe un golpe a 0 PV: ${critico ? "2 fallos" : "1 fallo"} (fallos ${m.fallos}/3, éxitos ${m.exitos}/3).`;
}

export function salvacionMuerte(partida: Partida, nombre: string): string {
  const p = Object.values(partida.personajes).find((x) => x.nombre.toLowerCase() === nombre.toLowerCase() || x.jugador?.toLowerCase() === nombre.toLowerCase());
  if (!p) throw new Error(`No hay ningún personaje llamado «${nombre}».`);
  if (!vivo(p)) throw new Error(`${p.nombre} ya está muerto.`);
  if (p.pv > 0) throw new Error(`${p.nombre} tiene ${p.pv} PV: no hace salvaciones contra muerte.`);
  const m = (p.muerte ??= { exitos: 0, fallos: 0, estable: false });
  if (m.estable) return `${p.nombre} está estable (inconsciente pero sin riesgo): no necesita más salvaciones. Con 1 PV de cualquier curación despierta; si no, recupera 1 PV en 1d4 horas.`;
  // Objetos que dan ventaja o desventaja en estas salvaciones (los que lleva puestos o consigo).
  const propios = (p.inventario ?? []).map((nom) => Object.values(partida.objetos ?? {}).find((o) => o.nombre.toLowerCase() === nom.toLowerCase())?.verdad ?? "").join(" | ");
  const ventaja = /ventaja en (las )?salvaciones contra muerte/i.test(propios.replace(/desventaja/gi, ""));
  const desventaja = !!m.desventaja || /desventaja en las salvaciones contra muerte/i.test(propios);
  const modo = ventaja && !desventaja ? "ventaja" : desventaja && !ventaja ? "desventaja" : "normal";
  const t = tirar("1d20", modo);
  const n = t.dados[0];
  let r: string;
  if (n === 20) {
    p.pv = 1;
    delete p.muerte;
    quitarInconsciente(p);
    return `🎲 Salvación contra muerte de ${p.nombre}: ${describir(t)} → ¡20 natural! Recupera 1 PV y el conocimiento.`;
  }
  if (n === 1) { m.fallos += 2; r = "1 natural: DOS fallos"; }
  else if (n >= 10) { m.exitos += 1; r = "éxito"; }
  else { m.fallos += 1; r = "fallo"; }
  let fin = "";
  if (m.fallos >= 3) {
    marcarMuerto(p);
    fin = ` ☠ Tres fallos: ${p.nombre} muere.`;
  } else if (m.exitos >= 3) {
    m.estable = true;
    m.exitos = 0;
    m.fallos = 0;
    fin = ` Tres éxitos: ${p.nombre} queda ESTABLE (inconsciente, sin más riesgo; recupera 1 PV en 1d4 horas).`;
  }
  return `🎲 Salvación contra muerte de ${p.nombre}: ${describir(t)} → ${r}${modo !== "normal" ? ` (${modo})` : ""} (éxitos ${m.exitos}/3, fallos ${m.fallos}/3).${fin}`;
}

/** Estabilizar a un compañero a 0 PV: prueba de Sabiduría (Medicina) CD 10 (o un botiquín que lo haga sin tirar). */
export function estabilizar(partida: Partida, d: { objetivo: string; quien: string; automatico?: boolean }): string {
  const p = Object.values(partida.personajes).find((x) => x.nombre.toLowerCase() === d.objetivo.toLowerCase() || x.jugador?.toLowerCase() === d.objetivo.toLowerCase());
  if (!p) throw new Error(`No hay ningún personaje llamado «${d.objetivo}».`);
  if (!vivo(p)) throw new Error(`${p.nombre} ya está muerto.`);
  if (p.pv > 0) throw new Error(`${p.nombre} tiene ${p.pv} PV: no hace falta estabilizarlo.`);
  const m = (p.muerte ??= { exitos: 0, fallos: 0, estable: false });
  if (m.estable) return `${p.nombre} ya está estable.`;
  let ok = !!d.automatico;
  let texto = "";
  if (!ok) {
    const r = resolverPrueba(partida, { quien: d.quien, habilidad: "medicina", cd: 10, motivo: `estabilizar a ${p.nombre}` });
    ok = r.exito;
    texto = r.texto + "\n";
  }
  if (!ok) return `${texto}No lo logra: ${p.nombre} sigue muriéndose (éxitos ${m.exitos}/3, fallos ${m.fallos}/3).`;
  m.estable = true;
  m.exitos = 0;
  m.fallos = 0;
  return `${texto}${p.nombre} queda ESTABLE: inconsciente, pero ya no hace salvaciones contra muerte. Recupera 1 PV en 1d4 horas si nadie le cura antes.`;
}

/** Tras una herramienta: ¿alguien cayó a 0 PV o se levantó? Devuelve los avisos. */
export function revisarCaidas(partida: Partida, antes: Record<string, { pv: number; muerto: boolean }>): string[] {
  const out: string[] = [];
  for (const p of Object.values(partida.personajes)) {
    const a = antes[p.nombre];
    if (!a) continue;
    if (a.pv > 0 && p.pv === 0 && vivo(p) && !a.muerto) {
      const t = caerA0(p);
      if (t) out.push(t);
    } else if (a.pv === 0 && p.pv > 0 && vivo(p)) {
      const t = levantarse(p);
      if (t) out.push(t);
    } else if (p.pv === 0 && vivo(p) && !p.muerte && !p.condiciones.includes("inconsciente (anemia)")) {
      // Llegó a 0 por un camino que no pasó por aquí (p. ej. se guardó ya a 0 PV).
      const t = caerA0(p);
      if (t) out.push(t);
    }
  }
  return out;
}

export function textoMuerte(p: Personaje): string {
  if (!p.muerte || !vivo(p) || p.pv > 0) return "";
  return p.muerte.estable ? "ESTABLE a 0 PV (inconsciente, sin riesgo)" : `A 0 PV, muriéndose: éxitos ${p.muerte.exitos}/3, fallos ${p.muerte.fallos}/3`;
}

export const REGLAS_MUERTE = `## A 0 PV: salvaciones contra muerte
- Quien llega a 0 PV queda inconsciente y el programa lleva la cuenta (verás «A 0 PV, muriéndose: éxitos/fallos» en su ficha). En su turno, haz salvacion_muerte (no tires a mano): 10+ éxito, menos de 10 fallo, 1 son dos fallos, 20 lo levanta con 1 PV. Tres éxitos: estable. Tres fallos: muerto.
- Cada golpe que recibe en el suelo es un fallo (dos si es crítico) y un golpe de tantos PV como su máximo lo mata: atacar y las habilidades de criaturas lo aplican solos. Un compañero lo estabiliza con estabilizar (prueba de Medicina CD 10). Cualquier curación que le devuelva PV lo despierta.
- Las hemorragias y las heridas graves siguen su propio sistema: estabilizarlo no detiene una herida roja.`;
