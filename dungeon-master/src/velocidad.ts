// Velocidad de los combatientes: cuánto pueden moverse por asalto en el plano (a la mitad en el agua si no son del agua,
// el doble si corren, 0 si están agarrados, sometidos o paralizados…). Solo cuenta el movimiento voluntario que mueve el DM con plano.
import type { Partida } from "./estado.js";
import { nivelAgotamiento, efectos } from "./condiciones.js";
import { condsDe, localizar, turnoDe, type Combatiente } from "./combate.js";
import { esAcuatico, estaEnAgua, estaSumergido } from "./agua.js";
import { RAZAS } from "./mundo.js";

const BASE = 9; // metros por asalto de un personaje o PNJ sin dato (los personajes, según su raza)

function numero(texto: string, patron: RegExp): number | undefined {
  const m = patron.exec(texto);
  return m ? Number(m[1].replace(",", ".")) : undefined;
}

/** La velocidad de caminar (o nadar, si está en el agua y es del agua) en metros, con sus modificadores, y por qué. */
export function velocidadDe(partida: Partida, c: Combatiente): { metros: number; motivos: string[] } {
  const conds = condsDe(c);
  const motivos: string[] = [];
  let v = BASE;
  let nada: number | undefined;
  if (c.tipo === "pj") { v = RAZAS.find((r) => r.nombre === c.p.raza)?.velocidad ?? BASE; if (v !== BASE) motivos.push(`velocidad de su raza: ${v} m`); }
  if (c.tipo === "criatura") {
    const txt = c.j.definicion.velocidad;
    const buena = (n: number | undefined): number | undefined => (n !== undefined && Number.isFinite(n) && n > 0 ? n : undefined);
    const anda = buena(numero(txt ?? "", /^\s*(\d+(?:[.,]\d+)?)\s*m/i));
    const vuela = buena(numero(txt ?? "", /volar\s+(\d+(?:[.,]\d+)?)/i));
    nada = buena(numero(txt ?? "", /nadar\s+(\d+(?:[.,]\d+)?)/i));
    v = anda ?? BASE;
    if (vuela !== undefined && vuela > v) { v = vuela; motivos.push(`vuela a ${vuela} m`); } // un volador se mueve a su velocidad de vuelo
    else if (vuela === undefined && anda === undefined && nada === undefined) v = BASE;
  }
  const enAgua = estaEnAgua(conds) || estaSumergido(conds);
  if (enAgua) {
    if (esAcuatico(c) || conds.some((x) => /nadador/i.test(x))) { if (nada !== undefined) { v = nada; motivos.push(`nada a ${nada} m`); } }
    else { v = v / 2; motivos.push("mitad por el agua"); }
  }
  const ef = efectos(conds);
  if (ef.velocidad0) return { metros: 0, motivos: ["velocidad 0 (agarrado, sometido, paralizado…)"] };
  const ag = nivelAgotamiento(conds);
  if (ag >= 5) return { metros: 0, motivos: ["agotamiento 5: no puede moverse"] };
  if (ag >= 2) { v = v / 2; motivos.push("mitad por el agotamiento"); }
  const t = partida.combate ? turnoDe(partida, c.nombre) : {};
  if (partida.combate && t.corrioRonda === partida.combate.ronda) { v *= 2; motivos.push("corre: el doble"); }
  return { metros: v, motivos };
}

/**
 * Revisa el movimiento hecho con plano {mover} en combate: quien se pasa de su velocidad en este asalto se queda donde le alcanza
 * (se le recorta el movimiento sobre la marcha) y se avisa; apunta lo que cada uno ha recorrido. Devuelve los avisos.
 */
export function limitarMovimiento(partida: Partida, nombres: string[], antes: Record<string, { x: number; y: number }>): string[] {
  const pts = partida.plano?.puntos;
  if (!partida.combate || !pts) return [];
  const avisos: string[] = [];
  const vistos = new Set<string>();
  for (const n of nombres) {
    const k = Object.keys(pts).find((x) => x.toLowerCase() === n.toLowerCase());
    if (!k || vistos.has(k)) continue;
    vistos.add(k);
    const a = antes[k], d = pts[k];
    if (!a || !d) continue;
    const metros = Math.hypot(d.x - a.x, d.y - a.y);
    if (metros < 0.05) continue;
    let c: Combatiente; try { c = localizar(partida, k); } catch { continue; } // una cosa del plano, no un combatiente
    const { metros: vel, motivos } = velocidadDe(partida, c);
    const t = turnoDe(partida, c.nombre);
    const quedan = Math.max(0, vel - (t.movido ?? 0));
    let hecho = metros;
    if (metros > quedan + 0.05) {
      hecho = quedan;
      const f = quedan / metros;
      d.x = Math.round((a.x + (d.x - a.x) * f) * 10) / 10;
      d.y = Math.round((a.y + (d.y - a.y) * f) * 10) / 10;
      avisos.push(`⏱ ${c.nombre} se queda corto: se mueve a ${vel} m por asalto${motivos.length ? ` (${motivos.join(", ")})` : ""}${t.movido ? ` y ya había recorrido ${Math.round(t.movido * 10) / 10} m` : ""}, así que solo avanza ${Math.round(hecho * 10) / 10} de los ${Math.round(metros * 10) / 10} m pedidos y se detiene en el camino.${t.corrioRonda === partida.combate.ronda ? "" : " (Si corre, accion_combate correr, mueve el doble.)"}`);
    }
    t.movido = (t.movido ?? 0) + hecho;
  }
  return avisos;
}
