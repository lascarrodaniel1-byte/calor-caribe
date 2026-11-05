// Qué sabe cada cual: el conocimiento del mundo no es igual para todos. Cada tema (un jefe, una raza, una facción, un
// secreto) tiene CAPAS: lo público (lo sabe cualquiera), el rumor (lo oye el vulgo, deformado), lo erudito (lo saben
// escribas, cronistas, sacerdotes, hechiceros de escuela), lo restringido (los altos cargos de ESA facción) y lo secreto
// (solo el DM y los implicados). Los PNJ tienen un RANGO de saber (vulgo, letrado, alto) que sale de su rol.
import { BESTIARIO } from "./bestiario.js";
import type { Partida } from "./estado.js";

export const RANGOS = ["vulgo", "letrado", "alto"] as const;
export type Rango = (typeof RANGOS)[number];
export const CAPAS = ["publico", "rumor", "erudito", "restringido", "secreto"] as const;
export type Capa = (typeof CAPAS)[number];

export interface TemaSaber {
  id: string;
  nombre: string;
  /** Palabras con las que se busca el tema. */
  claves: string[];
  /** Quién cuenta como «de dentro» para la capa restringida (el rol del PNJ debe encajar). */
  ambito?: RegExp;
  /** Lo que delata el secreto si aparece en una narración (para avisar al DM). */
  delata?: RegExp;
  publico?: string;
  rumor?: string;
  erudito?: string;
  restringido?: string;
  secreto?: string;
}

const norm = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

/** Rango de saber de un PNJ: el que se le fija o el que sale de su rol (escribas, eruditos y altos cargos saben más). */
export function rangoDe(rol: string, explicito?: Rango): Rango {
  if (explicito) return explicito;
  const r = norm(rol);
  if (/(inquisidor (mayor|superior|general)|gran |alto |consejer|mariscal|capitan|comandante|noble|duque|conde|baron|lord|lady|senor|regente|reina|rey|alcalde|gobernador|obispo|prelado|magistrad|juez|general|jefe de|lider|maestre de|cabecilla|matriarca|patriarca|sumo)/.test(r)) return "alto";
  if (/(escriba|erudit|cronista|archivista|bibliotecari|escolar|sabio|maestre|sacerdot|clerigo|monje|monja|hermana de la sutura|hechicer|mago|bruj|cartografo|historiador|tutor|profesor|inquisidor|medico|cirujan|boticari|alquimista|notario|escribano|trovador|bardo|guia de)/.test(r)) return "letrado";
  return "vulgo";
}

/** Cuánto sabe cada rango: capas que conoce con certeza. */
const VE: Record<Rango, Capa[]> = { vulgo: ["publico"], letrado: ["publico", "erudito"], alto: ["publico", "erudito", "restringido"] };

/** Temas con capas escritas a mano (lo que ya es canon del mundo; el rumor y lo erudito son una propuesta). */
export const TEMAS: TemaSaber[] = [
  {
    id: "juez", nombre: "El Juez Sin Ojos", claves: ["juez sin ojos", "juez", "primer inquisidor"], ambito: /inquisi|llama gris|juez|catedral/,
    delata: /hijo de ka'?i|le arrancó los ojos|se arrancó los ojos|catedral (hundida|sumergida)|rayo de luz solar/i,
    publico: "Es el Primer Inquisidor: lleva la Inquisición de la Llama Gris y casi nadie lo ve; sus sentencias llegan selladas.",
    rumor: "Dicen que no tiene ojos y que aun así lo ve todo; que no es del todo humano; que juzga a los muertos y a los dioses.",
    erudito: "Los archivos lo sitúan antes de la Caída: es el primer Inquisidor y se le atribuye una mirada que distingue lo divino de lo maldito.",
    restringido: "Reside bajo la catedral y gobierna por sentencias selladas; sus enemigos son los magos negros que ofenden a los dioses y teme a un vampiro dentro de la Inquisición.",
    secreto: "Hijo de Ka'i, el dios del sol, y de una humana; se arrancó los ojos atrapado cuando fue a socorrer a su padre; guarda en la catedral hundida los recuerdos de Ka'i, entre ellos un rayo de luz solar primigenia.",
  },
  {
    id: "ysolde", nombre: "Ysolde y la Corte Pálida", claves: ["ysolde", "reina pálida", "corte pálida", "vel morhal", "dracone"], ambito: /palid|corte|vampir|vel morhal/,
    delata: /dracone|primus imperatus|mat[oó] a su padre/i,
    publico: "La Corte Pálida es la nobleza vampírica de la Marca Hueca; las aldeas de la Marca viven bajo su yugo.",
    rumor: "Se habla de una reina, Ysolde, que casi nadie ha visto. Cuentan que la Corte pide sangre a las aldeas a cambio de protegerlas de cosas peores; que la reina nunca duerme.",
    erudito: "Los registros de la Marca recuerdan que antes de la Corte hubo un solo señor pálido que unió a los demás; hoy la orden de Ysolde manda en sus castillos.",
    restringido: "Ysolde gobierna desde Vel Morhal por invitaciones y favores; los señores de la Corte le deben la vida (y la muerte) y la Inquisición es su rival.",
    secreto: "Un golpe de estado después de la Caída: Ysolde mató con su propia mano a su padre Dracone, el «Primus Imperatus», tras una fiera pelea, y absorbió su esencia vital.",
  },
  {
    id: "madre", nombre: "La Madre de los Hambrientos", claves: ["madre de los hambrientos", "madre", "hambrientos", "dios hambriento", "devotos"], ambito: /devot|hambrient|dios hambriento/,
    publico: "Los Hambrientos son muertos alzados por la Podre; en las Ciénagas dicen que los manda algo que nunca se ve.",
    rumor: "Dicen que una «madre» los pare en las fosas de las Ciénagas y que los devotos del Dios Hambriento le llevan carne.",
    erudito: "Los Devotos creen que de la Podre nacerá un dios nuevo y que la Madre es su cuna; los muertos de las Ciénagas obedecen su hambre.",
    restringido: "Los ghuls la rodean como hijos mayores y guían a la manada; los devotos vigilan sus fosas y le llevan carne.",
  },
  {
    id: "lobo", nombre: "La Maldición del Lobo (los Varg)", claves: ["varg", "maldición del lobo", "kashi", "vaskar", "lobo", "falange"], ambito: /varg|kashi|luna/,
    delata: /vaskar|falange (del|de) (dedo|kashi)|dedo anular del dios/i,
    publico: "Los varg son hombres y mujeres lobo; la Inquisición los persigue y en muchos pueblos los temen.",
    rumor: "Se dice que descienden de alguien maldito por la luna y que en el Bosque de Velo Rojo vaga un lobo antiguo que busca romper su maldición; los objetos que se rumorean allí son señuelos.",
    erudito: "Las crónicas atribuyen la maldición a un castigo de Kashi, el dios de la luna, contra un hombre que quiso robarle su poder; no recuerdan su nombre.",
    secreto: "Vaskar, mago negro traicionero de la época de los dioses, quiso robar la esencia de Kashi a través de uno de sus hijos (un lobo que cazó); Kashi lo maldijo dormido y lo volvió lobo para siempre. Hoy vaga por el Velo Rojo; la única reliquia real es la Falange de Kashi, y no rompe su maldición.",
  },
  {
    id: "aesir", nombre: "Æsir y el fuego viejo", claves: ["aesir", "æsir", "fuego viejo", "berserker", "ceniza"], delata: /\baesir\b|æsir/i,
    publico: "Los Berserkers de Ceniza son guerreros que entran en una furia que ennegrece su pelo; los eligen de niños.",
    rumor: "Dicen que el fuego de su furia viene de un dios que nadie nombra.",
    secreto: "Æsir fue el dios más antiguo; su fuego sobrevive como vestigio en los Berserkers de Ceniza, que lo invocan en su furia.",
  },
  {
    id: "podre", nombre: "La Podre", claves: ["podre", "hambriento", "mordisco"], 
    publico: "La Podre pudre la carne y luego la voluntad: el que muere de ella se alza como Hambriento. Una herida con Podre no se cura sola.",
    erudito: "No se cura con magia divina: hay que cortar la carne podrida, cauterizar o hallar remedios raros; sin curar mata en siete días.",
  },
  {
    id: "dioses", nombre: "La muerte de los dioses", claves: ["dioses", "caída", "caida", "99 años", "dioses muertos"],
    publico: "Hace 99 años mataron a los dioses; nadie sabe quién. El sol es un disco gris y los huesos de dioses se venden como reliquias.",
    erudito: "La magia divina se alimenta de los restos de los dioses muertos, y por eso deja Ceniza en quien la recibe.",
  },
  {
    id: "inquisicion", nombre: "La Inquisición de la Llama Gris", claves: ["inquisición", "inquisicion", "llama gris"], ambito: /inquisi|llama gris|juez/,
    publico: "Purifican con fuego: persiguen la brujería, a los varg y a los nacidos pálidos. Necesarios y temidos.",
    erudito: "Sus inquisidores llevan licencias selladas del Juez; sus sabuesos son lobos de ceniza adiestrados para rastrear a los condenados.",
    restringido: "Las sentencias las firma el Juez desde la catedral; los acólitos vendados repiten sus palabras en voz alta.",
  },
  {
    id: "cuervo", nombre: "La Compañía del Cuervo Negro", claves: ["compañía del cuervo", "cuervo negro", "hugin", "munin", "mariscal"], ambito: /cuervo|compan/,
    publico: "Mercenarios que luchan por quien pague, sin preguntas sobre raza ni pasado. Rangos: Polluelo, Cuervo, Garra, Corax, Ala Mayor.",
    erudito: "Su cuartel general está en Aldenmar y la dirigen dos mariscales, Hugin y Munin.",
    restringido: "El puesto de mariscal solo se ocupa por renuncia o muerte de quien lo tiene, y se concursa entre Alas Mayores.",
  },
  {
    id: "razas", nombre: "Razas: nacidos pálidos, cenizos y demás", claves: ["nacido pálido", "nacidos pálidos", "cenizo", "enano", "elfo marchito", "mediano"],
    publico: "Humanos, enanos de Karak-Dûm, elfos marchitos, medianos de Hollín, varg, nacidos pálidos y cenizos: cada raza lleva a cuestas su reputación.",
    rumor: "Se cuenta que los nacidos pálidos llevan sangre de la Corte y que los cenizos tienen fuego en las venas.",
    erudito: "Los nacidos pálidos nacen con la sed de sangre de un linaje vampírico lejano; los cenizos descienden de quienes sobrevivieron a la furia del fuego viejo.",
  },
];

/** Temas del bestiario: cada jefe con trasfondo tiene sus capas, sacadas de su ficha (la descripción es pública, las pistas son rumor y erudición, el origen es secreto). */
function temasDeBestiario(): TemaSaber[] {
  return BESTIARIO.filter((c) => c.trasfondo).map((c) => {
    const pistas = c.trasfondo!.pistas ?? [];
    const primera = c.descripcion.split(/(?<=[.!?])\s/)[0] ?? c.descripcion;
    return {
      id: "b:" + norm(c.nombre),
      nombre: c.nombre,
      claves: [c.nombre],
      publico: primera,
      rumor: pistas[0],
      erudito: pistas.length > 1 ? pistas.slice(1).join(" ") : undefined,
      restringido: c.trasfondo!.enemigos,
      secreto: c.trasfondo!.origen,
    } as TemaSaber;
  });
}
let cacheBestiario: TemaSaber[] | null = null;
export const todosLosTemas = (): TemaSaber[] => [...TEMAS, ...(cacheBestiario ??= temasDeBestiario().filter((b) => !TEMAS.some((t) => t.claves.some((k) => norm(k) === norm(b.nombre)))))];

export function buscarTema(texto: string): TemaSaber | undefined {
  const n = norm(texto);
  if (!n) return undefined;
  const todos = todosLosTemas();
  return todos.find((t) => norm(t.id) === n || norm(t.nombre) === n)
    ?? todos.find((t) => t.claves.some((k) => norm(k) === n))
    ?? todos.find((t) => norm(t.nombre).includes(n) || t.claves.some((k) => norm(k).includes(n) || n.includes(norm(k))));
}

export interface EstadoSaber {
  /** Capas que ya son de dominio público (porque la historia las reveló al mundo): tema → capas. */
  reveladas: Record<string, Capa[]>;
}

const reveladas = (p: Partida, id: string): Capa[] => (p.saber?.reveladas?.[id] ?? []) as Capa[];

/** Lo que sabe alguien de rango `rango` (y rol `rol`, para la capa restringida) sobre un tema. */
export function saberDe(p: Partida, tema: TemaSaber, rango: Rango, rol = ""): { cierto: { capa: Capa; texto: string }[]; rumor?: string; ignora: Capa[] } {
  const rev = reveladas(p, tema.id);
  const de = (capa: Capa) => rev.includes(capa) || VE[rango].includes(capa);
  const cierto: { capa: Capa; texto: string }[] = [];
  const ignora: Capa[] = [];
  for (const capa of ["publico", "erudito", "restringido", "secreto"] as Capa[]) {
    const texto = tema[capa];
    if (!texto) continue;
    // Lo restringido solo lo conocen los de dentro; un alto cargo de otra facción solo llega a lo erudito.
    const dentro = capa !== "restringido" || rev.includes("restringido") || !tema.ambito || tema.ambito.test(norm(rol)) || /regente|reina|rey|juez|jefe/.test(norm(rol));
    const sabe = capa === "secreto" ? rev.includes("secreto") : de(capa) && dentro;
    if (sabe) cierto.push({ capa, texto }); else ignora.push(capa);
  }
  return { cierto, rumor: tema.rumor, ignora };
}

export function textoSaber(p: Partida, tema: TemaSaber, rango: Rango, rol = "", quien?: string): string {
  const s = saberDe(p, tema, rango, rol);
  const cab = `${quien ? `${quien} (${rango})` : `Un ${rango}`} sobre «${tema.nombre}»:`;
  const l = s.cierto.map((c) => `- ${c.capa === "publico" ? "Lo sabe todo el mundo" : c.capa === "erudito" ? "Lo sabe por sus lecturas o su oficio" : c.capa === "restringido" ? "Lo sabe por su cargo (no se dice en la calle)" : "Lo sabe (la historia ya lo reveló)"}: ${c.texto}`);
  if (s.rumor) l.push(`- Lo que ha OÍDO (rumor, puede estar deformado o exagerado${s.cierto.some((c) => c.capa === "erudito") ? "; él sabe qué parte es cierta" : ""}): ${s.rumor}`);
  if (s.ignora.includes("secreto")) l.push("- NO sabe nada más: el resto es secreto y NO debe salir de su boca (ni insinuarlo).");
  else if (s.ignora.length) l.push("- NO sabe el resto: no lo inventes ni lo insinúes.");
  return `${cab}\n${l.join("\n")}`;
}

export const REGLAS_SABER = `## Qué sabe cada cual (usa la acción saber)
- El conocimiento tiene capas: PÚBLICO (lo sabe cualquiera), RUMOR (lo oye el vulgo, deformado), ERUDITO (escribas, cronistas, sacerdotes, hechiceros de escuela, médicos), RESTRINGIDO (los altos cargos de ESA facción) y SECRETO (solo tú; los PNJ nunca lo saben salvo los implicados).
- Cada PNJ tiene un rango de saber (vulgo, letrado, alto) que sale de su rol (se ve en el estado). Antes de que un PNJ hable de un jefe, una raza, una facción o un secreto, mira lo que sabe con saber {accion: consultar, tema, quien}: dice qué conoce con certeza, qué solo ha oído y qué ignora.
- Un campesino cuenta el rumor; un escriba da la versión documentada; un alto cargo conoce los asuntos de su facción pero no los de otra. Nadie sabe lo secreto: ni el más sabio.
- Si la historia revela un secreto al mundo (los jugadores lo publican, un testigo lo cuenta a todos), registra que ya es público con saber {accion: revelar, tema, capa}. Hasta entonces, no sale de la boca de ningún PNJ.`;

/** Secretos que la narración parece haber soltado (para avisar al DM): ¿aparece lo que delata un tema aún no revelado? */
export function fugasDeSaber(p: Partida, texto: string): TemaSaber[] {
  const t = texto.split("<<secuencia")[0];
  return todosLosTemas().filter((x) => x.delata && !reveladas(p, x.id).includes("secreto") && !reveladas(p, x.id).includes("restringido") && x.delata.test(t));
}

export interface DatosSaber {
  accion: "consultar" | "revelar" | "lista";
  tema?: string;
  quien?: string;
  rango?: Rango;
  capa?: Capa;
}

export function accionSaber(p: Partida, d: DatosSaber): string {
  if (d.accion === "lista" || !d.tema) {
    const t = todosLosTemas();
    return `Temas con capas de conocimiento: ${t.map((x) => x.nombre).join("; ")}.\nUsa saber {accion: consultar, tema, quien o rango} para ver qué sabe un PNJ.`;
  }
  const tema = buscarTema(d.tema);
  if (!tema) throw new Error(`No hay un tema «${d.tema}». Usa saber {accion: lista} para ver los que hay; si es nuevo (un secreto de tu campaña), trátalo como secreto hasta que la historia lo revele.`);
  if (d.accion === "revelar") {
    const capa: Capa = d.capa && d.capa !== "publico" ? d.capa : "secreto";
    p.saber ??= { reveladas: {} };
    p.saber.reveladas[tema.id] = [...new Set([...(p.saber.reveladas[tema.id] ?? []), capa, ...(capa === "secreto" ? (["restringido"] as Capa[]) : [])])];
    return `«${tema.nombre}»: la capa ${capa} ya es de dominio público en el mundo; los PNJ que la oigan pueden repetirla.`;
  }
  const pnj = d.quien && p.pnjs ? Object.values(p.pnjs).find((x) => norm(x.nombre) === norm(d.quien!)) : undefined;
  const rol = pnj?.rol ?? "";
  const rango = d.rango ?? (pnj ? rangoDe(pnj.rol, pnj.saber) : d.quien ? rangoDe(d.quien) : "vulgo");
  return textoSaber(p, tema, rango, rol, pnj?.nombre ?? d.quien);
}
