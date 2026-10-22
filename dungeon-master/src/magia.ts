// Magia de Velmora: rara y cara. Cada hechizo se cobra un tributo en el cuerpo
// o la mente de quien lo lanza (calor, aliento, sangre, cordura o años de vida),
// mayor cuanto más alto es su círculo. Los catalizadores absorben ese precio.
import { exigirLibre } from "./segador_base.js";
import { describir, tirar } from "./dados.js";
import type { Personaje } from "./estado.js";
import { bajarZona, cauterizarHerida, infligir, perderSangre, pvMaxEfectivo, REGLAS } from "./heridas.js";
import { competencia, marcarMuerto, mod, salvacion, signo, valor } from "./reglas.js";

export const ESCUELAS = ["elemental", "curacion", "necromancia", "mente", "proteccion", "sombra", "adivinacion"] as const;
export type Escuela = (typeof ESCUELAS)[number];
export const TRIBUTOS = ["calor", "aliento", "sangre", "cordura", "anios"] as const;
export type Tributo = (typeof TRIBUTOS)[number];
export const MAESTRIAS = ["profano", "iniciado", "adepto", "maestro", "archimago", "ascendido"] as const;
export type Maestria = (typeof MAESTRIAS)[number];

/** Círculo más alto que domina cada maestría y bono a la tirada de lanzamiento. */
const MAESTRIA: Record<Maestria, { circulo: number; bono: number }> = {
  profano: { circulo: -1, bono: 0 },
  iniciado: { circulo: 1, bono: 0 },
  adepto: { circulo: 2, bono: 2 },
  maestro: { circulo: 3, bono: 4 },
  archimago: { circulo: 4, bono: 6 },
  ascendido: { circulo: 5, bono: 8 },
};

/** La maestría que le corresponde a un Hechicero por su nivel: adepto, maestro (5), archimago (9) y ascendido (13). */
export function maestriaHechicero(nivel: number, don = true): Maestria {
  // Solo quien nace con el don arcano llega a ascendido; el que estudió en una escuela se queda en archimago.
  return nivel >= 13 && don ? "ascendido" : nivel >= 9 ? "archimago" : nivel >= 5 ? "maestro" : "adepto";
}

/** Sube la maestría de un Hechicero a la de su nivel (nunca la baja). Devuelve la nueva si cambió. */
export function ajustarMaestriaHechicero(p: Personaje): Maestria | null {
  if (p.clase !== "Hechicero" || !p.magia) return null;
  const nueva = maestriaHechicero(p.nivel, !!p.magia.don);
  sincronizarGrimorio(p);
  if (MAESTRIAS.indexOf(nueva) <= MAESTRIAS.indexOf(p.magia.maestria)) return null;
  p.magia.maestria = nueva;
  sincronizarGrimorio(p);
  return nueva;
}

const TRIBUTO_ESCUELA: Record<Escuela, Tributo> = {
  elemental: "calor",
  curacion: "sangre",
  necromancia: "anios",
  mente: "cordura",
  proteccion: "aliento",
  sombra: "cordura",
  adivinacion: "cordura",
};

// ---------------------------------------------------------------- tipos de magia y escuelas de hechicería

/** Un tipo de magia: lo que enseña cada escuela de hechicería. Los licenciados los enseña una escuela con licencia de la Inquisición. */
export interface TipoMagia {
  id: string;
  nombre: string;
  escuela: Escuela;
  tema?: "fuego" | "rayo" | "hielo" | "viento" | "oscuridad" | "agua" | "tierra" | "luz";
  licenciado: boolean;
  /** Cómo se canaliza este tipo (lo comprende cualquier hechicero, aunque no lo domine). */
  canaliza: string;
}

export const TIPOS_MAGIA: TipoMagia[] = [
  { id: "fuego", nombre: "fuego", escuela: "elemental", tema: "fuego", licenciado: true, canaliza: "se llama al calor del propio cuerpo y se empuja hacia fuera" },
  { id: "rayo", nombre: "rayo", escuela: "elemental", tema: "rayo", licenciado: true, canaliza: "se carga el aire de la mano hasta que salta" },
  { id: "hielo", nombre: "hielo", escuela: "elemental", tema: "hielo", licenciado: true, canaliza: "se roba el calor del entorno y se lo deja quieto" },
  { id: "viento", nombre: "viento", escuela: "elemental", tema: "viento", licenciado: true, canaliza: "se manda el propio aliento y se le da forma" },
  { id: "agua", nombre: "agua", escuela: "elemental", tema: "agua", licenciado: true, canaliza: "se convoca la humedad del aire y de la sangre" },
  { id: "tierra", nombre: "tierra", escuela: "elemental", tema: "tierra", licenciado: true, canaliza: "se escucha el peso del suelo y se le pide que se mueva" },
  { id: "oscuridad", nombre: "oscuridad", escuela: "elemental", tema: "oscuridad", licenciado: true, canaliza: "se aparta la luz con la voluntad hasta que solo queda sombra" },
  { id: "luz", nombre: "luz", escuela: "elemental", tema: "luz", licenciado: true, canaliza: "se reúne la luz presente y se la concentra" },
  { id: "curacion", nombre: "curación", escuela: "curacion", licenciado: true, canaliza: "se ofrece la propia sangre y se la dirige a la carne ajena" },
  { id: "proteccion", nombre: "protección", escuela: "proteccion", licenciado: true, canaliza: "se cierra el aliento en torno a algo y se le da dureza" },
  { id: "mente", nombre: "mente", escuela: "mente", licenciado: true, canaliza: "se toca el pensamiento ajeno con el propio" },
  { id: "adivinacion", nombre: "adivinación", escuela: "adivinacion", licenciado: true, canaliza: "se escucha lo que dejaron los hechizos y los muertos" },
  { id: "sombra", nombre: "sombra", escuela: "sombra", licenciado: false, canaliza: "se desprende la sombra propia y se la manda" },
  { id: "necromancia", nombre: "necromancia", escuela: "necromancia", licenciado: false, canaliza: "se paga con años de vida para hablar con la muerte" },
];
export const TIPOS_IDS = TIPOS_MAGIA.map((t) => t.id) as [string, ...string[]];
export const buscarTipo = (id: string): TipoMagia | undefined => TIPOS_MAGIA.find((t) => t.id === id.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""));
/** El tipo de magia de un hechizo: el tema si es elemental; si no, su escuela. */
export const tipoDe = (h: { escuela: Escuela; tema?: string }): string => (h.escuela === "elemental" ? (h.tema ?? "fuego") : h.escuela);
/** La escuela de hechicería que enseña un tipo (todas con licencia de la Inquisición, salvo las de magia negra). */
export const nombreEscuelaHechiceria = (tipo: string): string => `Escuela de ${buscarTipo(tipo)?.nombre ?? tipo}`;
/** Cuántos tipos puede dominar un Hechicero de escuela: 1 al empezar, 2 desde el nivel 5 y 3 desde el 9. El del don, todos. */
export const tiposMax = (nivel: number, don: boolean): number => (don ? TIPOS_MAGIA.length : nivel >= 9 ? 3 : nivel >= 5 ? 2 : 1);

export interface Hechizo {
  nombre: string;
  escuela: Escuela;
  circulo: number;
  /** Si no se indica, el de su escuela. */
  tributo?: Tributo;
  /** Solo con nivel 9 o más, maestría de adepto o afinidad racial con la magia. */
  requiere_alto?: boolean;
  /** Tema de un hechizo elemental (el Berserker solo domina rayo y hielo). */
  tema?: "fuego" | "rayo" | "hielo" | "viento" | "oscuridad" | "agua" | "tierra" | "luz";
  efecto: string;
  /** Dados de daño o efecto que el programa tira al lanzarlo. */
  dados?: string;
  /** Dados de curación que se aplican al objetivo. */
  cura?: string;
  /** Niveles de gravedad que baja en una herida del objetivo. */
  cierra_heridas?: number;
  /** Salvación que hacen los objetivos (CD = la del lanzador). */
  salvacion?: string;
  /** Efecto que el programa aplica a un paciente o a su herida (cirugía). */
  cuerpo?: "anestesia" | "anestesia_profunda" | "frio" | "brasa";
}

export const HECHIZOS: Hechizo[] = [
  // Elemental
  { nombre: "Chispa", escuela: "elemental", tema: "fuego", circulo: 0, efecto: "Enciende una llama pequeña, calienta las manos o hace 1d6 de fuego a un objetivo", dados: "1d6" },
  { nombre: "Velo de penumbra", escuela: "elemental", tema: "oscuridad", circulo: 0, efecto: "Una nube de sombra de 3 m de radio durante 1 minuto: dentro hay penumbra, con ventaja en Sigilo para esconderse y desventaja en Percepción para quien mira desde fuera" },
  { nombre: "Tinta negra", escuela: "elemental", tema: "oscuridad", circulo: 0, efecto: "Un chorro de oscuridad a la cara de un objetivo a 9 m: salvación de CON o queda cegado hasta el final de su siguiente turno (aplícalo con condicion)", salvacion: "CON" },
  { nombre: "Sangre hirviente", escuela: "elemental", tema: "fuego", circulo: 1, efecto: "Durante 1 minuto, los golpes del lanzador hacen +1d6 de fuego" },
  { nombre: "Chispazo", escuela: "elemental", tema: "rayo", circulo: 0, efecto: "Una descarga pequeña salta a un objetivo a 9 m: 1d6 de relámpago", dados: "1d6" },
  { nombre: "Escarcha", escuela: "elemental", tema: "hielo", circulo: 0, efecto: "Un aliento de escarcha a un objetivo a 9 m: 1d6 de frío, y su velocidad baja a la mitad hasta su siguiente turno", dados: "1d6" },
  { nombre: "Rayo", escuela: "elemental", tema: "rayo", circulo: 1, efecto: "Un rayo en línea recta de 18 m: 3d6 de relámpago, mitad si supera la salvación", dados: "3d6", salvacion: "DES" },
  { nombre: "Lanza de hielo", escuela: "elemental", tema: "hielo", circulo: 1, efecto: "Ataque de hechizo a distancia (36 m): 2d10 de frío", dados: "2d10" },
  { nombre: "Puño de trueno", escuela: "elemental", tema: "rayo", circulo: 2, efecto: "El siguiente golpe cuerpo a cuerpo del lanzador hace +3d6 de relámpago y empuja 3 m al objetivo", dados: "3d6" },
  { nombre: "Muro de escarcha", escuela: "elemental", tema: "hielo", circulo: 2, efecto: "Un muro de hielo de 9 m de largo y 3 m de alto durante 1 minuto: bloquea el paso y la vista, y quien lo atraviesa sufre 2d6 de frío", dados: "2d6" },
  { nombre: "Saeta de fuego", escuela: "elemental", tema: "fuego", circulo: 1, efecto: "Ataque de hechizo a distancia (36 m): 2d10 de fuego", dados: "2d10" },
  { nombre: "Ráfaga", escuela: "elemental", tema: "viento", circulo: 1, tributo: "aliento", efecto: "Un cono de viento de 4,5 m empuja 3 m y derriba", salvacion: "FUE" },
  { nombre: "Asfixiar", escuela: "elemental", tema: "viento", circulo: 3, tributo: "aliento", efecto: "Le roba el aire a un objetivo: sin respirar 1 minuto (repite la salvación cada asalto)", salvacion: "CON" },
  { nombre: "Bola de fuego", escuela: "elemental", tema: "fuego", circulo: 3, efecto: "Esfera de 6 m de radio: 8d6 de fuego, mitad si supera la salvación", dados: "8d6", salvacion: "DES" },
  { nombre: "Cadena de relámpagos", escuela: "elemental", tema: "rayo", circulo: 4, efecto: "Un rayo salta entre hasta 4 objetivos: 10d8 de relámpago, mitad si supera", dados: "10d8", salvacion: "DES" },
  { nombre: "Tormenta de ceniza", escuela: "elemental", tema: "fuego", circulo: 5, efecto: "Una tormenta de fuego y ceniza de 30 m durante 1 minuto: 12d6 por asalto", dados: "12d6", salvacion: "DES" },
  // Más magia elemental por tipo (propuesta): cada tipo tiene hechizos desde el truco hasta los círculos altos
  { nombre: "Muro de llamas", escuela: "elemental", tema: "fuego", circulo: 2, efecto: "Un muro de fuego de 9 m de largo durante 1 minuto: quien lo cruza sufre 5d6 de fuego", dados: "5d6", salvacion: "DES" },
  { nombre: "Pilar de fuego", escuela: "elemental", tema: "fuego", circulo: 4, efecto: "Un cilindro de fuego de 3 m de radio cae del cielo: 8d8 de fuego, mitad si supera la salvación", dados: "8d8", salvacion: "DES" },
  { nombre: "Tormenta eléctrica", escuela: "elemental", tema: "rayo", circulo: 3, efecto: "Un trueno sacude un área de 6 m de radio: 6d8 de relámpago y aturde un asalto al que falle", dados: "6d8", salvacion: "CON" },
  { nombre: "Ira del cielo", escuela: "elemental", tema: "rayo", circulo: 5, efecto: "Un rayo del cielo cae sobre un punto a la vista: 14d8 de relámpago en 3 m de radio", dados: "14d8", salvacion: "DES" },
  { nombre: "Aguanieve", escuela: "elemental", tema: "hielo", circulo: 3, efecto: "Un área de 6 m de radio se cubre de hielo y aguanieve: 4d6 de frío, velocidad a la mitad y derriba al que falle", dados: "4d6", salvacion: "DES" },
  { nombre: "Prisión de hielo", escuela: "elemental", tema: "hielo", circulo: 4, efecto: "Encierra a un objetivo en hielo: retenido un minuto y 6d6 de frío", dados: "6d6", salvacion: "FUE" },
  { nombre: "Invierno", escuela: "elemental", tema: "hielo", circulo: 5, efecto: "Un invierno de 30 m de radio durante 1 minuto: 12d6 de frío por asalto y velocidad a la mitad", dados: "12d6", salvacion: "CON" },
  { nombre: "Soplo", escuela: "elemental", tema: "viento", circulo: 0, tributo: "aliento", efecto: "Un soplo empuja 3 m a un objetivo pequeño, apaga una llama o aleja el humo" },
  { nombre: "Torbellino", escuela: "elemental", tema: "viento", circulo: 2, tributo: "aliento", efecto: "Un torbellino de 3 m de radio levanta y derriba a quien falle la salvación y lo arrastra 6 m", salvacion: "FUE" },
  { nombre: "Ciclón", escuela: "elemental", tema: "viento", circulo: 4, tributo: "aliento", efecto: "Un cono de 18 m de ciclón: 12d6 contundente, derriba y empuja 9 m", dados: "12d6", salvacion: "FUE" },
  { nombre: "Ojo de la tormenta", escuela: "elemental", tema: "viento", circulo: 5, tributo: "aliento", efecto: "Una tormenta de 30 m: nadie vuela ni dispara, 8d6 por asalto y el lanzador se mueve por dentro sin trabas", dados: "8d6", salvacion: "FUE" },
  { nombre: "Gota de rocío", escuela: "elemental", tema: "agua", circulo: 0, tributo: "aliento", efecto: "Crea un trago de agua pura, apaga una llama pequeña o limpia una herida" },
  { nombre: "Látigo de agua", escuela: "elemental", tema: "agua", circulo: 1, tributo: "aliento", efecto: "Ataque de hechizo a distancia (18 m): 2d6 contundente y empuja 1,5 m", dados: "2d6" },
  { nombre: "Niebla", escuela: "elemental", tema: "agua", circulo: 2, tributo: "aliento", efecto: "Una niebla de 9 m de radio durante 10 minutos: oculta la vista, desventaja en Percepción" },
  { nombre: "Ola", escuela: "elemental", tema: "agua", circulo: 3, tributo: "aliento", efecto: "Una ola de 9 m: 8d6 contundente, derriba y arrastra 6 m", dados: "8d6", salvacion: "FUE" },
  { nombre: "Marea", escuela: "elemental", tema: "agua", circulo: 4, tributo: "aliento", efecto: "Una marea que arrastra a todos en 18 m: 10d8 contundente y los deja en el suelo", dados: "10d8", salvacion: "FUE" },
  { nombre: "Diluvio", escuela: "elemental", tema: "agua", circulo: 5, tributo: "aliento", efecto: "Un diluvio de 30 m durante 1 minuto: 10d6 por asalto, apaga todo fuego y vuelve el suelo un lodazal", dados: "10d6", salvacion: "FUE" },
  { nombre: "Esquirla", escuela: "elemental", tema: "tierra", circulo: 0, efecto: "Lanza una esquirla de piedra a un objetivo a 9 m: 1d8 perforante", dados: "1d8" },
  { nombre: "Lanza de piedra", escuela: "elemental", tema: "tierra", circulo: 1, efecto: "Una lanza de piedra surge del suelo: 2d8 perforante a un objetivo a 18 m", dados: "2d8" },
  { nombre: "Raíces", escuela: "elemental", tema: "tierra", circulo: 2, efecto: "Raíces y piedra atrapan a quien falle la salvación en 3 m de radio: retenido un minuto", salvacion: "FUE" },
  { nombre: "Temblor", escuela: "elemental", tema: "tierra", circulo: 3, efecto: "El suelo tiembla en 9 m: 6d6 contundente y derriba a quien falle", dados: "6d6", salvacion: "DES" },
  { nombre: "Muro de roca", escuela: "elemental", tema: "tierra", circulo: 4, efecto: "Un muro de roca de 12 m de largo y 6 de alto, infranqueable durante 10 minutos" },
  { nombre: "Terremoto", escuela: "elemental", tema: "tierra", circulo: 5, efecto: "Un terremoto de 30 m de radio: 12d6 contundente, derriba, abre grietas y derrumba lo frágil", dados: "12d6", salvacion: "DES" },
  { nombre: "Cegar", escuela: "elemental", tema: "oscuridad", circulo: 1, efecto: "Una nube de oscuridad sobre la cabeza de un objetivo: cegado un minuto", salvacion: "CON" },
  { nombre: "Oscuridad total", escuela: "elemental", tema: "oscuridad", circulo: 2, efecto: "Una esfera de oscuridad de 6 m durante 10 minutos que ninguna luz vence" },
  { nombre: "Absorber la luz", escuela: "elemental", tema: "oscuridad", circulo: 3, efecto: "Apaga todas las luces en 18 m, mágicas incluidas, y los rivales sin visión en la oscuridad tienen desventaja" },
  { nombre: "Luz", escuela: "elemental", tema: "luz", circulo: 0, efecto: "Un objeto brilla como una antorcha (9 m) durante 1 hora" },
  { nombre: "Destello", escuela: "elemental", tema: "luz", circulo: 1, efecto: "Un fogonazo de luz en 4,5 m: ciega un asalto a quien falle y hace 2d6 radiante a los no-muertos", dados: "2d6", salvacion: "CON" },
  { nombre: "Lanza de luz", escuela: "elemental", tema: "luz", circulo: 2, efecto: "Un rayo de luz a un objetivo a 36 m: 3d8 radiante", dados: "3d8" },
  { nombre: "Sol momentáneo", escuela: "elemental", tema: "luz", circulo: 3, efecto: "Una esfera de luz de 6 m: 8d6 radiante, los no-muertos con desventaja en sus salvaciones", dados: "8d6", salvacion: "CON" },
  { nombre: "Rayo solar", escuela: "elemental", tema: "luz", circulo: 4, efecto: "Un rayo de sol en línea de 36 m: 12d8 radiante", dados: "12d8", salvacion: "CON" },
  { nombre: "Amanecer", escuela: "elemental", tema: "luz", circulo: 5, efecto: "Un amanecer de 30 m durante 1 minuto: 10d10 radiante por asalto a no-muertos y malditos, y cura 2d8 a los aliados cada asalto", dados: "10d10", salvacion: "CON" },
  { nombre: "Noche cerrada", escuela: "elemental", tema: "oscuridad", circulo: 4, efecto: "Una noche cerrada de 18 m durante 10 minutos: ninguna luz la vence y quien falle la salvación queda cegado mientras esté dentro", salvacion: "CON" },
  { nombre: "Noche absoluta", escuela: "elemental", tema: "oscuridad", circulo: 5, efecto: "Un kilómetro de radio queda a oscuras una hora: ni el sol ni el fuego alumbran, y los que ven en la oscuridad lo hacen a 9 m" },
  // Curación
  { nombre: "Cerrar la carne", escuela: "curacion", circulo: 1, efecto: "Toque: el objetivo recupera 2d8 + mod. del lanzador PV", cura: "2d8" },
  { nombre: "Sutura arcana", escuela: "curacion", circulo: 2, efecto: "Toque: baja una herida un nivel de gravedad y detiene su hemorragia", cierra_heridas: 1 },
  { nombre: "Restaurar", escuela: "curacion", circulo: 3, efecto: "Toque: baja una herida dos niveles y el objetivo recupera 4d8 PV", cierra_heridas: 2, cura: "4d8" },
  { nombre: "Devolver el aliento", escuela: "curacion", circulo: 5, efecto: "Devuelve a la vida a alguien muerto hace menos de un minuto, con 1 PV" },
  { nombre: "Sangre de Haema", escuela: "curacion", circulo: 1, efecto: "Lanza una salpicadura de su propia sangre que quema a un objetivo a 9 m: 2d6 de daño necrótico (la sangre es el precio, como en toda la curación)", dados: "2d6" },
  // Cirugía: magia contra el dolor y elemental leve de fuego y hielo (Barbero-Cirujano)
  { nombre: "Adormecer el dolor", escuela: "mente", circulo: 0, cuerpo: "anestesia", efecto: "Toque: el paciente no siente dolor durante la operación (+2 al próximo tratamiento, como un paciente sedado, pero despierto)" },
  { nombre: "Anestesia profunda", escuela: "mente", circulo: 1, cuerpo: "anestesia_profunda", efecto: "Toque: duerme al paciente sin dolor ni sobresalto (+4 al próximo tratamiento y las complicaciones pegan la mitad)" },
  { nombre: "Brasa cauterizadora", escuela: "elemental", tema: "fuego", circulo: 0, cuerpo: "brasa", efecto: "Una brasa en la punta de los dedos cauteriza una herida de corte, perforación o mordedura sin hierro candente (1d3 de fuego) y detiene la hemorragia" },
  { nombre: "Frío de quirófano", escuela: "elemental", tema: "hielo", circulo: 0, cuerpo: "frio", efecto: "Toque helado sobre una herida: adormece y enfría, gana tres asaltos a una hemorragia y da +1 al tratamiento" },
  { nombre: "Aliento tibio", escuela: "curacion", circulo: 0, efecto: "Toque: estabiliza a alguien a 0 PV o le devuelve 1d4 PV" , cura: "1d4" },
  { nombre: "Regeneración", escuela: "curacion", circulo: 4, efecto: "Toque: el objetivo recupera 6d8 PV y se cierran dos niveles de gravedad de una herida", cura: "6d8", cierra_heridas: 2 },
  { nombre: "Resguardo", escuela: "proteccion", circulo: 0, efecto: "Un escudo de aire: +1 a la CA del lanzador o de un aliado hasta su siguiente turno" },
  { nombre: "Fortaleza", escuela: "proteccion", circulo: 5, efecto: "Los aliados a 9 m ganan +2 a la CA y resistencia a un tipo de daño a elegir durante 10 minutos" },
  { nombre: "Miedo", escuela: "mente", circulo: 3, efecto: "Una oleada de terror en un cono de 9 m: asustado un minuto a quien falle la salvación", salvacion: "SAB" },
  { nombre: "Presentir", escuela: "adivinacion", circulo: 0, efecto: "Siente el peligro inmediato a 9 m (emboscadas, trampas, enemigos ocultos) durante 10 minutos" },
  { nombre: "Ver a lo lejos", escuela: "adivinacion", circulo: 4, efecto: "Ve y oye durante 10 minutos un lugar o persona conocidos, sin importar la distancia (si no supera la salvación, lo nota)", salvacion: "SAB" },
  { nombre: "Ojo del destino", escuela: "adivinacion", circulo: 5, efecto: "Ve el mañana de un objetivo: tira 3d20 y guarda los resultados; cada uno puede sustituir una tirada suya o de un aliado hoy", dados: "3d20" },
  { nombre: "Marchitar", escuela: "necromancia", circulo: 1, efecto: "Toque: 2d8 de daño necrótico y el objetivo se agota (desventaja en la siguiente tirada de fuerza)", dados: "2d8", salvacion: "CON" },
  // Necromancia
  { nombre: "Toque de la tumba", escuela: "necromancia", circulo: 0, efecto: "Toque: 1d8 de daño necrótico", dados: "1d8" },
  { nombre: "Drenar vida", escuela: "necromancia", circulo: 2, efecto: "4d8 de daño necrótico a un objetivo a 9 m; el lanzador recupera la mitad", dados: "4d8", salvacion: "CON" },
  { nombre: "Levantar al muerto", escuela: "necromancia", circulo: 3, efecto: "Un cadáver se alza y obedece durante 1 hora (Hambriento)" },
  { nombre: "Palabra de pudrición", escuela: "necromancia", circulo: 4, efecto: "10d8 necrótico y la Podre a un objetivo; mitad y sin Podre si supera", dados: "10d8", salvacion: "CON" },
  { nombre: "Ejército de huesos", escuela: "necromancia", circulo: 5, efecto: "Se alzan todos los muertos en 60 m y luchan por el lanzador durante 1 hora" },
  // Mente
  { nombre: "Susurro", escuela: "mente", circulo: 0, efecto: "Envía un mensaje mental de una frase a alguien a la vista" },
  { nombre: "Encantar", escuela: "mente", circulo: 1, efecto: "El objetivo trata al lanzador como un amigo durante 1 hora", salvacion: "SAB" },
  { nombre: "Ilusión mayor", escuela: "mente", circulo: 2, efecto: "Una ilusión con sonido y olor de hasta 6 m durante 10 minutos", salvacion: "INT" },
  { nombre: "Dominar", escuela: "mente", circulo: 4, efecto: "Controla las acciones de un objetivo durante 1 minuto", salvacion: "SAB" },
  { nombre: "Romper la mente", escuela: "mente", circulo: 5, efecto: "Destroza la mente de un objetivo: 10d10 psíquico y, si falla por 5, queda en estado vegetativo", dados: "10d10", salvacion: "INT" },
  // Protección
  { nombre: "Vigor de ceniza", escuela: "proteccion", circulo: 1, efecto: "Durante 1 minuto, +2 a las pruebas y salvaciones de FUE y ventaja en agarrar y empujar (refuerzo)" },
  { nombre: "Arma que regresa", escuela: "proteccion", circulo: 3, efecto: "Encanta un arma arrojadiza o de mano durante 1 hora: tras lanzarla vuelve a la mano del lanzador al final del turno. Exige nivel 9 o más, maestría de adepto o afinidad con la magia", requiere_alto: true },
  { nombre: "Piel de hierro", escuela: "proteccion", circulo: 1, efecto: "+2 a la CA del lanzador o de un aliado durante 10 minutos" },
  { nombre: "Escudo de sal", escuela: "proteccion", circulo: 2, efecto: "Durante 1 minuto, los no-muertos no pueden tocar al objetivo sin superar SAB" },
  { nombre: "Círculo de custodia", escuela: "proteccion", circulo: 3, efecto: "Un círculo de 6 m que ninguna criatura hostil puede cruzar durante 10 minutos", salvacion: "CAR" },
  { nombre: "Muro de fe", escuela: "proteccion", circulo: 4, efecto: "Un muro de luz gris de 18 m, infranqueable durante 10 minutos" },
  // Sombra
  { nombre: "Paso de sombra", escuela: "sombra", circulo: 1, efecto: "Se teletransporta hasta 9 m de una sombra a otra" },
  { nombre: "Manto de noche", escuela: "sombra", circulo: 2, efecto: "Invisible en penumbra u oscuridad durante 10 minutos" },
  { nombre: "Robar la sombra", escuela: "sombra", circulo: 3, efecto: "Arranca la sombra de un objetivo: queda aturdido y con desventaja 1 minuto", salvacion: "CAR" },
  { nombre: "Camuflaje de sombra", escuela: "sombra", circulo: 3, requiere_alto: true, efecto: "Se funde con lo que lo rodea 10 minutos, también a plena luz: queda invisible y muy difícil de ver (quien lo busca necesita Percepción CD 20, y los ataques contra él tienen desventaja si lo adivinan). Se rompe si ataca o lanza un hechizo ofensivo. Exige nivel 9 o más, maestría de adepto o afinidad racial con la magia" },
  { nombre: "Puerta negra", escuela: "sombra", circulo: 5, efecto: "Abre un paso entre dos sombras cualesquiera de Velmora durante 1 minuto" },
  // Adivinación
  { nombre: "Ojo de bruja", escuela: "adivinacion", circulo: 1, efecto: "Durante 10 minutos ve magia, no-muertos y malditos a 9 m" },
  { nombre: "Leer el rastro", escuela: "adivinacion", circulo: 1, efecto: "Sabe quién pasó por aquí en las últimas 24 horas y hacia dónde" },
  { nombre: "Hablar con los muertos", escuela: "adivinacion", circulo: 2, efecto: "Un cadáver responde a tres preguntas, con lo que sabía en vida" },
  { nombre: "Visión del mañana", escuela: "adivinacion", circulo: 3, efecto: "Ve un instante del futuro: tira un d20 y guárdalo; puede sustituir una tirada propia o de un aliado hoy", dados: "1d20" },
];

/** Hechizos de unos tipos hasta cierto círculo. */
export function hechizosDeTipos(tipos: string[], circuloMax: number): string[] {
  return HECHIZOS.filter((h) => tipos.includes(tipoDe(h)) && h.circulo <= circuloMax).map((h) => h.nombre);
}

/** Los tipos de magia que usa un personaje con escuelas heredadas (partidas antiguas): todos los de esas escuelas. */
export const tiposDeEscuelas = (escuelas: Escuela[]): string[] => TIPOS_MAGIA.filter((t) => escuelas.includes(t.escuela)).map((t) => t.id);

/** El grimorio de un Hechicero de escuela: sabe todos los hechizos de sus tipos hasta el círculo que domina; cuanto más nivel, más hechizos. */
export function sincronizarGrimorio(p: Personaje): void {
  const m = p.magia;
  if (!m || p.clase !== "Hechicero" || m.don) return; // el del don aprende viendo
  const tipos = m.tipos ?? tiposDeEscuelas(m.escuelas);
  const sabidos = new Set(m.hechizos);
  for (const n of hechizosDeTipos(tipos, MAESTRIA[m.maestria].circulo)) sabidos.add(n);
  m.hechizos = [...sabidos];
}

export function buscarHechizo(nombre: string): Hechizo | undefined {
  const n = nombre.toLowerCase();
  return HECHIZOS.find((h) => h.nombre.toLowerCase() === n) ?? HECHIZOS.find((h) => h.nombre.toLowerCase().includes(n));
}

// ---------------------------------------------------------------- razas y clases

export interface AfinidadRaza {
  bono: number;
  escuelas?: Partial<Record<Escuela, number>>;
  /** Reducción por hechizo de algunos tributos (negativo = cuesta más). */
  descuento?: Partial<Record<Tributo, number>>;
  /** Multiplicador de los años de vida que cuesta la magia. */
  anios?: number;
  nota: string;
}

export const AFINIDAD: Record<string, AfinidadRaza> = {
  "Humano del Faro": { bono: 0, nota: "sin afinidad especial" },
  "Enano de Karak-Dûm": { bono: -2, escuelas: { proteccion: 3 }, nota: "−2 a lanzar, pero +1 en protección (runas)" },
  "Elfo Marchito": { bono: 2, descuento: { cordura: 1 }, nota: "+2 a lanzar; la magia de la mente le cuesta 1 de cordura menos" },
  "Mediano de Hollín": { bono: 0, nota: "sin afinidad; su suerte también vale para lanzar" },
  Varg: { bono: -2, descuento: { calor: -1 }, nota: "−2 a lanzar; la magia le hierve la sangre (+1 de calor)" },
  "Nacido Pálido": { bono: 1, escuelas: { necromancia: 2 }, anios: 0.5, nota: "+1 a lanzar, +2 en necromancia; envejece la mitad" },
  Cenizo: { bono: 0, escuelas: { elemental: 2 }, descuento: { calor: 1 }, nota: "+2 en elemental; el calor le cuesta 1 menos" },
};

/** Magia con la que empieza cada clase. */
export const MAGIA_CLASE: Record<string, { maestria: Maestria; escuelas: Escuela[]; hechizos: string[]; atributo: "int" | "sab" | "car" }> = {
  "Mercenario del Cuervo": { maestria: "iniciado", escuelas: ["proteccion"], hechizos: ["Piel de hierro"], atributo: "sab" },
  "Berserker de Ceniza": { maestria: "iniciado", escuelas: ["elemental", "proteccion"], hechizos: ["Chispazo", "Escarcha"], atributo: "car" },
  "Caballero Juramentado": { maestria: "iniciado", escuelas: ["curacion", "proteccion"], hechizos: ["Cerrar la carne", "Escudo de sal"], atributo: "car" },
  "Cazador de Brujas": { maestria: "iniciado", escuelas: ["adivinacion"], hechizos: ["Ojo de bruja", "Leer el rastro"], atributo: "sab" },
  Degollador: { maestria: "iniciado", escuelas: ["sombra", "elemental"], hechizos: ["Paso de sombra"], atributo: "int" },
  Flagelante: { maestria: "iniciado", escuelas: ["curacion"], hechizos: ["Cerrar la carne", "Sangre de Haema"], atributo: "sab" },
  Segador: { maestria: "adepto", escuelas: ["necromancia"], hechizos: ["Toque de la tumba", "Drenar vida"], atributo: "car" },
  "Barbero-Cirujano": { maestria: "iniciado", escuelas: ["mente", "elemental"], hechizos: ["Adormecer el dolor", "Brasa cauterizadora"], atributo: "sab" },
  Hechicero: { maestria: "adepto", escuelas: [], hechizos: [], atributo: "int" },
};

export interface MagiaPersonaje {
  maestria: Maestria;
  escuelas: Escuela[];
  hechizos: string[];
  atributo: "int" | "sab" | "car";
  calor: number;
  aliento: number;
  cordura: number;
  anios_perdidos: number;
  /** Tramos de 10 años ya descontados de FUE y DES. */
  tramos_vejez: number;
  /** Nació con don arcano que aún duerme (el Mercenario lo despierta al subir de nivel). En el Hechicero, el don lo hace dominar todos los tipos. */
  don?: boolean;
  /** Hechicero: tipos de magia que domina (fuego, hielo, agua…), de los que lanza hechizos. */
  tipos?: string[];
  /** Hechicero: tipos de magia que cubre su licencia de la Inquisición (la de las escuelas en que estudió). */
  licencias?: string[];
  /** Hechicero: por qué entró en la hechicería: noble, rico o «don» (incluido por fuerza mayor). */
  origen?: "noble" | "rico" | "don";
}

/**
 * Probabilidad (%) de nacer con don arcano, según la raza. Fuera del Hechicero,
 * casi nadie sabe magia: un guerrero que la usa tiene el don o es de élite y
 * la aprendió con un maestro.
 */
export const DON_ARCANO: Record<string, number> = {
  "Humano del Faro": 4,
  "Enano de Karak-Dûm": 2,
  "Elfo Marchito": 15,
  "Mediano de Hollín": 4,
  Varg: 1,
  "Nacido Pálido": 12,
  Cenizo: 10,
};

/** Tira el don arcano al crear un personaje. */
export function tirarDon(raza: string): { don: boolean; texto: string } {
  const prob = DON_ARCANO[raza] ?? 4;
  const d = tirar("1d100").total;
  const don = d <= prob;
  return { don, texto: `Don arcano (${raza}, ${prob} %): d100 = ${d} → ${don ? "¡TIENE EL DON!" : "no"}` };
}

/** La magia con la que empieza un personaje. Los guerreros, solo si tienen el don. */
export function magiaInicial(clase: string, escuelasElegidas?: Escuela[], don = false, tiposElegidos?: string[]): MagiaPersonaje {
  const vacia = { calor: 0, aliento: 0, cordura: 0, anios_perdidos: 0, tramos_vejez: 0 };
  const base = MAGIA_CLASE[clase];
  if (clase === "Hechicero") {
    // Escuela de hechicería: empieza con UN tipo de magia (el que enseña su escuela), con licencia de la Inquisición si es de los licenciados.
    // Con el don arcano domina todos los tipos y su magia cuenta igual (mismas reglas y precios).
    const validos = (tiposElegidos ?? []).filter((t) => buscarTipo(t)).map((t) => buscarTipo(t)!.id);
    const tipos = validos.length ? [...new Set(validos)].slice(0, 1) : escuelasElegidas?.length ? tiposDeEscuelas(escuelasElegidas.slice(0, 2)) : ["fuego"];
    const escuelas = don ? [...ESCUELAS] : ([...new Set(tipos.map((t) => buscarTipo(t)!.escuela))] as Escuela[]);
    const hechizos = hechizosDeTipos(tipos, 1);
    return { maestria: "adepto", escuelas, hechizos, atributo: "int", don, tipos, licencias: don ? TIPOS_MAGIA.filter((t) => t.licenciado).map((t) => t.id) : tipos.filter((t) => buscarTipo(t)?.licenciado), ...vacia };
  }
  // El Mercenario es la clase más corriente: aunque tenga el don, la magia no despierta hasta que suba de nivel.
  if (base && don && clase === "Mercenario del Cuervo") return { maestria: "profano", escuelas: [], hechizos: [], atributo: base.atributo, don: true, ...vacia };
  if (base && don) return { maestria: base.maestria, escuelas: [...base.escuelas], hechizos: [...base.hechizos], atributo: base.atributo, ...vacia };
  return { maestria: "profano", escuelas: [], hechizos: [], atributo: base?.atributo ?? "int", ...vacia };
}

/** Cuando un guerrero aprende magia en la historia, empieza por la de su estilo. */
export function despertarMagia(clase: string, m: MagiaPersonaje) {
  const base = MAGIA_CLASE[clase];
  if (!base || m.escuelas.length) return;
  m.escuelas = [...base.escuelas];
  m.hechizos = [...base.hechizos];
  m.atributo = base.atributo;
}

export function textoMagia(m: MagiaPersonaje | undefined): string {
  if (!m || m.maestria === "profano") return "";
  const tributos = [m.calor && `calor ${m.calor}`, m.aliento && `aliento ${m.aliento}`, m.cordura && `cordura ${m.cordura}`, m.anios_perdidos && `${m.anios_perdidos} años perdidos`]
    .filter(Boolean)
    .join(" · ");
  const hechicero = m.tipos ? `\n  Tipos de magia: ${m.don ? "todos (don arcano)" : m.tipos.join(", ")}${m.origen ? ` · origen ${m.origen}` : ""} · licencia de la Inquisición: ${m.don ? "todos los tipos licenciados (tutela por el don arcano)" : m.licencias?.length ? m.licencias.map((t) => nombreEscuelaHechiceria(t)).join(", ") : "ninguna (hereje si lo descubren)"}` : "";
  return `  Magia: ${m.maestria} (${m.don && m.tipos ? "todas las escuelas" : m.escuelas.join(", ")}) · ${m.hechizos.join(", ") || "sin hechizos"}${hechicero}${tributos ? `\n  Tributos: ${tributos}` : ""}`;
}

// ---------------------------------------------------------------- catalizadores

export interface Catalizador {
  nombre: string;
  tributo: Tributo | "cualquiera";
  /** Puntos que absorbe por hechizo (años en el caso de años; 99 = todo). */
  absorbe: number;
  /** Si absorbe varios tributos (el bastón del Hechicero: calor, aliento y cordura). */
  tributos?: Tributo[];
  /** Absorbe más cuanto más nivel tiene quien lo usa: 1 + nivel/4. */
  escala?: boolean;
  consumible: boolean;
  precio: number | null;
  descripcion: string;
}

export const CATALIZADORES: Catalizador[] = [
  { nombre: "Piedra de brasa", tributo: "calor", absorbe: 4, consumible: true, precio: 40, descripcion: "Una piedra que se pone al rojo y se agrieta en lugar de la carne del mago." },
  { nombre: "Ámbar de tormenta", tributo: "aliento", absorbe: 4, consumible: true, precio: 40, descripcion: "Ámbar con una burbuja de aire de tormenta: se rompe y respira por ti." },
  { nombre: "Corazón de cuervo", tributo: "sangre", absorbe: 99, consumible: true, precio: 30, descripcion: "Un corazón seco que se llena de tu sangre en lugar de tus venas." },
  { nombre: "Incienso de amapola gris", tributo: "cordura", absorbe: 3, consumible: true, precio: 25, descripcion: "Su humo calma las voces que trae la magia." },
  { nombre: "Reloj de arena de hueso", tributo: "anios", absorbe: 10, consumible: true, precio: null, descripcion: "Arena de hueso de un dios: se vacía en tu lugar. Rarísimo; no se vende." },
  { nombre: "Diente de dios", tributo: "cualquiera", absorbe: 99, consumible: true, precio: null, descripcion: "Absorbe todo el precio de un hechizo, sea cual sea. Reliquia de un dios muerto." },
  { nombre: "Bastón", tributo: "calor", tributos: ["calor", "aliento", "cordura"], absorbe: 1, escala: true, consumible: false, precio: null, descripcion: "El bastón del hechicero, cargado de años de uso: absorbe parte del calor, del aliento o de la cordura que cobra un hechizo (1 + un punto más cada 4 niveles). No sirve contra la sangre ni los años de vida." },
  { nombre: "Báculo de roble petrificado", tributo: "calor", absorbe: 1, consumible: false, precio: 300, descripcion: "Permanente: cada hechizo cuesta 1 de calor menos." },
];

export function buscarCatalizador(nombre: string): Catalizador | undefined {
  const n = nombre.toLowerCase();
  return CATALIZADORES.find((c) => n.includes(c.nombre.toLowerCase()) || c.nombre.toLowerCase().includes(n));
}

// ---------------------------------------------------------------- lanzar

export interface DatosLanzamiento {
  hechizo?: string;
  hechizo_nuevo?: Hechizo;
  /** Para lanzar un hechizo en un círculo más alto (más efecto, más precio). */
  circulo?: number;
  catalizador?: string;
  /** Lanzar por encima de la maestría: CD +5 y precio doble. */
  forzar?: boolean;
  objetivo?: Personaje;
  herida?: string;
}

/** Años de vida que se cobra un hechizo: la necromancia siempre; el resto, desde el círculo 4. */
function aniosDe(circulo: number, escuela: Escuela): number {
  if (escuela === "necromancia") return [0, 0.25, 1, tirar("1d4").total, tirar("2d6").total, tirar("4d10").total][circulo] ?? 0;
  return circulo >= 5 ? tirar("3d6").total : circulo === 4 ? tirar("1d4").total : 0;
}

export function lanzar(p: Personaje, d: DatosLanzamiento): string {
  const m = p.magia;
  exigirLibre(p, "Magia");
  if (!m || m.maestria === "profano") return `${p.nombre} no sabe magia: necesita un maestro, un grimorio o un objeto que la contenga.`;
  if (p.clase === "Caballero Juramentado") {
    if (!p.juramento) return `${p.nombre} aún no ha jurado: su poder viene del juramento.`;
    if (p.juramento.perdido) return `${p.nombre} perdió su juramento para siempre: no puede usar magia divina.`;
    if (p.juramento.roto) return `${p.nombre} tiene el juramento roto (${p.juramento.roto.voto}): su poder calla hasta que expíe.`;
  }
  const h = d.hechizo_nuevo ?? (d.hechizo ? buscarHechizo(d.hechizo) : undefined);
  if (!h) throw new Error(`No conozco el hechizo "${d.hechizo}". Usa uno de la lista (consultar_reglas magia) o descríbelo con hechizo_nuevo.`);
  if (!m.escuelas.includes(h.escuela)) throw new Error(`${p.nombre} no domina la escuela de ${h.escuela} (domina: ${m.escuelas.join(", ") || "ninguna"}).`);
  if (p.clase === "Hechicero" && !m.don) {
    const tipos = m.tipos ?? tiposDeEscuelas(m.escuelas);
    if (!tipos.includes(tipoDe(h))) throw new Error(`${p.nombre} comprende la magia de ${tipoDe(h)} pero no la domina: solo ha estudiado ${tipos.join(", ")}. Para lanzar ${h.nombre} necesita estudiar ese tipo en una escuela (aprender_tipo; puede dominar ${tiposMax(p.nivel, false)} a su nivel).`);
  }
  if (p.clase === "Berserker de Ceniza" && h.escuela === "elemental" && !(h.tema && ["rayo", "hielo"].includes(h.tema) && h.circulo <= 2))
    throw new Error(`Un Berserker de Ceniza solo domina de la magia elemental los rayos y el hielo básicos (hasta círculo 2): ${h.nombre} queda fuera.`);
  if (p.clase === "Barbero-Cirujano" && h.escuela === "elemental" && !(h.tema && ["fuego", "hielo"].includes(h.tema) && h.circulo <= 1))
    throw new Error(`Un Barbero-Cirujano solo domina de la magia elemental el fuego y el hielo leves para cauterizar y enfriar (hasta círculo 1): ${h.nombre} queda fuera.`);
  if (p.clase === "Degollador" && h.escuela === "elemental" && !(h.tema === "oscuridad" && h.circulo <= 1))
    throw new Error(`Un Degollador solo domina de la magia elemental la oscuridad menor (esconderse y cegar): ${h.nombre} queda fuera.`);
  if (h.requiere_alto && p.nivel < 9 && MAESTRIAS.indexOf(m.maestria) < MAESTRIAS.indexOf("adepto") && !((AFINIDAD[p.raza]?.bono ?? 0) > 0))
    throw new Error(`${h.nombre} exige nivel 9 o más, maestría de adepto o afinidad racial con la magia: ${p.nombre} (nivel ${p.nivel}, ${m.maestria}) aún no puede.`);
  const conocido = d.hechizo_nuevo || m.hechizos.some((x) => x.toLowerCase() === h.nombre.toLowerCase());
  const log: string[] = [];
  const circulo = Math.max(h.circulo, Math.min(5, d.circulo ?? h.circulo));
  const max = MAESTRIA[m.maestria].circulo;
  const forzado = circulo > max;
  if (forzado && !d.forzar) throw new Error(`${h.nombre} en círculo ${circulo} supera la maestría de ${p.nombre} (${m.maestria}, hasta círculo ${max}). Pasa forzar=true para intentarlo igualmente (CD +5 y precio doble).`);
  if (forzado && circulo > max + 1) throw new Error(`Ni forzando se puede lanzar dos círculos por encima de la maestría.`);

  const af = AFINIDAD[p.raza] ?? { bono: 0, nota: "" };
  const tributo = h.tributo ?? TRIBUTO_ESCUELA[h.escuela];
  log.push(`${p.nombre} lanza ${h.nombre} (${h.escuela}, círculo ${circulo}${forzado ? ", FORZADO" : ""}${conocido ? "" : ", improvisado"}). Precio: ${tributo === "anios" ? "años de vida" : tributo}.`);

  // Los trucos (círculo 0) no se tiran ni cuestan.
  let exito = true;
  let pifia = false;
  if (circulo > 0) {
    const bono =
      mod(valor(p, m.atributo)) + MAESTRIA[m.maestria].bono + (p.clase === "Hechicero" ? competencia(p) : 0) + af.bono + (af.escuelas?.[h.escuela] ?? 0) - (conocido ? 0 : 2);
    const cd = 10 + 2 * circulo + (forzado ? 5 : 0);
    const t = tirar(`1d20${signo(bono)}`);
    const nat = t.dados[0];
    exito = nat === 20 || (nat !== 1 && t.total >= cd);
    pifia = nat === 1 || t.total <= cd - 5;
    log.push(`Lanzamiento: ${describir(t)} vs CD ${cd} → ${exito ? "ÉXITO" : pifia ? "PIFIA" : "fallo"}.`);
  }

  // Efecto
  const cdObjetivos = 8 + competencia(p) + mod(valor(p, m.atributo)) + (circulo - h.circulo);
  if (exito) {
    log.push(`Efecto: ${h.efecto}.${h.salvacion ? ` Los objetivos hacen salvación de ${h.salvacion} CD ${cdObjetivos}.` : ""}`);
    if (h.dados) {
      const extra = circulo - h.circulo;
      const dados = extra > 0 && /^\d+d\d+/.test(h.dados) ? h.dados.replace(/^(\d+)/, (n) => String(Number(n) + extra * 2)) : h.dados;
      log.push(`Tirada del hechizo: ${describir(tirar(dados))}.`);
    }
    const o = d.objetivo;
    if (o && h.cuerpo) {
      const her = d.herida ? o.heridas.find((x) => x.id.toLowerCase() === d.herida!.toLowerCase()) : [...o.heridas].sort((a, b) => Number(b.sangrando) - Number(a.sangrando))[0];
      if (h.cuerpo === "anestesia" || h.cuerpo === "anestesia_profunda") {
        o.anestesia = h.cuerpo === "anestesia" ? 2 : 4;
        log.push(`${o.nombre} deja de sentir dolor: +${o.anestesia} al próximo tratamiento${h.cuerpo === "anestesia_profunda" ? " y las complicaciones pegan la mitad (duerme sin sobresalto)" : ""}.`);
      } else if (!her) log.push(`${o.nombre} no tiene ninguna herida a la que aplicar el hechizo.`);
      else if (h.cuerpo === "frio") {
        her.enfriada = true;
        if (her.reloj !== undefined) her.reloj += 3;
        if (her.escalada !== undefined) her.escalada += 3;
        log.push(`La herida ${her.id} de ${o.nombre} se entumece y se enfría: gana tres asaltos de hemorragia y +1 al tratamiento.`);
      } else log.push(cauterizarHerida(o, her, "brasa", p.nombre));
    }
    if (o && h.cura) {
      const c = tirar(h.cura);
      const curado = c.total + Math.max(0, mod(valor(p, m.atributo)));
      o.pv = Math.min(pvMaxEfectivo(o), o.pv + curado);
      log.push(`${o.nombre} recupera ${curado} PV (PV ${o.pv}).`);
    }
    if (o && h.cierra_heridas) {
      const her = d.herida ? o.heridas.find((x) => x.id.toLowerCase() === d.herida!.toLowerCase()) : o.heridas[0];
      if (her) {
        for (let i = 0; i < h.cierra_heridas; i++) {
          her.sangrando = false;
          bajarZona(her);
          if (her.gravedad === "leve") {
            o.heridas = o.heridas.filter((x) => x !== her);
            log.push(`La herida ${her.id} de ${o.nombre} se cierra del todo.`);
            break;
          }
          her.gravedad = (["leve", "moderada", "grave"] as const)[["moderada", "grave", "critica"].indexOf(her.gravedad)];
          her.dias_restantes = Math.min(her.dias_restantes, tirar(REGLAS[her.gravedad].dias).total);
        }
        if (o.heridas.includes(her)) log.push(`La herida ${her.id} de ${o.nombre} baja a ${her.gravedad} y deja de sangrar.`);
      }
    }
  } else {
    log.push(pifia ? "La magia se revuelve contra el lanzador." : "El hechizo se deshace entre los dedos.");
  }

  // El precio
  if (circulo > 0) {
    let coste = circulo * (forzado ? 2 : 1) * (pifia ? 2 : 1);
    if (!exito && !pifia) coste = Math.ceil(coste / 2);
    coste = Math.max(0, coste - (af.descuento?.[tributo] ?? 0));
    let aniosPagados = Math.round(aniosDe(circulo, h.escuela) * (af.anios ?? 1) * (forzado ? 2 : 1) * (pifia ? 2 : 1) * 10) / 10;

    // Hechicero: los hechizos de círculo bajo le cuestan menos cuanto más poder tiene (sin catalizador): dos círculos por debajo de su máximo, nada; uno, la mitad.
    if (p.clase === "Hechicero" && !d.catalizador && !forzado) {
      const bajo = max - circulo;
      if (bajo >= 2) { coste = 0; aniosPagados = 0; log.push(`Dominio: ${h.nombre} le sale ya de memoria (dos círculos por debajo de su máximo): no le cuesta nada.`); }
      else if (bajo === 1) { coste = Math.ceil(coste / 2); aniosPagados = Math.round((aniosPagados / 2) * 10) / 10; log.push(`Dominio: ${h.nombre} está un círculo por debajo de su máximo: cuesta la mitad.`); }
    }

    // Catalizador
    if (d.catalizador) {
      const c = buscarCatalizador(d.catalizador);
      const idx = p.inventario.findIndex((x) => c && x.toLowerCase().includes(c.nombre.toLowerCase()));
      if (!c) log.push(`"${d.catalizador}" no es un catalizador conocido.`);
      else if (idx < 0) log.push(`${p.nombre} no lleva ${c.nombre}.`);
      else {
        if (c.tributo === "cualquiera") {
          coste = 0;
          aniosPagados = 0;
        } else if (c.tributo === "anios") aniosPagados = Math.max(0, aniosPagados - c.absorbe);
        else if ((c.tributos ?? [c.tributo]).includes(tributo)) coste = Math.max(0, coste - (c.escala ? 1 + Math.floor(p.nivel / 4) : c.absorbe));
        else log.push(`${c.nombre} no absorbe este precio (${tributo}).`);
        if (c.consumible) p.inventario.splice(idx, 1);
        log.push(`${c.nombre} absorbe parte del precio${c.consumible ? " y se consume" : ""}.`);
      }
    }

    if (coste > 0) {
      if (tributo === "sangre") {
        const pv = tirar(`${coste}d4`).total;
        p.pv = Math.max(0, p.pv - pv);
        log.push(`Precio en sangre: pierde ${pv} PV (PV ${p.pv}).`);
        perderSangre(p, coste * 3, log);
      } else if (tributo !== "anios") {
        m[tributo] += coste;
        log.push(`Precio: +${coste} de ${tributo} (total ${m[tributo]}).`);
        consecuencias(p, tributo, log);
      }
    }
    if (aniosPagados > 0) {
      m.anios_perdidos = Math.round((m.anios_perdidos + aniosPagados) * 10) / 10;
      log.push(`La magia le arranca ${aniosPagados} año(s) de vida (total ${m.anios_perdidos}).`);
      envejecer(p, log);
    }
    if (pifia) reves(p, h.escuela, log);
  }
  return log.join("\n");
}

function consecuencias(p: Personaje, t: "calor" | "aliento" | "cordura", log: string[]) {
  const m = p.magia!;
  const v = m[t];
  const pon = (c: string) => {
    if (!p.condiciones.includes(c)) p.condiciones.push(c);
  };
  if (t === "calor") {
    if (v >= 10) {
      const s = salvacion(p, "con", 15);
      if (!s.exito) {
        marcarMuerto(p);
        log.push(`☠ COMBUSTIÓN: ${s.texto}. ${p.nombre} arde desde dentro y muere.`);
      } else {
        log.push(`${s.texto}: sobrevive a la combustión por un pelo. ` + infligir(p, { causa: "menor", gravedad: "grave", tipo: "quemadura", ubicacion: "torso", descripcion: "se coció por dentro" }));
        m.calor = 6;
      }
    } else if (v >= 7) {
      pon("agotamiento por calor");
      log.push("Fiebre de mago: la piel humea. Agotamiento y quemaduras internas. " + infligir(p, { causa: "menor", gravedad: "leve", tipo: "quemadura", ubicacion: "torso", descripcion: "quemadura por dentro" }));
    } else if (v >= 4) {
      pon("sobrecalentado (desventaja en salvaciones de CON)");
      log.push("Le arde la sangre: sobrecalentado.");
    }
  } else if (t === "aliento") {
    if (v >= 9) {
      p.pv = 0;
      log.push("☠ Se ahoga en tierra firme: 0 PV y salvaciones contra muerte.");
    } else if (v >= 7) {
      pon("inconsciente (sin aire)");
      log.push("Se le va el aire del todo: cae inconsciente 1d4 asaltos.");
    } else if (v >= 5) {
      pon("sin voz (no puede lanzar hechizos 1 minuto)");
      log.push("No le queda aire ni para hablar: sin hechizos durante 1 minuto.");
    } else if (v >= 3) {
      pon("jadeando (desventaja en ataques, no puede correr)");
      log.push("Jadea como un ahogado.");
    }
  } else {
    if (v >= 12) {
      p.secuelas.push("locura de mago: oye a los dioses muertos todo el tiempo; desventaja permanente en SAB");
      m.cordura = 6;
      log.push("☠ La mente se le parte: locura permanente (secuela).");
    } else if (v >= 9) {
      pon(`delirante (ataca al más cercano, ${tirar("1d6").total} asaltos)`);
      log.push("Las voces toman el control: delira.");
    } else if (v >= 6) {
      if (!p.secuelas.some((x) => x.startsWith("pesadillas de mago"))) p.secuelas.push("pesadillas de mago: tras usar magia, SAB CD 12 o no descansa esa noche");
      log.push("Empieza a ver cosas que no están: pesadillas.");
    } else if (v >= 3) {
      pon("oye voces (desventaja en pruebas de SAB)");
      log.push("Oye voces al borde del oído.");
    }
  }
}

export function envejecer(p: Personaje, log: string[]) {
  const m = p.magia!;
  const tramos = Math.floor(m.anios_perdidos / 10);
  for (let i = m.tramos_vejez ?? 0; i < tramos; i++) {
    p.atributos.fue = Math.max(1, p.atributos.fue - 1);
    p.atributos.des = Math.max(1, p.atributos.des - 1);
    log.push("El cuerpo acusa los años: −1 FUE y −1 DES.");
  }
  m.tramos_vejez = tramos;
  p.secuelas = p.secuelas.filter((x) => !x.startsWith("envejecido por la magia"));
  const aspecto = m.anios_perdidos < 5 ? "alguna cana nueva" : m.anios_perdidos < 15 ? "canas y arrugas prematuras" : m.anios_perdidos < 30 ? "pelo blanco y manos de viejo" : "un anciano consumido";
  p.secuelas.push(`envejecido por la magia: ${m.anios_perdidos} años de más (${aspecto})`);
  if (m.anios_perdidos >= 50) {
    const s = salvacion(p, "con", 15);
    if (!s.exito) {
      marcarMuerto(p);
      log.push(`☠ ${s.texto}: el corazón, demasiado viejo, se para. ${p.nombre} muere de vejez.`);
    } else log.push(`${s.texto}: aguanta, pero ya es un anciano.`);
  }
}

function reves(p: Personaje, escuela: Escuela, log: string[]) {
  const efectos: Record<Escuela, string> = {
    elemental: "La llama le estalla en las manos",
    curacion: "La herida se abre en su propia carne",
    necromancia: "La muerte le roza",
    mente: "Su propia mente se vuelve contra él",
    proteccion: "La custodia se cierra a su alrededor y le aplasta",
    sombra: "Su sombra se suelta y le ataca",
    adivinacion: "Ve demasiado",
  };
  const t = tirar("2d6");
  p.pv = Math.max(0, p.pv - t.total);
  log.push(`Revés de la magia: ${efectos[escuela]} (${t.total} de daño, PV ${p.pv}).`);
}

/** Recuperación de calor y aliento con el paso de los asaltos y los días. */
export function enfriar(p: Personaje, asaltos: number) {
  const m = p.magia;
  if (!m) return;
  m.aliento = Math.max(0, m.aliento - Math.floor(asaltos / 3));
  m.calor = Math.max(0, m.calor - Math.floor(asaltos / 5));
  if (m.aliento < 3) p.condiciones = p.condiciones.filter((c) => !/^(jadeando|sin voz|inconsciente \(sin aire\))/.test(c));
  if (m.calor < 4) p.condiciones = p.condiciones.filter((c) => !c.startsWith("sobrecalentado"));
}

export function descansar(p: Personaje, dias: number, calidad: string) {
  const m = p.magia;
  if (!m) return;
  m.calor = 0;
  m.aliento = 0;
  const alivio = calidad === "esfuerzo" ? 0 : calidad === "enfermeria" ? 2 : 1;
  m.cordura = Math.max(0, m.cordura - alivio * dias);
  p.condiciones = p.condiciones.filter((c) => !/^(jadeando|sin voz|inconsciente \(sin aire\)|sobrecalentado|agotamiento por calor|oye voces)/.test(c));
}

export const REGLAS_HECHICERO = `## Hechicero (el sujeto más poderoso posible)
- Escuelas de hechicería: solo los nobles o los ricos entran en ellas; quien nace con el don arcano es la excepción y lo incluyen por fuerza mayor. Cada escuela enseña UN tipo de magia —fuego, rayo, hielo, viento, agua, tierra, oscuridad, luz, curación, protección, mente o adivinación— y todas tienen licencia de la Inquisición; la sombra y la necromancia son magia negra, sin licencia, y quien las practica es un hereje. El Hechicero (guardar_personaje con tipos_magia y linaje) empieza dominando un tipo, y con el nivel domina más: dos desde el 5, tres desde el 9 (aprender_tipo, con un maestro o una escuela). Cuanto más nivel y más círculos domina, más hechizos conoce de sus tipos. Su maestría sube con el nivel: adepto (círculo 2), maestro (5, círculo 3) y archimago (9, círculo 4).
- Comprensión: cualquier Hechicero comprende cómo funciona cada tipo de magia y cada hechizo (comprender_magia), cuánto cuesta y cómo se canaliza, aunque no lo domine: comprender no es poder lanzar. Para lanzar un tipo hay que estudiarlo.
- El don arcano (se tira al crear al personaje; el Hechicero que lo tiene es la excepción de linaje) hace del Hechicero el sujeto más poderoso posible, en potencia desde el primer día y en acto con los niveles: domina TODOS los tipos de magia con las mismas reglas y los mismos precios que los demás, comprende cómo se canaliza cada hechizo solo con verlo (comprender_magia con visto=true: lo aprende al instante hasta el círculo que domina), su maestría llega a ascendido (círculo 5, +8) en el nivel 13 y su INT, a 24. A nivel 13 ninguna criatura, regente, leyenda ni héroe de otra clase lo iguala en poder puro (pueden tener más recursos, aliados o ventaja de terreno, no más poder). Los poderosos lo saben: la Inquisición, la Corte Pálida y los regentes lo temen, lo cazan o intentan atraerlo, aunque sea de nivel 1. El Hechicero de escuela es poderoso pero tiene techo (archimago, tres tipos).
- Dominio de lo menor: sin catalizador, un hechizo dos círculos por debajo de su círculo máximo no le cuesta nada y uno de un círculo por debajo cuesta la mitad. El programa lo aplica solo. Con catalizador no hay descuento (el catalizador ya absorbe el precio).
- Su bastón es catalizador permanente (pásalo en catalizador: «Bastón»): absorbe calor, aliento o cordura (1 + 1 cada 4 niveles); no sirve contra la sangre ni los años de vida.
- Recuperación arcana (usar_recurso): tras un descanso corto recupera calor o aliento gastado igual a la mitad de su nivel; una vez al día (dos desde el nivel 9).`;

export const REGLAS_MAGIA = `## Magia (usa lanzar_hechizo; el programa tira y cobra el precio)
La magia es rara y temida. La Inquisición persigue a los magos sin licencia y la gente corriente no la ha visto nunca. Nunca es gratis: cada hechizo se cobra un tributo en quien lo lanza, mayor cuanto más alto es su círculo (0 = truco gratuito, 5 = prohibido).
- Tributos por escuela: elemental → CALOR (fiebre, quemaduras internas; a 10, combustión); aire y protección → ALIENTO (jadeo, sin voz, asfixia); curación → SANGRE (PV y anemia); mente, sombra y adivinación → CORDURA (voces, pesadillas, delirio, locura); necromancia → AÑOS DE VIDA. Todo hechizo de círculo 4 o 5 cuesta además años de vida. Envejecer resta FUE y DES cada 10 años; con 50 años perdidos el corazón puede pararse.
- El calor y el aliento bajan con unos asaltos de calma y desaparecen al descansar un día; la cordura vuelve despacio con descanso; los años no vuelven nunca.
- Lanzar: d20 + atributo mágico + maestría (+ competencia si es Hechicero) + afinidad de la raza, contra CD 10 + 2 × círculo. Fallo: se paga la mitad. Pifia (1 natural o fallo por 5): precio doble y revés.
- Maestría: profano (no lanza), iniciado (hasta círculo 1), adepto (2), maestro (3), archimago (4), ascendido (5, solo el Hechicero con don arcano a nivel 13+). Forzar un círculo por encima: CD +5 y precio doble. El círculo 5 solo lo intenta un archimago forzando, o lo lanza con soltura un ascendido.
- Catalizadores (en el inventario; pásalo en catalizador): Piedra de brasa (calor), Ámbar de tormenta (aliento), Corazón de cuervo (sangre), Incienso de amapola gris (cordura), Reloj de arena de hueso (años; rarísimo), Diente de dios (todo; reliquia), Báculo de roble petrificado (permanente, −1 de calor) y el bastón del Hechicero (permanente; absorbe calor, aliento o cordura: 1 + un punto cada 4 niveles). Los demás son caros o raros: que cueste conseguirlos.
- Afinidad de las razas: ${Object.entries(AFINIDAD).map(([r, a]) => `${r}: ${a.nota}`).join("; ")}.
- Quién sabe magia: casi nadie. El Hechicero es el único mago de verdad (adepto, un tipo de magia al empezar y hasta tres con el nivel —el del don arcano, todos—, suma su competencia; ver las reglas del Hechicero). Un guerrero solo la usa si nació con el don (el programa lo tira al crear el personaje; por raza: ${Object.entries(DON_ARCANO).map(([r, n]) => `${r} ${n} %`).join(", ")}) o si es de élite y la aprendió en la historia con un maestro, un grimorio o un pacto, tras mucho esfuerzo (modificar_personaje con maestria "iniciado": recibe la magia de su estilo). Estilo de cada clase: ${Object.entries(MAGIA_CLASE).filter(([c]) => c !== "Hechicero").map(([c, x]) => `${c}: ${x.hechizos.join(", ")}`).join("; ")}. Entre los PNJ, igual: los soldados, aldeanos y mercaderes no saben magia; solo algunos veteranos de élite (inquisidores de alto rango, cazadores de brujas curtidos, caballeros de órdenes antiguas) y unos pocos dotados.
- Subir de maestría o aprender hechizos exige maestros, grimorios o pactos, y tiempo (modificar_personaje con maestria, agregar_escuelas o agregar_hechizos).
- Hechizos de referencia por tipo de magia: ${TIPOS_MAGIA.map((t) => `${t.nombre}: ${HECHIZOS.filter((h) => tipoDe(h) === t.id).sort((a, b) => a.circulo - b.circulo).map((h) => `${h.nombre} (${h.circulo})`).join(", ")}`).join(" | ")}. Puedes improvisar otros con hechizo_nuevo, respetando escuela, círculo y precio.
- Los PNJ magos pagan el mismo precio: que se note en la ficción (manos quemadas, labios azules, canas prematuras).`;
