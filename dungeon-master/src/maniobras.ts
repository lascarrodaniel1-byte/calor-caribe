// Agarrar, empujar y escapar (reglas básicas de D&D 5e), y cobertura. Agarrar y empujar sustituyen un ataque: es una
// prueba enfrentada de Atletismo (FUE) del atacante contra Atletismo (FUE) o Acrobacias (DES) del objetivo, lo mejor de los dos.
// Un empate deja las cosas como estaban. El objetivo no puede ser más de un tamaño mayor que el atacante.
import { tiene } from "./dotes_base.js";
import { describir, tirar } from "./dados.js";
import type { Partida } from "./estado.js";
import { aplicarCondicion, condsDe, igual, localizar, puedeActuar, retirarCaido, turnoDe, type Combatiente } from "./combate.js";
import { efectos, reconocer } from "./condiciones.js";
import { actualizarPlano, distanciaPlano } from "./espacio.js";
import { COMPETENCIAS_CLASE } from "./pruebas.js";
import { infligir } from "./heridas.js";
import { danoEnSuelo } from "./muerte.js";
import { danar } from "./bestiario.js";
import { arteDeCombatiente, maestriaDe } from "./estilos_base.js";
import { competencia, marcarMuerto, mod, salvacion, signo, valor } from "./reglas.js";

export const COBERTURA = {
  media: { ca: 2, nombre: "cobertura media (muro bajo, mueble grande, otra criatura)" },
  tres_cuartos: { ca: 5, nombre: "cobertura de tres cuartos (rastrillo, tronera, tronco grueso)" },
} as const;

function atributoCriatura(texto: string, a: "FUE" | "DES" | "CON"): number {
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
  tipo: "agarrar" | "empujar" | "escapar" | "lanzar" | "sucio" | "palanca" | "sumision";
  /** lanzar (Presa de Hollín, sobre quien ya tiene agarrado): cadera (lo derriba), hombro (lo estampa, y puede lanzarlo contra otro) o molino (3 m). */
  lance?: "cadera" | "hombro" | "molino";
  /** lanzar con hombro: contra qué otro enemigo cercano (a 1,5 m) lo estampa. */
  contra?: string;
  /** empujar: derribarlo o apartarlo 1,5 m. */
  efecto?: "derribar" | "alejar";
  /** Bono total de Atletismo del atacante / de la defensa del objetivo (obligatorio solo para PNJ sin datos). */
  bono_atacante?: number;
  bono_objetivo?: number;
  ventaja?: boolean;
  desventaja?: boolean;
  /** Maestro del escudo (dote): empuja con el escudo como acción adicional. */
  escudo?: boolean;
  /** Pendenciero (dote): agarra como acción adicional. */
  adicional?: boolean;
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
  // Estilos: Presa de Hollín y Piedra de Karak.
  const presaAt = arteDeCombatiente(at, "presa"), presaOb = arteDeCombatiente(ob, "presa"), piedraOb = arteDeCombatiente(ob, "piedra");
  if (d.escudo || d.adicional) {
    if (d.adicional && d.tipo === "agarrar" && presaAt) { /* Presa de Hollín, Llave: agarra como parte del ataque (acción adicional) */ }
    else if (at.tipo !== "pj") throw new Error("Solo los personajes jugadores tienen dotes (o domina la Presa de Hollín para agarrar como acción adicional).");
    if (d.escudo && !(tiene((at as any).p, "maestro_del_escudo") && d.tipo === "empujar" && /escudo|rodela|adarga/i.test((at as any).p?.manos?.secundaria ?? ""))) throw new Error(`${at.nombre} necesita la dote Maestro del escudo, un escudo empuñado y empujar.`);
    if (d.adicional && !((presaAt && d.tipo === "agarrar") || (at.tipo === "pj" && tiene(at.p, "pendenciero") && d.tipo === "agarrar"))) throw new Error(`${at.nombre} necesita la dote Pendenciero o la Presa de Hollín (Llave) y agarrar.`);
    const t = turnoDe(partida, at.nombre);
    if (t.adicional) throw new Error(`${at.nombre} ya usó su acción adicional este asalto (${t.adicional}).`);
    t.adicional = d.escudo ? "empujón con escudo" : at.tipo === "pj" && tiene(at.p, "pendenciero") ? "agarrar (Pendenciero)" : "agarrar (Llave, Presa de Hollín)";
  }
  // Estilos: Presa de Hollín (ventaja al agarrar y lanzar) y Piedra de Karak (el que se defiende, contra empujar y lanzar).
  if (d.tipo === "palanca" || d.tipo === "sumision") {
    if (!presaAt) throw new Error(`${at.nombre} no domina la Presa de Hollín: sin ese estilo no conoce esas llaves (arte_marcial aprender).`);
    const need = d.tipo === "sumision" ? 3 : 2;
    if (maestriaDe(at) < need) throw new Error(`${at.nombre} aún no tiene la maestría para ${d.tipo === "sumision" ? "la Sumisión" : "la Palanca"} (hace falta ${need === 3 ? "Maestro" : "Practicante"}).`);
    if (!condsDe(ob).some((x) => reconocer(x)?.id === "agarrado" && new RegExp(`(?:por|cadenas de) ${at.nombre}\\)`, "i").test(x))) throw new Error(`${ob.nombre} no está agarrado por ${at.nombre}: primero agárralo (maniobra agarrar).`);
  }
  if (d.tipo === "lanzar") {
    if (!presaAt) throw new Error(`${at.nombre} no domina la Presa de Hollín: sin ese estilo no puede lanzar (arte_marcial aprender).`);
    const need = d.lance === "molino" ? 3 : d.lance === "hombro" ? 2 : 1;
    if (maestriaDe(at) < need) throw new Error(`${at.nombre} no tiene aún la maestría para el lance «${d.lance ?? "cadera"}» (hace falta ${need === 3 ? "Maestro" : "Practicante"}).`);
    if (!condsDe(ob).some((x) => reconocer(x)?.id === "agarrado" && new RegExp(`(?:por|cadenas de) ${at.nombre}\\)`, "i").test(x))) throw new Error(`${ob.nombre} no está agarrado por ${at.nombre}: primero agárralo (maniobra agarrar).`);
  }
  // Callejón de Aldenmar: ventaja en las maniobras contra un rival ocupado, aturdido o sin guardia.
  const callejonAt = arteDeCombatiente(at, "callejon");
  const distraido = efO.incapacitado || condsDe(ob).some((x) => /derribad|cegad|aturdid|apresad|agarrad|asustad|dormid|sorprendid|desarmad/i.test(x)) || !!partida.combate?.sorprendidos?.some((x) => igual(x, ob.nombre));
  if (d.tipo === "sucio") {
    if (!callejonAt) throw new Error(`${at.nombre} no domina el Callejón de Aldenmar: no conoce esos golpes sucios.`);
    if (maestriaDe(at) < 2) throw new Error(`${at.nombre} aún no tiene la maestría para Arena y codo (hace falta Practicante).`);
    const cd = 8 + (at.tipo === "pj" ? competencia(at.p) : 4) + Math.max(bonoManiobra(at, "atletismo", d.bono_atacante).bono, bonoManiobra(at, "acrobacias", d.bono_atacante).bono);
    let exito: boolean, txt: string;
    if (ob.tipo === "pj") { const sv = salvacion(ob.p, "con", cd); exito = sv.exito; txt = sv.texto; }
    else { const m = ob.tipo === "criatura" ? mod(atributoCriatura(ob.j.definicion.atributos, "CON")) : 0; const tt = tirar(`1d20${signo(m)}`); exito = tt.total >= cd; txt = `salvación de CON ${describir(tt)} contra CD ${cd}`; }
    if (exito) return `${at.nombre} le tira arena y un codazo a ${ob.nombre}: ${txt} → aguanta y parpadea (CD ${cd}).`;
    return `${at.nombre} le tira arena y un codazo a ${ob.nombre}: ${txt} → falla (CD ${cd}). ${aplicarCondicion(partida, { objetivo: ob.nombre, accion: "aplicar", condicion: "cegado", nota: "arena y codo; hasta el final de su siguiente turno" }).split("\n")[0]}`;
  }
  // Piedra de Karak, Montaña (Maestro): nada lo mueve de su sitio.
  if (piedraOb && maestriaDe(ob) === 3 && (d.tipo === "empujar" || d.tipo === "lanzar")) return `${at.nombre} intenta ${d.tipo === "lanzar" ? "lanzar" : "empujar"} a ${ob.nombre}, pero es una montaña: Piedra de Karak (Maestro), no se mueve ni cae.`;
  const hayV = !!d.ventaja || (callejonAt && distraido && d.tipo !== "escapar") || (presaAt && (d.tipo === "agarrar" || d.tipo === "lanzar" || d.tipo === "palanca" || d.tipo === "sumision")) || (d.tipo === "agarrar" && at.tipo === "pj" && tiene(at.p, "pendenciero")), hayD = !!d.desventaja || ea.pruebas === "desventaja";
  const modoA = hayV && !hayD ? "ventaja" : hayD && !hayV ? "desventaja" : "normal";
  const ta = tirar(`1d20${signo(aA.bono)}`, modoA);
  const incapObjetivo = efO.incapacitado;
  const ventajaDef = (presaOb && d.tipo === "escapar") || (piedraOb && (d.tipo === "empujar" || d.tipo === "lanzar"));
  const modoD = efO.pruebas === "desventaja" && !ventajaDef ? "desventaja" : ventajaDef && efO.pruebas !== "desventaja" ? "ventaja" : "normal";
  const td = tirar(`1d20${signo(def.bono)}`, modoD);
  const gana = !incapObjetivo && ta.total > td.total || (incapObjetivo && ta.total >= 0);
  const cabecera = `${at.nombre} (${aA.hab} ${describir(ta)}${modoA !== "normal" ? `, ${modoA}` : ""}) contra ${ob.nombre} (${def.hab} ${describir(td)}${modoD !== "normal" ? `, ${modoD}` : ""})${incapObjetivo ? " — está incapacitado: no se resiste" : ""}`;
  if (!gana) return `${cabecera} → FALLA${ta.total === td.total ? " (empate: todo sigue igual)" : ""}.`;

  if (d.tipo === "palanca") {
    const r = aplicarCondicion(partida, { objetivo: ob.nombre, accion: "aplicar", condicion: "brazo entumecido", nota: `dislocado por la palanca de ${at.nombre}` }).split("\n")[0];
    return `${cabecera} → ¡PALANCA! ${ob.nombre} sigue agarrado y le dislocan un miembro: ${r} (desventaja en sus ataques y pruebas hasta que se lo curen).`;
  }
  if (d.tipo === "sumision") {
    const r = aplicarCondicion(partida, { objetivo: ob.nombre, accion: "aplicar", condicion: "sometido", nota: `sumisión de ${at.nombre}` }).split("\n")[0];
    return `${cabecera} → ¡SUMISIÓN! ${r} ${ob.nombre} queda inmovilizado en la llave de ${at.nombre}: velocidad 0 y desventaja en ataques y pruebas (también para zafarse).`;
  }
  if (d.tipo === "lanzar") {
    const lance = d.lance ?? "cadera";
    const suelta = condsDe(ob).filter((x) => !(reconocer(x)?.id === "agarrado" && new RegExp(`(?:por|cadenas de) ${at.nombre}\\)`, "i").test(x)));
    condsDe(ob).splice(0, condsDe(ob).length, ...suelta);
    const partes = [`${cabecera} → ¡LO LANZA (${lance === "cadera" ? "cadera" : lance === "hombro" ? "por encima del hombro" : "de molino"})! ${ob.nombre} ya no está agarrado.`];
    if (lance === "cadera") partes.push(aplicarCondicion(partida, { objetivo: ob.nombre, accion: "aplicar", condicion: "derribado" }).split("\n")[0]);
    else if (lance === "hombro") {
      partes.push(caida(partida, { quien: ob.nombre, metros: 3 }));
      if (d.contra) {
        const otro = localizar(partida, d.contra);
        const dist2 = distanciaPlano(partida, ob.nombre, otro.nombre);
        if (dist2 && dist2.metros > 2) partes.push(`${otro.nombre} está a ${dist2.metros} m de ${ob.nombre}: demasiado lejos para estamparlo contra él (el lance cae al suelo).`);
        else partes.push(`${ob.nombre} se estrella contra ${otro.nombre}:`, caida(partida, { quien: otro.nombre, metros: 3 }));
      }
    } else {
      partes.push(caida(partida, { quien: ob.nombre, metros: 6 }));
      if (partida.plano && Object.keys(partida.plano.puntos).some((k) => igual(k, ob.nombre)) && Object.keys(partida.plano.puntos).some((k) => igual(k, at.nombre))) {
        try { partes.push(actualizarPlano(partida, { mover: [{ nombre: ob.nombre, de: at.nombre, metros: 3 }] }).split("\n")[0]); } catch { /* sin plano utilizable */ }
      }
    }
    return partes.join("\n");
  }
  if (d.tipo === "agarrar") {
    const r = aplicarCondicion(partida, { objetivo: ob.nombre, accion: "aplicar", condicion: "agarrado", nota: `por ${at.nombre}` });
    return `${cabecera} → ¡AGARRA! ${r.split("\n")[0]} Mientras lo sujeta, ${at.nombre} tiene una mano ocupada; si queda incapacitado o lo apartan, lo suelta.`;
  }
  if (d.tipo === "escapar") {
    const resto = condsDe(at).filter((x) => reconocer(x)?.id !== "agarrado" && !/^sometid[oa].*sumisi[oó]n de/i.test(x));
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
