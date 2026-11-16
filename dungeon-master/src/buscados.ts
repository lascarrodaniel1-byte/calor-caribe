// Tablero de buscados de la Llama Gris: carteles de busca y captura con los sellos de la Inquisición, clavados en los tablones de la
// Casa de Registros, los puertos y las plazas. El grupo puede hacer de cazarrecompensas: aceptar un contrato, seguir pistas, capturar y
// entregar al buscado vivo o muerto. DATOS PUROS + lógica; la combinación con la partida es mínima (`partida.buscados`).
// El pago NUNCA se aplica solo: es una SUGERENCIA (oro_cambio) y se apunta en `partida.botinPendiente`, igual que el botín.
// Solo lore PÚBLICO de Velmora: los carteles y las pistas usan las capas público, rumor y erudito de saber.ts (nunca restringido ni secreto).
import { z } from "zod";
import { tirar } from "./dados.js";
import { resolverPrueba } from "./pruebas.js";
import type { Partida } from "./estado.js";
import { REGIONES } from "./mapa.js";
import { VETERANIAS } from "./combate.js";

// ---------------------------------------------------------------------------------------------------------------- tipos
export const DELITOS = {
  herejia: { nombre: "herejía", ley: "negar el rito de sal y fuego o la sentencia de la Llama" },
  apostasia: { nombre: "apostasía", ley: "renegar de los ritos y los sellos de la Llama" },
  culto_prohibido: { nombre: "culto prohibido", ley: "servir a un culto sin licencia (los Devotos del Dios Hambriento, sobre todo)" },
  contrabando: { nombre: "contrabando de reliquias o sal", ley: "traficar con huesos de dioses sin sello o con sal sin la tasa de la Llama" },
  desercion: { nombre: "deserción de la Llama", ley: "huir del servicio de la Llama con su sello, sus armas o sus papeles" },
  asesinato_inquisidor: { nombre: "asesinato de inquisidor", ley: "matar a quien porta el sello de la Llama" },
  brujeria: { nombre: "brujería", ley: "practicar magia negra o hechicería sin licencia" },
} as const;
export type Delito = keyof typeof DELITOS;
export const NOMBRES_DELITOS = Object.keys(DELITOS) as [Delito, ...Delito[]];

export const ESTADOS_CARTEL = ["activo", "tomado", "capturado", "entregado", "prescrito"] as const;
export type EstadoCartel = (typeof ESTADOS_CARTEL)[number];

/** Capas de saber que puede llevar una pista de un cartel (nunca restringido ni secreto). */
export type CapaPista = "rumor" | "erudito";
export interface Pista { capa: CapaPista; texto: string }

export interface Perfil {
  /** PNJ sin ficha: los mismos datos que `iniciativa {pnj}` (bono de ataque, CA, PV, veteranía). */
  pnj?: { bono_ataque: number; ca: number; pv: number; veterania: (typeof VETERANIAS)[number]; ataques_por_asalto?: number };
  /** Ficha del bestiario (aparecer_criatura) cuando el buscado ES una criatura, o de la que toma resistencias (iniciativa pnj.criatura). */
  criatura?: string;
  /** Compañía: criaturas del bestiario que lo acompañan («2 Hambrientos»). */
  escolta?: string;
  nota?: string;
}

export interface Buscado {
  id: string;
  nombre: string;
  alias?: string;
  delito: Delito;
  /** Aspecto público: lo que dice el cartel. */
  descripcion: string;
  /** Región del mapa (NOMBRES de mapa.ts) y última ubicación conocida. */
  region: string;
  lugar: string;
  peligro: 1 | 2 | 3 | 4 | 5;
  /** Recompensa en po. */
  viva: number;
  /** null = solo vivo. */
  muerta: number | null;
  /** Días que da la Llama a quien toma el contrato (null = sin plazo). */
  plazo: number | null;
  perfil: Perfil;
  pistas: Pista[];
  emisor: { oficial: string; rango: string; sello: string };
}

/** Un cartel que el DM publica para la trama (puede apuntar a alguien del grupo). */
export interface CartelPropio extends Buscado { visible: boolean; dia: number }

export interface Contrato {
  id: string;
  quien: string;
  dia: number;
  vence: number | null;
}

export interface EstadoBuscados {
  /** Estado de cada cartel (si falta, «activo»). */
  estados: Record<string, EstadoCartel>;
  contratos: Record<string, Contrato>;
  /** Pistas ya reveladas por cartel. */
  pistas: Record<string, number>;
  propios: CartelPropio[];
  /** Carteles generados al azar (renuevan el tablón). */
  generados: Buscado[];
  /** Contador de carteles generados y propios (para ids estables). */
  n: { g: number; p: number };
  /** Puntos de reputación con la Llama de la mesa. */
  rep: number;
  /** Último día del mundo en que se renovó el tablón. */
  renovado?: number;
}

export const buscadosVacio = (): EstadoBuscados => ({ estados: {}, contratos: {}, pistas: {}, propios: [], generados: [], n: { g: 0, p: 0 }, rep: 0 });

/** Rellena el estado de partidas antiguas o recortadas (no lo crea si no existe). */
export function normalizarBuscados(p: Partida): void {
  const b = p.buscados;
  if (!b) return;
  const v = buscadosVacio();
  b.estados ??= v.estados; b.contratos ??= v.contratos; b.pistas ??= v.pistas;
  b.propios ??= v.propios; b.generados ??= v.generados; b.n ??= v.n; b.n.g ??= 0; b.n.p ??= 0;
  b.rep = Number.isFinite(b.rep) ? b.rep : 0;
}

const estadoDe = (p: Partida): EstadoBuscados => { p.buscados ??= buscadosVacio(); normalizarBuscados(p); return p.buscados; };

// ------------------------------------------------------------------------------------------------------- límites y tablas
export const MAX_CONTRATOS = 5;
export const MAX_PROPIOS = 12;
export const MAX_GENERADOS = 8;

/** Recompensa viva por peligro (banda de los fijos y tabla del generador). Propuesta a confirmar. */
export const BANDA_VIVA: Record<1 | 2 | 3 | 4 | 5, [number, number]> = { 1: [30, 60], 2: [100, 180], 3: [250, 400], 4: [600, 900], 5: [1200, 2000] };
/** Qué parte de la recompensa viva paga un buscado muerto (mínimo la mitad). */
export const FRACCION_MUERTO = 0.6;
/** Si debía entregarse vivo y llega muerto, solo se pagan los gastos de traslado: este porcentaje de la viva. */
export const PAGO_MINIMO = 0.1;

/** Reputación con la Llama de la mesa: puntos mínimos, peligro máximo de los contratos que se pueden aceptar y plus de pago. */
export const RANGOS_LLAMA = [
  { min: -99, nombre: "Sospechoso", maxPeligro: 1, plus: 0 },
  { min: -2, nombre: "Sin licencia", maxPeligro: 2, plus: 0 },
  { min: 3, nombre: "Aspirante", maxPeligro: 3, plus: 0 },
  { min: 8, nombre: "Cazador licenciado", maxPeligro: 4, plus: 0.1 },
  { min: 16, nombre: "Cazador de la Llama", maxPeligro: 5, plus: 0.2 },
] as const;
export const REP = { vivo: 2, muerto: 1, soloVivoMuerto: -2, equivocado: -4, vencido: -1, min: -10, max: 30 } as const;

export function rangoLlama(puntos: number): (typeof RANGOS_LLAMA)[number] {
  let r: (typeof RANGOS_LLAMA)[number] = RANGOS_LLAMA[0];
  for (const x of RANGOS_LLAMA) if (puntos >= x.min) r = x;
  return r;
}
/** «Aspirante (4 pts)». */
export const textoRango = (puntos: number): string => { const r = rangoLlama(puntos); return `${r.nombre} (${puntos} pts)`; };

// ------------------------------------------------------------------------------------------------------------ catálogo fijo
const SELLO = "sello de cera gris con la llama";
const E = {
  aldenmar: { oficial: "Teodric Marn", rango: "fiscal inquisidor de la Casa de Registros de Aldenmar", sello: SELLO },
  cienagas: { oficial: "Hesper Dol", rango: "alguacil mayor de la Llama en las Ciénagas", sello: SELLO },
  karak: { oficial: "Brenna Holt", rango: "inquisidora de la Llama en la frontera de Karak-Dûm", sello: SELLO },
  velo: { oficial: "Osmund Rake", rango: "inquisidor de la Llama en el Velo Rojo", sello: SELLO },
  marca: { oficial: "Ilsabet Crane", rango: "inquisidora de la Llama en la Marca Hueca", sello: SELLO },
  agujas: { oficial: "Corvin Ashe", rango: "inquisidor de la Llama en las Agujas de Vahl", sello: SELLO },
} as const;
const R = {
  aldenmar: "Aldenmar", cienagas: "Las Ciénagas de Hollín", karak: "Karak-Dûm", velo: "El Bosque de Velo Rojo", marca: "La Marca Hueca", agujas: "Las Agujas de Vahl",
} as const;

const f = (
  id: string, nombre: string, alias: string | null, delito: Delito, reg: keyof typeof R, lugar: string, peligro: 1 | 2 | 3 | 4 | 5,
  viva: number, muerta: number | null, plazo: number | null, descripcion: string, perfil: Perfil, pistas: [string, string, string],
): Buscado => ({
  id, nombre, ...(alias ? { alias } : {}), delito, descripcion, region: R[reg], lugar, peligro, viva, muerta, plazo, perfil,
  pistas: [{ capa: "rumor", texto: pistas[0] }, { capa: "rumor", texto: pistas[1] }, { capa: "erudito", texto: pistas[2] }],
  emisor: E[reg],
});

export const BUSCADOS: Buscado[] = [
  f("B01", "Tomás Orlev", "el Mudo", "contrabando", "cienagas", "los embarcaderos de Hollín", 1, 40, 25, 20,
    "Mediano barquero, menudo, de cara ancha y una cicatriz en la ceja; no habla y se hace entender con las manos.",
    { pnj: { bono_ataque: 3, ca: 12, pv: 9, veterania: "recluta" } },
    ["Dicen en las tabernas del muelle que cobra en sal y que nunca pasa dos noches bajo el mismo pilote.", "Un barquero jura que su barca va hundida de peso y sin remos a la vista, con una pértiga larga de cieno.", "El registro de tasas de la Casa de Registros anota sus barcas en tres canales; la última vez, en un depósito de sal sin sello a las afueras del embarcadero."]),
  f("B02", "Marga Veyl", "la Dama de las Velas", "culto_prohibido", "aldenmar", "las fosas comunes extramuros", 1, 50, 30, 15,
    "Mujer flaca de pelo cano atado con una cinta negra; lleva siempre un cabo de vela encendido en la mano.",
    { pnj: { bono_ataque: 3, ca: 11, pv: 11, veterania: "recluta" }, escolta: "2 Hambrientos" },
    ["Cuentan que reza junto a las fosas y que los muertos de allí no se levantan a su paso.", "Una sepulturera dice que le dejan velas y pan; que no pide nada a cambio, de momento.", "Los archivos de la Casa de Registros la sitúan entre los Devotos del Dios Hambriento y dan por seguro que duerme en una cripta clausurada junto a las fosas."]),
  f("B03", "Pietro Calvo", "el Santero", "contrabando", "aldenmar", "el puerto de Aldenmar", 1, 55, 30, 15,
    "Hombre grueso de barba pelirroja y manos manchadas de cera; viste un hábito comprado y le queda corto.",
    { pnj: { bono_ataque: 3, ca: 12, pv: 12, veterania: "recluta" } },
    ["En el puerto se habla de un vendedor de «huesos de santo» que ninguna Casa de Registros ha sellado.", "Dicen que los huesos son de perro, salvo uno que el Santero guarda y no vende.", "Los registros del puerto lo anotan en un almacén del muelle viejo, a nombre de una viuda que no existe."]),
  f("B04", "Joren Ashkar", "Manoseca", "desercion", "aldenmar", "las puertas del Faro", 2, 140, 80, 20,
    "Ex guardia de la Llama, alto y seco, con el brazo derecho quemado hasta el codo; huyó con un sello y una espada de servicio.",
    { pnj: { bono_ataque: 4, ca: 14, pv: 16, veterania: "curtido" } },
    ["Las tabernas de la muralla dicen que se emborracha solo y que no soporta el humo.", "Una lavandera afirma que paga con cobre quemado y duerme con la espada puesta.", "La Casa de Registros guarda su hoja de servicio: pidió traslado a las Ciénagas dos veces y se lo negaron; es de esperar que vaya a esconderse allí."]),
  f("B05", "Gorm", "Tres Dientes", "asesinato_inquisidor", "marca", "el puente de los cuervos", 2, 160, 110, 25,
    "Ogro de piel curtida con tres colmillos y una cadena de eslabones al cuello; mata con un tronco.",
    { criatura: "Ogro" },
    ["Los arrieros de la Marca no cruzan el puente de los cuervos desde que dos inquisidores no volvieron.", "Dicen que sirve a un señor de la guerra y que la cadena es el pago de una deuda.", "El informe del inquisidor de la Marca sitúa su cubil en una torre derruida a medio día del puente."]),
  f("B06", "Ilse Fenn", "la Callada", "brujeria", "cienagas", "una aldea sobre pilotes", 2, 150, null, 20,
    "Herborista de unos cuarenta años, ojos muy claros y dedos teñidos de verde; solo se la busca viva para interrogarla.",
    { pnj: { bono_ataque: 3, ca: 11, pv: 14, veterania: "curtido" } },
    ["Se cuenta que cura fiebres con hierbas y con palabras que no son de rezo.", "Una comadrona dice que se esconde donde la niebla es más espesa y que los perros no le ladran.", "El archivo anota que fue boticaria con licencia hasta que se la retiraron; el domicilio de su hermana, en una aldea de pilotes, es el último conocido."]),
  f("B07", "Silas Thorne", "el Predicador Ciego", "herejia", "aldenmar", "los barrios bajos de Aldenmar", 3, 350, null, 30,
    "Hombre de voz grave con un paño sobre los ojos; predica sin cesar y siempre lo acompañan dos o tres fieles.",
    { pnj: { bono_ataque: 4, ca: 12, pv: 24, veterania: "veterano" }, nota: "con fieles (reclutas) que lo defienden" },
    ["En los barrios bajos hay quien afirma que dice que los dioses no están muertos, solo callados.", "Dicen que cambia de callejón cada noche y que un chiquillo lo guía por los tejados.", "Los archivos de la Casa de Registros lo anotan en un taller de cordeleros abandonado cerca de la muralla vieja."]),
  f("B08", "Dagny Rook", "Garra Muerta", "asesinato_inquisidor", "velo", "los caminos del Velo Rojo", 3, 300, 200, 25,
    "Varg de ojos amarillos y trenza gris, con una cicatriz de zarpa en el cuello; la acompañan lobos.",
    { pnj: { bono_ataque: 5, ca: 14, pv: 30, veterania: "veterano" }, escolta: "2 Lobos de Ceniza" },
    ["Los leñadores dicen que los lobos la siguen y que aúllan antes de que ella ataque.", "Dicen que mató a una patrulla entera de la Llama en el cruce de los alisos.", "El expediente del inquisidor del Velo Rojo apunta a un claro con árboles arañados donde la vieron por última vez."]),
  f("B09", "Vael Harrow", "el Sacristán", "apostasia", "marca", "las aldeas del camino de la Marca", 3, 280, 160, 30,
    "Ex acólito delgado, de ojos hundidos y manos limpias; todavía lleva la sotana, sin el sello.",
    { pnj: { bono_ataque: 4, ca: 13, pv: 26, veterania: "veterano" } },
    ["Se cuenta que entierra a los muertos sin avisar a la Llama y que los marca con sal a mano.", "Una viuda de la Marca dice que el Sacristán no pide nada, solo que no se hable de él.", "Las crónicas de la Casa de Registros lo dan por acogido en una ermita derruida, a un día de camino de las aldeas del este."]),
  f("B10", "Odrik Piedrafina", null, "contrabando", "karak", "el paso de la Puerta Sellada", 3, 380, 220, 30,
    "Enano de barba trenzada con aros de plata y una pierna rígida; carga un pico de mina.",
    { pnj: { bono_ataque: 5, ca: 15, pv: 32, veterania: "veterano" } },
    ["Los buscadores de reliquias dicen que vende huesos de dios sacados de donde nadie baja.", "Dicen que paga a los mineros con plata y que cambia de ruta cada vez que se oye un golpe tras la puerta.", "Los registros de aduana de la frontera lo anotan en una galería lateral, a medio camino de la Puerta Sellada."]),
  f("B11", "Selene Voss", "la Boticaria", "brujeria", "aldenmar", "un taller del barrio de las boticas", 3, 360, 210, 25,
    "Mujer de cabello recogido en moño alto, uñas negras y un olor a clavo; sus venenos no dejan marca.",
    { pnj: { bono_ataque: 4, ca: 12, pv: 27, veterania: "veterano" } },
    ["En los barrios altos se murmura de herederos que mueren dulces.", "Dicen que anota cada receta en un cuaderno que nunca deja fuera de su alcance.", "Su antigua licencia, caducada y retirada, figura en la Casa de Registros con una dirección en el barrio de las boticas."]),
  f("B12", "Cadell Voyce", "Voz de Ceniza", "culto_prohibido", "cienagas", "las fosas de las Ciénagas", 4, 750, 450, 40,
    "Hombre ya mayor, de voz poderosa y ojos grises; predica a los devotos y viste cuero oscuro con un cinto de dientes.",
    { pnj: { bono_ataque: 6, ca: 14, pv: 45, veterania: "veterano", ataques_por_asalto: 2 }, escolta: "2 Ghules de las fosas" },
    ["Las aldeas de pilotes dicen que predica a los devotos del Dios Hambriento y que cada luna llena reúne a más.", "Dicen que los ghuls lo escoltan y que nadie ha vuelto de una de sus prédicas.", "Los archivos de la Casa de Registros siguen su rastro a un islote en el corazón de las Ciénagas, accesible solo en barca por un canal sin nombre."]),
  f("B13", "Hermano Ansel Corde", "el Flagelante Hueco", "asesinato_inquisidor", "agujas", "un monasterio abandonado de las Agujas", 4, 680, 400, 35,
    "Monje alto y enjuto de espalda cubierta de cicatrices rituales; las manos nudosas, golpea con el canto.",
    { pnj: { bono_ataque: 6, ca: 15, pv: 48, veterania: "veterano", ataques_por_asalto: 2 } },
    ["En las Agujas se cuenta que mató a dos inquisidores con las manos desnudas, sin una sola arma.", "Dicen que el hermano nunca duerme y que reza para que el dolor no cese.", "El informe del inquisidor de las Agujas lo sitúa en un monasterio sin tejado a dos jornadas del camino alto."]),
  f("B14", "La Bestia del Pinar", null, "asesinato_inquisidor", "velo", "el pinar negro del Velo Rojo", 4, 900, 600, 30,
    "Una bestia gris, mitad guerrero y mitad lobo, de ojos de brasa; despedazó una patrulla de la Llama y se alimentó de ella.",
    { criatura: "Ulfhedinn" },
    ["Los cazadores dicen que aúlla desde lo alto de los pinos y que no sigue huellas, las inventa.", "Cuentan que apareció tras una batalla en la que cayeron berserkers y que desde entonces nadie la ve de día.", "Las crónicas dicen que estas criaturas son berserkers caídos; su rastro, según el inquisidor, termina en una cueva a media jornada del pinar."]),
  f("B15", "Ysmeria Dorne", "la Magistra", "desercion", "aldenmar", "el puerto y las fosas de Aldenmar", 5, 1600, 900, 60,
    "Ex magistrada de la Llama, alta, de rostro severo y cabello blanco prematuro; sabe sellar y leer sentencias y huyó con una parte del archivo.",
    { pnj: { bono_ataque: 8, ca: 17, pv: 90, veterania: "leyenda", ataques_por_asalto: 2 } },
    ["Se habla de una antigua inquisidora que ayuda a huir a los condenados con sellos que parecen verdaderos.", "Dicen que la ciudad la busca y que nadie del puerto la delata porque nadie sabe dónde duerme.", "Los archivos de la Casa de Registros anotan una red de casas de paso entre el puerto y las fosas; la quinta, en una sepultura vacía, es la más probable."]),
  f("B16", "Odessa Quen", "la Reina de la Sal", "contrabando", "cienagas", "los canales de Hollín", 5, 1300, 900, 60,
    "Mediana de pelo plateado y manos enormes para su talla; cobra en sal y lleva anillos de hueso de dios.",
    { pnj: { bono_ataque: 7, ca: 16, pv: 70, veterania: "leyenda", ataques_por_asalto: 2 }, escolta: "3 Hombres lagarto" },
    ["Los barqueros dicen que no hay un solo cargamento de sal que no pase por sus manos.", "Dicen que paga a los hombres lagarto con sal y que éstos no aceptan otra moneda.", "La Casa de Registros calcula que sus almacenes están en una isla de piedra en un canal que se seca en verano."]),
];

// ---------------------------------------------------------------------------------------------------------- generador
const NOMBRES = ["Aldo", "Berta", "Cedric", "Dagna", "Edmund", "Frida", "Gunther", "Hanne", "Ivo", "Jorun", "Kasper", "Lena", "Magnus", "Nessa", "Osric", "Petra"];
const APELLIDOS = ["Brandt", "Cole", "Dunmore", "Ewart", "Fell", "Gray", "Holm", "Iver", "Jarl", "Kessler", "Lund", "Marsh", "Nord", "Orm", "Pike", "Quill"];
const APODOS = ["el Cojo", "la Gata", "Ojo de Vidrio", "el Pálido", "la Viuda", "Manos Frías", "el Cuervo", "la Sombra", "el Zurdo", "Dientes de Plata", "el Flaco", "la Lechuza"];
const ASPECTOS = ["cojea de la pierna izquierda", "con una cicatriz en la mejilla", "pelo rapado a cuchilla", "los dedos manchados de tinta", "un diente de oro", "un ojo lechoso", "tatuaje de espina en el cuello", "voz ronca de humo", "falta el dedo meñique", "capa remendada de gris", "un anillo de hueso", "siempre con guantes"];
const LUGARES_POR_REGION: Record<string, string[]> = {
  Aldenmar: ["el puerto", "los barrios bajos", "la muralla vieja", "las fosas extramuros"],
  "Las Ciénagas de Hollín": ["los embarcaderos", "un pilar de la aldea", "un canal sin nombre"],
  "Karak-Dûm": ["la frontera de la Puerta Sellada", "un campamento de mineros"],
  "El Bosque de Velo Rojo": ["un claro de árboles arañados", "los caminos del Velo"],
  "La Marca Hueca": ["un castillo en ruinas", "una aldea del camino"],
  "Las Agujas de Vahl": ["un monasterio sin tejado", "un paso de montaña"],
};
const DELITOS_POR_REGION: Record<string, Delito[]> = {
  Aldenmar: ["contrabando", "herejia", "desercion", "brujeria", "culto_prohibido"],
  "Las Ciénagas de Hollín": ["contrabando", "culto_prohibido", "brujeria"],
  "Karak-Dûm": ["contrabando", "desercion"],
  "El Bosque de Velo Rojo": ["brujeria", "asesinato_inquisidor", "herejia"],
  "La Marca Hueca": ["apostasia", "culto_prohibido", "herejia"],
  "Las Agujas de Vahl": ["apostasia", "herejia", "asesinato_inquisidor"],
};
/** Perfil genérico por peligro del generador (los datos que ya usa `iniciativa {pnj}`). */
const PERFIL_GEN: Record<1 | 2 | 3 | 4 | 5, NonNullable<Perfil["pnj"]>> = {
  1: { bono_ataque: 3, ca: 12, pv: 10, veterania: "recluta" },
  2: { bono_ataque: 4, ca: 13, pv: 16, veterania: "curtido" },
  3: { bono_ataque: 5, ca: 14, pv: 28, veterania: "veterano" },
  4: { bono_ataque: 6, ca: 15, pv: 45, veterania: "veterano", ataques_por_asalto: 2 },
  5: { bono_ataque: 8, ca: 17, pv: 80, veterania: "leyenda", ataques_por_asalto: 2 },
};
const EMISOR_REGION: Record<string, (typeof E)[keyof typeof E]> = { [R.aldenmar]: E.aldenmar, [R.cienagas]: E.cienagas, [R.karak]: E.karak, [R.velo]: E.velo, [R.marca]: E.marca, [R.agujas]: E.agujas };

const pick = <T>(l: readonly T[]): T => (l.length < 2 ? l[0] : l[tirar(`1d${l.length}`).total - 1]);

/** Un cartel nuevo para la región y el peligro dados (1-5). Determinista si los dados están fijados: 5 tiradas más una por cada lista. */
export function generarBuscado(region: string, peligro: number, id: string): Buscado {
  const r = REGIONES.some((x) => x.nombre === region) ? region : R.aldenmar;
  const p = Math.min(5, Math.max(1, Math.round(peligro))) as 1 | 2 | 3 | 4 | 5;
  const delito = pick(DELITOS_POR_REGION[r]);
  const nombre = `${pick(NOMBRES)} ${pick(APELLIDOS)}`;
  const alias = pick(APODOS);
  const [mn, mx] = BANDA_VIVA[p];
  const viva = mn + Math.round(((tirar("1d100").total - 1) / 99) * (mx - mn) / 5) * 5;
  const soloVivo = (delito === "brujeria" || delito === "herejia") && tirar("1d4").total === 1;
  const a1 = pick(ASPECTOS); const a2 = pick(ASPECTOS);
  const lugar = pick(LUGARES_POR_REGION[r]);
  return {
    id, nombre, alias, delito, region: r, lugar, peligro: p, viva, muerta: soloVivo ? null : Math.max(Math.ceil(viva / 2), Math.round((viva * FRACCION_MUERTO) / 5) * 5),
    plazo: 10 + p * 5,
    descripcion: `Se le conoce por «${alias}»: ${a1}${a2 !== a1 ? `, ${a2}` : ""}.`,
    perfil: { pnj: { ...PERFIL_GEN[p] } },
    pistas: [
      { capa: "rumor", texto: `En las tabernas dicen que ${nombre.split(" ")[0]} ${tirar("1d2").total === 1 ? "paga siempre al contado" : "nunca duerme dos noches en el mismo sitio"} y que se lo ha visto cerca de ${lugar}.` },
      { capa: "rumor", texto: "Un vecino jura que cambió de nombre en el último mes y que lo busca más de uno." },
      { capa: "erudito", texto: `Los registros de la Casa de Registros anotan un refugio probable cerca de ${lugar}.` },
    ],
    emisor: EMISOR_REGION[r] ?? E.aldenmar,
  };
}

// ------------------------------------------------------------------------------------------------------------- consulta
const norm = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
const CLAVES_REGION: [string, string][] = [["aldenmar", R.aldenmar], ["cienaga", R.cienagas], ["hollin", R.cienagas], ["karak", R.karak], ["velo rojo", R.velo], ["marca hueca", R.marca], ["aguja", R.agujas], ["vahl", R.agujas]];
/** El nombre oficial de la región de un texto («Ciénagas», «Aldenmar, puerto»…) o undefined. */
export function regionDe(texto: string | undefined): string | undefined {
  const n = norm(texto ?? "");
  return n ? CLAVES_REGION.find(([k]) => n.includes(k))?.[1] : undefined;
}

/** Lugares donde hay un tablón (los hay en los sitios con gente). */
export const TIPOS_CON_TABLON = ["ciudad", "aldea", "posada", "puerto", "fortaleza", "campamento", "templo"];

/** Día del mundo (el 1 es el primero). */
export const diaDe = (p: Partida): number => Math.floor((p.reloj?.segundos ?? 0) / 86400) + 1;

/** Todos los carteles de la partida: fijos, generados y propios (visibles o no). */
export function todosLosCarteles(p: Partida): (Buscado & { visible: boolean })[] {
  const b = p.buscados;
  return [...BUSCADOS.map((x) => ({ ...x, visible: true })), ...(b?.generados ?? []).map((x) => ({ ...x, visible: true })), ...(b?.propios ?? [])];
}
export const cartelPorId = (p: Partida, id: string | undefined): (Buscado & { visible: boolean }) | undefined => {
  const k = String(id ?? "").trim().toUpperCase();
  return k ? todosLosCarteles(p).find((x) => x.id === k) ?? todosLosCarteles(p).find((x) => norm(x.nombre) === norm(k) || (!!x.alias && norm(x.alias) === norm(k))) : undefined;
};
export const estadoCartel = (p: Partida, id: string): EstadoCartel => p.buscados?.estados?.[id] ?? "activo";

/** ¿Es un objetivo del grupo (un personaje jugador)? Nombre o jugador. */
function esDelGrupo(p: Partida, nombre: string): boolean {
  const n = norm(nombre);
  return Object.values(p.personajes).some((x) => norm(x.nombre) === n || (!!x.jugador && norm(x.jugador) === n));
}

/** Región y tablón del lugar actual: {region, lugar, hay}. Sin ubicación: sin región (se ven todos). */
export function tablonDe(p: Partida): { region?: string; lugar?: string; hay: boolean } {
  const l = p.mapa?.lugares?.[p.mapa?.posicion ?? ""];
  if (!l) return { hay: true };
  return { region: regionDe(l.region) ?? regionDe(l.nombre), lugar: l.nombre, hay: TIPOS_CON_TABLON.includes(l.tipo) };
}

/** Los carteles del tablón de una región (los de la región y las circulares de peligro 4-5 de todo el reino). */
export function cartelesDeRegion(p: Partida, region: string | undefined, soloVisibles: boolean): (Buscado & { visible: boolean })[] {
  return todosLosCarteles(p).filter((x) => (!soloVisibles || x.visible) && estadoCartel(p, x.id) !== "prescrito"
    && (!region || x.region === region || x.peligro >= 4));
}

const po = (n: number) => `${n} po`;
const recompensa = (x: Buscado) => `vivo ${po(x.viva)} · ${x.muerta === null ? "solo vivo" : `muerto ${po(x.muerta)}`}`;

/** Revisa los plazos: un contrato vencido fracasa (−1 de reputación) y su cartel vuelve a estar activo. Devuelve los avisos. */
export function revisarPlazos(p: Partida): string[] {
  const b = p.buscados;
  if (!b) return [];
  const hoy = diaDe(p);
  const av: string[] = [];
  for (const c of Object.values(b.contratos)) {
    if (c.vence === null || hoy <= c.vence) continue;
    delete b.contratos[c.id];
    b.estados[c.id] = "activo";
    b.rep = Math.max(REP.min, b.rep + REP.vencido);
    av.push(`⏳ Venció el plazo del contrato ${c.id} (${cartelPorId(p, c.id)?.nombre ?? c.id}, día ${c.vence}): la Casa de Registros lo reasigna. Reputación ${REP.vencido} (${textoRango(b.rep)}).`);
  }
  return av;
}

/** Línea corta para el estado del DM: solo si hay contratos en curso. */
export function lineaBuscados(p: Partida): string {
  const b = p.buscados;
  const cs = Object.values(b?.contratos ?? {});
  if (!b || !cs.length) return "";
  const l = cs.map((c) => `${cartelPorId(p, c.id)?.nombre ?? c.id} (${c.quien}${c.vence !== null ? `, vence día ${c.vence}` : ""}${estadoCartel(p, c.id) === "capturado" ? ", capturado" : ""})`);
  return `## Cazarrecompensas\nContratos de la Llama: ${l.join("; ")}. Rango ${textoRango(b.rep)}. (buscados)`;
}

// ------------------------------------------------------------------------------------------------ vista para la página
export interface VistaCartel {
  id: string; nombre: string; alias?: string; delito: string; descripcion: string; lugar: string; region: string; peligro: number;
  viva: number; muerta: number | null; firma: string; estado: EstadoCartel; plazo: number | null;
  /** Pistas ya reveladas (texto). */
  pistas: string[];
  /** Contrato en curso: quién y hasta qué día. */
  contrato?: { quien: string; vence: number | null };
}
export interface VistaTablon { rango: string; puntos: number; lugar?: string; hay: boolean; carteles: VistaCartel[] }

/** Lo que ven los jugadores: solo los carteles VISIBLES del tablón del lugar actual, con las pistas ya reveladas (nada de lo no revelado ni del perfil). */
export function vistaTablon(p: Partida): VistaTablon | undefined {
  const b = p.buscados;
  if (!b) return undefined;
  const t = tablonDe(p);
  const lista = t.hay ? cartelesDeRegion(p, t.region, true) : [];
  return {
    rango: rangoLlama(b.rep).nombre, puntos: b.rep, lugar: t.lugar, hay: t.hay,
    carteles: lista.map((x) => {
      const c = b.contratos[x.id];
      return {
        id: x.id, nombre: x.nombre, ...(x.alias ? { alias: x.alias } : {}), delito: DELITOS[x.delito].nombre, descripcion: x.descripcion, lugar: x.lugar, region: x.region, peligro: x.peligro,
        viva: x.viva, muerta: x.muerta, firma: `${x.emisor.oficial}, ${x.emisor.rango}`, estado: estadoCartel(p, x.id), plazo: x.plazo,
        pistas: x.pistas.slice(0, b.pistas[x.id] ?? 0).map((y) => y.texto),
        ...(c ? { contrato: { quien: c.quien, vence: c.vence } } : {}),
      };
    }),
  };
}

// ------------------------------------------------------------------------------------------------------------ acciones
export const ACCIONES_BUSCADOS = ["ver", "detalle", "aceptar", "pista", "capturar", "entregar", "abandonar", "cartel", "retirar"] as const;

const textoCartel = (x: Buscado): string =>
  `${x.id} ${x.nombre}${x.alias ? ` «${x.alias}»` : ""} — ${DELITOS[x.delito].nombre} · P${x.peligro} · ${recompensa(x)}`;

const cartelSchema = z.object({
  nombre: z.string().min(1).max(60),
  alias: z.string().max(60).optional(),
  delito: z.enum(NOMBRES_DELITOS),
  descripcion: z.string().min(1).max(300),
  lugar: z.string().max(100).optional(),
  region: z.string().max(60).optional(),
  viva: z.number().int().min(0).max(5000),
  muerta: z.number().int().min(0).max(5000).optional(),
  solo_vivo: z.boolean().optional(),
  firma: z.string().min(1).max(60),
  rango_firma: z.string().max(80).optional(),
  peligro: z.number().int().min(1).max(5).optional(),
  plazo: z.number().int().min(1).max(365).optional(),
  pista_rumor: z.string().max(200).optional(),
  pista_erudita: z.string().max(200).optional(),
  visible: z.boolean().optional(),
  nota: z.string().max(200).optional(),
});

export interface DatosBuscados {
  accion: (typeof ACCIONES_BUSCADOS)[number];
  id?: string;
  quien?: string;
  estado?: "vivo" | "muerto";
  datos?: Record<string, unknown>;
}

const datosExtra = z.object({
  pruebas: z.string().max(200).optional(),
  equivocado: z.boolean().optional(),
  habilidad: z.enum(["investigacion", "persuasion", "percepcion", "supervivencia", "intimidacion"]).optional(),
  region: z.string().max(60).optional(),
  renovar: z.boolean().optional(),
  todos: z.boolean().optional(),
  visible: z.boolean().optional(),
});

/** Valida con zod y, si falla, un error legible (campo: motivo) en lugar del volcado de zod. */
function parsear<T extends z.ZodType>(esquema: T, datos: unknown): z.infer<T> {
  const r = esquema.safeParse(datos ?? {});
  if (r.success) return r.data;
  throw new Error(`Datos no válidos en «datos»: ${r.error.issues.map((i) => `${i.path.join(".") || "datos"}: ${i.message}`).join("; ")}.`);
}
const sumaRep = (b: EstadoBuscados, d: number) => { b.rep = Math.min(REP.max, Math.max(REP.min, b.rep + d)); };
const pendiente = (p: Partida) => (p.botinPendiente ??= { oro: 0, objetos: [], avisos: 0 });

/** El personaje (por nombre o jugador) vivo. */
function pjDe(p: Partida, quien: string | undefined) {
  if (!quien) throw new Error("Falta «quien»: el personaje del grupo que lleva el contrato.");
  const n = norm(quien);
  const pj = Object.values(p.personajes).find((x) => norm(x.nombre) === n || (!!x.jugador && norm(x.jugador) === n));
  if (!pj) throw new Error(`No existe el personaje «${quien}». Personajes: ${Object.keys(p.personajes).join(", ") || "ninguno"}.`);
  if (pj.condiciones.includes("muerto")) throw new Error(`${pj.nombre} está muerto.`);
  return pj;
}

/** Renueva el tablón del lugar: una vez por día del mundo (o con renovar) añade un cartel generado de la región. */
function renovar(p: Partida, region: string | undefined, forzar: boolean): string | undefined {
  const b = estadoDe(p);
  const hoy = diaDe(p);
  if (!forzar && b.renovado !== undefined && b.renovado >= hoy) return undefined;
  b.renovado = hoy;
  const r = region ?? R.aldenmar;
  if (b.generados.filter((x) => x.region === r && estadoCartel(p, x.id) === "activo").length >= 3 && !forzar) return undefined;
  const rep = rangoLlama(b.rep);
  const peligro = Math.min(rep.maxPeligro, 1 + Math.floor((tirar("1d6").total - 1) / 2)); // 1-3, nunca por encima de lo que el grupo puede aceptar
  const x = generarBuscado(r, peligro, `G${String(++b.n.g).padStart(2, "0")}`);
  b.generados.push(x);
  while (b.generados.length > MAX_GENERADOS) {
    const i = b.generados.findIndex((y) => !b.contratos[y.id]);
    if (i < 0) break;
    const [fuera] = b.generados.splice(i, 1); delete b.estados[fuera.id]; delete b.pistas[fuera.id];
  }
  return `Cartel nuevo en el tablón: ${textoCartel(x)}.`;
}

function ver(p: Partida, d: DatosBuscados, extra: z.infer<typeof datosExtra>): { texto: string; publico: string | null } {
  const b = estadoDe(p);
  const t = tablonDe(p);
  const region = extra.region ? regionDe(extra.region) ?? extra.region : t.region;
  const nuevo = t.hay || extra.region ? renovar(p, region, !!extra.renovar) : undefined;
  if (!t.hay && !extra.region)
    return { texto: `En ${t.lugar} no hay tablón de la Llama (están en la Casa de Registros, puertos, plazas y posadas). Pasa por uno o consulta con datos {region}.`, publico: null };
  const todos = cartelesDeRegion(p, region, false);
  const lista = extra.todos ? todos : todos.filter((x) => ["activo", "tomado", "capturado"].includes(estadoCartel(p, x.id)));
  const MAX = 12;
  const linea = (x: Buscado & { visible: boolean }) => {
    const e = estadoCartel(p, x.id);
    return `${textoCartel(x)}${e !== "activo" ? ` [${e}${b.contratos[x.id] ? `: ${b.contratos[x.id].quien}` : ""}]` : ""}${x.visible ? "" : " (OCULTO a los jugadores)"}`;
  };
  const dm = lista.slice(0, MAX).map(linea);
  const vis = lista.filter((x) => x.visible);
  const pub = vis.slice(0, MAX).map((x) => `${textoCartel(x)}${estadoCartel(p, x.id) !== "activo" ? ` [${estadoCartel(p, x.id)}]` : ""}`);
  const mas = (n: number) => (n > MAX ? `\n(+${n - MAX} más: detalle {id} o ver {datos:{todos:true}})` : "");
  const cab = `Tablón de la Llama${t.lugar ? ` en ${t.lugar}` : ""}${region ? ` (${region})` : ""} · rango ${textoRango(b.rep)}`;
  return {
    texto: `${cab}\n${dm.join("\n") || "Sin carteles."}${mas(lista.length)}${nuevo ? `\n${nuevo}` : ""}\nContratos: ${Object.values(b.contratos).map((c) => `${c.id} (${c.quien})`).join(", ") || "ninguno"}.`,
    publico: pub.length ? `📜 ${cab}\n${pub.join("\n")}${mas(vis.length)}` : null,
  };
}

function detalle(p: Partida, id: string | undefined): { texto: string; publico: string | null } {
  const x = cartelPorId(p, id);
  if (!x) throw new Error(`No hay ningún cartel «${id}». Usa buscados {accion: ver}.`);
  const b = estadoDe(p);
  const rev = b.pistas[x.id] ?? 0;
  const per = x.perfil;
  const stats = per.pnj ? `PNJ sin ficha (iniciativa pnj): ataque +${per.pnj.bono_ataque}, CA ${per.pnj.ca}, ${per.pnj.pv} PV, ${per.pnj.veterania}${per.pnj.ataques_por_asalto ? `, ${per.pnj.ataques_por_asalto} ataques` : ""}` : "";
  const partes = [stats, per.criatura ? `ficha del bestiario: ${per.criatura}` : "", per.escolta ? `con ${per.escolta}` : "", per.nota ?? ""].filter(Boolean).join("; ");
  const pistas = x.pistas.map((y, i) => `  ${i + 1}. [${y.capa}] ${y.texto}${i < rev ? " (revelada)" : ""}`).join("\n") || "  (sin pistas preparadas: improvisa un rumor)";
  const e = estadoCartel(p, x.id);
  const c = b.contratos[x.id];
  const texto = `${x.id} ${x.nombre}${x.alias ? ` «${x.alias}»` : ""} — ${DELITOS[x.delito].nombre} (ley de la Llama: ${DELITOS[x.delito].ley})${x.visible ? "" : " · OCULTO a los jugadores"}\n` +
    `Cartel: ${x.descripcion} Última ubicación conocida: ${x.lugar} (${x.region}). Peligro ${x.peligro}. ${recompensa(x)}. Plazo ${x.plazo ? `${x.plazo} días` : "sin plazo"}. Firma: ${x.emisor.oficial}, ${x.emisor.rango}, con ${x.emisor.sello}.\n` +
    `Estado: ${e}${c ? ` (${c.quien}${c.vence !== null ? `, vence el día ${c.vence}` : ""})` : ""}. Combate: ${partes || "sin datos"}.\nPistas (${rev}/${x.pistas.length}):\n${pistas}`;
  return { texto, publico: x.visible ? `📜 ${textoCartel(x)}\n${x.descripcion} Última ubicación conocida: ${x.lugar}. Firma: ${x.emisor.oficial}, ${x.emisor.rango}.` : null };
}

function aceptar(p: Partida, d: DatosBuscados): { texto: string; publico: string | null } {
  const b = estadoDe(p);
  const x = cartelPorId(p, d.id);
  if (!x) throw new Error(`No hay ningún cartel «${d.id}».`);
  if (!x.visible) throw new Error(`El cartel ${x.id} aún no está publicado para los jugadores: publícalo antes (cartel {id, datos:{visible:true}}).`);
  const pj = pjDe(p, d.quien);
  const e = estadoCartel(p, x.id);
  if (e !== "activo") throw new Error(`${x.id} no está disponible: está ${e}${b.contratos[x.id] ? ` (lo lleva ${b.contratos[x.id].quien})` : ""}.`);
  if (esDelGrupo(p, x.nombre) || (x.alias && esDelGrupo(p, x.alias))) throw new Error(`${x.nombre} es del grupo: sus compañeros no pueden cobrar su propia cabeza. Hazlo con cazadores PNJ (encuentro «cazarrecompensas»).`);
  const rango = rangoLlama(b.rep);
  if (x.peligro > rango.maxPeligro) throw new Error(`Con el rango «${rango.nombre}» solo se aceptan contratos de peligro ${rango.maxPeligro} o menos (este es ${x.peligro}). Sube de rango con entregas limpias.`);
  if (Object.keys(b.contratos).length >= MAX_CONTRATOS) throw new Error(`Ya hay ${MAX_CONTRATOS} contratos en curso: cierra o abandona alguno.`);
  const hoy = diaDe(p);
  b.contratos[x.id] = { id: x.id, quien: pj.nombre, dia: hoy, vence: x.plazo ? hoy + x.plazo : null };
  b.estados[x.id] = "tomado";
  const venc = x.plazo ? `Plazo: hasta el día ${hoy + x.plazo}.` : "Sin plazo.";
  return { texto: `${pj.nombre} acepta el contrato ${x.id} (${x.nombre}). ${venc} Rango ${textoRango(b.rep)}.`, publico: `📜 ${pj.nombre} toma el cartel de ${x.nombre}. ${venc}` };
}

function pista(p: Partida, d: DatosBuscados, extra: z.infer<typeof datosExtra>): { texto: string; publico: string | null } {
  const b = estadoDe(p);
  const x = cartelPorId(p, d.id);
  if (!x) throw new Error(`No hay ningún cartel «${d.id}».`);
  if (!x.visible) throw new Error(`El cartel ${x.id} está oculto: nadie lo busca todavía.`);
  const pj = pjDe(p, d.quien);
  const n = b.pistas[x.id] ?? 0;
  if (n >= x.pistas.length) return { texto: `${x.nombre}: no quedan más pistas por averiguar. Lo último que se sabe: ${x.lugar} (${x.region}). Lo demás depende de lo que hagan los jugadores sobre el terreno.`, publico: null };
  const siguiente = x.pistas[n];
  const hab = extra.habilidad ?? (siguiente.capa === "erudito" ? "investigacion" : "persuasion");
  const cd = 8 + 2 * x.peligro + n + (siguiente.capa === "erudito" ? 1 : 0);
  // Ganchos de clase (sin cambiar su equilibrio): el Cazador de Brujas rastrea brujas y cultos («primero se rastrea»); el Degollador, a la presa que ya estudió.
  const cazador = pj.clase === "Cazador de Brujas" && (x.delito === "brujeria" || x.delito === "culto_prohibido");
  const presa = pj.clase === "Degollador" && !!pj.presa && [x.nombre, x.alias ?? ""].some((s) => s && norm(s) === norm(pj.presa!.objetivo));
  const r = resolverPrueba(p, { quien: pj.nombre, habilidad: hab, cd, motivo: `seguir el rastro de ${x.nombre}${siguiente.capa === "erudito" ? " en los archivos de la Casa de Registros" : " entre rumores de taberna"}`, ventaja: cazador || presa });
  const gancho = cazador ? " (Cazador de Brujas: ventaja, «primero se rastrea»)" : presa ? " (Degollador: ya estudió a su presa, ventaja)" : "";
  if (!r.exito) return { texto: `${r.texto}${gancho}\nFallo: nadie dice nada útil por ahora (se puede intentar otra vez con otra habilidad, un soborno o más tiempo).`, publico: r.texto };
  b.pistas[x.id] = n + 1;
  const cab = siguiente.capa === "erudito" ? "Archivos de la Casa de Registros" : "Rumor de taberna (puede estar deformado)";
  return { texto: `${r.texto}${gancho}\nPista ${n + 1}/${x.pistas.length} de ${x.nombre} — ${cab}: ${siguiente.texto}`, publico: `${r.texto}\n🔎 ${cab}: ${siguiente.texto}` };
}

function contratoDe(p: Partida, d: DatosBuscados): { b: EstadoBuscados; x: Buscado & { visible: boolean }; c: Contrato } {
  const b = estadoDe(p);
  const x = cartelPorId(p, d.id);
  if (!x) throw new Error(`No hay ningún cartel «${d.id}».`);
  const c = b.contratos[x.id];
  if (!c) throw new Error(`No hay un contrato de ${x.id} en curso: acéptalo primero (buscados {accion: aceptar, id, quien}).`);
  return { b, x, c };
}

function entregar(p: Partida, d: DatosBuscados, extra: z.infer<typeof datosExtra>): { texto: string; publico: string | null } {
  const { b, x, c } = contratoDe(p, d);
  const quien = d.quien ? pjDe(p, d.quien).nombre : c.quien;
  const estado = d.estado;
  if (!estado) throw new Error("Falta «estado»: vivo o muerto.");
  if (extra.equivocado) {
    delete b.contratos[x.id]; b.estados[x.id] = "activo";
    sumaRep(b, REP.equivocado);
    return { texto: `Falta grave: ${quien} entregó a quien no era ${x.nombre}. Sin pago; la Llama abre expediente. Reputación ${REP.equivocado} (${textoRango(b.rep)}). El buscado real sigue en libertad (cartel activo).`, publico: `⚖ ${quien} entregó al hombre equivocado: la Llama no paga y abre un expediente.` };
  }
  if (estado === "muerto" && !extra.pruebas) return { texto: `Sin pruebas no hay pago: para cobrar a un buscado muerto hay que presentar el cuerpo, la cabeza o su sello (datos {pruebas}). El contrato sigue en curso.`, publico: null };
  const rango = rangoLlama(b.rep);
  let base: number; let rep: number; let nota: string;
  if (estado === "vivo") { base = x.viva; rep = REP.vivo; nota = "entrega viva"; }
  else if (x.muerta === null) { base = Math.round(x.viva * PAGO_MINIMO); rep = REP.soloVivoMuerto; nota = "debía entregarse VIVO: solo se pagan los gastos de traslado"; }
  else { base = x.muerta; rep = REP.muerto; nota = "entrega muerto"; }
  const plus = estado === "muerto" && x.muerta === null ? 0 : rango.plus;
  const pago = Math.round(base * (1 + plus));
  delete b.contratos[x.id]; b.estados[x.id] = "entregado";
  sumaRep(b, rep);
  if (pago) { const pe = pendiente(p); pe.oro += pago; pe.avisos = 0; }
  return {
    texto: `${quien} entrega a ${x.nombre} (${nota}${extra.pruebas ? `; pruebas: ${extra.pruebas}` : ""}). Pago: ${pago} po${plus ? ` (+${Math.round(plus * 100)}% por ser ${rango.nombre})` : ""} (sugerido: súmalo con modificar_personaje {oro_cambio: ${pago}}; reparte entre el grupo). Reputación ${rep >= 0 ? "+" : ""}${rep}: ${textoRango(b.rep)}.`,
    publico: `📜 ${quien} entrega a ${x.nombre} (${estado}): ${pago} po. Reputación con la Llama: ${textoRango(b.rep)}.`,
  };
}

function cartelPropio(p: Partida, d: DatosBuscados): { texto: string; publico: string | null } {
  const b = estadoDe(p);
  const ex = cartelPorId(p, d.id);
  if (d.id && ex) { // actualizar: visible y poco más
    const propio = b.propios.find((y) => y.id === ex.id);
    if (!propio) throw new Error(`${ex.id} no es un cartel de la trama: solo se editan los que publicó el DM.`);
    const v = parsear(datosExtra, d.datos);
    if (v.visible !== undefined) propio.visible = v.visible;
    return { texto: `Cartel ${propio.id} (${propio.nombre}): ${propio.visible ? "VISIBLE para los jugadores" : "oculto"}.`, publico: propio.visible ? `📜 Un cartel nuevo en el tablón: ${textoCartel(propio)}.` : null };
  }
  const v = parsear(cartelSchema, d.datos);
  const delGrupo = esDelGrupo(p, v.nombre) || (!!v.alias && esDelGrupo(p, v.alias));
  if (delGrupo && v.visible === undefined) throw new Error(`${v.nombre} es del grupo: decide tú si el cartel es visible (visible: true o false). Solo tú decides si un personaje del grupo aparece en el tablón.`);
  if (b.propios.length >= MAX_PROPIOS) {
    const i = b.propios.findIndex((y) => ["entregado", "prescrito"].includes(estadoCartel(p, y.id)));
    if (i < 0) throw new Error(`Ya hay ${MAX_PROPIOS} carteles propios en curso: retira alguno (retirar {id}).`);
    const [fuera] = b.propios.splice(i, 1); delete b.estados[fuera.id]; delete b.pistas[fuera.id]; delete b.contratos[fuera.id];
  }
  const id = `P${String(++b.n.p).padStart(2, "0")}`;
  const region = regionDe(v.region ?? v.lugar) ?? tablonDe(p).region ?? R.aldenmar;
  const peligro = (v.peligro ?? 2) as 1 | 2 | 3 | 4 | 5;
  const muerta = v.solo_vivo ? null : v.muerta ?? Math.max(Math.ceil(v.viva / 2), Math.round(v.viva * FRACCION_MUERTO));
  if (muerta !== null && muerta < Math.ceil(v.viva / 2)) throw new Error("La recompensa por el muerto no puede ser menor que la mitad de la del vivo.");
  const pistas: Pista[] = [];
  if (v.pista_rumor) pistas.push({ capa: "rumor", texto: v.pista_rumor });
  if (v.pista_erudita) pistas.push({ capa: "erudito", texto: v.pista_erudita });
  const nuevo: CartelPropio = {
    id, nombre: v.nombre, ...(v.alias ? { alias: v.alias } : {}), delito: v.delito, descripcion: v.descripcion, region, lugar: v.lugar ?? region, peligro,
    viva: v.viva, muerta, plazo: v.plazo ?? null, perfil: { ...(v.nota ? { nota: v.nota } : {}) }, pistas,
    emisor: { oficial: v.firma, rango: v.rango_firma ?? "oficial de la Llama Gris", sello: SELLO }, visible: v.visible ?? true, dia: diaDe(p),
  };
  b.propios.push(nuevo);
  return {
    texto: `Cartel ${id} publicado${nuevo.visible ? "" : " (OCULTO: los jugadores no lo ven)"}${delGrupo ? ` — apunta a un personaje del grupo: no podrá cobrarlo nadie del grupo` : ""}. ${textoCartel(nuevo)}. Firma: ${nuevo.emisor.oficial}, ${nuevo.emisor.rango}.`,
    publico: nuevo.visible ? `📜 Un cartel nuevo en el tablón: ${textoCartel(nuevo)}.\n${nuevo.descripcion} Firma: ${nuevo.emisor.oficial}, ${nuevo.emisor.rango}.` : null,
  };
}

/** La herramienta `buscados`. Devuelve el texto para el DM y, si procede, el aviso para los jugadores (solo lo público). */
export function buscados(p: Partida, d: DatosBuscados): { texto: string; publico: string | null } {
  const extra = parsear(datosExtra, d.datos);
  const venc = revisarPlazos(p);
  const r = (() => {
    switch (d.accion) {
      case "ver": return ver(p, d, extra);
      case "detalle": return detalle(p, d.id);
      case "aceptar": return aceptar(p, d);
      case "pista": return pista(p, d, extra);
      case "capturar": {
        const { b, x, c } = contratoDe(p, d);
        b.estados[x.id] = "capturado";
        return { texto: `${c.quien} tiene a ${x.nombre} en custodia (sigue el plazo${c.vence !== null ? `: día ${c.vence}` : ""}). Entregarlo: buscados {accion: entregar, id, estado: vivo|muerto}. Si se escapa: abandonar.`, publico: `📜 ${c.quien} captura a ${x.nombre}.` };
      }
      case "entregar": return entregar(p, d, extra);
      case "abandonar": {
        const { b, x, c } = contratoDe(p, d);
        delete b.contratos[x.id]; b.estados[x.id] = "activo";
        return { texto: `${c.quien} abandona el contrato ${x.id} (${x.nombre}): sin pago ni castigo; el cartel vuelve al tablón.`, publico: `📜 ${c.quien} abandona el cartel de ${x.nombre}.` };
      }
      case "cartel": return cartelPropio(p, d);
      case "retirar": {
        const b = estadoDe(p);
        const x = cartelPorId(p, d.id);
        if (!x) throw new Error(`No hay ningún cartel «${d.id}».`);
        delete b.contratos[x.id]; b.estados[x.id] = "prescrito";
        return { texto: `Cartel ${x.id} (${x.nombre}) retirado: prescrito. Cualquier contrato abierto se cierra sin castigo.`, publico: x.visible ? `📜 Retiran el cartel de ${x.nombre}.` : null };
      }
    }
  })();
  return venc.length ? { texto: `${venc.join("\n")}\n${r.texto}`, publico: [...venc, r.publico].filter(Boolean).join("\n") } : r;
}

// ----------------------------------------------------------------------------------------------------------- reglas
export const REGLAS_BUSCADOS = `## Cazarrecompensas: el tablero de buscados de la Llama Gris (acción buscados)
- La Inquisición clava carteles con su sello en la Casa de Registros, los puertos, las plazas y las posadas de todas las regiones. Cada cartel: delito (herejía, apostasía, culto prohibido, contrabando de reliquias o sal, deserción de la Llama, asesinato de inquisidor o brujería), aspecto, última ubicación conocida, recompensa viva y muerta, plazo y la firma de quien lo emite.
- Acciones: ver (tablón del lugar actual: los carteles de su región y las circulares de peligro 4-5), detalle {id}, aceptar {id, quien}, pista {id, quien, datos:{habilidad?}}, capturar {id} (lo tienen en custodia), entregar {id, estado: vivo|muerto, quien?, datos:{pruebas?, equivocado?}}, abandonar {id}, cartel {datos:{…}} (publica un cartel de la trama), cartel {id, datos:{visible}} (lo muestra u oculta), retirar {id}. ver también acepta datos {region, todos, renovar}.
- Pistas por capas: cada cartel tiene hasta 3 (rumor de taberna, rumor, archivos de la Casa de Registros). pista tira una prueba del motor (Persuasión para rumores, Investigación para archivos; otra con datos.habilidad) contra CD 8 + 2×peligro + nº de pista (+1 en archivos). El Cazador de Brujas tiene ventaja contra brujas y cultos; el Degollador, contra la presa que estudió. Un fallo no cuesta la pista: se reintenta (con otra habilidad, un soborno o tiempo).
- Pago: vivo = recompensa viva; muerto = la reducida (60 %; nunca menos de la mitad) y exige pruebas (cuerpo, cabeza, sello); «solo vivo» y llega muerto = solo el 10 % (gastos) y reputación −2; entregar al hombre equivocado (datos.equivocado) = sin pago, falta grave (−4) y el cartel sigue activo. Plazo vencido = contrato fracasado (−1). Es una SUGERENCIA: el resultado trae oro_cambio y queda como botín pendiente; aplícalo tú con modificar_personaje y repártelo. Nunca cambia fichas.
- Reputación con la Llama (de la mesa): Sospechoso (≤ −3: solo peligro 1), Sin licencia (hasta 2 pts: peligro ≤ 2), Aspirante (3: peligro ≤ 3), Cazador licenciado (8: peligro ≤ 4, +10 % de pago), Cazador de la Llama (16: peligro 5, +20 %). Entrega viva +2, muerta +1.
- Cada cartel trae el perfil para el combate con fichas que ya existen: PNJ sin ficha (iniciativa pnj: ataque, CA, PV, veteranía) o criatura del bestiario, con su escolta. No inventes mecánicas nuevas.
- Carteles de la trama: cartel {datos:{nombre, delito, descripcion, viva, firma, rango_firma?, peligro?, plazo?, solo_vivo?, muerta?, lugar?, pista_rumor?, pista_erudita?, visible}}. SOLO tú decides si un personaje del grupo aparece (visible es obligatorio si apunta a uno: true = lo ven en el tablón; false = oculto); sus compañeros no pueden cobrar su cabeza (hazlo con cazadores PNJ, encuentro «cazarrecompensas»). Detalle y ejemplo: docs/BUSCADOS.md.
- El tablero se renueva solo: cada día del mundo puede aparecer un cartel generado en la región.
- No reveles secretos de regentes ni capas restringidas o secretas: los carteles solo llevan lo público, el rumor y lo erudito.`;
