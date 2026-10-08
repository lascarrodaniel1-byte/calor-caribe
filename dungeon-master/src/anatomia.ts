// Anatomía de las heridas: cada herida cae sobre una estructura concreta, y la
// estructura decide la zona vital (verde, ámbar o roja) y cómo mata o incapacita.
//
// - Roja: sangrado masivo o daño vital donde una mano no llega a comprimir.
//   No da minutos: da UN minuto (10 asaltos) como mucho, a veces menos.
// - Ámbar: se sobrevive, pero cuesta: recuperación larga y secuelas
//   irreversibles. Sin tratamiento pasa a roja (en asaltos si sangra, en días
//   si son vísceras). Nervios y tendones incapacitan.
// - Verde: casi ninguna. Piel y músculo grueso. Sin cuidados, se complica.
import { tirar } from "./dados.js";

export type ZonaVital = "verde" | "ambar" | "roja";
export type Region = "cabeza" | "cuello" | "torso" | "abdomen" | "brazo" | "pierna";

export interface Estructura {
  nombre: string;
  region: Region;
  zona: ZonaVital;
  efecto: string;
  /** Roja: asaltos de vida (máx. 10) si no se detiene la hemorragia. */
  reloj?: string;
  /** Se puede comprimir o hacer torniquete (detener hemorragia con esta CD). Si no existe, no hay dónde apretar. */
  compresion?: { cd: number; como: string };
  /** Ámbar sangrante: asaltos hasta volverse roja si no se comprime. */
  escalada?: string;
  /** Ámbar visceral o craneal: sin cirugía empeora día a día hasta volverse roja. */
  visceral?: boolean;
  /** Costilla rota: con esfuerzo puede perforar el pulmón. */
  costilla?: boolean;
  /** Deja inconsciente al recibirla. */
  inconsciente?: boolean;
  /** Secuelas propias de la estructura (sustituyen a las genéricas de la región). */
  secuelas?: { menor: string; permanente: string };
}

export const ESTRUCTURAS: Estructura[] = [
  // ------------------------------------------------------------------ verde
  { nombre: "cuero cabelludo", region: "cabeza", zona: "verde", efecto: "sangra escandalosamente pero sin peligro; sangre en los ojos (desventaja en ataques a distancia hasta limpiarse)" },
  { nombre: "piel del cuello", region: "cuello", zona: "verde", efecto: "el filo no llegó a los vasos: corte superficial y mucho miedo" },
  { nombre: "músculo pectoral o dorsal", region: "torso", zona: "verde", efecto: "dolor al mover los brazos" },
  { nombre: "pared abdominal", region: "abdomen", zona: "verde", efecto: "dolor al doblarse; no ha entrado en la cavidad" },
  { nombre: "músculo del brazo", region: "brazo", zona: "verde", efecto: "dolor al golpear" },
  { nombre: "músculo del muslo o glúteo", region: "pierna", zona: "verde", efecto: "dolor al correr" },
  { nombre: "piel y tejido superficial", region: "brazo", zona: "verde", efecto: "corte o raspón aparatoso" },
  { nombre: "piel y tejido superficial", region: "pierna", zona: "verde", efecto: "corte o raspón aparatoso" },

  // ------------------------------------------------------------------ ámbar
  {
    nombre: "cráneo fracturado (sin lesión cerebral)",
    region: "cabeza",
    zona: "ambar",
    efecto: "aturdido 1 asalto; desventaja en pruebas de INT y SAB; sin cirugía, la sangre se acumula dentro del cráneo",
    visceral: true,
    secuelas: { menor: "migrañas y mareos al esforzarse", permanente: "daño en el cerebro por la presión: −2 INT" },
  },
  {
    nombre: "ojo",
    region: "cabeza",
    zona: "ambar",
    efecto: "ve solo con un ojo: desventaja en Percepción visual y en ataques a distancia",
    secuelas: { menor: "visión borrosa en ese ojo", permanente: "ojo perdido" },
  },
  {
    nombre: "arteria carótida",
    region: "cuello",
    zona: "ambar",
    efecto: "chorro de sangre a cada latido; mareo inmediato",
    compresion: { cd: 15, como: "presión directa con los dedos en el cuello" },
    escalada: "2d4",
    secuelas: { menor: "debilidad en un lado del cuerpo", permanente: "parálisis parcial de un lado: −2 DES y desventaja con la mano de ese lado" },
  },
  {
    nombre: "venas yugulares",
    region: "cuello",
    zona: "ambar",
    efecto: "sangrado oscuro y continuo; riesgo de que entre aire en la vena",
    compresion: { cd: 13, como: "presión firme sobre la herida" },
    escalada: "2d6",
    secuelas: { menor: "cicatriz gruesa en el cuello", permanente: "voz rota y ronca para siempre" },
  },
  {
    nombre: "tráquea",
    region: "cuello",
    zona: "ambar",
    efecto: "silba al respirar, no puede hablar ni lanzar conjuros verbales; desventaja en salvaciones de CON",
    secuelas: { menor: "voz ronca", permanente: "mudo: no puede hablar" },
  },
  {
    nombre: "costillas rotas",
    region: "torso",
    zona: "ambar",
    efecto: "dolor brutal al respirar: desventaja en ataques, Atletismo y salvaciones de CON; si se esfuerza, una costilla puede perforar el pulmón",
    costilla: true,
    secuelas: { menor: "costillas mal soldadas: desventaja en Atletismo para trepar o nadar", permanente: "pecho hundido: −1 CON" },
  },
  {
    nombre: "intestino",
    region: "abdomen",
    zona: "ambar",
    efecto: "dolor sordo, fiebre que llegará; no puede comer. Sin cirugía, la peritonitis lo matará en días",
    visceral: true,
    secuelas: { menor: "digestión dañada: necesita el doble de raciones", permanente: "entrañas rotas: desventaja en salvaciones contra veneno y enfermedad, y −1 CON" },
  },
  {
    nombre: "hígado",
    region: "abdomen",
    zona: "ambar",
    efecto: "sangra por dentro despacio; piel amarillenta. Sin cirugía o curación, muere en días",
    visceral: true,
    secuelas: { menor: "no tolera el alcohol ni los venenos: desventaja contra veneno", permanente: "hígado roto: −2 CON" },
  },
  {
    nombre: "bazo",
    region: "abdomen",
    zona: "ambar",
    efecto: "dolor en el costado izquierdo; puede reventar en cualquier momento",
    visceral: true,
    secuelas: { menor: "debilidad ante las fiebres", permanente: "sin bazo: desventaja contra infección y enfermedad para siempre" },
  },
  {
    nombre: "páncreas",
    region: "abdomen",
    zona: "ambar",
    efecto: "dolor que atraviesa hasta la espalda, vómitos; empeora cada día",
    visceral: true,
    secuelas: { menor: "dolor al comer", permanente: "se consume poco a poco: −2 CON" },
  },
  {
    nombre: "plexo braquial",
    region: "brazo",
    zona: "ambar",
    efecto: "EL BRAZO NO RESPONDE: no puede sostener arma, escudo ni objeto con él",
    secuelas: { menor: "brazo débil y torpe: desventaja en ataques con él", permanente: "brazo muerto: cuelga inerte para siempre" },
  },
  {
    nombre: "tendones del antebrazo y la mano",
    region: "brazo",
    zona: "ambar",
    efecto: "LA MANO NO CIERRA: no puede empuñar con ella; un espadachín no puede usar su arma",
    secuelas: { menor: "agarre débil: −2 a los ataques con esa mano", permanente: "mano en garra: no puede empuñar con ella" },
  },
  {
    nombre: "arteria braquial",
    region: "brazo",
    zona: "ambar",
    efecto: "sangrado arterial en el brazo",
    compresion: { cd: 11, como: "torniquete por encima de la herida" },
    escalada: "3d6",
    secuelas: { menor: "mano fría y entumecida", permanente: "brazo amputado por la falta de riego" },
  },
  {
    nombre: "nervio ciático",
    region: "pierna",
    zona: "ambar",
    efecto: "LA PIERNA NO RESPONDE: no puede caminar sin apoyo (velocidad 1,5 m); cae derribado",
    secuelas: { menor: "pie caído: cojera, velocidad −3 m", permanente: "pierna muerta: no puede caminar sin muleta" },
  },
  {
    nombre: "tendón de Aquiles o rotuliano",
    region: "pierna",
    zona: "ambar",
    efecto: "NO PUEDE CAMINAR con esa pierna; derribado",
    secuelas: { menor: "cojera: velocidad −1,5 m y no puede correr", permanente: "pierna rígida: velocidad −3 m, desventaja en DES" },
  },
  {
    nombre: "arteria poplítea",
    region: "pierna",
    zona: "ambar",
    efecto: "sangrado arterial detrás de la rodilla",
    compresion: { cd: 12, como: "torniquete en el muslo" },
    escalada: "3d6",
    secuelas: { menor: "pie frío y entumecido", permanente: "pierna amputada por la falta de riego" },
  },

  // ------------------------------------------------------------------ roja
  { nombre: "encéfalo", region: "cabeza", zona: "roja", efecto: "el cerebro está abierto", reloj: "10", inconsciente: true },
  { nombre: "cerebelo", region: "cabeza", zona: "roja", efecto: "convulsiones; no puede mantenerse en pie", reloj: "2d6", inconsciente: true },
  { nombre: "tallo cerebral", region: "cabeza", zona: "roja", efecto: "el cuerpo se apaga", reloj: "1d4", inconsciente: true },
  { nombre: "corazón", region: "torso", zona: "roja", efecto: "el pecho se llena de sangre", reloj: "1d4" },
  { nombre: "aorta", region: "torso", zona: "roja", efecto: "la gran arteria se vacía dentro del pecho", reloj: "1d6" },
  { nombre: "vena cava", region: "torso", zona: "roja", efecto: "hemorragia masiva dentro del pecho", reloj: "2d4" },
  { nombre: "arteria o vena pulmonar", region: "torso", zona: "roja", efecto: "tose sangre a borbotones; se ahoga en ella", reloj: "2d4" },
  { nombre: "pulmón perforado", region: "torso", zona: "roja", efecto: "el pecho se llena de aire y sangre; se asfixia", reloj: "10" },
  {
    nombre: "arteria subclavia",
    region: "torso",
    zona: "roja",
    efecto: "sangrado bajo la clavícula, donde apenas se puede apretar",
    reloj: "2d6",
    compresion: { cd: 18, como: "hundir el puño detrás de la clavícula" },
  },
  { nombre: "hemorragia visceral masiva", region: "abdomen", zona: "roja", efecto: "hígado o bazo reventados: el vientre se hincha de sangre", reloj: "10" },
  {
    nombre: "arteria axilar",
    region: "brazo",
    zona: "roja",
    efecto: "sangrado arterial en la raíz del brazo",
    reloj: "2d6",
    compresion: { cd: 16, como: "presión brutal en la axila" },
  },
  {
    nombre: "arteria femoral",
    region: "pierna",
    zona: "roja",
    efecto: "la sangre sale a chorros del muslo",
    reloj: "2d6",
    compresion: { cd: 15, como: "torniquete alto en la ingle" },
  },
  {
    nombre: "isquiotibiales y femoral profunda",
    region: "pierna",
    zona: "roja",
    efecto: "tajo profundo detrás del muslo que abre la femoral profunda",
    reloj: "2d6",
    compresion: { cd: 17, como: "torniquete alto y presión con todo el peso" },
  },
];

/** Probabilidad (%) de cada zona según la gravedad tirada. */
const ZONA_POR_GRAVEDAD: Record<string, [number, ZonaVital][]> = {
  leve: [[100, "verde"]],
  moderada: [[60, "verde"], [100, "ambar"]],
  grave: [[10, "verde"], [80, "ambar"], [100, "roja"]],
  critica: [[40, "ambar"], [100, "roja"]],
};

export function buscarEstructura(nombre: string): Estructura | undefined {
  const n = nombre.toLowerCase();
  return ESTRUCTURAS.find((e) => e.nombre.toLowerCase() === n) ?? ESTRUCTURAS.find((e) => e.nombre.toLowerCase().includes(n));
}

/** Elige la estructura afectada según la región y la gravedad tiradas. */
export function elegirEstructura(region: Region, gravedad: string, forzada?: ZonaVital): { estructura: Estructura; tirada?: number } {
  let tirada: number | undefined;
  let zona = forzada;
  if (!zona) {
    tirada = tirar("1d100").total;
    zona = ZONA_POR_GRAVEDAD[gravedad].find(([max]) => tirada! <= max)![1];
  }
  // Si la región no tiene estructuras de esa zona (p. ej. un cuello rojo), baja a la siguiente.
  const orden: ZonaVital[] = zona === "roja" ? ["roja", "ambar", "verde"] : zona === "ambar" ? ["ambar", "verde"] : ["verde"];
  for (const z of orden) {
    const opciones = ESTRUCTURAS.filter((e) => e.region === region && e.zona === z);
    if (opciones.length) return { estructura: opciones.length === 1 ? opciones[0] : opciones[tirar(`1d${opciones.length}`).total - 1], tirada };
  }
  return { estructura: ESTRUCTURAS[0], tirada };
}

export const RELOJ_MAX = 10;

/** Tira un valor que puede ser un número fijo ("10") o dados ("2d6"). */
export const tirarValor = (v: string) => (/^\d+$/.test(v) ? Number(v) : tirar(v).total);
