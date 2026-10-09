// Motor de heridas: gravedad, infección, tratamiento, recuperación y secuelas.
// Toda la aleatoriedad pasa por dados.ts; el DM solo narra lo que sale aquí.
import { describir, tirar } from "./dados.js";
import type { Personaje } from "./estado.js";
import { buscarEstructura, elegirEstructura, RELOJ_MAX, tirarValor, type Estructura, type Region, type ZonaVital } from "./anatomia.js";
import { raza, type RasgosCuracion } from "./mundo.js";
import { marcarMuerto, salvacion, valor } from "./reglas.js";

export const GRAVEDADES = ["leve", "moderada", "grave", "critica"] as const;
export const TIPOS = ["corte", "perforacion", "contusion", "quemadura", "mordedura", "necrotica"] as const;
export const UBICACIONES = ["cabeza", "cuello", "torso", "abdomen", "brazo izquierdo", "brazo derecho", "pierna izquierda", "pierna derecha"] as const;
export const CAUSAS = ["critico", "cero_pv", "golpe_masivo", "menor"] as const;
export const METODOS = ["medicina", "detener hemorragia", "cauterizar", "magia divina", "remedio raro"] as const;
export const RECURSOS = ["kit de sanador", "herramientas de cirujano", "alcohol", "hierbas", "hierro candente", "paciente sedado"] as const;
export const ENTORNOS = { "en combate": -4, intemperie: -2, refugio: 0, enfermeria: 2 } as const;
export const CALIDADES = ["esfuerzo", "precario", "reposo", "enfermeria"] as const;

export type Gravedad = (typeof GRAVEDADES)[number];
export type Tipo = (typeof TIPOS)[number];
export type Ubicacion = (typeof UBICACIONES)[number];
export type Causa = (typeof CAUSAS)[number];
export type Metodo = (typeof METODOS)[number];
export type Recurso = (typeof RECURSOS)[number];
export type Entorno = keyof typeof ENTORNOS;
export type Calidad = (typeof CALIDADES)[number];

export interface Herida {
  id: string;
  gravedad: Gravedad;
  tipo: Tipo;
  ubicacion: Ubicacion;
  descripcion: string;
  estado: "sin tratar" | "tratada" | "infectada";
  sangrando: boolean;
  podre: boolean;
  /** Días de convalecencia que le faltan (solo avanzan si está tratada; las leves avanzan solas). */
  dias_restantes: number;
  dias_abierta: number;
  /** Se suma a la tirada de recuperación final: buen cuidado lo sube, el esfuerzo lo baja. */
  mod_recuperacion: number;
  desinfectada: boolean;
  cauterizada: boolean;
  magia_usada: boolean;
  /** Infección: el cuerpo la vence con 3 salvaciones superadas; 2 fallos agravan la herida. */
  infeccion_exitos: number;
  infeccion_fallos: number;
  /** Zona vital: verde (superficial), ámbar (se sobrevive con secuelas) o roja (un minuto de vida). */
  zona_vital: ZonaVital;
  /** Estructura anatómica afectada (arteria femoral, bazo, plexo braquial…). */
  estructura: string;
  /** Roja sangrando: asaltos que le quedan antes de morir. */
  reloj?: number;
  /** Ámbar sangrando: asaltos hasta que se vuelve roja si nadie la comprime. */
  escalada?: number;
  /** Ámbar visceral sin cirugía: días que ha empeorado. */
  fallos_viscerales: number;
  /** Agonizando por una herida visceral: muere al final del día siguiente sin cirugía. */
  agonia: boolean;
  /** Si estaba tratada antes de infectarse (a eso vuelve si el cuerpo vence la infección). */
  tratada_antes: boolean;
}

interface Regla {
  cdTratar: number;
  dias: string;
  /** PV máximos que se pierden mientras la herida esté abierta. */
  penalPV: number;
  cdInfeccion: number;
  cdRecuperacion: number;
  material: Recurso | null;
  danoComplicacion: string;
}

export const REGLAS: Record<Gravedad, Regla> = {
  leve: { cdTratar: 10, dias: "1d3", penalPV: 0, cdInfeccion: 8, cdRecuperacion: 0, material: null, danoComplicacion: "1d4" },
  moderada: { cdTratar: 13, dias: "1d4+3", penalPV: 3, cdInfeccion: 11, cdRecuperacion: 10, material: "kit de sanador", danoComplicacion: "1d6" },
  grave: { cdTratar: 16, dias: "2d6+7", penalPV: 6, cdInfeccion: 13, cdRecuperacion: 14, material: "herramientas de cirujano", danoComplicacion: "2d6" },
  critica: { cdTratar: 19, dias: "3d10+15", penalPV: 10, cdInfeccion: 15, cdRecuperacion: 17, material: "herramientas de cirujano", danoComplicacion: "3d6" },
};

type Zona = Region;
const zona = (u: Ubicacion): Zona => u.split(" ")[0] as Zona;

const EFECTOS: Record<Zona, Record<Exclude<Gravedad, "leve">, string>> = {
  cabeza: {
    moderada: "desventaja en Percepción e Investigación",
    grave: "desventaja en pruebas de INT y SAB; aturdido 1 asalto al recibirla",
    critica: "inconsciente; al despertar, desventaja en todas las tiradas hasta ser operado",
  },
  torso: {
    moderada: "desventaja en pruebas de CON y de Atletismo",
    grave: "velocidad a la mitad y desventaja en salvaciones de CON",
    critica: "hemorragia interna: sin cirugía, salvación contra muerte cada hora",
  },
  cuello: {
    moderada: "dolor al tragar y girar la cabeza",
    grave: "le cuesta respirar y hablar",
    critica: "se ahoga en su propia sangre",
  },
  abdomen: {
    moderada: "dolor al moverse: desventaja en Atletismo y Acrobacias",
    grave: "no puede erguirse del todo: velocidad a la mitad",
    critica: "las entrañas al aire",
  },
  brazo: {
    moderada: "desventaja en ataques con ese brazo",
    grave: "brazo inutilizable: no puede sostener arma ni escudo con él",
    critica: "brazo destrozado o amputado",
  },
  pierna: {
    moderada: "velocidad −3 m",
    grave: "velocidad a la mitad; no puede correr ni saltar",
    critica: "pierna destrozada o amputada: velocidad 1,5 m sin muleta",
  },
};

const SECUELAS: Record<Zona, { menor: string[]; permanente: string[] }> = {
  cabeza: {
    menor: [
      "cicatriz en el rostro (ventaja en Intimidación, desventaja en Persuasión con desconocidos)",
      "migrañas: tras cada combate, salvación de CON CD 10 o desventaja en pruebas de INT durante 1 hora",
      "oído dañado: desventaja en Percepción basada en el oído",
    ],
    permanente: [
      "ojo perdido: desventaja en Percepción visual y en ataques a distancia larga",
      "conmoción permanente: −1 INT",
      "pesadillas: un descanso largo solo cuenta si supera SAB CD 10",
    ],
  },
  torso: {
    menor: [
      "cicatriz gruesa en el pecho",
      "costillas mal soldadas: desventaja en Atletismo para nadar o trepar",
      "tos con sangre tras esforzarse: −1 a salvaciones de CON para no agotarse",
    ],
    permanente: [
      "pulmón dañado: −1 CON",
      "dolor crónico: −1 a futuras tiradas de recuperación",
      "entrañas débiles: desventaja en salvaciones contra veneno y enfermedad",
    ],
  },
  cuello: {
    menor: ["cicatriz que cruza la garganta", "rigidez de cuello: desventaja en Percepción para mirar atrás"],
    permanente: ["voz rota para siempre", "no puede girar la cabeza: siempre puede ser flanqueado"],
  },
  abdomen: {
    menor: ["cicatriz que cruza el vientre", "digestión débil: necesita el doble de raciones"],
    permanente: ["hernia: desventaja en Atletismo", "entrañas dañadas: −1 CON"],
  },
  brazo: {
    menor: [
      "temblor en la mano: −1 a los ataques con ese brazo",
      "un dedo perdido",
      "rigidez: −1 a los ataques con armas a dos manos",
    ],
    permanente: [
      "mano perdida",
      "brazo inútil: no puede sostener nada con él",
      "músculo desgarrado: −1 FUE",
    ],
  },
  pierna: {
    menor: [
      "cojera leve: velocidad −1,5 m",
      "rodilla débil: desventaja en Acrobacias",
      "dolor cuando cambia el tiempo",
    ],
    permanente: [
      "pierna perdida (velocidad 3 m con muleta, 6 m con pata de palo)",
      "cojera grave: velocidad −3 m y no puede correr",
      "tendón cortado: −1 DES",
    ],
  },
};

const NORMAL: RasgosCuracion = { infeccion: 0, recuperacion: 0, inmunePodre: false, magia: "normal", levesRapidas: false };
const rasgos = (p: Personaje) => raza(p.raza)?.curacion ?? NORMAL;
const modCON = (p: Personaje) => Math.floor((valor(p, "con") - 10) / 2);
const signo = (n: number) => (n >= 0 ? `+${n}` : `${n}`);
const esBarbero = (p?: Personaje) => p?.clase === "Barbero-Cirujano";
const sube = (g: Gravedad): Gravedad => GRAVEDADES[Math.min(3, GRAVEDADES.indexOf(g) + 1)];
const baja = (g: Gravedad): Gravedad | null => (g === "leve" ? null : GRAVEDADES[GRAVEDADES.indexOf(g) - 1]);

export function infligirSecuela(p: Personaje, texto: string) {
  p.secuelas.push(texto);
}

export function efecto(h: Herida): string {
  const e = h.estructura ? buscarEstructura(h.estructura) : undefined;
  if (e) return e.efecto;
  return h.gravedad === "leve" ? "dolor, sin penalización" : EFECTOS[zona(h.ubicacion)][h.gravedad];
}

const ZONA_TXT: Record<ZonaVital, string> = { verde: "VERDE", ambar: "ÁMBAR", roja: "ROJA" };

/** Convierte una herida en roja (una hemorragia que ya no se contiene, un pulmón perforado…). */
export function volverRoja(h: Herida, motivo: string, nuevaEstructura?: string) {
  h.zona_vital = "roja";
  h.gravedad = "critica";
  h.sangrando = true;
  h.escalada = undefined;
  h.reloj = RELOJ_MAX;
  if (nuevaEstructura) h.estructura = nuevaEstructura;
  h.descripcion = `${h.descripcion ? `${h.descripcion}; ` : ""}${motivo}`;
}

/** Baja una herida de zona (magia, Sangre de Santo): para el reloj y la escalada. */
export function bajarZona(h: Herida) {
  if (h.zona_vital === "roja") h.zona_vital = "ambar";
  else if (h.zona_vital === "ambar" && h.gravedad === "leve") h.zona_vital = "verde";
  h.reloj = undefined;
  h.escalada = undefined;
  h.agonia = false;
}

export function pvMaxEfectivo(p: Personaje): number {
  const penal = (p.heridas ?? []).reduce((s, h) => s + REGLAS[h.gravedad].penalPV, 0);
  return Math.max(1, p.pv_max - penal);
}

function ajustarPV(p: Personaje) {
  p.pv = Math.max(0, Math.min(p.pv, pvMaxEfectivo(p)));
}

export function resumenHerida(h: Herida): string {
  const extra = [
    h.estado === "tratada" ? `tratada, ${Math.ceil(h.dias_restantes)} días de convalecencia` : h.estado,
    h.sangrando ? "SANGRANDO" : "",
    h.reloj !== undefined && h.sangrando ? `¡${Math.max(0, h.reloj)} asalto(s) de vida!` : "",
    h.escalada !== undefined && h.sangrando ? `se vuelve roja en ${h.escalada} asalto(s)` : "",
    h.agonia ? "AGONIZANDO" : "",
    h.podre ? "con PODRE" : "",
  ].filter(Boolean);
  const zonaTxt = h.zona_vital ? `ZONA ${ZONA_TXT[h.zona_vital]} · ` : "";
  const estr = h.estructura ? ` (${h.estructura})` : "";
  return `[${h.id}] ${zonaTxt}${h.gravedad} · ${h.tipo} · ${h.ubicacion}${estr} · ${extra.join(" · ")} — ${efecto(h)}${h.descripcion ? ` (${h.descripcion})` : ""}`;
}

function salvacionCON(p: Personaje, cd: number, extra = 0) {
  const t = tirar(`1d20${signo(modCON(p) + extra)}`);
  return { exito: t.total >= cd, total: t.total, texto: `${describir(t)} vs CD ${cd}` };
}

// ---------------------------------------------------------------- infligir

const TABLAS_CAUSA: Record<Causa, [number, Gravedad][]> = {
  // [máximo del d20, gravedad]
  menor: [[14, "leve"], [20, "moderada"]],
  critico: [[8, "leve"], [15, "moderada"], [19, "grave"], [20, "critica"]],
  golpe_masivo: [[4, "leve"], [12, "moderada"], [18, "grave"], [20, "critica"]],
  cero_pv: [[5, "moderada"], [15, "grave"], [20, "critica"]],
};

const TABLA_UBICACION: [number, Ubicacion][] = [
  [1, "cabeza"], [2, "cuello"], [6, "torso"], [9, "abdomen"], [11, "brazo izquierdo"], [13, "brazo derecho"], [16, "pierna izquierda"], [20, "pierna derecha"],
];

const ORDEN_GRAV: Gravedad[] = ["leve", "moderada", "grave", "critica"];
const maxGrav = (a: Gravedad, b: Gravedad) => (ORDEN_GRAV.indexOf(a) >= ORDEN_GRAV.indexOf(b) ? a : b);

const deTabla = <T>(tabla: [number, T][], d: number) => tabla.find(([max]) => d <= max)![1];

export interface DatosHerida {
  causa: Causa;
  gravedad?: Gravedad;
  tipo: Tipo;
  ubicacion?: Ubicacion;
  /** Estructura concreta (si la ficción lo exige); si no, se tira. */
  estructura?: string;
  descripcion?: string;
  de_no_muerto?: boolean;
  /** CD de CON para resistir la Podre (por defecto 12; más alta en no-muertos poderosos). */
  cd_podre?: number;
}

export function infligir(p: Personaje, d: DatosHerida): string {
  const log: string[] = [];
  let gravedad = d.gravedad;
  if (!gravedad) {
    const t = tirar("1d20");
    gravedad = deTabla(TABLAS_CAUSA[d.causa], t.total);
    log.push(`Gravedad (${d.causa}): d20 = ${t.total} → ${gravedad}`);
  }
  // Estructura anatómica y zona vital.
  let estr: Estructura | undefined = d.estructura ? buscarEstructura(d.estructura) : undefined;
  if (d.estructura && !estr) throw new Error(`No conozco la estructura "${d.estructura}".`);
  let ubicacion = d.ubicacion;
  if (!ubicacion && estr) {
    const opciones = UBICACIONES.filter((u) => u.startsWith(estr!.region));
    ubicacion = opciones.length > 1 ? opciones[tirar("1d2").total - 1] : opciones[0];
  }
  if (!ubicacion) {
    const t = tirar("1d20");
    ubicacion = deTabla(TABLA_UBICACION, t.total);
    log.push(`Ubicación: d20 = ${t.total} → ${ubicacion}`);
  }
  if (!estr) {
    const el = elegirEstructura(zona(ubicacion), gravedad);
    estr = el.estructura;
    if (el.tirada !== undefined) log.push(`Zona: d100 = ${el.tirada} → ${ZONA_TXT[estr.zona]} (${estr.nombre})`);
  }
  if (estr.zona === "ambar") gravedad = maxGrav(gravedad, "moderada");
  if (estr.zona === "roja") gravedad = "critica";

  const r = rasgos(p);
  const sangra =
    estr.zona === "roja" ||
    Boolean(estr.escalada) ||
    (estr.zona === "verde" && gravedad !== "leve" && gravedad !== "moderada" && ["corte", "perforacion", "mordedura"].includes(d.tipo));
  const n = Math.max(0, ...p.heridas.map((h) => Number(h.id.slice(1)) || 0)) + 1;
  const h: Herida = {
    id: `H${n}`,
    gravedad,
    tipo: d.tipo,
    ubicacion,
    descripcion: d.descripcion ?? "",
    estado: "sin tratar",
    sangrando: sangra,
    podre: false,
    dias_restantes: gravedad === "leve" && r.levesRapidas ? 1 : tirar(REGLAS[gravedad].dias).total,
    dias_abierta: 0,
    mod_recuperacion: 0,
    desinfectada: false,
    cauterizada: false,
    magia_usada: false,
    infeccion_exitos: 0,
    infeccion_fallos: 0,
    tratada_antes: false,
    zona_vital: estr.zona,
    estructura: estr.nombre,
    reloj: estr.reloj ? Math.min(RELOJ_MAX, tirarValor(estr.reloj)) : undefined,
    escalada: estr.escalada ? tirarValor(estr.escalada) : undefined,
    fallos_viscerales: 0,
    agonia: false,
  };
  if (estr.inconsciente && !p.condiciones.includes("inconsciente")) p.condiciones.push("inconsciente");
  // La Podre solo entra por heridas de verdad (no por rasguños) y el cuerpo puede resistirla.
  if (d.de_no_muerto) {
    if (r.inmunePodre) log.push(`${p.raza}: inmune a la Podre.`);
    else if (gravedad === "leve") log.push("Herida superficial: la Podre no llega a entrar.");
    else {
      const s = salvacion(p, "con", d.cd_podre ?? 12, { extra: r.infeccion });
      h.podre = !s.exito;
      log.push(`Contagio de la Podre: ${s.texto}${h.podre ? " → ¡la Podre entra en la herida!" : " → la resiste."}`);
    }
  }
  p.heridas.push(h);
  ajustarPV(p);
  log.push(`${p.nombre} sufre una herida: ${resumenHerida(h)}`);
  if (h.zona_vital === "roja") {
    log.push(
      `☠ ZONA ROJA: le quedan ${h.reloj} asalto(s) de vida (como mucho un minuto). ` +
        (estr.compresion
          ? `Se puede intentar ${estr.compresion.como} (detener hemorragia CD ${estr.compresion.cd}).`
          : "No hay dónde apretar: solo la salvan una cirugía desesperada (CD 22), la Sangre de Santo o la magia divina.") +
        (estr.inconsciente ? " Cae inconsciente." : ""),
    );
  } else if (h.zona_vital === "ambar") {
    if (h.escalada !== undefined) log.push(`ZONA ÁMBAR sangrante: si nadie hace ${estr.compresion?.como} (CD ${estr.compresion?.cd}) en ${h.escalada} asalto(s), se vuelve ROJA.`);
    if (estr.visceral) log.push("ZONA ÁMBAR visceral: sin cirugía empeorará día a día hasta volverse roja (pasar_tiempo).");
    if (estr.costilla) log.push("ZONA ÁMBAR: cada asalto de esfuerzo, una costilla puede perforar el pulmón (avanzar_asaltos).");
    log.push("Las heridas ámbar dejan secuelas casi siempre.");
  } else if (h.sangrando) {
    log.push("Hemorragia: pierde 1 PV por asalto y sangre (riesgo de anemia) hasta detenerla.");
  }
  if (h.podre) log.push("La herida tiene Podre: hay que cortar la carne podrida (medicina, CD +4), cauterizarla o usar un remedio raro.");
  return log.join("\n");
}

// ---------------------------------------------------------------- tratar

export interface DatosTratamiento {
  metodo: Metodo;
  sanador?: Personaje;
  nombre_sanador: string;
  bono_medicina: number;
  recursos: Recurso[];
  entorno: Entorno;
  usar_mano_firme?: boolean;
}

function cerrarConMagia(p: Personaje, h: Herida, log: string[]) {
  const nueva = baja(h.gravedad);
  if (!nueva) {
    p.heridas = p.heridas.filter((x) => x !== h);
    log.push(`La herida ${h.id} se cierra por completo, sin secuelas.`);
    return;
  }
  h.gravedad = nueva;
  h.estado = "tratada";
  h.sangrando = false;
  h.magia_usada = true;
  bajarZona(h);
  h.dias_restantes = tirar(REGLAS[nueva].dias).total;
  log.push(`La herida ${h.id} baja a ${nueva}: ${resumenHerida(h)}`);
}

export function tratar(p: Personaje, h: Herida, d: DatosTratamiento): string {
  const log: string[] = [];
  const regla = REGLAS[h.gravedad];
  const r = rasgos(p);
  const barbero = esBarbero(d.sanador);

  switch (d.metodo) {
    case "magia divina": {
      if (r.magia === "no_funciona") return `La magia divina no tiene efecto sobre ${p.nombre} (${p.raza}). No se gasta Ceniza.`;
      if (h.magia_usada) return `La herida ${h.id} ya recibió magia divina; no responde una segunda vez.`;
      const ceniza = r.magia === "doble" ? 2 : 1;
      p.ceniza += ceniza;
      log.push(`${p.nombre} gana ${ceniza} de Ceniza (total ${p.ceniza}).`);
      if (h.podre) {
        h.sangrando = false;
        h.magia_usada = true;
        h.reloj = undefined;
        h.escalada = undefined;
        log.push("La Podre resiste a los dioses muertos: la hemorragia se detiene, pero la herida sigue igual.");
      } else {
        if (h.estado === "infectada") log.push("La infección se consume.");
        cerrarConMagia(p, h, log);
      }
      ajustarPV(p);
      return log.join("\n");
    }

    case "cauterizar": {
      const conMano = d.sanador?.raza === "Cenizo";
      if (!conMano && !d.recursos.includes("hierro candente")) return "Para cauterizar hace falta hierro candente (o un Cenizo con su Brasa interior).";
      if (!["corte", "perforacion", "mordedura"].includes(h.tipo)) return `No se puede cauterizar una herida de tipo ${h.tipo}.`;
      const ec = buscarEstructura(h.estructura ?? "");
      if (h.zona_vital === "roja" && !ec?.compresion) return `No se puede cauterizar ${h.estructura}: la hemorragia está dentro de una cavidad.`;
      h.sangrando = false;
      h.reloj = undefined;
      h.escalada = undefined;
      h.cauterizada = true;
      h.mod_recuperacion -= 2;
      if (h.podre) log.push("El fuego quema la Podre.");
      h.podre = false;
      if (h.estado === "infectada") h.estado = "sin tratar";
      if (h.gravedad === "leve" || h.gravedad === "moderada") h.estado = "tratada";
      if (conMano) log.push(`${d.nombre_sanador} cauteriza con su Brasa interior (sin daño adicional).`);
      else {
        const t = tirar("1d6");
        p.pv = Math.max(0, p.pv - t.total);
        log.push(`El hierro candente causa ${t.total} de daño de fuego (PV ${p.pv}).`);
      }
      log.push(
        h.estado === "tratada"
          ? `Herida ${h.id} cauterizada y cerrada; dejará cicatriz de quemadura.`
          : `Hemorragia detenida en ${h.id}, pero una herida ${h.gravedad} sigue necesitando cirugía.`,
      );
      ajustarPV(p);
      return log.join("\n");
    }

    case "remedio raro": {
      if (!h.podre) return "No hay Podre que curar en esta herida.";
      h.podre = false;
      if (h.estado === "infectada") h.estado = "sin tratar";
      return `El remedio arranca la Podre de la herida ${h.id}. Ahora puede tratarse con medicina.`;
    }

    case "detener hemorragia":
    case "medicina": {
      const hemorragia = d.metodo === "detener hemorragia";
      if (hemorragia && !h.sangrando) return `La herida ${h.id} no sangra.`;
      const estr = buscarEstructura(h.estructura ?? "");
      if (hemorragia && h.zona_vital === "roja" && !estr?.compresion) {
        return `${h.estructura}: no hay dónde apretar. Solo una cirugía desesperada (método medicina), la Sangre de Santo o la magia divina pueden detener esto. Quedan ${h.reloj} asalto(s).`;
      }


      const mods: string[] = [];
      let bono = d.bono_medicina;
      mods.push(`Medicina ${signo(d.bono_medicina)}`);
      const ent = ENTORNOS[d.entorno];
      if (ent) mods.push(`${d.entorno} ${signo(ent)}`);
      bono += ent;
      if (barbero) {
        bono += 2;
        mods.push("Barbero-Cirujano +2");
      }
      let cd = hemorragia ? (estr?.compresion?.cd ?? (h.gravedad === "critica" ? 15 : 10)) : regla.cdTratar;
      if (hemorragia && estr?.compresion) mods.push(estr.compresion.como);
      if (!hemorragia && h.reloj !== undefined && h.sangrando) {
        cd = Math.max(cd, 22);
        mods.push("cirugía desesperada con el reloj corriendo: CD 22");
      }
      if (!hemorragia) {
        if (h.estado === "infectada") {
          cd += 2;
          mods.push("infectada: CD +2");
        }
        if (h.podre) {
          cd += 4;
          mods.push("Podre: hay que cortar la carne podrida, CD +4");
        }
        for (const extra of ["alcohol", "hierbas"] as const) {
          if (d.recursos.includes(extra)) {
            bono += 1;
            mods.push(`${extra} +1`);
          }
        }
        if (d.recursos.includes("paciente sedado")) {
          bono += 2;
          mods.push("paciente sedado +2");
        }
        if (regla.material) {
          const tiene = (x: Recurso) => d.recursos.includes(x);
          let pen = 0;
          if (regla.material === "kit de sanador" && !tiene("kit de sanador") && !tiene("herramientas de cirujano")) pen = 5;
          if (regla.material === "herramientas de cirujano" && !tiene("herramientas de cirujano")) pen = tiene("kit de sanador") ? 5 : 10;
          if (barbero) pen = Math.floor(pen / 2);
          if (pen) {
            bono -= pen;
            mods.push(`sin ${regla.material} −${pen}`);
          }
        }
      }

      let t = tirar(`1d20${signo(bono)}`);
      log.push(`${d.nombre_sanador} intenta ${hemorragia ? "detener la hemorragia" : "tratar"} ${h.id} (${h.gravedad}, ${h.ubicacion}): ${describir(t)} vs CD ${cd} [${mods.join(", ")}]`);
      if (t.total < cd && d.usar_mano_firme && barbero) {
        t = tirar(`1d20${signo(bono)}`);
        log.push(`Mano firme, repite: ${describir(t)}`);
      }
      const natural = t.dados[0];

      if (t.total >= cd || natural === 20) {
        h.sangrando = false;
        h.reloj = undefined;
        h.escalada = undefined;
        if (!hemorragia) {
          h.agonia = false;
          h.fallos_viscerales = 0;
        }
        if (hemorragia) {
          log.push(
            h.zona_vital === "roja"
              ? `Hemorragia contenida (${estr?.compresion?.como ?? "presión"}). Sigue siendo ROJA: necesita cirugía cuanto antes, y si es un torniquete, el miembro se pierde si pasan más de 2 horas.`
              : "Hemorragia detenida. La herida sigue sin tratar.",
          );
          return log.join("\n");
        }
        if (h.podre) log.push("La carne podrida sale entera: la Podre queda fuera de la herida.");
        h.podre = false;
        h.estado = "tratada";
        h.desinfectada = d.recursos.includes("alcohol");
        if (natural === 20 || t.total >= cd + 5) {
          h.dias_restantes = Math.ceil(h.dias_restantes * 0.75);
          h.mod_recuperacion += 2;
          log.push("Éxito notable: trabajo limpio. Convalecencia más corta y +2 a la recuperación.");
        } else log.push("Éxito: la herida queda limpia y cerrada.");
        log.push(`Convalecencia: ${Math.ceil(h.dias_restantes)} días (con pasar_tiempo).`);
      } else if (natural === 1 || t.total <= cd - 5) {
        const dano = tirar(regla.danoComplicacion);
        p.pv = Math.max(0, p.pv - dano.total);
        h.mod_recuperacion -= 1;
        log.push(`Complicación: ${p.nombre} pierde ${dano.total} PV (PV ${p.pv}) y la herida queda peor (−1 a la recuperación). Puede reintentarse.`);
      } else {
        log.push("Fallo: no se consigue. Puede reintentarse con más tiempo, otro sanador o mejor material.");
      }
      if (d.recursos.includes("kit de sanador")) log.push("(Recuerda gastar 1 uso del kit de sanador.)");
      return log.join("\n");
    }
  }
}

// ---------------------------------------------------------------- sangre

/**
 * Suma sangre perdida. Cada 3 puntos, salvación de CON con CD creciente
 * (8 + sangre/3): cuanto más dura la hemorragia, más fácil perder Fuerza.
 */
export function perderSangre(p: Personaje, puntos: number, log: string[]) {
  const antes = p.anemia;
  let ultima = "";
  for (let i = 0; i < puntos; i++) {
    p.sangrado++;
    if (p.sangrado % 3 !== 0) continue;
    const s = salvacion(p, "con", 8 + Math.floor(p.sangrado / 3));
    if (!s.exito) {
      p.anemia++;
      ultima = s.texto;
    }
  }
  if (p.anemia > antes) {
    log.push(`Pérdida de hierro: ${p.nombre} pierde ${p.anemia - antes} de FUE por la sangre (anemia ${p.anemia}, FUE efectiva ${valor(p, "fue")}). Última tirada: ${ultima}.`);
  }
  const fue = valor(p, "fue");
  if (fue <= 0) {
    marcarMuerto(p);
    log.push(`${p.nombre} se ha desangrado. Está muerto.`);
  } else if (fue <= 3 && !p.condiciones.includes("inconsciente (anemia)")) {
    p.condiciones.push("inconsciente (anemia)");
    log.push(`${p.nombre} se desploma, pálido como la cera: inconsciente por anemia.`);
  }
}

/**
 * Avanza la hemorragia asalto a asalto (10 asaltos = 1 minuto): PV, sangre perdida,
 * relojes de las heridas rojas, heridas ámbar que se vuelven rojas y costillas
 * que perforan el pulmón si el herido se esfuerza.
 */
export function avanzarAsaltos(p: Personaje, asaltos: number, esfuerzo = true): string {
  const log: string[] = [];
  if (p.condiciones.includes("muerto")) return `${p.nombre} ya está muerto.`;

  // Costillas rotas: cada asalto de esfuerzo, 1 entre 20 de perforar el pulmón.
  if (esfuerzo) {
    for (const h of p.heridas.filter((x) => buscarEstructura(x.estructura ?? "")?.costilla && x.zona_vital === "ambar")) {
      for (let i = 0; i < asaltos; i++) {
        if (tirar("1d20").total === 1) {
          volverRoja(h, "una costilla rota perforó el pulmón por el esfuerzo", "pulmón perforado");
          // Más abajo se le restan todos los asaltos; solo deben contar los que quedan tras perforarse.
          h.reloj = RELOJ_MAX + i + 1;
          log.push(`☠ ${h.id}: ¡la costilla rota de ${p.nombre} le perfora el pulmón! ZONA ROJA.`);
          break;
        }
      }
    }
  }

  const sangran = p.heridas.filter((h) => h.sangrando && h.gravedad !== "leve");
  if (!sangran.length) return log.join("\n") || `${p.nombre} no tiene hemorragias activas.`;
  let pv = 0;
  let sangre = 0;
  for (let i = 0; i < asaltos; i++) {
    for (const h of sangran) {
      if (h.gravedad === "critica") {
        pv += tirar("1d4").total;
        sangre += 2;
      } else {
        pv += 1;
        sangre += 1;
      }
    }
  }
  p.pv = Math.max(0, p.pv - pv);
  log.push(`${p.nombre} sangra ${asaltos} asalto(s) por ${sangran.map((h) => h.id).join(", ")}: −${pv} PV (PV ${p.pv}).`);

  for (const h of sangran) {
    if (h.escalada !== undefined) {
      h.escalada -= asaltos;
      if (h.escalada <= 0) {
        const sobra = -h.escalada;
        volverRoja(h, "nadie contuvo la hemorragia a tiempo");
        h.reloj = RELOJ_MAX - sobra;
        log.push(`☠ ${h.id} (${h.estructura}): la hemorragia ya no se contiene. ¡ZONA ROJA! Quedan ${Math.max(0, h.reloj)} asalto(s).`);
      } else log.push(`${h.id} (${h.estructura}): se vuelve roja en ${h.escalada} asalto(s) si nadie la comprime.`);
    } else if (h.reloj !== undefined) {
      h.reloj -= asaltos;
      if (h.reloj > 0) log.push(`☠ ${h.id} (${h.estructura}): quedan ${h.reloj} asalto(s) de vida.`);
    }
    if (h.reloj !== undefined && h.reloj <= 0) {
      marcarMuerto(p);
      log.push(`☠ ${p.nombre} muere: ${h.estructura}. No hubo tiempo.`);
      return log.join("\n");
    }
  }
  if (p.pv === 0) log.push("¡A 0 PV y desangrándose: salvaciones contra muerte cada asalto!");
  perderSangre(p, sangre, log);
  return log.join("\n");
}

// ---------------------------------------------------------------- tiempo

function infectar(h: Herida) {
  h.tratada_antes = h.estado === "tratada";
  h.estado = "infectada";
  h.infeccion_exitos = 0;
  h.infeccion_fallos = 0;
}

const AVANCE: Record<Calidad, number> = { esfuerzo: 0.5, precario: 1, reposo: 1, enfermeria: 1 };
const CUIDADO: Record<Calidad, number> = { esfuerzo: -1, precario: -0.5, reposo: 0, enfermeria: 0.5 };

function cerrar(p: Personaje, h: Herida, log: string[]) {
  p.heridas = p.heridas.filter((x) => x !== h);
  const nuevas: string[] = [];
  if (h.gravedad !== "leve") {
    const r = rasgos(p);
    const regla = REGLAS[h.gravedad];
    const bono = r.recuperacion + Math.round(h.mod_recuperacion);
    const s = salvacionCON(p, regla.cdRecuperacion, bono);
    let tipo: "menor" | "permanente" | null;
    if (h.gravedad === "moderada") tipo = s.exito ? null : "menor";
    else if (h.gravedad === "grave") tipo = s.exito ? null : s.total <= regla.cdRecuperacion - 5 ? "permanente" : "menor";
    else tipo = s.exito ? "menor" : "permanente";
    // Ámbar: casi siempre deja secuela. Roja superada: siempre irreversible.
    if (h.zona_vital === "ambar" && tipo === null) tipo = s.total >= regla.cdRecuperacion + 5 ? null : "menor";
    if (h.zona_vital === "ambar" && !s.exito) tipo = "permanente";
    if (h.zona_vital === "roja") tipo = "permanente";
    log.push(`Tirada de recuperación de ${h.id} (${h.gravedad}, ${h.ubicacion}): ${s.texto}${bono ? ` [incluye ${signo(bono)} por raza y cuidados]` : ""}`);
    if (tipo) {
      const propia = buscarEstructura(h.estructura ?? "")?.secuelas?.[tipo];
      const lista = SECUELAS[zona(h.ubicacion)][tipo];
      const elegida = propia ?? lista[tirar(`1d${lista.length}`).total - 1];
      nuevas.push(`${elegida} (${h.ubicacion}${h.estructura ? `, ${h.estructura}` : ""})`);
    }
  }
  if (h.cauterizada) nuevas.push(`cicatriz de quemadura (${h.ubicacion})`);
  p.secuelas.push(...nuevas);
  log.push(
    nuevas.length
      ? `La herida ${h.id} se cierra, pero deja secuela: ${nuevas.join("; ")}.`
      : `La herida ${h.id} se cierra sin secuelas.`,
  );
}

const RECUPERA_ANEMIA: Record<Calidad, number> = { esfuerzo: 0, precario: 0.25, reposo: 0.5, enfermeria: 1 };

export function pasarTiempo(p: Personaje, dias: number, calidad: Calidad): string {
  const log: string[] = [];
  const r = rasgos(p);
  p.dosis = { curacion: 0, sueno: 0 };
  // Las condiciones pasajeras (sueño, veneno, aturdimiento, delirio…) no duran días.
  const PASAJERAS = /^(dormido|envenenado|paralizado|aturdido|asustado|hechizado|derribado|apresado|delirante|petrificándose)/;
  p.condiciones = p.condiciones.filter((c) => !PASAJERAS.test(c));
  for (let dia = 1; dia <= dias; dia++) {
    const antes = log.length;
    if (p.condiciones.includes("muerto")) break;
    for (const h of [...p.heridas]) {
      h.dias_abierta++;
      const regla = REGLAS[h.gravedad];
      const cdInf = regla.cdInfeccion + (h.podre ? 2 : 0) - (calidad === "enfermeria" ? 3 : 0);

      if (h.reloj !== undefined && h.sangrando) {
        marcarMuerto(p);
        log.push(`☠ ${p.nombre} muere: nadie detuvo la hemorragia de ${h.estructura} (zona roja).`);
        break;
      }
      if (h.escalada !== undefined && h.sangrando) {
        volverRoja(h, "nadie contuvo la hemorragia");
        marcarMuerto(p);
        log.push(`☠ ${p.nombre} muere desangrado: ${h.estructura} nunca se comprimió.`);
        break;
      }

      // Ámbar visceral o craneal sin cirugía: empeora cada día hasta volverse roja.
      const ev = buscarEstructura(h.estructura ?? "");
      if (ev?.visceral && h.estado !== "tratada") {
        if (h.agonia) {
          marcarMuerto(p);
          log.push(`☠ ${p.nombre} muere: ${h.estructura} sin cirugía (shock, peritonitis o sangre en el cráneo).`);
          break;
        }
        const s = salvacionCON(p, 13 + 2 * h.fallos_viscerales, r.infeccion);
        if (!s.exito) {
          h.fallos_viscerales++;
          if (h.fallos_viscerales >= 3) {
            h.zona_vital = "roja";
            h.gravedad = "critica";
            h.agonia = true;
            log.push(`☠ ${h.id} (${h.estructura}): ${s.texto} → ZONA ROJA. Agoniza: morirá al final de mañana si nadie le opera (Medicina CD 19) o le cura con magia.`);
          } else log.push(`${h.id} (${h.estructura}) empeora sin cirugía: ${s.texto} (${h.fallos_viscerales}/3).`);
        }
      }

      if (h.sangrando && h.gravedad !== "leve") {
        const t = tirar(h.gravedad === "critica" ? "4d6" : "2d6");
        p.pv = Math.max(0, p.pv - t.total);
        log.push(`${h.id} sigue sangrando: −${t.total} PV (PV ${p.pv}).${p.pv === 0 ? " ¡Cae inconsciente y está muriendo!" : ""}`);
        perderSangre(p, h.gravedad === "critica" ? 40 : 20, log);
      }

      if (h.estado === "infectada") {
        const s = salvacionCON(p, cdInf, r.infeccion);
        if (s.exito && !h.podre && ++h.infeccion_exitos >= 3) {
          h.estado = h.tratada_antes ? "tratada" : "sin tratar";
          h.mod_recuperacion -= 1;
          log.push(`${h.id}: ${s.texto} → el cuerpo vence la fiebre; la infección remite (−1 a la recuperación).`);
        } else if (!s.exito && ++h.infeccion_fallos >= 2) {
          h.infeccion_fallos = 0;
          if (h.gravedad === "critica") {
            const t = tirar("2d6");
            p.pv = Math.max(0, p.pv - t.total);
            log.push(`${h.id} infectada: ${s.texto} → septicemia, −${t.total} PV (PV ${p.pv}).${p.pv === 0 ? " ¡Agoniza: salvaciones contra muerte!" : ""}`);
          } else {
            h.gravedad = sube(h.gravedad);
            h.dias_restantes = Math.max(h.dias_restantes, tirar(REGLAS[h.gravedad].dias).total);
            log.push(`${h.id} infectada: ${s.texto} → la infección avanza y la herida se agrava a ${h.gravedad}.`);
            if (h.zona_vital === "verde" && h.gravedad !== "moderada") {
              h.zona_vital = "ambar";
              log.push(`${h.id} pasa a ZONA ÁMBAR: gangrena; dejará secuelas.`);
            } else if (h.zona_vital === "ambar" && h.gravedad === "critica") {
              h.zona_vital = "roja";
              log.push(`${h.id} pasa a ZONA ROJA: septicemia.`);
            }
          }
        } else if (!s.exito) log.push(`${h.id} infectada: ${s.texto} → fiebre alta.`);
        continue; // una herida infectada no sana hasta que el cuerpo la venza o se vuelva a tratar
      }

      if (h.estado === "sin tratar" && h.gravedad !== "leve") {
        if (h.dias_abierta >= 1) {
          const s = salvacionCON(p, cdInf, r.infeccion);
          if (!s.exito) {
            infectar(h);
            log.push(`${h.id} sin tratar: ${s.texto} → se infecta${h.podre ? " (la Podre: el cuerpo no puede vencerla solo)" : ""}.`);
          }
        }
        continue; // sin tratamiento no hay convalecencia
      }

      // Tratadas, y leves aunque no estén tratadas.
      if (calidad === "esfuerzo" || calidad === "precario") {
        const s = salvacionCON(p, cdInf - 4 - (h.desinfectada ? 3 : 0), r.infeccion);
        if (!s.exito) {
          infectar(h);
          log.push(`${h.id}: ${s.texto} → la herida se infecta (${calidad === "esfuerzo" ? "por el esfuerzo" : "por las malas condiciones"}).`);
          continue;
        }
      }
      h.mod_recuperacion = Math.max(-4, Math.min(4, h.mod_recuperacion + CUIDADO[calidad]));
      h.dias_restantes -= AVANCE[calidad];
      if (h.dias_restantes <= 0) cerrar(p, h, log);
    }

    // La sangre se repone despacio, y solo si ya no hay hemorragias.
    if (!p.heridas.some((h) => h.sangrando)) {
      p.sangrado = 0;
      if (p.anemia > 0) {
        p.anemia_progreso += RECUPERA_ANEMIA[calidad];
        while (p.anemia_progreso >= 1 && p.anemia > 0) {
          p.anemia_progreso -= 1;
          p.anemia--;
          log.push(`${p.nombre} recupera 1 de FUE perdida por anemia (anemia ${p.anemia}).`);
        }
        if (valor(p, "fue") > 3) p.condiciones = p.condiciones.filter((c) => c !== "inconsciente (anemia)");
      } else p.anemia_progreso = 0;
    }

    // Recuperación de PV: la fiebre de una infección la impide.
    const fiebre = p.heridas.some((h) => h.estado === "infectada");
    if (!fiebre) {
      const base = Math.max(1, p.nivel + modCON(p));
      const pv = { esfuerzo: 0, precario: Math.max(1, Math.floor(base / 2)), reposo: base, enfermeria: base * 2 }[calidad];
      p.pv = Math.min(pvMaxEfectivo(p), p.pv + pv);
    }
    ajustarPV(p);
    if (log.length > antes) log.splice(antes, 0, `— Día ${dia}:`);
  }
  log.push(`Tras ${dias} día(s) (${calidad}): PV ${p.pv}/${pvMaxEfectivo(p)}.`);
  for (const h of p.heridas) log.push(`  ${resumenHerida(h)}`);
  return log.join("\n");
}

/** Texto de reglas para el DM (se incluye en el prompt del sistema). */
export const REGLAS_HERIDAS = `## Sistema de heridas (lo gestiona el programa; tú lo narras)
Los PV representan aguante, reflejos y suerte; las heridas son daño real en el cuerpo. Un personaje puede tener PV de sobra y una pierna rota.

### Cuándo se produce una herida (usa infligir_herida)
- causa "critico": un enemigo le asesta un golpe crítico.
- causa "golpe_masivo": recibe en un solo golpe daño igual o mayor a la mitad de sus PV máximos.
- causa "cero_pv": cae a 0 PV.
- causa "menor": caídas, trampas, peleas a puñetazos, torturas leves… cuando la ficción lo pida.
Deja que el programa tire gravedad y ubicación (no las fijes salvo que la ficción lo exija: una guillotina, una flecha al ojo apuntada). Marca de_no_muerto=true si la causa un Hambriento u otro no-muerto: puede transmitir la Podre. Los rasguños (heridas leves) no la transmiten; en el resto, el herido hace una salvación de CON (cd_podre: 11 un Hambriento, 12 por defecto, 13 un ghul, 15-17 la Madre de los Hambrientos u otros no-muertos poderosos).

### Gravedades
- leve (cortes, moratones): sin penalización; sana sola en 1d3 días. Tratar: CD 10.
- moderada (corte profundo, esguince, costilla fisurada): −3 PV máx., penalización según la zona; tratar CD 13 con kit de sanador; 1d4+3 días de convalecencia; puede dejar secuela menor.
- grave (fractura, perforación, quemadura extensa): −6 PV máx.; puede sangrar; cirugía CD 16 con herramientas de cirujano; 2d6+7 días; secuela menor o permanente si la recuperación sale mal.
- crítica (miembro destrozado, órgano perforado, ojo reventado): −10 PV máx.; sangra siempre; cirugía CD 19; 3d10+15 días; SIEMPRE deja secuela.

### Zonas vitales: verde, ámbar y roja
Cada herida cae sobre una estructura anatómica concreta (el programa la tira según la gravedad y la región: cabeza, cuello, torso, abdomen, brazos, piernas). La estructura decide la zona:
- **ROJA** (encéfalo, cerebelo, tallo cerebral, corazón, aorta, vena cava, arteria y vena pulmonar, pulmón perforado, subclavia, axilar, femoral, isquiotibiales con la femoral profunda, hemorragia visceral masiva): sangrado masivo o daño vital donde una mano no llega. **No da minutos: da un minuto como mucho** (10 asaltos o menos; el tallo cerebral, 1d4). Si la estructura se puede comprimir (femoral, axilar, subclavia) se puede intentar detener la hemorragia con una CD alta; si está dentro de una cavidad, no hay dónde apretar: solo la salvan una cirugía desesperada (CD 22), la Sangre de Santo o la magia divina. Contenida, sigue siendo roja hasta que se opere. Si se supera, deja siempre secuela irreversible.
- **ÁMBAR**: se sobrevive, pero cuesta, con recuperación larga y secuelas casi siempre irreversibles. Si no se tratan, pasan a roja:
  - Cuello (carótida, yugulares): sangran; si nadie las comprime en pocos asaltos, se vuelven rojas. Un degüello NO siempre las alcanza (puede quedarse en la piel).
  - Nervios y tendones (plexo braquial, nervio ciático, tendones de mano, antebrazo y pierna): además incapacitan; brazos que no responden, piernas que no caminan, espadachines que no pueden empuñar.
  - Abdomen (intestino, hígado, bazo, páncreas) y cráneo fracturado: potencialmente letales sin cirugía, pero en días: cada día sin operar empeora, y tras 3 malos días se vuelven rojas y el herido agoniza (muere al día siguiente sin cirugía).
  - Costillas rotas: dolor e incapacidad; cada asalto de esfuerzo pueden perforar el pulmón, y entonces es roja.
  - Arterias de las extremidades (braquial, poplítea): torniquete o se vuelven rojas.
- **VERDE**: casi ninguna; piel y músculo grueso. Sin cuidados se infectan y pueden pasar a ámbar (gangrena) o roja (septicemia).
Narra la zona con crudeza: una herida roja es una cuenta atrás que todos en la mesa deben sentir.

### Hemorragia y anemia (usa avanzar_asaltos)
Mientras una herida sangra, llama a avanzar_asaltos al final de cada asalto en combate (o con 10 asaltos por cada minuto fuera de combate). Grave: −1 PV por asalto; crítica: −1d4. Además se acumula sangre perdida y, cada poco, el personaje hace una salvación de CON cuya CD crece cuanto más dura la hemorragia: si falla, pierde 1 de FUE por falta de hierro (anemia). Con FUE efectiva 3 o menos cae inconsciente; con 0 muere desangrado. La anemia se recupera con días de descanso (más rápido en enfermería; nada mientras se esfuerza) y con Sangre de Santo. Descríbela: palidez, frío, manos que tiemblan, el arma que pesa el doble.

### Tratamiento (usa tratar_herida)
- "detener hemorragia" (CD 10, 15 si crítica): solo para la sangre; la herida sigue sin tratar.
- "medicina": el tratamiento real. Modificadores: entorno (en combate −4, intemperie −2, refugio 0, enfermería +2), alcohol +1 (además reduce el riesgo de infección), hierbas +1, paciente sedado con Leche de Amapola +2, falta de material −5/−10, herida infectada CD +2. Fallar por 5 o más causa daño. Un Barbero-Cirujano suma +2 y sufre la mitad de penalización por falta de material.
- "cauterizar": detiene la sangre y quema la Podre sin tirada, pero hace 1d6 de daño, −2 a la recuperación y deja cicatriz de quemadura. Necesita hierro candente (o un Cenizo).
- "magia divina" (conjuros de curación, imposición de manos sobre una herida, reliquias): baja la herida un nivel de gravedad (una leve se cierra), una sola vez por herida, y da Ceniza al paciente. No cura la Podre. No funciona con Nacidos Pálidos; a los Varg les da doble Ceniza.
- "remedio raro": solo contra la Podre; exige un ingrediente difícil de conseguir que debe ganarse en la ficción.
- La Podre: la medicina puede quitarla cortando la carne podrida (CD +4); el cuerpo no la vence solo, pero ya no agrava la herida de golpe: avanza como una infección.
Los conjuros y pociones de curación restauran PV como siempre (sin Ceniza), pero no cierran heridas: para eso hay que usar el método "magia divina".
Antes de tratar, comprueba en la ficha que el sanador tiene el material que dice usar, y descuenta lo gastado con modificar_personaje.

### El paso del tiempo (usa pasar_tiempo)
Úsalo cada vez que pase al menos un día: viajes, descansos, convalecencias. La calidad importa:
- "esfuerzo" (viajar, combatir): las heridas avanzan a medio ritmo, empeora la recuperación, riesgo de infección, sin recuperar PV.
- "precario" (acampada, celda, choza): ritmo normal, algo de riesgo de infección, recupera poco.
- "reposo" (posada, refugio decente): ritmo normal, sin riesgo para heridas tratadas.
- "enfermeria" (Hermanas de la Sutura o un sanador atento): ritmo normal, mejor recuperación, menos infección, PV dobles.
Las heridas sin tratar se infectan. Una herida infectada no avanza: con 3 salvaciones superadas el cuerpo vence la fiebre, y cada 2 fallos se agrava un nivel (en las críticas, septicemia). Tratarla con medicina limpia la infección. Deja que el tiempo apriete. Un descanso largo de una noche NO devuelve todos los PV en esta campaña: usa pasar_tiempo.
Narra las secuelas con crudeza y respeto; cambian al personaje para siempre, y deben notarse en la ficción.`;
