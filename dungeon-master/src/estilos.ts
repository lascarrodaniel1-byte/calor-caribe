// Artes marciales de Velmora: siete estilos (seis de escuela y el de Kuru). Ver docs/ARTES_MARCIALES.md.
// Un estilo es una tradición con un principio pasivo y tres técnicas (Iniciado, Practicante, Maestro).
// El Haemajitsu (Flagelante) y Contracorriente (Kuru) son especiales; el resto se aprende con un maestro o por la clase.
import type { Partida, Personaje } from "./estado.js";
import type { DatosAtaque } from "./combate.js";
import { artesDe, dadoHaemajitsu, maestria, NOMBRE_MAESTRIA } from "./estilos_base.js";
import { mod, signo, valor } from "./reglas.js";

export interface Tecnica { nombre: string; efecto: string }
export interface Estilo {
  id: string;
  nombre: string;
  centro: string;
  principio: string;
  tecnicas: [Tecnica, Tecnica, Tecnica];
  ensena: string;
  /** Clases que pueden tomarlo como rasgo de clase (sin maestro). */
  clases: string[];
  /** Solo se aprende si la historia lo justifica (con motivo). */
  soloHistoria?: boolean;
}

export const ESTILOS: Estilo[] = [
  {
    id: "haemajitsu", nombre: "Haemajitsu", centro: "impacto y dureza",
    principio: "Sangre propia acumulada en los puntos de contacto y liberada a gran velocidad: sus golpes sin armas pegan como una maza (daño por nivel, contundentes y brutales) y sus manos no se rompen. Pasivo, sin coste en PV: es su forma de pelear.",
    tecnicas: [
      { nombre: "Puño de Haema", efecto: "golpe que agrava la herida como una maza (pasivo, siempre activo)" },
      { nombre: "Fluir", efecto: "reacción (solo cuerpo a cuerpo): la sangre acude al punto del golpe y reduce su daño en un dado de Haemajitsu + mod. CON, mínimo 1 (automático)" },
      { nombre: "Corriente carmesí", efecto: "sus golpes se resuelven como un martillo de guerra: rompen la guardia, penetran y agravan la herida más hondo que una maza (automático)" },
    ],
    ensena: "Los Flagelantes de Haema", clases: ["Flagelante"], soloHistoria: true,
  },
  {
    id: "callejon", nombre: "Callejón de Aldenmar", centro: "control y juego sucio",
    principio: "Aprovecha lo que haya a mano y el momento: ventaja en las maniobras (agarrar, empujar, lanzar) contra un rival derribado, cegado, aturdido, agarrado, asustado, dormido, sorprendido, desarmado o incapacitado (automático).",
    tecnicas: [
      { nombre: "Llave y zancadilla", efecto: "ventaja al agarrar o derribar a un rival distraído (ver principio) (automático)" },
      { nombre: "Arena y codo", efecto: "maniobra {tipo: sucio}: salvación de CON (CD 8 + competencia + mejor de Atletismo o Acrobacias) o queda cegado hasta el final de su siguiente turno (automático)" },
      { nombre: "Arrastre", efecto: "si tiene agarrado a alguien, los ataques a distancia contra él se los lleva el agarrado (automático)" },
    ],
    ensena: "Los bajos fondos de Aldenmar (Degolladores, tabernas)", clases: ["Degollador", "Cazador de Brujas"],
  },
  {
    id: "piedra", nombre: "Piedra de Karak", centro: "resistencia y anclaje",
    principio: "Pies clavados: ventaja en las pruebas para no ser empujado ni lanzado (automático).",
    tecnicas: [
      { nombre: "Postura de muro", efecto: "+1 a la CA contra ataques cuerpo a cuerpo mientras no haya corrido ni se haya retirado este asalto (automático)" },
      { nombre: "Golpe de yunque", efecto: "atacar con yunque: true; el golpe aplasta la armadura (se resuelve como un martillo de guerra: penetra y agrava la herida) (automático)" },
      { nombre: "Montaña", efecto: "inmóvil: nadie puede empujarlo ni lanzarlo, ni derribarlo con una maniobra (automático)" },
    ],
    ensena: "Los enanos de Karak-Dûm", clases: ["Berserker de Ceniza", "Caballero Juramentado"],
  },
  {
    id: "danza", nombre: "Danza marchita", centro: "evasión y contragolpe",
    principio: "Siglos de reflejos: +2 a la iniciativa (automático) y mueve el cuerpo antes que el golpe.",
    tecnicas: [
      { nombre: "Paso de hoja", efecto: "esquiva: ventaja en las salvaciones de DES (automático)" },
      { nombre: "Contragolpe", efecto: "reacción: cuando un ataque cuerpo a cuerpo le falla, el programa avisa del ataque de respuesta (atacar con reaccion: true) y gasta su reacción (automático)" },
      { nombre: "Cien pasos", efecto: "se mueve sin provocar ataques de oportunidad (automático)" },
    ],
    ensena: "Los Elfos Marchitos", clases: ["Cazador de Brujas"],
  },
  {
    id: "cuervo", nombre: "Filo del Cuervo", centro: "armas y formación",
    principio: "Combate con lo que empuña y con quien tiene al lado: cada aliado junto al objetivo (a 1,5 m, en el plano) le da +1 al ataque cuerpo a cuerpo, máximo +2 (automático).",
    tecnicas: [
      { nombre: "Desarmar", efecto: "atacar con desarmar: true; si impacta, el rival salva (la mejor de FUE o DES) o suelta el arma (automático)" },
      { nombre: "Cuña", efecto: "ventaja en el ataque si hay un aliado junto al objetivo (automático)" },
      { nombre: "Muralla de cuervos", efecto: "reacción: si golpean cuerpo a cuerpo a un aliado a 1,5 m de él y del atacante, recibe él el golpe y el atacante tiene desventaja (automático)" },
    ],
    ensena: "La Compañía del Cuervo Negro", clases: ["Mercenario del Cuervo", "Caballero Juramentado"],
  },
  {
    id: "presa", nombre: "Presa de Hollín", centro: "agarres, llaves y lances",
    principio: "Quien agarra no suelta (automático): ventaja al agarrar y al lanzar, y quien intenta zafarse de él tiene que ganarle con desventaja. Mantener la presa no le cuesta la mano. Es el estilo «abierto»: lo puede tomar cualquier clase marcial.",
    tecnicas: [
      { nombre: "Llave y Cadera", efecto: "Llave: agarra como acción adicional (maniobra {tipo: agarrar, adicional: true}) (automático); Cadera: derriba a quien tiene agarrado (maniobra lanzar, lance cadera) (automático)" },
      { nombre: "Palanca y Lance por encima del hombro", efecto: "Palanca (maniobra {tipo: palanca} sobre un agarrado, Practicante): disloca un miembro (brazo entumecido: desventaja en ataques y pruebas) (automático); Lance por encima del hombro: lo estampa en el suelo (1d6 y derribado) o contra otro enemigo a 1,5 m (maniobra lanzar, lance hombro)" },
      { nombre: "Sumisión y Lance de molino", efecto: "Sumisión (maniobra {tipo: sumision} sobre un agarrado, Maestro): queda «sometido» (velocidad 0, desventaja en ataques y pruebas, también para zafarse) (automático); Lance de molino: lo arroja hasta 3 m (2d6 y derribado, maniobra lanzar, lance molino)" },
    ],
    ensena: "Barqueros y ladrones de cadáveres de Hollín, y los fosos de lucha de Aldenmar",
    clases: ["Mercenario del Cuervo", "Berserker de Ceniza", "Degollador", "Cazador de Brujas", "Caballero Juramentado", "Flagelante"],
  },
  {
    id: "contracorriente", nombre: "Contracorriente", centro: "desviar y contraatacar",
    principio: "El estilo único de Kuru: una vez por asalto, cuando un ataque (proyectil, arma o golpe) le va a alcanzar, lo desvía y reduce el daño; si lo desvía del todo, contraataca en la misma reacción.",
    tecnicas: [
      { nombre: "Desvío", efecto: "reduce el daño de un proyectil, arma o golpe; con un proyectil pequeño puede devolverlo" },
      { nombre: "Contracorriente", efecto: "si el desvío anula el daño, ataque de respuesta con ventaja (reacción)" },
      { nombre: "Remolino", efecto: "varios rivales a la vez: desvía y contraataca a cada uno una vez por asalto, sin gastar la única reacción (automático)" },
    ],
    ensena: "Solo Kuru, el Cazador de Leyendas (y si la historia lo justifica)", clases: [], soloHistoria: true,
  },
];

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
export function buscarEstilo(n: string): Estilo | undefined {
  const x = norm(n);
  if (!x) return undefined;
  return ESTILOS.find((e) => e.id === x || norm(e.nombre) === x) ?? ESTILOS.find((e) => norm(e.nombre).includes(x) || x.includes(e.id));
}

export { artesDe, dadoHaemajitsu, tieneArte, maestria, NOMBRE_MAESTRIA, arteDeCombatiente, maestriaDe } from "./estilos_base.js";

/** Cuántos estilos puede conocer: uno; dos con INT o SAB 14+ y un segundo maestro. */
export const cupoDeArtes = (p: Personaje, segundoMaestro: boolean) => 1 + (segundoMaestro && (valor(p, "int") >= 14 || valor(p, "sab") >= 14) ? 1 : 0);

// ------------------------------------------------------------------ Haemajitsu: golpes sin armas del Flagelante
const SIN_ARMAS = /^(pu[ñn]os?|sin armas?|desarmad[oa]|golpes?|pu[ñn]etazos?|patadas?|codazos?|rodillazos?|haemajitsu|pu[ñn]o de haema)$/i;

/** Antes de atacar: el golpe sin armas de un Flagelante es siempre un golpe de Haemajitsu (maza: contundente y brutal). */
export function haemajitsu(partida: Partida, e: DatosAtaque): { e: DatosAtaque; nota?: string } {
  const p = Object.values(partida.personajes).find((x) => norm(x.nombre) === norm(e.atacante));
  if (!p || p.clase !== "Flagelante" || e.a_distancia) return { e };
  const sinArma = !e.arma && !e.dano && !p.manos?.principal;
  if (!sinArma && !(e.arma && SIN_ARMAS.test(e.arma.trim()))) return { e };
  const attr = e.atributo ?? (valor(p, "des") > valor(p, "fue") ? "des" : "fue");
  const dado = dadoHaemajitsu(p);
  return {
    e: { ...e, arma: maestria(p) >= 3 ? "puño de Haema (corriente carmesí, como un martillo de guerra)" : "puño de Haema (como una maza)", dano: `${dado}${signo(mod(valor(p, attr)))}`, tipo_dano: "contundente", atributo: attr },
    nota: `🩸 Haemajitsu: la sangre de ${p.nombre} se agolpa en el puño y el golpe pega como una maza (${dado}${signo(mod(valor(p, attr)))} contundente; hiere más hondo)${maestria(p) >= 3 ? "; Corriente carmesí: rompe la guardia y aplasta la armadura como un martillo" : ""}.`,
  };
}

// ------------------------------------------------------------------ texto para la ficha y el DM
export function textoArtes(p: Personaje): string {
  const ids = artesDe(p);
  if (!ids.length) return "";
  const m = maestria(p);
  return ids.map((id) => {
    const e = ESTILOS.find((x) => x.id === id);
    if (!e) return `  🥋 Estilo: ${id}`;
    const tec = e.tecnicas.slice(0, m).map((t) => t.nombre).join(", ");
    return `  🥋 ${e.nombre} (${NOMBRE_MAESTRIA[m]}): ${e.principio.split(".")[0]}. Técnicas: ${tec}.`;
  }).join("\n");
}

/** El catálogo público de /artes; si se da un personaje, añade sus estilos y las técnicas que ya tiene. */
export function textoCatalogoArtes(propios: Personaje[] = []): string {
  const cat = ESTILOS.map((e) => `- ${e.nombre} · ${e.centro}\n  Principio: ${e.principio}\n  Lo enseña: ${e.ensena}\n  Clases que lo ofrecen: ${e.clases.length ? e.clases.join(", ") : "ninguna (solo por la historia)"}${e.soloHistoria && e.clases.length ? " (a los demás solo por la historia)" : ""}.`).join("\n");
  const mios = propios.map((p) => {
    const ids = artesDe(p);
    if (!ids.length) return `${p.nombre}: aún no conoce ningún estilo.`;
    return `${p.nombre}:\n` + ids.map((id) => {
      const e = ESTILOS.find((x) => x.id === id);
      if (!e) return `  · ${id}`;
      const m = maestria(p);
      return `  · ${e.nombre} (${NOMBRE_MAESTRIA[m]}): ${e.tecnicas.slice(0, m).map((t) => t.nombre).join(", ")}`;
    }).join("\n");
  });
  return `Artes marciales de Velmora (siete estilos; un personaje conoce uno):\n${cat}${mios.length ? `\n\nTus estilos:\n${mios.join("\n")}` : ""}`;
}

export const REGLAS_ARTES = `## Artes marciales (estilos)
- Hay siete estilos: Haemajitsu (Flagelantes: impacto), Callejón de Aldenmar (control y juego sucio), Piedra de Karak (resistencia), Danza marchita (evasión), Filo del Cuervo (armas y formación), Presa de Hollín (agarres, llaves y lances) y Contracorriente (solo Kuru: desviar y contraatacar). Un personaje conoce un estilo (dos con INT o SAB 14+ y un segundo maestro). Cada estilo tiene un principio pasivo y tres técnicas (Iniciado, Practicante a nivel 3 y Maestro a nivel 7 de la tabla, con el desplazamiento de +2 de siempre). Consulta lo que sabe cada uno con arte_marcial {accion: "ver"} y el catálogo con {accion: "catalogo"}.
- Se aprenden con arte_marcial {accion: "aprender", via}: «clase» (la clase lo ofrece: ver el catálogo), «maestro» (hay un maestro del estilo y pasa tiempo: pasa maestro y motivo) o «historia» (la ficción lo justifica; pasa motivo). Haemajitsu y Contracorriente solo por historia. El Flagelante lleva el Haemajitsu de serie.
- Haemajitsu (pasivo, lo aplica el programa): el golpe sin armas del Flagelante (atacar con arma «puño», sin armas…) es una maza: daño por nivel (1d6, luego 1d8, 1d10, 1d12), contundente y brutal, más la Comunión del dolor. No gasta PV ni recurso: es la sangre propia que fluye por sus puntos de contacto. Es la lógica del arte, no un bonus nuevo.
- Presa de Hollín: el programa da ventaja al agarrar y al lanzar a quien lo practica, y a su favor cuando alguien intenta zafarse. Lances con la herramienta maniobra {tipo: lanzar, lance: cadera | hombro | molino} sobre alguien que ya tiene agarrado: cadera (Iniciado) lo derriba; hombro (Practicante) lo estampa (1d6) y puede lanzarlo contra otro enemigo cercano (contra); molino (Maestro) lo arroja 3 m (2d6). Piedra de Karak (automático): ventaja contra empujar y lanzar, Postura de muro (+1 CA en cuerpo a cuerpo), Golpe de yunque (atacar {yunque: true}, Practicante) y Montaña (Maestro: no lo empujan ni lo lanzan).
- Contracorriente: reacción automática de quien lo domina (Kuru): reduce el daño que le llega; si lo anula, avisa del contraataque que debes hacer tú (atacar con reaccion: true y ventaja: true).
- Kuru domina todos los estilos normales y copia al verlos: si ve usar una técnica, la puede usar en su turno siguiente; tras verla dos veces en el mismo combate, la conserva hasta el final. No copia el Haemajitsu a la ligera (es sangre propia de Haema).
- Danza marchita (automático): +2 a la iniciativa, ventaja en salvaciones de DES, Contragolpe (avisa del ataque de respuesta si le falla un cuerpo a cuerpo) y, de Maestro, Cien pasos (no provoca ataques de oportunidad). Filo del Cuervo (automático): +1 por aliado junto al objetivo (máx. +2), Cuña (ventaja con un aliado junto) y atacar {desarmar: true}. Callejón de Aldenmar (automático): ventaja en maniobras contra rivales distraídos y maniobra {tipo: sucio} (arena y codo, desde Practicante).
- Presa de Hollín, sobre quien ya tiene agarrado: maniobra {tipo: palanca} (Practicante: brazo dislocado) y {tipo: sumision} (Maestro: «sometido»). Haemajitsu: Fluir (reacción que reduce el daño cuerpo a cuerpo) y Corriente carmesí (Maestro: sus golpes cuentan como un martillo). Filo del Cuervo, Muralla de cuervos (Maestro, reacción automática de cobertura a un aliado adyacente) y Callejón, Arrastre (Maestro, escudo humano contra ataques a distancia). Ya no queda ninguna técnica sin automatizar.`;

// ------------------------------------------------------------------ la herramienta arte_marcial
export interface DatosArte {
  quien?: string;
  accion: "catalogo" | "ver" | "aprender";
  arte?: string;
  via?: "clase" | "maestro" | "historia";
  maestro?: string;
  motivo?: string;
  /** aprender: es un segundo estilo (necesita un segundo maestro e INT o SAB 14+). */
  segundo?: boolean;
}

export function arteMarcial(partida: Partida, d: DatosArte): string {
  if (d.accion === "catalogo") {
    return ESTILOS.map((e) => `- ${e.nombre} (${e.centro}). Enseña: ${e.ensena}. Clases: ${e.clases.length ? e.clases.join(", ") : "ninguna"}${e.soloHistoria ? " · solo si la historia lo justifica" : ""}.\n  Principio: ${e.principio}\n  Técnicas: ${e.tecnicas.map((t, i) => `${NOMBRE_MAESTRIA[i + 1]}: ${t.nombre} — ${t.efecto}`).join(" | ")}`).join("\n");
  }
  if (!d.quien) throw new Error("Di quién (quien).");
  const p = Object.values(partida.personajes).find((x) => norm(x.nombre) === norm(d.quien!) || (x.jugador && norm(x.jugador) === norm(d.quien!)));
  if (!p) throw new Error(`No hay ningún personaje llamado «${d.quien}».`);
  if (d.accion === "ver") return textoArtes(p) || `${p.nombre} no conoce ningún estilo de artes marciales todavía.`;
  const e = d.arte ? buscarEstilo(d.arte) : undefined;
  if (!e) throw new Error(`Estilo desconocido «${d.arte ?? ""}». Elige entre: ${ESTILOS.map((x) => x.nombre).join(", ")}.`);
  if (artesDe(p).includes(e.id)) return `${p.nombre} ya conoce ${e.nombre}.`;
  const via = d.via ?? "clase";
  if (via === "clase") {
    if (e.soloHistoria || !e.clases.includes(p.clase)) throw new Error(`La clase ${p.clase} no ofrece ${e.nombre}${e.soloHistoria ? " (solo se aprende si la historia lo justifica: via «historia» con motivo)" : `; sus estilos son: ${ESTILOS.filter((x) => !x.soloHistoria && x.clases.includes(p.clase)).map((x) => x.nombre).join(", ") || "ninguno"}`}.`);
  } else if (via === "maestro") {
    if (e.soloHistoria) throw new Error(`${e.nombre} no se aprende con un maestro corriente: solo si la historia lo justifica (via «historia» con motivo).`);
    if (!d.maestro || !d.motivo) throw new Error("Con un maestro pasa quién es (maestro) y qué tiempo y esfuerzo ha costado (motivo).");
  } else if (!d.motivo || d.motivo.trim().length < 10) throw new Error("Por historia pasa el motivo (cómo y por qué lo aprende) en una frase.");
  const cupo = cupoDeArtes(p, !!d.segundo && !!d.maestro);
  if (artesDe(p).length >= cupo) throw new Error(`${p.nombre} ya conoce ${artesDe(p).length} estilo(s): solo puede conocer ${cupo}${cupo === 1 ? " (un segundo estilo exige un segundo maestro, segundo: true, e INT o SAB 14+)" : ""}.`);
  (p.artes ??= []).push(e.id);
  const m = maestria(p);
  return `${p.nombre} aprende ${e.nombre} (${via === "clase" ? `por su clase, ${p.clase}` : via === "maestro" ? `con ${d.maestro}: ${d.motivo}` : d.motivo}). Nivel de maestría: ${NOMBRE_MAESTRIA[m]}. ${e.principio}${e.id === "haemajitsu" ? " Paga con su propia sangre (sin coste de PV)." : ""}`;
}
