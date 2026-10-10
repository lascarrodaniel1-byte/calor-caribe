// Combate: iniciativa y ataques resueltos por el programa. La experiencia del
// combatiente (veteranía), su raza o naturaleza y su clase deciden lo fácil que
// es que falle: un recluta se enreda con su propia arma a menos que golpee
// primero; un veterano casi nunca falla del todo, y cuando falla aún roza.
// Los nervios crecen con la presión (golpear después, un monstruo terrible,
// estar malherido) y pesan mucho más en los novatos. Las emboscadas y los planes
// dan ventaja, pero a un veterano cuesta más sorprenderlo, y la personalidad
// (arrogancia, prudencia, impulsividad…) cambia lo fácil que es engañar a alguien.
import { danar, estadoTexto, type Criatura, type EstadoJefe } from "./bestiario.js";
import { describir, tirar, type Modo } from "./dados.js";
import type { Partida, Personaje } from "./estado.js";
import { armaduraDe, proteccion, reconocerArma, regionDe, REGLAS_ARMADURA, type TipoDano } from "./armadura.js";
import { infligir, tirarUbicacion, type Ubicacion } from "./heridas.js";
import { competencia, mod, signo, valor } from "./reglas.js";

export const VETERANIAS = ["recluta", "curtido", "veterano", "leyenda"] as const;
export type Veterania = (typeof VETERANIAS)[number];

interface Oficio {
  /** Bonificador al ataque. */
  golpe: number;
  iniciativa: number;
  /** Penalizador por nervios según la presión (0, 1, 2, 3, 4 o más fuentes de presión). */
  nervios: number[];
  /** Sangre fría para notar emboscadas y leer planes. */
  deteccion: number;
  /** Penalizador a su percepción si lo pillan dormido. */
  dormido: number;
  /** Un d20 natural igual o menor que esto es una torpeza (fallo seguro) si no actúa antes que su rival; si actúa antes, solo el 1. */
  torpeza: number;
  /** Si falla por este margen o menos, aún roza (mitad de daño, sin herida). */
  roce: number;
  /** Crítico con este natural o más. */
  critico: number;
  /** Repite el 1 natural (una vez por tirada). */
  repiteUno: boolean;
  descripcion: string;
}

export const OFICIO: Record<Veterania, Oficio> = {
  recluta: { golpe: 0, iniciativa: 0, nervios: [0, -2, -3, -4, -5], deteccion: 0, dormido: -10, torpeza: 2, roce: 0, critico: 20, repiteUno: false, descripcion: "pocas peleas de verdad: los nervios le pesan mucho (−2 con una presión, hasta −5) y se enreda con 1-2 natural salvo si actúa antes que su rival; fácil de sorprender" },
  curtido: { golpe: 1, iniciativa: 1, nervios: [0, -1, -1, -2, -3], deteccion: 2, dormido: -7, torpeza: 1, roce: 1, critico: 20, repiteUno: false, descripcion: "algunos años de oficio: +1 a atacar e iniciativa, nervios moderados (−1 a −3), +2 para no ser sorprendido; si falla por 1, roza" },
  veterano: { golpe: 2, iniciativa: 2, nervios: [0, 0, 0, -1, -2], deteccion: 4, dormido: -5, torpeza: 1, roce: 2, critico: 20, repiteUno: false, descripcion: "muchos años matando: +2 a atacar e iniciativa, solo le pesan los nervios con tres presiones o más, +4 para no ser sorprendido (duerme con un ojo abierto); si falla por 2 o menos, aún roza" },
  leyenda: { golpe: 3, iniciativa: 3, nervios: [0, 0, 0, 0, -1], deteccion: 6, dormido: -3, torpeza: 1, roce: 3, critico: 19, repiteUno: true, descripcion: "toda una vida en el filo: +3 a atacar e iniciativa, casi inmune a los nervios, +6 para no ser sorprendido, repite el 1 natural, roza si falla por 3 o menos y hace crítico con 19-20" },
};

/** Veteranía por defecto según el nivel (el DM la fija por trasfondo al crear el personaje). */
export const veteraniaPorNivel = (nivel: number): Veterania => (nivel >= 13 ? "leyenda" : nivel >= 7 ? "veterano" : nivel >= 3 ? "curtido" : "recluta");
export const veteraniaDe = (p: Personaje): Veterania => p.veterania ?? veteraniaPorNivel(p.nivel);

interface Temple {
  iniciativa: number;
  cuerpo: number;
  distancia: number;
  /** Se suma al rango de torpeza. */
  torpeza: number;
  repiteUno?: boolean;
  /** Sentidos para notar emboscadas. */
  deteccion?: number;
  /** Sin mente o sin miedo: no sufre nervios. */
  sinNervios?: boolean;
  nota: string;
}

/** Carácter en combate de cada raza y naturaleza. */
export const TEMPLES: Record<string, Temple> = {
  "Humano del Faro": { iniciativa: 0, cuerpo: 0, distancia: 0, torpeza: 0, nota: "tozudos y versátiles: sin ventajas ni vicios" },
  "Enano de Karak-Dûm": { iniciativa: -1, cuerpo: 1, distancia: 0, torpeza: 0, nota: "lentos en arrancar, implacables cuerpo a cuerpo (+1)" },
  "Elfo Marchito": { deteccion: 1, iniciativa: 2, cuerpo: 0, distancia: 1, torpeza: 0, nota: "reflejos de siglos (+2 iniciativa, +1 para notar emboscadas), certeros a distancia (+1)" },
  "Mediano de Hollín": { iniciativa: 1, cuerpo: 0, distancia: 1, torpeza: 0, repiteUno: true, nota: "rápidos y afortunados: repiten el 1 natural, +1 a distancia" },
  Varg: { deteccion: 2, iniciativa: 1, cuerpo: 1, distancia: -1, torpeza: 0, nota: "instinto de lobo: +1 iniciativa y cuerpo a cuerpo, −1 a distancia; su olfato da +2 para notar emboscadas" },
  "Nacido Pálido": { deteccion: 1, iniciativa: 2, cuerpo: 0, distancia: 0, torpeza: 0, nota: "reflejos de depredador (+2 iniciativa)" },
  Cenizo: { iniciativa: 0, cuerpo: 0, distancia: 0, torpeza: 0, nota: "serenos: sin ventajas ni vicios" },
  "no-muerto torpe": { deteccion: -2, sinNervios: true, iniciativa: -3, cuerpo: 0, distancia: -2, torpeza: 1, nota: "carne muerta sin mente: −3 iniciativa, una torpeza más, sin nervios, −2 para notar emboscadas" },
  "no-muerto": { sinNervios: true, iniciativa: -1, cuerpo: 0, distancia: 0, torpeza: 0, nota: "muertos con mente, sin reflejos de vivo: −1 iniciativa; no sienten nervios" },
  vampiro: { deteccion: 2, iniciativa: 2, cuerpo: 0, distancia: 0, torpeza: 0, nota: "velocidad antinatural: +2 iniciativa, +2 para notar emboscadas" },
  espectro: { iniciativa: 1, cuerpo: 0, distancia: 0, torpeza: 0, nota: "incorpóreos: +1 iniciativa" },
  bestia: { deteccion: 2, iniciativa: 1, cuerpo: 0, distancia: 0, torpeza: 0, nota: "instinto: +1 iniciativa, +2 para notar emboscadas" },
};
export const NOMBRES_TEMPLES = Object.keys(TEMPLES) as [string, ...string[]];
const SIN_TEMPLE: Temple = { iniciativa: 0, cuerpo: 0, distancia: 0, torpeza: 0, nota: "" };
const temple = (t?: string) => (t ? (TEMPLES[t] ?? Object.entries(TEMPLES).find(([k]) => k.toLowerCase() === t.toLowerCase())?.[1] ?? SIN_TEMPLE) : SIN_TEMPLE);

/** Estilo de lucha de cada clase. */
export const ESTILO_CLASE: Record<string, { iniciativa: number; cuerpo: number; distancia: number; torpeza: number; nota: string }> = {
  "Mercenario del Cuervo": { iniciativa: 0, cuerpo: 1, distancia: 1, torpeza: 0, nota: "oficio de la Compañía: +1 a todo ataque con armas" },
  "Berserker de Ceniza": { iniciativa: 1, cuerpo: 1, distancia: 0, torpeza: 1, nota: "furia: +1 iniciativa y cuerpo a cuerpo, pero una torpeza más" },
  "Caballero Juramentado": { iniciativa: -1, cuerpo: 1, distancia: 0, torpeza: 0, nota: "disciplina (+1 cuerpo a cuerpo) bajo acero pesado (−1 iniciativa)" },
  "Cazador de Brujas": { iniciativa: 1, cuerpo: 0, distancia: 1, torpeza: 0, nota: "+1 iniciativa y a distancia" },
  Degollador: { iniciativa: 2, cuerpo: 0, distancia: 0, torpeza: 0, nota: "golpea primero: +2 iniciativa" },
  Flagelante: { iniciativa: 1, cuerpo: 0, distancia: 0, torpeza: 0, nota: "+1 iniciativa" },
  Segador: { iniciativa: 0, cuerpo: 0, distancia: 0, torpeza: 0, nota: "" },
  Hechicero: { iniciativa: 0, cuerpo: -2, distancia: -2, torpeza: 1, nota: "no es un guerrero: −2 con armas y una torpeza más (sus hechizos van con lanzar_hechizo)" },
  "Barbero-Cirujano": { iniciativa: 0, cuerpo: 0, distancia: 0, torpeza: 0, nota: "" },
};
const SIN_ESTILO = { iniciativa: 0, cuerpo: 0, distancia: 0, torpeza: 0, nota: "" };

interface Personalidad {
  /** Para notar emboscadas. */
  deteccion: number;
  /** Para leer planes, fintas y trampas. */
  lectura: number;
  iniciativa: number;
  /** Presión extra (o menos) para los nervios. */
  presion: number;
  /** No se achanta ante monstruos terribles. */
  sinTerror?: boolean;
  torpeza?: number;
  nota: string;
}

/** Rasgos de carácter que pesan en el combate. */
export const PERSONALIDADES: Record<string, Personalidad> = {
  arrogante: { deteccion: -4, lectura: -4, iniciativa: 0, presion: 0, sinTerror: true, nota: "subestima a todos: −4 para notar emboscadas y leer planes; no se achanta ante monstruos" },
  confiado: { deteccion: -2, lectura: -2, iniciativa: 0, presion: 0, nota: "baja la guardia: −2 para notar emboscadas y leer planes" },
  impulsivo: { deteccion: 0, lectura: -3, iniciativa: 2, presion: 0, nota: "+2 iniciativa, pero cae en fintas y trampas (−3 para leer planes)" },
  temerario: { deteccion: 0, lectura: 0, iniciativa: 1, presion: 0, sinTerror: true, torpeza: 1, nota: "+1 iniciativa y sin miedo a los monstruos, pero se lanza sin cubrirse (una torpeza más)" },
  prudente: { deteccion: 2, lectura: 2, iniciativa: -1, presion: 0, nota: "+2 para notar emboscadas y leer planes, −1 iniciativa" },
  calculador: { deteccion: 1, lectura: 3, iniciativa: -1, presion: 0, nota: "+3 para leer planes, +1 para notar emboscadas, −1 iniciativa" },
  paranoico: { deteccion: 4, lectura: 2, iniciativa: 0, presion: 1, nota: "+4 para notar emboscadas, +2 para leer planes, pero siempre tenso (una presión más)" },
  sereno: { deteccion: 0, lectura: 1, iniciativa: 0, presion: -1, nota: "una presión menos y +1 para leer planes" },
  cobarde: { deteccion: 2, lectura: 0, iniciativa: 0, presion: 1, nota: "siempre buscando el peligro (+2 para notar emboscadas), pero los nervios lo comen (una presión más)" },
  fanatico: { deteccion: -1, lectura: -2, iniciativa: 0, presion: -1, sinTerror: true, nota: "su fe no conoce el miedo (una presión menos, sin terror), pero no ve más allá (−1 y −2)" },
};
export const NOMBRES_PERSONALIDADES = Object.keys(PERSONALIDADES) as [string, ...string[]];

export const PLANES = {
  improvisado: { iniciativa: 1, sigilo: 0, cd: 0, nota: "+1 iniciativa al bando" },
  bueno: { iniciativa: 2, sigilo: 2, cd: 14, nota: "+2 iniciativa y sigilo; +1 a sus ataques en el primer asalto contra quien no lo lea (CD 14)" },
  brillante: { iniciativa: 4, sigilo: 4, cd: 18, nota: "+4 iniciativa y sigilo; ventaja en sus ataques del primer asalto contra quien no lo lea (CD 18)" },
} as const;
export type CalidadPlan = keyof typeof PLANES;
export const ALERTAS = { dormidos: 0, distraidos: -5, normal: 0, en_guardia: 5 } as const;
export type Alerta = keyof typeof ALERTAS;

export interface Tactica {
  /** Quienes tienden la emboscada o siguen el plan; el resto son sus rivales. */
  bando: string[];
  emboscada?: boolean;
  plan?: CalidadPlan;
  alerta?: Alerta;
}

/** PNJ sin ficha que entran en un combate (un capitán, unos bandidos…). */
export interface PnjCombate {
  nombre: string;
  bono_ataque: number;
  ca: number;
  des?: number;
  veterania?: Veterania;
  temple?: string;
  sab?: number;
  personalidad?: string[];
  /** Piezas de armadura que lleva (ver PIEZAS en armadura.ts). */
  armadura?: string[];
  /** Si se da, el programa lleva sus PV. */
  pv?: number;
  pv_max?: number;
}

export interface EstadoCombate {
  ronda: number;
  orden: { nombre: string; total: number }[];
  pnj: Record<string, PnjCombate>;
  /** Sorprendidos: no actúan en el primer asalto y se les ataca con ventaja. */
  sorprendidos?: string[];
  plan?: { bando: string[]; calidad: CalidadPlan; leido_por: string[] };
}

type Combatiente =
  | { tipo: "pj"; nombre: string; p: Personaje }
  | { tipo: "criatura"; nombre: string; j: EstadoJefe }
  | { tipo: "pnj"; nombre: string; n: PnjCombate };

const igual = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

function localizar(partida: Partida, nombre: string): Combatiente {
  const p = partida.personajes[nombre] ?? Object.values(partida.personajes).find((x) => igual(x.nombre, nombre));
  if (p) return { tipo: "pj", nombre: p.nombre, p };
  const jefes = Object.values(partida.jefes);
  const j = partida.jefes[nombre] ?? jefes.find((x) => igual(x.nombre, nombre)) ?? jefes.find((x) => x.nombre.toLowerCase().includes(nombre.toLowerCase()));
  if (j) return { tipo: "criatura", nombre: j.nombre, j };
  const pnjs = Object.values(partida.combate?.pnj ?? {});
  const n = pnjs.find((x) => igual(x.nombre, nombre));
  if (n) return { tipo: "pnj", nombre: n.nombre, n };
  throw new Error(
    `"${nombre}" no es un personaje, ni una criatura en escena, ni un PNJ del combate. Registra a los PNJ sin ficha en iniciativa (pnj) y a las criaturas con aparecer_criatura.`,
  );
}

const NO_MUERTO_PJ = /no-muerto|no muerto|retornad|cadáver andante/i;

function templeDe(c: Combatiente): string | undefined {
  if (c.tipo === "pj") return c.p.condiciones.some((x) => NO_MUERTO_PJ.test(x)) ? "no-muerto" : c.p.raza;
  if (c.tipo === "criatura") return c.j.definicion.temple;
  return c.n.temple;
}

function veteraniaCombatiente(c: Combatiente): Veterania {
  if (c.tipo === "pj") return veteraniaDe(c.p);
  if (c.tipo === "pnj") return c.n.veterania ?? "curtido";
  // Las criaturas ya llevan su pericia en el bonificador de su ficha: solo fallan seguro con un 1.
  return "veterano";
}

const desDeCriatura = (c: Criatura) => Number(/DES\s*(\d+)/i.exec(c.atributos)?.[1] ?? 10);
const sabDeCriatura = (c: Criatura) => Number(/SAB\s*(\d+)/i.exec(c.atributos)?.[1] ?? 10);

function personalidadDe(c: Combatiente): Personalidad[] {
  const lista = c.tipo === "pj" ? c.p.personalidad : c.tipo === "criatura" ? c.j.definicion.personalidad : c.n.personalidad;
  return (lista ?? []).map((x) => PERSONALIDADES[x.toLowerCase()]).filter(Boolean);
}
const suma = (ps: Personalidad[], k: "deteccion" | "lectura" | "iniciativa" | "presion" | "torpeza") => ps.reduce((s, p) => s + (p[k] ?? 0), 0);

/** Bonificador para notar emboscadas (sentidos) o leer planes (lectura). */
function bonoAlerta(c: Combatiente, que: "deteccion" | "lectura"): { bono: number; detalle: string } {
  const sab = c.tipo === "pj" ? valor(c.p, "sab") : c.tipo === "criatura" ? sabDeCriatura(c.j.definicion) : (c.n.sab ?? 10);
  const vet = c.tipo === "criatura" ? 0 : OFICIO[veteraniaCombatiente(c)].deteccion;
  const tp = que === "deteccion" ? (temple(templeDe(c)).deteccion ?? 0) : 0;
  const pers = suma(personalidadDe(c), que);
  const partes = [`SAB ${signo(mod(sab))}`, vet ? `oficio ${signo(vet)}` : "", tp ? `temple ${signo(tp)}` : "", pers ? `carácter ${signo(pers)}` : ""];
  return { bono: mod(sab) + vet + tp + pers, detalle: partes.filter(Boolean).join(", ") };
}

const nuncaSorprendido = (c: Combatiente) =>
  c.tipo === "criatura" && (!!c.j.definicion.presagios || c.j.definicion.rasgos.some((r) => /no puede ser sorprendid/i.test(r)));

function bonoIniciativa(c: Combatiente): { bono: number; modo: Modo; detalle: string } {
  const t = temple(templeDe(c));
  const of = c.tipo === "criatura" ? 0 : OFICIO[veteraniaCombatiente(c)].iniciativa;
  const estilo = c.tipo === "pj" ? (ESTILO_CLASE[c.p.clase] ?? SIN_ESTILO).iniciativa : 0;
  const des = c.tipo === "pj" ? valor(c.p, "des") : c.tipo === "criatura" ? desDeCriatura(c.j.definicion) : (c.n.des ?? 10);
  const presciencia = c.tipo === "criatura" && c.j.definicion.rasgos.some((r) => /ventaja en iniciativa/i.test(r));
  const pers = suma(personalidadDe(c), "iniciativa");
  const partes = [`DES ${signo(mod(des))}`, of ? `oficio ${signo(of)}` : "", t.iniciativa ? `temple ${signo(t.iniciativa)}` : "", estilo ? `clase ${signo(estilo)}` : "", pers ? `carácter ${signo(pers)}` : ""];
  return { bono: mod(des) + of + t.iniciativa + estilo + pers, modo: presciencia ? "ventaja" : "normal", detalle: partes.filter(Boolean).join(", ") };
}

export function tirarIniciativa(partida: Partida, nombres: string[], pnj: PnjCombate[], tactica?: Tactica): string {
  const combate: EstadoCombate = { ronda: 1, orden: [], pnj: {}, sorprendidos: [] };
  for (const n of pnj) combate.pnj[n.nombre] = { ...n, pv_max: n.pv_max ?? n.pv };
  partida.combate = combate;
  const todos = [...nombres, ...pnj.map((n) => n.nombre)].map((n) => localizar(partida, n));
  const lineas: string[] = [];

  // Bandos: quien tiende la emboscada o sigue el plan, y sus rivales.
  const enBando = (c: Combatiente) => !!tactica?.bando.some((b) => igual(b, c.nombre));
  if (tactica) {
    const fuera = tactica.bando.filter((b) => !todos.some((c) => igual(c.nombre, b)));
    if (fuera.length) throw new Error(`${fuera.join(", ")} no está entre los participantes del combate.`);
  }
  const bando = todos.filter(enBando);
  const rivales = todos.filter((c) => !enBando(c));
  const plan = tactica?.plan ? PLANES[tactica.plan] : undefined;

  // Emboscada: el sigilo del más torpe del bando contra la percepción de cada rival.
  if (tactica?.emboscada && bando.length) {
    const sigilos = bando.map((c) => {
      const des = c.tipo === "pj" ? valor(c.p, "des") : c.tipo === "criatura" ? desDeCriatura(c.j.definicion) : (c.n.des ?? 10);
      const of = c.tipo === "criatura" ? 0 : OFICIO[veteraniaCombatiente(c)].golpe;
      const clase = c.tipo === "pj" && /Degollador|Cazador/.test(c.p.clase) ? 2 : 0;
      const b = mod(des) + of + clase + (plan?.sigilo ?? 0);
      const t = tirar(`1d20${signo(b)}`);
      return { nombre: c.nombre, t };
    });
    const peor = sigilos.reduce((a, b) => (b.t.total < a.t.total ? b : a));
    lineas.push(`Emboscada — sigilo del bando: ${sigilos.map((x) => `${x.nombre} ${describir(x.t)}`).join("; ")}. Cuenta el más torpe: ${peor.nombre} (${peor.t.total}).`);
    const alerta = tactica.alerta ?? "normal";
    for (const r of rivales) {
      if (nuncaSorprendido(r)) {
        lineas.push(`${r.nombre}: no se le puede sorprender.`);
        continue;
      }
      const a = bonoAlerta(r, "deteccion");
      const extra = alerta === "dormidos" ? (r.tipo === "criatura" ? -5 : OFICIO[veteraniaCombatiente(r)].dormido) : ALERTAS[alerta];
      const pasiva = 10 + a.bono + extra;
      const sorprendido = peor.t.total > pasiva;
      if (sorprendido) combate.sorprendidos!.push(r.nombre);
      lineas.push(`${r.nombre}: percepción ${pasiva} [10, ${a.detalle}${extra ? `, ${alerta} ${signo(extra)}` : ""}] → ${sorprendido ? "SORPRENDIDO" : "lo ve venir"}`);
    }
  }

  // Plan: cada rival que no esté sorprendido puede leerlo.
  if (plan && tactica?.plan && plan.cd) {
    const leido: string[] = [];
    for (const r of rivales) {
      if (combate.sorprendidos!.includes(r.nombre)) continue;
      const a = bonoAlerta(r, "lectura");
      const t = tirar(`1d20${signo(a.bono)}`);
      const lee = t.total >= plan.cd;
      if (lee) leido.push(r.nombre);
      lineas.push(`${r.nombre} intenta leer el plan: ${describir(t)} [${a.detalle}] vs CD ${plan.cd} → ${lee ? "lo lee" : "cae en él"}`);
    }
    combate.plan = { bando: bando.map((c) => c.nombre), calidad: tactica.plan, leido_por: leido };
  }

  const tiradas = todos.map((c) => {
    const b = bonoIniciativa(c);
    const pl = plan && enBando(c) ? plan.iniciativa : 0;
    const t = tirar(`1d20${signo(b.bono + pl)}`, b.modo);
    lineas.push(`${c.nombre}: ${describir(t)}${b.modo === "ventaja" ? " (ventaja)" : ""} [${b.detalle}${pl ? `, plan ${signo(pl)}` : ""}]`);
    return { nombre: c.nombre, total: t.total, des: b.bono, sorprendido: combate.sorprendidos!.includes(c.nombre) };
  });
  // Los sorprendidos conservan su puesto: solo pierden el primer asalto.
  tiradas.sort((a, b) => b.total - a.total || b.des - a.des);
  combate.orden = tiradas.map(({ nombre, total }) => ({ nombre, total }));
  const sorpr = combate.sorprendidos!.length ? `\nSorprendidos (no actúan en el primer asalto; se les ataca con ventaja): ${combate.sorprendidos!.join(", ")}` : "";
  return `Iniciativa:\n${lineas.join("\n")}\nOrden: ${combate.orden.map((o) => `${o.nombre} (${o.total})`).join(" → ")}${sorpr}`;
}

/** Pasa al siguiente asalto: la sorpresa y el efecto del plan solo duran el primero. */
export function siguienteAsalto(partida: Partida): string {
  const c = partida.combate;
  if (!c) throw new Error("No hay ningún combate en curso: empieza con iniciativa.");
  c.ronda += 1;
  const fin = c.ronda === 2 && (c.sorprendidos?.length || c.plan) ? " Se acaban la sorpresa y la ventaja del plan." : "";
  c.sorprendidos = [];
  return `Asalto ${c.ronda}.${fin}`;
}

/** ¿Actúa el atacante antes que el objetivo en este combate? */
function actuaAntes(partida: Partida, a: string, b: string): boolean {
  const orden = partida.combate?.orden ?? [];
  const ia = orden.findIndex((o) => igual(o.nombre, a));
  const ib = orden.findIndex((o) => igual(o.nombre, b));
  return ia >= 0 && ib >= 0 && ia < ib;
}

const CONDICIONES_DESVENTAJA = /envenenad|asustad|cegad|jadeando|agotad|apresad/i;

export interface DatosAtaque {
  atacante: string;
  objetivo: string;
  arma?: string;
  dano?: string;
  a_distancia?: boolean;
  atributo?: "fue" | "des" | "car" | "sab" | "int";
  bono_arma?: number;
  bono?: number;
  ventaja?: boolean;
  desventaja?: boolean;
  ca?: number;
  tipo_dano?: TipoDano;
  /** Región a la que apunta, o "hueco" para buscar las juntas de la armadura. */
  apuntar?: Ubicacion | "hueco";
}

export interface ResultadoAtaque {
  texto: string;
  aviso: string;
  /** Criatura que ha caído con este ataque (para devolver lo que robó y sacarla de escena). */
  muerto?: string;
}

/** Bonificador de ataque de una criatura: el que se pasa o el del ataque nombrado (o el primero) de su ficha. */
function bonoCriatura(c: Criatura, arma?: string): number {
  const linea = (arma && c.ataques.find((a) => a.toLowerCase().includes(arma.toLowerCase()))) || c.ataques[0] || "";
  const m = /:\s*\+(\d+)/.exec(linea);
  if (!m) throw new Error(`No encuentro el bonificador de ataque de ${c.nombre}: pásalo en "bono".`);
  return Number(m[1]);
}

function doblarDados(expr: string): string {
  return expr.replace(/(\d*)d(\d+)/gi, (_, n, c) => `${(Number(n) || 1) * 2}d${c}`);
}

/** Tira una expresión de daño que puede sumar varios grupos de dados ("2d6+3+1d8"). */
function tirarDano(expr: string): { total: number; texto: string } {
  const partes = expr.replace(/\s+/g, "").replace(/-/g, "+-").split("+").filter(Boolean);
  let total = 0;
  const textos: string[] = [];
  for (const parte of partes) {
    if (/d/i.test(parte)) {
      const t = tirar(parte.replace(/^-/, ""));
      const v = parte.startsWith("-") ? -t.total : t.total;
      total += v;
      textos.push(`${parte}[${t.dados.join(",")}]`);
    } else {
      total += Number(parte);
      textos.push(parte);
    }
  }
  return { total: Math.max(0, total), texto: `${textos.join(" + ")} = ${Math.max(0, total)}` };
}

export function atacar(partida: Partida, d: DatosAtaque): ResultadoAtaque {
  const at = localizar(partida, d.atacante);
  const ob = localizar(partida, d.objetivo);
  const distancia = !!d.a_distancia;
  const vet = veteraniaCombatiente(at);
  const of = OFICIO[vet];
  const tp = temple(templeDe(at));
  const estilo = at.tipo === "pj" ? (ESTILO_CLASE[at.p.clase] ?? SIN_ESTILO) : SIN_ESTILO;
  const desglose: string[] = [];

  // Bonificador
  let bono: number;
  if (at.tipo === "pj") {
    const p = at.p;
    const attr = d.atributo ?? (distancia ? "des" : valor(p, "des") > valor(p, "fue") ? "des" : "fue");
    const mAttr = mod(valor(p, attr));
    const comp = competencia(p);
    const extraTemple = distancia ? tp.distancia : tp.cuerpo;
    const extraClase = distancia ? estilo.distancia : estilo.cuerpo;
    bono = mAttr + comp + of.golpe + extraTemple + extraClase + (d.bono_arma ?? 0);
    desglose.push(`${attr.toUpperCase()} ${signo(mAttr)}`, `competencia ${signo(comp)}`);
    if (of.golpe) desglose.push(`${vet} ${signo(of.golpe)}`);
    if (extraTemple) desglose.push(`raza ${signo(extraTemple)}`);
    if (extraClase) desglose.push(`clase ${signo(extraClase)}`);
    if (d.bono_arma) desglose.push(`arma ${signo(d.bono_arma)}`);
  } else if (at.tipo === "criatura") {
    bono = (d.bono ?? bonoCriatura(at.j.definicion, d.arma)) + (d.bono_arma ?? 0);
    desglose.push(`ataque ${signo(bono)}`);
  } else {
    bono = (d.bono ?? at.n.bono_ataque) + of.golpe + (distancia ? tp.distancia : tp.cuerpo) + (d.bono_arma ?? 0);
    desglose.push(`base ${signo(d.bono ?? at.n.bono_ataque)}`);
    if (of.golpe) desglose.push(`${vet} ${signo(of.golpe)}`);
    const extra = distancia ? tp.distancia : tp.cuerpo;
    if (extra) desglose.push(`temple ${signo(extra)}`);
  }

  // Defensa
  const ca = d.ca ?? (ob.tipo === "pj" ? ob.p.ca : ob.tipo === "criatura" ? ob.j.definicion.ca : ob.n.ca);

  // Ventaja y desventaja
  let ventaja = !!d.ventaja;
  let desventaja = !!d.desventaja;
  const motivos: string[] = [];
  if (at.tipo === "pj" && at.p.condiciones.some((c) => CONDICIONES_DESVENTAJA.test(c))) {
    desventaja = true;
    motivos.push(`desventaja por ${at.p.condiciones.filter((c) => CONDICIONES_DESVENTAJA.test(c)).join(", ")}`);
  }
  if (ob.tipo === "pj" && ob.p.condiciones.some((c) => /inconsciente|paralizad|derribad/i.test(c)) && !distancia) {
    ventaja = true;
    motivos.push("ventaja: el objetivo está en el suelo o indefenso");
  }
  const combate = partida.combate;
  const primerAsalto = combate?.ronda === 1;
  const sorprendido = (n: string) => primerAsalto && !!combate?.sorprendidos?.some((x) => igual(x, n));
  if (sorprendido(at.nombre)) throw new Error(`${at.nombre} está sorprendido: no puede actuar en el primer asalto. Cuando empiece el siguiente, usa siguiente_asalto.`);
  if (sorprendido(ob.nombre)) {
    ventaja = true;
    motivos.push(`ventaja: ${ob.nombre} está sorprendido`);
  }
  const plan = combate?.plan;
  if (primerAsalto && plan && plan.bando.some((x) => igual(x, at.nombre)) && !plan.bando.some((x) => igual(x, ob.nombre))) {
    if (plan.leido_por.some((x) => igual(x, ob.nombre))) motivos.push(`${ob.nombre} leyó el plan: no cae en él`);
    else if (plan.calidad === "brillante") {
      ventaja = true;
      motivos.push("ventaja: el plan funciona");
    } else if (plan.calidad === "bueno") {
      bono += 1;
      desglose.push("plan +1");
    }
  }
  const modo: Modo = ventaja && !desventaja ? "ventaja" : desventaja && !ventaja ? "desventaja" : "normal";

  // Apuntar: a una región concreta o a los huecos de la armadura (cuanto más oficio, menos cuesta).
  if (d.apuntar) {
    const castigo =
      d.apuntar === "hueco" ? (at.tipo === "criatura" ? -4 : { recluta: -6, curtido: -5, veterano: -4, leyenda: -3 }[vet]) : d.apuntar === "cabeza" || d.apuntar === "cuello" ? -4 : -2;
    bono += castigo;
    desglose.push(`apunta ${d.apuntar === "hueco" ? "a un hueco" : `a ${d.apuntar}`} ${signo(castigo)}`);
  }

  // Torpeza: cuanto menos oficio, más fácil enredarse… salvo si golpea antes que su rival.
  const primero = actuaAntes(partida, at.nombre, ob.nombre) || sorprendido(ob.nombre);
  const pers = personalidadDe(at);
  const torpezaBase = at.tipo === "criatura" ? 1 : of.torpeza;
  const torpeza = Math.max(1, (primero ? 1 : torpezaBase) + tp.torpeza + estilo.torpeza + suma(pers, "torpeza"));

  // Nervios: cada fuente de presión suma; cuánto pesan depende de la veteranía.
  const presiones: string[] = [];
  if (!primero) presiones.push("golpea después");
  const terrible = ob.tipo === "criatura" && (ob.j.definicion.categoria === "jefe" || ob.j.definicion.peligro >= 4);
  if (terrible && !pers.some((x) => x.sinTerror)) presiones.push("rival terrible");
  if (at.tipo === "pj" && at.p.pv < at.p.pv_max / 2) presiones.push("malherido");
  const presionCaracter = suma(pers, "presion");
  if (presionCaracter > 0) presiones.push("carácter tenso");
  const presion = Math.max(0, Math.min(4, presiones.length - (presionCaracter < 0 ? -presionCaracter : 0)));
  const nervios = at.tipo === "criatura" || tp.sinNervios ? 0 : of.nervios[presion];
  if (nervios) {
    bono += nervios;
    desglose.push(`nervios ${signo(nervios)} (${presiones.join(", ")})`);
  }

  let t = tirar(`1d20${signo(bono)}`, modo);
  let repetido = "";
  if (t.dados[0] === 1 && (of.repiteUno && at.tipo !== "criatura" || tp.repiteUno)) {
    const antes = describir(t);
    t = tirar(`1d20${signo(bono)}`, "normal");
    repetido = ` (repite el 1: ${antes})`;
  }
  const natural = t.dados[0];
  const umbralCritico = at.tipo === "criatura" ? 20 : of.critico;
  const margen = t.total - ca;

  let resultado: "torpeza" | "fallo" | "roce" | "impacto" | "critico";
  if (natural >= umbralCritico) resultado = "critico";
  else if (natural <= torpeza) resultado = "torpeza";
  else if (margen >= 0) resultado = "impacto";
  else if (at.tipo !== "criatura" && -margen <= of.roce) resultado = "roce";
  else resultado = "fallo";

  const lineas = [
    `${at.nombre}${at.tipo !== "criatura" ? ` (${vet})` : ""} ataca a ${ob.nombre}${d.arma ? ` con ${d.arma}` : ""}${distancia ? " a distancia" : ""}: ` +
      `${describir(t)}${modo !== "normal" ? ` (${modo})` : ""}${repetido} [${desglose.join(", ")}] vs CA ${ca}`,
  ];
  if (motivos.length) lineas.push(motivos.join("; "));
  if (primero && at.tipo !== "criatura" && torpezaBase > 1) lineas.push(`Actúa antes que ${ob.nombre}: no se enreda.`);
  if (torpeza > 1) lineas.push(`Torpeza con 1-${torpeza} natural.`);

  const etiquetas = {
    torpeza: "TORPEZA: falla y queda expuesto (el siguiente ataque contra él tiene ventaja, o se le cae el arma, o pierde pie: narra según su oficio)",
    fallo: "FALLO",
    roce: "ROCE: la experiencia lo salva; mitad de daño y sin herida",
    impacto: "IMPACTO",
    critico: "¡CRÍTICO! dados de daño dobles",
  } as const;
  lineas.push(`→ ${etiquetas[resultado]}`);

  let dano = 0;
  let muerto: string | undefined;
  if (d.dano && (resultado === "impacto" || resultado === "critico" || resultado === "roce")) {
    const r = tirarDano(resultado === "critico" ? doblarDados(d.dano) : d.dano);
    const bruto = resultado === "roce" ? Math.floor(r.total / 2) : r.total;
    lineas.push(`Daño: ${r.texto}${resultado === "roce" ? ` → la mitad, ${bruto}` : ""}`);

    // Armadura: dónde cae el golpe, qué lo cubre y cuánto penetra el arma.
    const lineaAtaque = at.tipo === "criatura" ? (d.arma && at.j.definicion.ataques.find((a) => a.toLowerCase().includes(d.arma!.toLowerCase()))) || at.j.definicion.ataques[0] || "" : "";
    const arma = reconocerArma(d.arma) ?? reconocerArma(lineaAtaque);
    const tipo = d.tipo_dano ?? arma?.tipo;
    const hueco = d.apuntar === "hueco";
    const ubicacion: Ubicacion =
      d.apuntar && d.apuntar !== "hueco" ? d.apuntar : hueco ? (["cuello", "torso", "abdomen", "cabeza"] as const)[tirar("1d4").total - 1] : tirarUbicacion();
    const piezas = ob.tipo === "pj" ? armaduraDe(ob.p).piezas : ob.tipo === "criatura" ? (ob.j.definicion.blindaje ?? []) : (ob.n.armadura ?? []);
    let reduccion = 0;
    let modGravedad = 0;
    if (tipo) {
      const region = regionDe(ubicacion);
      const prot = proteccion(piezas, region, tipo, hueco);
      const conMetal = proteccion(piezas, region, tipo).valor > proteccion(piezas, region, tipo, true).valor;
      const pen = (arma?.penetracion ?? 0) < 0 && !conMetal ? 0 : (arma?.penetracion ?? 0);
      reduccion = prot.valor < 0 ? prot.valor : Math.max(0, prot.valor - pen);
      modGravedad = -Math.floor(Math.max(0, reduccion) / 2) + (tipo === "contundente" ? (arma?.brutal ?? 0) : 0) + (hueco ? 2 : 0);
      const cubre = prot.piezas.length ? `${prot.piezas.join(" + ")} (${prot.valor} contra ${tipo})` : `nada lo cubre`;
      lineas.push(
        `Cae en ${ubicacion}${hueco ? " (por un hueco: el metal no cuenta)" : ""}: ${cubre}` +
          `${pen ? `; ${arma!.nombre} ${pen > 0 ? `penetra ${pen}` : `es ligera contra el metal (+${-pen})`}` : ""}` +
          ` → ${reduccion < 0 ? `vulnerable: +${-reduccion} de daño` : `frena ${reduccion}`}.`,
      );
    } else {
      lineas.push(`(Sin tipo de daño: no sé si es corte, punta o contundente; pasa tipo_dano o un arma reconocible para que cuente la armadura.)`);
    }
    dano = Math.max(0, bruto - reduccion);
    if (tipo && bruto > 0 && dano === 0) lineas.push(`La armadura aguanta: el golpe no atraviesa.`);

    if (ob.tipo === "criatura") {
      if (dano) lineas.push(danar(ob.j, dano));
      if (ob.j.pv <= 0) muerto = ob.j.nombre;
    } else if (ob.tipo === "pj") {
      const p = ob.p;
      p.pv = Math.max(0, p.pv - dano);
      if (dano) lineas.push(`${p.nombre}: −${dano} PV → ${p.pv}/${p.pv_max}.`);
      const causa =
        dano === 0 || resultado === "roce" ? (p.pv === 0 ? "cero_pv" : null) : resultado === "critico" ? "critico" : p.pv === 0 ? "cero_pv" : dano >= Math.ceil(p.pv_max / 2) ? "golpe_masivo" : null;
      if (causa) {
        const tipoHerida = tipo === "contundente" ? "contusion" : tipo === "corte" ? "corte" : arma?.nombre === "colmillos" ? "mordedura" : "perforacion";
        const podre = /podre/i.test(lineaAtaque) || (at.tipo === "criatura" && /no-muerto/.test(at.j.definicion.temple ?? "") && arma?.nombre === "colmillos");
        const cdPodre = Number(/cd_podre\s*(\d+)/i.exec(lineaAtaque)?.[1]) || undefined;
        lineas.push(
          `Herida (${causa}):\n` +
            infligir(p, {
              causa,
              tipo: tipoHerida,
              ubicacion,
              mod_gravedad: modGravedad,
              de_no_muerto: podre || undefined,
              cd_podre: cdPodre,
            }),
        );
      }
    } else if (dano) {
      if (ob.n.pv !== undefined) {
        ob.n.pv = Math.max(0, ob.n.pv - dano);
        lineas.push(`${ob.nombre}: −${dano} PV → ${ob.n.pv}/${ob.n.pv_max ?? "?"}${ob.n.pv === 0 ? " — CAE." : ""}`);
      } else lineas.push(`${ob.nombre} recibe ${dano} de daño (lleva tú sus PV).`);
    }
  } else if (resultado === "critico" && ob.tipo === "pj") {
    lineas.push(`Si el golpe hace daño, usa infligir_herida con causa "critico" para ${ob.nombre}.`);
  }

  const icono = resultado === "critico" ? "💥" : resultado === "impacto" ? "⚔️" : resultado === "roce" ? "🗡️" : "💨";
  const estadoObj = ob.tipo === "criatura" ? ` (${estadoTexto(ob.j)})` : ob.tipo === "pj" && dano ? ` (${ob.p.pv}/${ob.p.pv_max} PV)` : "";
  const aviso =
    `${icono} ${at.nombre} → ${ob.nombre}: ${resultado === "critico" ? "¡crítico!" : resultado === "torpeza" ? "torpeza" : resultado}` +
    `${ob.tipo === "criatura" ? "" : ` (${t.total} vs CA ${ca})`}${dano ? `, ${dano} de daño` : d.dano && (resultado === "impacto" || resultado === "critico") ? ", la armadura aguanta" : ""}${estadoObj}`;
  return { texto: lineas.join("\n"), aviso, muerto };
}

export const REGLAS_COMBATE = `## Combate (iniciativa y ataques los resuelve el programa)
- Al empezar un combate, iniciativa con todos: PJ, criaturas en escena y los PNJ sin ficha (pnj: nombre, bono_ataque, ca, des, sab, veterania, temple, personalidad). Guarda el orden; repítela solo en un combate nuevo.
- Cada ataque con armas (de PJ, criatura o PNJ) va con atacar. Si pasas dano (p. ej. "1d8+3", con el modificador ya sumado), se tira, pasa por la armadura y se aplica solo: a las criaturas en escena y a los PJ, con su herida si toca (no repitas infligir_herida). Los hechizos van con lanzar_hechizo.
- Veteranía (ponla en guardar_personaje según el trasfondo: quien lleva años en el oficio NO es recluta aunque sea nivel 1; sin ella se deduce del nivel). Los PNJ también la tienen: un capitán de la Compañía es veterano o leyenda, un miliciano es recluta.
${Object.entries(OFICIO).map(([k, o]) => `  - ${k}: ${o.descripcion}.`).join("\n")}
- Nervios: cada presión suma (golpear después que el rival, un rival terrible —jefe o peligro 4+—, estar malherido, un carácter tenso); cuánto restan depende de la veteranía (arriba). Actuar antes que el rival quita una presión y la torpeza extra. Los no-muertos no sienten nervios.
- Emboscadas y planes (iniciativa con tactica: bando, emboscada, plan, alerta de los rivales): el sigilo del más torpe del bando contra la percepción de cada rival (10 + SAB + oficio + sentidos + carácter; dormidos, distraídos o en guardia cuentan). A un veterano cuesta mucho más sorprenderlo. Los sorprendidos no actúan en el primer asalto y se les ataca con ventaja. Planes:
${Object.entries(PLANES).map(([k, p]) => `  - ${k}: ${p.nota}.`).join("\n")}
  Juzga tú la calidad del plan de los jugadores (o de los PNJ) por lo que han preparado. Al empezar cada asalto nuevo, siguiente_asalto.
- Personalidad (en guardar_personaje, en los PNJ y en las criaturas): 
${Object.entries(PERSONALIDADES).map(([k, p]) => `  - ${k}: ${p.nota}.`).join("\n")}
- Temple de cada raza o naturaleza (en las criaturas, campo temple de su ficha):
${Object.entries(TEMPLES).map(([k, t]) => `  - ${k}: ${t.nota}.`).join("\n")}
- Estilo de cada clase:
${Object.entries(ESTILO_CLASE).filter(([, e]) => e.nota).map(([k, e]) => `  - ${k}: ${e.nota}.`).join("\n")}
- Las criaturas usan el bonificador de su ficha (o "bono"), fallan seguro solo con un 1 y no rozan. Envenenado, asustado, cegado, jadeando, agotado o apresado dan desventaja al PJ que ataca.

${REGLAS_ARMADURA}`;
