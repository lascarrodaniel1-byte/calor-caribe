// Combate: iniciativa y ataques resueltos por el programa. La experiencia del
// combatiente (veteranía), su raza o naturaleza y su clase deciden lo fácil que
// es que falle: un recluta se enreda con su propia arma a menos que golpee
// primero; un veterano casi nunca falla del todo, y cuando falla aún roza.
// Los nervios crecen con la presión (golpear después, un monstruo terrible,
// estar malherido) y pesan mucho más en los novatos. Las emboscadas y los planes
// dan ventaja, pero a un veterano cuesta más sorprenderlo, y la personalidad
// (arrogancia, prudencia, impulsividad…) cambia lo fácil que es engañar a alguien.
import { tiene } from "./dotes_base.js";
import { danar, devolverRobos, estadoTexto, type Criatura, type EstadoJefe } from "./bestiario.js";
import { describir, tirar, type Modo } from "./dados.js";
import type { Partida, Personaje } from "./estado.js";
import { armaduraDe, proteccion, reconocerArma, regionDe, REGLAS_ARMADURA, type TipoDano } from "./armadura.js";
import { infligir, tirarUbicacion, type Ubicacion } from "./heridas.js";
import { competencia, mod, signo, valor } from "./reglas.js";
import { dadosCastigo, esCaballero, juramentoActivo } from "./juramento_base.js";
import { gastarReserva, usoDivino } from "./juramento.js";
import { autoManos, caEfectiva, propiedades } from "./manos.js";
import { esDegollador, ojosEnLaEspalda } from "./degollador_base.js";
import { esFlagelante, esquivaAutomatica, nivelDolor, pasoElusivoActivo } from "./flagelante_base.js";
import { selloDe } from "./segador_base.js";
import { danoEnSuelo, muerteInstantanea } from "./muerte.js";
import { pxCriatura, registrarBaja } from "./progresion.js";
import { ajusteAgua, estaSumergido } from "./agua.js";
import { ventajaMontada } from "./montura.js";
import { ajusteMar, ventajaNaval } from "./naves.js";
import { bloqueoDeSal } from "./sal.js";
import { efectos, mismaCondicion, reconocer, textoEfectos, nivelAgotamiento } from "./condiciones.js";

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
  "cazador de leyendas": { deteccion: 3, iniciativa: 3, cuerpo: 1, distancia: 1, torpeza: 0, nota: "oficio de cazar a los que ya nadie caza: +3 iniciativa, +3 para notar emboscadas, +1 a todo ataque" },
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
  /** Almas selladas por un Segador: poderes o rasgos que no puede usar. */
  sellos?: import("./segador_base.js").Sello[];
  bono_ataque: number;
  ca: number;
  des?: number;
  veterania?: Veterania;
  temple?: string;
  sab?: number;
  personalidad?: string[];
  /** Piezas de armadura que lleva (ver PIEZAS en armadura.ts). */
  armadura?: string[];
  /** Lucha del lado de los jugadores (un guardia que los acompaña). */
  aliado?: boolean;
  /** Si se da, el programa lleva sus PV. */
  pv?: number;
  pv_max?: number;
  /** Condiciones que sufre ahora (ver condiciones.ts). */
  condiciones?: string[];
  /** Marcas de Ceniza permanentes (las que deja la furia de un Berserker). */
  ceniza?: number;
}

/** Lo que cada combatiente ha hecho este asalto (acciones de combate y reacción). */
export interface EstadoTurno {
  /** Ya atacó este asalto con un arma ligera (habilita el ataque de la mano secundaria). */
  atacoLigero?: boolean;
  /** Qué acción adicional ha usado este asalto (solo una). */
  adicional?: string;
  /** Cambios de objeto en las manos este asalto (el primero es gratis). */
  interacciones?: number;
  /** Ya usó su reacción este asalto. */
  reaccion?: boolean;
  /** Esquivando: los ataques contra él tienen desventaja y tiene ventaja en salvaciones de DES. */
  esquiva?: boolean;
  /** Se retiró: su movimiento no provoca ataques de oportunidad. */
  retirada?: boolean;
  /** Corrió: movimiento doble (sin acción para atacar). */
  corrio?: boolean;
  /** Alguien lo ayudó: su próximo ataque (contra `contra`, si se dice) tiene ventaja. */
  ayuda?: { por: string; contra?: string };
  /** Flagelante: declaró su Paso elusivo (gastó su reacción): el siguiente ataque contra él se esquiva con una tirada. */
  pasoElusivo?: boolean;
  /** Segador: a quién hirió con la guadaña este asalto (su sangre está fresca para sellar un alma). */
  heridos?: string[];
  /** Flagelante: ya sacó provecho de la sangre de un enemigo este asalto (curación pasiva). */
  sangre?: boolean;
  /** Acción preparada: qué hará cuando ocurra el disparador (gasta su reacción). */
  preparada?: { disparador: string; accion: string };
}

export interface EstadoCombate {
  ronda: number;
  /** Acciones y reacciones por combatiente. */
  turnos?: Record<string, EstadoTurno>;
  orden: { nombre: string; total: number }[];
  pnj: Record<string, PnjCombate>;
  /** Sorprendidos: no actúan en el primer asalto y se les ataca con ventaja. */
  sorprendidos?: string[];
  /** Esgrimistas que ya usaron su ventaja de duelo en este combate. */
  duelos?: string[];
  plan?: { bando: string[]; calidad: CalidadPlan; leido_por: string[] };
}

export type Combatiente =
  | { tipo: "pj"; nombre: string; p: Personaje }
  | { tipo: "criatura"; nombre: string; j: EstadoJefe }
  | { tipo: "pnj"; nombre: string; n: PnjCombate };

export const igual = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

export function localizar(partida: Partida, nombre: string): Combatiente {
  const p = partida.personajes[nombre] ?? Object.values(partida.personajes).find((x) => igual(x.nombre, nombre));
  if (p) return { tipo: "pj", nombre: p.nombre, p };
  const jefes = Object.values(partida.jefes);
  const pnjs = Object.values(partida.combate?.pnj ?? {});
  // Primero los nombres exactos (de criaturas y de PNJ); la coincidencia parcial, al final.
  const j = partida.jefes[nombre] ?? jefes.find((x) => igual(x.nombre, nombre));
  if (j) return { tipo: "criatura", nombre: j.nombre, j };
  const n = pnjs.find((x) => igual(x.nombre, nombre));
  if (n) return { tipo: "pnj", nombre: n.nombre, n };
  const parcial = jefes.find((x) => x.nombre.toLowerCase().includes(nombre.toLowerCase()));
  if (parcial) return { tipo: "criatura", nombre: parcial.nombre, j: parcial };
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
  const ojos = que === "deteccion" && c.tipo === "pj" && ojosEnLaEspalda(c.p) ? 5 : 0; // Degollador nivel 8
  const partes = [`SAB ${signo(mod(sab))}`, vet ? `oficio ${signo(vet)}` : "", tp ? `temple ${signo(tp)}` : "", pers ? `carácter ${signo(pers)}` : "", ojos ? `ojos en la espalda ${signo(ojos)}` : ""];
  return { bono: mod(sab) + vet + tp + pers + ojos, detalle: partes.filter(Boolean).join(", ") };
}

const nuncaSorprendido = (c: Combatiente) =>
  c.tipo === "criatura" && (!!c.j.definicion.presagios || c.j.definicion.rasgos.some((r) => /no puede ser sorprendid/i.test(r)));

function bonoIniciativa(c: Combatiente): { bono: number; modo: Modo; detalle: string } {
  const t = temple(templeDe(c));
  const of = c.tipo === "criatura" ? 0 : OFICIO[veteraniaCombatiente(c)].iniciativa;
  const estilo = c.tipo === "pj" ? (ESTILO_CLASE[c.p.clase] ?? SIN_ESTILO).iniciativa : 0;
  const des = c.tipo === "pj" ? valor(c.p, "des") : c.tipo === "criatura" ? desDeCriatura(c.j.definicion) : (c.n.des ?? 10);
  const presciencia = (c.tipo === "criatura" && c.j.definicion.rasgos.some((r) => /ventaja en iniciativa/i.test(r))) || (c.tipo === "pj" && esDegollador(c.p) && c.p.nivel >= 3); // Filo del asesino
  const pers = suma(personalidadDe(c), "iniciativa");
  const partes = [`DES ${signo(mod(des))}`, of ? `oficio ${signo(of)}` : "", t.iniciativa ? `temple ${signo(t.iniciativa)}` : "", estilo ? `clase ${signo(estilo)}` : "", pers ? `carácter ${signo(pers)}` : ""];
  return { bono: mod(des) + of + t.iniciativa + estilo + pers, modo: presciencia ? "ventaja" : "normal", detalle: partes.filter(Boolean).join(", ") };
}

/** Si la iniciativa falla (un nombre que no existe, una táctica mal dada), el combate en curso se queda como estaba. */
export function tirarIniciativa(partida: Partida, nombres: string[], pnj: PnjCombate[], tactica?: Tactica): string {
  const previo = partida.combate;
  const copia = previo ? JSON.parse(JSON.stringify(previo)) : undefined;
  try { return tirarIniciativaInterna(partida, nombres, pnj, tactica); } catch (e) { partida.combate = copia ? previo : undefined; if (previo && copia) Object.assign(previo, copia); throw e; }
}

function tirarIniciativaInterna(partida: Partida, nombres: string[], pnj: PnjCombate[], tactica?: Tactica): string {
  const combate: EstadoCombate = { ronda: 1, orden: [], pnj: {}, sorprendidos: [] };
  for (const n of pnj) combate.pnj[n.nombre] = { ...n, pv_max: n.pv_max ?? n.pv };
  partida.combate = combate;
  const todos = [...nombres, ...pnj.map((n) => n.nombre)].map((n) => localizar(partida, n));
  const lineas: string[] = [];
  for (const cb of todos) if (cb.tipo === "pj") { const m = autoManos(cb.p); if (m) lineas.push(m); }

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

/** Suma combatientes a un combate en curso (refuerzos, una criatura que aparece): tiran su iniciativa y entran en el orden. */
/** Si falla, el orden y los PNJ del combate quedan como estaban. */
export function agregarAlCombate(partida: Partida, nombres: string[], pnj: PnjCombate[] = []): string {
  const c0 = partida.combate;
  const copia = c0 ? JSON.parse(JSON.stringify(c0)) : undefined;
  try { return agregarAlCombateInterno(partida, nombres, pnj); } catch (e) { if (c0 && copia) { for (const k of Object.keys(c0)) delete (c0 as never as Record<string, unknown>)[k]; Object.assign(c0, copia); } throw e; }
}

function agregarAlCombateInterno(partida: Partida, nombres: string[], pnj: PnjCombate[] = []): string {
  const combate = partida.combate;
  if (!combate) throw new Error("No hay ningún combate en curso: empieza con iniciativa.");
  for (const n of pnj) combate.pnj[n.nombre] ??= { ...n, pv_max: n.pv_max ?? n.pv };
  const nuevos = [...nombres, ...pnj.map((n) => n.nombre)].filter((n) => !combate.orden.some((o) => igual(o.nombre, n)));
  const lineas: string[] = [];
  for (const n of nuevos) {
    const cb = localizar(partida, n);
    const b = bonoIniciativa(cb);
    const t = tirar(`1d20${signo(b.bono)}`, b.modo);
    lineas.push(`${cb.nombre}: ${describir(t)} [${b.detalle}]`);
    const pos = combate.orden.findIndex((o) => o.total < t.total);
    combate.orden.splice(pos < 0 ? combate.orden.length : pos, 0, { nombre: cb.nombre, total: t.total });
  }
  if (!nuevos.length) return "Todos ya estaban en el orden de iniciativa.";
  return `Se suma al combate:\n${lineas.join("\n")}\nOrden: ${combate.orden.map((o) => `${o.nombre} (${o.total})`).join(" → ")}`;
}

/** Pasa al siguiente asalto: la sorpresa y el efecto del plan solo duran el primero. */
export function siguienteAsalto(partida: Partida): string {
  const c = partida.combate;
  if (!c) throw new Error("No hay ningún combate en curso: empieza con iniciativa.");
  c.ronda += 1;
  const fin = c.ronda === 2 && (c.sorprendidos?.length || c.plan) ? " Se acaban la sorpresa y la ventaja del plan." : "";
  c.sorprendidos = [];
  // Nuevo asalto: la reacción se recupera y lo que duraba "hasta su próximo turno" caduca.
  // Lo que dura «hasta su próximo turno» (esquivar, ayudar, preparar, retirarse, correr, paso elusivo) NO caduca aquí: caduca cuando ese combatiente actúa de nuevo.
  for (const t of Object.values(c.turnos ?? {})) { delete t.reaccion; delete t.atacoLigero; delete t.adicional; delete t.interacciones; delete t.sangre; delete t.heridos; }
  const activas = condicionesActivas(partida);
  return `Asalto ${c.ronda}.${fin}${activas.length ? `\nCondiciones activas (¿alguna debe terminar?):\n- ${activas.join("\n- ")}` : ""}`;
}

/** ¿Actúa el atacante antes que el objetivo en este combate? */
function actuaAntes(partida: Partida, a: string, b: string): boolean {
  const orden = partida.combate?.orden ?? [];
  const ia = orden.findIndex((o) => igual(o.nombre, a));
  const ib = orden.findIndex((o) => igual(o.nombre, b));
  return ia >= 0 && ib >= 0 && ia < ib;
}

const CONDICIONES_DESVENTAJA = /jadeando/i; // condición propia de la magia; el resto vive en condiciones.ts

/** Al acabar el combate caducan las condiciones pasajeras (agarrado, derribado, aturdido…); las que duran (veneno, petrificado, agotamiento…) se quedan. */
export function limpiarTrasCombate(partida: Partida): void {
  const pasajeras = new Set(["agarrado", "derribado", "retenido", "aturdido", "incapacitado", "asustado", "cegado", "ensordecido", "invisible", "hechizado"]);
  for (const p of Object.values(partida.personajes)) p.condiciones = p.condiciones.filter((x) => !pasajeras.has(reconocer(x)?.id ?? ""));
  for (const j of Object.values(partida.jefes)) j.condiciones = [];
}

/** Por qué un combatiente no puede actuar ni reaccionar (null = puede). */
export function puedeActuar(c: Combatiente): string | null {
  const e = efectos(condsDe(c));
  if (c.tipo === "pj" && c.p.condiciones.includes("muerto")) return `${c.nombre} está muerto`;
  if (c.tipo === "pj" && c.p.pv <= 0) return `${c.nombre} está a 0 PV`;
  if (c.tipo === "criatura" && c.j.pv <= 0) return `${c.nombre} ha caído`;
  if (c.tipo === "pnj" && c.n.pv !== undefined && c.n.pv <= 0) return `${c.nombre} ha caído`;
  if (e.incapacitado) return `${c.nombre} está ${e.motivos.join(", ")}: no puede actuar ni reaccionar`;
  if (e.agotamiento >= 6) return `${c.nombre} ha muerto de agotamiento`;
  return null;
}

/** Una criatura que ha muerto sale de escena: se devuelve lo que robó y se quita del orden de iniciativa. */
export function retirarCaido(partida: Partida, j: EstadoJefe): string[] {
  const devueltos = devolverRobos(partida, j);
  registrarBaja(partida, j.nombre, pxCriatura(j.definicion)); // su experiencia se reparte al cerrar el combate
  delete partida.jefes[j.nombre];
  if (partida.combate) partida.combate.orden = partida.combate.orden.filter((o) => !igual(o.nombre, j.nombre));
  return devueltos;
}

export function condsDe(c: Combatiente): string[] {
  return c.tipo === "pj" ? c.p.condiciones : c.tipo === "criatura" ? (c.j.condiciones ??= []) : (c.n.condiciones ??= []);
}

/** Aplica, quita o consulta una condición de un personaje, criatura o PNJ en combate. */
export function turnoDe(partida: Partida, nombre: string): EstadoTurno {
  const c = partida.combate;
  if (!c) return {};
  c.turnos ??= {};
  const clave = Object.keys(c.turnos).find((k) => igual(k, nombre)) ?? nombre;
  return (c.turnos[clave] ??= {});
}

export function aplicarCondicion(
  partida: Partida,
  d: { objetivo: string; accion: "aplicar" | "quitar" | "ver"; condicion?: string; nota?: string; nivel?: number },
): string {
  const c = localizar(partida, d.objetivo);
  const lista = condsDe(c);
  if (d.accion === "ver") {
    const t = textoEfectos(lista);
    return `${c.nombre}: ${lista.length ? lista.join(", ") : "sin condiciones"}${t ? `\n${t}` : ""}`;
  }
  if (!d.condicion) throw new Error("Di qué condición (p. ej. paralizado, derribado, agotamiento).");
  if (d.accion === "quitar") {
    const antes = lista.length;
    const resto = lista.filter((x) => !mismaCondicion(x, d.condicion!) && !x.toLowerCase().includes(d.condicion!.toLowerCase()));
    lista.splice(0, lista.length, ...resto);
    return lista.length === antes ? `${c.nombre} no tenía «${d.condicion}».` : `${c.nombre} ya no está ${d.condicion}.`;
  }
  const cat = reconocer(d.condicion);
  const esAgot = /agotamiento/i.test(d.condicion);
  let texto = d.condicion;
  if (esAgot) {
    const nuevo = Math.min(6, d.nivel ?? (nivelAgotamiento(lista) + 1));
    const resto = lista.filter((x) => !/agotamiento/i.test(x));
    lista.splice(0, lista.length, ...resto);
    texto = `agotamiento ${nuevo}`;
    if (nuevo >= 6) {
      if (c.tipo === "pj") { c.p.pv = 0; if (!c.p.condiciones.includes("muerto")) c.p.condiciones.push("muerto"); }
      else if (c.tipo === "criatura") { c.j.pv = 0; retirarCaido(partida, c.j); }
    }
  } else if (lista.some((x) => mismaCondicion(x, d.condicion!))) {
    return `${c.nombre} ya está ${cat?.nombre ?? d.condicion}.`;
  }
  if (d.nota) texto += ` (${d.nota})`;
  lista.push(texto);
  // Quien queda incapacitado suelta a todos los que tenía agarrados.
  const soltados = cat?.incapacitado ? soltarAgarrados(partida, c.nombre) : [];
  const t = textoEfectos([texto]) + (soltados.length ? `${textoEfectos([texto]) ? "\n" : ""}${c.nombre} suelta a ${soltados.join(", ")}.` : "");
  return `${c.nombre}: ${texto}.${t ? `\nEfecto: ${t}` : cat ? "" : "\n(No está en el catálogo: es texto libre, sin efecto automático.)"}${esAgot && nivelAgotamiento(lista) >= 6 ? "\n☠ Agotamiento 6: muere." : ""}`;
}

/** Quita «agarrado (por X)» / «agarrado (cadenas de X)» de todos los que tenía agarrados X. */
export function soltarAgarrados(partida: Partida, agarrador: string): string[] {
  const out: string[] = [];
  const quitar = (nombre: string, lista: string[] | undefined) => {
    if (!lista) return;
    const resto = lista.filter((x) => !(reconocer(x)?.id === "agarrado" && new RegExp(`(?:por|cadenas de) ${agarrador.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\)`, "i").test(x)));
    if (resto.length !== lista.length) { lista.splice(0, lista.length, ...resto); out.push(nombre); }
  };
  for (const p of Object.values(partida.personajes)) quitar(p.nombre, p.condiciones);
  for (const j of Object.values(partida.jefes)) quitar(j.nombre, j.condiciones);
  for (const n of Object.values(partida.combate?.pnj ?? {})) quitar(n.nombre, n.condiciones);
  return out;
}

/** Condiciones activas de todos los presentes en el combate (para recordarlas al empezar cada asalto). */
export function condicionesActivas(partida: Partida): string[] {
  const out: string[] = [];
  const vistos = new Set<string>();
  const poner = (nombre: string, conds: string[]) => {
    const e = efectos(conds);
    if (!conds.length || vistos.has(nombre)) return;
    vistos.add(nombre);
    out.push(`${nombre}: ${conds.join(", ")}${e.incapacitado ? " (no actúa)" : ""}`);
  };
  for (const p of Object.values(partida.personajes)) poner(p.nombre, p.condiciones.filter((x) => x !== "muerto"));
  for (const j of Object.values(partida.jefes)) if (j.pv > 0) poner(j.nombre, j.condiciones ?? []);
  for (const n of Object.values(partida.combate?.pnj ?? {})) poner(n.nombre, n.condiciones ?? []);
  return out;
}

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
  /** Cobertura del objetivo: media (+2 CA), tres_cuartos (+5) o total (no se le puede atacar). */
  cobertura?: "media" | "tres_cuartos" | "total";
  /** Castigo divino del Caballero Juramentado (nivel 2+): gasta 5 PV de su reserva y añade dados de daño radiante. */
  castigo?: boolean;
  /** Es un ataque hecho como reacción (en turno ajeno): no cuenta como su turno. */
  reaccion?: boolean;
  /** Pelea con dos armas: ataca con el arma ligera de la mano secundaria (acción adicional). */
  mano_secundaria?: boolean;
  /** Estilo de lucha con arma a dos manos: repite los 1 y 2 de los dados de daño. */
  repetir_bajos?: boolean;
  /** Barbero-Cirujano: golpea un nervio (brazo, pierna o columna) en lugar de buscar una herida: puede incapacitar. */
  nervio?: "brazo" | "pierna" | "columna";
  /** Cerbatana del Degollador: qué dardo sopla (por defecto, uno impregnado si tiene). */
  dardo?: "sano" | "impregnado";
  /** PNJ o criatura que combate sobre la cubierta de una nave (los PJ ya lo saben por estar a bordo). */
  en_cubierta?: boolean;
  /** Golpe demoledor (dote): con arma pesada, −5 al ataque y +10 al daño. */
  golpe_demoledor?: boolean;
  /** Esgrimista (dote): es un duelo uno contra uno: ventaja en su primer ataque del combate. */
  duelo?: boolean;
}

export interface ResultadoAtaque {
  texto: string;
  aviso: string;
  /** Criatura que ha caído con este ataque (para devolver lo que robó y sacarla de escena). */
  muerto?: string;
  /** Cómo salió la tirada y cuánto daño pasó la armadura (para efectos que dependen de herir: dardos con veneno). */
  resultado?: "torpeza" | "fallo" | "roce" | "impacto" | "critico";
  dano?: number;
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
function tirarDano(expr: string, repetirBajos = false): { total: number; texto: string } {
  const partes = expr.replace(/\s+/g, "").replace(/-/g, "+-").split("+").filter(Boolean);
  let total = 0;
  const textos: string[] = [];
  for (const parte of partes) {
    if (/d/i.test(parte)) {
      let t = tirar(parte.replace(/^-/, ""));
      if (repetirBajos && !parte.startsWith("-") && t.dados.some((x) => x <= 2)) {
        // Estilo con arma a dos manos: solo se repiten los dados que sacaron 1 o 2 (y se queda con el nuevo resultado).
        const caras = Number(/d(\d+)/i.exec(parte)?.[1] ?? 6);
        const nuevosDados = t.dados.map((x) => (x <= 2 ? tirar(`1d${caras}`).dados[0] : x));
        textos.push(`(repite ${t.dados.filter((x) => x <= 2).length} dado(s) de ${parte}[${t.dados.join(",")}])`);
        const modif = Number(/([+-]\d+)$/.exec(parte)?.[1] ?? 0);
        t = { ...t, dados: nuevosDados, total: nuevosDados.reduce((a, b) => a + b, 0) + modif };
      }
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
  if (d.dano && !/^[0-9dD+\-\s]+$/.test(d.dano)) throw new Error(`Daño no válido «${d.dano}»: usa solo dados y números, como «1d8+3» o «2d6+4+1d6» (el tipo de daño va en tipo_dano, no en el texto).`);
  const at = localizar(partida, d.atacante);
  const ob = localizar(partida, d.objetivo);
  if (ob.tipo === "pj" && ob.p.condiciones.includes("muerto")) throw new Error(`${ob.nombre} ya está muerto: no se le puede atacar.`);
  if (ob.tipo === "pnj" && ob.n.pv !== undefined && ob.n.pv <= 0) throw new Error(`${ob.nombre} ya ha caído (0 PV): no se le puede atacar.`);
  const distancia = !!d.a_distancia;
  const sal = bloqueoDeSal(partida, at, ob, distancia);
  if (sal) return { texto: sal, aviso: sal, resultado: "fallo" };
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

  if (d.golpe_demoledor) {
    if (at.tipo !== "pj" || !tiene(at.p, "golpe_demoledor")) throw new Error(`${at.nombre} no tiene la dote Golpe demoledor.`);
    const arma = propiedades(d.arma ?? at.p.manos?.principal);
    if (!(arma?.pesada || arma?.dosManos || at.p.manos?.dosManos)) throw new Error("Golpe demoledor pide un arma pesada o a dos manos.");
    if (!d.dano) throw new Error("Golpe demoledor suma +10 al daño: pasa dano.");
    bono -= 5; desglose.push("golpe demoledor −5");
    d = { ...d, dano: `${d.dano}+10` };
  }

  // Defensa
  if (d.cobertura === "total") throw new Error(`${ob.nombre} tiene cobertura total: no se le puede atacar directamente (rodéalo, destruye la cobertura o usa un efecto de área).`);
  const cobBono = d.cobertura === "media" ? 2 : d.cobertura === "tres_cuartos" ? 5 : 0;
  const ca = cobBono + (d.ca ?? (ob.tipo === "pj" ? caEfectiva(ob.p) : ob.tipo === "criatura" ? ob.j.definicion.ca : ob.n.ca));

  // Ventaja y desventaja
  let ventaja = !!d.ventaja;
  let desventaja = !!d.desventaja;
  const motivos: string[] = [];
  const combate = partida.combate;
  const primerAsalto = combate?.ronda === 1;
  const sorprendido = (n: string) => primerAsalto && !!combate?.sorprendidos?.some((x) => igual(x, n));
  // Primero las validaciones: si el ataque no puede hacerse, no se gasta nada (ni la ayuda ni la esquiva).
  if (d.castigo) {
    if (at.tipo !== "pj" || !esCaballero(at.p)) throw new Error("El castigo divino es solo del Caballero Juramentado.");
    if (at.p.nivel < 2) throw new Error(`${at.nombre} aún no tiene el castigo divino (nivel 2).`);
    if (selloDe(at.p.sellos, "Castigo divino")) throw new Error(`${at.nombre} tiene sellado su castigo divino (su alma está en manos de un Segador): no puede usarlo.`);
    if (!d.dano) throw new Error("El castigo divino suma dados al daño del ataque: pasa dano.");
    if (!juramentoActivo(at.p)) throw new Error(`${at.nombre} no tiene poder: ${at.p.juramento ? "su juramento está roto o perdido" : "aún no ha jurado"}.`);
    if ((at.p.juramento?.reserva ?? 0) < 5) throw new Error(`${at.nombre} no tiene 5 PV en su reserva de imposición de manos para el castigo divino.`);
  }
  const noPuede = puedeActuar(at);
  if (noPuede) throw new Error(`${noPuede}: no puede atacar.`);
  if (sorprendido(at.nombre)) throw new Error(`${at.nombre} está sorprendido: no puede actuar en el primer asalto. Cuando empiece el siguiente, usa siguiente_asalto.`);
  const efAt = efectos(condsDe(at));
  if (cobBono) motivos.push(`${ob.nombre} tiene cobertura ${d.cobertura === "media" ? "media (+2 CA)" : "de tres cuartos (+5 CA)"}`);
  const efOb = efectos(condsDe(ob));
  // Cada fuente cuenta por separado: cualquier ventaja y cualquier desventaja, de donde vengan, se anulan al final.
  if (efAt.atacaD) { desventaja = true; motivos.push(`desventaja por ${efAt.motivos.join(", ")}`); }
  if (efAt.atacaV) { ventaja = true; motivos.push(`ventaja: ${efAt.motivos.join(", ")}`); }
  if (at.tipo === "pj" && at.p.condiciones.some((c) => CONDICIONES_DESVENTAJA.test(c))) {
    desventaja = true;
    motivos.push(`desventaja por ${at.p.condiciones.filter((c) => CONDICIONES_DESVENTAJA.test(c)).join(", ")}`);
  }
  const tAt = turnoDe(partida, at.nombre);
  const tOb = turnoDe(partida, ob.nombre);
  // Empieza su turno: lo que hizo en el anterior (esquivar, retirarse, correr) ya no vale.
  if (!d.reaccion) { if (tAt.adicional !== "esquivar") tAt.esquiva = false; tAt.retirada = false; tAt.corrio = false; tAt.pasoElusivo = false; delete tAt.preparada; } // la esquiva del Degollador (acción adicional) no se pierde al atacar
  if (tAt.ayuda && (!tAt.ayuda.contra || igual(tAt.ayuda.contra, ob.nombre))) {
    ventaja = true;
    motivos.push(`ventaja: lo ayuda ${tAt.ayuda.por}`);
    delete tAt.ayuda;
  }
  if (tOb.esquiva && !efOb.incapacitado && efAt.ids.indexOf("cegado") < 0) {
    desventaja = true;
    motivos.push(`desventaja: ${ob.nombre} esquiva`);
  }
  if (distancia ? efOb.distV : efOb.cuerpoV) { ventaja = true; motivos.push(`ventaja: ${ob.nombre} está ${efOb.motivos.join(", ")}`); }
  if (distancia ? efOb.distD : efOb.cuerpoD) { desventaja = true; motivos.push(`desventaja: ${ob.nombre} está ${efOb.motivos.join(", ")}`); }
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
  // El entorno: bajo el agua, a caballo y sobre la cubierta de una nave.
  const aguaAj = ajusteAgua(estaSumergido(condsDe(at)), condsDe(at).some((c) => /nadador/i.test(c)) || (at.tipo === "pj" && tiene(at.p, "marinero")), distancia, d.arma);
  if (aguaAj.desventaja) { desventaja = true; motivos.push(aguaAj.desventaja); }
  const monta = ventajaMontada(partida, at.nombre, ob.nombre, distancia);
  if (monta) { ventaja = true; motivos.push(monta); }
  if (d.duelo && at.tipo === "pj" && tiene(at.p, "esgrimista") && !distancia) {
    const usados = (combate ? (combate.duelos ??= []) : []);
    if (!usados.some((x) => igual(x, at.nombre))) { ventaja = true; usados.push(at.nombre); motivos.push("ventaja: duelo (Esgrimista, primer ataque)"); }
  }
  const naval = ventajaNaval(partida, at.nombre, d.arma, distancia, d.en_cubierta);
  if (naval) { ventaja = true; motivos.push(naval); }
  const mar = ajusteMar(partida, at.nombre, distancia);
  if (mar) { desventaja = true; motivos.push(mar); }
  const modo: Modo = ventaja && !desventaja ? "ventaja" : desventaja && !ventaja ? "desventaja" : "normal";

  // Apuntar: a una región concreta o a los huecos de la armadura (cuanto más oficio, menos cuesta).
  if (d.apuntar) {
    const castigo =
      d.apuntar === "hueco" ? (at.tipo === "criatura" ? -4 : { recluta: -6, curtido: -5, veterano: -4, leyenda: -3 }[vet]) : d.apuntar === "cabeza" || d.apuntar === "cuello" ? -4 : -2;
    const anatomia = at.tipo === "pj" && at.p.clase === "Barbero-Cirujano"; // conoce el cuerpo: apuntar le cuesta la mitad
    const costo = anatomia ? Math.trunc(castigo / 2) : castigo;
    bono += costo;
    desglose.push(`apunta ${d.apuntar === "hueco" ? "a un hueco" : `a ${d.apuntar}`} ${signo(costo)}${anatomia ? " (anatomía)" : ""}`);
  }

  // Barbero-Cirujano: golpear un nervio exige precisión (brazo y pierna −2, columna −3, ya con su anatomía).
  if (d.nervio) {
    const c = d.nervio === "columna" ? -3 : -2;
    bono += c;
    desglose.push(`apunta al nervio (${d.nervio}) ${signo(c)}`);
  }

  // Torpeza: cuanto menos oficio, más fácil enredarse… salvo si golpea antes que su rival.
  const primero = actuaAntes(partida, at.nombre, ob.nombre) || sorprendido(ob.nombre);
  const pers = personalidadDe(at);
  const torpezaBase = at.tipo === "criatura" ? 1 : of.torpeza;
  // Flagelante: el dolor no lo entorpece (nunca tiene más torpeza que el 1 natural).
  const sinDolor = at.tipo === "pj" && esFlagelante(at.p);
  const torpeza = sinDolor ? 1 : Math.max(1, (primero ? 1 : torpezaBase) + tp.torpeza + estilo.torpeza + suma(pers, "torpeza"));

  // Nervios: cada fuente de presión suma; cuánto pesan depende de la veteranía.
  const presiones: string[] = [];
  if (!primero) presiones.push("golpea después");
  const terrible = ob.tipo === "criatura" && (ob.j.definicion.categoria === "jefe" || ob.j.definicion.peligro >= 4);
  if (terrible && !pers.some((x) => x.sinTerror)) presiones.push("rival terrible");
  if (at.tipo === "pj" && at.p.pv < at.p.pv_max / 2 && !sinDolor) presiones.push("malherido"); // al Flagelante el dolor no lo achica
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
  else if (efOb.critCuerpo && !distancia && natural > torpeza && t.total >= ca) resultado = "critico"; // paralizado o inconsciente, a quemarropa
  else if (natural <= torpeza) resultado = "torpeza";
  else if (margen >= 0) resultado = "impacto";
  else if (at.tipo !== "criatura" && -margen <= of.roce) resultado = "roce";
  else resultado = "fallo";

  // Flagelante (nivel 5): Paso elusivo. Con el dolor al máximo es una esquiva automática que no falla nunca; con menos, si la
  // declaró (herramienta paso_elusivo), tira Acrobacias contra el total del ataque. Gasta su reacción; no sorprendido ni incapacitado.
  let notaElusivo = "";
  if (ob.tipo === "pj" && pasoElusivoActivo(ob.p) && combate && !efOb.incapacitado && !sorprendido(ob.nombre) && ob.p.pv > 0 && ["impacto", "critico", "roce"].includes(resultado)) {
    if (esquivaAutomatica(ob.p) && !tOb.reaccion) {
      tOb.reaccion = true;
      resultado = "fallo";
      notaElusivo = `Esquiva automática: ${ob.nombre} tiene el dolor al máximo (4/4) y se aparta del golpe sin fallar. Gasta su reacción.`;
    } else if (tOb.pasoElusivo) {
      tOb.pasoElusivo = false;
      const e = tirar(`1d20${signo(mod(valor(ob.p, "des")) + competencia(ob.p))}`);
      if (e.total >= t.total) { resultado = "fallo"; notaElusivo = `Paso elusivo: ${ob.nombre} tira Acrobacias ${describir(e)} contra el ataque (${t.total}) y se aparta.`; }
      else notaElusivo = `Paso elusivo: ${ob.nombre} tira Acrobacias ${describir(e)} contra el ataque (${t.total}), pero no llega a tiempo.`;
    }
  }

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
  if (notaElusivo) lineas.push(notaElusivo);

  let dano = 0;
  let muerto: string | undefined;
  if (d.dano && (resultado === "impacto" || resultado === "critico" || resultado === "roce")) {
    // En furia, +2 al daño cuerpo a cuerpo.
    const furiaMas = at.tipo === "pj" && at.p.furia?.activa && !distancia ? 2 : 0;
    // Castigo divino: dados de daño radiante (más contra no-muertos y malditos); gasta 5 PV de la reserva al impactar.
    let castigoStr = "";
    if (d.castigo && at.tipo === "pj") {
      const maldito = ob.tipo === "criatura" && /no-muerto|vampiro|espectro/i.test(`${ob.j.definicion.temple ?? ""} ${ob.j.definicion.nombre}`);
      const descanso = maldito && at.p.nivel >= 3 && at.p.juramento?.votos.includes("descanso");
      castigoStr = `+${dadosCastigo(at.p) + (maldito ? 1 : 0)}d8${descanso ? "+1d6" : ""}`;
      gastarReserva(at.p, 5);
      const uso = usoDivino(at.p);
      lineas.push(`☀ Castigo divino: +${castigoStr.slice(1)} de daño radiante${maldito ? " (contra lo maldito, un dado más)" : ""}; gasta 5 PV de su reserva (${at.p.juramento!.reserva}). ${uso}`);
    }
    const r = tirarDano((resultado === "critico" ? doblarDados(d.dano + castigoStr) : d.dano + castigoStr) + (furiaMas ? `+${furiaMas}` : ""), !!d.repetir_bajos);
    if (furiaMas) lineas.push("🔥 Furia: +2 al daño cuerpo a cuerpo.");
    const bruto = resultado === "roce" ? Math.floor(r.total / 2) : r.total;
    lineas.push(`Daño: ${r.texto}${resultado === "roce" ? ` → la mitad, ${bruto}` : ""}`);

    // Armadura: dónde cae el golpe, qué lo cubre y cuánto penetra el arma.
    const lineaAtaque = at.tipo === "criatura" ? (d.arma && at.j.definicion.ataques.find((a) => a.toLowerCase().includes(d.arma!.toLowerCase()))) || at.j.definicion.ataques[0] || "" : "";
    // Sin arma nombrada, la primera del inventario del PJ.
    const delInventario = !d.arma && at.tipo === "pj" ? at.p.inventario.find((x) => reconocerArma(x)) : undefined;
    const arma = reconocerArma(d.arma) ?? reconocerArma(lineaAtaque) ?? reconocerArma(delInventario);
    if (delInventario && !d.tipo_dano) lineas.push(`(Arma por defecto: ${delInventario}.)`);
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
    if (ob.tipo === "pj" && ob.p.furia?.activa && dano > 0 && (!tipo || ["corte", "punta", "contundente"].includes(tipo as string))) {
      const antes = dano;
      dano = Math.floor(dano / 2);
      lineas.push(`🔥 Furia: resiste el daño físico (${antes} → ${dano}).`);
    }
    if (tipo && bruto > 0 && dano === 0) lineas.push(`La armadura aguanta: el golpe no atraviesa.`);
    // Quien duerme despierta al recibir daño.
    if (dano > 0) {
      const lista = condsDe(ob);
      const dormidas = lista.filter((x) => /^dormid[oa]/i.test(x));
      if (dormidas.length) { lista.splice(0, lista.length, ...lista.filter((x) => !dormidas.includes(x))); lineas.push(`${ob.nombre} despierta con el golpe.`); }
    }

    if (ob.tipo === "criatura") {
      if (dano) lineas.push(danar(ob.j, dano));
      if (ob.j.pv <= 0) muerto = ob.j.nombre;
    } else if (ob.tipo === "pj") {
      const p = ob.p;
      const estabaEnSuelo = p.pv <= 0;
      const pvAntes = p.pv;
      p.pv = Math.max(0, p.pv - dano);
      if (dano) lineas.push(`${p.nombre}: −${dano} PV → ${p.pv}/${p.pv_max}.`);
      if (estabaEnSuelo && dano > 0) {
        const t = danoEnSuelo(p, dano, resultado === "critico");
        if (t) lineas.push(t);
      } else {
        const mi = muerteInstantanea(p, pvAntes, dano);
        if (mi) lineas.push(mi);
      }
      const causa =
        dano === 0 || resultado === "roce" ? (p.pv === 0 ? "cero_pv" : null) : resultado === "critico" ? "critico" : p.pv === 0 ? "cero_pv" : dano >= Math.ceil(p.pv_max / 2) ? "golpe_masivo" : null;
      if (causa && !p.condiciones.includes("muerto")) {
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
  let aviso =
    `${icono} ${at.nombre} → ${ob.nombre}: ${resultado === "critico" ? "¡crítico!" : resultado === "torpeza" ? "torpeza" : resultado}` +
    `${ob.tipo === "criatura" ? "" : ` (${t.total} vs CA ${ca})`}${dano ? `, ${dano} de daño` : d.dano && (resultado === "impacto" || resultado === "critico") ? ", la armadura aguanta" : ""}${estadoObj}`;
  // La furia deja marcas de Ceniza —permanentes— en todo el que hiere (una por individuo y furia); si el herido es otro
  // personaje, el propio Berserker carga también con una.
  if (at.tipo === "pj" && at.p.furia?.activa && dano > 0 && ob.nombre !== at.nombre) {
    const f = (at.p.furia.marcados ??= []);
    if (!f.some((x) => igual(x, ob.nombre))) {
      f.push(ob.nombre);
      let cuenta: number;
      if (ob.tipo === "pj") { ob.p.ceniza += 1; ob.p.ceniza_fija = (ob.p.ceniza_fija ?? 0) + 1; cuenta = ob.p.ceniza; }
      else if (ob.tipo === "criatura") cuenta = ob.j.ceniza = (ob.j.ceniza ?? 0) + 1;
      else cuenta = ob.n.ceniza = (ob.n.ceniza ?? 0) + 1;
      let m = `🩶 Marca de Ceniza: la furia deja ceniza en la piel de ${ob.nombre} (${cuenta}); no se quita.`;
      if (ob.tipo === "pj") {
        at.p.ceniza += 1;
        at.p.ceniza_fija = (at.p.ceniza_fija ?? 0) + 1;
        m += ` ${at.nombre} carga también con una (${at.p.ceniza}).`;
      }
      lineas.push(m);
      aviso += `\n${m}`;
    }
  }
  // Senda de la Ceniza (nivel 3+): quien golpea cuerpo a cuerpo a un berserker en furia se quema.
  if (ob.tipo === "pj" && ob.p.furia?.activa && ob.p.nivel >= 3 && !distancia && (resultado === "impacto" || resultado === "critico")) {
    const f = tirar("1d4").total;
    if (at.tipo === "pj") at.p.pv = Math.max(0, at.p.pv - f);
    else if (at.tipo === "criatura") { danar(at.j, f); if (at.j.pv <= 0 && !muerto) muerto = at.j.nombre; }
    else if (at.n.pv !== undefined) at.n.pv = Math.max(0, at.n.pv - f);
    lineas.push(`🔥 Senda de la Ceniza: la ceniza de ${ob.nombre} arde y quema a ${at.nombre} (${f} de fuego).`);
    aviso += `\n🔥 ${at.nombre} se quema (${f}).`;
  }
  if (notaElusivo) aviso += `\n${notaElusivo}`;
  return { texto: lineas.join("\n"), aviso, muerto, resultado, dano };
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
- Las criaturas usan el bonificador de su ficha (o "bono"), fallan seguro solo con un 1 y no rozan. Envenenado, asustado, cegado, jadeando, agotado, derribado o retenido dan desventaja al PJ que ataca.

${REGLAS_ARMADURA}`;
