// El bestiario del grupo: lo que los personajes saben de cada criatura. Los monstruos corrientes están siempre a la
// vista con su información general; los jefes aparecen cuando el grupo los conoce (los encuentra o se descubren). Cada
// ficha crece con la experiencia: enfrentarse a una criatura enseña cómo ataca, derrotarla enseña sus rasgos y
// debilidades, y el DM puede dar al grupo más conocimiento de lore (capas de saber.ts) o notas con saber {descubrir}.
import { BESTIARIO, buscarCriatura, type Criatura, type EstadoJefe } from "./bestiario.js";
import type { Partida } from "./estado.js";
import { buscarTema, TEMAS, type Capa, type TemaSaber } from "./saber.js";

export interface RegistroCodice {
  vistas: number;
  derrotadas: number;
  /** Capas de lore que el grupo ya conoce (erudito, restringido, secreto). */
  capas: Capa[];
  /** Cosas que el grupo ha averiguado (las anota el DM). */
  notas: string[];
}

export interface SeccionCodice {
  titulo: string;
  texto?: string;
  /** Si está bloqueada: cómo se desbloquea. */
  bloqueada?: string;
}

export interface EntradaCodice {
  nombre: string;
  categoria: Criatura["categoria"];
  peligro: number;
  region: string;
  secciones: SeccionCodice[];
  notas: string[];
  vistas: number;
  derrotadas: number;
  /** Cuántas secciones conoce el grupo y cuántas tiene la ficha. */
  conocido: number;
  total: number;
  /** Sube cada vez que el grupo aprende algo: la página la compara con la última que vio el jugador. */
  version: number;
}

const norm = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
/** Jefes que todo el mundo conoce de nombre: aparecen en el bestiario desde el principio. */
const JEFES_PUBLICOS = new Set(["el juez sin ojos", "hugin, el pensamiento", "munin, la memoria"].map(norm));

const registro = (p: Partida, nombre: string): RegistroCodice => ((p.codice ??= {})[norm(nombre)] ??= { vistas: 0, derrotadas: 0, capas: [], notas: [] });
const registroDe = (p: Partida, nombre: string): RegistroCodice | undefined => p.codice?.[norm(nombre)];

/** Antes de una herramienta: las criaturas en escena (para ver después cuáles han caído). */
export const criaturasEnEscena = (p: Partida): EstadoJefe[] => Object.values(p.jefes);

/** Después de una herramienta: anota las criaturas nuevas como vistas y las caídas como derrotadas. */
export function actualizarCodice(p: Partida, antes: EstadoJefe[]): void {
  const visibles = new Set<EstadoJefe>([...antes, ...Object.values(p.jefes)]);
  for (const j of visibles) {
    const nombre = j.definicion?.nombre;
    if (!nombre || !BESTIARIO.some((c) => c.nombre === nombre)) continue;
    const m = j as EstadoJefe & { cod_visto?: boolean; cod_derrota?: boolean };
    if (!m.cod_visto) { m.cod_visto = true; registro(p, nombre).vistas++; }
    if (j.pv <= 0 && !m.cod_derrota) { m.cod_derrota = true; registro(p, nombre).derrotadas++; }
  }
}

/** El tema de lore de una criatura (si lo hay): el escrito a mano o el de su ficha. */
const temaDe = (c: Criatura): TemaSaber | undefined => buscarTema(c.nombre);

const primera = (t: string) => t.split(/(?<=[.!?])\s/)[0] ?? t;

/** La ficha del bestiario de una criatura según lo que el grupo sabe. */
function entradaDe(p: Partida, c: Criatura): EntradaCodice {
  const r = registroDe(p, c.nombre) ?? { vistas: 0, derrotadas: 0, capas: [], notas: [] };
  const tema = temaDe(c);
  const curado = !!tema && TEMAS.some((t) => t.id === tema.id);
  const reveladas = (tema ? p.saber?.reveladas?.[tema.id] : undefined) ?? [];
  const sabe = (capa: Capa) => r.capas.includes(capa) || reveladas.includes(capa);
  const secciones: SeccionCodice[] = [];
  // Lo que se ve: los monstruos y los jefes sin lore secreto enseñan su descripción; los jefes con lore, solo lo público de su tema.
  if (c.categoria === "jefe" && (curado || c.trasfondo)) {
    secciones.push({ titulo: "Lo que se sabe", texto: tema?.publico ?? primera(c.descripcion) });
  } else {
    secciones.push({ titulo: "Lo que se ve", texto: c.descripcion });
    if (c.categoria === "jefe" && tema?.publico) secciones[0].texto = `${primera(c.descripcion)} ${tema.publico}`;
  }
  if (tema?.rumor) secciones.push({ titulo: "Lo que se dice (rumor)", texto: tema.rumor });
  secciones.push(r.vistas > 0 ? { titulo: "Cómo ataca", texto: c.ataques.join(" · ") } : { titulo: "Cómo ataca", bloqueada: "Hay que enfrentarse a ella para saberlo." });
  secciones.push(r.derrotadas > 0 ? { titulo: "Rasgos y puntos débiles", texto: c.rasgos.filter((x) => !/^Origen \(secreto/.test(x)).join(" · ") } : { titulo: "Rasgos y puntos débiles", bloqueada: "Se descubre al derrotarla (o con la ayuda de un erudito)." });
  const conErudito = r.derrotadas > 0 || sabe("erudito");
  if (tema?.erudito) secciones.push(conErudito ? { titulo: "Lo que dicen los eruditos", texto: tema.erudito } : { titulo: "Lo que dicen los eruditos", bloqueada: "Los escribas y eruditos saben más: derrótala o pregúntales." });
  if (tema?.restringido && sabe("restringido")) secciones.push({ titulo: "Lo que sólo saben unos pocos", texto: tema.restringido });
  if (tema?.secreto && sabe("secreto")) secciones.push({ titulo: "La verdad", texto: tema.secreto });
  const conocido = secciones.filter((s) => !s.bloqueada).length + (r.notas.length ? 1 : 0);
  const total = secciones.length + (r.notas.length ? 1 : 0);
  return {
    nombre: c.nombre, categoria: c.categoria, peligro: c.peligro, region: c.region, secciones, notas: r.notas, vistas: r.vistas, derrotadas: r.derrotadas,
    conocido, total, version: r.vistas + r.derrotadas * 2 + r.capas.length * 3 + r.notas.length * 2 + reveladas.length * 3,
  };
}

/** ¿Aparece esta criatura en el bestiario del grupo? Los monstruos, siempre; los jefes, al conocerlos. */
function visible(p: Partida, c: Criatura): boolean {
  if (c.categoria !== "jefe") return true;
  if (JEFES_PUBLICOS.has(norm(c.nombre))) return true;
  const t = temaDe(c);
  return !!registroDe(p, c.nombre) || !!(t && (p.saber?.reveladas?.[t.id]?.length ?? 0) > 0);
}

/** Todo el bestiario del grupo: las entradas visibles (A–Z) y cuántos jefes aún no conoce. */
export function bestiarioGrupo(p: Partida): { entradas: EntradaCodice[]; ocultos: number } {
  const entradas: EntradaCodice[] = [];
  let ocultos = 0;
  for (const c of BESTIARIO) { if (visible(p, c)) entradas.push(entradaDe(p, c)); else ocultos++; }
  entradas.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  return { entradas, ocultos };
}

/** El DM da al grupo más conocimiento de una criatura: una capa de lore y/o una nota. */
export function descubrirCodice(p: Partida, d: { tema?: string; capa?: Capa; texto?: string }): string {
  const c = d.tema ? buscarCriatura(d.tema) : undefined;
  if (!c) throw new Error(`«${d.tema ?? ""}» no es una criatura del bestiario: dime cuál (nombre del bestiario) para anotar lo que el grupo ha averiguado.`);
  const r = registro(p, c.nombre);
  const out: string[] = [];
  if (d.capa && d.capa !== "secreto" && !r.capas.includes(d.capa)) { r.capas.push(d.capa); out.push(`capa «${d.capa}»`); }
  if (d.capa === "secreto" && !r.capas.includes("secreto")) { r.capas.push("secreto", "restringido", "erudito"); out.push("la verdad"); }
  if (d.texto) { r.notas.push(d.texto.slice(0, 300)); if (r.notas.length > 8) r.notas.shift(); out.push("una nota"); }
  if (!out.length && r.vistas === 0) { r.vistas = 1; out.push("la criatura ya es conocida"); }
  return `Bestiario del grupo — ${c.nombre}: ${out.join(", ") || "sin cambios"}.`;
}
