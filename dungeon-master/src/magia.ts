// Magia de Velmora: rara y cara. Cada hechizo se cobra un tributo en el cuerpo
// o la mente de quien lo lanza (calor, aliento, sangre, cordura o años de vida),
// mayor cuanto más alto es su círculo. Los catalizadores absorben ese precio.
import { describir, tirar } from "./dados.js";
import type { Personaje } from "./estado.js";
import { bajarZona, infligir, perderSangre, pvMaxEfectivo, REGLAS } from "./heridas.js";
import { competencia, marcarMuerto, mod, salvacion, signo, valor } from "./reglas.js";

export const ESCUELAS = ["elemental", "curacion", "necromancia", "mente", "proteccion", "sombra", "adivinacion"] as const;
export type Escuela = (typeof ESCUELAS)[number];
export const TRIBUTOS = ["calor", "aliento", "sangre", "cordura", "anios"] as const;
export type Tributo = (typeof TRIBUTOS)[number];
export const MAESTRIAS = ["profano", "iniciado", "adepto", "maestro", "archimago"] as const;
export type Maestria = (typeof MAESTRIAS)[number];

/** Círculo más alto que domina cada maestría y bono a la tirada de lanzamiento. */
const MAESTRIA: Record<Maestria, { circulo: number; bono: number }> = {
  profano: { circulo: -1, bono: 0 },
  iniciado: { circulo: 1, bono: 0 },
  adepto: { circulo: 2, bono: 2 },
  maestro: { circulo: 3, bono: 4 },
  archimago: { circulo: 4, bono: 6 },
};

const TRIBUTO_ESCUELA: Record<Escuela, Tributo> = {
  elemental: "calor",
  curacion: "sangre",
  necromancia: "anios",
  mente: "cordura",
  proteccion: "aliento",
  sombra: "cordura",
  adivinacion: "cordura",
};

export interface Hechizo {
  nombre: string;
  escuela: Escuela;
  circulo: number;
  /** Si no se indica, el de su escuela. */
  tributo?: Tributo;
  efecto: string;
  /** Dados de daño o efecto que el programa tira al lanzarlo. */
  dados?: string;
  /** Dados de curación que se aplican al objetivo. */
  cura?: string;
  /** Niveles de gravedad que baja en una herida del objetivo. */
  cierra_heridas?: number;
  /** Salvación que hacen los objetivos (CD = la del lanzador). */
  salvacion?: string;
}

export const HECHIZOS: Hechizo[] = [
  // Elemental
  { nombre: "Chispa", escuela: "elemental", circulo: 0, efecto: "Enciende una llama pequeña, calienta las manos o hace 1d6 de fuego a un objetivo", dados: "1d6" },
  { nombre: "Sangre hirviente", escuela: "elemental", circulo: 1, efecto: "Durante 1 minuto, los golpes del lanzador hacen +1d6 de fuego" },
  { nombre: "Saeta de fuego", escuela: "elemental", circulo: 1, efecto: "Ataque de hechizo a distancia (36 m): 2d10 de fuego", dados: "2d10" },
  { nombre: "Ráfaga", escuela: "elemental", circulo: 1, tributo: "aliento", efecto: "Un cono de viento de 4,5 m empuja 3 m y derriba", salvacion: "FUE" },
  { nombre: "Asfixiar", escuela: "elemental", circulo: 3, tributo: "aliento", efecto: "Le roba el aire a un objetivo: sin respirar 1 minuto (repite la salvación cada asalto)", salvacion: "CON" },
  { nombre: "Bola de fuego", escuela: "elemental", circulo: 3, efecto: "Esfera de 6 m de radio: 8d6 de fuego, mitad si supera la salvación", dados: "8d6", salvacion: "DES" },
  { nombre: "Cadena de relámpagos", escuela: "elemental", circulo: 4, efecto: "Un rayo salta entre hasta 4 objetivos: 10d8 de relámpago, mitad si supera", dados: "10d8", salvacion: "DES" },
  { nombre: "Tormenta de ceniza", escuela: "elemental", circulo: 5, efecto: "Una tormenta de fuego y ceniza de 30 m durante 1 minuto: 12d6 por asalto", dados: "12d6", salvacion: "DES" },
  // Curación
  { nombre: "Cerrar la carne", escuela: "curacion", circulo: 1, efecto: "Toque: el objetivo recupera 2d8 + mod. del lanzador PV", cura: "2d8" },
  { nombre: "Sutura arcana", escuela: "curacion", circulo: 2, efecto: "Toque: baja una herida un nivel de gravedad y detiene su hemorragia", cierra_heridas: 1 },
  { nombre: "Restaurar", escuela: "curacion", circulo: 3, efecto: "Toque: baja una herida dos niveles y el objetivo recupera 4d8 PV", cierra_heridas: 2, cura: "4d8" },
  { nombre: "Devolver el aliento", escuela: "curacion", circulo: 5, efecto: "Devuelve a la vida a alguien muerto hace menos de un minuto, con 1 PV" },
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
  { nombre: "Piel de hierro", escuela: "proteccion", circulo: 1, efecto: "+2 a la CA del lanzador o de un aliado durante 10 minutos" },
  { nombre: "Escudo de sal", escuela: "proteccion", circulo: 2, efecto: "Durante 1 minuto, los no-muertos no pueden tocar al objetivo sin superar SAB" },
  { nombre: "Círculo de custodia", escuela: "proteccion", circulo: 3, efecto: "Un círculo de 6 m que ninguna criatura hostil puede cruzar durante 10 minutos", salvacion: "CAR" },
  { nombre: "Muro de fe", escuela: "proteccion", circulo: 4, efecto: "Un muro de luz gris de 18 m, infranqueable durante 10 minutos" },
  // Sombra
  { nombre: "Paso de sombra", escuela: "sombra", circulo: 1, efecto: "Se teletransporta hasta 9 m de una sombra a otra" },
  { nombre: "Manto de noche", escuela: "sombra", circulo: 2, efecto: "Invisible en penumbra u oscuridad durante 10 minutos" },
  { nombre: "Robar la sombra", escuela: "sombra", circulo: 3, efecto: "Arranca la sombra de un objetivo: queda aturdido y con desventaja 1 minuto", salvacion: "CAR" },
  { nombre: "Puerta negra", escuela: "sombra", circulo: 5, efecto: "Abre un paso entre dos sombras cualesquiera de Velmora durante 1 minuto" },
  // Adivinación
  { nombre: "Ojo de bruja", escuela: "adivinacion", circulo: 1, efecto: "Durante 10 minutos ve magia, no-muertos y malditos a 9 m" },
  { nombre: "Leer el rastro", escuela: "adivinacion", circulo: 1, efecto: "Sabe quién pasó por aquí en las últimas 24 horas y hacia dónde" },
  { nombre: "Hablar con los muertos", escuela: "adivinacion", circulo: 2, efecto: "Un cadáver responde a tres preguntas, con lo que sabía en vida" },
  { nombre: "Visión del mañana", escuela: "adivinacion", circulo: 3, efecto: "Ve un instante del futuro: tira un d20 y guárdalo; puede sustituir una tirada propia o de un aliado hoy", dados: "1d20" },
];

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
  "Berserker de Ceniza": { maestria: "iniciado", escuelas: ["elemental"], hechizos: ["Sangre hirviente"], atributo: "car" },
  "Caballero Juramentado": { maestria: "iniciado", escuelas: ["curacion", "proteccion"], hechizos: ["Cerrar la carne", "Escudo de sal"], atributo: "car" },
  "Cazador de Brujas": { maestria: "iniciado", escuelas: ["adivinacion"], hechizos: ["Ojo de bruja", "Leer el rastro"], atributo: "sab" },
  Degollador: { maestria: "iniciado", escuelas: ["sombra"], hechizos: ["Paso de sombra"], atributo: "int" },
  Flagelante: { maestria: "iniciado", escuelas: ["mente"], hechizos: ["Susurro"], atributo: "sab" },
  Segador: { maestria: "adepto", escuelas: ["necromancia"], hechizos: ["Toque de la tumba", "Drenar vida"], atributo: "car" },
  "Barbero-Cirujano": { maestria: "iniciado", escuelas: ["curacion"], hechizos: ["Cerrar la carne"], atributo: "sab" },
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
}

export function magiaInicial(clase: string, escuelasElegidas?: Escuela[]): MagiaPersonaje {
  const base = MAGIA_CLASE[clase] ?? { maestria: "profano" as Maestria, escuelas: [], hechizos: [], atributo: "int" as const };
  const escuelas = clase === "Hechicero" ? (escuelasElegidas?.length ? escuelasElegidas.slice(0, 2) : ["elemental", "mente"] as Escuela[]) : base.escuelas;
  const hechizos =
    clase === "Hechicero"
      ? HECHIZOS.filter((h) => escuelas.includes(h.escuela) && h.circulo <= 1).map((h) => h.nombre)
      : base.hechizos;
  return { maestria: base.maestria, escuelas, hechizos, atributo: base.atributo, calor: 0, aliento: 0, cordura: 0, anios_perdidos: 0, tramos_vejez: 0 };
}

export function textoMagia(m: MagiaPersonaje | undefined): string {
  if (!m || m.maestria === "profano") return "";
  const tributos = [m.calor && `calor ${m.calor}`, m.aliento && `aliento ${m.aliento}`, m.cordura && `cordura ${m.cordura}`, m.anios_perdidos && `${m.anios_perdidos} años perdidos`]
    .filter(Boolean)
    .join(" · ");
  return `  Magia: ${m.maestria} (${m.escuelas.join(", ")}) · ${m.hechizos.join(", ") || "sin hechizos"}${tributos ? `\n  Tributos: ${tributos}` : ""}`;
}

// ---------------------------------------------------------------- catalizadores

export interface Catalizador {
  nombre: string;
  tributo: Tributo | "cualquiera";
  /** Puntos que absorbe por hechizo (años en el caso de años; 99 = todo). */
  absorbe: number;
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
  if (!m || m.maestria === "profano") return `${p.nombre} no sabe magia: necesita un maestro, un grimorio o un objeto que la contenga.`;
  const h = d.hechizo_nuevo ?? (d.hechizo ? buscarHechizo(d.hechizo) : undefined);
  if (!h) throw new Error(`No conozco el hechizo "${d.hechizo}". Usa uno de la lista (consultar_reglas magia) o descríbelo con hechizo_nuevo.`);
  if (!m.escuelas.includes(h.escuela)) throw new Error(`${p.nombre} no domina la escuela de ${h.escuela} (domina: ${m.escuelas.join(", ") || "ninguna"}).`);
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
        else if (c.tributo === tributo) coste = Math.max(0, coste - c.absorbe);
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

function envejecer(p: Personaje, log: string[]) {
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

export const REGLAS_MAGIA = `## Magia (usa lanzar_hechizo; el programa tira y cobra el precio)
La magia es rara y temida. La Inquisición persigue a los magos sin licencia y la gente corriente no la ha visto nunca. Nunca es gratis: cada hechizo se cobra un tributo en quien lo lanza, mayor cuanto más alto es su círculo (0 = truco gratuito, 5 = prohibido).
- Tributos por escuela: elemental → CALOR (fiebre, quemaduras internas; a 10, combustión); aire y protección → ALIENTO (jadeo, sin voz, asfixia); curación → SANGRE (PV y anemia); mente, sombra y adivinación → CORDURA (voces, pesadillas, delirio, locura); necromancia → AÑOS DE VIDA. Todo hechizo de círculo 4 o 5 cuesta además años de vida. Envejecer resta FUE y DES cada 10 años; con 50 años perdidos el corazón puede pararse.
- El calor y el aliento bajan con unos asaltos de calma y desaparecen al descansar un día; la cordura vuelve despacio con descanso; los años no vuelven nunca.
- Lanzar: d20 + atributo mágico + maestría (+ competencia si es Hechicero) + afinidad de la raza, contra CD 10 + 2 × círculo. Fallo: se paga la mitad. Pifia (1 natural o fallo por 5): precio doble y revés.
- Maestría: profano (no lanza), iniciado (hasta círculo 1), adepto (2), maestro (3), archimago (4). Forzar un círculo por encima: CD +5 y precio doble. El círculo 5 solo lo intenta un archimago forzando.
- Catalizadores (en el inventario; pásalo en catalizador): Piedra de brasa (calor), Ámbar de tormenta (aliento), Corazón de cuervo (sangre), Incienso de amapola gris (cordura), Reloj de arena de hueso (años; rarísimo), Diente de dios (todo; reliquia), Báculo de roble petrificado (permanente, −1 de calor). Son caros o raros: que cueste conseguirlos.
- Afinidad de las razas: ${Object.entries(AFINIDAD).map(([r, a]) => `${r}: ${a.nota}`).join("; ")}.
- Clases: el Hechicero es el único mago de verdad (adepto, dos escuelas a elegir, suma su competencia). Los guerreros saben uno o dos hechizos de iniciado acordes a su estilo: ${Object.entries(MAGIA_CLASE).filter(([c]) => c !== "Hechicero").map(([c, x]) => `${c}: ${x.hechizos.join(", ")}`).join("; ")}.
- Subir de maestría o aprender hechizos exige maestros, grimorios o pactos, y tiempo (modificar_personaje con maestria, agregar_escuelas o agregar_hechizos).
- Hechizos de referencia: ${ESCUELAS.map((e) => `${e}: ${HECHIZOS.filter((h) => h.escuela === e).map((h) => `${h.nombre} (${h.circulo})`).join(", ")}`).join(" | ")}. Puedes improvisar otros con hechizo_nuevo, respetando escuela, círculo y precio.
- Los PNJ magos pagan el mismo precio: que se note en la ficción (manos quemadas, labios azules, canas prematuras).`;
