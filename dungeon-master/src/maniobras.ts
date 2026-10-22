// Agarrar, empujar y escapar (reglas básicas de D&D 5e), y cobertura. Agarrar y empujar sustituyen un ataque: es una
// prueba enfrentada de Atletismo (FUE) del atacante contra Atletismo (FUE) o Acrobacias (DES) del objetivo, lo mejor de los dos.
// Un empate deja las cosas como estaban. El objetivo no puede ser más de un tamaño mayor que el atacante.
import { describir, tirar } from "./dados.js";
import type { Partida } from "./estado.js";
import { aplicarCondicion, condsDe, igual, localizar, puedeActuar, retirarCaido, type Combatiente } from "./combate.js";
import { efectos, reconocer } from "./condiciones.js";
import { actualizarPlano, distanciaPlano } from "./espacio.js";
import { COMPETENCIAS_CLASE } from "./pruebas.js";
import { infligir } from "./heridas.js";
import { danoEnSuelo } from "./muerte.js";
import { danar } from "./bestiario.js";
import { competencia, marcarMuerto, mod, signo, valor } from "./reglas.js";

export const COBERTURA = {
  media: { ca: 2, nombre: "cobertura media (muro bajo, mueble grande, otra criatura)" },
  tres_cuartos: { ca: 5, nombre: "cobertura de tres cuartos (rastrillo, tronera, tronco grueso)" },
} as const;

function atributoCriatura(texto: string, a: "FUE" | "DES"): number {
  const m = new RegExp(`${a}\\s+(\\d+)`, "i").exec(texto);
  return m ? Number(m[1]) : 10;
}

/** Bono de Atletismo o Acrobacias de un combatiente (PJ por ficha; criatura por atributos; PNJ con el bono que dé el DM). */
export function bonoManiobra(c: Combatiente, habilidad: "atletismo" | "acrobacias", extra?: number): { bono: number; desglose: string } {
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

const sinAccion = (c: Combatiente): string | null => puedeActuar(c);

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
  if (igual(at.nombre, ob.nombre)) throw new Error("Atacante y objetivo son el mismo.");
  const m = sinAccion(at);
  if (m) throw new Error(m + ".");
  const dist = distanciaPlano(partida, at.nombre, ob.nombre);
  // Atado con cadenas (Flagelante): se escapa aunque quien lo ata esté a distancia.
  const conCadenas = d.tipo === "escapar" && condsDe(at).some((x) => reconocer(x)?.id === "agarrado" && /cadenas de/i.test(x));
  if (dist && dist.metros > 2 && !conCadenas) throw new Error(`${ob.nombre} está a ${dist.metros} m de ${at.nombre}: fuera de alcance (agarrar y empujar son cuerpo a cuerpo, 1,5 m).`);
  const ea = efectos(condsDe(at));
  // Escapar: el agarrado (atacante) contra quien lo agarra (objetivo).
  const notaAgarre = (c: Combatiente) => condsDe(c).find((x) => reconocer(x)?.id === "agarrado");
  if (d.tipo === "escapar") {
    const nota = notaAgarre(at);
    if (!nota) throw new Error(`${at.nombre} no está agarrado.`);
    const quien = /(?:por|cadenas de) ([^)]+)\)/i.exec(nota)?.[1];
    if (quien && !igual(quien, ob.nombre)) throw new Error(`${at.nombre} está agarrado por ${quien}, no por ${ob.nombre}: el enfrentamiento es contra ${quien}.`);
  }
  if (d.tipo === "agarrar" && condsDe(ob).some((x) => reconocer(x)?.id === "agarrado" && new RegExp(`(?:por|cadenas de) ${at.nombre}\\)`, "i").test(x))) throw new Error(`${ob.nombre} ya está agarrado por ${at.nombre}.`);
  const efO = efectos(condsDe(ob));
  const a = bonoManiobra(at, "atletismo", d.bono_atacante);
  const aA = d.tipo === "escapar" ? (() => {
    const atl = bonoManiobra(at, "atletismo", d.bono_atacante), acr = bonoManiobra(at, "acrobacias", d.bono_atacante);
    return atl.bono >= acr.bono ? { ...atl, hab: "Atletismo" } : { ...acr, hab: "Acrobacias" };
  })() : { ...a, hab: "Atletismo" };
  const atl = bonoManiobra(ob, "atletismo", d.bono_objetivo), acr = bonoManiobra(ob, "acrobacias", d.bono_objetivo);
  const def = d.tipo === "escapar" ? { ...atl, hab: "Atletismo" } : atl.bono >= acr.bono ? { ...atl, hab: "Atletismo" } : { ...acr, hab: "Acrobacias" };
  const hayV = !!d.ventaja, hayD = !!d.desventaja || ea.pruebas === "desventaja";
  const modoA = hayV && !hayD ? "ventaja" : hayD && !hayV ? "desventaja" : "normal";
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

/** Una caída: 1d6 de contundente por cada 3 m (máximo 20d6). Derriba y, si el golpe es fuerte, hiere. */
export function caida(partida: Partida, d: { quien: string; metros: number; blando?: boolean }): string {
  const c = localizar(partida, d.quien);
  if (d.metros < 1) throw new Error("Una caída es de al menos 1 m.");
  const dados = Math.min(20, Math.floor(d.metros / 3)) - (d.blando ? 1 : 0);
  if (dados < 1) return `${c.nombre} cae ${d.metros} m${d.blando ? " sobre algo blando" : ""} y se levanta sin daño.`;
  const t = tirar(`${dados}d6`);
  const lineas = [`${c.nombre} cae ${d.metros} m${d.blando ? " (aterriza sobre algo blando: un dado menos)" : ""}: ${dados}d6 → ${t.total} de daño contundente.`];
  if (c.tipo === "pj") {
    const p = c.p;
    const antes = p.pv;
    p.pv = Math.max(0, p.pv - t.total);
    if (antes <= 0) { const s = danoEnSuelo(p, t.total, false); if (s) lineas.push(s); if (p.condiciones.includes("muerto")) return lineas.join("\n"); }
    lineas.push(`${p.nombre}: PV ${p.pv}/${p.pv_max}.`);
    if (t.total - antes >= p.pv_max) {
      marcarMuerto(p);
      lineas.push(`☠ El golpe sobrante (${t.total - antes}) iguala o supera sus PV máximos (${p.pv_max}): muerte instantánea.`);
      return lineas.join("\n");
    }
    if (t.total >= Math.ceil(p.pv_max / 2) || t.total >= 10) lineas.push("Herida:\n" + infligir(p, { causa: t.total >= Math.ceil(p.pv_max / 2) ? "golpe_masivo" : "menor", tipo: "contusion", descripcion: "caída" }));
    else if (t.total >= 3) lineas.push("Herida:\n" + infligir(p, { causa: "menor", tipo: "contusion", descripcion: "caída" }));
  } else if (c.tipo === "criatura") {
    lineas.push(danar(c.j, t.total));
    if (c.j.pv <= 0) { retirarCaido(partida, c.j); return lineas.join("\n"); } // ya no está en escena: no hay nada más que derribar
  }
  else if (c.n.pv !== undefined) {
    c.n.pv = Math.max(0, c.n.pv - t.total);
    lineas.push(`${c.nombre}: −${t.total} PV → ${c.n.pv}/${c.n.pv_max ?? "?"}${c.n.pv === 0 ? " — CAE." : ""}`);
  } else lineas.push(`${c.nombre} recibe ${t.total} de daño (lleva tú sus PV).`);
  if (!condsDe(c).some((x) => reconocer(x)?.id === "derribado")) lineas.push(aplicarCondicion(partida, { objetivo: c.nombre, accion: "aplicar", condicion: "derribado" }).split("\n")[0]);
  return lineas.join("\n");
}

export const REGLAS_MANIOBRAS = `## Agarrar, empujar, escapar y cobertura
- Agarrar o empujar sustituye a un ataque y usa la herramienta maniobra: prueba enfrentada de Atletismo del atacante contra Atletismo o Acrobacias del objetivo (la mejor). Si gana, agarrar deja al objetivo agarrado (velocidad 0) y empujar lo derriba o lo aparta 1,5 m. No vale contra un objetivo más de un tamaño mayor. Empate: sigue igual. El agarrado se zafa con maniobra {tipo: escapar} (su acción).
- Caídas y colgarse: quien cae usa la herramienta caida (1d6 por cada 3 m, derriba y puede herir). Quien se agarra a un borde o cornisa mantiene el agarre con Atletismo (FUE) CD 10 + 2 cada 3 m de altura; si falla, cae. Los compañeros pueden agarrarlo con maniobra (agarrar) si lo alcanzan.
- Cobertura: pásala en atacar (cobertura): media da +2 a la CA y a las salvaciones de DES, tres cuartos +5; la cobertura total impide apuntar al objetivo. Para una salvación de DES a cubierto usa el parámetro cobertura de prueba.`;
