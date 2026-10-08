// Viales: curación, resurrección, veneno y sueño, cada uno con su riesgo.
import { describir, tirar } from "./dados.js";
import type { Personaje } from "./estado.js";
import { infligirSecuela, pvMaxEfectivo, REGLAS, resumenHerida, type Herida } from "./heridas.js";
import { raza } from "./mundo.js";
import { marcarMuerto, salvacion, signo } from "./reglas.js";

export const VIALES = {
  "Sangre de Santo": {
    tipo: "curación",
    precio: 50,
    descripcion:
      "Sangre espesa y dorada de un santo muerto. Cura 2d4+2 PV, detiene hemorragias, baja un nivel la herida más grave y devuelve 1 punto de anemia. Espesa la sangre: puede formar coágulos y provocar un infarto (más probable cuantos más viales se tomen el mismo día).",
  },
  "Ceniza Viva": {
    tipo: "resurrección",
    precio: null,
    descripcion:
      "Ceniza que aún brilla, recogida donde cayó un dios. Vertida en la boca de alguien muerto hace menos de una hora, puede devolverlo… a veces sin recuerdos, a veces enloquecido. Rarísima; no se vende.",
  },
  "Hiel de Víbora Gris": {
    tipo: "veneno",
    precio: 30,
    descripcion:
      "Veneno verdoso. Bebido (CD 15) o untado en un arma, que envenena los 3 siguientes golpes (CD 13). Fallo: 4d6 de veneno y envenenado 1 hora; fallo por 5 o más: además paralizado 1 minuto. Éxito: mitad de daño.",
  },
  "Leche de Amapola Negra": {
    tipo: "sueño",
    precio: 15,
    descripcion:
      "Narcótico lechoso. Una dosis duerme (sirve de anestesia para cirugía: +2 a tratar). Las dosis se acumulan en 24 h: con 3 puede provocar coma, con 4 paro respiratorio, con 5 o más casi seguro mata.",
  },
} as const;

export type NombreVial = keyof typeof VIALES;
export const NOMBRES_VIALES = Object.keys(VIALES) as [NombreVial, ...NombreVial[]];

const ORDEN = ["critica", "grave", "moderada", "leve"] as const;

function sangreDeSanto(p: Personaje, heridaId: string | undefined, log: string[]) {
  // El riesgo se calcula con las dosis previas del día.
  const previas = p.dosis.curacion;
  p.dosis.curacion++;
  const pv = tirar("2d4+2");
  p.pv = Math.min(pvMaxEfectivo(p), p.pv + pv.total);
  p.condiciones = p.condiciones.filter((c) => c !== "inconsciente (anemia)");
  log.push(`${p.nombre} bebe Sangre de Santo: recupera ${pv.total} PV (${describir(pv)}).`);

  for (const h of p.heridas) h.sangrando = false;
  const h: Herida | undefined = heridaId
    ? p.heridas.find((x) => x.id.toLowerCase() === heridaId.toLowerCase())
    : [...p.heridas].sort((a, b) => ORDEN.indexOf(a.gravedad) - ORDEN.indexOf(b.gravedad))[0];
  if (h) {
    if (h.gravedad === "leve") {
      p.heridas = p.heridas.filter((x) => x !== h);
      log.push(`La herida ${h.id} se cierra sola.`);
    } else {
      h.gravedad = ORDEN[ORDEN.indexOf(h.gravedad) + 1];
      h.dias_restantes = Math.min(h.dias_restantes, tirar(REGLAS[h.gravedad].dias).total);
      log.push(`La herida ${h.id} se cierra un poco: ${resumenHerida(h)}`);
    }
  }
  if (p.anemia > 0) {
    p.anemia--;
    log.push(`Recupera 1 de FUE perdida por anemia (anemia ${p.anemia}).`);
  }
  p.pv = Math.min(pvMaxEfectivo(p), p.pv);

  const riesgo = 5 + 15 * previas;
  const d = tirar("1d100").total;
  log.push(`Riesgo de coágulo: ${riesgo}% (dosis hoy: ${p.dosis.curacion}) → d100 = ${d}.`);
  if (d > riesgo) return;

  const s = salvacion(p, "con", 15);
  log.push(`¡Un coágulo! El corazón de ${p.nombre} se detiene a medias. ${s.texto}.`);
  if (s.exito) {
    const dano = tirar("2d6").total;
    p.pv = Math.max(1, p.pv - dano);
    if (!p.condiciones.includes("aturdido")) p.condiciones.push("aturdido");
    log.push(`Infarto leve: pierde ${dano} PV (PV ${p.pv}) y queda aturdido 1d4 asaltos (${tirar("1d4").total}).`);
  } else {
    p.pv = 0;
    p.secuelas.push("corazón dañado por un coágulo: desventaja en salvaciones de CON contra el agotamiento");
    log.push(
      "Paro cardíaco: cae a 0 PV y hace salvaciones contra muerte con desventaja. Un aliado puede estabilizarlo con Medicina CD 15 (acción). Si sobrevive, le queda el corazón dañado (secuela añadida).",
    );
  }
}

function cenizaViva(p: Personaje, log: string[]) {
  if (!p.condiciones.includes("muerto") && p.pv > 0) {
    throw new Error(`${p.nombre} no está muerto: la Ceniza Viva solo actúa sobre los muertos. El vial no se gasta.`);
  }
  const r = raza(p.raza)?.curacion;
  if (r?.magia === "no_funciona") {
    log.push(`La Ceniza Viva se apaga en la boca de ${p.nombre}: la sangre pálida la rechaza. No hay efecto y el vial se pierde.`);
    return;
  }
  const extra = r?.magia === "doble" ? 2 : 1;
  const d = tirar("1d100").total;
  log.push(`Se vierte Ceniza Viva en la boca de ${p.nombre}… d100 = ${d}.`);
  if (d >= 96) {
    log.push("La ceniza arde y se apaga. El cuerpo no responde: el alma no quiso volver. (Sin efecto.)");
    return;
  }
  p.condiciones = p.condiciones.filter((c) => c !== "muerto" && c !== "inconsciente (anemia)");
  p.pv = 1;
  if (!p.condiciones.includes("agotamiento 1")) p.condiciones.push("agotamiento 1");
  if (d <= 55) {
    p.ceniza += 2 * extra;
    log.push(`${p.nombre} abre los ojos con una bocanada de ceniza. Vuelve con 1 PV, agotado, y +${2 * extra} de Ceniza (total ${p.ceniza}).`);
  } else if (d <= 80) {
    p.ceniza += 2 * extra;
    infligirSecuela(p, "amnesia del retornado: ha olvidado gran parte de su vida (el DM decide qué recuerdos se perdieron)");
    log.push(
      `${p.nombre} vuelve con 1 PV y +${2 * extra} de Ceniza… pero no sabe quién es. AMNESIA: no reconoce a sus compañeros ni recuerda su pasado. Interprétalo con el jugador.`,
    );
  } else {
    p.ceniza += 3 * extra;
    const asaltos = tirar("2d6").total;
    p.condiciones.push(`delirante (ataca a todos, ${asaltos} asaltos)`);
    infligirSecuela(p, "eco del delirio: al ver sangre derramada, salvación de SAB CD 12 o queda asustado 1 asalto");
    log.push(
      `${p.nombre} se levanta gritando con los ojos en blanco. DELIRIO: durante ${asaltos} asaltos ataca a la criatura más cercana, aliada o enemiga, con todo lo que tiene (lo controla el DM). Al final de cada uno de sus turnos puede intentar una salvación de SAB CD 15 para volver en sí. +${3 * extra} de Ceniza (total ${p.ceniza}).`,
    );
  }
}

export interface ObjetivoVeneno {
  nombre: string;
  /** Solo para PNJ: bonificador de su salvación de CON. */
  bono_con?: number;
}

function hiel(p: Personaje | undefined, objetivo: ObjetivoVeneno, via: "bebido" | "arma", log: string[]) {
  const cd = via === "bebido" ? 15 : 13;
  const enano = p?.raza === "Enano de Karak-Dûm";
  let exito: boolean;
  let margen: number;
  if (p) {
    const s = salvacion(p, "con", cd, { ventaja: enano });
    exito = s.exito;
    margen = s.margen;
    log.push(`${p.nombre}: ${s.texto}.`);
  } else {
    const t = tirar(`1d20${signo(objetivo.bono_con ?? 0)}`);
    exito = t.total >= cd;
    margen = t.total - cd;
    log.push(`${objetivo.nombre}: salvación de CON ${describir(t)} vs CD ${cd} → ${exito ? "éxito" : "fallo"}.`);
  }
  const dano = tirar("4d6").total;
  const final = Math.floor((exito ? dano / 2 : dano) / (enano ? 2 : 1));
  const efectos = [`${final} de daño de veneno${enano ? " (resistencia enana)" : ""}`];
  if (!exito) efectos.push("envenenado 1 hora (desventaja en ataques y pruebas)");
  if (!exito && margen <= -5) efectos.push("paralizado 1 minuto (repite la salvación al final de cada turno)");
  if (p) {
    p.pv = Math.max(0, p.pv - final);
    if (!exito && !p.condiciones.includes("envenenado")) p.condiciones.push("envenenado");
    if (!exito && margen <= -5 && !p.condiciones.includes("paralizado")) p.condiciones.push("paralizado");
    efectos.push(`PV ${p.pv}`);
  }
  log.push(`Hiel de Víbora Gris (${via}): ${efectos.join("; ")}.`);
}

function amapola(p: Personaje, dosis: number, log: string[]) {
  p.dosis.sueno += dosis;
  const total = p.dosis.sueno;
  log.push(`${p.nombre} toma ${dosis} dosis de Leche de Amapola Negra (llevaba ${total - dosis} en las últimas 24 h; total ${total}).`);
  const dormir = (horas: string) => {
    if (!p.condiciones.includes("dormido")) p.condiciones.push("dormido");
    log.push(`Duerme profundamente ${tirar(horas).total} horas.`);
  };
  if (total === 1) {
    const s = salvacion(p, "con", 12);
    log.push(s.texto);
    if (s.exito) log.push("Se resiste: solo queda adormilado (desventaja en pruebas de SAB 1 hora).");
    else dormir("1d4");
  } else if (total === 2) {
    const s = salvacion(p, "con", 15);
    log.push(s.texto);
    if (s.exito) log.push("Aguanta despierto a duras penas (desventaja en todo 1 hora).");
    else dormir("2d6");
  } else if (total === 3) {
    dormir("2d6+4");
    const s = salvacion(p, "con", 13);
    log.push(`Sobredosis: ${s.texto}.`);
    if (!s.exito) {
      p.condiciones.push("en coma");
      log.push("COMA: no despierta. Salvación contra muerte cada hora hasta que alguien le haga vomitar y lo atienda (Medicina CD 15).");
    }
  } else if (total === 4) {
    dormir("3d6");
    const s = salvacion(p, "con", 17);
    log.push(`Sobredosis grave: ${s.texto}.`);
    if (!s.exito) {
      p.pv = 0;
      log.push(`PARO RESPIRATORIO: cae a 0 PV y morirá en ${tirar("1d6").total} minutos si nadie lo salva (Medicina CD 18).`);
    }
  } else {
    const s = salvacion(p, "con", 21);
    log.push(`Dosis letal: ${s.texto}.`);
    if (!s.exito) {
      marcarMuerto(p);
      log.push(`${p.nombre} se duerme y su respiración se apaga. Está muerto.`);
    } else {
      p.pv = 0;
      p.condiciones.push("en coma");
      log.push("Sobrevive de milagro, pero en coma: salvación contra muerte cada hora hasta que lo atiendan (Medicina CD 18).");
    }
  }
}

export interface UsoVial {
  vial: NombreVial;
  /** Personaje jugador que lo recibe (o el que ataca, si es veneno en el arma contra un PNJ). */
  receptor?: Personaje;
  objetivo_pnj?: ObjetivoVeneno;
  via?: "bebido" | "arma";
  dosis?: number;
  herida?: string;
}

export function usarVial(u: UsoVial): string {
  const log: string[] = [];
  switch (u.vial) {
    case "Sangre de Santo":
      if (!u.receptor) throw new Error("Sangre de Santo necesita un personaje receptor");
      sangreDeSanto(u.receptor, u.herida, log);
      break;
    case "Ceniza Viva":
      if (!u.receptor) throw new Error("Ceniza Viva necesita un personaje receptor");
      cenizaViva(u.receptor, log);
      break;
    case "Hiel de Víbora Gris":
      if (!u.receptor && !u.objetivo_pnj) throw new Error("Indica el personaje o el PNJ envenenado");
      hiel(u.objetivo_pnj ? undefined : u.receptor, u.objetivo_pnj ?? { nombre: u.receptor!.nombre }, u.via ?? "bebido", log);
      break;
    case "Leche de Amapola Negra":
      if (!u.receptor) throw new Error("Leche de Amapola necesita un personaje receptor");
      amapola(u.receptor, Math.max(1, u.dosis ?? 1), log);
      break;
  }
  return log.join("\n");
}

export const REGLAS_VIALES = `## Viales (usa usar_vial; el programa tira los riesgos)
${Object.entries(VIALES)
  .map(([n, v]) => `- **${n}** (${v.tipo}${v.precio ? `, ${v.precio} po` : ", no se vende"}): ${v.descripcion}`)
  .join("\n")}
Pasa siempre portador (quien lo tenía en el inventario) para que se descuente. Si un PNJ envenena a un personaje, omite portador. La Ceniza Viva solo funciona sobre alguien con la condición "muerto" o muerto hace menos de una hora; si un retornado delira, tú controlas sus ataques contra todos.`;
