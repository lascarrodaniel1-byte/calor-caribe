// Combate bajo el agua: contener la respiración, ahogarse y cómo cambian los ataques.
import { agregarCondicion } from "./condiciones.js";
import { localizar, condsDe } from "./combate.js";
import type { Partida, Personaje } from "./estado.js";
import { marcarMuerto, mod, valor } from "./reglas.js";
import { avanzarSiHay } from "./espacio.js";

export interface Sumergido {
  /** Asaltos que le quedan conteniendo la respiración. */
  aire: number;
  /** Asaltos que aguanta sin aire antes de caer a 0 PV (se cuentan cuando aire llega a 0). */
  sinAire: number;
  nadador?: boolean;
  /** Segundos del reloj hasta los que ya se le ha contado el aire. */
  marca?: number;
}

const ES_SUMERGIDO = /^sumergido/i;
export const estaSumergido = (conds: string[]) => conds.some((c) => ES_SUMERGIDO.test(c));

/** Un minuto = 10 asaltos de 6 segundos. Aire: (1 + mod. CON) minutos, mínimo 30 s; luego mod. CON asaltos (mínimo 1). */
export function respiracion(p: Personaje): { aire: number; sinAire: number } {
  const m = mod(valor(p, "con"));
  return { aire: Math.max(5, (1 + m) * 10), sinAire: Math.max(1, m) };
}

/** Los pone bajo el agua; devuelve las líneas. */
export function alAgua(partida: Partida, nombres: string[], nadador = false): string[] {
  const out: string[] = [];
  for (const n of nombres) {
    const c = localizar(partida, n);
    const conds = condsDe(c);
    if (estaSumergido(conds)) { out.push(`${c.nombre} ya está bajo el agua.`); continue; }
    agregarCondicion(conds, nadador ? "sumergido (nadador)" : "sumergido");
    if (c.tipo === "pj") {
      const r = respiracion(c.p);
      c.p.sumergido = { ...r, nadador };
      c.p.nave = undefined;
      out.push(`${c.nombre} se hunde bajo el agua: contiene la respiración ${r.aire / 10} min (${r.aire} asaltos) y luego aguanta ${r.sinAire} asalto(s) antes de caer.`);
    } else out.push(`${c.nombre} está bajo el agua (lleva tú su aire).`);
  }
  return out;
}

export function emerger(partida: Partida, nombres: string[]): string[] {
  const out: string[] = [];
  for (const n of nombres) {
    const c = localizar(partida, n);
    const conds = condsDe(c);
    if (!estaSumergido(conds)) { out.push(`${c.nombre} no está bajo el agua.`); continue; }
    conds.splice(0, conds.length, ...conds.filter((x) => !ES_SUMERGIDO.test(x)));
    if (c.tipo === "pj") { delete c.p.sumergido; out.push(`${c.nombre} saca la cabeza del agua y respira: recupera el aire entero.`); }
    else out.push(`${c.nombre} sale del agua.`);
  }
  return out;
}

/** Gasta asaltos de aire a cada sumergido; quien se queda sin aire cae a 0 PV, y si ya estaba a 0, se ahoga. */
export function gastarAire(partida: Partida, asaltos: number): string[] {
  return Object.values(partida.personajes).flatMap((p) => gastarAireDe(partida, p, asaltos));
}

export function gastarAireDe(_partida: Partida, p: Personaje, asaltos: number): string[] {
  const out: string[] = [];
  {
    const s = p.sumergido;
    if (!s || p.condiciones.includes("muerto")) return out;
    for (let i = 0; i < asaltos; i++) {
      if (s.aire > 0) { s.aire--; if (s.aire === 0) out.push(`${p.nombre} se queda sin aire: le quedan ${s.sinAire} asalto(s) de ahogo.`); continue; }
      if (p.pv <= 0) { marcarMuerto(p); out.push(`☠ ${p.nombre} se ahoga.`); break; }
      if (s.sinAire > 0 && --s.sinAire > 0) continue;
      p.pv = 0;
      out.push(`${p.nombre} se ahoga: cae a 0 PV, inconsciente bajo el agua. Sácalo ya o morirá.`);
      s.sinAire = 0;
      break;
    }
  }
  return out;
}

export const pasarAsaltoAgua = (partida: Partida): string[] => gastarAire(partida, 1);

/** Ajustes a un ataque por el agua: desventaja o ataque imposible. */
const ARMAS_AGUA = /daga|cuchillo|kunai|jabalina|espada corta|lanza|tridente|dardo|estoque corto/i;
const DISTANCIA_AGUA = /ballesta|red\b|jabalina|lanza|tridente|dardo|daga|hacha de mano/i;

export function ajusteAgua(sumergido: boolean, nadador: boolean, distancia: boolean, arma?: string): { desventaja?: string; error?: string } {
  if (!sumergido) return {};
  if (distancia) {
    if (arma && DISTANCIA_AGUA.test(arma)) return {};
    return { desventaja: `bajo el agua, ${arma ?? "un arma a distancia"} sufre desventaja (solo ballestas, redes y armas arrojadizas como jabalina o tridente funcionan bien)` };
  }
  if (nadador || (arma && ARMAS_AGUA.test(arma))) return {};
  return { desventaja: `bajo el agua, ${arma ? `con ${arma}` : "sin decir el arma"}, ataca con desventaja (solo daga, jabalina, espada corta, lanza o tridente se salvan, o quien nada de verdad)` };
}

export interface DatosAgua {
  accion: "sumergir" | "emerger" | "nadar" | "ver";
  quienes?: string[];
  nadador?: boolean;
  /** nadar: minutos bajo el agua (gasta el aire). */
  minutos?: number;
}

export function agua(partida: Partida, d: DatosAgua): string {
  const todos = Object.values(partida.personajes).filter((p) => !p.condiciones.includes("muerto"));
  if (d.accion === "ver") {
    const l = todos.filter((p) => p.sumergido);
    return l.length ? l.map((p) => `${p.nombre}: ${p.sumergido!.aire > 0 ? `${p.sumergido!.aire} asaltos de aire` : `SIN AIRE (${p.sumergido!.sinAire} asaltos)`}${p.pv <= 0 ? " — a 0 PV" : ""}`).join("\n") : "Nadie está bajo el agua.";
  }
  const nombres = d.quienes?.length ? d.quienes : todos.map((p) => p.nombre);
  if (d.accion === "sumergir") return alAgua(partida, nombres, d.nadador).join("\n");
  if (d.accion === "emerger") return emerger(partida, nombres).join("\n");
  if (!d.minutos) throw new Error("nadar: di cuántos minutos pasan bajo el agua (minutos).");
  avanzarSiHay(partida, d.minutos * 60);
  return [`Pasan ${d.minutos} min bajo el agua (${d.minutos * 10} asaltos de aire).`, ...gastarAire(partida, d.minutos * 10)].join("\n");
}

export function textoAgua(partida: Partida): string {
  const l = Object.values(partida.personajes).filter((p) => p.sumergido);
  if (!l.length) return "";
  return `## Bajo el agua\n${l.map((p) => `- ${p.nombre}: ${p.sumergido!.aire > 0 ? `${p.sumergido!.aire} asaltos de aire` : `¡SIN AIRE! ${p.sumergido!.sinAire} asalto(s) de ahogo`}${p.sumergido!.nadador ? " (nadador)" : ""}`).join("\n")}`;
}

export const REGLAS_AGUA = `## Combate bajo el agua
- Sumerge con agua {accion: sumergir, quienes} (y nadador=true si nada de verdad). Aguanta la respiración (1 + mod. CON) minutos (mínimo medio minuto); luego mod. CON asaltos (mínimo 1) y cae a 0 PV (inconsciente y muriéndose); a 0 PV bajo el agua, se ahoga. siguiente_asalto gasta el aire solo; agua {accion: nadar, minutos} gasta el de un trayecto largo. Emerger lo repone.
- Ataques bajo el agua: cuerpo a cuerpo con desventaja salvo daga, jabalina, espada corta, lanza, tridente o si nada de verdad; a distancia, desventaja salvo ballestas, redes y armas arrojadizas (un arco no sirve). Pasa siempre el arma en atacar. Los sumergidos resisten el daño de fuego (a la mitad: aplícalo tú a mano). Nadar es a la mitad de velocidad salvo que se sepa nadar; el agua agitada pide Atletismo (CD 10 a 15). La armadura pesada y la mochila cargada hunden: CD más alta o hundimiento seguro.`;
