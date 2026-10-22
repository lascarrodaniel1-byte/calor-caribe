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
    rasgos: [
      "Estilo de combate (oficio de la Compañía): +1 a todo ataque con armas",
      "Segundo aliento (1 por descanso corto o largo): acción adicional; recupera 1d10 + nivel PV (no cierra heridas)",
      "Competencia con todas las armas, armaduras y escudos",
      "Rango en la Compañía: empieza de Polluelo (recluta) y asciende al subir de nivel: Cuervo (nv. 3), Garra (5), Corax (8), Ala Mayor (11: puede concursar por el puesto de mariscal, Hugin o Munin); cada rango trae ventajas y mando",
      "Pluma del Cuervo Negro: pertenece a la Compañía del Cuervo Negro y la lleva en el sombrero o el hombro. En cualquier cuartel, campamento o puesto de la Compañía (su cuartel general está en Aldenmar) tiene cama, comida y rumores de contratos; los demás mercenarios y desertores lo tratan como a uno de los suyos (ventaja en Persuasión e Intimidación con ellos)",
      "Código del Cuervo: la Compañía no pregunta por la raza ni por el pasado, y cobra a quien rompe un contrato o alza la mano contra otro cuervo; a cambio, de vez en cuando la Compañía reclama un servicio",
    ],
    equipo: "Cota de mallas, espada larga, escudo, ballesta ligera y 20 virotes, petate, 10 po",
  },
  {
    nombre: "Berserker de Ceniza",
    base: "Bárbaro",
    dadoGolpe: 12,
    principal: "FUE",
    salvaciones: "FUE, CON",
    rasgos: [
      "Furia del fuego viejo (acción adicional; 2 usos por descanso largo, 3 desde el nivel 3, 4 desde el 6): es un vestigio de la conexión con Æsir, el dios más antiguo. Cobra su precio: mientras dura, INT y CAR a la mitad y +2 al modificador de FUE (se suma al bono base). Dura 1 minuto: el pelo se vuelve del color de la ceniza, +2 al daño cuerpo a cuerpo, resistencia al daño contundente, cortante y perforante, y las penalizaciones de sus heridas no cuentan. Al terminar, salvación de CON CD 10 o una herida moderada sin tratar se agrava",
      "Trance (niveles 1-2): en furia entra en trance y no distingue aliados de enemigos; su golpe cae sobre quien tenga a su alcance. Desde el nivel 3 la furia se aclara. En el nivel 5 la furia cierra temporalmente las heridas rojas mientras dura (se reabren al terminar)",
      "Defensa sin armadura: CA 10 + DES + CON",
      "Elegido de Æsir: los Berserkers de Ceniza se eligen desde niños mediante un rito de elección y se les enseña a sobrevivir y a luchar. Se reconocen por la mecha gris que les nace en el pelo; con la furia, el pelo entero se vuelve cenizo",
      "Marcas de Ceniza (confirmado): herir a un compañero en trance deja marcas de Ceniza de verdad (las de la Ceniza del mundo: 3 visibles, 6 los no-muertos lo sienten suyo, 10 algo le habla) en la piel de la víctima y del propio Berserker",
      "Magia del Berserker: puede aprender magia de daño, refuerzo y, con nivel alto o afinidad, encantar sus armas para que regresen; de la elemental solo domina los rayos y el hielo básicos (hasta círculo 2)",
      "Fortaleza de Berserker (propuesto, pendiente de confirmar): lo que los hace especiales es su fiereza y su fortaleza física, y poco más. Gana +1 PV máximo por cada nivel y tiene ventaja en las salvaciones de CON",
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
      "Juramento a Ka'i (honor y fe): le da su poder mágico. Jura de 1 a 5 votos de Ka'i (Verdad, Amparo, Lealtad, Luz, Descanso, Merced); cuantos más, más fuerte su magia —y más grave romperlos, como una liga estirada—: de la debilidad a que su propio poder lo queme y pierda la magia para siempre. Sin juramento no tiene poder",
      "Sentido divino (CAR+1 usos por descanso largo): detecta no-muertos y corruptos a 18 m (36 m desde el nivel 4)",
      "Imposición de manos: reserva de PV de nivel × (3 + 2 × votos). Curar PV es libre y no deja Ceniza; cerrar una herida cuesta 5 PV de la reserva y cuenta como magia divina",
      "Luz contra la Podre (nivel 5): su magia divina puede expulsar la Podre de una herida (cuesta 10 PV de la reserva), cosa que ninguna otra magia consigue",
      "Ceniza menor: gracias al juramento, su magia deja una marca de Ceniza de cada cuatro usos",
    ],
    equipo: "Armadura de escamas, espada larga, escudo, símbolo de Ka'i (un sol de hierro), 5 jabalinas, 8 po",
  },
  {
    nombre: "Cazador de Brujas",
    base: "Explorador",
    dadoGolpe: 10,
    principal: "DES y SAB",
    salvaciones: "FUE, DES",
    rasgos: [
      "Origen: el oficio nació de un cuerpo paramilitar que creó la Inquisición; ella lo tolera y le da su beneplácito, pero no están afiliados. Se parece más a los mercenarios: es un arte que se transmite libremente de maestro a aprendiz y no existe una orden central",
      "Enemigo predilecto: no-muertos y brujas (las hechiceras de la magia negra, cazadas por eso) y hechiceros que la practican (ventaja para rastrearlos y recordar saber sobre ellos)",
      "Explorador nato: no se pierde en un tipo de terreno elegido",
      "Filos de sal y plata: sus shotels van ribeteados de plata y los frota con sal; ignoran la resistencia de los no-muertos",
      "Papeles de runas (papeles): hojas llenas de escritura y runas que no se usan sobre el rival sino alrededor de la zona de la pelea, sobre todo en espacios cerrados, clavadas con estacas. Apagan la regeneración y quitan CD a los poderes de brujas, hechiceros y no-muertos; cuanto más nivel, más fuertes son los seres que mitigan. A nivel alto (8+) curan: cada asalto cierran una herida leve y cada tres bajan una moderada un nivel. Solo hay dos maneras de usarlos directamente sobre un rival: clavándole un papel con una estaca, o, a distancia, con su sangre (la toma al herirlo y la quema con una hoja)",
      "Mascota (mascota): un halcón o un ratón, a elección del jugador",
      "Rastro de la magia (rastro_magico): detecta hechizos y maldiciones y «amarra» un hechizo de magia negra a quien lo lanzó para rastrearlo con solo tener a la víctima o al objeto; cuanto más nivel, más sabe",
      "Carácter del oficio: meticulosos y algo supersticiosos, escriben cada noche en su cuaderno de runas (heredado de su maestro, al que añaden las suyas) y no cazan sin conocer a su presa. Son mercenarios con un código: «primero se rastrea, luego se juzga»; no queman a nadie sin pruebas, distinguen la magia de su abuso y desconfían igual de los magos libres que de la Inquisición que los tolera. Hablan poco, con humor seco, y cobran por contrato (aldeas, gremios, nobles)",
    ],
    equipo: "Cuero tachonado, látigo de metal, dos shotels, 5 frascos de sal, estacas (para clavar los papeles), 10 hojas de runas, 6 po (los más veteranos del oficio lucen un urumi)",
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
- **Las brujas** son las hechiceras de la magia negra y las cazan por eso, sobre todo los Cazadores de Brujas.
- **Los Caballeros Juramentados** juran ante Ka'i, el dios del sol (muerto): honor y fe. Su poder viene del juramento y se rompe si violan un voto.
- **Æsir** (secreto del DM): el dios más antiguo. Su fuego sobrevive como vestigio en los Berserkers de Ceniza, elegidos desde niños, que lo invocan en su furia.
- **La Compañía del Cuervo Negro**: mercenarios que luchan por quien pague, sin preguntas sobre la raza ni el pasado. Funciona como una organización, con rangos (Polluelo, Cuervo, Garra, Corax, Ala Mayor) y cuarteles en varios lugares, todos de la misma Compañía; su cuartel general está en Aldenmar. La dirigen dos mariscales, **Hugin y Munin**, juntos. Su puesto solo se ocupa por renuncia o muerte del mariscal, pero ambos están obligados a ceder el cargo mediante un **concurso de méritos** que se celebra cada 4 años, alternando: un concurso para el puesto de Hugin, cuatro años después para el de Munin, y así (cada puesto se disputa cada 8 años). Concursa cualquier Ala Mayor; el mérito se mide por las hazañas, el clamor de la tropa (votos), la fuerza en combate (un combate de prueba) y la decisión de los mariscales. Si los aspirantes no están a la altura, Hugin o Munin siguen o eligen a quien consideren capaz; si un mariscal se niega a ceder, el otro debe deponerlo ahí mismo por la fuerza.
- **La Corte Pálida**: nobleza vampírica que trata a las aldeas de la Marca como ganado… y, a su manera, las protege de cosas peores. (Secreto del DM: la unificó Dracone, el «Primus Imperatus», el primer regente pálido; hoy los pálidos forman parte de la orden de su hija, Ysolde, que lo mató con su propia mano, tras una fiera pelea y absorbiendo su esencia vital, en un golpe de estado después de la Caída: lo veía poco ambicioso y contrario a una idea imperialista que Dracone rechazaba por ética (su raza era demasiado civilizada y podía desatar barbarie). Ysolde quiere someter primero la Marca Hueca y después Velmora, con Aldenmar como premio.)
- **Los Devotos del Dios Hambriento**: un culto que cree que de la Podre nacerá un dios nuevo, y quiere ayudarlo a nacer.

## Amenazas
- **Los Hambrientos**: muertos alzados, lentos de uno en uno y terribles en manada. Su mordisco transmite la Podre.
- **La Maldición del Lobo** (secreto del DM; los PNJ solo conocen rumores): en la época de los dioses, Vaskar, un hombre traicionero que practicaba magia negra, quiso robar la esencia de Kashi, el dios de la luna, a través de uno de sus hijos (un lobo que cazó) para alargar su vida. Kashi, que lo sabía todo, lo maldijo mientras dormía bajo la luna y lo volvió lobo para la eternidad. De esa maldición nacen los Varg. Hoy vaga por el Bosque de Velo Rojo buscando un objeto del verdadero poder de Kashi que rompa su maldición; los objetos que se rumorean en el bosque son todos señuelos. La única reliquia real de Kashi es su Falange (no tiene poder para romper nada, tampoco su maldición; Vaskar solo cree que lo libera) (la falange del dedo anular del dios, símbolo de su unión con los seres de la luna): da bonus contra los Varg y teletransporta, en luna llena, a cualquier lugar al que llegue la luz de la luna; solo la usa un humano y solo bajo la luna llena (noche en la que Vaskar no puede salir), y sus sentidos malditos no pueden detectarla; quizá ni siquiera esté ya en el Velo Rojo.
- **El Juez Sin Ojos** (secreto del DM): hijo de Ka'i, el dios del sol, y de una humana. Los dioses le dieron la habilidad de ver la naturaleza divina y maldita de cada cosa y lo hicieron guardián de sus creaciones y de todo lo divino. Fue el primer Inquisidor y aún juzga. Se arrancó los ojos al quedar atrapado cuando fue a socorrer a su padre (ante la inminente muerte de Ka'i; Ka'i le recordó su misión y le pidió no flaquear ante el mal), pero conserva su don; vive en la catedral hundida bajo Aldenmar porque fue el último lugar donde habló con él, y allí solo guarda sus cosas, su botín y los recuerdos de su padre (entre ellos, un rayo de luz solar primigenia). Su enemigo es el primer Inquisidor (el Juez Sin Ojos), por su magia negra y la ofensa a los dioses; el Juez llegó tarde a juzgarlo y Kashi le retiró su favor por eso. Ficha completa: criatura «Vaskar».
- **La Podre**: una plaga que pudre la carne y luego la voluntad. No toda mordedura la contagia (los fuertes la resisten), pero una herida con Podre no se cura sola ni con magia divina: hay que cortar la carne podrida, cauterizar o encontrar remedios raros.
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
