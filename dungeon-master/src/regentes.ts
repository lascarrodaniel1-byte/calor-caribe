// Los regentes (el Juez Sin Ojos, Ysolde y la Madre de los Hambrientos) no solo mandan sobre su dominio: inciden
// políticamente en otros sitios para imponerse (comprar voluntades, tener espías, sabotear, chantajear, hacer
// propaganda), y sus relaciones entre sí cambian según la conveniencia y la situación. Aquí vive ese juego en
// segundo plano: la influencia de cada uno por región, sus relaciones vigentes (con lo que las empuja a cambiar) y
// las jugadas que hacen, para que el DM las lleve a la historia como ecos y no se queden en el aire.
import { buscarCriatura } from "./bestiario.js";
import type { Partida } from "./estado.js";
import { buscarRegion, REGIONES } from "./mapa.js";

export interface Jugada {
  regente: string;
  tipo: TipoJugada;
  region: string;
  objetivo?: string;
  detalle: string;
  paso: number;
}

export interface EstadoRegentes {
  /** Influencia de cada regente por región (0-5): a 5 manda en la sombra. */
  influencia: Record<string, Record<string, number>>;
  /** Regiones donde cada regente tiene una red de espías. */
  espias: Record<string, string[]>;
  /** Relaciones fijadas explícitamente («A|B» en orden alfabético): valor -3..3. */
  relaciones: Record<string, { valor: number; motivo: string; paso: number }>;
  jugadas: Jugada[];
  /** Turnos desde la última jugada política. */
  sinJugada: number;
}

export const TIPOS_JUGADA = ["comprar_voluntades", "espiar", "sabotaje", "chantaje", "propaganda", "emisario", "alianza", "traicion"] as const;
export type TipoJugada = (typeof TIPOS_JUGADA)[number];

const REGENTES: { id: string; bestiario: string; alias: string[] }[] = [
  { id: "Juez Sin Ojos", bestiario: "Juez Sin Ojos", alias: ["juez", "primer inquisidor"] },
  { id: "Ysolde", bestiario: "Ysolde", alias: ["ysolde", "reina pálida", "reina palida"] },
  { id: "Madre de los Hambrientos", bestiario: "Madre de los Hambrientos", alias: ["madre", "madre de los hambrientos"] },
];

const sinTildes = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

export function resolverRegente(nombre: string): string {
  const n = sinTildes(nombre);
  const r = REGENTES.find((x) => sinTildes(x.id) === n || x.alias.some((a) => sinTildes(a) === n) || sinTildes(x.id).includes(n) || n.includes(sinTildes(x.id)));
  if (!r) throw new Error(`"${nombre}" no es un regente. Regentes: ${REGENTES.map((x) => x.id).join(", ")}.`);
  return r.id;
}

const clave = (a: string, b: string) => [a, b].sort().join("|");

export const ETIQUETAS: Record<number, string> = { [-3]: "guerra", [-2]: "rivalidad", [-1]: "recelo", 0: "neutral", 1: "tregua", 2: "colaboración", 3: "alianza" };
const etiqueta = (v: number) => ETIQUETAS[Math.max(-3, Math.min(3, v))];

/** Relación de partida entre cada pareja y qué la empuja a cambiar. */
const BASE: Record<string, { valor: number; motivo: string; cambia: string[] }> = {
  [clave("Juez Sin Ojos", "Ysolde")]: {
    valor: -2,
    motivo: "la Llama Gris persigue vampiros y Ysolde teme el Rayo de luz solar primigenia; los dos aspiran a mandar en Aldenmar",
    cambia: ["tregua si los dos temen a un mismo enemigo (Kuru, un jefe fuera de zona, la amenaza del reloj)", "guerra abierta si el Juez descubre un vampiro dentro de la Inquisición o Ysolde corrompe a un inquisidor", "colaboración puntual si un tercero amenaza a los dos"],
  },
  [clave("Juez Sin Ojos", "Madre de los Hambrientos")]: {
    valor: -3,
    motivo: "la Podre y el culto del Dios Hambriento son herejía para el Juez; la Madre alimenta lo que él quema",
    cambia: ["la guerra se enfría si la Madre amenaza algo que el Juez necesita proteger y se centra en otro enemigo", "se encarniza si la Llama Gris incendia una fosa o ella se come una sede de la Inquisición"],
  },
  [clave("Madre de los Hambrientos", "Ysolde")]: {
    valor: 0,
    motivo: "Ysolde usa los muertos de la Marca como jauría y la Madre no obedece a nadie: se necesitan y se estorban",
    cambia: ["tregua o colaboración si pactan para someter la Marca Hueca (o contra el Juez)", "recelo o rivalidad si disputan los muertos o las fosas de la Marca", "Ysolde puede intentar domesticar la marea de la Madre; la Madre solo entiende de hambre"],
  },
};

export function afinidad(partida: Partida, a: string, b: string): { valor: number; etiqueta: string; razones: string[]; fijada: boolean } {
  const base = BASE[clave(a, b)];
  const estado = partida.regentes;
  const razones: string[] = [];
  let valor = base?.valor ?? 0;
  if (base) razones.push(`de base ${etiqueta(base.valor)}: ${base.motivo}`);
  if (estado) {
    // Situación: región disputada, hostilidades recientes y amenaza común.
    const ia = estado.influencia[a] ?? {}, ib = estado.influencia[b] ?? {};
    const disputadas = Object.keys(ia).filter((r) => (ia[r] ?? 0) >= 3 && (ib[r] ?? 0) >= 3);
    if (disputadas.length) { valor -= 1; razones.push(`se disputan ${disputadas.join(", ")} (los dos con influencia ≥ 3)`); }
    const hostiles = estado.jugadas.slice(-8).filter((j: Jugada) => (j.regente === a && j.objetivo && resolverSuave(j.objetivo) === b && (j.tipo === "sabotaje" || j.tipo === "traicion" || j.tipo === "chantaje")) || (j.regente === b && j.objetivo && resolverSuave(j.objetivo) === a && (j.tipo === "sabotaje" || j.tipo === "traicion" || j.tipo === "chantaje")));
    if (hostiles.length) { valor -= Math.min(2, hostiles.length); razones.push(`${hostiles.length} jugada(s) hostil(es) reciente(s) entre ellos`); }
    const amistosas = estado.jugadas.slice(-8).filter((j: Jugada) => j.tipo === "alianza" && ((j.regente === a && j.objetivo && resolverSuave(j.objetivo) === b) || (j.regente === b && j.objetivo && resolverSuave(j.objetivo) === a)));
    if (amistosas.length) { valor += 1; razones.push("alianza o acuerdo reciente entre ellos"); }
  }
  if ((partida.trama?.reloj ?? 0) >= 4) { valor += 1; razones.push("una amenaza grande (reloj ≥ 4) los empuja a dejar la guerra para después"); }
  const fijada = estado?.relaciones[clave(a, b)];
  if (fijada) { razones.push(`fijada por el DM en ${etiqueta(fijada.valor)}: ${fijada.motivo}`); valor = fijada.valor; }
  valor = Math.max(-3, Math.min(3, valor));
  return { valor, etiqueta: etiqueta(valor), razones, fijada: !!fijada };
}

function resolverSuave(n: string): string | null {
  try { return resolverRegente(n); } catch { return null; }
}

const vacio = (): EstadoRegentes => ({ influencia: {}, espias: {}, relaciones: {}, jugadas: [], sinJugada: 0 });

export interface DatosRegente {
  accion: "jugada" | "relacion" | "estado";
  regente?: string;
  tipo?: TipoJugada;
  region?: string;
  objetivo?: string;
  detalle?: string;
  con?: string;
  valor?: number;
  motivo?: string;
}

/** Pistas que una jugada deja en el mundo, para que el DM las siembre sin contarla entera. */
const PISTAS: Record<TipoJugada, string[]> = {
  comprar_voluntades: ["un alguacil, un escribano o un capitán con dinero o lujos nuevos", "un cambio de bando sin explicación", "una licencia concedida que debía denegarse"],
  espiar: ["un criado o un mendigo que está en todas partes", "alguien que sabe de más sobre el grupo", "una carta interceptada o un contacto que desaparece"],
  sabotaje: ["un incendio, una puerta cegada, un pozo envenenado o un archivo quemado", "una caravana retrasada o una reliquia robada", "un rival declarado hereje o acusado de algo"],
  chantaje: ["un PNJ aterrado que cambia de actitud de golpe", "un secreto que sale a la luz en el momento justo", "una confesión forzada"],
  propaganda: ["sermones, carteles o canciones nuevas", "un rumor que todos repiten", "un enemigo convertido en demonio en las plazas"],
  emisario: ["un mensajero con un sello, una insignia o una invitación", "un subordinado que llega a cumplir su voluntad"],
  alianza: ["emisarios que se cruzan con cortesía", "un acuerdo que nadie anuncia pero que todos notan"],
  traicion: ["un aliado que desaparece de un lugar donde debía estar", "un pacto roto que deja un cadáver o un vacío"],
};

export function actualizarRegentes(partida: Partida, d: DatosRegente): string {
  const e = (partida.regentes ??= vacio());
  if (d.accion === "estado") return textoRegentes(partida, true);
  if (d.accion === "relacion") {
    if (!d.regente || !d.con) throw new Error("Para fijar una relación di los dos regentes (regente y con).");
    if (d.valor === undefined) throw new Error("Di el valor de la relación: -3 guerra, -2 rivalidad, -1 recelo, 0 neutral, 1 tregua, 2 colaboración, 3 alianza.");
    const a = resolverRegente(d.regente), b = resolverRegente(d.con);
    if (a === b) throw new Error("Un regente no tiene relación consigo mismo.");
    if (!d.motivo) throw new Error("Una relación cambia por una razón (motivo): la conveniencia o el hecho que la mueve.");
    e.relaciones[clave(a, b)] = { valor: d.valor, motivo: d.motivo, paso: partida.secuencia?.total ?? 0 };
    return `${a} y ${b}: ${etiqueta(d.valor)} (${d.motivo}).`;
  }
  // jugada
  if (!d.regente || !d.tipo || !d.region || !d.detalle) throw new Error("Una jugada necesita regente, tipo, region y detalle (qué hacen en concreto).");
  const id = resolverRegente(d.regente);
  const region = buscarRegion(d.region);
  if (!region) throw new Error(`Región desconocida "${d.region}". Regiones: ${REGIONES.map((r) => r.nombre).join(", ")}.`);
  const reg = buscarCriatura(REGENTES.find((x) => x.id === id)!.bestiario)?.regente;
  const habitual = reg?.politica?.medios.some((m) => sinTildes(m).includes(sinTildes(d.tipo!).replace(/_/g, " ").split(" ")[0]));
  const inf = ((e.influencia[id] ??= {})[region.nombre] ?? 0);
  const objetivoRegente = d.objetivo ? resolverSuave(d.objetivo) : null;
  const log: string[] = [];
  let nueva = inf;
  switch (d.tipo) {
    case "comprar_voluntades":
    case "chantaje":
    case "propaganda":
      nueva = Math.min(5, inf + 1);
      break;
    case "espiar":
      (e.espias[id] ??= []).includes(region.nombre) || e.espias[id].push(region.nombre);
      log.push(`${id} tiene ahora una red de espías en ${region.nombre}: sabe lo que pasa allí.`);
      break;
    case "sabotaje":
      if (objetivoRegente) {
        const ri = ((e.influencia[objetivoRegente] ??= {})[region.nombre] ?? 0);
        e.influencia[objetivoRegente][region.nombre] = Math.max(0, ri - 1);
        log.push(`La influencia de ${objetivoRegente} en ${region.nombre} baja a ${Math.max(0, ri - 1)}.`);
      } else nueva = Math.min(5, inf + (inf < 2 ? 1 : 0));
      break;
    case "alianza":
      if (!objetivoRegente) throw new Error("Una alianza necesita otro regente como objetivo.");
      break;
    case "traicion":
      if (!objetivoRegente) throw new Error("Una traición necesita otro regente como objetivo.");
      break;
    case "emisario":
      break;
  }
  e.influencia[id][region.nombre] = nueva;
  if (nueva !== inf) log.push(`La influencia de ${id} en ${region.nombre} sube a ${nueva}/5${nueva >= 5 ? ": manda en la sombra" : ""}.`);
  // Efecto en las relaciones con otro regente.
  if (objetivoRegente && objetivoRegente !== id) {
    const k = clave(id, objetivoRegente);
    const actual = afinidad(partida, id, objetivoRegente).valor;
    const cambio = d.tipo === "alianza" ? 1 : d.tipo === "traicion" ? -2 : d.tipo === "sabotaje" || d.tipo === "chantaje" ? -1 : 0;
    if (cambio) {
      const valor = Math.max(-3, Math.min(3, actual + cambio));
      e.relaciones[k] = { valor, motivo: `${d.tipo === "alianza" ? "acuerdo" : "hostilidad"}: ${d.detalle}`.slice(0, 200), paso: partida.secuencia?.total ?? 0 };
      log.push(`Relación ${id} ↔ ${objetivoRegente}: ${etiqueta(actual)} → ${etiqueta(valor)}.`);
    }
  }
  e.jugadas.push({ regente: id, tipo: d.tipo, region: region.nombre, ...(d.objetivo ? { objetivo: d.objetivo } : {}), detalle: d.detalle.slice(0, 200), paso: partida.secuencia?.total ?? 0 });
  if (e.jugadas.length > 20) e.jugadas.splice(0, e.jugadas.length - 20);
  e.sinJugada = 0;
  const pistas = PISTAS[d.tipo];
  return [
    `${id} mueve ficha en ${region.nombre} (${d.tipo.replace(/_/g, " ")}${d.objetivo ? ` contra/con ${d.objetivo}` : ""}): ${d.detalle}`,
    habitual === false ? `(No es lo habitual en él/ella; si lo haces, que se note el porqué.)` : "",
    ...log,
    `Que su eco llegue a los protagonistas, sin explicarlo entero: ${pistas.join(" · ")}. Registra a sus agentes como PNJ con agenda (pnj) y, si pesa, abre o avanza un arco (trama).`,
  ].filter(Boolean).join("\\n");
}

export function contarTurno(partida: Partida): void {
  if (partida.regentes) partida.regentes.sinJugada = (partida.regentes.sinJugada ?? 0) + 1;
}

/** Lo que ve el DM: influencia por región, relaciones vigentes y qué las empuja a cambiar. */
export function textoRegentes(partida: Partida, completo = false): string {
  const e = partida.regentes;
  const ids = REGENTES.map((r) => r.id);
  const pares: [string, string][] = [[ids[0], ids[1]], [ids[0], ids[2]], [ids[1], ids[2]]];
  const rel = pares.map(([a, b]) => {
    const f = afinidad(partida, a, b);
    return `- ${a} ↔ ${b}: ${f.etiqueta.toUpperCase()} (${f.valor >= 0 ? "+" : ""}${f.valor})${completo || f.razones.length > 1 ? ` — ${f.razones.join("; ")}` : ""}${completo ? `. Puede cambiar: ${BASE[clave(a, b)].cambia.join(" · ")}` : ""}`;
  });
  const infl = e
    ? ids
        .map((id) => {
          const regs = Object.entries(e.influencia[id] ?? {}).filter(([, v]) => v > 0).map(([r, v]) => `${r} ${v}/5`);
          const esp = (e.espias[id] ?? []).length ? ` · espías en ${e.espias[id].join(", ")}` : "";
          return regs.length || esp ? `- ${id}: ${regs.join(", ") || "sin influencia fuera de su dominio"}${esp}` : "";
        })
        .filter(Boolean)
    : [];
  const ultimas = e?.jugadas.slice(-3).map((j) => `${j.regente}: ${j.tipo.replace(/_/g, " ")} en ${j.region}${j.objetivo ? ` (${j.objetivo})` : ""} — ${j.detalle}`) ?? [];
  const aviso = !e || e.sinJugada >= 10 ? `⚠ ${e ? `Llevan ${e.sinJugada} turnos sin mover ficha en la política` : "Todavía no han movido ficha"}: haz que un regente haga una jugada fuera de su dominio (herramienta regente) y deja que su eco llegue a los protagonistas.` : "";
  return [
    "## Regentes: política en segundo plano (insisten en imponerse; sus relaciones cambian con la conveniencia)",
    ...rel,
    ...(infl.length ? ["Influencia fuera de su dominio:", ...infl] : []),
    ...(ultimas.length ? ["Últimas jugadas:", ...ultimas.map((x) => `- ${x}`)] : []),
    aviso,
  ].filter(Boolean).join("\\n");
}

/** Multiplicador de peso para las familias de enemigos según la influencia de cada regente en la región. */
export function pesoPorInfluencia(partida: Partida, region: string): Record<string, number> {
  const e = partida.regentes;
  const r = buscarRegion(region);
  if (!e || !r) return {};
  const f: Record<string, number> = {};
  const sube = (fam: string, v: number) => { if (v > 0) f[fam] = (f[fam] ?? 1) + 0.3 * v; };
  sube("inquisicion", e.influencia["Juez Sin Ojos"]?.[r.nombre] ?? 0);
  sube("corte_palida", e.influencia["Ysolde"]?.[r.nombre] ?? 0);
  sube("no-muertos", e.influencia["Madre de los Hambrientos"]?.[r.nombre] ?? 0);
  sube("culto", e.influencia["Madre de los Hambrientos"]?.[r.nombre] ?? 0);
  return f;
}

export const REGLAS_REGENTES = `## Regentes: política en segundo plano
- El Juez Sin Ojos, Ysolde y la Madre de los Hambrientos son REGENTES: además de mandar en su dominio y de enviar monstruos y minions, inciden políticamente en otros sitios para imponerse: compran voluntades (cargos, licencias, favores, sobornos), tienen espías, sabotean (incendios, archivos quemados, pozos envenenados, rivales declarados herejes), chantajean y hacen propaganda. La Madre lo hace a través de los Devotos del Dios Hambriento y los ghuls.
- Sus relaciones entre sí NO son fijas: dependen de la conveniencia y la situación. El estado trae cada pareja con su etiqueta (guerra, rivalidad, recelo, neutral, tregua, colaboración, alianza), por qué es así y qué la puede cambiar. Un enemigo común, una región disputada o una jugada hostil la mueven: hoy pueden pactar y mañana traicionarse. Cuando cambie por algo ocurrido, fíjalo con regente accion=relacion (valor y motivo).
- Cada pocos turnos (el programa te avisa) haz que un regente mueva ficha con regente accion=jugada (regente, tipo, region, detalle, objetivo si lo hay): sube su influencia en esa región, deja pistas y cambia sus relaciones. Que su eco llegue a los protagonistas como un cambio en el mundo (un alguacil con oro nuevo, un pozo envenenado, un rival declarado hereje), sin contar la jugada entera; los protagonistas siguen siendo el foco. Registra a sus agentes como PNJ con agenda y, si pesa, como arco.
- Cuanta más influencia tiene un regente en una región, más aparecen allí sus agentes en los encuentros (el programa lo aplica en encuentro).`;
