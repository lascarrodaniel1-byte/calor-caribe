// Trampas con CD y Percepción pasiva. El DM las coloca en secreto; el grupo las nota solo (pasiva) o las busca (prueba),
// se desarman con una prueba de Juego de manos y, si saltan, afectan como la habilidad de una criatura (salvación, daño, heridas…).
import { tiene } from "./dotes_base.js";
import { usarHabilidad, type Habilidad } from "./bestiario.js";
import { efectos } from "./condiciones.js";
import type { Partida, Personaje } from "./estado.js";
import { resolverPrueba, COMPETENCIAS_CLASE } from "./pruebas.js";
import { competencia, mod, valor } from "./reglas.js";

export interface Trampa {
  nombre: string;
  lugar?: string;
  cd_detectar: number;
  cd_desarmar: number;
  efecto: Habilidad;
  estado: "oculta" | "descubierta" | "desarmada" | "disparada";
  /** Vuelve a quedar armada tras saltar (un pozo de estacas no; una ballesta con cuerda, sí). */
  reutilizable?: boolean;
}

/** 10 + mod. de SAB + competencia en Percepción (la de su clase); −5 si va deprisa; 0 si no puede notar nada. */
export function percepcionPasiva(p: Personaje, rapido = false): number {
  const e = efectos(p.condiciones);
  if (p.pv <= 0 || p.condiciones.includes("muerto") || e.incapacitado || e.ids.includes("cegado")) return 0;
  const comp = (COMPETENCIAS_CLASE[p.clase] ?? []).includes("percepcion") ? competencia(p) : 0;
  const ojo = tiene(p, "ojo_de_cazador"); // Ojo de cazador: +5 y no pierde el −5 de ir deprisa
  return 10 + mod(valor(p, "sab")) + comp + (ojo ? 5 : 0) - (rapido && !ojo ? 5 : 0);
}

const norm = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
const vivos = (partida: Partida) => Object.values(partida.personajes).filter((p) => !p.condiciones.includes("muerto"));

function hallar(partida: Partida, nombre: string): Trampa {
  const t = Object.values(partida.trampas ?? {}).find((x) => norm(x.nombre) === norm(nombre)) ?? Object.values(partida.trampas ?? {}).find((x) => norm(x.nombre).includes(norm(nombre)));
  if (!t) throw new Error(`No hay ninguna trampa «${nombre}». Trampas: ${Object.values(partida.trampas ?? {}).map((x) => x.nombre).join(", ") || "ninguna"}.`);
  return t;
}

function personajes(partida: Partida, nombres: string[]): Personaje[] {
  return nombres.map((n) => {
    const p = vivos(partida).find((x) => norm(x.nombre) === norm(n) || (x.jugador && norm(x.jugador) === norm(n)));
    if (!p) throw new Error(`No hay ningún personaje vivo «${n}».`);
    return p;
  });
}

export interface DatosTrampa {
  accion: "colocar" | "detectar" | "desarmar" | "disparar" | "ver";
  nombre?: string;
  lugar?: string;
  cd_detectar?: number;
  cd_desarmar?: number;
  efecto?: Habilidad;
  reutilizable?: boolean;
  /** detectar (activo) y desarmar: quién lo intenta; disparar: quién la sufre. */
  quienes?: string[];
  /** detectar: busca de verdad (prueba de Percepción); si no, solo cuenta la Percepción pasiva. */
  activa?: boolean;
  /** desarmar: con herramientas de ladrón (competente) o sin ellas (desventaja). */
  herramientas?: boolean;
  /** detectar pasivo: el grupo va a ritmo rápido (−5). */
  rapido?: boolean;
}

export function trampa(partida: Partida, d: DatosTrampa): { texto: string; publico: string | null } {
  const todas = (partida.trampas ??= {});
  if (d.accion === "ver") {
    const l = Object.values(todas);
    return { texto: l.length ? l.map((t) => `${t.nombre}${t.lugar ? ` (${t.lugar})` : ""}: ${t.estado} · detectar CD ${t.cd_detectar}, desarmar CD ${t.cd_desarmar} · ${t.efecto.dano ?? ""} ${t.efecto.salvacion ? `salv. ${t.efecto.salvacion.toUpperCase()} CD ${t.efecto.cd}` : ""}`).join("\n") : "No hay trampas registradas.", publico: null };
  }
  if (d.accion === "colocar") {
    if (!d.nombre || !d.efecto || !d.cd_detectar) throw new Error("colocar: pasa nombre, cd_detectar (10 fácil, 15 normal, 20 difícil), cd_desarmar y efecto (como la habilidad de una criatura: salvación, cd, daño…).");
    if (Object.values(todas).some((x) => norm(x.nombre) === norm(d.nombre!))) throw new Error(`Ya hay una trampa «${d.nombre}».`);
    todas[d.nombre] = { nombre: d.nombre, lugar: d.lugar, cd_detectar: d.cd_detectar, cd_desarmar: d.cd_desarmar ?? d.cd_detectar, efecto: d.efecto, estado: "oculta", reutilizable: d.reutilizable };
    return { texto: `Trampa «${d.nombre}» colocada${d.lugar ? ` en ${d.lugar}` : ""} (secreta): detectar CD ${d.cd_detectar}, desarmar CD ${d.cd_desarmar ?? d.cd_detectar}.`, publico: null };
  }
  if (d.accion === "detectar") {
    const candidatas = Object.values(todas).filter((t) => t.estado === "oculta" && (!d.nombre || norm(t.nombre).includes(norm(d.nombre))) && (!d.lugar || norm(t.lugar ?? "").includes(norm(d.lugar))));
    if (!candidatas.length) return { texto: "No hay trampas ocultas aquí: nadie nota nada (no se lo digas como si hubiera algo).", publico: null };
    const lineas: string[] = [], vistas: string[] = [];
    for (const t of candidatas) {
      if (d.activa) {
        const quienes = personajes(partida, d.quienes?.length ? d.quienes : vivos(partida).map((p) => p.nombre));
        let hallada = false;
        for (const p of quienes) {
          const r = resolverPrueba(partida, { quien: p.nombre, habilidad: "percepcion", cd: t.cd_detectar, ventaja: tiene(p, "ojo_de_cazador"), motivo: "buscar trampas" });
          lineas.push(r.texto.replace(/ — buscar trampas/, ""));
          if (r.exito) { hallada = true; break; }
        }
        if (hallada) { t.estado = "descubierta"; vistas.push(t.nombre); }
      } else {
        const mejor = vivos(partida).map((p) => ({ p, v: percepcionPasiva(p, d.rapido) })).sort((a, b) => b.v - a.v)[0];
        if (mejor && mejor.v >= t.cd_detectar) { t.estado = "descubierta"; vistas.push(t.nombre); lineas.push(`${mejor.p.nombre} (Percepción pasiva ${mejor.v}) nota la trampa «${t.nombre}» (CD ${t.cd_detectar}).`); }
        else lineas.push(`Nadie la nota: la mejor Percepción pasiva es ${mejor?.v ?? 0}${d.rapido ? " (ritmo rápido, −5)" : ""} y la trampa «${t.nombre}» pide ${t.cd_detectar}.`);
      }
    }
    return { texto: lineas.join("\n"), publico: vistas.length ? `👁 El grupo descubre: ${vistas.join(", ")}.` : null };
  }
  if (!d.nombre) throw new Error(`${d.accion}: di el nombre de la trampa.`);
  const t = hallar(partida, d.nombre);
  if (d.accion === "desarmar") {
    if (t.estado === "oculta") throw new Error(`Nadie ha descubierto «${t.nombre}» todavía: no se puede desarmar lo que no se ve.`);
    if (t.estado === "desarmada") throw new Error(`«${t.nombre}» ya está desarmada.`);
    const quien = (d.quienes ?? [])[0];
    if (!quien) throw new Error("desarmar: di quién lo intenta (quienes).");
    const p = personajes(partida, [quien])[0];
    const r = resolverPrueba(partida, { quien: p.nombre, habilidad: "juego_de_manos", cd: t.cd_desarmar, competente: !!d.herramientas, desventaja: !d.herramientas, motivo: `desarmar ${t.nombre}` });
    if (r.exito) { t.estado = "desarmada"; return { texto: `${r.texto}\nLa trampa «${t.nombre}» queda desarmada.`, publico: `🛠 ${p.nombre} desarma «${t.nombre}».` }; }
    if ((r.margen ?? 0) <= -5) return { texto: `${r.texto}\nFalla por 5 o más: la trampa salta sobre ${p.nombre}.\n${disparar(partida, t, [p])}`, publico: `⚠ La trampa «${t.nombre}» salta sobre ${p.nombre}.` };
    return { texto: `${r.texto}\nNo logra desarmarla, pero tampoco la dispara: puede volver a intentarlo.`, publico: null };
  }
  // disparar
  if (t.estado === "desarmada") throw new Error(`«${t.nombre}» está desarmada: no salta.`);
  const objetivos = personajes(partida, d.quienes?.length ? d.quienes : []);
  if (!objetivos.length) throw new Error("disparar: di quién la sufre (quienes).");
  return { texto: disparar(partida, t, objetivos), publico: `⚠ ¡Salta la trampa «${t.nombre}»!` };
}

function disparar(partida: Partida, t: Trampa, objetivos: Personaje[]): string {
  const antes = t.estado;
  const texto = usarHabilidad(undefined, { ...t.efecto, recarga: undefined }, objetivos);
  t.estado = t.reutilizable ? (antes === "descubierta" ? "descubierta" : "oculta") : "disparada";
  return `Salta «${t.nombre}»${antes === "descubierta" ? " (ya conocida)" : ""}.\n${texto}`;
}

export function textoTrampas(partida: Partida): string {
  const l = Object.values(partida.trampas ?? {}).filter((t) => t.estado !== "disparada");
  if (!l.length) return "";
  return `## Trampas (secretas del DM)\n${l.map((t) => `- ${t.nombre}${t.lugar ? ` (${t.lugar})` : ""}: ${t.estado}; detectar CD ${t.cd_detectar}, desarmar CD ${t.cd_desarmar}`).join("\n")}`;
}

export const REGLAS_TRAMPAS = `## Trampas y Percepción pasiva
- Las trampas se colocan en secreto (trampa {accion: colocar, nombre, lugar, cd_detectar, cd_desarmar, efecto}): CD 10 fácil, 15 normal, 20 difícil. El efecto es como la habilidad de una criatura (salvación, cd, dano, tipo_dano, mitad_si_exito, condicion, herida…). Un pozo de estacas no se repite; una ballesta con cuerda sí (reutilizable).
- Al entrar en la zona, llama a trampa {accion: detectar}: cuenta la Percepción pasiva del grupo (10 + SAB + competencia en Percepción; −5 a ritmo rápido) y la mejor de todas decide; quien no la nota no recibe aviso. Si el grupo registra a propósito, activa=true: prueba de Percepción de cada uno. Nunca digas que hay una trampa si nadie la ha descubierto; cuando salte, narra con peso.
- Desarmar (trampa {accion: desarmar, nombre, quienes}): solo si está descubierta; prueba de Juego de manos con herramientas de ladrón (herramientas=true) o con desventaja sin ellas. Si falla por 5 o más, salta sobre quien la manipula. Si alguien pisa una trampa sin notar, trampa {accion: disparar, nombre, quienes}.`;
