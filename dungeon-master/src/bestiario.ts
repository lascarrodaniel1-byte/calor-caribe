// Bestiario: criaturas de referencia y jefes. Es una BASE: el DM puede crear
// criaturas y habilidades nuevas con la misma estructura en cualquier momento.
import { describir, tirar } from "./dados.js";
import type { Partida, Personaje } from "./estado.js";
import { infligir, perderSangre, type Causa } from "./heridas.js";
import { clase, raza } from "./mundo.js";
import { ATRIBUTOS, marcarMuerto, salvacion, valor, type Atributo } from "./reglas.js";

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

export interface Criatura {
  nombre: string;
  categoria: "bestia" | "monstruo" | "jefe";
  /** 1 (peligro común) a 5 (mata a un grupo entero si se descuida). */
  peligro: 1 | 2 | 3 | 4 | 5;
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
  pv: number;
  pv_max: number;
  /** Habilidades con recarga gastadas. */
  gastadas: string[];
  definicion: Criatura;
  /** Resultados de d20 ya "vistos" que puede usar en lugar de cualquier tirada. */
  presagios: number[];
  robos: Robo[];
}

export const BESTIARIO: Criatura[] = [
  // ------------------------------------------------------------ comunes
  {
    nombre: "Hambriento",
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
  // ------------------------------------------------------------ jefes
  {
    nombre: "Vaskar, el Lobo del Eclipse",
    categoria: "jefe",
    peligro: 5,
    region: "Corazón del Bosque de Velo Rojo",
    descripcion: "El primer Varg, padre de la maldición. Un lobo del tamaño de un carro, con la luna muerta en los ojos.",
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
    categoria: "jefe",
    peligro: 5,
    region: "Catedral sumergida bajo Aldenmar",
    descripcion: "El primer Inquisidor, que se arrancó los ojos para no ver morir a los dioses. Aún juzga, y siempre condena.",
    ca: 19,
    pv: "180",
    velocidad: "9 m",
    atributos: "FUE 20 DES 12 CON 18 INT 16 SAB 22 CAR 20",
    ataques: ["Espadón de llama gris (x2): +11, 2d6+5 cortante + 3d6 fuego"],
    rasgos: ["Ciego pero con vista ciega a 36 m: inmune a ilusiones e invisibilidad", "Resistencia legendaria (3/día)"],
    habilidades: [
      { nombre: "Veredicto", descripcion: "Señala a un culpable.", salvacion: "sab", cd: 18, dano: "8d10", tipo_dano: "fuego", mitad_si_exito: true, muerte_si_falla_por: 5, recarga: 5 },
      { nombre: "Confesión", descripcion: "Todos a 18 m confiesan su peor pecado en voz alta o arden.", salvacion: "car", cd: 17, dano: "4d10", tipo_dano: "psíquico", condicion: "aturdido 1 asalto" },
    ],
    botin: "Espadón de llama gris (encantado); los archivos secretos de la Inquisición",
  },
  {
    nombre: "Ysolde, la Reina Pálida",
    categoria: "jefe",
    peligro: 5,
    region: "Castillo de Vel Morhal, en la Marca Hueca",
    descripcion: "Reina de la Corte Pálida, hermosa y antigua. Habla con cortesía exquisita mientras te vacía.",
    ca: 18,
    pv: "220",
    velocidad: "12 m, trepar 12 m",
    atributos: "FUE 18 DES 18 CON 18 INT 18 SAB 16 CAR 24",
    ataques: ["Garras: +10, 2d8+4 cortante; apresada (CD 18)", "Mordisco (objetivo apresado): +10, 1d8+4 + 4d10 necrótico; ella recupera lo mismo"],
    rasgos: ["Regeneración 20 salvo luz solar o agua bendecida con sal", "Forma de niebla al caer a 0 PV: solo muere si se la estaca en su ataúd", "Resistencia legendaria (3/día)"],
    habilidades: [
      { nombre: "Mirada de la Reina", descripcion: "Un objetivo que la vea.", salvacion: "sab", cd: 19, condicion: "hechizado: la ve como su más querida aliada 1 hora" },
      { nombre: "Vaciar", descripcion: "Bebe hasta el fondo de un objetivo apresado. Quien muere así se levanta al día siguiente como su siervo.", salvacion: "con", cd: 18, dano: "6d10", tipo_dano: "necrótico", sangre: 15, muerte_si_falla_por: 10 },
    ],
    botin: "La corona pálida (maldita); las escrituras de media Marca",
  },
  {
    nombre: "La Madre de los Hambrientos",
    categoria: "jefe",
    peligro: 5,
    region: "Una fosa común sin fondo en las Ciénagas de Hollín",
    descripcion: "Una masa de cadáveres cosidos por la Podre, grande como una casa, que pare Hambrientos sin parar.",
    ca: 15,
    pv: "260",
    velocidad: "6 m",
    atributos: "FUE 22 DES 6 CON 24 INT 8 SAB 14 CAR 3",
    ataques: ["Brazos de la fosa (x3): +10, 2d10+6 contundente; apresado (CD 17); Podre (cd_podre 16)"],
    rasgos: ["Parto de muertos: al inicio de cada ronda nacen 1d4 Hambrientos", "Inmune a veneno, necrótico, miedo"],
    habilidades: [
      { nombre: "Abrazo de la fosa", descripcion: "Contra un objetivo apresado al inicio de su turno: lo hunde en la masa. Quien muere así es absorbido: su cuerpo pasa a formar parte de la Madre.", salvacion: "fue", cd: 17, dano: "4d10", tipo_dano: "contundente", muerte_si_falla_por: 5 },
      { nombre: "Vómito de Podre", descripcion: "Cono de 9 m de carne licuada.", salvacion: "con", cd: 16, dano: "8d8", tipo_dano: "necrótico", mitad_si_exito: true, herida: "menor", recarga: 5 },
    ],
  },
  {
    nombre: "El Que Golpea Bajo la Piedra",
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
];

export function buscarCriatura(nombre: string): Criatura | undefined {
  const n = nombre.toLowerCase();
  return BESTIARIO.find((c) => c.nombre.toLowerCase() === n) ?? BESTIARIO.find((c) => c.nombre.toLowerCase().includes(n));
}

export function fichaCriatura(c: Criatura): string {
  return [
    `${c.nombre} — ${c.categoria}, peligro ${c.peligro}/5 (${c.region})`,
    c.descripcion,
    `CA ${c.ca} · PV ${c.pv} · Vel. ${c.velocidad} · ${c.atributos}`,
    `Ataques: ${c.ataques.join(" | ")}`,
    c.rasgos.length ? `Rasgos: ${c.rasgos.join(" | ")}` : "",
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

export function usarHabilidad(e: EstadoJefe | undefined, h: Habilidad, objetivos: Personaje[]): string {
  const log: string[] = [];
  const quien = e?.nombre ?? "La criatura";
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
      const s = salvacion(p, h.salvacion, h.cd);
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
      const d = falla || !h.mitad_si_exito ? danoTotal.total : Math.floor(danoTotal.total / 2);
      if (falla || h.mitad_si_exito) {
        p.pv = Math.max(0, p.pv - d);
        log.push(`  Recibe ${d} de daño (PV ${p.pv}).${p.pv === 0 ? " ¡Cae a 0 PV!" : ""}`);
      }
    }
    if (falla) {
      if (h.condicion) {
        p.condiciones.push(h.condicion);
        log.push(`  Condición: ${h.condicion}.`);
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
      .map((c) => `- ${c.nombre} (peligro ${c.peligro}, ${c.region}): ${c.descripcion}`)
      .join("\n");
  return `## Bestiario de referencia
Esto es una base, no un límite. Puedes y debes inventar criaturas nuevas cuando la aventura lo pida (harpías, gólems, hidras, krakens de ciénaga, nigromantes, caballeros caídos, demonios menores, enjambres, lo que sea), coherentes con Velmora. Para criaturas con habilidades peligrosas, regístralas con aparecer_criatura (con "definicion") para que el programa lleve sus PV y resuelva sus habilidades. Las criaturas sencillas puedes llevarlas tú con tirar_dados.
Algunos jefes ven el futuro (presagios: sustituye con presagio_criatura las tiradas de los jugadores en los momentos clave y renueva uno al inicio de cada ronda; descríbelo: "ella ya sabía que ibas a hacer eso") o roban esencia (atributos, rasgos de raza y clase, formas): úsalo para que el jefe imite al personaje robado, use sus rasgos contra el grupo y se haga pasar por él.
Los jefes son extremadamente difíciles: no es obligatorio vencerlos en combate directo. Siémbralos con rumores, rastros y víctimas antes de que aparezcan, y deja que los jugadores preparen, huyan, negocien o busquen sus debilidades. Anuncia el peligro de una habilidad letal antes de que se use por primera vez (una señal, un aviso, un cadáver).

### Bestias y monstruos
${porCat(["bestia", "monstruo"])}

### Jefes
${porCat(["jefe"])}`;
}
