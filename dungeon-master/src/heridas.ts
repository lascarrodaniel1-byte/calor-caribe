// Motor de heridas: gravedad, infección, tratamiento, recuperación y secuelas.
// Toda la aleatoriedad pasa por dados.ts; el DM solo narra lo que sale aquí.
import { describir, tirar } from "./dados.js";
import type { Personaje } from "./estado.js";
import { raza, type RasgosCuracion } from "./mundo.js";
import { marcarMuerto, salvacion, valor } from "./reglas.js";

export const GRAVEDADES = ["leve", "moderada", "grave", "critica"] as const;
export const TIPOS = ["corte", "perforacion", "contusion", "quemadura", "mordedura", "necrotica"] as const;
export const UBICACIONES = ["cabeza", "torso", "brazo izquierdo", "brazo derecho", "pierna izquierda", "pierna derecha"] as const;
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

type Zona = "cabeza" | "torso" | "brazo" | "pierna";
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
  return h.gravedad === "leve" ? "dolor, sin penalización" : EFECTOS[zona(h.ubicacion)][h.gravedad];
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
    h.podre ? "con PODRE" : "",
  ].filter(Boolean);
  return `[${h.id}] ${h.gravedad} · ${h.tipo} · ${h.ubicacion} · ${extra.join(" · ")} — ${efecto(h)}${h.descripcion ? ` (${h.descripcion})` : ""}`;
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
  [2, "cabeza"], [9, "torso"], [12, "brazo izquierdo"], [15, "brazo derecho"], [17, "pierna izquierda"], [20, "pierna derecha"],
];

const deTabla = <T>(tabla: [number, T][], d: number) => tabla.find(([max]) => d <= max)![1];

export interface DatosHerida {
  causa: Causa;
  gravedad?: Gravedad;
  tipo: Tipo;
  ubicacion?: Ubicacion;
  descripcion?: string;
  de_no_muerto?: boolean;
}

export function infligir(p: Personaje, d: DatosHerida): string {
  const log: string[] = [];
  let gravedad = d.gravedad;
  if (!gravedad) {
    const t = tirar("1d20");
    gravedad = deTabla(TABLAS_CAUSA[d.causa], t.total);
    log.push(`Gravedad (${d.causa}): d20 = ${t.total} → ${gravedad}`);
  }
  let ubicacion = d.ubicacion;
  if (!ubicacion) {
    const t = tirar("1d20");
    ubicacion = deTabla(TABLA_UBICACION, t.total);
    log.push(`Ubicación: d20 = ${t.total} → ${ubicacion}`);
  }
  const r = rasgos(p);
  const sangra = gravedad === "critica" || (gravedad === "grave" && ["corte", "perforacion", "mordedura"].includes(d.tipo));
  const n = Math.max(0, ...p.heridas.map((h) => Number(h.id.slice(1)) || 0)) + 1;
  const h: Herida = {
    id: `H${n}`,
    gravedad,
    tipo: d.tipo,
    ubicacion,
    descripcion: d.descripcion ?? "",
    estado: "sin tratar",
    sangrando: sangra,
    podre: Boolean(d.de_no_muerto) && !r.inmunePodre,
    dias_restantes: gravedad === "leve" && r.levesRapidas ? 1 : tirar(REGLAS[gravedad].dias).total,
    dias_abierta: 0,
    mod_recuperacion: 0,
    desinfectada: false,
    cauterizada: false,
    magia_usada: false,
    infeccion_exitos: 0,
    infeccion_fallos: 0,
    tratada_antes: false,
  };
  if (d.de_no_muerto && r.inmunePodre) log.push(`${p.raza}: inmune a la Podre.`);
  p.heridas.push(h);
  ajustarPV(p);
  log.push(`${p.nombre} sufre una herida: ${resumenHerida(h)}`);
  if (h.sangrando) {
    log.push(
      gravedad === "critica"
        ? "Hemorragia arterial: pierde 1d4 PV por asalto y sangre a chorros (riesgo alto de anemia) hasta detenerla."
        : "Hemorragia: pierde 1 PV por asalto y sangre (riesgo de anemia) hasta detenerla.",
    );
  }
  if (h.podre) log.push("La herida está infectada de Podre: la medicina común no la limpia.");
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
      h.sangrando = false;
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
      if (!hemorragia && h.podre) return `La herida ${h.id} tiene Podre: antes hay que cauterizarla, cortar la carne podrida o aplicar un remedio raro.`;

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
      let cd = hemorragia ? (h.gravedad === "critica" ? 15 : 10) : regla.cdTratar;
      if (!hemorragia) {
        if (h.estado === "infectada") {
          cd += 2;
          mods.push("infectada: CD +2");
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
        if (hemorragia) {
          log.push("Hemorragia detenida. La herida sigue sin tratar.");
          return log.join("\n");
        }
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

/** Avanza la hemorragia asalto a asalto (10 asaltos = 1 minuto). */
export function avanzarAsaltos(p: Personaje, asaltos: number): string {
  const log: string[] = [];
  const sangran = p.heridas.filter((h) => h.sangrando && h.gravedad !== "leve");
  if (!sangran.length) return `${p.nombre} no tiene hemorragias activas.`;
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
  if (p.pv === 0 && !p.condiciones.includes("muerto")) log.push("¡A 0 PV y desangrándose: salvaciones contra muerte cada asalto!");
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
    log.push(`Tirada de recuperación de ${h.id} (${h.gravedad}, ${h.ubicacion}): ${s.texto}${bono ? ` [incluye ${signo(bono)} por raza y cuidados]` : ""}`);
    if (tipo) {
      const lista = SECUELAS[zona(h.ubicacion)][tipo];
      const elegida = lista[tirar(`1d${lista.length}`).total - 1];
      nuevas.push(`${elegida} (${h.ubicacion})`);
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
          }
        } else if (!s.exito) log.push(`${h.id} infectada: ${s.texto} → fiebre alta.`);
        continue; // una herida infectada no sana hasta que el cuerpo la venza o se vuelva a tratar
      }

      if (h.estado === "sin tratar" && h.gravedad !== "leve") {
        if (h.dias_abierta >= 1) {
          const s = salvacionCON(p, cdInf, r.infeccion);
          if (!s.exito) {
            infectar(h);
            log.push(`${h.id} sin tratar: ${s.texto} → se infecta.`);
            if (h.podre && h.gravedad !== "critica") {
              h.gravedad = sube(h.gravedad);
              log.push(`La Podre se extiende: ${h.id} pasa a ${h.gravedad}.`);
            }
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
Deja que el programa tire gravedad y ubicación (no las fijes salvo que la ficción lo exija: una guillotina, una flecha al ojo apuntada). Marca de_no_muerto=true si la causa un Hambriento u otro no-muerto: transmite la Podre.

### Gravedades
- leve (cortes, moratones): sin penalización; sana sola en 1d3 días. Tratar: CD 10.
- moderada (corte profundo, esguince, costilla fisurada): −3 PV máx., penalización según la zona; tratar CD 13 con kit de sanador; 1d4+3 días de convalecencia; puede dejar secuela menor.
- grave (fractura, perforación, quemadura extensa): −6 PV máx.; puede sangrar; cirugía CD 16 con herramientas de cirujano; 2d6+7 días; secuela menor o permanente si la recuperación sale mal.
- crítica (miembro destrozado, órgano perforado, ojo reventado): −10 PV máx.; sangra siempre; cirugía CD 19; 3d10+15 días; SIEMPRE deja secuela.

### Hemorragia y anemia (usa avanzar_asaltos)
Mientras una herida sangra, llama a avanzar_asaltos al final de cada asalto en combate (o con 10 asaltos por cada minuto fuera de combate). Grave: −1 PV por asalto; crítica: −1d4. Además se acumula sangre perdida y, cada poco, el personaje hace una salvación de CON cuya CD crece cuanto más dura la hemorragia: si falla, pierde 1 de FUE por falta de hierro (anemia). Con FUE efectiva 3 o menos cae inconsciente; con 0 muere desangrado. La anemia se recupera con días de descanso (más rápido en enfermería; nada mientras se esfuerza) y con Sangre de Santo. Descríbela: palidez, frío, manos que tiemblan, el arma que pesa el doble.

### Tratamiento (usa tratar_herida)
- "detener hemorragia" (CD 10, 15 si crítica): solo para la sangre; la herida sigue sin tratar.
- "medicina": el tratamiento real. Modificadores: entorno (en combate −4, intemperie −2, refugio 0, enfermería +2), alcohol +1 (además reduce el riesgo de infección), hierbas +1, paciente sedado con Leche de Amapola +2, falta de material −5/−10, herida infectada CD +2. Fallar por 5 o más causa daño. Un Barbero-Cirujano suma +2 y sufre la mitad de penalización por falta de material.
- "cauterizar": detiene la sangre y quema la Podre sin tirada, pero hace 1d6 de daño, −2 a la recuperación y deja cicatriz de quemadura. Necesita hierro candente (o un Cenizo).
- "magia divina" (conjuros de curación, imposición de manos sobre una herida, reliquias): baja la herida un nivel de gravedad (una leve se cierra), una sola vez por herida, y da Ceniza al paciente. No cura la Podre. No funciona con Nacidos Pálidos; a los Varg les da doble Ceniza.
- "remedio raro": solo contra la Podre; exige un ingrediente difícil de conseguir que debe ganarse en la ficción.
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
