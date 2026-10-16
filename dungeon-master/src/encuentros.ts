// Encuentros aleatorios con variedad. El DM (el modelo) no tiene azar propio: si nadie se lo impone, tiende a repetir
// los enemigos que más pesan en la ambientación (Hambrientos, la Inquisición). Aquí vive una tabla de encuentros que
// tira el programa (según región, hora, nivel y dificultad) y una memoria de los últimos enemigos que penaliza repetirse.
import { tirar } from "./dados.js";
import { buscarCriatura } from "./bestiario.js";
import type { Partida } from "./estado.js";

export type TipoEncuentro = "combate" | "peligro" | "social" | "hallazgo";

export interface Plantilla {
  id: string;
  nombre: string;
  /** Para no repetir: no-muertos, fauna, humanos, inquisicion, culto, corte_palida, monstruos, entorno, social… */
  familia: string;
  tipo: TipoEncuentro;
  /** Trozos del nombre de la región donde encaja (vacío = en cualquier parte). */
  regiones: string[];
  /** 1 (peligro común) a 5. */
  peligro: 1 | 2 | 3 | 4;
  cuantos: [number, number];
  momento?: "noche" | "dia";
  peso: number;
  /** Plantilla del bestiario (aparecer_criatura). Si no hay, se improvisa con pnj/iniciativa. */
  bestiario?: string;
  quienes: string;
  quieren: string;
  salida: string;
  /** Para encuentros sin bestiario: bonificador de ataque, CA y PV orientativos de cada uno. */
  stats?: string;
}

export const TABLA: Plantilla[] = [
  // ---- no-muertos
  { id: "hambrientos", nombre: "Manada de Hambrientos", familia: "no-muertos", tipo: "combate", regiones: ["Marca Hueca", "Aldenmar", "Ciénagas"], peligro: 1, cuantos: [3, 6], peso: 7, bestiario: "Hambriento", quienes: "Muertos alzados sin rito, atraídos por el olor a carne viva.", quieren: "Comer. No negocian ni huyen.", salida: "El fuego y las sombras los frenan; se puede rodearlos o dejarlos atrás en una fuente de luz." },
  { id: "ghul", nombre: "Ghul de las fosas", familia: "no-muertos", tipo: "combate", regiones: ["Aldenmar", "Marca Hueca"], peligro: 2, cuantos: [1, 2], momento: "noche", peso: 4, bestiario: "Ghul de las fosas", quienes: "Devoradores de cadáveres que merodean cementerios y osarios.", quieren: "Carroña fresca; atacan a quien huela a sangre.", salida: "Prefieren cadáveres a vivos: un cebo los distrae." },
  { id: "banshee", nombre: "Banshee del Velo", familia: "no-muertos", tipo: "peligro", regiones: ["Velo Rojo"], peligro: 3, cuantos: [1, 1], momento: "noche", peso: 2, bestiario: "Banshee del Velo", quienes: "Un espectro que llora entre los árboles rojos y atrae a los viajeros.", quieren: "Que alguien oiga su historia antes de matarlo.", salida: "Escucharla y prometerle un rito la aplaca." },
  { id: "huesos", nombre: "Esqueletos de un campo de batalla", familia: "no-muertos", tipo: "combate", regiones: ["Marca Hueca"], peligro: 2, cuantos: [3, 5], peso: 3, quienes: "Soldados sin carne que repiten su última orden.", quieren: "Cumplir una orden de hace un siglo (defender un cruce, guardar un puente).", salida: "Si se entiende la orden, se les puede dar otra o pasar sin cruzar su línea.", stats: "ataque +3, CA 13, 13 PV, lanzas y escudos astillados" },
  // ---- fauna y monstruos
  { id: "lobos", nombre: "Jauría de lobos de ceniza", familia: "fauna", tipo: "combate", regiones: ["Velo Rojo", "Marca Hueca", "Aldenmar"], peligro: 1, cuantos: [3, 5], peso: 7, bestiario: "Lobo de Ceniza", quienes: "Lobos flacos de pelaje gris, hambrientos por el invierno largo.", quieren: "Comida; un animal herido o una presa fácil.", salida: "Fuego, carne que lanzar y no correr: prefieren la presa que huye." },
  { id: "ogro", nombre: "Ogro al servicio de un señor de la guerra", familia: "monstruos", tipo: "combate", regiones: ["Marca Hueca", "Aldenmar"], peligro: 2, cuantos: [1, 1], peso: 3, bestiario: "Ogro", quienes: "Un ogro cobrador que vigila un paso o cobra un peaje en carne.", quieren: "Comida y órdenes; es tozudo, no listo.", salida: "Se le puede engañar, sobornar con comida o desviar su atención." },
  { id: "troll", nombre: "Troll de ciénaga", familia: "monstruos", tipo: "combate", regiones: ["Ciénagas"], peligro: 3, cuantos: [1, 1], peso: 4, bestiario: "Troll de ciénaga", quienes: "Una masa de brazos largos y cieno que acecha bajo el agua negra.", quieren: "Carne y territorio.", salida: "El fuego lo daña de verdad; las barcas y los senderos firmes le quitan ventaja." },
  { id: "wyverno", nombre: "Wyverno cazando", familia: "monstruos", tipo: "combate", regiones: ["Agujas", "Marca Hueca"], peligro: 3, cuantos: [1, 1], momento: "dia", peso: 2, bestiario: "Wyverno", quienes: "Un wyverno que baja en picado a por la presa más aislada.", quieren: "Un solo cuerpo que llevarse al nido.", salida: "Cubierto y en grupo, pierde interés." },
  { id: "basilisco", nombre: "Basilisco en las ruinas", familia: "monstruos", tipo: "peligro", regiones: ["Karak", "Marca Hueca"], peligro: 3, cuantos: [1, 1], peso: 2, bestiario: "Basilisco", quienes: "Estatuas de viajeros en un patio: algo de ojos fríos las hizo.", quieren: "Que nadie turbe su nido.", salida: "Espejos, mirar de reojo, rodear por arriba." },
  { id: "manticora", nombre: "Mantícora en los páramos", familia: "monstruos", tipo: "combate", regiones: ["Marca Hueca"], peligro: 3, cuantos: [1, 1], peso: 2, bestiario: "Mantícora", quienes: "Una bestia de rostro casi humano que juega con la comida.", quieren: "Presa y conversación cruel.", salida: "Le gustan los acertijos: hablar puede ganar tiempo." },
  // ---- humanos
  { id: "bandoleros", nombre: "Bandoleros del camino", familia: "humanos", tipo: "combate", regiones: [], peligro: 1, cuantos: [3, 6], peso: 8, quienes: "Salteadores desesperados: campesinos arruinados y desertores con garrotes y ballestas viejas.", quieren: "Bolsas, armas y caballos; no quieren morir por unas monedas.", salida: "Se rinden o huyen si su cabecilla cae; se les puede pagar un peaje o convencerlos.", stats: "ataque +3, CA 12, 9 PV, garrote o ballesta" },
  { id: "desertores", nombre: "Desertores de la Compañía del Cuervo", familia: "humanos", tipo: "social", regiones: ["Aldenmar", "Marca Hueca"], peligro: 2, cuantos: [2, 4], peso: 4, quienes: "Mercenarios que huyen de una paga que no llegó (o de algo que vieron en la muralla).", quieren: "Pasar desapercibidos y comer; saben cosas que el Cuervo oculta.", salida: "Se les puede comprar información, ayudar, delatar o enfrentar.", stats: "ataque +4, CA 14, 16 PV, veteranos" },
  { id: "cazarrecompensas", nombre: "Cazarrecompensas tras uno de los PJ", familia: "humanos", tipo: "combate", regiones: [], peligro: 2, cuantos: [2, 3], peso: 3, quienes: "Profesionales con cartel de recompensa y red de captura: quieren al vivo.", quieren: "Cobrar por alguien del grupo (o por un PNJ que viaja con él).", salida: "Se puede negociar, pagarles más o convencerlos de que el cartel miente.", stats: "ataque +4, CA 14, 18 PV, redes y porras" },
  { id: "contrabandistas", nombre: "Contrabandistas de Hollín", familia: "humanos", tipo: "social", regiones: ["Ciénagas", "Aldenmar"], peligro: 1, cuantos: [2, 4], peso: 4, quienes: "Barqueros con un cargamento que no debe ver la Inquisición.", quieren: "Que nadie hable; buscan quien les cubra o a quien silenciar.", salida: "Trato, soborno, chantaje o un trabajo a cambio de silencio.", stats: "ataque +3, CA 12, 11 PV, dagas y ballestas ligeras" },
  { id: "saqueadores", nombre: "Saqueadores de ruinas", familia: "humanos", tipo: "combate", regiones: ["Karak", "Marca Hueca", "Agujas"], peligro: 2, cuantos: [3, 5], peso: 3, quienes: "Buscadores de reliquias que ya cavaron demasiado hondo.", quieren: "Quedarse con lo que encuentren (y con lo que lleve el grupo).", salida: "Pueden aliarse contra algo peor, o repartirse el botín.", stats: "ataque +3, CA 13, 12 PV, picos y hachas" },
  { id: "resurreccionistas", nombre: "Ladrones de cadáveres", familia: "humanos", tipo: "social", regiones: ["Aldenmar"], peligro: 1, cuantos: [2, 3], momento: "noche", peso: 3, quienes: "Gente de las Hermanas de la Sutura sin licencia, que vende cuerpos frescos a cirujanos.", quieren: "No ser vistos: un cadáver fresco vale más que una bolsa.", salida: "Tratar con ellos, delatarlos a la Inquisición o seguirlos hasta su comprador.", stats: "ataque +2, CA 11, 8 PV, palas y cuchillos" },
  // ---- inquisición, culto, corte
  { id: "inquisicion", nombre: "Patrulla de la Llama Gris", familia: "inquisicion", tipo: "social", regiones: ["Aldenmar"], peligro: 2, cuantos: [3, 5], peso: 2, quienes: "Purificadores con antorchas y escritos de licencia: buscan brujas, varg y nacidos pálidos.", quieren: "Comprobar licencias y encontrar un culpable.", salida: "Papeles en regla, un soborno, un chivo expiatorio o una buena mentira; la violencia llama a más." , stats: "ataque +4, CA 15, 20 PV, espadas y antorchas" },
  { id: "devotos", nombre: "Devotos del Dios Hambriento", familia: "culto", tipo: "combate", regiones: ["Ciénagas", "Marca Hueca", "Aldenmar"], peligro: 2, cuantos: [3, 5], momento: "noche", peso: 3, quienes: "Fanáticos con cuchillos de hueso que alimentan fosas para que nazca su dios.", quieren: "Sangre para una fosa; o un converso.", salida: "Se les puede infiltrar, engañar o dejar que se destruyan entre ellos.", stats: "ataque +3, CA 11, 11 PV, cuchillos de hueso y fe ciega" },
  { id: "corte", nombre: "Esbirros de la Corte Pálida", familia: "corte_palida", tipo: "combate", regiones: ["Marca Hueca", "Velo Rojo"], peligro: 3, cuantos: [2, 3], momento: "noche", peso: 2, quienes: "Sirvientes pálidos de una vampira: elegantes, rápidos y pacientes.", quieren: "Un mensaje que entregar, una invitación o una cena.", salida: "Hablan: se les puede escuchar, rechazar con cortesía o tenderles una trampa de luz.", stats: "ataque +5, CA 14, 22 PV, estoques y mirada hipnótica" },
  // ---- entorno, sociales y hallazgos
  { id: "niebla", nombre: "Niebla de ceniza", familia: "entorno", tipo: "peligro", regiones: [], peligro: 1, cuantos: [1, 1], peso: 4, quienes: "Una nube gris que cubre el camino y quema la garganta.", quieren: "(Es el entorno) pierde a quien se separa y esconde lo que acecha dentro.", salida: "Cuerdas, trapos mojados y no separarse; o esperar a que pase." },
  { id: "pantano", nombre: "Pantano hundiente", familia: "entorno", tipo: "peligro", regiones: ["Ciénagas"], peligro: 1, cuantos: [1, 1], peso: 4, quienes: "El sendero firme desaparece: el cieno traga botas, mochilas y mulas.", quieren: "(Es el entorno) cuesta tiempo y equipo.", salida: "Sondear con varas, ligar cuerdas, un guía local." },
  { id: "derrumbe", nombre: "Derrumbe o puente roto", familia: "entorno", tipo: "peligro", regiones: ["Karak", "Agujas"], peligro: 1, cuantos: [1, 1], peso: 3, quienes: "Un paso cortado por piedra suelta o un puente podrido.", quieren: "(Es el entorno) obliga a rodear o a arriesgar.", salida: "Cuerdas, un rodeo largo o ayuda ajena." },
  { id: "mensajero", nombre: "Mensajero herido", familia: "social", tipo: "social", regiones: [], peligro: 1, cuantos: [1, 1], peso: 4, quienes: "Alguien herido que huye con un mensaje que no debería llegar a su destino… ni a otro.", quieren: "Entregarlo vivo; teme a quienes lo persiguen.", salida: "Curarlo, escoltarlo o abrir el mensaje: tres caminos distintos." },
  { id: "peregrinos", nombre: "Peregrinos de camino", familia: "social", tipo: "social", regiones: [], peligro: 1, cuantos: [3, 8], momento: "dia", peso: 3, quienes: "Gente cansada hacia un santuario sin dios: llevan noticias, rumores y quizá algo escondido.", quieren: "Compañía y protección; alguno miente sobre quién es.", salida: "Compartir fuego, intercambiar noticias, descubrir al impostor." },
  { id: "mercader", nombre: "Mercader de lo imposible", familia: "social", tipo: "hallazgo", regiones: [], peligro: 1, cuantos: [1, 1], peso: 3, quienes: "Un vendedor ambulante con carro de reliquias dudosas (algunas, de verdad).", quieren: "Vender caro y comprar secretos.", salida: "Regatear, robarle, comprarle un objeto con historia." },
  { id: "campamento", nombre: "Campamento abandonado", familia: "hallazgo", tipo: "hallazgo", regiones: [], peligro: 1, cuantos: [1, 1], peso: 3, quienes: "Un campamento con brasas todavía calientes y nadie a la vista.", quieren: "(Es una escena) cuenta qué pasó con huellas y objetos; puede haber una trampa o un superviviente.", salida: "Investigar con calma revela más que fuerza." },
];

/** Palabras que delatan la familia de un enemigo a partir de su nombre. */
const FAMILIAS: [RegExp, string][] = [
  [/hambrient|ghul|zombi|esquelet|no-?muert|banshee|espectro|cad[aá]ver|gigante de hueso|madre de los hambrientos/i, "no-muertos"],
  [/inquisi|llama gris|purificador/i, "inquisicion"],
  [/lobo|jaur[ií]a|bestia|wyverno|mant[ií]cora|basilisco|troll|ogro|drag[oó]n/i, "monstruos"],
  [/cultist|devoto|dios hambriento/i, "culto"],
  [/vampir|corte p[aá]lida|reina p[aá]lida|esbirro/i, "corte_palida"],
  [/bandol|salteador|bandid|desertor|mercenari|cazarrecompensas|contraband|saqueador|ladr[oó]n/i, "humanos"],
];

export function familiaDe(nombre: string): string {
  for (const [re, f] of FAMILIAS) if (re.test(nombre)) return f;
  return nombre.toLowerCase().replace(/\s*\d+$/, "").trim();
}

/** El bonus especial de cada región: qué familias de enemigos pesan más allí y cuánto se acerca un jefe. */
export interface BonusRegion {
  /** Multiplicadores por familia (1 = sin bonus). */
  familias: Record<string, number>;
  /** Probabilidad extra (puntos porcentuales) de que el encuentro tenga que ver con un jefe fuera de su zona. */
  jefe: number;
  nota: string;
}
export const BONUS_REGION: Record<string, BonusRegion> = {
  Aldenmar: { familias: { humanos: 1.8, inquisicion: 1.5, culto: 1.3, social: 1.4 }, jefe: 2, nota: "ciudad de intrigas: abundan los humanos con intereses (bandas, desertores, cazarrecompensas), la Llama Gris y los cultos subterráneos" },
  "Ciénagas": { familias: { monstruos: 2, entorno: 1.6, culto: 1.4, humanos: 1.2 }, jefe: 3, nota: "cieno y fosas: trolls y monstruos de pantano, peligros del terreno y devotos que alimentan la fosa sin fondo" },
  Karak: { familias: { monstruos: 1.8, entorno: 1.7, humanos: 1.3 }, jefe: 3, nota: "ruinas enanas selladas: monstruos de cueva, derrumbes y saqueadores atraídos por lo que duerme abajo" },
  "Velo Rojo": { familias: { fauna: 2.2, "no-muertos": 1.4, corte_palida: 1.6, social: 0.8 }, jefe: 4, nota: "bosque de voces: jaurías y bestias, espectros y los emisarios pálidos de la Corte" },
  "Marca Hueca": { familias: { "no-muertos": 2, monstruos: 1.5, corte_palida: 1.5, humanos: 1.1 }, jefe: 5, nota: "campo de batalla de un siglo: muertos alzados, monstruos del páramo y la sombra de la Corte Pálida" },
  Agujas: { familias: { monstruos: 2, entorno: 1.6, culto: 1.2 }, jefe: 3, nota: "cumbres y monasterios: wyvernos y dragones, pasos peligrosos y flagelantes fanáticos" },
};

export function bonusDe(region: string): { clave: string; bonus: BonusRegion } | null {
  const k = Object.keys(BONUS_REGION).find((x) => region.toLowerCase().includes(x.toLowerCase()));
  return k ? { clave: k, bonus: BONUS_REGION[k] } : null;
}

/** Jefes que pueden aparecer fuera de su zona, con el plan que los trae y las razones posibles. */
interface JefeFuera {
  /** Nombre (o parte) en el bestiario. */
  bestiario: string;
  corto: string;
  /** Dónde suele estar (trozos de nombre de región). */
  zona: string[];
  /** Nivel medio a partir del cual puede dar la cara en persona; por debajo, solo sus señales. */
  minNivel: number;
  plan: string;
  razones: string[];
  senales: string;
  /** Con quién está enfrentado (si el otro está activo cerca, chocan). */
  enemigo?: string;
}
export const JEFES_FUERA: JefeFuera[] = [
  { bestiario: "Kuru", corto: "Kuru", zona: [], minNivel: 4, plan: "Cazar la próxima leyenda: sigue el rastro de quien porte reliquias, Ceniza o un destino marcado (quizá alguien del grupo).", razones: ["Sigue a un objetivo del grupo o a un PNJ que viaja con él", "Un contrato: alguien ha pagado por la cabeza de una criatura legendaria que el grupo está a punto de encontrar", "Persigue a otro jefe y el grupo está en su camino"], senales: "Una pieza cazada con una limpieza que ninguna banda tiene, un campamento sin huellas, un cadáver legendario desollado con oficio, preguntas sobre «quién lleva algo antiguo»" },
  { bestiario: "Vaerth", corto: "Vaerth", zona: ["Aldenmar"], minNivel: 4, plan: "Reunir rostros y esencias hasta tener los de alguien que importe: busca a quien lleve un apellido, un cargo o un talento valioso.", razones: ["Ha robado la cara de un PNJ que el grupo conoce y la lleva por el camino", "Sigue a una víctima que huyó de Aldenmar", "Sustituye a un contacto del grupo para llegar a un tesoro"], senales: "Un conocido que actúa raro, que olvida algo que sabía o que sabe algo que no debería; mercaderes con la misma voz en dos sitios" },
  { bestiario: "Ilvara", corto: "Ilvara", zona: ["Agujas"], minNivel: 4, plan: "Cumplir una profecía de muerte que ya escribió: va tejiendo el mañana de unos pocos hacia un lugar concreto.", razones: ["Un encargo de la misión es en realidad una profecía suya que necesita que se cumpla", "Ha enviado a un emisario ciego a recoger algo del camino del grupo", "Un hilo de su telar ha cruzado a uno de los personajes"], senales: "Una profecía de muerte escrita en una pared o anunciada por un desconocido; hilos de plata en las puertas; un PNJ que «ya sabía» lo que pasaría" },
  { bestiario: "Vaskar", corto: "Vaskar", zona: ["Velo Rojo"], minNivel: 5, plan: "Romper su maldición y volver a ser humano (cree que la Falange de Kashi lo conseguirá, y se equivoca: la Falange no tiene poder para romper nada): llama a los Varg, que son de su sangre, y rastrea el Colmillo del Eclipse (el diente del hijo de la luna) o cualquier rito que prometa liberarlo. Sigue siendo el traidor de siempre: engaña y usa a quien le sirva.", razones: ["Un Varg del grupo (o su contacto) ha sido llamado por su sangre", "Busca la Falange de Kashi (la única reliquia de Kashi; puede estar fuera del Velo Rojo); sus sentidos malditos no la detectan y solo un humano puede usarla (en luna llena, noche en que él no puede salir), así que necesita manos humanas ajenas: puede engañar, chantajear o reclutar al grupo para que la encuentre", "Persigue el Colmillo del Eclipse o un grimorio de magia negra que cree que lo libera", "Huye o ataca a la Inquisición del Juez, su enemigo, y la misión se cruza", "La misión lleva el olor de su manada"], senales: "Aullidos que ningún lobo da, huellas de un tamaño imposible, Varg que se transforman sin querer, dientes de lobo con signos de magia negra", enemigo: "El Juez Sin Ojos (el primer Inquisidor): su enemigo desde la época de los dioses por su magia negra y la ofensa a los dioses; llegó tarde a juzgarlo y Kashi le retiró el favor. Si el Juez o la Llama Gris están activos cerca, chocan." },
  { bestiario: "Juez Sin Ojos", corto: "El Juez", zona: ["Aldenmar"], minNivel: 5, enemigo: "Vaskar, el Lobo del Eclipse: su enemigo desde la época de los dioses (magia negra, ofensa a los dioses); llegó tarde a juzgarlo y Kashi le retiró su favor; quemar a los Varg es parte de esa guerra.", plan: "Dictar su sentencia sobre un culpable que ya eligió y custodiar lo divino: ve la naturaleza divina y maldita de todo, persigue reliquias de los dioses, magia negra y maldiciones, y no olvida la sentencia pendiente contra Vaskar y los Varg.", razones: ["Un PNJ del grupo es su culpable y viaja con ellos", "La misión transporta algo que él considera un pecado", "Ha detectado una reliquia divina o una maldición que el grupo lleva (puede ser la Falange de Kashi o la marca de un Varg)", "Sigue a un fugitivo que juró no ser juzgado"], senales: "Sentencias clavadas en puertas, confesiones forzadas que llegan por rumores, acólitos de la Llama Gris con vendas en los ojos" },
  { bestiario: "Ysolde", corto: "Ysolde", zona: ["Marca Hueca"], minNivel: 5, plan: "Extender su imperio pálido (la idea imperialista por la que mató a su padre, Dracone): someter primero la Marca Hueca entera y después Velmora, con Aldenmar como premio; busca sangre noble, un heredero, aliados o a quien pueda convertir en servidor, y a los «Fieles del Primus», leales a su padre.", razones: ["Un invitado de su corte ha sido «invitado» fuera de su zona", "La misión toca una promesa que ella hizo hace siglos", "Quiere el cuerpo de alguien que el grupo protege"], senales: "Invitaciones sin remitente, esbirros muy corteses, animales que se acercan en silencio, un banquete preparado para el grupo" },
  { bestiario: "Madre de los Hambrientos", corto: "La Madre de los Hambrientos", zona: ["Ciénagas"], minNivel: 5, plan: "Parir una nueva marea: sus Hambrientos buscan carne y llevan un olor hacia algo que ella desea.", razones: ["Sus crías se desbordan por un camino nuevo porque algo se ha roto en la fosa", "Un culto la está moviendo (o alimentando) hacia otra fosa"], senales: "Manadas de Hambrientos que llegan juntos y de una sola dirección, olor a carne licuada, fosas que se hunden" },
];

export interface RegistroEncuentro {
  familia: string;
  nombre: string;
  /** Paso de la secuencia en el que ocurrió (para no contar dos veces el mismo). */
  paso: number;
}
const MAX_HISTORIAL = 12;

/** Anota un enemigo nuevo en la memoria de encuentros; devuelve false si es el mismo encuentro que el último. */
export function registrarEnemigo(partida: Partida, nombre: string): boolean {
  const h = (partida.encuentros ??= []);
  const familia = familiaDe(nombre);
  const paso = partida.secuencia?.total ?? 0;
  const ultimo = h[h.length - 1];
  // Mientras dure el combate (o en el mismo turno) los refuerzos de la misma familia son el mismo encuentro.
  if (ultimo && ultimo.familia === familia && (ultimo.paso === paso || partida.combate)) return false;
  h.push({ familia, nombre, paso });
  if (h.length > MAX_HISTORIAL) h.splice(0, h.length - MAX_HISTORIAL);
  return true;
}

/** ¿Los dos últimos encuentros fueron de esta familia? */
export function repetida(partida: Partida, nombre: string): string | null {
  const h = partida.encuentros ?? [];
  const f = familiaDe(nombre);
  const paso = partida.secuencia?.total ?? 0;
  const ultimo = h[h.length - 1];
  if (ultimo && ultimo.familia === f && (ultimo.paso === paso || partida.combate)) return null; // sigue siendo el mismo encuentro
  const dos = h.slice(-2);
  return dos.length === 2 && dos.every((x) => x.familia === f) ? f : null;
}

export function textoVariedad(partida: Partida): string {
  const h = partida.encuentros ?? [];
  const region = partida.mapa.lugares[partida.mapa.posicion ?? ""]?.region ?? "";
  const b = bonusDe(region);
  const linea = b ? `Bonus de la región (${b.clave}): ${b.bonus.nota}. Pesan más ahí: ${Object.entries(b.bonus.familias).filter(([, m]) => m > 1).map(([f]) => f).join(", ")}.\n` : "";
  if (!h.length) return linea ? `## Variedad de enemigos\n${linea.trimEnd()}` : "";
  const fam = h.slice(-5).map((x) => x.familia);
  const cuenta = new Map<string, number>();
  for (const f of fam) cuenta.set(f, (cuenta.get(f) ?? 0) + 1);
  const [top, n] = [...cuenta.entries()].sort((a, b) => b[1] - a[1])[0];
  return (
    `## Variedad de enemigos (últimos encuentros: ${h.slice(-6).map((x) => x.nombre).join(" → ")})\n${linea}` +
    (n >= 3 || (fam.length >= 3 && n / fam.length > 0.5)
      ? `⚠ ${n} de los últimos ${fam.length} encuentros fueron de «${top}»: el próximo, de otra familia (usa la herramienta encuentro).`
      : "Bien repartidos: sigue variando (humanos, fauna, culto, entorno, social…), no todo es un combate.")
  );
}

export interface DatosEncuentro {
  /** "azar" o el nombre de un jefe: fuerza que el encuentro sea un jefe fuera de su zona. */
  jefe?: string;
  /** Impide que salga un jefe aunque toque. */
  sin_jefe?: boolean;
  /** La misión en curso: si sale un jefe, se explica cómo su plan la provocó. */
  mision?: string;
  tipo?: TipoEncuentro;
  dificultad?: "facil" | "media" | "dificil" | "mortal";
  /** Fuerza la región (por defecto, donde está el grupo). */
  region?: string;
  /** Familias que no pueden salir (además de las repetidas). */
  excluir?: string[];
}

const horaDe = (p: Partida) => (p.reloj ? Math.floor((p.reloj.segundos % 86400) / 3600) : null);

/** Un jefe fuera de su zona: casi siempre sus señales o un emisario, rara vez en persona, y siempre con su plan detrás. */
function encuentroDeJefe(partida: Partida, d: DatosEncuentro, region: string, nivel: number, motivo: string): string | null {
  const h = partida.encuentros ?? [];
  const recientes = new Set(h.slice(-10).filter((x) => x.familia === "jefe").map((x) => x.nombre));
  const quiere = (d.jefe ?? "azar").toLowerCase();
  let candidatos = JEFES_FUERA.filter((j) => !recientes.has(j.corto));
  if (quiere !== "azar") candidatos = JEFES_FUERA.filter((j) => j.corto.toLowerCase().includes(quiere) || j.bestiario.toLowerCase().includes(quiere));
  else candidatos = candidatos.filter((j) => !j.zona.some((z) => region.toLowerCase().includes(z.toLowerCase()))); // fuera de su zona
  if (!candidatos.length) return null;
  const j = candidatos[tirar(`1d${candidatos.length < 2 ? 2 : candidatos.length}`).total - 1] ?? candidatos[0];
  const tirada = tirar("1d100").total;
  const regente = buscarCriatura(j.bestiario)?.regente;
  // Los regentes delegan: casi nunca dan la cara y casi siempre actúan a través de sus subordinados.
  const enPersona = nivel >= j.minNivel && tirada <= (regente ? 8 : 15);
  const emisario = !enPersona && tirada <= (regente ? 75 : nivel >= j.minNivel ? 55 : 45);
  const servidor = regente ? regente.servidores[tirar(`1d${Math.max(2, regente.servidores.length)}`).total - 1] ?? regente.servidores[0] : null;
  const usoServidor = servidor ? `${servidor.nombre} (${servidor.cuantos})${servidor.plantilla ? `, plantilla «${servidor.plantilla}»` : ""}: ${servidor.nota}` : "";
  const modo = enPersona ? "EN PERSONA" : emisario ? "EMISARIO" : "INDICIOS";
  partida.encuentros ??= [];
  partida.encuentros.push({ familia: "jefe", nombre: j.corto, paso: partida.secuencia?.total ?? 0 });
  if (partida.encuentros.length > MAX_HISTORIAL) partida.encuentros.splice(0, partida.encuentros.length - MAX_HISTORIAL);
  const razones = j.razones.map((r) => `   · ${r}`).join("\n");
  return [
    `🎲 ENCUENTRO — JEFE FUERA DE SU ZONA (${motivo}; d100 = ${tirada}; ${region || "región sin fijar"}, nivel medio ${nivel})`,
    `Jefe: ${j.corto} (${j.bestiario}${j.zona.length ? `; su sitio: ${j.zona.join("/")}` : "; no tiene sitio fijo"}). Presencia: ${modo}.`,
    regente ? `Es un REGENTE (${regente.titulo}): ${regente.corte}` : "",
    enPersona
      ? `En persona: aparecer_criatura con plantilla «${j.bestiario}»${regente ? `, SIEMPRE con su séquito (${regente.servidores.map((x) => x.nombre).join(", ")}: elige 1-2 grupos)` : ""}. Es mortal para este grupo: planifica un trato, una huida, un terreno que cambie la pelea o una intervención; un jefe no tiene por qué luchar a muerte ni al primer encuentro.`
      : emisario
        ? regente
          ? `Lo envía a cumplir su voluntad, sin estar presente: ${usoServidor}. Que se note quién los manda (insignia, sentencia, invitación, marea) y qué buscan.`
          : `Un emisario suyo (un servidor, un rastreador, un agente que no sabe todo): usa un enemigo corriente acorde al nivel, con un encargo y una pista de quién lo manda. El jefe sigue lejos.`
        : `Solo indicios, sin enemigos a la vista: ${j.senales}.`,
    `Su plan: ${j.plan}`,
    j.enemigo ? `Su enemigo: ${j.enemigo}` : "",
    (() => {
      const m = buscarCriatura(j.bestiario)?.trasfondo?.mision;
      return m ? `Misión semilla lista (${m.estado}): «${m.nombre}»: ${m.inicio} Si encaja, ábrela con trama abrir_arco y sigue su nudo y desenlaces (consulta_reglas criatura «${j.corto}»).` : "";
    })(),
    `Por qué está aquí (elige una o inventa otra coherente con la historia; la explicas TÚ cuando toque, con pistas y no de golpe):\n${razones}`,
    d.mision ? `Misión en curso: «${d.mision}». Haz que sea consecuencia de su plan o de su acción (¿quién la encargó de verdad? ¿qué buscaba?) y revélalo poco a poco.` : "Si hay una misión en curso, puede ser consecuencia de su plan: ese es el hilo que une todo.",
    `REGÍSTRALO para que no sea un adorno y viva en segundo plano: pnj {nombre: «${j.corto}», rol, voz, quiere, agenda: su plan en marcha, arco, en_escena: false}; trama abrir_arco (o avanzar el arco de la misión) con la premisa de su plan; el programa te avisará cuando lleve turnos fuera de escena para que su avance llegue como eco.`,
  ].filter(Boolean).join("\n");
}

export function sortearEncuentro(partida: Partida, d: DatosEncuentro = {}): string {
  const region = d.region ?? partida.mapa.lugares[partida.mapa.posicion ?? ""]?.region ?? "";
  const hora = horaDe(partida);
  const noche = hora !== null ? hora >= 19 || hora < 6 : null;
  const pjs = Object.values(partida.personajes);
  const nivel = pjs.length ? Math.round(pjs.reduce((s, p) => s + p.nivel, 0) / pjs.length) : 1;
  const dif = d.dificultad ?? "media";
  // ¿Un jefe fuera de su zona? Pequeña probabilidad, mayor en regiones peligrosas, con la amenaza en marcha o en dificultad alta.
  const bonusReg = bonusDe(region);
  const prob = Math.max(0, 5 + (bonusReg?.bonus.jefe ?? 0) + ((partida.trama?.reloj ?? 0) >= 4 ? 4 : 0) + { facil: -4, media: 0, dificil: 2, mortal: 6 }[dif]);
  const hayJefeReciente = (partida.encuentros ?? []).slice(-8).some((x) => x.familia === "jefe");
  if (!d.sin_jefe && (d.tipo === undefined || d.tipo === "combate" || d.jefe !== undefined)) {
    const forzado = d.jefe !== undefined;
    const dado = tirar("1d100").total;
    if (forzado || (!hayJefeReciente && dado <= prob)) {
      const r = encuentroDeJefe(partida, d, region, nivel, forzado ? "forzado: el origen de la misión" : `salió con ${dado} ≤ ${prob} %`);
      if (r) return r;
    }
  }
  const techo = (nivel <= 2 ? 2 : nivel <= 4 ? 3 : nivel <= 8 ? 4 : 5) + (dif === "mortal" ? 1 : dif === "facil" ? -1 : 0);
  const h = partida.encuentros ?? [];
  const prohibidas = new Set<string>(d.excluir ?? []);
  const ultimas2 = h.slice(-2);
  if (ultimas2.length === 2 && ultimas2[0].familia === ultimas2[1].familia) prohibidas.add(ultimas2[0].familia);
  const pesos = TABLA.filter((t) => (!d.tipo || t.tipo === d.tipo) && !prohibidas.has(t.familia)).map((t) => {
    let w = t.peso;
    if (t.regiones.length) w *= t.regiones.some((r) => region.toLowerCase().includes(r.toLowerCase())) ? 3 : 0.25;
    if (t.momento && noche !== null) w *= (t.momento === "noche") === noche ? 1.6 : 0.3;
    if (bonusReg) w *= bonusReg.bonus.familias[t.familia] ?? 1; // el bonus especial de la región
    if (t.peligro > techo) w *= 0.05;
    if (t.peligro < techo - 2) w *= 0.6;
    // Memoria: cada vez que esta familia salió entre los últimos encuentros, pesa menos.
    const veces = h.slice(-6).filter((x) => x.familia === t.familia).length;
    w *= Math.pow(0.4, veces);
    return { t, w };
  });
  if (!pesos.length) throw new Error("Con esos filtros no queda ningún encuentro posible: quita excluir o el tipo.");
  const total = pesos.reduce((s, x) => s + x.w, 0);
  const tirada = tirar("1d1000").total;
  let acum = 0;
  let elegido = pesos[pesos.length - 1].t;
  for (const x of pesos) {
    acum += (x.w / total) * 1000;
    if (tirada <= acum) { elegido = x.t; break; }
  }
  const [min, max] = elegido.cuantos;
  const mult = { facil: 0.6, media: 1, dificil: 1.5, mortal: 2 }[dif];
  const n = Math.max(1, Math.round((min + ((max - min) * (tirar("1d100").total - 1)) / 99) * (max > 1 ? mult : 1)));
  partida.encuentros ??= [];
  partida.encuentros.push({ familia: elegido.familia, nombre: elegido.nombre, paso: partida.secuencia?.total ?? 0 });
  if (partida.encuentros.length > MAX_HISTORIAL) partida.encuentros.splice(0, partida.encuentros.length - MAX_HISTORIAL);
  const uso = elegido.bestiario
    ? `aparecer_criatura con plantilla «${elegido.bestiario}» (${n}; nómbralas «${elegido.bestiario} 1», «${elegido.bestiario} 2»…) y luego iniciativa`
    : elegido.tipo === "combate"
      ? `iniciativa con pnj (${n} enemigos) — ${elegido.stats ?? "stats a tu criterio, acordes al nivel"}`
      : "no es necesariamente un combate: juega la escena";
  return [
    `🎲 ENCUENTRO (tirada real: d1000 = ${tirada}; ${region || "región sin fijar"}${hora !== null ? `, ${String(hora).padStart(2, "0")}:00` : ""}, nivel medio ${nivel}, dificultad ${dif})`,
    `Qué es: ${elegido.nombre} (${elegido.tipo}${n > 1 ? `, ${n}` : ""}) — ${elegido.quienes}`,
    `Qué quieren: ${elegido.quieren}`,
    `Cómo se evita o se resuelve sin pelear: ${elegido.salida}`,
    `Cómo usarlo: ${uso}`,
    bonusReg ? `Bonus de la región (${bonusReg.clave}): ${bonusReg.bonus.nota}.` : "",
    `Mételo en la historia (por qué están aquí ahora, cómo toca a un arco o a un PNJ), no lo sueltes sin más. Familia: ${elegido.familia}${prohibidas.size ? ` (se evitaron: ${[...prohibidas].join(", ")} por repetición)` : ""}.`,
  ].filter(Boolean).join("\n");
}

export const REGLAS_ENCUENTROS = `## Variedad de enemigos y encuentros (no todo es un Hambriento ni de la Inquisición)
- Tú no tienes azar propio y tiendes a repetir lo que más aparece en la ambientación: los Hambrientos y la Inquisición de la Llama Gris son UNA amenaza de fondo entre muchas, no el enemigo por defecto. Para cualquier encuentro aleatorio (viaje, exploración, un descanso interrumpido, «¿qué hay en esta calle?») NO lo decidas tú: llama a encuentro, que tira de verdad según región, hora, nivel y dificultad y evita repetir lo reciente.
- Reparte: humanos (bandoleros, desertores, cazarrecompensas, contrabandistas, saqueadores), fauna y monstruos, no-muertos, culto, Corte Pálida, Inquisición, entorno (niebla, pantano, derrumbe) y encuentros sociales o de hallazgo. No más de uno de cada tres encuentros de la misma familia; el programa te lo recuerda y puede negarte aparecer_criatura si repites tres veces (repetir=true solo si la trama lo exige).
- Cada región tiene su bonus (qué familias pesan más allí) y encuentro lo aplica. Además hay una pequeña posibilidad de que el encuentro sea un JEFE FUERA DE SU ZONA (casi siempre solo sus indicios o un emisario; en persona, rara vez y solo a nivel alto). Cuando salga, la razón la pones tú, con coherencia: puede ser su plan, lo que persigue o el verdadero origen de la misión en curso (pasa la misión en mision, o usa jefe: "azar"/nombre para que una misión sea consecuencia de un jefe). Regístralo siempre como PNJ con agenda y arco en segundo plano (pnj + trama), para que viva fuera de escena y llegue como eco.
- No todo encuentro es un combate: muchos se resuelven hablando, pagando, huyendo o sorteando el peligro. Dale a cada enemigo un motivo para estar ahí ahora y una forma de evitarlo.`;
