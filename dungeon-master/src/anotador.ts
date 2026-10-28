// El anotador: un cronista que trabaja en segundo plano mientras el DM narra. Lee lo que pasa (acciones de los jugadores,
// narración y resultados del motor) y lleva el registro fiel de la historia: capítulos, situación actual, detalles menores,
// personajes no jugadores, hilos abiertos y avisos de continuidad. El DM recibe ese registro en cada turno, así que no tiene
// que acordarse de nada: solo narrar. Esta parte es pura (sin red ni navegador): quien llama le pasa la función que consulta al modelo.

export interface Libreta {
  /** Situación actual de la aventura. */
  diario: string;
  /** Capítulos ya vividos, en orden (solo se añaden; los más viejos se funden). */
  anales: string[];
  /** Detalles menores: nombres, precios, objetos, aspecto, frases. */
  detalles: string[];
  /** Personajes no jugadores: una línea por PNJ, que empieza por su nombre y dos puntos. */
  pnj: string[];
  /** Hilos abiertos: misterios, promesas, deudas, amenazas, encargos sin resolver. */
  hilos: string[];
  /** Cosas que el DM debe respetar o corregir para no contradecirse (se reescribe en cada pasada). */
  continuidad: string[];
  /** ts del último turno ya anotado. */
  hasta: number;
}

export type Consulta = (prompt: string, opciones: { modelTier: "quick"; cache: false }) => Promise<{ text?: string }>;

export const LIMITE_DIARIO = 3200;
export const LIMITE_CAPITULO = 700;
export const LIMITE_ANALES = 6000;
export const LIMITE_DETALLES = 120;
export const MAX_PNJ = 40;
export const MAX_HILOS = 20;
export const MAX_CONTINUIDAD = 3;
/** Se anota cuando hay más de estos turnos sin anotar; los últimos QUEDAN siguen enteros en el prompt del DM. */
export const TURNOS_SIN_ANOTAR = 5;
export const TURNOS_QUE_QUEDAN = 2;

export const libretaVacia = (): Libreta => ({ diario: "", anales: [], detalles: [], pnj: [], hilos: [], continuidad: [], hasta: 0 });

/** Normaliza lo que viene de la base de datos (partidas antiguas sin PNJ ni hilos). */
export function aLibreta(m: unknown): Libreta {
  const x = (m ?? {}) as Record<string, unknown>;
  const lista = (v: unknown) => (Array.isArray(v) ? v.map(String) : []);
  return { diario: String(x.diario ?? ""), anales: lista(x.anales), detalles: lista(x.detalles), pnj: lista(x.pnj), hilos: lista(x.hilos), continuidad: lista(x.continuidad), hasta: Number(x.compactado_hasta ?? x.hasta ?? 0) };
}

/** Lo que se guarda en la base de datos (conserva los nombres de campo de siempre). */
export const aDocumento = (l: Libreta) => ({ diario: l.diario, anales: l.anales, detalles: l.detalles, pnj: l.pnj, hilos: l.hilos, continuidad: l.continuidad, compactado_hasta: l.hasta });

export const hayLibreta = (l: Libreta) => !!(l.diario || l.anales.length || l.detalles.length || l.pnj.length || l.hilos.length || l.hasta);

const sinTildes = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

export interface Partes { capitulo: string; situacion: string; detalles: string[]; obsoletos: string[]; pnj: string[]; hilos: string[]; continuidad: string[] }

/** Divide la respuesta del anotador en sus secciones («=== NOMBRE ==='); sin marcas, todo es la situación. */
export function partirSecciones(txt: string): Partes {
  const trozos: Record<string, string[]> = {};
  let actual: string | null = null;
  for (const linea of String(txt).split("\n")) {
    const m = /^\s*===\s*([^=]+?)\s*===\s*$/.exec(linea);
    if (m) { actual = sinTildes(m[1]).toUpperCase(); trozos[actual] = []; continue; }
    if (actual) trozos[actual].push(linea);
  }
  if (!Object.keys(trozos).length) return { capitulo: "", situacion: String(txt).trim(), detalles: [], obsoletos: [], pnj: [], hilos: [], continuidad: [] };
  const lista = (k: string) => (trozos[k] || []).map((x) => x.replace(/^\s*[-•*]\s*/, "").trim()).filter((x) => x.length > 3);
  return { capitulo: (trozos.CAPITULO || []).join("\n").trim(), situacion: (trozos.SITUACION || []).join("\n").trim(), detalles: lista("DETALLES"), obsoletos: lista("OBSOLETOS"), pnj: lista("PNJ"), hilos: lista("HILOS"), continuidad: lista("CONTINUIDAD") };
}

/** ¿Hablan de lo mismo? Igual, o uno contiene al otro (ambos largos), o comparten casi todas sus palabras. */
export function mismoAsunto(a: string, b: string): boolean {
  const x = sinTildes(a), y = sinTildes(b);
  if (x === y) return true;
  if (x.length > 12 && y.length > 12 && (x.includes(y) || y.includes(x))) return true;
  const pa = new Set(x.split(/\W+/).filter((w) => w.length > 3)), pb = new Set(y.split(/\W+/).filter((w) => w.length > 3));
  if (pa.size < 4 || pb.size < 4) return false;
  let comunes = 0;
  for (const w of pa) if (pb.has(w)) comunes++;
  return comunes / Math.min(pa.size, pb.size) >= 0.7;
}

const nombreDe = (linea: string) => sinTildes(linea.split(/\s*[:—–]\s*/)[0]).replace(/\s*\(.*\)\s*$/, "");

export function construirPrompt(l: Libreta, turnos: string[]): string {
  return (
    `Eres el anotador de una partida de rol de dark fantasy: trabajas en segundo plano y llevas el registro fiel de la historia para que el narrador (el DM) no olvide nada. Lee el registro anterior y los nuevos acontecimientos y escribe SIETE secciones.\n` +
    `- Nombres propios exactos. No inventes nada que no esté en los textos. Texto plano en español.\n` +
    `- LO MÁS RECIENTE MANDA: si algo nuevo contradice o sustituye a algo anterior (alguien murió, cambió de bando o de sitio, se perdió o se ganó un objeto, una promesa se cumplió o se rompió, una sospecha resultó falsa), escribe lo nuevo y no repitas lo viejo.\n` +
    `- EXCEPCIÓN A LO ANTERIOR, el canon manda sobre los despistes del narrador: si el narrador dice algo que contradice un hecho ya establecido SIN que la historia lo explique (un nombre, un rasgo, un precio, de qué lado cojea alguien, cuántas patas tiene un perro), NO cambies el registro: conserva el hecho establecido y apunta el despiste en CONTINUIDAD. Solo cambia el registro cuando la historia cambia las cosas (alguien muere, traiciona, pierde o gana algo).
- Anota solo lo que pasó en la ficción; no anotes reglas, tiradas ni números de combate salvo que cambien la historia (una herida grave, una muerte, un objeto).\n\n` +
    `=== CAPÍTULO ===\nLo que pasó en los nuevos acontecimientos, en orden, en frases cortas (como mucho 500 caracteres): quién hizo qué, a quién conocieron, qué se prometió, quién murió o quedó herido, qué se ganó o perdió.\n\n` +
    `=== SITUACIÓN ===\nEl estado actual tras esos acontecimientos (como mucho 2500 caracteres). Conserva lo que siga siendo cierto de la situación anterior, aunque no salga en lo nuevo, pero corrige o quita lo que los nuevos acontecimientos han cambiado. Apartados:\nDÓNDE ESTAMOS:\nMISIÓN Y OBJETIVOS:\nPROMESAS, DEUDAS Y ENEMIGOS:\nOBJETOS Y RECURSOS CLAVE: (qué lleva cada personaje jugador, heridas importantes, dinero si importa)\nTENSIÓN AHORA: (qué peligro hay, qué acaban de decidir)\n(Los personajes no jugadores y los hilos abiertos van en sus propias secciones, no aquí.)\n\n` +
    `=== DETALLES ===\nLos detalles menores NUEVOS de estos acontecimientos que un buen narrador no debería olvidar, uno por línea empezando por "- ", como mucho 12 y cada uno corto (no repitas ni reformules lo que ya está en los detalles conocidos, en los PNJ o en la situación; descarta lo pasajero como el clima o un ruido suelto): nombres de secundarios y animales y cómo son, precios pagados, objetos dados, prestados o perdidos, cicatrices, apodos, frases o gestos memorables, cómo es un lugar, gustos y manías. No repitas los que ya están en la lista de detalles conocidos.\n\n` +
    `=== OBSOLETOS ===\nDe la lista de detalles ya conocidos, los que ya no son ciertos, copiados exactamente, uno por línea empezando por "- ". Si no hay ninguno, deja la sección vacía.\n\n` +
    `=== PNJ ===\nUna línea por cada personaje no jugador que APARECIÓ o CAMBIÓ en estos acontecimientos, empezando por "- Nombre: " y seguido de quién es, qué actitud tiene hacia el grupo, dónde está o qué le pasó (añade «MUERTO» si murió) y lo que quiere o ha prometido. Repite el nombre exacto de los ya conocidos para actualizarlos. Si no hay cambios, deja la sección vacía.\n\n` +
    `=== HILOS ===\nLos hilos de la historia que se ABREN o SE CIERRAN en estos acontecimientos, uno por línea: "- [abierto] ..." para un misterio, promesa, deuda, amenaza o encargo nuevo sin resolver; "- [cerrado] ..." para uno de los hilos abiertos conocidos que ya se resolvió (copia su texto exactamente). Si no hay cambios, deja la sección vacía.\n\n` +
    `=== CONTINUIDAD ===\nHasta 3 líneas, "- ...", solo para CONTRADICCIONES CLARAS: algo que el narrador (o un PNJ en su narración) afirmó y no encaja con un hecho ya establecido (un nombre, un rasgo, un precio, de qué lado cojea alguien, cuántas patas tiene un perro, quién tiene un objeto) — di qué se dijo y cuál es lo correcto — o una promesa de un PNJ que debe cumplirse. No escribas observaciones sobre reglas, tiradas ni confirmaciones de que algo está bien. Esta sección sustituye a la anterior; casi siempre estará vacía.\n\n` +
    `## DETALLES YA CONOCIDOS\n${l.detalles.slice(-60).map((x) => `- ${x}`).join("\n") || "(ninguno)"}\n\n` +
    `## PNJ CONOCIDOS\n${l.pnj.map((x) => `- ${x}`).join("\n") || "(ninguno)"}\n\n` +
    `## HILOS ABIERTOS CONOCIDOS\n${l.hilos.map((x) => `- ${x}`).join("\n") || "(ninguno)"}\n\n` +
    `## SITUACIÓN ANTERIOR\n${l.diario || "(vacía)"}\n\n## NUEVOS ACONTECIMIENTOS\n${turnos.join("\n\n")}\n\n` +
    `Responde solo con las siete secciones, empezando por la línea "=== CAPÍTULO ===".`
  );
}

/** Mezcla lo que ha escrito el anotador en el registro (sin red). */
export function aplicarPartes(l: Libreta, p: Partes): Libreta {
  const n: Libreta = { ...l, anales: [...l.anales], detalles: [...l.detalles], pnj: [...l.pnj], hilos: [...l.hilos], continuidad: [] };
  n.diario = p.situacion.slice(0, LIMITE_DIARIO);
  if (p.capitulo) n.anales.push(p.capitulo.slice(0, LIMITE_CAPITULO));
  for (const o of p.obsoletos.slice(0, 30)) n.detalles = n.detalles.filter((x) => !mismoAsunto(x, o));
  const vistos = new Set(n.detalles.map((x) => x.toLowerCase()));
  for (const x of p.detalles.slice(0, 20)) if (!vistos.has(x.toLowerCase())) { n.detalles.push(x.slice(0, 220)); vistos.add(x.toLowerCase()); }
  // PNJ: cada línea sustituye a la del mismo nombre (y pasa al final: los más recientes, al final).
  for (const linea of p.pnj.slice(0, 20)) {
    const k = nombreDe(linea);
    if (!k || k.length > 50) continue;
    n.pnj = n.pnj.filter((x) => nombreDe(x) !== k);
    n.pnj.push(linea.slice(0, 320));
  }
  while (n.pnj.length > MAX_PNJ) {
    const i = n.pnj.findIndex((x) => /muert|MUERTO/i.test(x));
    n.pnj.splice(i >= 0 ? i : 0, 1);
  }
  // Hilos: los cerrados quitan el abierto que se parezca; los abiertos se añaden si no están.
  for (const linea of p.hilos.slice(0, 20)) {
    const cerrado = /^\[\s*cerrad[oa]\s*\]/i.test(linea);
    const texto = linea.replace(/^\[\s*(abiert[oa]|cerrad[oa])\s*\]\s*/i, "").trim();
    if (texto.length < 4) continue;
    if (cerrado) n.hilos = n.hilos.filter((h) => !mismoAsunto(h, texto));
    else if (!n.hilos.some((h) => mismoAsunto(h, texto))) n.hilos.push(texto.slice(0, 260));
  }
  while (n.hilos.length > MAX_HILOS) n.hilos.shift();
  // Fuera lo que no es una contradicción: comentarios sobre dados y reglas o confirmaciones.
  n.continuidad = p.continuidad.filter((x) => !/\b(dados?|tiradas?|resultados? de|reglas?|no se anotan|todo (encaja|está bien))\b/i.test(x)).slice(0, MAX_CONTINUIDAD).map((x) => x.slice(0, 260));
  return n;
}

async function fundirAnales(l: Libreta, consulta: Consulta): Promise<void> {
  while (l.anales.join("").length > LIMITE_ANALES && l.anales.length > 3) {
    const viejos = l.anales.slice(0, 4);
    const res = await consulta(
      `Funde estos capítulos de una partida de rol en uno solo, en orden, como mucho 700 caracteres. Conserva nombres propios, muertes, promesas, deudas, enemigos y objetos ganados o perdidos; quita lo trivial. No inventes nada. Responde solo con el texto.\n\n${viejos.map((c, i) => `${i + 1}. ${c}`).join("\n")}`,
      { modelTier: "quick", cache: false },
    );
    const fundido = String(res.text || "").trim();
    if (!fundido) return;
    l.anales.splice(0, viejos.length, fundido.slice(0, 800));
  }
}

async function fundirDetalles(l: Libreta, consulta: Consulta): Promise<void> {
  if (l.detalles.length <= LIMITE_DETALLES) return;
  const viejos = l.detalles.slice(0, 50);
  const res = await consulta(
    `Agrupa estos detalles de una partida de rol en como mucho 20 líneas cortas, empezando cada una por "- ". Conserva todos los nombres propios, objetos, precios y rasgos; junta los que hablan de lo mismo y quita solo lo repetido. No inventes nada. Responde solo con las líneas.\n\n${viejos.map((x) => `- ${x}`).join("\n")}`,
    { modelTier: "quick", cache: false },
  );
  const nuevos = String(res.text || "").split("\n").map((x) => x.replace(/^\s*[-•*]\s*/, "").trim()).filter(Boolean);
  if (nuevos.length) l.detalles.splice(0, viejos.length, ...nuevos.slice(0, 25));
}

/** Una pasada del anotador: lee los turnos nuevos y devuelve el registro puesto al día (o el mismo si no pudo). */
export async function anotar(l: Libreta, turnos: string[], hasta: number, consulta: Consulta): Promise<Libreta> {
  if (!turnos.length) return l;
  const res = await consulta(construirPrompt(l, turnos), { modelTier: "quick", cache: false });
  const partes = partirSecciones(String(res.text || ""));
  if (!partes.situacion) return l;
  const n = aplicarPartes(l, partes);
  await fundirAnales(n, consulta);
  await fundirDetalles(n, consulta);
  n.hasta = hasta;
  return n;
}

/** Lo que lee el DM: el registro del anotador, con los mismos encabezados de siempre más los PNJ, los hilos y la continuidad. */
export function textoParaDM(l: Libreta): string {
  const partes = [
    `# ANOTADOR (el cronista de la mesa lleva el registro de la historia; es canon, respétalo y no lo contradigas)`,
    `## Anales de la aventura (capítulos ya vividos, en orden)\n${l.anales.length ? l.anales.map((c, i) => `${i + 1}. ${c}`).join("\n") : "(aún vacíos: la aventura acaba de empezar)"}`,
    `## Situación actual (antes de los turnos recientes)\n${l.diario || "(aún vacía)"}`,
  ];
  if (l.pnj.length) partes.push(`## Personajes no jugadores (cómo los dejó la historia; mantén su actitud, sus promesas y su estado)\n${l.pnj.map((x) => `- ${x}`).join("\n")}`);
  if (l.hilos.length) partes.push(`## Hilos abiertos (promesas, misterios, deudas y amenazas sin resolver: no los olvides ni los repitas como nuevos)\n${l.hilos.map((x) => `- ${x}`).join("\n")}`);
  if (l.detalles.length) partes.push(`## Detalles menores (nombres, precios, objetos, aspecto, frases; respétalos)\n${l.detalles.map((x) => `- ${x}`).join("\n")}`);
  if (l.continuidad.length) partes.push(`## Avisos de continuidad (corrige o respeta esto en tu próxima narración)\n${l.continuidad.map((x) => `- ${x}`).join("\n")}`);
  return partes.join("\n\n");
}

/** Lo que ve el jugador en la pestaña del diario. */
export function textoParaJugadores(l: Libreta): string {
  if (!(l.anales.length || l.diario)) return "";
  return [
    l.anales.length ? "CAPÍTULOS\n" + l.anales.map((c, i) => `${i + 1}. ${c}`).join("\n\n") : "",
    l.diario ? "SITUACIÓN ACTUAL\n" + l.diario : "",
    l.pnj.length ? "PERSONAJES\n" + l.pnj.map((x) => `· ${x}`).join("\n") : "",
    l.hilos.length ? "HILOS ABIERTOS\n" + l.hilos.map((x) => `· ${x}`).join("\n") : "",
    l.detalles.length ? "DETALLES\n" + l.detalles.map((x) => `· ${x}`).join("\n") : "",
  ].filter(Boolean).join("\n\n");
}
