// Bestiario: criaturas de referencia y jefes. Es una BASE: el DM puede crear
// criaturas y habilidades nuevas con la misma estructura en cualquier momento.
import { danoEnSuelo, muerteInstantanea } from "./muerte.js";
import { agregarCondicion, textoEfectos } from "./condiciones.js";
import { describir, tirar } from "./dados.js";
import type { Partida, Personaje } from "./estado.js";
import { infligir, perderSangre, type Causa } from "./heridas.js";
import { clase, raza } from "./mundo.js";
import { ATRIBUTOS, marcarMuerto, salvacion, valor, type Atributo } from "./reglas.js";

import { danoConResistencia } from "./rasgos.js";
export interface Habilidad {
  nombre: string;
  descripcion: string;
  /** Salvación que deben hacer los objetivos (si no hay, el efecto se aplica sin tirada). */
  salvacion?: Atributo;
  cd?: number;
  dano?: string;
  tipo_dano?: string;
  mitad_si_exito?: boolean;
  /** Muerte instantánea si se falla la salvación por este margen o más (0 = cualquier fallo). */
  muerte_si_falla_por?: number;
  /** Condición que sufre quien falla (sin morir). */
  condicion?: string;
  /** Herida que causa al fallar (usa la tabla de esa causa). */
  herida?: Causa;
  /** Puntos de sangre perdida al fallar (riesgo de anemia). */
  sangre?: number;
  ceniza?: number;
  /** Recarga: la habilidad vuelve con este número o más en 1d6 (p. ej. 5 = recarga 5-6). */
  recarga?: number;
  /**
   * Robo de esencia: dados de puntos que roba del atributo más alto de quien falla.
   * La criatura gana además los rasgos de raza y clase de la víctima. Si un atributo
   * llega a 0, la víctima muere. Todo vuelve a sus dueños cuando la criatura muere.
   */
  robo?: string;
}

/** El trasfondo de un jefe: lo establecido (canon) y lo propuesto aún por confirmar. */
export interface Trasfondo {
  /** Su historia, tal y como está establecida. */
  origen: string;
  /** Con quién está enemistado y por qué (establecido). */
  enemigos?: string;
  /** Propuestas para completarlo, sin confirmar: el DM puede usarlas con criterio hasta que se decida. */
  propuesto?: string[];
  /** Preguntas aún abiertas sobre él. */
  abierto?: string[];
  /** Cómo revelar su historia poco a poco (pistas, rumores, objetos). */
  pistas?: string[];
  /** Una misión lista para jugar que resuelve una de sus preguntas abiertas y lo empalma con la historia. */
  mision?: {
    nombre: string;
    /** Estado: «propuesta» hasta que se confirme. */
    estado: string;
    inicio: string;
    nudo: string;
    desenlaces: string[];
    pnjs: string[];
    ganchos: string[];
  };
}

/** Un regente manda sobre un dominio: no está solo, envía a sus subordinados a cumplir su voluntad y, en persona, va con su séquito. */
export interface Regente {
  /** Lo que gobierna: «la Inquisición de la Llama Gris», «la Corte Pálida»… */
  titulo: string;
  /** Cómo manda: su corte, su forma de dar órdenes. */
  corte: string;
  servidores: { nombre: string; /** Plantilla del bestiario, si la hay (si no, se improvisa con pnj/iniciativa). */ plantilla?: string; cuantos: string; nota: string }[];
  /** Cómo inciden políticamente fuera de su dominio para imponerse. */
  politica?: { objetivo: string; medios: string[]; agentes: string[] };
}

export interface Criatura {
  nombre: string;
  /** Otros nombres con los que se la busca (hombre lobo, etc.). */
  alias?: string[];
  /** Su historia: origen, enemistades, pistas para revelarla. Solo la conoce el DM. */
  trasfondo?: Trasfondo;
  /** Si gobierna un dominio: sus subordinados, y que puede enviarlos o llevarlos consigo. */
  regente?: Regente;
  categoria: "bestia" | "monstruo" | "jefe";
  /** 1 (peligro común) a 5 (mata a un grupo entero si se descuida). */
  peligro: 1 | 2 | 3 | 4 | 5;
  /** Valor de desafío (VD) orientativo, derivado del peligro. Es informativo: las reglas siguen usando el peligro. */
  vd?: string;
  /** Estilos de artes marciales que domina (ids de estilos.ts); «todos» = los domina todos (Kuru). */
  artes?: string[];
  region: string;
  descripcion: string;
  ca: number;
  pv: string;
  velocidad: string;
  atributos: string;
  ataques: string[];
  rasgos: string[];
  habilidades: Habilidad[];
  botin?: string;
  /** Ve el futuro: número de presagios (d20 tirados de antemano) con que empieza el combate. */
  presagios?: number;
  /** Carácter en combate (ver TEMPLES en combate.ts): no-muerto torpe, no-muerto, vampiro, espectro, bestia… */
  temple?: string;
  /** Carácter en combate (arrogante, calculador…): ver PERSONALIDADES en combate.ts. */
  personalidad?: string[];
  /** Armadura o piel (ver PIEZAS en armadura.ts): escamas_naturales, pellejo, hueso, placas_completas… */
  blindaje?: string[];
}

export interface Robo {
  personaje: string;
  atributo: Atributo;
  cantidad: number;
  raza: string;
  clase: string;
}

export interface EstadoJefe {
  nombre: string;
  /** Almas selladas por un Segador: poderes o rasgos que no puede usar. */
  sellos?: import("./segador_base.js").Sello[];
  pv: number;
  pv_max: number;
  /** Habilidades con recarga gastadas. */
  gastadas: string[];
  definicion: Criatura;
  /** Resultados de d20 ya "vistos" que puede usar en lugar de cualquier tirada. */
  presagios: number[];
  robos: Robo[];
  /** Condiciones que sufre ahora (ver condiciones.ts). */
  condiciones?: string[];
  /** Marcas de Ceniza permanentes (las que deja la furia de un Berserker). */
  ceniza?: number;
}

export const BESTIARIO: Criatura[] = [
  // ------------------------------------------------------------ comunes
  {
    nombre: "Hambriento",
    temple: "no-muerto torpe",
    categoria: "monstruo",
    peligro: 1,
    region: "Cualquiera; en manadas en la Marca Hueca",
    descripcion: "Muerto alzado, lento y torpe, que no deja de masticar aunque le falte la mandíbula.",
    ca: 8,
    pv: "4d8+8",
    velocidad: "6 m",
    atributos: "FUE 13 DES 6 CON 16 INT 3 SAB 6 CAR 5",
    ataques: ["Mordisco: +3, 1d6+1 perforante; puede transmitir la Podre (de_no_muerto, cd_podre 11)", "Agarrón: +3, apresado (CD 11)"],
    rasgos: ["Tenacidad de los muertos: al caer a 0 PV, salvación de CON CD 5 + daño o se queda con 1 PV (no con fuego ni críticos)", "Manada: ventaja si hay otro Hambriento adyacente al objetivo"],
    habilidades: [],
    botin: "Lo que llevaba en vida: monedas, un anillo, una carta sin enviar",
  },
  {
    nombre: "Lobo de Ceniza",
    temple: "bestia",
    categoria: "bestia",
    peligro: 1,
    region: "Bosque de Velo Rojo, caminos de la Marca",
    descripcion: "Lobo flaco de pelaje gris ceniza y ojos de brasa. Caza en jauría y siempre va a por el más débil.",
    ca: 13,
    pv: "2d8+2",
    velocidad: "12 m",
    atributos: "FUE 12 DES 15 CON 12 INT 3 SAB 12 CAR 6",
    ataques: ["Mordisco: +4, 2d4+2 perforante; FUE CD 11 o derribado"],
    rasgos: ["Táctica de jauría", "Olfato y oído agudos"],
    habilidades: [],
  },
  {
    nombre: "Ghul de las fosas",
    temple: "no-muerto",
    categoria: "monstruo",
    peligro: 2,
    region: "Fosas comunes de Aldenmar, cementerios",
    descripcion: "Devorador de cadáveres de uñas negras. Su toque paraliza; prefiere comerse a las presas vivas.",
    ca: 12,
    pv: "5d8",
    velocidad: "9 m",
    atributos: "FUE 13 DES 15 CON 10 INT 7 SAB 10 CAR 6",
    ataques: ["Mordisco: +2, 2d6+2 perforante (Podre, cd_podre 13)", "Garras: +4, 2d4+2 cortante"],
    rasgos: ["Visión en la oscuridad"],
    habilidades: [
      { nombre: "Toque paralizante", descripcion: "Al acertar con las garras.", salvacion: "con", cd: 10, condicion: "paralizado 1 minuto (repite al final de cada turno)" },
    ],
  },
  {
    nombre: "Ogro",
    blindaje: ["pellejo", "cuero"],
    personalidad: ["confiado"],
    categoria: "monstruo",
    peligro: 2,
    region: "Colinas, caminos sin ley, al servicio de señores de la guerra",
    descripcion: "Tres metros de hambre y mala leche. Lleva un tronco por garrote y cráneos por collar.",
    ca: 11,
    pv: "7d10+21",
    velocidad: "12 m",
    atributos: "FUE 19 DES 8 CON 16 INT 5 SAB 7 CAR 7",
    ataques: ["Garrote: +6, 2d8+4 contundente", "Jabalina: +6, 2d6+4 perforante"],
    rasgos: ["Huesos rotos: sus críticos causan herida con causa golpe_masivo"],
    habilidades: [
      { nombre: "Barrido", descripcion: "Gira el garrote contra todos los adyacentes.", salvacion: "des", cd: 14, dano: "2d8+4", tipo_dano: "contundente", mitad_si_exito: true, condicion: "derribado", recarga: 5 },
    ],
  },
  {
    nombre: "Troll de ciénaga",
    blindaje: ["pellejo"],
    personalidad: ["impulsivo"],
    temple: "bestia",
    categoria: "monstruo",
    peligro: 3,
    region: "Ciénagas de Hollín",
    descripcion: "Larguirucho, verdoso, cubierto de musgo y sanguijuelas. Si le cortas un brazo, el brazo sigue peleando.",
    ca: 15,
    pv: "8d10+40",
    velocidad: "9 m, nadar 9 m",
    atributos: "FUE 18 DES 13 CON 20 INT 7 SAB 9 CAR 7",
    ataques: ["Mordisco: +7, 1d6+4 perforante", "Garras (x2): +7, 2d6+4 cortante"],
    rasgos: ["Regeneración: recupera 10 PV al inicio de su turno salvo que haya recibido fuego o ácido; solo muere si empieza su turno a 0 PV sin regenerar"],
    habilidades: [
      { nombre: "Desgarro", descripcion: "Si acierta con ambas garras, desgarra la carne.", salvacion: "con", cd: 15, herida: "golpe_masivo", sangre: 6 },
    ],
  },
  {
    nombre: "Wyverno",
    blindaje: ["pellejo"],
    temple: "bestia",
    categoria: "monstruo",
    peligro: 3,
    region: "Riscos de las Agujas de Vahl, cielos de la Marca",
    descripcion: "Primo bestial del dragón: alas membranosas, mandíbulas enormes y una cola con un aguijón del tamaño de una espada.",
    ca: 13,
    pv: "13d10+39",
    velocidad: "6 m, volar 24 m",
    atributos: "FUE 19 DES 10 CON 16 INT 5 SAB 12 CAR 6",
    ataques: ["Mordisco: +7, 2d6+4 perforante", "Garras: +7, 2d8+4 cortante; puede llevarse volando a un objetivo Mediano apresado"],
    rasgos: ["Ataque en picado: si vuela al menos 9 m en línea recta, +2d6 al primer ataque"],
    habilidades: [
      { nombre: "Aguijón venenoso", descripcion: "Ataque de cola (+7, 2d6+4 perforante) y veneno.", salvacion: "con", cd: 15, dano: "7d6", tipo_dano: "veneno", mitad_si_exito: true, muerte_si_falla_por: 10, condicion: "envenenado" },
      { nombre: "Soltar desde lo alto", descripcion: "Suelta a la presa que lleva en las garras desde 18 m de altura.", salvacion: "des", cd: 14, dano: "6d6", tipo_dano: "contundente", mitad_si_exito: true, herida: "golpe_masivo" },
    ],
  },
  {
    nombre: "Basilisco",
    blindaje: ["escamas_naturales"],
    temple: "bestia",
    categoria: "monstruo",
    peligro: 3,
    region: "Cuevas bajo Karak-Dûm, ruinas antiguas",
    descripcion: "Reptil de ocho patas lleno de estatuas a su alrededor: sus anteriores visitantes.",
    ca: 15,
    pv: "8d8+16",
    velocidad: "6 m",
    atributos: "FUE 16 DES 8 CON 15 INT 2 SAB 8 CAR 7",
    ataques: ["Mordisco: +5, 2d6+3 perforante + 2d6 veneno"],
    rasgos: ["Quien aparta la mirada tiene desventaja en sus ataques contra él, pero evita la Mirada"],
    habilidades: [
      { nombre: "Mirada petrificante", descripcion: "Quien empiece su turno mirándolo.", salvacion: "con", cd: 13, condicion: "petrificándose (si falla otra vez el próximo turno, queda de piedra)", muerte_si_falla_por: 10 },
    ],
  },
  {
    nombre: "Mantícora",
    blindaje: ["pellejo"],
    personalidad: ["impulsivo"],
    temple: "bestia",
    categoria: "monstruo",
    peligro: 3,
    region: "Páramos de la Marca Hueca",
    descripcion: "Cuerpo de león, alas de murciélago y un rostro casi humano que se burla de sus presas mientras las mata.",
    ca: 14,
    pv: "8d10+24",
    velocidad: "9 m, volar 15 m",
    atributos: "FUE 17 DES 16 CON 17 INT 7 SAB 12 CAR 8",
    ataques: ["Mordisco: +5, 1d8+3", "Garras: +5, 1d6+3"],
    rasgos: ["Habla y negocia; prefiere jugar con la comida"],
    habilidades: [
      { nombre: "Lluvia de púas", descripcion: "Dispara púas de la cola contra hasta 3 objetivos.", salvacion: "des", cd: 14, dano: "3d8", tipo_dano: "perforante", mitad_si_exito: true, sangre: 3, recarga: 5 },
    ],
  },
  {
    nombre: "Banshee del Velo",
    temple: "espectro",
    categoria: "monstruo",
    peligro: 3,
    region: "Bosque de Velo Rojo",
    descripcion: "El espíritu de una elfa que murió con el bosque. Llora con la voz de quien más quieres.",
    ca: 12,
    pv: "13d8",
    velocidad: "0 m, volar 12 m (incorpórea)",
    atributos: "FUE 1 DES 14 CON 10 INT 12 SAB 11 CAR 17",
    ataques: ["Toque marchito: +4, 3d6+2 necrótico"],
    rasgos: ["Incorpórea: resistencia al daño no mágico; inmune a necrótico"],
    habilidades: [
      { nombre: "Lamento", descripcion: "Una vez al día; todos los que la oigan a 9 m.", salvacion: "con", cd: 13, dano: "3d6", tipo_dano: "psíquico", muerte_si_falla_por: 5 },
    ],
  },
  {
    nombre: "Gigante de hueso",
    blindaje: ["hueso"],
    temple: "no-muerto torpe",
    categoria: "monstruo",
    peligro: 4,
    region: "Campos de batalla de la Marca Hueca",
    descripcion: "Cientos de esqueletos fundidos en un coloso de seis metros. Los cráneos de su pecho aún gritan.",
    ca: 16,
    pv: "15d12+60",
    velocidad: "12 m",
    atributos: "FUE 23 DES 9 CON 19 INT 6 SAB 10 CAR 5",
    ataques: ["Puño de huesos (x2): +10, 3d8+6 contundente", "Roca: +10, 4d10+6"],
    rasgos: ["Vulnerable al daño contundente", "Inmune a veneno y miedo"],
    habilidades: [
      { nombre: "Pisotón", descripcion: "Aplasta a un objetivo derribado.", salvacion: "des", cd: 17, dano: "6d10", tipo_dano: "contundente", herida: "golpe_masivo", muerte_si_falla_por: 10 },
    ],
  },
  {
    nombre: "Dragón joven de ceniza",
    blindaje: ["escamas_naturales"],
    temple: "bestia",
    categoria: "monstruo",
    peligro: 4,
    region: "Cumbres y ruinas; anidan en templos de dioses muertos",
    descripcion: "Un dragón que creció lamiendo el cadáver de un dios. Sus escamas son grises y su aliento, fuego mezclado con ceniza sagrada.",
    ca: 18,
    pv: "17d10+85",
    velocidad: "12 m, volar 24 m",
    atributos: "FUE 23 DES 10 CON 21 INT 14 SAB 11 CAR 19",
    ataques: ["Mordisco: +10, 2d10+6 perforante + 1d8 fuego", "Garras (x2): +10, 2d6+6 cortante"],
    rasgos: ["Inmune al fuego", "Presencia terrible: SAB CD 16 o asustado 1 minuto"],
    habilidades: [
      { nombre: "Aliento de ceniza", descripcion: "Cono de 9 m.", salvacion: "des", cd: 17, dano: "16d6", tipo_dano: "fuego", mitad_si_exito: true, ceniza: 1, recarga: 5 },
    ],
    botin: "Tesoro de dragón: monedas antiguas, reliquias, armas de los que intentaron matarlo",
  },
  {
    nombre: "Apóstol",
    personalidad: ["arrogante"],
    categoria: "monstruo",
    peligro: 4,
    region: "Cualquiera: vive entre los humanos con su antigua forma",
    descripcion:
      "Alguien que despertó un behelit y sacrificó lo que amaba. De día parece un noble, un monje o un mercader; de noche, su forma verdadera es una pesadilla de carne del tamaño de una casa. Plantilla: adáptala a quien era.",
    ca: 16,
    pv: "18d12+90",
    velocidad: "12 m",
    atributos: "FUE 24 DES 14 CON 22 INT 12 SAB 12 CAR 16",
    ataques: ["Forma demoníaca (x3): +11, 3d10+7 del tipo que encaje con su forma", "Mordisco: +11, 4d8+7 perforante"],
    rasgos: ["Regeneración 10 salvo fuego o armas de plata", "Forma humana: puede volver a ella a voluntad", "Inmune a miedo y veneno", "La marca del sacrificio de los marcados sangra en su presencia"],
    habilidades: [
      { nombre: "Devorar", descripcion: "Contra un objetivo apresado o derribado.", salvacion: "con", cd: 18, dano: "6d10", tipo_dano: "perforante", herida: "critico", muerte_si_falla_por: 10 },
      { nombre: "Horror verdadero", descripcion: "Muestra su forma verdadera por primera vez.", salvacion: "sab", cd: 16, condicion: "asustado 1 minuto" },
    ],
  },
  {
    nombre: "Lich",
    temple: "no-muerto",
    personalidad: ["calculador"],
    blindaje: ["hueso"],
    categoria: "monstruo",
    peligro: 5,
    region: "La Marca Hueca (criptas y castillos en ruinas) y cualquier tumba de un mago antiguo",
    descripcion:
      "Un hechicero que se negó a morir. Tras la Caída vació su cuerpo con magia negra y selló su alma en un relicario hecho con un hueso de dios; lo que camina es una túnica, una corona y unos ojos que ya no parpadean. Paciente, educado y sin prisa: tiene siglos para esperar y la Podre a su servicio. Plantilla: adáptala al mago que fue.",
    ca: 18,
    pv: "22d8+66",
    velocidad: "9 m",
    atributos: "FUE 11 DES 16 CON 16 INT 21 SAB 14 CAR 18",
    ataques: ["Toque gélido: +11, 3d8+4 necrótico y la víctima queda con agotamiento 1 si falla CON CD 17", "Bastón de hueso: +8, 1d8+2 contundente"],
    rasgos: [
      "Relicario: mientras su relicario exista, si lo destruyen se reforma junto a él en 1d10 días, con todos sus PV. Para acabar con él hay que encontrar y romper el relicario (guárdalo en un lugar ligado a su historia) y darle el rito de sal y fuego a sus restos",
      "No-muerto: inmune a veneno, miedo, hechizo, sueño y agotamiento; no necesita comer, beber ni respirar",
      "Resistencia a la magia: ventaja en sus salvaciones contra hechizos y efectos mágicos; resiste el daño de corte, punta y contundente no mágico",
      "Vulnerable al fuego de la Llama Gris y al Rayo de luz solar primigenia (doble daño); la sal en círculo le impide cruzar",
      "Aura de sepulcro: a 3 m de él, nadie recupera PV con curación y las llamas se apagan",
    ],
    habilidades: [
      { nombre: "Rayo de muerte", descripcion: "Un rayo de negrura desde el dedo extendido, a 36 m.", salvacion: "con", cd: 18, dano: "8d6", tipo_dano: "necrótico", mitad_si_exito: true, recarga: 5 },
      { nombre: "Palabra de parálisis", descripcion: "Pronuncia una palabra que nadie debería entender; un objetivo a 18 m.", salvacion: "sab", cd: 17, condicion: "paralizado 1 minuto", recarga: 5 },
      { nombre: "Alzar a los muertos", descripcion: "Levanta 1d4+1 Hambrientos de los cadáveres cercanos en la ronda siguiente (aparecer_criatura con la plantilla Hambriento); una vez por combate." },
      { nombre: "Tocar la vida", descripcion: "Toca a un objetivo y le arrebata el calor del cuerpo.", salvacion: "con", cd: 17, dano: "6d8", tipo_dano: "necrótico", mitad_si_exito: true, ceniza: 1 },
    ],
    botin: "Su relicario (un hueso de dios engarzado: valioso y peligroso), grimorios de magia negra, su corona y su bastón de hueso, y las riquezas que acumuló en siglos",
  },
  {
    nombre: "Wendigo",
    temple: "bestia",
    personalidad: ["temerario"],
    blindaje: ["pellejo"],
    categoria: "monstruo",
    peligro: 4,
    region: "Las Agujas de Vahl y el Bosque de Velo Rojo, en inviernos largos y años de hambruna",
    descripcion:
      "Alguien que comió carne de los suyos para sobrevivir al hambre y no volvió a saciarse. Alto, famélico, con la piel pegada a las costillas y astas de hueso hundidas en el cráneo; huele a frío y a carne vieja. Sigue a los grupos a distancia y los llama con la voz de quienes han perdido.",
    ca: 15,
    pv: "15d10+60",
    velocidad: "15 m (no deja huellas en la nieve ni en el barro)",
    atributos: "FUE 21 DES 16 CON 18 INT 10 SAB 14 CAR 8",
    ataques: ["Garras (x2): +9, 2d8+5 cortante", "Mordisco: +9, 2d6+5 perforante; se cura la mitad del daño que hace"],
    rasgos: [
      "Hambre insaciable: cuanto más come, más hambre tiene; sus víctimas devoradas no se alzan (no hay Podre: se las lleva)",
      "Imitar voces: copia la voz de cualquiera a quien haya oído; ventaja en Engaño contra quien la reconoce",
      "Frío del invierno: inmune al frío y sigiloso en nieve o niebla (+5 a Sigilo allí)",
      "Vulnerable al fuego (doble daño); teme las hogueras grandes y no cruza el círculo de fuego de un brasero",
      "Merodea: si el grupo pasa hambre (hambre o sed), lo huele y se acerca",
    ],
    habilidades: [
      { nombre: "Voz del ser querido", descripcion: "Imita la voz de alguien que el objetivo ha perdido o de un compañero que no está en escena: avanza hacia ella.", salvacion: "sab", cd: 15, condicion: "hechizado 1 minuto", recarga: 5 },
      { nombre: "Hambre que se contagia", descripcion: "Tras un mordisco, el objetivo siente un hambre que nada sacia.", salvacion: "con", cd: 15, condicion: "agotamiento 1" },
      { nombre: "Aullido de hambruna", descripcion: "Un aullido que hiela hasta el hueso; todos a 18 m que lo oigan.", salvacion: "sab", cd: 15, condicion: "asustado 1 minuto", recarga: 6 },
    ],
    botin: "Astas de hueso (reliquia: el que las lleva no pasa frío, pero el hambre le crece), un collar de dientes humanos y, en su guarida, los restos y las pertenencias de sus víctimas",
  },
  {
    nombre: "Ulfhedinn",
    alias: ["Hombre lobo"],
    temple: "no-muerto",
    personalidad: ["temerario"],
    blindaje: ["pellejo"],
    categoria: "monstruo",
    peligro: 3,
    region: "Las Agujas de Vahl, el Bosque de Velo Rojo y los campos donde cayeron bandas de berserkers",
    descripcion:
      "Un hombre lobo: cuerpo de guerrero cubierto de pelo gris ceniza que ya no se distingue de la piel, hocico con colmillos, ojos de brasa y la boca llena de espuma. Aúlla antes de golpear, no siente el frío ni las heridas y se lanza a cuatro patas contra lo primero que ve. Aparecen de noche, solos o en bandas.",
    ca: 14,
    pv: "10d8+30",
    velocidad: "12 m (14 m si carga a cuatro patas)",
    atributos: "FUE 19 DES 15 CON 17 INT 7 SAB 10 CAR 8",
    ataques: ["Hacha de guerra: +7, 1d12+4 cortante", "Mordisco (si tiene a la víctima agarrada): +7, 2d6+4 perforante"],
    rasgos: [
      "Origen (secreto del DM): un Berserker de Ceniza que murió durante su furia vistiendo una piel de lobo y no recibió el rito de sal y fuego: se alzó sin salir de ella y la piel se le fundió con la carne, hasta hacerlo un hombre lobo. No es un Varg ni sufre su maldición: es otra, la de su propia furia",
      "Piel fusionada: el pelo y el hocico son suyos y no se arrancan; ataca con garras y mordisco además del hacha",
      "Furia sin fin: nunca sale de la furia (+2 al daño cuerpo a cuerpo, resistencia al daño de corte, punta y contundente no mágico, ignora las penalizaciones de sus heridas)",
      "En trance: no distingue aliados de enemigos; cada ataque cae sobre quien tenga a su alcance (el DM lo decide al azar entre los cercanos)",
      "No-muerto: inmune a veneno, miedo y agotamiento; no siente dolor ni se cura; vulnerable al fuego de la Llama Gris",
      "Descansa si se le da el rito de sal y fuego sobre su cuerpo caído: no vuelve a alzarse",
      "Olfato de lobo: ventaja en Percepción por el olor; los lobos y los lobos de ceniza no lo atacan",
    ],
    habilidades: [
      { nombre: "Aullido de guerra", descripcion: "Un aullido que hiela la sangre; todos los enemigos a 18 m que lo oigan.", salvacion: "sab", cd: 13, condicion: "asustado 1 minuto", recarga: 6 },
      { nombre: "Carga a cuatro patas", descripcion: "Embiste a un objetivo al menos 6 m en línea recta: derriba si falla.", salvacion: "fue", cd: 14, dano: "2d8+4", tipo_dano: "contundente", condicion: "derribado", recarga: 5 },
      { nombre: "Ceniza de la furia", descripcion: "El fuego viejo de su pelo prende a quien lo toca.", salvacion: "con", cd: 14, dano: "2d6", tipo_dano: "fuego", ceniza: 1, recarga: 5 },
    ],
    botin: "Colmillos y garras (trofeos que la Inquisición paga por los de varg), una piel de lobo gris (se puede desollar: abriga contra el frío y puede pasar por disfraz de varg), hacha de guerra y, a veces, la señal de Ceniza que llevaba al morir",
  },
  {
    nombre: "Hombre oso",
    temple: "no-muerto",
    personalidad: ["temerario"],
    blindaje: ["pellejo"],
    categoria: "monstruo",
    peligro: 3,
    region: "Las Agujas de Vahl y el Bosque de Velo Rojo; claros y campos de berserkers caídos",
    descripcion:
      "Un hombre oso: un gigante cubierto de pelo gris ceniza que ya no se distingue de la piel, de hocico romo y garras como hoces, ojos de brasa y los brazos hinchados como troncos. Camina encorvado, ruge en lugar de hablar y destroza lo que encuentra. Se oye venir por el crujido de ramas y el olor a ceniza.",
    ca: 15,
    pv: "13d10+39",
    velocidad: "12 m",
    atributos: "FUE 21 DES 10 CON 19 INT 6 SAB 10 CAR 7",
    ataques: ["Garras (x2): +8, 2d6+5 cortante", "Mordisco: +8, 2d8+5 perforante", "Hacha de leñador: +8, 1d12+5 cortante"],
    rasgos: [
      "Origen (secreto del DM): un Berserker de Ceniza que murió durante su furia vistiendo una piel de oso y no recibió el rito de sal y fuego: se alzó sin salir de ella y la piel se le fundió con la carne, hasta hacerlo un hombre oso. No es un cambiaformas: no puede volver a ser hombre",
      "Piel fusionada: el pelo y el hocico son suyos y no se arrancan; ataca con garras y mordisco además del hacha",
      "Furia sin fin: nunca sale de la furia (+2 al daño cuerpo a cuerpo, resistencia al daño de corte, punta y contundente no mágico, ignora las penalizaciones de sus heridas)",
      "En trance: no distingue aliados de enemigos; cada ataque cae sobre quien tenga a su alcance (el DM lo decide al azar entre los cercanos)",
      "No-muerto: inmune a veneno, miedo y agotamiento; no siente dolor ni se cura; vulnerable al fuego de la Llama Gris",
      "Descansa si se le da el rito de sal y fuego sobre su cuerpo caído: no vuelve a alzarse",
      "Olfato de oso: ventaja en Percepción por el olor y en rastrear a quien huya",
    ],
    habilidades: [
      { nombre: "Abrazo de oso", descripcion: "Agarra a un objetivo con ambos brazos y lo aprieta.", salvacion: "fue", cd: 16, dano: "3d8+5", tipo_dano: "contundente", condicion: "agarrado", recarga: 5 },
      { nombre: "Rugido de furia", descripcion: "Un rugido que se oye a un kilómetro; todos a 9 m.", salvacion: "sab", cd: 14, condicion: "asustado 1 minuto", recarga: 6 },
      { nombre: "Ceniza de la furia", descripcion: "El fuego viejo de su pelo prende a quien lo toca.", salvacion: "con", cd: 15, dano: "2d6", tipo_dano: "fuego", ceniza: 1, recarga: 5 },
    ],
    botin: "Garras y colmillos (trofeos), una piel de oso gris (se puede desollar: abriga muchísimo) y, a veces, la señal de Ceniza que llevaba al morir",
  },
  {
    nombre: "Gárgola",
    temple: "bestia",
    blindaje: ["piedra"],
    categoria: "monstruo",
    peligro: 2,
    region: "Catedrales, torres y puentes de Aldenmar y de Karak-Dûm; ruinas con tallas de dioses",
    descripcion:
      "Una talla de piedra que aprendió a moverse cuando murieron los dioses a quienes guardaba: alas de murciélago, cuernos y un rictus de boca abierta. Guarda un lugar, no persigue más allá de su muro y se queda quieta, convertida en estatua, hasta que alguien entra.",
    ca: 15,
    pv: "9d8+18",
    velocidad: "9 m, volar 18 m",
    atributos: "FUE 15 DES 11 CON 16 INT 6 SAB 11 CAR 7",
    ataques: ["Garras: +5, 1d8+3 cortante", "Cuernos: +5, 1d10+3 perforante"],
    rasgos: [
      "Estatua: inmóvil se confunde con piedra tallada; ventaja en iniciativa y en la emboscada si la sorprenden quietos",
      "Piedra: resistencia al daño cortante y perforante no mágico; vulnerable al contundente",
      "Guardiana: no se aleja más de 36 m del lugar que guarda",
      "Inmune a veneno y a quedar agotada, no come ni respira",
    ],
    habilidades: [
      { nombre: "Caída del cielo", descripcion: "Se deja caer sobre un objetivo desde lo alto.", salvacion: "des", cd: 13, dano: "3d6+3", tipo_dano: "contundente", mitad_si_exito: true, recarga: 5 },
    ],
    botin: "Nada, salvo el fragmento de una talla sagrada (una reliquia menor de un dios muerto: vale unas monedas) y, a veces, lo que escondía la piedra",
  },
  {
    nombre: "Golem de piedra",
    temple: "constructo",
    blindaje: ["piedra"],
    categoria: "monstruo",
    peligro: 4,
    region: "Criptas, fortalezas enanas (Karak-Dûm) y laboratorios de hechiceros antiguos",
    descripcion:
      "Un gigante de piedra tallada con una palabra escrita en la frente. Obedece una sola orden y la cumple hasta que se rompe: guardar una puerta, seguir a alguien, no dejar pasar. No siente dolor ni tiene miedo, y casi nada lo detiene salvo quien conoce la palabra o rompe la talla.",
    ca: 17,
    pv: "16d10+64",
    velocidad: "9 m",
    atributos: "FUE 22 DES 8 CON 19 INT 3 SAB 8 CAR 1",
    ataques: ["Puñetazo (x2): +9, 3d8+6 contundente"],
    rasgos: [
      "Palabra de la frente: si se borra o rompe la inscripción, el golem se detiene; quien la conoce puede darle órdenes",
      "Inmune a veneno, miedo, hechizo y agotamiento; resiste el daño no mágico salvo contundente",
      "Magia que lo ralentiza: la magia de hielo o de agua reduce su velocidad a la mitad un asalto",
      "Obedece al pie de la letra: se burla con órdenes ambiguas",
    ],
    habilidades: [
      { nombre: "Golpe aplastante", descripcion: "Un puñetazo con todo su peso contra un objetivo.", salvacion: "con", cd: 17, dano: "4d10+6", tipo_dano: "contundente", herida: "golpe_masivo", mitad_si_exito: true, recarga: 5 },
    ],
    botin: "Piedra tallada con restos de escritura antigua (un erudito la compra) y, si se rompe la frente, la palabra que lo movía",
  },
  {
    nombre: "Golem de carne",
    temple: "constructo",
    blindaje: ["pellejo"],
    categoria: "monstruo",
    peligro: 3,
    region: "Sótanos de cirujanos sin licencia, osarios y barrios bajos de Aldenmar",
    descripcion:
      "Cadáveres cosidos con hilo de sutura y animados con magia negra y una chispa robada. Fuerte, torpe y furioso cuando lo hieren; obedece a su creador y, si éste muere, se vuelve contra quien tenga más cerca. Huele a aguardiente y a carne vieja.",
    ca: 11,
    pv: "12d10+36",
    velocidad: "9 m",
    atributos: "FUE 19 DES 9 CON 18 INT 6 SAB 10 CAR 5",
    ataques: ["Puñetazo (x2): +7, 2d8+4 contundente"],
    rasgos: [
      "Cosido: cada 10 de daño de golpe que recibe pierde un miembro cosido (el DM decide cuál) y ataca con desventaja",
      "Inmune al veneno, a la Podre y a quedar agotado; lo que lo mueve es un hechizo, no la vida",
      "Furia al ser herido: tras recibir daño mayor a la mitad de sus PV, ataca a quien tenga más cerca (aliado o no)",
      "Vulnerable al fuego: arde con facilidad",
    ],
    habilidades: [
      { nombre: "Agarrar y aplastar", descripcion: "Agarra a un objetivo con ambos brazos.", salvacion: "fue", cd: 14, dano: "2d10+4", tipo_dano: "contundente", condicion: "agarrado", recarga: 5 },
    ],
    botin: "Sutura de calidad, huesos y órganos aprovechables (la Barbería los paga), y, en su pecho, la piedra o el amuleto que lo animaba",
  },
  {
    nombre: "Elemental de fuego",
    temple: "elemental",
    categoria: "monstruo",
    peligro: 3,
    region: "Hogueras que nunca se apagan, forjas, volcanes y cualquier incendio grande",
    descripcion:
      "Un resto de fuego sin dueño que algún dios dejó al morir: una silueta de llama que reptó de la hoguera. No habla ni odia: arde y consume lo que arde. Los braseros de Aldenmar lo atraen y sus hogueras lo mantienen a raya.",
    ca: 13,
    pv: "12d8+24",
    velocidad: "15 m",
    atributos: "FUE 10 DES 17 CON 15 INT 4 SAB 10 CAR 6",
    ataques: ["Toque ardiente: +6, 2d8+3 fuego; prende lo inflamable"],
    rasgos: [
      "Fuego: inmune al fuego y al veneno; resistencia al daño no mágico",
      "Se apaga con agua: recibe doble daño del agua y de la sal en abundancia",
      "Ilumina y prende: a 3 m, las llamas se avivan y la ropa y la madera arden",
    ],
    habilidades: [
      { nombre: "Oleada de fuego", descripcion: "Una ola de llamas en cono de 4,5 m.", salvacion: "des", cd: 14, dano: "4d6", tipo_dano: "fuego", mitad_si_exito: true, recarga: 5 },
    ],
    botin: "Cenizas calientes (valiosas para forjar) y, a veces, un trozo de ascua que no se apaga",
  },
  {
    nombre: "Elemental de agua",
    temple: "elemental",
    categoria: "monstruo",
    peligro: 3,
    region: "Ciénagas de Hollín, el mar, ríos y pozos negros",
    descripcion:
      "Una ola que se levanta con forma de cuerpo, o un charco que se alza para cobrar lo que el agua perdió. Arrastra a los que cruzan sus orillas y se alimenta de lo que se ahoga. En Hollín las nieblas negras lo ocultan.",
    ca: 14,
    pv: "12d8+36",
    velocidad: "9 m, nadar 24 m",
    atributos: "FUE 18 DES 14 CON 16 INT 5 SAB 10 CAR 8",
    ataques: ["Golpe de agua (x2): +7, 2d8+4 contundente"],
    rasgos: [
      "Agua: inmune al veneno y al agotamiento; resistencia al fuego y al daño no mágico",
      "Se congela: el hielo la inmoviliza (velocidad 0 hasta que se rompa o derrita)",
      "Se funde con cualquier agua: invisible dentro de un charco o la niebla",
    ],
    habilidades: [
      { nombre: "Ahogar", descripcion: "Envuelve a un objetivo; está sumergido y sin aire mientras lo agarra.", salvacion: "fue", cd: 15, dano: "2d8+4", tipo_dano: "contundente", condicion: "agarrado", recarga: 5 },
    ],
    botin: "Agua pura (sirve para ritos), y lo que ahogó (monedas, huesos, equipo)",
  },
  {
    nombre: "Elemental de tierra",
    temple: "elemental",
    blindaje: ["piedra"],
    categoria: "monstruo",
    peligro: 4,
    region: "Karak-Dûm, minas, cuevas y cualquier pozo profundo",
    descripcion:
      "Una masa de roca y tierra que se alza de un derrumbe y camina atravesando el suelo. Lenta, paciente y casi indestructible a la intemperie. Los enanos dicen que son los huesos de la montaña que despiertan cuando se la hiere demasiado.",
    ca: 16,
    pv: "15d10+60",
    velocidad: "9 m, excavar 9 m",
    atributos: "FUE 22 DES 6 CON 20 INT 5 SAB 10 CAR 5",
    ataques: ["Puñetazo (x2): +9, 3d8+6 contundente"],
    rasgos: [
      "Roca: inmune al veneno y al agotamiento; resistencia al daño no mágico salvo contundente",
      "Excavar: se mueve bajo tierra y emerge sin avisar (ventaja en la sorpresa)",
      "Vulnerable al trueno y a las armas pesadas contundentes",
      "Al morir se desploma en una lluvia de roca a 3 m (2d6 contundente; DES CD 14 para la mitad)",
    ],
    habilidades: [
      { nombre: "Derrumbe", descripcion: "Hace temblar el suelo y cae roca en un radio de 4,5 m.", salvacion: "des", cd: 16, dano: "4d8", tipo_dano: "contundente", condicion: "derribado", mitad_si_exito: true, recarga: 5 },
    ],
    botin: "Gemas en bruto y vetas de metal en su cuerpo",
  },
  {
    nombre: "Elemental de aire",
    temple: "elemental",
    categoria: "monstruo",
    peligro: 3,
    region: "Cumbres y torres altas de las Agujas de Vahl; tormentas y desfiladeros",
    descripcion:
      "Un torbellino con forma vaga de figura que silba al pasar. No tiene cuerpo: se cuela por rendijas, apaga antorchas y arranca lo que no está atado. En las Agujas lo confunden con el aliento de los dioses muertos.",
    ca: 15,
    pv: "10d8+20",
    velocidad: "0 m, volar 27 m (flotar)",
    atributos: "FUE 14 DES 20 CON 14 INT 5 SAB 10 CAR 6",
    ataques: ["Golpe de viento (x2): +8, 2d8+5 contundente"],
    rasgos: [
      "Aire: inmune al veneno, al agotamiento, a quedar agarrado o derribado; resistencia al daño no mágico",
      "Apaga las llamas pequeñas y las antorchas a 6 m",
      "Vulnerable al vacío: dentro de un cuarto sin aire o sellado pierde fuerza",
      "Incorpóreo en rendijas: pasa por cualquier hueco de un dedo",
    ],
    habilidades: [
      { nombre: "Torbellino", descripcion: "Se hace un remolino que arrastra a quien tenga a 3 m.", salvacion: "fue", cd: 14, dano: "3d6", tipo_dano: "contundente", condicion: "derribado", mitad_si_exito: true, recarga: 5 },
    ],
    botin: "Nada material; a veces, una pluma o un cristal que vibra con el viento",
  },
  {
    nombre: "Djinn",
    temple: "elemental",
    personalidad: ["calculador"],
    categoria: "monstruo",
    peligro: 3,
    region: "Desiertos de ceniza, lámparas y ruinas de dioses; cualquier lugar donde alguien pidió un deseo y no se cumplió",
    descripcion:
      "Un espíritu del viento y del humo con forma de hombre alto, de piel azul grisácea y ojos de brasa, que vive atado a un objeto: una lámpara, un anillo, una botella. Concede favores, pero cada uno tiene precio y el contrato siempre tiene letra pequeña. Odia que lo mantengan prisionero y odia más a quien lo libera sin pedir nada.",
    ca: 17,
    pv: "16d10+48",
    velocidad: "9 m, volar 27 m",
    atributos: "FUE 21 DES 15 CON 22 INT 15 SAB 16 CAR 20",
    ataques: ["Cimitarra: +9, 2d6+5 cortante", "Puño de viento: +9, 2d8+5 contundente"],
    rasgos: [
      "Sujeto a un objeto: si se rompe su vaso o lámpara y no tiene dueño, puede irse; quien lo posee le da órdenes (y él las cumple al pie de la letra)",
      "Pacto: concede un favor a cambio de algo de valor (años de vida, un recuerdo, un nombre): el precio lo fija él",
      "Aéreo: inmune al veneno y al agotamiento; resistencia al daño de rayo y trueno",
      "Cambia de forma: humo, hombre o torbellino a voluntad",
    ],
    habilidades: [
      { nombre: "Deseo torcido", descripcion: "Interpreta un deseo del objetivo al pie de la letra y lo vuelve en su contra.", salvacion: "sab", cd: 16, condicion: "hechizado 1 minuto", recarga: 5 },
      { nombre: "Tormenta de arena", descripcion: "Convoca un torbellino de ceniza en un radio de 6 m.", salvacion: "con", cd: 16, dano: "5d8", tipo_dano: "contundente", condicion: "cegado", mitad_si_exito: true, recarga: 6 },
    ],
    botin: "Su vaso, lámpara o anillo (valioso: quien lo posea tiene un siervo peligroso) y joyas de los pactos que cumplió",
  },
  {
    nombre: "Duende",
    temple: "bestia",
    personalidad: ["impulsivo"],
    categoria: "monstruo",
    peligro: 1,
    region: "Bosque de Velo Rojo, claros, setos y cobertizos de Hollín",
    descripcion:
      "Un ser diminuto y de orejas largas que roba cucharas, deshace nudos y pierde viajeros por capricho. No quiere matar, pero lo que hace puede matar. Responde al nombre que se le dé y a la hospitalidad; se vuelve cruel si se le insulta o se le roba un regalo.",
    ca: 14,
    pv: "4d6",
    velocidad: "9 m, volar 12 m",
    atributos: "FUE 5 DES 18 CON 10 INT 12 SAB 13 CAR 14",
    ataques: ["Daga diminuta: +6, 1d4+2 perforante"],
    rasgos: [
      "Invisible a voluntad (rompe al atacar)",
      "Hierro: recibe doble daño del hierro frío y huye de él",
      "Travesura: ventaja en Juego de manos y en Sigilo",
      "Palabra dada: no puede mentir si se le ha pedido por su nombre verdadero",
    ],
    habilidades: [
      { nombre: "Ilusión", descripcion: "Crea una ilusión pequeña (un camino falso, una voz) que dura unos minutos.", salvacion: "sab", cd: 12, condicion: "hechizado 1 minuto", recarga: 5 },
      { nombre: "Nudo", descripcion: "Ata los cordones y los nudos del objetivo: tropieza.", salvacion: "des", cd: 12, condicion: "derribado", recarga: 6 },
    ],
    botin: "Un botón, una moneda y alguna de las cucharas que ha robado",
  },
  {
    nombre: "Grifo",
    temple: "bestia",
    blindaje: ["pellejo"],
    categoria: "monstruo",
    peligro: 3,
    region: "Las Agujas de Vahl y los riscos de Karak-Dûm; nidos en torres rotas",
    descripcion:
      "Cuerpo de león y cabeza y alas de águila, con garras como hoces. Territorial y fiel a su pareja; quien roba un huevo no vive para contarlo. Domesticado desde cría, sirve de montura a los que viven en las cumbres, aunque ninguno se deja montar dos veces por un extraño.",
    ca: 15,
    pv: "12d10+36",
    velocidad: "9 m, volar 24 m",
    atributos: "FUE 18 DES 15 CON 16 INT 2 SAB 13 CAR 8",
    ataques: ["Garras: +7, 2d6+4 cortante", "Pico: +7, 1d10+4 perforante"],
    rasgos: [
      "Vista de águila: ventaja en Percepción a la vista",
      "Picado: si baja al menos 9 m en línea recta, su primer ataque causa +2d6 y derriba si el objetivo falla FUE",
      "Se puede montar si se cría desde pequeño: vuela con un jinete (el jinete tiene ventaja contra quien ataque desde el suelo)",
    ],
    habilidades: [
      { nombre: "Presa en picado", descripcion: "Agarra a un objetivo pequeño o mediano y se lo lleva volando.", salvacion: "fue", cd: 15, dano: "3d8+4", tipo_dano: "cortante", condicion: "agarrado", recarga: 5 },
    ],
    botin: "Plumas (apreciadas para flechas), huevos (valiosos) y, si se domestica, una montura",
  },
  {
    nombre: "Hidra",
    temple: "bestia",
    blindaje: ["escamas_naturales"],
    categoria: "monstruo",
    peligro: 4,
    region: "Ciénagas de Hollín y lagos negros",
    descripcion:
      "Un cuerpo de serpiente gigante con cinco o más cabezas que silban a la vez. Cuando le cortan una, le nacen dos, y sólo el fuego que sella el cuello impide que vuelva a crecer. Pantanosa y paciente, acecha en la niebla y lleva decenios en la misma ciénaga.",
    ca: 16,
    pv: "18d10+72",
    velocidad: "9 m, nadar 9 m",
    atributos: "FUE 20 DES 12 CON 20 INT 2 SAB 10 CAR 7",
    ataques: ["Cabezas (x5): +9, 1d10+5 perforante cada una"],
    rasgos: [
      "Varias cabezas: ventaja contra ser sorprendida y para notar; cuantas más cabezas, más ataques",
      "Cortar una cabeza: si recibe 20 o más daño de un solo golpe, pierde una cabeza, pero le crecen dos más en su turno salvo que se queme el muñón con fuego o ácido",
      "Regeneración 10 si no se ha quemado: se detiene con fuego o ácido",
      "Respira bajo el agua y no se ahoga",
    ],
    habilidades: [
      { nombre: "Mordiscos coordinados", descripcion: "Cada cabeza muerde a un objetivo distinto o a uno solo.", salvacion: "con", cd: 16, dano: "4d10", tipo_dano: "perforante", condicion: "envenenado", mitad_si_exito: true, recarga: 5 },
    ],
    botin: "Colmillos (veneno que valoran los boticarios) y una vena de tesoros en el pantano donde anidó",
  },
  {
    nombre: "Sirena",
    temple: "bestia",
    personalidad: ["calculador"],
    categoria: "monstruo",
    peligro: 3,
    region: "Costas, puertos, estuarios y los ríos negros de Hollín",
    descripcion:
      "Mujer de torso humano y cola de pez, de voz tan hermosa que los marineros se tiran al agua. No canta por maldad, sino por hambre: lo que se ahoga, se come. Algunas llegan a los puertos para pedir un amante o un nombre; otras no vuelven a subir.",
    ca: 13,
    pv: "9d8+18",
    velocidad: "3 m, nadar 12 m",
    atributos: "FUE 10 DES 15 CON 14 INT 12 SAB 14 CAR 18",
    ataques: ["Garras: +5, 1d6+2 cortante", "Mordisco: +5, 1d8+2 perforante"],
    rasgos: [
      "Anfibia: respira aire y agua; fuera del agua, velocidad 3 m",
      "Canto: los que lo oigan sin tapones en los oídos deben resistir o se acercan sin pensar",
      "Ventaja en Percepción y Sigilo en el agua",
      "Vulnerable al hierro cálido y a la sal en abundancia (le quema la piel)",
      "Variante: los hombres pez, su otra cara, la sirven en bancos bajo el agua",
    ],
    habilidades: [
      { nombre: "Canto de sirena", descripcion: "Un canto que oyen todos a 36 m; quien lo oiga camina hacia el agua.", salvacion: "sab", cd: 14, condicion: "hechizado 1 minuto", recarga: 5 },
      { nombre: "Arrastrar", descripcion: "Agarra a un objetivo en la orilla y lo arrastra bajo el agua.", salvacion: "fue", cd: 13, dano: "2d6+2", tipo_dano: "contundente", condicion: "agarrado", recarga: 6 },
    ],
    botin: "Perlas, joyas de los ahogados y, a veces, una escama que sirve de amuleto contra el agua",
  },
  {
    nombre: "Hombre pez",
    alias: ["Hombres pez", "Pez-hombre"],
    temple: "bestia",
    personalidad: ["temerario"],
    blindaje: ["escamas_naturales"],
    categoria: "monstruo",
    peligro: 2,
    region: "Costas, puertos, estuarios y los ríos negros de Hollín; bajo las aguas donde canta una sirena",
    descripcion:
      "La otra cara de las sirenas: cuerpo erguido de hombre cubierto de escamas verdegrises, aletas en la espalda y los antebrazos, boca ancha de dientes finos y ojos sin párpados. No cantan ni hablan: gorgotean. Cazan en bancos, esperan bajo el agua a que alguien se acerque a la orilla —atraído, casi siempre, por una sirena— y lo arrastran. Donde hay una sirena hay hombres pez; donde hay hombres pez, casi siempre hay una sirena cerca.",
    ca: 13,
    pv: "6d8+6",
    velocidad: "6 m, nadar 12 m",
    atributos: "FUE 14 DES 13 CON 13 INT 6 SAB 10 CAR 6",
    ataques: ["Garras: +4, 1d6+2 cortante", "Mordisco: +4, 1d6+2 perforante", "Arpón de hueso (a distancia 9 m, solo si tiene dónde apoyarse): +4, 1d8+2 perforante"],
    rasgos: [
      "Anfibio: respira aire y agua; fuera del agua, velocidad 6 m y desventaja en pruebas tras una hora",
      "Bancos: ventaja en ataques si hay otro hombre pez a 3 m del objetivo",
      "Sirviente de la sirena: obedece a la sirena que lo guía (ignora su canto) y la defiende antes que a sí mismo",
      "Ventaja en Percepción y Sigilo en el agua",
      "Vulnerable a la sal en abundancia y al hierro cálido, como las sirenas",
    ],
    habilidades: [
      { nombre: "Arrastrar", descripcion: "Agarra a un objetivo en la orilla y tira de él hacia el agua.", salvacion: "fue", cd: 12, dano: "1d6+2", tipo_dano: "contundente", condicion: "agarrado", recarga: 6 },
    ],
    botin: "Escamas (amuleto contra el agua), arpones de hueso y las joyas de los ahogados en su guarida",
  },
  {
    nombre: "Hombre lagarto",
    alias: ["Hombres lagarto", "Lagarto", "Saurio"],
    temple: "bestia",
    personalidad: ["calculador"],
    blindaje: ["escamas_naturales"],
    categoria: "monstruo",
    peligro: 2,
    region: "Ciénagas de Hollín, orillas de los ríos negros y ruinas anegadas; tribus en túmulos de barro",
    descripcion:
      "Un humanoide de dos metros cubierto de escamas pardas y verdes, hocico largo de dientes finos, ojos de rendija y cola gruesa que le da el equilibrio. Frío de sangre y de ánimo: no odia, calcula. Viven en tribus en túmulos de barro y cañas, cazan con lanzas de hueso y mazas de raíz, tejen redes y no desperdician nada: lo que muere se come, sea suyo o ajeno. No rezan a los dioses (nunca los conocieron) y no se asustan de la Ceniza; sí del fuego y del frío, que los vuelve lentos. Comercian, a su manera, con quien les lleve sal o hierro.",
    ca: 15,
    pv: "5d8+5",
    velocidad: "9 m, nadar 9 m",
    atributos: "FUE 15 DES 10 CON 13 INT 7 SAB 12 CAR 7",
    ataques: ["Maza de raíz: +4, 1d8+2 contundente", "Lanza de hueso: +4, 1d6+2 perforante (también a distancia 6/18 m)", "Mordisco: +4, 1d6+2 perforante"],
    rasgos: [
      "Anfibio: respira aire y, aguantando la respiración 15 minutos, también bajo el agua; nada igual de bien",
      "Piel gruesa: escamas naturales (CA 15 sin armadura)",
      "Sangre fría: con frío intenso o fuego a su alrededor se vuelve lento (velocidad a la mitad); en un clima helado, desventaja en ataques",
      "Cazan en grupo: ventaja en ataques si hay otro hombre lagarto a 3 m del objetivo",
      "Nada se desperdicia: tras un combate come a los caídos; si se lo ofrecen, un cadáver fresco o un buen trato puede comprar un paso seguro",
      "Sigilo de ciénaga: ventaja en Sigilo entre cañas, barro y agua turbia",
    ],
    habilidades: [
      { nombre: "Red de caza", descripcion: "Lanza una red a 6 m que lo ata al barro.", salvacion: "fue", cd: 12, condicion: "apresado", recarga: 6 },
    ],
    botin: "Escamas (valen un poco a los curtidores), lanzas de hueso, redes de caza y, en el túmulo, lo que arrastraron los ahogados: hierro, sal y baratijas",
  },
  {
    nombre: "Arpía",
    temple: "bestia",
    categoria: "monstruo",
    peligro: 2,
    region: "Las Agujas de Vahl, acantilados y torres de vigía abandonadas",
    descripcion:
      "Cuerpo y rostro de mujer sobre alas y garras de buitre, con un canto que atrae y una voz que chilla. Roba comida y viajeros extraviados; anida en las alturas en bandadas ruidosas. Su canto no es tan potente como el de una sirena, pero a muchas juntas basta.",
    ca: 12,
    pv: "7d8+7",
    velocidad: "6 m, volar 12 m",
    atributos: "FUE 12 DES 13 CON 12 INT 7 SAB 10 CAR 13",
    ataques: ["Garras: +3, 2d4+1 cortante", "Mazo de huesos: +3, 1d6+1 contundente"],
    rasgos: [
      "Bandada: ventaja en ataques si hay otra arpía a 3 m del objetivo",
      "Se lleva lo que pueda: roba objetos pequeños (un odre, una bolsa) y huye",
      "Voz que atrae: ventaja en Engaño al imitar una voz humana",
    ],
    habilidades: [
      { nombre: "Canto atrayente", descripcion: "Un canto triste que oyen todos a 18 m.", salvacion: "sab", cd: 11, condicion: "hechizado 1 minuto", recarga: 5 },
    ],
    botin: "Plumas sucias, un nido con objetos robados y los huesos de lo que cenó",
  },
  {
    nombre: "Leshen",
    temple: "bestia",
    personalidad: ["calculador"],
    blindaje: ["pellejo"],
    categoria: "monstruo",
    peligro: 4,
    region: "Bosque de Velo Rojo, el corazón de los bosques viejos",
    descripcion:
      "El guardián de un bosque: un tronco con cráneo de ciervo o de cuervo por rostro y ramas por brazos, rodeado de cuervos y raíces. Habla con voz de madera y castiga a los que talan, queman o cazan sin permiso. No es un dios, pero dicen que lo fue en el bosque cuando los dioses vivían.",
    ca: 16,
    pv: "16d10+48",
    velocidad: "9 m",
    atributos: "FUE 19 DES 12 CON 17 INT 12 SAB 18 CAR 14",
    ataques: ["Ramas (x2): +8, 2d8+4 contundente", "Garras de raíz: +8, 1d10+4 cortante"],
    rasgos: [
      "Guardián del bosque: gana +2 CA y se regenera 5 PV por asalto en su bosque",
      "Cuervos y bestias: controla a los animales del bosque (1d4+2 cuervos o un lobo) que lo obedecen",
      "Vulnerable al fuego: arde con facilidad",
      "Raíces: el suelo del bosque es suyo; quien está sobre él no puede escapar si falla FUE",
    ],
    habilidades: [
      { nombre: "Raíces que atrapan", descripcion: "Raíces surgen del suelo en un radio de 6 m.", salvacion: "fue", cd: 15, condicion: "retenido", recarga: 5 },
      { nombre: "Enjambre de cuervos", descripcion: "Una nube de cuervos envuelve a un objetivo.", salvacion: "des", cd: 15, dano: "3d8", tipo_dano: "cortante", condicion: "cegado", mitad_si_exito: true, recarga: 6 },
    ],
    botin: "Su corona de astas (reliquia del bosque: protege contra la Podre de los árboles), semillas viejas y las ofrendas que no consumió",
  },
  {
    nombre: "Moira",
    temple: "bestia",
    personalidad: ["calculador"],
    presagios: 2,
    categoria: "monstruo",
    peligro: 4,
    region: "Casas aisladas, telares abandonados y cruces de caminos; aparecen de a tres",
    descripcion:
      "Una de las hilanderas del destino: una mujer vieja o joven según el hilo que sostenga, con ojos de color de lino que no parpadean. Hila el hilo de una vida, lo mide y lo corta. Rara vez ataca; prefiere avisar, y lo que dice sucede. A veces va en grupo de tres y entonces ninguna miente.",
    ca: 15,
    pv: "13d8+26",
    velocidad: "9 m",
    atributos: "FUE 10 DES 14 CON 14 INT 18 SAB 20 CAR 16",
    ataques: ["Tijeras de hueso: +8, 2d6+4 cortante", "Hilo cortante: +8, 1d8+4 cortante a 6 m"],
    rasgos: [
      "Ve el futuro: empieza el combate con 2 presagios (d20 tirados de antemano) que puede usar en lugar de cualquier tirada",
      "Hilo de la vida: ve la longitud del hilo de cada criatura cercana (sabe si morirá pronto)",
      "No miente en su oficio: lo que profetiza sucede, pero con trampa si se le aprieta",
      "Vulnerable a quien rompe su telar: sin su hilo, pierde sus presagios",
    ],
    habilidades: [
      { nombre: "Cortar el hilo", descripcion: "Mide y corta el hilo de un objetivo a 18 m.", salvacion: "sab", cd: 16, dano: "6d8", tipo_dano: "psíquico", mitad_si_exito: true, recarga: 5 },
      { nombre: "Profecía", descripcion: "Anuncia un hecho futuro sobre el objetivo; durante la escena, sus tiradas contrarias son con desventaja.", salvacion: "sab", cd: 16, condicion: "asustado 1 minuto", recarga: 6 },
    ],
    botin: "Un ovillo de hilo (aviso de peligro: cambia de color), tijeras de hueso y un telar que vale un reino a quien sepa leerlo",
  },
  // ------------------------------------------------------------ jefes
  {
    nombre: "Vaskar, el Lobo del Eclipse",
    personalidad: ["temerario"],
    temple: "bestia",
    categoria: "jefe",
    peligro: 5,
    region: "Corazón del Bosque de Velo Rojo",
    descripcion: "El primer Varg, padre de la maldición. Antes fue un hombre de la época de los dioses; hoy, un lobo del tamaño de un carro, con la luna muerta en los ojos.",
    trasfondo: {
      origen:
        "En la época de los dioses, Vaskar era un hombre que practicaba magia negra: traicionero y de malas intenciones. Quería la vida eterna: preparó un ritual para robar la esencia de Kashi, el dios de la luna, a través de uno de sus hijos, y usarla para alargar su vida. Para ello cazó un lobo (hijo de Kashi) y quiso usar sus dientes. Kashi, que ya conocía sus intenciones y supo cómo había matado a su hijo, aprovechó que Vaskar se quedó dormido bajo la luz de la luna y lo maldijo: lo convirtió en lobo para la eternidad (su vida eterna se cumplió como castigo). No llegó a tomar nada de la esencia de Kashi, y los dientes del ritual nunca le sirvieron: lo que quiso robar le costó la forma humana. De esa maldición nace la Maldición del Lobo que marca a los Varg, que son sus «hijos»: la maldición se transmite por su mordedura y por su Aullido del Eclipse. Por dentro sigue siendo el hombre: conserva su astucia, su vileza y su magia negra; es un lobo que piensa, miente, negocia y traiciona. Kashi murió con los demás dioses (hace 99 años), así que nadie puede levantar la maldición. Por eso Vaskar busca un objeto de verdadero poder de Kashi que cree que la romperá. Su cubil es el Bosque de Velo Rojo porque allí se rumorea que se encuentran objetos mágicos, pero todos los que se rumorean allí son rumores o señuelos. Solo existe UNA reliquia de Kashi: la FALANGE DE KASHI, la falange del dedo anular del dios, que simbolizaba su unión con los seres de la luna, como los lobos. No hay más. La Falange NO tiene poder para romper nada (tampoco la maldición): Vaskar solo cree que lo libera, y se equivoca. Da un bonus para pelear contra los Varg (+2 a ataque y daño y ventaja en las salvaciones contra el Aullido del Eclipse y la furia de la luna de los Varg) y la capacidad de teletransportarse, en las noches de luna llena, a todos los lugares a donde llegue la luz de la luna (una vez por noche de luna llena, al aire libre o donde entre luz por un hueco, con lo que lleve puesto). Solo la puede usar un HUMANO y solo bajo la LUNA LLENA, y Vaskar NO puede salir en luna llena. Desde que está maldito, sus sentidos no pueden detectarla, y quien la lleve es invisible a ellos (no lo huele ni lo detecta, aunque pueda deducirlo por lo que haga el portador); puede que ya ni esté en el Velo Rojo. Como solo un humano puede usarla, Vaskar necesita manos humanas ajenas que la busquen por él: engaña, chantajea o recluta a aventureros, saqueadores o Varg humanos, y deja señuelos y rumores que atraen buscadores. Los saqueadores y la Inquisición siguen esos mismos rumores del Velo Rojo y chocan entre sí y con los Varg.",
      enemigos:
        "El primer Inquisidor (el Juez Sin Ojos): lo odia por su uso de la magia negra y por la ofensa a los dioses. Es una enemistad que viene de la época de los dioses. El Juez llegó tarde a juzgarlo (la maldición de Kashi se le adelantó) y Kashi le retiró su favor por eso. Aliados: Varg que lo veneran, bestias del Velo Rojo y cualquiera a quien prometa curarlo. Kuru lo tendría en su lista de leyendas.",
      abierto: ["¿Dónde está la Falange de Kashi ahora, y quién la tiene? (lo resuelve la misión semilla de abajo, aprobada)"],
      pistas: [
        "Leyendas de Varg sobre «el hombre que mató al hijo de la luna» y el nombre de Kashi, el dios de la luna",
        "Un colmillo de lobo marcado con símbolos de magia negra, o un grimorio con sangre de lobo",
        "Los archivos de la Inquisición hablan de un condenado sin ejecutar «de antes de la Caída»",
        "Los Varg que se transforman bajo su Aullido murmuran palabras en una lengua antigua que no conocen",
        "Rumores y cebos sobre «objetos mágicos» en el Velo Rojo que nadie ha encontrado nunca",
        "Un relicario con un hueso de dedo que brilla bajo la luna llena, y noches en que alguien «aparece» donde llega la luz de la luna",
      ],
      mision: {
        nombre: "El hueso que brilla con la luna",
        estado: "aprobada por el usuario",
        inicio:
          "Mirel, una buhonera humana de las Ciénagas, contrata al grupo en secreto (o les pide ayuda en una posada/mercado) para encontrar «un hueso de dedo que brilla con la luna llena». Les dice que es una reliquia que sanará a su hijo; la verdad: su hijo es un Varg convertido por Vaskar, que lo retiene como rehén hasta que ella le lleve la Falange (necesita manos humanas). Mirel no sabe qué es la reliquia, solo que la quiere el Lobo.",
        nudo:
          "La Falange está en un mercado de Aldenmar (el Mercado nocturno o un puesto de «huesos de dioses», que circulan como reliquias): la tiene Odrec, un vendedor de huesos que la usa como amuleto sin saber lo que es; en las lunas llenas ha aparecido en sitios imposibles y cree que es suerte. El grupo la encuentra, pero la Inquisición de la Llama Gris (capitana Veyra) ha notado una reliquia divina por orden del Juez, y los saqueadores y Kuru siguen los mismos rumores: todos van a por Odrec. Y alguien del grupo (humano) puede usarla en luna llena.",
        desenlaces: [
          "Se la dan a Vaskar (en una noche que no sea de luna llena): la Falange no puede romper su maldición (no tiene poder para romper nada, y él ni siquiera puede usarla: solo un humano, y bajo la luna llena, noche en la que no puede salir). Vaskar es un traidor: puede cumplir su trato y liberar a Mirel y a su hijo, o romperlo. Lo que hace al comprobar que se equivocó queda a tu criterio (propuesta: se hunde en la furia y la desesperación y persigue a quien se la dio, o a Kashi en sus últimos rastros)",
          "Se quedan con la Falange: bonus contra Varg y teletransporte en luna llena, pero Vaskar y los Varg los cazan, y el Juez siente la reliquia: arco nuevo con la Inquisición",
          "Se la entregan al Juez en la catedral hundida: el Juez la custodia (se pierde su uso) y puede dar un favor o su Rayo de luz solar primigenia; Vaskar los marca como enemigos",
          "La destruyen: nadie más podrá usarla, Vaskar se hunde en la desesperación y Mirel pierde a su hijo",
        ],
        pnjs: [
          "Mirel (buhonera humana, chantajeada por Vaskar; quiere salvar a su hijo Varg; miente por miedo)",
          "Odrec (vendedor de huesos de Aldenmar; ignora lo que tiene y se aferra a su «suerte»)",
          "Capitana Veyra (Inquisición de la Llama Gris; sigue el rastro de lo divino que siente el Juez)",
          "Kuru (cazador de leyendas; la Falange es una pieza de caza si alguien la porta)",
          "Un Varg emisario de Vaskar que vigila a Mirel desde las sombras",
        ],
        ganchos: [
          "En Aldenmar: el grupo conoce a Mirel en una posada del puerto, o un Varg herido pide ayuda",
          "En el Velo Rojo: un Varg moribundo que les pide llevar un mensaje a Mirel",
          "Desde la Compañía del Cuervo: un encargo de escolta que en realidad lleva a Mirel hacia Aldenmar",
          "Por el Juez: un inquisidor les pregunta si han visto «un hueso que brilla»",
        ],
      },
    },
    ca: 17,
    pv: "200",
    velocidad: "15 m",
    atributos: "FUE 24 DES 18 CON 22 INT 14 SAB 16 CAR 18",
    ataques: ["Mordisco: +12, 3d10+7 perforante", "Garras (x2): +12, 2d8+7 cortante"],
    rasgos: ["Regeneración 15 por turno salvo plata o fuego", "3 acciones legendarias por ronda (garra, moverse sin provocar, aullido corto)", "Resistencia legendaria (3/día): puede convertir una salvación fallada en éxito"],
    habilidades: [
      { nombre: "Desgarrar la garganta", descripcion: "Contra un objetivo derribado o apresado.", salvacion: "con", cd: 18, dano: "6d10", tipo_dano: "perforante", muerte_si_falla_por: 0, herida: "critico" },
      { nombre: "Aullido del Eclipse", descripcion: "Todos a 36 m. Un Varg que falle por 5 o más se transforma y lucha a su lado durante 1 minuto.", salvacion: "sab", cd: 17, condicion: "asustado 1 minuto", recarga: 5 },
    ],
    botin: "Colmillo del Eclipse (reliquia); el fin de la maldición, quizá",
  },
  {
    nombre: "El Juez Sin Ojos",
    blindaje: ["loriga", "yelmo", "brigantina", "grebas"], // malla con yelmo, brigantina y grebas: intermedio entre las placas completas (una espada apenas le hacía daño) y la loriga con yelmo (casi sin defensa a nivel 13)
    personalidad: ["calculador"],
    categoria: "jefe",
    peligro: 5,
    region: "Catedral sumergida bajo Aldenmar",
    descripcion: "El primer Inquisidor, hijo del dios del sol Ka'i y de una humana. Se arrancó los ojos cuando quedó atrapado al socorrer a su padre. Aún juzga, y siempre condena.",
    trasfondo: {
      origen:
        "Era hijo de Ka'i, el dios del sol (el dios Solar), y de una humana (la madre no es relevante). Por ser semidiós, los dioses le dieron la habilidad de ver la naturaleza divina y maldita de cada cosa y lo hicieron guardián de sus creaciones y de todo lo divino: así nació el primer Inquisidor. Cuando fue a juzgar a Vaskar por su magia negra y la ofensa a los dioses llegó tarde (Kashi, el dios de la luna, ya lo había maldecido) y Kashi le retiró su favor por eso. Se arrancó los ojos porque quedó atrapado cuando fue a socorrer a su padre: ante la inminente muerte de Ka'i, prefirió sacarse los ojos. Ka'i le recordó su misión y le pidió no flaquear ante el mal: esas fueron sus últimas palabras. Conserva su don sin ojos: su «vista ciega» es ese don, que no depende de los ojos, y sigue viendo la naturaleza divina y maldita de todo. Vive en la catedral hundida bajo Aldenmar porque fue el último lugar donde habló con su padre. La catedral solo guarda sus cosas, el botín que puede dar y los recuerdos de su padre. Fue guardián de lo divino y falló: juzga con una dureza que es expiación. Ka'i es el dios Solar cuyo corazón duerme bajo Kharoth en las Agujas de Vahl; el Juez nunca ha ido a por él (o no puede acercarse): es su herida más honda. La Inquisición de la Llama Gris es su obra: la llama gris es el fuego del sol de su padre, ya apagado y cenizo, y sus inquisidores heredan, sin entenderlo, su misión de guardar lo divino y perseguir la magia negra. Detecta cualquier objeto divino o maldito a gran distancia (como la Falange de Kashi): es muy peligroso para quien lleve uno. Aún juzga, y siempre condena.",
      enemigos:
        "Vaskar, el Lobo del Eclipse: lo odia por su uso de la magia negra y por la ofensa a los dioses. Es una enemistad que viene de la época de los dioses.",
      pistas: [
        "Antiguos grabados de un semidiós de ojos de oro vendado, guardián de los altares",
        "La Inquisición reza a «el Hijo del Sol» y a veces llama a su líder «el Guardián»",
        "Los inquisidores usan vendas en los ojos como penitencia en su honor",
        "Archivos sellados sobre una sentencia que «llegó tarde» y un favor perdido de la luna",
        "En la catedral hundida hay un altar al sol que nunca se ha cubierto de agua",
      ],
    },
    ca: 19,
    pv: "180",
    velocidad: "9 m",
    atributos: "FUE 20 DES 12 CON 18 INT 16 SAB 22 CAR 20",
    ataques: ["Espadón de llama gris (x2): +11, 2d6+5 cortante + 3d6 fuego"],
    regente: {
      titulo: "regente de la Inquisición de la Llama Gris",
      corte: "Gobierna desde la catedral sumergida por sentencias selladas que sus inquisidores cumplen sin preguntar; casi nunca sale: juzga a distancia y envía a sus purificadores.",
      servidores: [
        { nombre: "Inquisidores de la Llama Gris", cuantos: "3-5", nota: "patrulla con antorchas y licencias selladas: ejecutan su sentencia; veteranos, ataque +4, CA 15, 20 PV" },
        { nombre: "Acólitos vendados", cuantos: "4-8", nota: "fanáticos que «ven» por él y repiten sus sentencias en voz alta; ataque +3, CA 11, 11 PV; no se achantan" },
        { nombre: "Sabuesos de ceniza", plantilla: "Lobo de Ceniza", cuantos: "2-4", nota: "lobos que la Inquisición adiestra para rastrear a los condenados" },
      ],
      politica: {
        objetivo: "Imponer la Llama Gris como autoridad suprema de Aldenmar (por encima del Consejo de Ceniza) y erradicar la magia negra, los Varg y los vampiros.",
        medios: [
          "comprar voluntades: cargos, licencias de magia y exenciones a cambio de lealtad; jueces, escribanos y capitanes que le deben el puesto",
          "espiar: confesores, penitentes y «oídos de la Llama» en tabernas y aldeas; inquisidores de incógnito",
          "sabotaje: incautar reliquias, quemar archivos, cerrar licencias, declarar hereje a un rival o incendiar sus sedes",
          "chantaje y propaganda: confesiones forzadas, sentencias públicas y sermones que convierten a un enemigo en demonio",
        ],
        agentes: ["Inquisidores de incógnito", "Escribanos y jueces comprados", "Confesores espías", "Capitana Veyra y su patrulla"],
      },
    },
    rasgos: ["Ciego pero con vista ciega a 36 m: inmune a ilusiones e invisibilidad", "Semidiós: los dioses le dieron la habilidad de ver la naturaleza divina y maldita de cada cosa (reliquias, maldiciones, Ceniza, criaturas sagradas o aberrantes) y de custodiar todo lo divino", "REGENTE: nunca está solo; sus subordinados cumplen sus sentencias lejos de él y, si da la cara, lo rodea su séquito", "Resistencia legendaria (3/día)"],
    habilidades: [
      { nombre: "Convocar a los suyos", descripcion: "Una campana de la catedral suena y acuden 1d4+1 inquisidores y acólitos por las puertas en la ronda siguiente (aparecer_criatura o pnj)." },
      { nombre: "Veredicto", descripcion: "Señala a un culpable.", salvacion: "sab", cd: 18, dano: "8d10", tipo_dano: "fuego", mitad_si_exito: true, muerte_si_falla_por: 5, recarga: 5 },
      { nombre: "Confesión", descripcion: "Todos a 18 m confiesan su peor pecado en voz alta o arden.", salvacion: "car", cd: 17, dano: "4d10", tipo_dano: "psíquico", condicion: "aturdido 1 asalto" },
    ],
    botin: "Espadón de llama gris (encantado); los archivos secretos de la Inquisición; Rayo de luz solar primigenia (reliquia, guardado en la catedral: un rayo del sol de Ka'i; +2 a ataque y daño contra no-muertos y criaturas malditas; ilumina la oscuridad más grande, incluso la mágica, en un radio de 36 m; y acaba con los vampiros que alcanza: quien falla una salvación de CON CD 20 muere, y quien la supera queda a 0 PV y arde. Por eso la regeneración de Ysolde falla «salvo luz solar». Uno por campaña) y los recuerdos de Ka'i que la catedral conserva",
  },
  {
    nombre: "Ysolde, la Reina Pálida",
    personalidad: ["arrogante"],
    temple: "vampiro",
    categoria: "jefe",
    peligro: 5,
    region: "Castillo de Vel Morhal, en la Marca Hueca",
    descripcion: "Reina de la Corte Pálida, hermosa y antigua, hija de Dracone, el Primus Imperatus, a quien mató para ocupar su trono. Habla con cortesía exquisita mientras te vacía.",
    trasfondo: {
      origen:
        "Es hija de Dracone, el «Primus Imperatus»: el primer regente pálido, que unificó bajo su mando a los pálidos con una mezcla de fuerza y política, y que hoy forman parte de la orden de Ysolde (la Corte Pálida). Dracone se oponía a una idea imperialista por ética: decía que su raza era demasiado civilizada y tenía un potencial tan alto que podría desatar barbarie. Ysolde pensaba que su padre no era lo bastante ambicioso. Después de la Caída, lo mató con su propia mano en un golpe de estado para robarle el trono: tras una fiera pelea, lo mató con su magia, absorbiendo su esencia vital. Su idea imperialista: someter primero la Marca Hueca entera y después Velmora, con Aldenmar como premio. Ella lo llama «imperio»; Dracone lo llamaba «orden». La corona pálida (su botín maldito) era la corona de Dracone y quedó maldita con su muerte a manos de su hija: quien se la pone carga con el parricidio. Quedan leales a Dracone, los «Fieles del Primus»: pálidos que fingen servirla o se esconden en la Marca, que pueden ser aliados o cebo. Los Caballeros de Vel Morhal eran la guardia de honor de Dracone: juraron a Ysolde por obediencia o por miedo, y algunos la odian. Su ataúd reposa en Vel Morhal junto al sepulcro de su padre. Es la enemiga natural del Juez y la Llama Gris: el Rayo de luz solar primigenia es el arma que más teme, lo que explica que su regeneración falle «salvo luz solar». Kuru la tendría en su lista de leyendas.",
      pistas: [
        "Tapices de Vel Morhal con la figura de Dracone cortada o cosida con hilo rojo",
        "Cortesanos pálidos que bajan la voz al nombrar al «Primus»",
        "Un retrato del Primus Imperatus con la cara raspada en una sala cerrada",
        "Una tumba vacía o sellada en las criptas de Vel Morhal",
        "Un noble pálido que dice recordar «cuando la Corte era una familia»",
        "Un pálido anciano que repite que «somos demasiado civilizados para ser imperio»",
      ],
    },
    ca: 18,
    pv: "220",
    velocidad: "12 m, trepar 12 m",
    atributos: "FUE 18 DES 18 CON 18 INT 18 SAB 16 CAR 24",
    ataques: ["Garras: +10, 2d8+4 cortante; apresada (CD 18)", "Mordisco (objetivo apresado): +10, 1d8+4 + 4d10 necrótico; ella recupera lo mismo"],
    regente: {
      titulo: "reina de la Corte Pálida",
      corte: "Reina en Vel Morhal rodeada de cortesanos que le deben la vida (y la muerte); manda por invitaciones, favores y cenas, y nunca se ensucia las manos.",
      servidores: [
        { nombre: "Esbirros de la Corte Pálida", cuantos: "2-4", nota: "sirvientes pálidos, elegantes y rápidos; ataque +5, CA 14, 22 PV; llevan un mensaje o una invitación" },
        { nombre: "Caballeros de Vel Morhal", cuantos: "2-3", nota: "no-muertos con armadura de placas que guardan su castillo y su ataúd; ataque +6, CA 17, 30 PV" },
        { nombre: "Sirvientes de las fosas", plantilla: "Ghul de las fosas", cuantos: "1-2", nota: "ghuls domesticados que limpian lo que la Corte deja" },
        { nombre: "Jauría de la Marca", plantilla: "Hambriento", cuantos: "6-10", nota: "muertos de la Marca que acuden a su llamada cuando necesita multitud (sin cortesía)" },
      ],
      politica: {
        objetivo: "Someter primero la Marca Hueca entera y después Velmora, con Aldenmar como premio.",
        medios: [
          "comprar voluntades: deudas de sangre, invitaciones, favores y un título a quien se arrodille; nobles y capitanes que le deben la vida (o la no-muerte)",
          "espiar: cortesanos pálidos infiltrados, sirvientes y huéspedes que informan; ojos en las cortes de otros",
          "sabotaje: cortar rutas y suministros, apagar hogueras de la Inquisición, envenenar a un rival o difundir la Podre en una ciudad enemiga",
          "seducción y hechizo (Mirada de la Reina): convertir a un notable en su títere; cenas que acaban en servidumbre",
        ],
        agentes: ["Cortesanos pálidos infiltrados", "Nobles endeudados", "Esbirros de la Corte con una invitación", "Fieles del Primus que fingen servirla"],
      },
    },
    rasgos: ["Regeneración 20 salvo luz solar o agua bendecida con sal", "Forma de niebla al caer a 0 PV: solo muere si se la estaca en su ataúd", "REGENTE: rodeada de su Corte; envía esbirros e invitaciones a su voluntad y, en persona, nunca llega sola", "Resistencia legendaria (3/día)"],
    habilidades: [
      { nombre: "Convocar a la Corte", descripcion: "Chasquea los dedos y acuden 1d4 esbirros o caballeros por el pasillo más cercano en la ronda siguiente (aparecer_criatura o pnj)." },
      { nombre: "Mirada de la Reina", descripcion: "Un objetivo que la vea.", salvacion: "sab", cd: 19, condicion: "hechizado: la ve como su más querida aliada 1 hora" },
      { nombre: "Vaciar", descripcion: "Bebe hasta el fondo de un objetivo apresado. Quien muere así se levanta al día siguiente como su siervo.", salvacion: "con", cd: 18, dano: "6d10", tipo_dano: "necrótico", sangre: 15, muerte_si_falla_por: 10 },
    ],
    botin: "La corona pálida (maldita); las escrituras de media Marca",
  },
  {
    nombre: "La Madre de los Hambrientos",
    temple: "no-muerto",
    categoria: "jefe",
    peligro: 5,
    region: "Una fosa común sin fondo en las Ciénagas de Hollín",
    descripcion: "Una masa de cadáveres cosidos por la Podre, grande como una casa, que pare Hambrientos sin parar.",
    trasfondo: {
      origen:
        "Fue una masa de cadáveres en un antiguo campo de guerra que empezaron a devorarse unos a otros. Ese campo acabó siendo las Ciénagas de Hollín. De aquel festín de muertos nace el hambre que no se sacia, y por eso su cría, los Hambrientos, devora sin fin. Los muertos no descansaron porque a ninguno se le hizo el rito de la sal. Se devoraron entre sí porque no quedaban vivos que comer. DEBILIDAD: la sal y el fuego la dañan, pero solo en grandes cantidades; un poco de sal o una antorcha no basta. Para destruirla de verdad hace falta un arma muy poderosa capaz de aniquilarla hasta el punto de que no pueda regenerarse: un arma que destruya el alma o que combata la Podre: el COLMILLO DE HIERRO (espadón legendario que corta el alma) es esa arma; con él la Madre deja de regenerar y puede ser destruida. El Rayo de luz solar primigenia NO la mata (quizá pueda hacerle daño). REGENERACIÓN: se regenera (10 PV al inicio de su turno); la sal y el fuego la dañan, y basta con la suficiente cantidad de ambos para superar su capacidad regenerativa (más de 10 PV de fuego o sal en una ronda, esparcida a puñados, en carga o en llamas grandes). CUERPO: grande como una casa. EL DIOS HAMBRIENTO: no es un dios real, sino el nombre que los Devotos dan al hambre de la Madre; la veneran como su templo viviente y creen que cada muerto que absorbe es una ofrenda. EL DIOS NUEVO: los Devotos creen que, cuando la fosa absorba bastantes muertos, la Madre parirá un dios que no tendrá hambre porque será todo lo comido; promete a los desesperados que nadie volverá a pasar hambre ni a morir solo, porque entrará en él. Para ser «dios nuevo» necesita almas, no solo carne; por eso los Devotos buscan moribundos y asedios, y un arma que destruya el alma es su peor amenaza. De la guerra del campo solo importa que ocurrió: no hay más historia que contar.",
      abierto: [
        "El Colmillo de Hierro, el arma que puede destruirla, aparece al azar (botín de jefe o donde el DM lo ponga): no tiene paradero fijo.",
      ],
      pistas: [
        "Huesos de armas y armaduras de ejércitos distintos, mezclados y mordidos, bajo el fango de Hollín",
        "Una fosa cuyos muertos nunca recibieron sal, y un olor a carne vieja que ni el fuego quita",
        "Los más viejos de las Ciénagas hablan de «el campo donde los muertos se comieron»",
        "Los Hambrientos mastican incluso metal y cuero de uniformes que nadie reconoce",
      ],
    },
    ca: 15,
    pv: "260",
    velocidad: "6 m",
    atributos: "FUE 22 DES 6 CON 24 INT 8 SAB 14 CAR 3",
    ataques: ["Brazos de la fosa (x3): +10, 2d10+6 contundente; apresado (CD 17); Podre (cd_podre 16)"],
    regente: {
      titulo: "madre y soberana de los Hambrientos",
      corte: "No piensa, pero manda: los muertos de las Ciénagas obedecen su hambre, los ghuls la rodean como hijos mayores y los Devotos del Dios Hambriento le llevan carne y la cuidan como a una diosa.",
      servidores: [
        { nombre: "Hambrientos", plantilla: "Hambriento", cuantos: "5-12", nota: "sus crías: salen en marea, de una sola dirección y sin miedo" },
        { nombre: "Ghuls de las fosas", plantilla: "Ghul de las fosas", cuantos: "1-3", nota: "hijos mayores que guían a la manada y ordenan a los pequeños" },
        { nombre: "Devotos del Dios Hambriento", cuantos: "3-6", nota: "fanáticos que le llevan carne y vigilan sus fosas; ataque +3, CA 11, 11 PV, cuchillos de hueso" },
        { nombre: "Gigante de hueso", plantilla: "Gigante de hueso", cuantos: "1", nota: "cuando la marea necesita algo más grande, un gigante cosido con huesos de la fosa" },
      ],
      politica: {
        objetivo: "Que la Podre y el hambre se extiendan hasta que nazca el dios nuevo: abrir fosas, alimentarlas y que no haya hoguera que las frene.",
        medios: [
          "comprar voluntades a través de los Devotos del Dios Hambriento: sepultureros, enterradores, contrabandistas de Hollín y curas corruptos que miran a otro lado",
          "espiar: devotos en los barrios bajos, ghuls que escuchan en los cementerios",
          "sabotaje: impedir los ritos de sal y fuego para que los muertos se levanten, envenenar pozos con Podre o abrir una fosa nueva bajo una aldea",
          "propaganda: predicadores del hambre, promesas de un dios nuevo a los desesperados",
        ],
        agentes: ["Devotos del Dios Hambriento infiltrados", "Sepultureros sobornados", "Ghuls que guían a la manada", "Contrabandistas de Hollín"],
      },
    },
    rasgos: ["Parto de muertos: al inicio de cada ronda nacen 1d4 Hambrientos", "REGENTE: pare y envía a los suyos; sus Hambrientos, ghuls y devotos actúan por ella a distancia y la rodean si se la ataca", "Regeneración 10 al inicio de su turno, salvo que haya recibido más de 10 de fuego o sal en la ronda; el Colmillo de Hierro la anula y permite destruirla","Inmune a veneno, necrótico, miedo"],
    habilidades: [
      { nombre: "Abrazo de la fosa", descripcion: "Contra un objetivo apresado al inicio de su turno: lo hunde en la masa. Quien muere así es absorbido: su cuerpo pasa a formar parte de la Madre.", salvacion: "fue", cd: 17, dano: "4d10", tipo_dano: "contundente", muerte_si_falla_por: 5 },
      { nombre: "Vómito de Podre", descripcion: "Cono de 9 m de carne licuada.", salvacion: "con", cd: 16, dano: "8d8", tipo_dano: "necrótico", mitad_si_exito: true, herida: "menor", recarga: 5 },
    ],
    botin:
      "Corazón de la Fosa (reliquia maldita): órgano negro que late al ritmo de los muertos; una vez al día, quien lo porte ordena a un grupo de Hambrientos que no ataque durante 1 minuto (CON CD 15 o contrae la Podre, cada vez). | Costuras de la Madre: tendón vivo que cierra una herida grave (+4 a tratar_herida), pero deja una marca de Podre en la piel. | Cera de sepulcro (3 frascos): cubierto con ella, un no-muerto no te huele durante 1 hora. | Al morir, los Hambrientos de la zona se desploman en cuestión de horas, y la fosa deja ver lo que se tragó: armas, oro y reliquias de un siglo.",
  },
  {
    nombre: "El Que Golpea Bajo la Piedra",
    artes: ["piedra"],
    categoria: "jefe",
    peligro: 5,
    region: "Lo más hondo de Karak-Dûm",
    descripcion: "Lo que despertó bajo la fortaleza enana. Nadie lo ha visto entero: es un gusano, o una boca, o una montaña que tiene hambre.",
    ca: 18,
    pv: "300",
    velocidad: "9 m, excavar 9 m",
    atributos: "FUE 28 DES 7 CON 24 INT 3 SAB 12 CAR 5",
    ataques: ["Mordisco: +13, 4d8+9 perforante"],
    rasgos: ["Sentido sísmico 36 m", "Resistencia legendaria (3/día)"],
    habilidades: [
      { nombre: "Tragar", descripcion: "Tras un mordisco.", salvacion: "des", cd: 19, condicion: "tragado: 6d6 ácido por turno; sale si causa 30 de daño desde dentro en un turno; si muere dentro, no queda cadáver", muerte_si_falla_por: 10 },
      { nombre: "Derrumbe", descripcion: "Golpea el techo de la caverna.", salvacion: "des", cd: 17, dano: "8d10", tipo_dano: "contundente", mitad_si_exito: true, herida: "golpe_masivo", condicion: "enterrado (asfixia en CON asaltos)", recarga: 6 },
    ],
    botin:
      "Diente de la Piedra (arma, encantada +2): un colmillo de roca negra largo como un brazo, que se empuña como pica o maza; 2d8 contundente y ignora la mitad del blindaje de piedra y de metal enano. | Cristal de los hondos: resuena con las cavidades; avisa de derrumbes y túneles a 30 m, y una vez al día provoca un derrumbe controlado en un techo cercano. | Mena viva (1d4 lingotes): metal que nadie sabe nombrar y que sigue enfriándose; un herrero enano puede forjar con un lingote una pieza de armadura de placas con +1 de protección contundente y que no se oxida. | Los planos de la Fortaleza Silente: grabados en su cubil por los enanos que huyeron, con las puertas, los sellos y lo que quedó dentro.",
  },
  {
    nombre: "Ilvara, la Tejedora de Mañanas",
    categoria: "jefe",
    peligro: 5,
    region: "El monasterio más alto de las Agujas de Vahl",
    descripcion:
      "Una vidente sin ojos que teje en un telar de cabellos humanos todos los futuros posibles. Sabe lo que vas a hacer antes de que lo pienses, y ya ha visto cómo mueres.",
    ca: 17,
    pv: "190",
    velocidad: "9 m, volar 9 m (levita)",
    atributos: "FUE 10 DES 18 CON 16 INT 22 SAB 26 CAR 18",
    ataques: ["Agujas del telar (x3): +10, 1d8+4 perforante + 2d8 psíquico", "Hilo estrangulador: +10, apresado (CD 18)"],
    rasgos: [
      "Presciencia: no puede ser sorprendida; ventaja en iniciativa y en salvaciones de DES",
      "Presagios: empieza el combate con 3 resultados de d20 ya vistos y recupera 1 al inicio de cada ronda (máx. 3). Puede sustituir con uno cualquier tirada que vea: un ataque, una salvación, una prueba (usa presagio_criatura)",
      "Ya lo vi (3/día, reacción): un ataque que la impactaría falla",
      "Ceguera ante lo absurdo: solo ve futuros probables. Un plan disparatado, una acción que nadie dijo en voz alta o algo que contradiga la naturaleza del personaje le impone desventaja y no puede usar presagios contra ello (a juicio del DM)",
      "Resistencia legendaria (3/día)",
    ],
    habilidades: [
      {
        nombre: "Profecía de muerte",
        descripcion:
          "Pronuncia el nombre de un personaje y cómo morirá. Si falla, queda condenado: al final del tercer asalto llega su Cumplimiento. El destino solo se rompe si alguien corta el hilo de su telar o hace algo que ella no haya visto.",
        salvacion: "sab",
        cd: 19,
        condicion: "condenado por la profecía (Cumplimiento al final del 3.er asalto)",
        recarga: 6,
      },
      {
        nombre: "Cumplimiento",
        descripcion: "Llega la muerte anunciada a un condenado cuyo destino no se ha roto.",
        salvacion: "con",
        cd: 20,
        muerte_si_falla_por: 0,
      },
      {
        nombre: "Mañana robado",
        descripcion: "Ella ya vivió el próximo turno del objetivo; él no llega a vivirlo.",
        salvacion: "sab",
        cd: 17,
        condicion: "pierde su próximo turno",
        recarga: 5,
      },
      {
        nombre: "Hilos cortantes",
        descripcion: "Tensa los hilos del destino como cuchillas en un radio de 6 m.",
        salvacion: "des",
        cd: 18,
        dano: "8d8",
        tipo_dano: "cortante",
        mitad_si_exito: true,
        sangre: 6,
        herida: "golpe_masivo",
      },
    ],
    presagios: 3,
    botin: "El telar de los mañanas (reliquia): una vez por semana, tira un presagio",
  },
  {
    nombre: "Vaerth, el Sin Rostro",
    artes: ["callejon"],
    personalidad: ["calculador"],
    categoria: "jefe",
    peligro: 5,
    region: "Los barrios bajos de Aldenmar; puede ser cualquiera",
    descripcion:
      "Un cambiaformas que no tiene cara propia. Vive llevando la de otros: les roba la fuerza, la astucia, la belleza… y cuando ya no les queda nada, se queda con su piel.",
    ca: 16,
    pv: "210",
    velocidad: "12 m, trepar 12 m",
    atributos: "FUE 18 DES 20 CON 18 INT 18 SAB 14 CAR 22 (más lo que robe)",
    ataques: ["Garras cambiantes (x3): +11, 2d8+5 cortante", "Toque vacío: +11, 3d6 necrótico y Robar esencia como acción adicional"],
    rasgos: [
      "Cambiaformas: adopta la forma de cualquier criatura Mediana o Grande que haya visto, con su voz. Con la forma de una víctima a la que ha robado, también tiene sus recuerdos superficiales",
      "Rasgos robados: tiene los rasgos de raza y de clase de cada víctima a la que ha robado (aparecen en su estado) y suma a sus ataques el bonificador del atributo robado",
      "Mil caras: si cae a menos de la mitad de PV, se dispersa en una multitud y huye; solo muere de verdad si se le mata con su forma original (la de un niño sin rostro)",
      "Al morir, todo lo robado vuelve a sus dueños",
      "Resistencia legendaria (3/día)",
    ],
    habilidades: [
      {
        nombre: "Robar esencia",
        descripcion: "Toca a un objetivo y le arranca parte de lo que es.",
        salvacion: "car",
        cd: 17,
        robo: "1d4",
      },
      {
        nombre: "Arrancar el rostro",
        descripcion: "Contra un objetivo apresado o inconsciente: le quita la cara, y con ella la identidad.",
        salvacion: "con",
        cd: 18,
        dano: "4d10",
        tipo_dano: "necrótico",
        robo: "2d4",
        muerte_si_falla_por: 10,
      },
      {
        nombre: "Voz prestada",
        descripcion: "Habla con la voz de alguien amado por el objetivo.",
        salvacion: "sab",
        cd: 17,
        condicion: "hechizado: cree que Vaerth es un aliado hasta recibir daño",
      },
    ],
    botin: "Máscara de mil caras (maldita): permite cambiar de rostro, pero cada uso roba un recuerdo propio",
  },
  {
    nombre: "Kharoth, Dragón Antiguo del Sol Herido",
    blindaje: ["escamas_naturales"],
    personalidad: ["arrogante"],
    categoria: "jefe",
    peligro: 5,
    region: "Durmiendo sobre el corazón del dios Solar, en las Agujas de Vahl",
    descripcion: "El dragón que se comió la mitad del sol cuando cayó. Lleva un siglo dormido y digiriendo.",
    ca: 22,
    pv: "480",
    velocidad: "12 m, volar 24 m",
    atributos: "FUE 30 DES 10 CON 29 INT 18 SAB 15 CAR 23",
    ataques: ["Mordisco: +17, 2d10+10 perforante + 4d6 fuego", "Garras (x2): +17, 2d6+10", "Cola: +17, 2d8+10; derribado"],
    rasgos: ["Inmune al fuego", "3 acciones legendarias", "Resistencia legendaria (3/día)", "Presencia terrible: SAB CD 21 o asustado"],
    habilidades: [
      { nombre: "Aliento del sol muerto", descripcion: "Cono de 27 m de luz gris y fuego.", salvacion: "des", cd: 24, dano: "26d6", tipo_dano: "fuego", mitad_si_exito: true, muerte_si_falla_por: 10, ceniza: 2, recarga: 5 },
      { nombre: "Palabra del dios devorado", descripcion: "Pronuncia una palabra que no debería existir. Todos a 18 m.", salvacion: "sab", cd: 21, dano: "10d10", tipo_dano: "psíquico", mitad_si_exito: true, muerte_si_falla_por: 5, recarga: 6 },
    ],
    botin: "Corazón del dios Solar (reliquia definitiva); un tesoro de un siglo",
  },
  {
    nombre: "Kuru, el Cazador de Leyendas",
    artes: ["todos", "contracorriente"],
    temple: "cazador de leyendas",
    personalidad: ["calculador", "paranoico"],
    blindaje: ["gambeson", "escamas", "yelmo"],
    categoria: "jefe",
    peligro: 5,
    region: "Sin patria: allí donde haya algo legendario que cazar (cualquier región)",
    descripcion:
      "Un hombre delgado, de voz tranquila, con un abrigo cosido con pieles de bestias que nadie más ha visto y un collar de colmillos de dragón. No odia a sus presas: las estudia, las respeta y las mata. Dicen que ha cazado a un wyverno sin ayuda y que ya busca al próximo dios. Lleva una lanza de caza, dos espadas curvas y la paciencia de quien nunca ha fallado dos veces al mismo enemigo.",
    ca: 20,
    pv: "170",
    velocidad: "12 m, trepar 12 m",
    atributos: "FUE 18 DES 24 CON 18 INT 18 SAB 20 CAR 14",
    ataques: [
      "Lanza de caza (alcance 3 m): +13, 2d8+7 perforante",
      "Espadas curvas (x3 con la acción de atacar): +13, 2d6+7 cortante cada una",
      "Cuchillo de lanzar (12/36 m): +13, 1d8+7 perforante",
    ],
    rasgos: [
      "Maestro de armas: crítico con 19-20; apunta siempre a las juntas de la armadura (apuntar «hueco») sin penalizador y se mete por los huecos de gorjal y grebas",
      "ADAPTACIÓN (hasta 3 por combate): cada vez que recibe daño de un tipo nuevo o ve una táctica nueva (fuego, un plan, una emboscada, un conjuro, un ataque a distancia), en su siguiente turno gana resistencia a ese tipo de daño o ventaja contra esa táctica hasta el final del combate. Apunta qué ha aprendido: no vuelve a caer en lo mismo",
      "ESCURRIDIZO: se desengancha sin provocar ataques de oportunidad, se mueve al doble de velocidad sin provocar y puede esconderse como acción adicional aunque lo estén mirando (humo, sombras, tumulto). Ventaja en salvaciones contra apresado, derribado, asustado y cegado",
      "Retirada calculada: la primera vez que cae por debajo de la mitad de sus PV rompe el combate (trampa de humo o cuerda, y huye) si le queda alguna salida; solo muere si se la cierran. Vuelve en otro encuentro con una adaptación más y sabiendo cómo lucha cada uno de sus rivales",
      "Cazador de leyendas: ventaja en ataques contra criaturas de peligro 3 o más, contra magos y contra quien porte reliquias o Ceniza; nota lo legendario a un kilómetro. Estudia a su presa antes de atacar: en la primera ronda tiene ventaja en iniciativa si pudo observar al grupo",
      "ARTES MARCIALES: domina todos los estilos (Callejón, Piedra de Karak, Danza marchita, Filo del Cuervo, Presa de Hollín; el Haemajitsu solo si la historia lo justifica) y copia al verlos: si ve usar una técnica, la usa en su turno siguiente y, tras verla dos veces en el combate, la conserva hasta el final",
      "CONTRACORRIENTE (su estilo único): una vez por asalto, cuando un ataque (proyectil, arma o golpe) le va a alcanzar, lo desvía y reduce el daño (2d10+7); si lo anula, contraataca en la misma reacción con ventaja; con un proyectil pequeño puede devolverlo",
      "2 acciones legendarias por ronda (moverse sin provocar, lanzar un cuchillo, esconderse)",
      "Resistencia legendaria (2/día)",
      "Sin rencor ni prisa: habla con calma, ofrece tratos y abandona un combate perdido; no sacrifica su vida por una pieza",
    ],
    habilidades: [
      { nombre: "Estudiar a la presa", descripcion: "Acción adicional: elige a un enemigo que pueda ver; sus ataques contra él tienen ventaja hasta que ese enemigo cambie de táctica o caiga.", condicion: "marcado: Kuru tiene ventaja contra él hasta que cambie de táctica" },
      { nombre: "Danza de las cien heridas", descripcion: "Gira entre sus rivales cortando a todos los que estén a 3 m.", salvacion: "des", cd: 19, dano: "4d8+7", tipo_dano: "cortante", mitad_si_exito: true, herida: "critico", recarga: 5 },
      { nombre: "Humo de ceniza", descripcion: "Rompe una bolsa de ceniza y resina: una nube de 6 m de radio en la que solo él ve. Se retira o se reposiciona dentro.", salvacion: "con", cd: 18, condicion: "cegado hasta el final de su siguiente turno", recarga: 6 },
      { nombre: "Estocada de leyenda", descripcion: "Un único golpe contra un objetivo que haya estudiado y que esté solo, derribado, apresado o sorprendido.", salvacion: "con", cd: 20, dano: "6d10+7", tipo_dano: "perforante", muerte_si_falla_por: 10, herida: "critico" },
    ],
    botin: "Colmillo de wyverno engarzado en su lanza (arma encantada, +2); el diario donde apunta cómo mató a cada leyenda y a quién busca ahora",
  },
  {
    nombre: "Hugin, el Pensamiento",
    artes: ["cuervo"],
    temple: "Humano del Faro",
    personalidad: ["calculador", "prudente"],
    blindaje: ["cota_malla", "coraza", "yelmo", "gorjal"],
    categoria: "jefe",
    peligro: 4,
    region: "Aldenmar (cuartel general de la Compañía del Cuervo Negro)",
    descripcion:
      "Mariscal de la Compañía del Cuervo Negro. Un hombre de pelo gris cortado al rape y mirada de contable, con una pluma negra en la gorguera y las manos siempre quietas. Nunca levanta la voz. Ve la guerra como un tablero.",
    trasfondo: {
      origen:
        "Es uno de los dos mariscales que dirigen la Compañía del Cuervo Negro (el otro es Munin). Canon: el puesto solo se ocupa por renuncia o muerte, pero está obligado a ceder el cargo en un concurso de méritos cada 8 años (le toca ceder primero a él; cuándo lo decide el DM). Si ningún aspirante está a la altura, puede seguir o elegir a alguien capaz; si se negara a ceder, Munin debe deponerlo por la fuerza.",
      propuesto: [
        "Carácter (mío): el PENSAMIENTO. Estratega frío y paciente: piensa tres jugadas por delante, no actúa sin un plan y no se enfada nunca (la ira es un lujo). Trata los contratos como piezas de ajedrez y a los mercenarios como la máquina que hace girar la Compañía, y por eso los cuida: un cuervo que muere sin sentido es un error de cálculo",
        "Su defecto (mío): subestima lo que no se puede calcular —el afecto, el rencor, la fe—, y le cuesta perdonar a quien rompe un plan suyo aunque tenga razón",
        "Con Munin (mío): se respetan y discuten sin parar. Hugin dice «qué conviene»; Munin dice «qué nos debemos». Cada uno cree que el otro es lo que le falta a la Compañía",
        "Cómo gana (mío): no presenta combate si puede evitarlo; cuando lo hace, ya ha decidido el resultado antes de empezar (terreno, refuerzos, un arquero escondido). Los aspirantes que lo impresionan son los que le sorprenden con un plan mejor que el suyo",
        "Ante el concurso (mío): cederá el puesto sin dramatismo si el aspirante le gana limpiamente en méritos; si se siente traicionado por un plan, pondrá a prueba a los candidatos con una trampa antes de votar",
      ],
      abierto: ["¿Cómo se llamaba antes de ser Hugin?", "¿Cuántos años lleva en el puesto y quién fue su antecesor?"],
      pistas: ["Un tablero de piedra tallado en la mesa de su despacho, con fichas de cuervos negros", "Los mercenarios dicen: «Hugin ya lo había pensado»"],
    },
    ca: 19,
    pv: "135",
    velocidad: "9 m",
    atributos: "FUE 16 DES 14 CON 16 INT 20 SAB 16 CAR 16",
    ataques: ["Espada larga: +10, 2d8+5 cortante (x2 con la acción de atacar)", "Ballesta pesada (24/96 m): +8, 2d10+2 perforante"],
    rasgos: [
      "Estratega: al empezar el combate, él y sus aliados a 9 m tienen +2 a la iniciativa; su bando no puede ser sorprendido",
      "Plan trazado (acción adicional, 1/combate): elige un rival; los ataques de sus aliados contra él tienen ventaja hasta el final del siguiente asalto",
      "Ya lo había pensado: reacción, 2/combate; convierte en fallo un ataque que le impacta (su plan lo había previsto)",
      "Resistencia legendaria (1/día)",
      "Nunca pierde la calma: inmune a asustado",
    ],
    habilidades: [
      { nombre: "Orden de retirada", descripcion: "Grita una orden: hasta 6 aliados se desenganchan y se mueven sin provocar ataques de oportunidad." },
      { nombre: "Golpe calculado", descripcion: "Un único golpe contra un rival que haya estudiado un asalto entero.", salvacion: "con", cd: 17, dano: "4d10+5", tipo_dano: "cortante", mitad_si_exito: true },
    ],
    botin: "El sello de mariscal de la Compañía (abre cualquier cuartel); el cuaderno donde apunta cada contrato y su plan de reserva",
  },
  {
    nombre: "Munin, la Memoria",
    artes: ["cuervo"],
    temple: "Humano del Faro",
    personalidad: ["sereno", "paranoico"],
    blindaje: ["gambeson", "cota_malla", "almofar"],
    categoria: "jefe",
    peligro: 4,
    region: "Aldenmar (cuartel general de la Compañía del Cuervo Negro)",
    descripcion:
      "Mariscal de la Compañía del Cuervo Negro. Una mujer ancha de hombros, de pelo trenzado con plumas negras, que lleva siempre un libro de cuentas colgado del cinto. Saluda a cada mercenario por su nombre y por el nombre de su último contrato.",
    trasfondo: {
      origen:
        "Es una de las dos mariscales que dirigen la Compañía del Cuervo Negro (el otro es Hugin). Canon: el puesto solo se ocupa por renuncia o muerte, pero está obligada a ceder el cargo en un concurso de méritos cada 8 años (le toca ceder cuatro años después de Hugin). Si ningún aspirante está a la altura, puede seguir o elegir a alguien capaz; si se negara a ceder, Hugin debe deponerla por la fuerza.",
      propuesto: [
        "Carácter (mío): la MEMORIA. Guarda el libro de la Compañía: cada nombre, cada deuda, cada contrato cumplido o roto, cada cuervo caído. Es cálida con la tropa (se acuerda de sus cumpleaños y de sus muertos) e implacable con quien rompe un contrato o traiciona al Código: nunca olvida y nunca perdona del todo",
        "Su defecto (mío): vive en el pasado y desconfía del cambio y de los desconocidos; le cuesta ceder poder porque teme que se pierda la memoria de la Compañía",
        "Con Hugin (mío): se respetan y discuten sin parar. Munin dice «qué nos debemos»; Hugin dice «qué conviene». Cada uno cree que el otro es lo que le falta a la Compañía",
        "Cómo gana (mío): en combate es de las que aguantan; no pierde un duelo porque se acuerda de cada golpe del rival. Los aspirantes que la convencen son los que honran a los caídos y cumplen su palabra",
        "Ante el concurso (mío): su voto pesa por el clamor de la tropa, que la quiere; pondrá a prueba si el aspirante recuerda a quienes sirvieron antes que él",
      ],
      abierto: ["¿Cómo se llamaba antes de ser Munin?", "¿Cuántos años lleva en el puesto y quién fue su antecesora?"],
      pistas: ["Un libro de cuentas con las esquinas quemadas, lleno de nombres tachados y de nombres con una pluma dibujada al lado", "Los mercenarios dicen: «Munin se acuerda»"],
    },
    ca: 18,
    pv: "125",
    velocidad: "9 m",
    atributos: "FUE 18 DES 12 CON 18 INT 16 SAB 18 CAR 18",
    ataques: ["Hacha de batalla: +9, 2d8+6 cortante (x2 con la acción de atacar)", "Hachas de mano arrojadizas (6/18 m): +9, 1d6+6 cortante"],
    rasgos: [
      "Memoria de cuervo: ventaja en cualquier prueba para reconocer o recordar a una persona, un contrato o un trato; no se olvida de quien la agravió",
      "Presente la tropa: sus aliados a 9 m tienen ventaja en salvaciones contra asustado y hechizado (los muertos y las deudas los sostienen)",
      "Aguante: reacción, 2/combate; reduce a la mitad el daño de un ataque que ve",
      "Resistencia legendaria (1/día)",
    ],
    habilidades: [
      { nombre: "Cuentas pendientes", descripcion: "Marca a un rival que haya herido a un aliado de la Compañía: sus ataques contra él tienen ventaja hasta que caiga o ella lo haga.", condicion: "marcado por la memoria de Munin" },
      { nombre: "Golpe de balance", descripcion: "Un único golpe que cobra todo lo que le deben.", salvacion: "fue", cd: 17, dano: "4d10+6", tipo_dano: "cortante", mitad_si_exito: true },
    ],
    botin: "El libro de cuentas de la Compañía (cada nombre, cada deuda: vale mucho para quien lo quiera, y para quien lo quiera destruir); el hacha de batalla",
  },
];

/** VD (valor de desafío) orientativo de cada criatura. Propuesto, a confirmar: es solo informativo (las reglas siguen usando el peligro 1–5). */
export const VD: Record<string, string> = {
  Hambriento: "1", "Lobo de Ceniza": "1/2", Duende: "1", "Ghul de las fosas": "2", Ogro: "3", "Gárgola": "2", "Arpía": "2", "Hombre pez": "3", "Hombre lagarto": "3",
  "Troll de ciénaga": "6", Wyverno: "6", Basilisco: "5", "Mantícora": "5", "Banshee del Velo": "5", Ulfhedinn: "5", "Hombre oso": "6",
  "Golem de carne": "5", "Elemental de fuego": "5", "Elemental de agua": "6", "Elemental de aire": "5", Grifo: "5", Sirena: "5",
  "Gigante de hueso": "10", "Dragón joven de ceniza": "11", "Apóstol": "12", Wendigo: "9", "Golem de piedra": "10", "Elemental de tierra": "9",
  Djinn: "6", Hidra: "10", Leshen: "9", Moira: "9", Lich: "16",
  "Hugin, el Pensamiento": "12", "Munin, la Memoria": "11", "Vaskar, el Lobo del Eclipse": "15", "El Juez Sin Ojos": "14", "Ysolde, la Reina Pálida": "16",
  "La Madre de los Hambrientos": "16", "El Que Golpea Bajo la Piedra": "18", "Ilvara, la Tejedora de Mañanas": "15", "Vaerth, el Sin Rostro": "16",
  "Kharoth, Dragón Antiguo del Sol Herido": "24", "Kuru, el Cazador de Leyendas": "15",
};
for (const c of BESTIARIO) c.vd = VD[c.nombre];

export function buscarCriatura(nombre: string): Criatura | undefined {
  const n = nombre.toLowerCase();
  return BESTIARIO.find((c) => c.nombre.toLowerCase() === n) ?? BESTIARIO.find((c) => c.alias?.some((a) => a.toLowerCase() === n)) ?? BESTIARIO.find((c) => c.nombre.toLowerCase().includes(n));
}

export function fichaCriatura(c: Criatura): string {
  return [
    `${c.nombre} — ${c.categoria}, peligro ${c.peligro}/5${c.vd ? `, VD ${c.vd}` : ""} (${c.region})`,
    c.descripcion,
    `CA ${c.ca} · PV ${c.pv} · Vel. ${c.velocidad} · ${c.atributos}${c.temple ? ` · temple: ${c.temple}` : ""}${c.personalidad?.length ? ` · carácter: ${c.personalidad.join(", ")}` : ""}${c.blindaje?.length ? ` · blindaje: ${c.blindaje.join(", ")}` : ""}`,
    `Ataques: ${c.ataques.join(" | ")}`,
    c.rasgos.length ? `Rasgos: ${c.rasgos.join(" | ")}` : "",
    c.trasfondo
      ? `TRASFONDO (secreto del DM; los PNJ solo saben rumores): ${c.trasfondo.origen}${c.trasfondo.enemigos ? ` ENEMIGOS: ${c.trasfondo.enemigos}` : ""}${c.trasfondo.propuesto?.length ? ` PROPUESTO (sin confirmar; úsalo con criterio): ${c.trasfondo.propuesto.join(" · ")}` : ""}${c.trasfondo.pistas?.length ? ` PISTAS para revelarlo poco a poco: ${c.trasfondo.pistas.join(" · ")}.` : ""}${c.trasfondo.abierto?.length ? ` AÚN ABIERTO: ${c.trasfondo.abierto.join(" ")}` : ""}${c.trasfondo.mision ? ` MISIÓN SEMILLA «${c.trasfondo.mision.nombre}» (${c.trasfondo.mision.estado}): INICIO: ${c.trasfondo.mision.inicio} NUDO: ${c.trasfondo.mision.nudo} DESENLACES POSIBLES: ${c.trasfondo.mision.desenlaces.join(" | ")} PNJ: ${c.trasfondo.mision.pnjs.join(" | ")} GANCHOS: ${c.trasfondo.mision.ganchos.join(" | ")}. Para jugarla: trama abrir_arco con su premisa, registra a los PNJ con agenda (pnj) y avanza el arco con avanzar_arco.` : ""}`
      : "",
    c.regente
      ? `REGENTE (${c.regente.titulo}): ${c.regente.corte} Subordinados: ${c.regente.servidores.map((x) => `${x.nombre} ×${x.cuantos}${x.plantilla ? ` [plantilla «${x.plantilla}»]` : ""} — ${x.nota}`).join(" | ")}. ${c.regente.politica ? ` POLÍTICA (inciden fuera de su dominio para imponerse; sus relaciones con los otros regentes cambian con la conveniencia y la situación): objetivo: ${c.regente.politica.objetivo} Medios: ${c.regente.politica.medios.join(" | ")}. Agentes: ${c.regente.politica.agentes.join(", ")}.` : ""} Puede enviarlos a cumplir su voluntad sin estar presente (llegan como emisarios o como fuerza armada) y, si da la cara, su séquito lo acompaña: no lo pongas nunca solo.`
      : "",
    c.habilidades.length
      ? `Habilidades especiales (resuélvelas con habilidad_criatura): ${c.habilidades
          .map((h) => `${h.nombre}${h.recarga ? ` [recarga ${h.recarga === 6 ? "6" : `${h.recarga}-6`}]` : ""}: ${h.descripcion}${h.salvacion ? ` ${h.salvacion.toUpperCase()} CD ${h.cd}` : ""}${h.robo ? ` — ROBA ${h.robo} del mejor atributo` : ""}${h.muerte_si_falla_por !== undefined ? ` — MUERTE INSTANTÁNEA si falla${h.muerte_si_falla_por ? ` por ${h.muerte_si_falla_por}+` : ""}` : ""}`)
          .join(" | ")}`
      : "",
    c.presagios ? `Ve el futuro: ${c.presagios} presagios (usa presagio_criatura para verlos, usarlos y renovarlos)` : "",
    c.botin ? `Botín: ${c.botin}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function estadoTexto(e: EstadoJefe): string {
  const f = e.pv / e.pv_max;
  if (e.pv <= 0) return "caído";
  if (f > 0.9) return "intacto";
  if (f > 0.6) return "herido";
  if (f > 0.3) return "malherido, sangrando";
  return "al borde de la muerte";
}

export function aparecer(partida: Partida, c: Criatura, alias?: string): string {
  const nombre = alias ?? c.nombre;
  const pv = /d/.test(c.pv) ? tirar(c.pv).total : Number(c.pv);
  const presagios = Array.from({ length: c.presagios ?? 0 }, () => tirar("1d20").total);
  partida.jefes[nombre] = { nombre, pv, pv_max: pv, gastadas: [], definicion: c, presagios, robos: [] };
  return `${nombre} entra en escena con ${pv} PV.${presagios.length ? ` Presagios: [${presagios.join(", ")}].` : ""}\n${fichaCriatura(c)}`;
}

/** Ver, usar o renovar los presagios de una criatura que ve el futuro. */
export function presagio(e: EstadoJefe, accion: "ver" | "usar" | "renovar", valor_?: number): string {
  const max = e.definicion.presagios ?? 3;
  if (accion === "renovar") {
    if (e.presagios.length >= max) return `${e.nombre} ya tiene ${max} presagios: [${e.presagios.join(", ")}].`;
    const t = tirar("1d20").total;
    e.presagios.push(t);
    return `${e.nombre} ve un nuevo futuro: ${t}. Presagios: [${e.presagios.join(", ")}].`;
  }
  if (accion === "usar") {
    const i = valor_ === undefined ? -1 : e.presagios.indexOf(valor_);
    if (i < 0) return `No tiene ese presagio. Presagios: [${e.presagios.join(", ") || "ninguno"}].`;
    e.presagios.splice(i, 1);
    return `${e.nombre} impone el futuro que ya vio: la tirada es un ${valor_} natural. Quedan [${e.presagios.join(", ") || "ninguno"}].`;
  }
  return `Presagios de ${e.nombre}: [${e.presagios.join(", ") || "ninguno"}].`;
}

/** Devuelve a sus dueños todo lo que robó una criatura (al morir). */
export function devolverRobos(partida: Partida, e: EstadoJefe): string[] {
  const log: string[] = [];
  for (const r of e.robos) {
    const p = partida.personajes[r.personaje];
    if (!p) continue;
    p.robado[r.atributo] = Math.max(0, (p.robado[r.atributo] ?? 0) - r.cantidad);
    log.push(`${p.nombre} recupera ${r.cantidad} de ${r.atributo.toUpperCase()}.`);
  }
  e.robos = [];
  return log;
}

function robarEsencia(e: EstadoJefe | undefined, p: Personaje, dados: string, log: string[]) {
  const atributo = [...ATRIBUTOS].sort((a, b) => valor(p, b) - valor(p, a))[0];
  const cantidad = Math.min(tirar(dados).total, valor(p, atributo));
  p.robado[atributo] = (p.robado[atributo] ?? 0) + cantidad;
  const quien = e?.nombre ?? "La criatura";
  log.push(`  ${quien} roba ${cantidad} de ${atributo.toUpperCase()} a ${p.nombre} (ahora ${valor(p, atributo)}).`);
  if (e) {
    const yaTenia = e.robos.some((r) => r.personaje === p.nombre);
    e.robos.push({ personaje: p.nombre, atributo, cantidad, raza: p.raza, clase: p.clase });
    if (!yaTenia) {
      const rz = raza(p.raza);
      const cl = clase(p.clase);
      log.push(
        `  Gana los rasgos de ${p.nombre} (${p.raza}, ${p.clase}) y puede adoptar su forma: ${[...(rz?.rasgos ?? []), ...(cl?.rasgos ?? [])].join("; ")}.`,
      );
    }
  }
  if (valor(p, atributo) <= 0) {
    marcarMuerto(p);
    log.push(`  ☠ ${p.nombre} se queda vacío: no queda nada de quien era. Ha muerto, y ${quien} se queda con su forma.`);
  }
}

export function danar(e: EstadoJefe, cantidad: number): string {
  e.pv = Math.max(0, Math.min(e.pv_max, e.pv - cantidad));
  return `${e.nombre}: ${cantidad >= 0 ? `−${cantidad}` : `+${-cantidad}`} PV → ${e.pv}/${e.pv_max} (${estadoTexto(e)}).`;
}

export function usarHabilidad(e: EstadoJefe | undefined, h: Habilidad, objetivos: Personaje[], cdMenos = 0, esquivan: string[] = []): string {
  const log: string[] = [];
  const quien = e?.nombre ?? "La criatura";
  const sello = e?.sellos?.find((s) => h.nombre.toLowerCase().includes(s.habilidad.toLowerCase()) || s.habilidad.toLowerCase().includes(h.nombre.toLowerCase()));
  if (sello) return `${quien} tiene sellado «${h.nombre}» (su alma está en manos de ${sello.por}): no puede usarlo. Elige otra acción.`;
  if (e && h.recarga) {
    if (e.gastadas.includes(h.nombre)) {
      const r = tirar("1d6").total;
      if (r < h.recarga) return `${h.nombre} no se ha recargado (d6 = ${r}, necesita ${h.recarga}+). Elige otra acción.`;
      log.push(`${h.nombre} se recarga (d6 = ${r}).`);
    } else e.gastadas.push(h.nombre);
  }
  log.push(`${quien} usa ${h.nombre}: ${h.descripcion}`);
  const danoTotal = h.dano ? tirar(h.dano) : null;
  if (danoTotal) log.push(`Daño: ${describir(danoTotal)}${h.tipo_dano ? ` ${h.tipo_dano}` : ""}.`);

  for (const p of objetivos) {
    if (p.condiciones.includes("muerto")) {
      log.push(`· ${p.nombre} ya está muerto.`);
      continue;
    }
    let falla = true;
    let margen = -99;
    if (h.salvacion && h.cd) {
      const s = salvacion(p, h.salvacion, Math.max(5, h.cd - cdMenos), { ventaja: h.salvacion === "des" && esquivan.includes(p.nombre.toLowerCase()), contra: `${h.nombre} ${h.descripcion}` }); // quien esquiva tiene ventaja en las salvaciones de DES
      falla = !s.exito;
      margen = s.margen;
      log.push(`· ${p.nombre}: ${s.texto}`);
    } else log.push(`· ${p.nombre}: sin salvación.`);

    if (falla && h.muerte_si_falla_por !== undefined && -margen >= h.muerte_si_falla_por) {
      marcarMuerto(p);
      log.push(`  ☠ MUERTE INSTANTÁNEA. ${p.nombre} ha muerto.${h.condicion ? ` (${h.condicion})` : ""}`);
      continue;
    }
    if (danoTotal) {
      const dBruto = falla || !h.mitad_si_exito ? danoTotal.total : Math.floor(danoTotal.total / 2);
      if (falla || h.mitad_si_exito) {
        const estabaEnSuelo = p.pv <= 0;
        const pvAntes = p.pv;
        const res = danoConResistencia(p, dBruto, h.tipo_dano);
        const d = res.dano;
        p.pv = Math.max(0, p.pv - d);
        if (res.nota) log.push(`  ${res.nota.trim()}`);
        if (estabaEnSuelo && d > 0) { const t = danoEnSuelo(p, d, false); if (t) log.push("  " + t); }
        else { const mi = muerteInstantanea(p, pvAntes, d); if (mi) log.push("  " + mi); }
        log.push(`  Recibe ${d} de daño (PV ${p.pv}).${p.pv === 0 ? " ¡Cae a 0 PV!" : ""}`);
      }
    }
    if (falla) {
      if (h.condicion) {
        agregarCondicion(p.condiciones, h.condicion);
        log.push(`  Condición: ${h.condicion}.${textoEfectos([h.condicion]) ? ` Efecto: ${textoEfectos([h.condicion])}` : ""}`);
      }
      if (h.herida) log.push("  " + infligir(p, { causa: h.herida, tipo: tipoHerida(h.tipo_dano), descripcion: h.nombre }).replace(/\n/g, "\n  "));
      if (h.sangre) {
        const sub: string[] = [];
        perderSangre(p, h.sangre, sub);
        if (sub.length) log.push("  " + sub.join("\n  "));
      }
      if (h.ceniza) {
        p.ceniza += h.ceniza;
        log.push(`  +${h.ceniza} de Ceniza (total ${p.ceniza}).`);
      }
      if (h.robo && !p.condiciones.includes("muerto")) robarEsencia(e, p, h.robo, log);
    }
  }
  return log.join("\n");
}

function tipoHerida(t?: string) {
  if (!t) return "contusion" as const;
  if (/cort/.test(t)) return "corte" as const;
  if (/perfor/.test(t)) return "perforacion" as const;
  if (/fuego|ácido|acido/.test(t)) return "quemadura" as const;
  if (/necr/.test(t)) return "necrotica" as const;
  return "contusion" as const;
}

export function textoBestiario(): string {
  const porCat = (cat: Criatura["categoria"][]) =>
    BESTIARIO.filter((c) => cat.includes(c.categoria))
      .map((c) => `- ${c.nombre} (peligro ${c.peligro}${c.vd ? `, VD ${c.vd}` : ""}, ${c.region}): ${c.descripcion}`)
      .join("\n");
  return `## Bestiario de referencia
Esto es una base, no un límite. Puedes y debes inventar criaturas nuevas cuando la aventura lo pida (harpías, gólems, hidras, krakens de ciénaga, nigromantes, caballeros caídos, demonios menores, enjambres, lo que sea), coherentes con Velmora. Para criaturas con habilidades peligrosas, regístralas con aparecer_criatura (con "definicion") para que el programa lleve sus PV y resuelva sus habilidades. Las criaturas sencillas puedes llevarlas tú con tirar_dados.
Algunos jefes ven el futuro (presagios: sustituye con presagio_criatura las tiradas de los jugadores en los momentos clave y renueva uno al inicio de cada ronda; descríbelo: "ella ya sabía que ibas a hacer eso") o roban esencia (atributos, rasgos de raza y clase, formas): úsalo para que el jefe imite al personaje robado, use sus rasgos contra el grupo y se haga pasar por él.
Los jefes son extremadamente difíciles: no es obligatorio vencerlos en combate directo. Siémbralos con rumores, rastros y víctimas antes de que aparezcan, y deja que los jugadores preparen, huyan, negocien o busquen sus debilidades. Anuncia el peligro de una habilidad letal antes de que se use por primera vez (una señal, un aviso, un cadáver).

Los REGENTES (el Juez Sin Ojos, Ysolde y la Madre de los Hambrientos) gobiernan un dominio: tienen subordinados (ver su ficha) que envían a cumplir su voluntad —monstruos, esbirros, minions—, y cuando están en escena van con su séquito. Una oleada de Hambrientos, una patrulla de la Llama Gris o una invitación de la Corte pueden ser la mano de su regente: dales esa razón.

### Bestias y monstruos
${porCat(["bestia", "monstruo"])}

### Jefes
${porCat(["jefe"])}`;
}
