// Agarrar, empujar y escapar (reglas básicas de D&D 5e), y cobertura. Agarrar y empujar sustituyen un ataque: es una
// prueba enfrentada de Atletismo (FUE) del atacante contra Atletismo (FUE) o Acrobacias (DES) del objetivo, lo mejor de los dos.
// Un empate deja las cosas como estaban. El objetivo no puede ser más de un tamaño mayor que el atacante.
import { describir, tirar } from "./dados.js";
import type { Partida } from "./estado.js";
import { aplicarCondicion, condsDe, igual, localizar, type Combatiente } from "./combate.js";
import { efectos, reconocer } from "./condiciones.js";
import { actualizarPlano, distanciaPlano } from "./espacio.js";
import { COMPETENCIAS_CLASE } from "./pruebas.js";
import { competencia, mod, signo, valor } from "./reglas.js";

export const COBERTURA = {
  media: { ca: 2, nombre: "cobertura media (muro bajo, mueble grande, otra criatura)" },
  tres_cuartos: { ca: 5, nombre: "cobertura de tres cuartos (rastrillo, tronera, tronco grueso)" },
} as const;

function atributoCriatura(texto: string, a: "FUE" | "DES"): number {
  const m = new RegExp(`${a}\\s+(\\d+)`, "i").exec(texto);
  return m ? Number(m[1]) : 10;
}

/** Bono de Atletismo o Acrobacias de un combatiente (PJ por ficha; criatura por atributos; PNJ con el bono que dé el DM). */
function bono(c: Combatiente, habilidad: "atletismo" | "acrobacias", extra?: number): { bono: number; desglose: string } {
  if (extra !== undefined) return { bono: extra, desglose: `bono ${signo(extra)}` };
  if (c.tipo === "pj") {
    const attr = habilidad === "atletismo" ? "fue" : "des";
    const comp = (COMPETENCIAS_CLASE[c.p.clase] ?? []).includes(habilidad) ? competencia(c.p) : 0;
    const m = mod(valor(c.p, attr));
    return { bono: m + comp, desglose: `${attr.toUpperCase()} ${signo(m)}${comp ? `, competencia ${signo(comp)}` : ""}` };
  }
  if (c.tipo === "criatura") {
    const a = habilidad === "atletismo" ? "FUE" : "DES";
    const m = mod(atributoCriatura(c.j.definicion.atributos, a));
    return { bono: m, desglose: `${a} ${signo(m)}` };
  }
  const m = habilidad === "atletismo" ? 0 : mod(c.n.des ?? 10);
  return { bono: m, desglose: `${habilidad === "atletismo" ? "sin dato de FUE (pasa bono_atacante/bono_objetivo)" : `DES ${signo(m)}`}` };
}

function sinAccion(c: Combatiente): string | null {
  const e = efectos(condsDe(c));
  return e.incapacitado ? `${c.nombre} está ${e.motivos.join(", ")}: no puede actuar` : null;
}

export interface DatosManiobra {
  atacante: string;
  objetivo: string;
  tipo: "agarrar" | "empujar" | "escapar";
  /** empujar: derribarlo o apartarlo 1,5 m. */
  efecto?: "derribar" | "alejar";
  /** Bono total de Atletismo del atacante / de la defensa del objetivo (obligatorio solo para PNJ sin datos). */
  bono_atacante?: number;
  bono_objetivo?: number;
  ventaja?: boolean;
  desventaja?: boolean;
}

export function maniobra(partida: Partida, d: DatosManiobra): string {
  const at = localizar(partida, d.atacante);
  const ob = localizar(partida, d.objetivo);
  if (at === ob) throw new Error("Atacante y objetivo son el mismo.");
  const m = sinAccion(at);
  if (m) throw new Error(m + ".");
  const dist = distanciaPlano(partida, at.nombre, ob.nombre);
  if (dist && dist.metros > 2) throw new Error(`${ob.nombre} está a ${dist.metros} m de ${at.nombre}: fuera de alcance (agarrar y empujar son cuerpo a cuerpo, 1,5 m).`);
  const ea = efectos(condsDe(at));
  // Escapar: el agarrado (atacante) contra quien lo agarra (objetivo).
  const notaAgarre = (c: Combatiente) => condsDe(c).find((x) => reconocer(x)?.id === "agarrado");
  if (d.tipo === "escapar") {
    if (!notaAgarre(at)) throw new Error(`${at.nombre} no está agarrado.`);
  }
  const efO = efectos(condsDe(ob));
  const a = bono(at, "atletismo", d.bono_atacante);
  const aA = d.tipo === "escapar" ? (() => {
    const atl = bono(at, "atletismo", d.bono_atacante), acr = bono(at, "acrobacias", d.bono_atacante);
    return atl.bono >= acr.bono ? { ...atl, hab: "Atletismo" } : { ...acr, hab: "Acrobacias" };
  })() : { ...a, hab: "Atletismo" };
  const atl = bono(ob, "atletismo", d.bono_objetivo), acr = bono(ob, "acrobacias", d.bono_objetivo);
  const def = d.tipo === "escapar" ? { ...atl, hab: "Atletismo" } : atl.bono >= acr.bono ? { ...atl, hab: "Atletismo" } : { ...acr, hab: "Acrobacias" };
  const modoA = (d.ventaja && !d.desventaja) ? "ventaja" : (d.desventaja && !d.ventaja) ? "desventaja" : ea.pruebas === "desventaja" ? "desventaja" : "normal";
  const ta = tirar(`1d20${signo(aA.bono)}`, modoA);
  const incapObjetivo = efO.incapacitado;
  const modoD = efO.pruebas === "desventaja" ? "desventaja" : "normal";
  const td = tirar(`1d20${signo(def.bono)}`, modoD);
  const gana = !incapObjetivo && ta.total > td.total || (incapObjetivo && ta.total >= 0);
  const cabecera = `${at.nombre} (${aA.hab} ${describir(ta)}${modoA !== "normal" ? `, ${modoA}` : ""}) contra ${ob.nombre} (${def.hab} ${describir(td)}${modoD !== "normal" ? `, ${modoD}` : ""})${incapObjetivo ? " — está incapacitado: no se resiste" : ""}`;
  if (!gana) return `${cabecera} → FALLA${ta.total === td.total ? " (empate: todo sigue igual)" : ""}.`;

  if (d.tipo === "agarrar") {
    const r = aplicarCondicion(partida, { objetivo: ob.nombre, accion: "aplicar", condicion: "agarrado", nota: `por ${at.nombre}` });
    return `${cabecera} → ¡AGARRA! ${r.split("\n")[0]} Mientras lo sujeta, ${at.nombre} tiene una mano ocupada; si queda incapacitado o lo apartan, lo suelta.`;
  }
  if (d.tipo === "escapar") {
    const resto = condsDe(at).filter((x) => reconocer(x)?.id !== "agarrado");
    condsDe(at).splice(0, condsDe(at).length, ...resto);
    return `${cabecera} → ¡SE ZAFA! ${at.nombre} ya no está agarrado.`;
  }
  // empujar
  if (d.efecto === "derribar") {
    const r = aplicarCondicion(partida, { objetivo: ob.nombre, accion: "aplicar", condicion: "derribado" });
    return `${cabecera} → ¡LO DERRIBA! ${r.split("\n")[0]}`;
  }
  let plano = "";
  if (partida.plano && Object.keys(partida.plano.puntos).some((k) => igual(k, ob.nombre)) && Object.keys(partida.plano.puntos).some((k) => igual(k, at.nombre))) {
    try { plano = "\n" + actualizarPlano(partida, { mover: [{ nombre: ob.nombre, de: at.nombre, metros: 1.5 }] }).split("\n")[0]; } catch { /* sin plano utilizable */ }
  }
  return `${cabecera} → ¡LO APARTA! ${ob.nombre} retrocede 1,5 m.${plano}`;
}

export const REGLAS_MANIOBRAS = `## Agarrar, empujar, escapar y cobertura
- Agarrar o empujar sustituye a un ataque y usa la herramienta maniobra: prueba enfrentada de Atletismo del atacante contra Atletismo o Acrobacias del objetivo (la mejor). Si gana, agarrar deja al objetivo agarrado (velocidad 0) y empujar lo derriba o lo aparta 1,5 m. No vale contra un objetivo más de un tamaño mayor. Empate: sigue igual. El agarrado se zafa con maniobra {tipo: escapar} (su acción).
- Cobertura: pásala en atacar (cobertura): media da +2 a la CA y a las salvaciones de DES, tres cuartos +5; la cobertura total impide apuntar al objetivo. Para una salvación de DES a cubierto usa el parámetro cobertura de prueba.`;
