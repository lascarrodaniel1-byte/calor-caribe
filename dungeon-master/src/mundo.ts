// Ambientación de la campaña: Velmora, el Reino del Sol Herido (dark fantasy).
// Las razas y clases definidas aquí son las únicas que acepta guardar_personaje,
// y sus rasgos de curación los aplica el motor de heridas (heridas.ts).

export interface RasgosCuracion {
  /** Bonificador a las salvaciones contra infección. */
  infeccion: number;
  /** Bonificador a la tirada de recuperación al terminar de sanar una herida. */
  recuperacion: number;
  inmunePodre: boolean;
  /** Cómo le afecta la magia divina: "normal" (1 Ceniza), "doble" (2 Ceniza) o "no_funciona". */
  magia: "normal" | "doble" | "no_funciona";
  /** Las heridas leves sanan en 1 día, sin tratamiento. */
  levesRapidas: boolean;
}

export interface Raza {
  nombre: string;
  descripcion: string;
  atributos: string;
  rasgos: string[];
  curacion: RasgosCuracion;
  notaCuracion: string;
}

export interface Clase {
  nombre: string;
  base: string;
  dadoGolpe: number;
  principal: string;
  salvaciones: string;
  rasgos: string[];
  equipo: string;
}

const CURACION_NORMAL: RasgosCuracion = {
  infeccion: 0,
  recuperacion: 0,
  inmunePodre: false,
  magia: "normal",
  levesRapidas: false,
};

export const RAZAS: Raza[] = [
  {
    nombre: "Humano del Faro",
    descripcion:
      "Supervivientes tozudos de Aldenmar y sus aldeas. Son la mayoría, desconfían de todo lo que no es humano y rezan a dioses que ya no contestan.",
    atributos: "+1 a todos los atributos",
    rasgos: ["Obstinación: ventaja en salvaciones para no quedar asustado", "Una competencia de habilidad adicional"],
    curacion: CURACION_NORMAL,
    notaCuracion: "Sin rasgos especiales.",
  },
  {
    nombre: "Enano de Karak-Dûm",
    descripcion:
      "Exiliados de la Fortaleza Silente, sellada desde que algo despertó en lo profundo. Cargan con la vergüenza de haber huido y con la memoria de los nombres de sus muertos.",
    atributos: "+2 CON, +1 FUE",
    rasgos: ["Visión en la oscuridad (18 m)", "Resistencia al daño de veneno y ventaja en salvaciones contra veneno", "Competencia con hachas y martillos de guerra"],
    curacion: { ...CURACION_NORMAL, infeccion: 2 },
    notaCuracion: "+2 en salvaciones contra infección.",
  },
  {
    nombre: "Elfo Marchito",
    descripcion:
      "Sus bosques murieron con los dioses. Su piel es grisácea, su memoria larguísima y su carne apenas se renueva: un elfo herido arrastra la herida durante meses.",
    atributos: "+2 DES, +1 SAB",
    rasgos: ["Visión en la oscuridad (18 m)", "Trance: 4 h de meditación equivalen a dormir", "Ventaja contra ser hechizado"],
    curacion: { ...CURACION_NORMAL, inmunePodre: true, recuperacion: -2 },
    notaCuracion: "Inmune a la Podre, pero −2 en las tiradas de recuperación.",
  },
  {
    nombre: "Mediano de Hollín",
    descripcion:
      "Viven en aldeas sobre pilotes en las Ciénagas de Hollín. Contrabandistas, barqueros y ladrones de cadáveres; nadie conoce mejor los caminos del lodo.",
    atributos: "+2 DES, +1 CON",
    rasgos: ["Afortunado: repite los 1 naturales en d20 (una vez por tirada)", "Sigilo natural: puede esconderse tras criaturas más grandes", "Valiente: ventaja contra quedar asustado"],
    curacion: { ...CURACION_NORMAL, infeccion: 1 },
    notaCuracion: "+1 en salvaciones contra infección (criados en el fango).",
  },
  {
    nombre: "Varg",
    descripcion:
      "Humanos marcados por la Maldición del Lobo: ojos amarillos, colmillos, vello espeso. La Inquisición los quema si los atrapa; la Compañía del Cuervo los contrata sin preguntar.",
    atributos: "+2 FUE, +1 CON",
    rasgos: ["Olfato de lobo: ventaja en Percepción basada en el olfato", "Mordisco: 1d6 + FUE perforante", "Furia de la luna: una vez por descanso largo, +2 al daño cuerpo a cuerpo durante 1 minuto"],
    curacion: { ...CURACION_NORMAL, recuperacion: 2, levesRapidas: true, magia: "doble" },
    notaCuracion: "Las heridas leves sanan en 1 día; +2 en recuperación; la magia divina le quema (2 de Ceniza).",
  },
  {
    nombre: "Nacido Pálido",
    descripcion:
      "Hijos de mortales y de la Corte Pálida. Fríos al tacto, sin reflejo nítido. Pueden pasar por humanos… hasta que tienen hambre.",
    atributos: "+2 CAR, +1 DES",
    rasgos: ["Visión en la oscuridad (18 m)", "Mordisco vampírico: 1d4 + CON necrótico y recupera PV igual al daño (una vez por descanso corto)", "Andar de araña: trepa sin pruebas durante 1 minuto (una vez por descanso largo)"],
    curacion: { ...CURACION_NORMAL, infeccion: 2, magia: "no_funciona" },
    notaCuracion: "+2 contra infección; la magia divina no le afecta en absoluto.",
  },
  {
    nombre: "Cenizo",
    descripcion:
      "Nacidos durante el Eclipse Eterno, con brasas en los ojos y la piel veteada de gris. Muchos creen que llevan dentro una chispa de los dioses muertos.",
    atributos: "+2 CON, +1 SAB",
    rasgos: ["Resistencia al daño de fuego", "Brasa interior: una vez por descanso largo puede cauterizar una herida con la mano sin sufrir daño adicional", "Conoce el truco Llama sagrada (SAB)"],
    curacion: CURACION_NORMAL,
    notaCuracion: "Cauterio sin dolor una vez por descanso largo.",
  },
];

export const CLASES: Clase[] = [
  {
    nombre: "Mercenario del Cuervo",
    base: "Guerrero",
    dadoGolpe: 10,
    principal: "FUE o DES",
    salvaciones: "FUE, CON",
    rasgos: ["Estilo de combate", "Segundo aliento: acción adicional para recuperar 1d10 + nivel PV (no cierra heridas)", "Competencia con todas las armas, armaduras y escudos"],
    equipo: "Cota de mallas, espada larga, escudo, ballesta ligera y 20 virotes, petate, 10 po",
  },
  {
    nombre: "Berserker de Ceniza",
    base: "Bárbaro",
    dadoGolpe: 12,
    principal: "FUE",
    salvaciones: "FUE, CON",
    rasgos: [
      "Furia (2/descanso largo): +2 al daño cuerpo a cuerpo y resistencia a daño contundente, cortante y perforante",
      "En furia ignora las penalizaciones de sus heridas; al terminar, salvación de CON CD 10 o una herida moderada sin tratar se agrava",
      "Defensa sin armadura: CA 10 + DES + CON",
    ],
    equipo: "Hacha a dos manos, 2 hachas de mano, pieles, 4 jabalinas, 5 po",
  },
  {
    nombre: "Caballero Juramentado",
    base: "Paladín",
    dadoGolpe: 10,
    principal: "FUE y CAR",
    salvaciones: "SAB, CAR",
    rasgos: [
      "Sentido divino: detecta no-muertos y corruptos a 18 m",
      "Imposición de manos: reserva de 5 × nivel PV. Restaurar PV es libre; usarla para tratar una herida cuenta como magia divina (genera Ceniza)",
      "Juramento a un dios muerto: debe nombrarlo y elegir un voto que no puede romper",
    ],
    equipo: "Cota de mallas, espada larga, escudo, símbolo de un dios muerto, 5 jabalinas, 8 po",
  },
  {
    nombre: "Cazador de Brujas",
    base: "Explorador",
    dadoGolpe: 10,
    principal: "DES y SAB",
    salvaciones: "FUE, DES",
    rasgos: [
      "Enemigo predilecto: no-muertos o brujos (ventaja para rastrearlos y recordar saber sobre ellos)",
      "Explorador nato: no se pierde en un tipo de terreno elegido",
      "Sal y plata: sus ataques con munición de plata ignoran la resistencia de no-muertos",
    ],
    equipo: "Cuero tachonado, estoque, ballesta de mano y 20 virotes (5 de plata), 3 frascos de sal, estacas, 6 po",
  },
  {
    nombre: "Degollador",
    base: "Pícaro",
    dadoGolpe: 8,
    principal: "DES",
    salvaciones: "DES, INT",
    rasgos: ["Ataque furtivo: +1d6 daño con ventaja o un aliado adyacente al objetivo", "Pericia en dos habilidades", "Jerga de ladrones de Aldenmar"],
    equipo: "Armadura de cuero, espada corta, 2 dagas, herramientas de ladrón, capa oscura, 12 po",
  },
  {
    nombre: "Flagelante",
    base: "Monje",
    dadoGolpe: 8,
    principal: "DES y SAB",
    salvaciones: "FUE, DES",
    rasgos: [
      "Artes marciales: golpes sin armas de 1d4 y ataque adicional con acción adicional",
      "Comunión del dolor: ignora las penalizaciones de heridas leves y moderadas, y +1 al daño por cada herida abierta (máx. +3)",
      "Defensa sin armadura: CA 10 + DES + SAB",
    ],
    equipo: "Flagelo de penitente (1d4 cortante, sutil), cadenas, hábito raído, 10 dardos, 3 po",
  },
  {
    nombre: "Segador",
    base: "Brujo (pacto del filo)",
    dadoGolpe: 8,
    principal: "CAR",
    salvaciones: "SAB, CAR",
    rasgos: [
      "Pacto con el cadáver de un dios: puede invocar su arma de pacto (una guadaña) y usar CAR para atacar con ella",
      "Descarga sobrenatural (1d10 de fuerza) y 1 espacio de conjuro que se recupera en descanso corto",
      "El dios muerto susurra: el DM puede pedirle cosas en sueños",
    ],
    equipo: "Armadura de cuero, guadaña (como alabarda), foco (un hueso del dios), 2 dagas, 5 po",
  },
  {
    nombre: "Hechicero",
    base: "Mago",
    dadoGolpe: 6,
    principal: "INT",
    salvaciones: "INT, SAB",
    rasgos: [
      "Adepto en dos escuelas de magia a elegir (lanza hasta círculo 2 y suma su competencia a la tirada)",
      "Grimorio: conoce todos los hechizos de círculo 0 y 1 de sus escuelas; aprende más con maestros y grimorios",
      "Marcado: la Inquisición exige licencia a los magos; sin ella, es un hereje",
    ],
    equipo: "Daga, bastón, grimorio, 1 Piedra de brasa, ropa de viaje, 10 po",
  },
  {
    nombre: "Barbero-Cirujano",
    base: "Guerrero (variante sanadora)",
    dadoGolpe: 8,
    principal: "SAB y DES",
    salvaciones: "CON, SAB",
    rasgos: [
      "Pericia en Medicina (doble bonificador de competencia)",
      "Mano de cirujano: +2 a toda tirada de tratamiento; la falta de material solo le penaliza a la mitad",
      "Mano firme: una vez por descanso largo puede repetir una tirada de tratamiento fallida",
    ],
    equipo:
      "Herramientas de cirujano, kit de sanador (10 usos), sierra de huesos (1d6 cortante), 2 frascos de alcohol fuerte, cuero, ballesta ligera y 20 virotes, 7 po",
  },
];

export const NOMBRES_RAZAS = RAZAS.map((r) => r.nombre) as [string, ...string[]];
export const NOMBRES_CLASES = CLASES.map((c) => c.nombre) as [string, ...string[]];

export function raza(nombre: string): Raza | undefined {
  return RAZAS.find((r) => r.nombre === nombre);
}

export function clase(nombre: string): Clase | undefined {
  return CLASES.find((c) => c.nombre === nombre);
}

export const AMBIENTACION = `# Velmora, el Reino del Sol Herido

Hace noventa y nueve años, en la Noche del Eclipse Eterno —la Caída—, los dioses fueron asesinados. Nadie sabe quién lo hizo. Desde entonces el sol es un disco gris que alumbra como un crepúsculo perpetuo, las cosechas salen raquíticas y los muertos que no reciben el rito de sal y fuego a veces se levantan. Los cadáveres de los dioses cayeron sobre el mundo y aún hoy se excavan sus huesos, su sangre seca y sus reliquias, que se venden a precio de oro.

## Tono
Dark fantasy: violencia con peso, recursos escasos, moral gris, esperanza difícil pero posible. Las heridas importan, el frío y el hambre importan, y casi todo tiene un precio. Nada de humor de taberna fácil; sí humor negro de supervivientes.

## Regiones
- **Aldenmar, la Ciudad-Faro**: el último gran bastión, rodeado de murallas y hogueras que nunca se apagan. La gobierna el Consejo de Ceniza y la vigila la Inquisición. Barrios altos limpios, barrios bajos hacinados, fosas comunes fuera de la muralla.
- **Las Ciénagas de Hollín**: pantanos de aguas negras y nieblas tóxicas, aldeas medianas sobre pilotes, contrabandistas, fiebres y cosas que se arrastran.
- **Karak-Dûm, la Fortaleza Silente**: la ciudad enana bajo las montañas, sellada desde dentro hace treinta años. A veces se oyen golpes al otro lado de la puerta.
- **El Bosque de Velo Rojo**: árboles que sangran savia roja, elfos marchitos y criaturas que imitan las voces de los muertos queridos.
- **La Marca Hueca**: llanuras de antiguas batallas, castillos en ruinas y caminos de no-muertos. Ahí gobiernan en secreto los señores de la Corte Pálida.
- **Las Agujas de Vahl**: monasterios colgados de riscos donde los flagelantes buscan, a través del dolor, la voz de los dioses muertos.

## Facciones
- **La Inquisición de la Llama Gris**: purifican con fuego. Persiguen la brujería, a los varg y a los nacidos pálidos. Necesarios y temidos.
- **Las Hermanas de la Sutura**: orden de cirujanas y sanadoras. Sus enfermerías son las únicas fiables del reino; cobran caro, en dinero o en favores.
- **La Compañía del Cuervo Negro**: mercenarios que luchan por quien pague, sin preguntas sobre la raza ni el pasado.
- **La Corte Pálida**: nobleza vampírica que trata a las aldeas de la Marca como ganado… y, a su manera, las protege de cosas peores.
- **Los Devotos del Dios Hambriento**: un culto que cree que de la Podre nacerá un dios nuevo, y quiere ayudarlo a nacer.

## Amenazas
- **Los Hambrientos**: muertos alzados, lentos de uno en uno y terribles en manada. Su mordisco transmite la Podre.
- **La Podre**: una plaga que pudre la carne y luego la voluntad. Una herida con Podre no se limpia con medicina común ni con magia divina: hay que cortar, cauterizar o encontrar remedios raros.
- **La Ceniza**: la magia divina se alimenta de los restos de los dioses muertos. Cura, pero deja en quien la recibe una marca de Ceniza: vetas grises en la piel, frío en los huesos, sueños con dioses muertos. Con 3 de Ceniza aparecen marcas visibles; con 6, los no-muertos sienten al personaje como uno de los suyos y los animales le rehúyen; con 10, algo empieza a hablarle por las noches. La Ceniza solo se borra con ritos raros y peligrosos.

## Moneda y economía
Se paga en piezas de oro (po), aunque en la calle circulan más el pan, la sal, el aceite de lámpara y los dientes de dios. Un día de enfermería con las Hermanas cuesta 5 po; una cirugía mayor, 50 po o un favor.`;

export function textoRazasYClases(): string {
  const razas = RAZAS.map(
    (r) =>
      `- **${r.nombre}** (${r.atributos}). ${r.descripcion}\n  Rasgos: ${r.rasgos.join("; ")}.\n  Curación: ${r.notaCuracion}`,
  ).join("\n");
  const clases = CLASES.map(
    (c) =>
      `- **${c.nombre}** (base: ${c.base}; d${c.dadoGolpe}; principal: ${c.principal}; salvaciones: ${c.salvaciones}).\n  Rasgos de nivel 1: ${c.rasgos.join("; ")}.\n  Equipo inicial: ${c.equipo}.`,
  ).join("\n");
  return `## Razas jugables\n${razas}\n\n## Clases (el Hechicero es el único mago de verdad; el resto son combatientes, y solo los que nacen con el don o llegan a élite saben algo de magia)\n${clases}`;
}
