// Combate bajo el agua: contener la respiración, ahogarse y cómo cambian los ataques.
import { tiene } from "./dotes_base.js";
import { agregarCondicion } from "./condiciones.js";
import { localizar, condsDe, type Combatiente } from "./combate.js";
import type { Partida, Personaje } from "./estado.js";
import { marcarMuerto, mod, valor } from "./reglas.js";
import { avanzarSiHay } from "./espacio.js";

export interface Sumergido {
  /** Asaltos que le quedan conteniendo la respiración. */
  aire: number;
  /** Asaltos que aguanta sin aire antes de caer a 0 PV (se cuentan cuando aire llega a 0). */
  sinAire: number;
  nadador?: boolean;
  /** Respira bajo el agua (Tritón): no gasta aire ni se ahoga. */
  anfibio?: boolean;
  /** Segundos del reloj hasta los que ya se le ha contado el aire. */
  marca?: number;
}

const ES_SUMERGIDO = /^sumergido/i;
export const estaSumergido = (conds: string[]) => conds.some((c) => ES_SUMERGIDO.test(c));
const ES_EN_AGUA = /^en el agua/i;
export const estaEnAgua = (conds: string[]) => conds.some((c) => ES_EN_AGUA.test(c));
const NOMBRE_ACUATICO = /ahogad|sirena|hombre pez|elemental de agua|hidra|tritón|triton|kraken|leviat/i;

/** ¿Es del agua? Los Tritones, las criaturas que nadan o respiran bajo el agua (sirenas, hombres pez, ahogados…) y quien el DM marque «nadador»: no sufren las penalizaciones del agua. */
export function esAcuatico(c: Combatiente): boolean {
  if (c.tipo === "pj") return c.p.raza === "Tritón de las Mareas";
  if (c.tipo === "criatura") {
    const d = c.j.definicion;
    return /nadar/i.test(d.velocidad) || d.rasgos.some((r) => /anfibi|acu[aá]tic|respira (bajo el )?agua/i.test(r)) || NOMBRE_ACUATICO.test(d.nombre);
  }
  return NOMBRE_ACUATICO.test(c.nombre) || condsDe(c).some((x) => /nadador/i.test(x));
}

/** Un minuto = 10 asaltos de 6 segundos. Aire: (1 + mod. CON) minutos, mínimo 30 s; luego mod. CON asaltos (mínimo 1). */
export function respiracion(p: Personaje): { aire: number; sinAire: number } {
  const m = mod(valor(p, "con"));
  const dobla = tiene(p, "marinero") ? 2 : 1; // Marinero: aguanta el doble
  return { aire: Math.max(5, (1 + m) * 10) * dobla, sinAire: Math.max(1, m) * dobla };
}

/** Los pone bajo el agua; devuelve las líneas. */
export function alAgua(partida: Partida, nombres: string[], nadador = false): string[] {
  const out: string[] = [];
  for (const n of nombres) {
    const c = localizar(partida, n);
    const conds = condsDe(c);
    if (estaSumergido(conds)) { out.push(`${c.nombre} ya está bajo el agua.`); continue; }
    const nativo = esAcuatico(c);
    agregarCondicion(conds, nadador || nativo ? "sumergido (nadador)" : "sumergido");
    agregarCondicion(conds, nadador || nativo ? "en el agua (nadador)" : "en el agua");
    if (c.tipo === "pj") {
      if (c.p.raza === "Tritón de las Mareas") {
        agregarCondicion(conds, "sumergido (nadador)");
        c.p.sumergido = { aire: 0, sinAire: 0, nadador: true, anfibio: true };
        c.p.nave = undefined;
        out.push(`${c.nombre} se sumerge: es un Tritón, respira bajo el agua y nada con soltura (no gasta aire).`);
        continue;
      }
      const r = respiracion(c.p);
      c.p.sumergido = { ...r, nadador: nadador || tiene(c.p, "marinero") };
      c.p.nave = undefined;
      out.push(`${c.nombre} se hunde bajo el agua: contiene la respiración ${r.aire / 10} min (${r.aire} asaltos) y luego aguanta ${r.sinAire} asalto(s) antes de caer.`);
    } else out.push(nativo ? `${c.nombre} está en su elemento bajo el agua: sin penalizaciones.` : `${c.nombre} está bajo el agua (lleva tú su aire). No es del agua: ataca con desventaja, a la mitad de velocidad y con la mitad de daño (un tercio menos con armas de punta).`);
  }
  return out;
}

/** Los mete en el agua sin hundirlos (nadando, vadeando, agua hasta el pecho). */
export function entrarEnAgua(partida: Partida, nombres: string[]): string[] {
  return nombres.map((n) => {
    const c = localizar(partida, n);
    const conds = condsDe(c);
    if (estaEnAgua(conds) || estaSumergido(conds)) return `${c.nombre} ya está en el agua.`;
    const nativo = esAcuatico(c);
    agregarCondicion(conds, nativo ? "en el agua (nadador)" : "en el agua");
    return nativo ? `${c.nombre} entra en el agua: es del agua, sin penalizaciones.` : `${c.nombre} entra en el agua: sin pie firme, ataca cuerpo a cuerpo con desventaja y con −2 al daño, y va a la mitad de velocidad (si se hunde, aún peor).`;
  });
}

/** Los saca del agua del todo: pisan tierra firme. */
export function salirDelAgua(partida: Partida, nombres: string[]): string[] {
  return nombres.map((n) => {
    const c = localizar(partida, n);
    const conds = condsDe(c);
    if (!estaEnAgua(conds) && !estaSumergido(conds)) return `${c.nombre} no está en el agua.`;
    conds.splice(0, conds.length, ...conds.filter((x) => !ES_SUMERGIDO.test(x) && !ES_EN_AGUA.test(x)));
    if (c.tipo === "pj") delete c.p.sumergido;
    return `${c.nombre} sale del agua y pisa tierra firme.`;
  });
}

export function emerger(partida: Partida, nombres: string[]): string[] {
  const out: string[] = [];
  for (const n of nombres) {
    const c = localizar(partida, n);
    const conds = condsDe(c);
    if (!estaSumergido(conds)) { out.push(`${c.nombre} no está bajo el agua.`); continue; }
    conds.splice(0, conds.length, ...conds.filter((x) => !ES_SUMERGIDO.test(x)));
    if (!estaEnAgua(conds)) agregarCondicion(conds, esAcuatico(c) ? "en el agua (nadador)" : "en el agua");
    if (c.tipo === "pj") { delete c.p.sumergido; out.push(`${c.nombre} saca la cabeza del agua y respira: recupera el aire entero (sigue en el agua: usa agua {accion: salir} cuando pise tierra firme).`); }
    else out.push(`${c.nombre} saca la cabeza del agua (sigue en el agua).`);
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
    if (!s || s.anfibio || p.condiciones.includes("muerto")) return out;
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

/** Ajustes a un ataque por el agua. Quien no es del agua lo sufre: en el agua, desventaja cuerpo a cuerpo; sumergido, desventaja en todo
 *  (quien nada de verdad solo a distancia). Los del agua (Tritones, sirenas, ahogados…) no sufren nada. */
export function ajusteAgua(e: { sumergido: boolean; enAgua: boolean; acuatico: boolean; entrenado: boolean }, distancia: boolean, arma?: string): { desventaja?: string; error?: string } {
  if (e.acuatico || (!e.sumergido && !e.enAgua)) return {};
  if (e.sumergido) {
    if (distancia) return { desventaja: `bajo el agua, ${arma ?? "un arma a distancia"} sufre desventaja (el agua frena el proyectil)` };
    if (e.entrenado) return {};
    return { desventaja: `bajo el agua, ${arma ? `con ${arma}` : "sin decir el arma"}, ataca con desventaja (no es del agua: se mueve lento y torpe)` };
  }
  if (distancia || e.entrenado) return {};
  return { desventaja: "en el agua, sin pie firme, ataca cuerpo a cuerpo con desventaja" };
}

/** Armas de punta que se reconocen aunque el motor las clasifique de otro modo (la espada corta es un arma de estocada). */
const PUNTA_EXTRA = /espada corta|gladio|gladius/i;
/** ¿Un ataque de punta (perforante: daga, lanza, tridente, jabalina, estoque, espada corta, flecha, virote)? `tipo` es el tipo de daño ya calculado en atacar. */
export const esArmaDePunta = (tipo?: string, arma?: string): boolean => tipo === "punta" || (!!arma && PUNTA_EXTRA.test(arma));

/** El daño que pierde quien no es del agua: sumergido, la mitad (un tercio si el arma es de punta, que se hunde en línea recta); en el agua, −2 en cuerpo a cuerpo (mínimo 1 si había daño). */
export function danoEnAgua(e: { sumergido: boolean; enAgua: boolean; acuatico: boolean }, distancia: boolean, dano: number, punta = false): { dano: number; nota: string } {
  if (e.acuatico || dano <= 0) return { dano, nota: "" };
  if (e.sumergido && punta) { const n = Math.max(1, Math.floor((dano * 2) / 3)); return { dano: n, nota: `🌊 Bajo el agua el arma de punta pierde solo un tercio de fuerza (${dano} → ${n}); el resto de armas, la mitad.` }; }
  if (e.sumergido) { const n = Math.max(1, Math.floor(dano / 2)); return { dano: n, nota: `🌊 Bajo el agua el golpe pierde fuerza (${dano} → ${n}).` }; }
  if (e.enAgua && !distancia) { const n = Math.max(1, dano - 2); return { dano: n, nota: `🌊 En el agua, sin apoyo, el golpe pierde fuerza (${dano} → ${n}).` }; }
  return { dano, nota: "" };
}

export interface DatosAgua {
  accion: "sumergir" | "emerger" | "nadar" | "ver" | "entrar" | "salir";
  quienes?: string[];
  nadador?: boolean;
  /** nadar: minutos bajo el agua (gasta el aire). */
  minutos?: number;
}

export function agua(partida: Partida, d: DatosAgua): string {
  const todos = Object.values(partida.personajes).filter((p) => !p.condiciones.includes("muerto"));
  if (d.accion === "ver") {
    const l = todos.filter((p) => p.sumergido);
    return l.length ? l.map((p) => `${p.nombre}: ${p.sumergido!.anfibio ? "respira bajo el agua" : p.sumergido!.aire > 0 ? `${p.sumergido!.aire} asaltos de aire` : `SIN AIRE (${p.sumergido!.sinAire} asaltos)`}${p.pv <= 0 ? " — a 0 PV" : ""}`).join("\n") : "Nadie está bajo el agua.";
  }
  const nombres = d.quienes?.length ? d.quienes : todos.map((p) => p.nombre);
  if (d.accion === "sumergir") return alAgua(partida, nombres, d.nadador).join("\n");
  if (d.accion === "emerger") return emerger(partida, nombres).join("\n");
  if (d.accion === "entrar") return entrarEnAgua(partida, nombres).join("\n");
  if (d.accion === "salir") return salirDelAgua(partida, nombres).join("\n");
  if (!d.minutos) throw new Error("nadar: di cuántos minutos pasan bajo el agua (minutos).");
  avanzarSiHay(partida, d.minutos * 60);
  return [`Pasan ${d.minutos} min bajo el agua (${d.minutos * 10} asaltos de aire).`, ...gastarAire(partida, d.minutos * 10)].join("\n");
}

export function textoAgua(partida: Partida): string {
  const l = Object.values(partida.personajes).filter((p) => p.sumergido);
  if (!l.length) return "";
  return `## Bajo el agua\n${l.map((p) => `- ${p.nombre}: ${p.sumergido!.anfibio ? "respira bajo el agua" : p.sumergido!.aire > 0 ? `${p.sumergido!.aire} asaltos de aire` : `¡SIN AIRE! ${p.sumergido!.sinAire} asalto(s) de ahogo`}${p.sumergido!.nadador ? " (nadador)" : ""}`).join("\n")}`;
}

export const REGLAS_AGUA = `## Combate bajo el agua
- Sumerge con agua {accion: sumergir, quienes} (y nadador=true si nada de verdad). Aguanta la respiración (1 + mod. CON) minutos (mínimo medio minuto); luego mod. CON asaltos (mínimo 1) y cae a 0 PV (inconsciente y muriéndose); a 0 PV bajo el agua, se ahoga. siguiente_asalto gasta el aire solo; agua {accion: nadar, minutos} gasta el de un trayecto largo. Emerger lo repone.
- QUIEN NO ES DEL AGUA (todos los personajes y criaturas salvo Tritones, sirenas, hombres pez, ahogados y lo que nada o respira bajo el agua) lo sufre: EN EL AGUA (agua {accion: entrar}), sin pie firme, ataca cuerpo a cuerpo con desventaja y −2 al daño, y va a la mitad de velocidad; SUMERGIDO, desventaja en TODOS sus ataques, la MITAD del daño (un TERCIO menos, o sea ×2/3, si el arma es de punta: daga, lanza, tridente, jabalina, estoque, espada corta, flecha o virote; el programa lo aplica por el arma) y la mitad de velocidad. Quien nada de verdad (nadador: true, o un Marinero) no tiene desventaja cuerpo a cuerpo, pero sumergido sigue perdiendo daño igual. Los del agua no sufren nada (el programa los reconoce; si una criatura del agua no lo es, márcala nadador). Pasa siempre el arma en atacar. Los sumergidos resisten el daño de fuego (a la mitad: aplícalo tú a mano). El agua agitada pide Atletismo. Al terminar, agua {accion: salir}.

- La velocidad a la mitad en el agua la aplica el programa al mover con plano en combate (recorta el movimiento y avisa). La armadura pesada y la mochila cargada hunden: CD más alta o hundimiento seguro.`;
