// Combate: iniciativa y ataques resueltos por el programa. La experiencia del
// combatiente (veteranía), su raza o naturaleza y su clase deciden lo fácil que
// es que falle: un recluta se enreda con su propia arma a menos que golpee
// primero; un veterano casi nunca falla del todo, y cuando falla aún roza.
import { danar, estadoTexto, type Criatura, type EstadoJefe } from "./bestiario.js";
import { describir, tirar, type Modo } from "./dados.js";
import type { Partida, Personaje } from "./estado.js";
import { competencia, mod, signo, valor } from "./reglas.js";

export const VETERANIAS = ["recluta", "curtido", "veterano", "leyenda"] as const;
export type Veterania = (typeof VETERANIAS)[number];

interface Oficio {
  /** Bonificador al ataque. */
  golpe: number;
  iniciativa: number;
  /** Penalizador por nervios si no actúa antes que su rival. */
  nervios: number;
  /** Un d20 natural igual o menor que esto es una torpeza (fallo seguro) si no actúa antes que su rival; si actúa antes, solo el 1. */
  torpeza: number;
  /** Si falla por este margen o menos, aún roza (mitad de daño, sin herida). */
  roce: number;
  /** Crítico con este natural o más. */
  critico: number;
  /** Repite el 1 natural (una vez por tirada). */
  repiteUno: boolean;
  descripcion: string;
}

export const OFICIO: Record<Veterania, Oficio> = {
  recluta: { golpe: 0, iniciativa: 0, nervios: -2, torpeza: 2, roce: 0, critico: 20, repiteUno: false, descripcion: "pocas peleas de verdad: −2 por nervios y torpeza con 1-2 natural, salvo si actúa antes que su rival" },
  curtido: { golpe: 1, iniciativa: 1, nervios: -1, torpeza: 1, roce: 1, critico: 20, repiteUno: false, descripcion: "algunos años de oficio: +1 a atacar e iniciativa, −1 por nervios si no actúa antes que su rival; si falla por 1, roza" },
  veterano: { golpe: 2, iniciativa: 2, nervios: 0, torpeza: 1, roce: 2, critico: 20, repiteUno: false, descripcion: "muchos años matando: +2 a atacar e iniciativa; si falla por 2 o menos, aún roza" },
  leyenda: { golpe: 3, iniciativa: 3, nervios: 0, torpeza: 1, roce: 3, critico: 19, repiteUno: true, descripcion: "toda una vida en el filo: +3 a atacar e iniciativa, repite el 1 natural, roza si falla por 3 o menos y hace crítico con 19-20" },
};

/** Veteranía por defecto según el nivel (el DM la fija por trasfondo al crear el personaje). */
export const veteraniaPorNivel = (nivel: number): Veterania => (nivel >= 13 ? "leyenda" : nivel >= 7 ? "veterano" : nivel >= 3 ? "curtido" : "recluta");
export const veteraniaDe = (p: Personaje): Veterania => p.veterania ?? veteraniaPorNivel(p.nivel);

interface Temple {
  iniciativa: number;
  cuerpo: number;
  distancia: number;
  /** Se suma al rango de torpeza. */
  torpeza: number;
  repiteUno?: boolean;
  nota: string;
}

/** Carácter en combate de cada raza y naturaleza. */
export const TEMPLES: Record<string, Temple> = {
  "Humano del Faro": { iniciativa: 0, cuerpo: 0, distancia: 0, torpeza: 0, nota: "tozudos y versátiles: sin ventajas ni vicios" },
  "Enano de Karak-Dûm": { iniciativa: -1, cuerpo: 1, distancia: 0, torpeza: 0, nota: "lentos en arrancar, implacables cuerpo a cuerpo (+1)" },
  "Elfo Marchito": { iniciativa: 2, cuerpo: 0, distancia: 1, torpeza: 0, nota: "reflejos de siglos (+2 iniciativa), certeros a distancia (+1)" },
  "Mediano de Hollín": { iniciativa: 1, cuerpo: 0, distancia: 1, torpeza: 0, repiteUno: true, nota: "rápidos y afortunados: repiten el 1 natural, +1 a distancia" },
  Varg: { iniciativa: 1, cuerpo: 1, distancia: -1, torpeza: 0, nota: "instinto de lobo: +1 iniciativa y cuerpo a cuerpo, −1 a distancia" },
  "Nacido Pálido": { iniciativa: 2, cuerpo: 0, distancia: 0, torpeza: 0, nota: "reflejos de depredador (+2 iniciativa)" },
  Cenizo: { iniciativa: 0, cuerpo: 0, distancia: 0, torpeza: 0, nota: "serenos: sin ventajas ni vicios" },
  "no-muerto torpe": { iniciativa: -3, cuerpo: 0, distancia: -2, torpeza: 1, nota: "carne muerta sin mente: −3 iniciativa y una torpeza más" },
  "no-muerto": { iniciativa: -1, cuerpo: 0, distancia: 0, torpeza: 0, nota: "muertos con mente, sin reflejos de vivo: −1 iniciativa" },
  vampiro: { iniciativa: 2, cuerpo: 0, distancia: 0, torpeza: 0, nota: "velocidad antinatural: +2 iniciativa" },
  espectro: { iniciativa: 1, cuerpo: 0, distancia: 0, torpeza: 0, nota: "incorpóreos: +1 iniciativa" },
  bestia: { iniciativa: 1, cuerpo: 0, distancia: 0, torpeza: 0, nota: "instinto: +1 iniciativa" },
};
export const NOMBRES_TEMPLES = Object.keys(TEMPLES) as [string, ...string[]];
const SIN_TEMPLE: Temple = { iniciativa: 0, cuerpo: 0, distancia: 0, torpeza: 0, nota: "" };
const temple = (t?: string) => (t ? (TEMPLES[t] ?? Object.entries(TEMPLES).find(([k]) => k.toLowerCase() === t.toLowerCase())?.[1] ?? SIN_TEMPLE) : SIN_TEMPLE);

/** Estilo de lucha de cada clase. */
export const ESTILO_CLASE: Record<string, { iniciativa: number; cuerpo: number; distancia: number; torpeza: number; nota: string }> = {
  "Mercenario del Cuervo": { iniciativa: 0, cuerpo: 1, distancia: 1, torpeza: 0, nota: "oficio de la Compañía: +1 a todo ataque con armas" },
  "Berserker de Ceniza": { iniciativa: 1, cuerpo: 1, distancia: 0, torpeza: 1, nota: "furia: +1 iniciativa y cuerpo a cuerpo, pero una torpeza más" },
  "Caballero Juramentado": { iniciativa: -1, cuerpo: 1, distancia: 0, torpeza: 0, nota: "disciplina (+1 cuerpo a cuerpo) bajo acero pesado (−1 iniciativa)" },
  "Cazador de Brujas": { iniciativa: 1, cuerpo: 0, distancia: 1, torpeza: 0, nota: "+1 iniciativa y a distancia" },
  Degollador: { iniciativa: 2, cuerpo: 0, distancia: 0, torpeza: 0, nota: "golpea primero: +2 iniciativa" },
  Flagelante: { iniciativa: 1, cuerpo: 0, distancia: 0, torpeza: 0, nota: "+1 iniciativa" },
  Segador: { iniciativa: 0, cuerpo: 0, distancia: 0, torpeza: 0, nota: "" },
  Hechicero: { iniciativa: 0, cuerpo: -2, distancia: -2, torpeza: 1, nota: "no es un guerrero: −2 con armas y una torpeza más (sus hechizos van con lanzar_hechizo)" },
  "Barbero-Cirujano": { iniciativa: 0, cuerpo: 0, distancia: 0, torpeza: 0, nota: "" },
};
const SIN_ESTILO = { iniciativa: 0, cuerpo: 0, distancia: 0, torpeza: 0, nota: "" };

/** PNJ sin ficha que entran en un combate (un capitán, unos bandidos…). */
export interface PnjCombate {
  nombre: string;
  bono_ataque: number;
  ca: number;
  des?: number;
  veterania?: Veterania;
  temple?: string;
}

export interface EstadoCombate {
  ronda: number;
  orden: { nombre: string; total: number }[];
  pnj: Record<string, PnjCombate>;
}

type Combatiente =
  | { tipo: "pj"; nombre: string; p: Personaje }
  | { tipo: "criatura"; nombre: string; j: EstadoJefe }
  | { tipo: "pnj"; nombre: string; n: PnjCombate };

const igual = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

function localizar(partida: Partida, nombre: string): Combatiente {
  const p = partida.personajes[nombre] ?? Object.values(partida.personajes).find((x) => igual(x.nombre, nombre));
  if (p) return { tipo: "pj", nombre: p.nombre, p };
  const jefes = Object.values(partida.jefes);
  const j = partida.jefes[nombre] ?? jefes.find((x) => igual(x.nombre, nombre)) ?? jefes.find((x) => x.nombre.toLowerCase().includes(nombre.toLowerCase()));
  if (j) return { tipo: "criatura", nombre: j.nombre, j };
  const pnjs = Object.values(partida.combate?.pnj ?? {});
  const n = pnjs.find((x) => igual(x.nombre, nombre));
  if (n) return { tipo: "pnj", nombre: n.nombre, n };
  throw new Error(
    `"${nombre}" no es un personaje, ni una criatura en escena, ni un PNJ del combate. Registra a los PNJ sin ficha en iniciativa (pnj) y a las criaturas con aparecer_criatura.`,
  );
}

const NO_MUERTO_PJ = /no-muerto|no muerto|retornad|cadáver andante/i;

function templeDe(c: Combatiente): string | undefined {
  if (c.tipo === "pj") return c.p.condiciones.some((x) => NO_MUERTO_PJ.test(x)) ? "no-muerto" : c.p.raza;
  if (c.tipo === "criatura") return c.j.definicion.temple;
  return c.n.temple;
}

function veteraniaCombatiente(c: Combatiente): Veterania {
  if (c.tipo === "pj") return veteraniaDe(c.p);
  if (c.tipo === "pnj") return c.n.veterania ?? "curtido";
  // Las criaturas ya llevan su pericia en el bonificador de su ficha: solo fallan seguro con un 1.
  return "veterano";
}

const desDeCriatura = (c: Criatura) => Number(/DES\s*(\d+)/i.exec(c.atributos)?.[1] ?? 10);

function bonoIniciativa(c: Combatiente): { bono: number; modo: Modo; detalle: string } {
  const t = temple(templeDe(c));
  const of = c.tipo === "criatura" ? 0 : OFICIO[veteraniaCombatiente(c)].iniciativa;
  const estilo = c.tipo === "pj" ? (ESTILO_CLASE[c.p.clase] ?? SIN_ESTILO).iniciativa : 0;
  const des = c.tipo === "pj" ? valor(c.p, "des") : c.tipo === "criatura" ? desDeCriatura(c.j.definicion) : (c.n.des ?? 10);
  const presciencia = c.tipo === "criatura" && c.j.definicion.rasgos.some((r) => /ventaja en iniciativa/i.test(r));
  const partes = [`DES ${signo(mod(des))}`, of ? `oficio ${signo(of)}` : "", t.iniciativa ? `temple ${signo(t.iniciativa)}` : "", estilo ? `clase ${signo(estilo)}` : ""];
  return { bono: mod(des) + of + t.iniciativa + estilo, modo: presciencia ? "ventaja" : "normal", detalle: partes.filter(Boolean).join(", ") };
}

export function tirarIniciativa(partida: Partida, nombres: string[], pnj: PnjCombate[]): string {
  const combate: EstadoCombate = { ronda: 1, orden: [], pnj: {} };
  for (const n of pnj) combate.pnj[n.nombre] = n;
  partida.combate = combate;
  const lista = [...nombres, ...pnj.map((n) => n.nombre)];
  const lineas: string[] = [];
  const tiradas = lista.map((nombre) => {
    const c = localizar(partida, nombre);
    const b = bonoIniciativa(c);
    const t = tirar(`1d20${signo(b.bono)}`, b.modo);
    lineas.push(`${c.nombre}: ${describir(t)}${b.modo === "ventaja" ? " (ventaja)" : ""} [${b.detalle}]`);
    return { nombre: c.nombre, total: t.total, des: b.bono };
  });
  tiradas.sort((a, b) => b.total - a.total || b.des - a.des);
  combate.orden = tiradas.map(({ nombre, total }) => ({ nombre, total }));
  return `Iniciativa:\n${lineas.join("\n")}\nOrden: ${combate.orden.map((o) => `${o.nombre} (${o.total})`).join(" → ")}`;
}

/** ¿Actúa el atacante antes que el objetivo en este combate? */
function actuaAntes(partida: Partida, a: string, b: string): boolean {
  const orden = partida.combate?.orden ?? [];
  const ia = orden.findIndex((o) => igual(o.nombre, a));
  const ib = orden.findIndex((o) => igual(o.nombre, b));
  return ia >= 0 && ib >= 0 && ia < ib;
}

const CONDICIONES_DESVENTAJA = /envenenad|asustad|cegad|jadeando|agotad|apresad/i;

export interface DatosAtaque {
  atacante: string;
  objetivo: string;
  arma?: string;
  dano?: string;
  a_distancia?: boolean;
  atributo?: "fue" | "des" | "car" | "sab" | "int";
  bono_arma?: number;
  bono?: number;
  ventaja?: boolean;
  desventaja?: boolean;
  ca?: number;
}

export interface ResultadoAtaque {
  texto: string;
  aviso: string;
  /** Criatura que ha caído con este ataque (para devolver lo que robó y sacarla de escena). */
  muerto?: string;
}

/** Bonificador de ataque de una criatura: el que se pasa o el del ataque nombrado (o el primero) de su ficha. */
function bonoCriatura(c: Criatura, arma?: string): number {
  const linea = (arma && c.ataques.find((a) => a.toLowerCase().includes(arma.toLowerCase()))) || c.ataques[0] || "";
  const m = /:\s*\+(\d+)/.exec(linea);
  if (!m) throw new Error(`No encuentro el bonificador de ataque de ${c.nombre}: pásalo en "bono".`);
  return Number(m[1]);
}

function doblarDados(expr: string): string {
  return expr.replace(/(\d*)d(\d+)/gi, (_, n, c) => `${(Number(n) || 1) * 2}d${c}`);
}

/** Tira una expresión de daño que puede sumar varios grupos de dados ("2d6+3+1d8"). */
function tirarDano(expr: string): { total: number; texto: string } {
  const partes = expr.replace(/\s+/g, "").replace(/-/g, "+-").split("+").filter(Boolean);
  let total = 0;
  const textos: string[] = [];
  for (const parte of partes) {
    if (/d/i.test(parte)) {
      const t = tirar(parte.replace(/^-/, ""));
      const v = parte.startsWith("-") ? -t.total : t.total;
      total += v;
      textos.push(`${parte}[${t.dados.join(",")}]`);
    } else {
      total += Number(parte);
      textos.push(parte);
    }
  }
  return { total: Math.max(0, total), texto: `${textos.join(" + ")} = ${Math.max(0, total)}` };
}

export function atacar(partida: Partida, d: DatosAtaque): ResultadoAtaque {
  const at = localizar(partida, d.atacante);
  const ob = localizar(partida, d.objetivo);
  const distancia = !!d.a_distancia;
  const vet = veteraniaCombatiente(at);
  const of = OFICIO[vet];
  const tp = temple(templeDe(at));
  const estilo = at.tipo === "pj" ? (ESTILO_CLASE[at.p.clase] ?? SIN_ESTILO) : SIN_ESTILO;
  const desglose: string[] = [];

  // Bonificador
  let bono: number;
  if (at.tipo === "pj") {
    const p = at.p;
    const attr = d.atributo ?? (distancia ? "des" : valor(p, "des") > valor(p, "fue") ? "des" : "fue");
    const mAttr = mod(valor(p, attr));
    const comp = competencia(p);
    const extraTemple = distancia ? tp.distancia : tp.cuerpo;
    const extraClase = distancia ? estilo.distancia : estilo.cuerpo;
    bono = mAttr + comp + of.golpe + extraTemple + extraClase + (d.bono_arma ?? 0);
    desglose.push(`${attr.toUpperCase()} ${signo(mAttr)}`, `competencia ${signo(comp)}`);
    if (of.golpe) desglose.push(`${vet} ${signo(of.golpe)}`);
    if (extraTemple) desglose.push(`raza ${signo(extraTemple)}`);
    if (extraClase) desglose.push(`clase ${signo(extraClase)}`);
    if (d.bono_arma) desglose.push(`arma ${signo(d.bono_arma)}`);
  } else if (at.tipo === "criatura") {
    bono = (d.bono ?? bonoCriatura(at.j.definicion, d.arma)) + (d.bono_arma ?? 0);
    desglose.push(`ataque ${signo(bono)}`);
  } else {
    bono = (d.bono ?? at.n.bono_ataque) + of.golpe + (distancia ? tp.distancia : tp.cuerpo) + (d.bono_arma ?? 0);
    desglose.push(`base ${signo(d.bono ?? at.n.bono_ataque)}`);
    if (of.golpe) desglose.push(`${vet} ${signo(of.golpe)}`);
    const extra = distancia ? tp.distancia : tp.cuerpo;
    if (extra) desglose.push(`temple ${signo(extra)}`);
  }

  // Defensa
  const ca = d.ca ?? (ob.tipo === "pj" ? ob.p.ca : ob.tipo === "criatura" ? ob.j.definicion.ca : ob.n.ca);

  // Ventaja y desventaja
  let ventaja = !!d.ventaja;
  let desventaja = !!d.desventaja;
  const motivos: string[] = [];
  if (at.tipo === "pj" && at.p.condiciones.some((c) => CONDICIONES_DESVENTAJA.test(c))) {
    desventaja = true;
    motivos.push(`desventaja por ${at.p.condiciones.filter((c) => CONDICIONES_DESVENTAJA.test(c)).join(", ")}`);
  }
  if (ob.tipo === "pj" && ob.p.condiciones.some((c) => /inconsciente|paralizad|derribad/i.test(c)) && !distancia) {
    ventaja = true;
    motivos.push("ventaja: el objetivo está en el suelo o indefenso");
  }
  const modo: Modo = ventaja && !desventaja ? "ventaja" : desventaja && !ventaja ? "desventaja" : "normal";

  // Torpeza: cuanto menos oficio, más fácil enredarse… salvo si golpea antes que su rival.
  const primero = actuaAntes(partida, at.nombre, ob.nombre);
  const torpezaBase = at.tipo === "criatura" ? 1 : of.torpeza;
  const torpeza = Math.max(1, (primero ? 1 : torpezaBase) + tp.torpeza + estilo.torpeza);
  const nervios = at.tipo === "criatura" || primero ? 0 : of.nervios;
  if (nervios) {
    bono += nervios;
    desglose.push(`nervios ${signo(nervios)}`);
  }

  let t = tirar(`1d20${signo(bono)}`, modo);
  let repetido = "";
  if (t.dados[0] === 1 && (of.repiteUno && at.tipo !== "criatura" || tp.repiteUno)) {
    const antes = describir(t);
    t = tirar(`1d20${signo(bono)}`, "normal");
    repetido = ` (repite el 1: ${antes})`;
  }
  const natural = t.dados[0];
  const umbralCritico = at.tipo === "criatura" ? 20 : of.critico;
  const margen = t.total - ca;

  let resultado: "torpeza" | "fallo" | "roce" | "impacto" | "critico";
  if (natural >= umbralCritico) resultado = "critico";
  else if (natural <= torpeza) resultado = "torpeza";
  else if (margen >= 0) resultado = "impacto";
  else if (at.tipo !== "criatura" && -margen <= of.roce) resultado = "roce";
  else resultado = "fallo";

  const lineas = [
    `${at.nombre}${at.tipo !== "criatura" ? ` (${vet})` : ""} ataca a ${ob.nombre}${d.arma ? ` con ${d.arma}` : ""}${distancia ? " a distancia" : ""}: ` +
      `${describir(t)}${modo !== "normal" ? ` (${modo})` : ""}${repetido} [${desglose.join(", ")}] vs CA ${ca}`,
  ];
  if (motivos.length) lineas.push(motivos.join("; "));
  if (primero && at.tipo !== "criatura" && (of.nervios || torpezaBase > 1)) lineas.push(`Actúa antes que ${ob.nombre}: golpea sin nervios.`);
  if (torpeza > 1) lineas.push(`Torpeza con 1-${torpeza} natural.`);

  const etiquetas = {
    torpeza: "TORPEZA: falla y queda expuesto (el siguiente ataque contra él tiene ventaja, o se le cae el arma, o pierde pie: narra según su oficio)",
    fallo: "FALLO",
    roce: "ROCE: la experiencia lo salva; mitad de daño y sin herida",
    impacto: "IMPACTO",
    critico: "¡CRÍTICO! dados de daño dobles",
  } as const;
  lineas.push(`→ ${etiquetas[resultado]}`);

  let dano = 0;
  let muerto: string | undefined;
  if (d.dano && (resultado === "impacto" || resultado === "critico" || resultado === "roce")) {
    const r = tirarDano(resultado === "critico" ? doblarDados(d.dano) : d.dano);
    dano = resultado === "roce" ? Math.floor(r.total / 2) : r.total;
    lineas.push(`Daño: ${r.texto}${resultado === "roce" ? ` → la mitad, ${dano}` : ""}`);
    if (ob.tipo === "criatura") {
      lineas.push(danar(ob.j, dano));
      if (ob.j.pv <= 0) muerto = ob.j.nombre;
    } else if (ob.tipo === "pj") {
      const p = ob.p;
      p.pv = Math.max(0, p.pv - dano);
      lineas.push(`${p.nombre}: −${dano} PV → ${p.pv}/${p.pv_max}.`);
      const herida =
        resultado === "critico" ? "critico" : resultado === "roce" ? null : p.pv === 0 ? "cero_pv" : dano >= Math.ceil(p.pv_max / 2) ? "golpe_masivo" : null;
      if (herida) lineas.push(`Ahora usa infligir_herida con causa "${herida}" para ${p.nombre}.`);
      else if (p.pv === 0) lineas.push(`Ahora usa infligir_herida con causa "cero_pv" para ${p.nombre}.`);
    } else {
      lineas.push(`${ob.nombre} recibe ${dano} de daño (lleva tú sus PV).`);
    }
  } else if (resultado === "critico" && ob.tipo === "pj") {
    lineas.push(`Si el golpe hace daño, usa infligir_herida con causa "critico" para ${ob.nombre}.`);
  }

  const icono = resultado === "critico" ? "💥" : resultado === "impacto" ? "⚔️" : resultado === "roce" ? "🗡️" : "💨";
  const estadoObj = ob.tipo === "criatura" ? ` (${estadoTexto(ob.j)})` : ob.tipo === "pj" && dano ? ` (${ob.p.pv}/${ob.p.pv_max} PV)` : "";
  const aviso =
    `${icono} ${at.nombre} → ${ob.nombre}: ${resultado === "critico" ? "¡crítico!" : resultado === "torpeza" ? "torpeza" : resultado}` +
    `${ob.tipo === "criatura" ? "" : ` (${t.total} vs CA ${ca})`}${dano ? `, ${dano} de daño` : ""}${estadoObj}`;
  return { texto: lineas.join("\n"), aviso, muerto };
}

export const REGLAS_COMBATE = `## Combate (iniciativa y ataques los resuelve el programa)
- Al empezar un combate, iniciativa con todos: PJ, criaturas en escena y los PNJ sin ficha (pnj: nombre, bono_ataque, ca, des, veterania, temple). Guarda el orden; repítela solo en un combate nuevo.
- Cada ataque con armas (de PJ, criatura o PNJ) va con atacar. Si pasas dano (p. ej. "1d8+3", con el modificador ya sumado), se tira y se aplica solo: a las criaturas en escena y a los PJ (te dirá si toca infligir_herida). Los hechizos van con lanzar_hechizo.
- Veteranía (ponla en guardar_personaje según el trasfondo: quien lleva años en el oficio NO es recluta aunque sea nivel 1; sin ella se deduce del nivel). Los PNJ también la tienen: un capitán de la Compañía es veterano o leyenda, un miliciano es recluta.
${Object.entries(OFICIO).map(([k, o]) => `  - ${k}: ${o.descripcion}.`).join("\n")}
- Actuar antes que el rival (iniciativa) quita los nervios y la torpeza extra a reclutas y curtidos: sin iniciativa tirada, los sufren siempre.
- Temple de cada raza o naturaleza (en las criaturas, campo temple de su ficha):
${Object.entries(TEMPLES).map(([k, t]) => `  - ${k}: ${t.nota}.`).join("\n")}
- Estilo de cada clase:
${Object.entries(ESTILO_CLASE).filter(([, e]) => e.nota).map(([k, e]) => `  - ${k}: ${e.nota}.`).join("\n")}
- Las criaturas usan el bonificador de su ficha (o "bono"), fallan seguro solo con un 1 y no rozan. Envenenado, asustado, cegado, jadeando, agotado o apresado dan desventaja al PJ que ataca.`;
