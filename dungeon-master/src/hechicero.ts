// Hechicero: el único mago de verdad, con el don arcano innato. Su poder no tiene techo (maestría por nivel hasta ascendido),
// los hechizos de círculo bajo le cuestan cada vez menos y su bastón sirve de catalizador. La Recuperación arcana tiene usos reales.
import type { Partida, Personaje } from "./estado.js";
import { buscarHechizo, buscarTipo, MAESTRIAS, nombreEscuelaHechiceria, sincronizarGrimorio, tipoDe, tiposMax, tiposDeEscuelas, type Hechizo } from "./magia.js";
import { RECURSOS_CLASE } from "./recursos.js";

RECURSOS_CLASE["Hechicero"] = [
  {
    nombre: "Recuperación arcana",
    desde: 2,
    max: (p) => (p.nivel >= 9 ? 2 : 1),
    recarga: "largo",
    efecto: (p) => {
      const m = p.magia;
      if (!m) return `${p.nombre} no tiene magia de la que recuperarse.`;
      let resto = Math.ceil(p.nivel / 2);
      const partes: string[] = [];
      const calor = Math.min(m.calor, resto); m.calor -= calor; resto -= calor; if (calor) partes.push(`${calor} de calor`);
      const aliento = Math.min(m.aliento, resto); m.aliento -= aliento; resto -= aliento; if (aliento) partes.push(`${aliento} de aliento`);
      return `${p.nombre} respira hondo tras un descanso corto y recompone su cuerpo: recupera ${partes.join(" y ") || "nada (no tenía calor ni aliento gastados)"}.`;
    },
  },
];

const norm = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
const CIRCULO_MAX: Record<string, number> = { profano: -1, iniciado: 1, adepto: 2, maestro: 3, archimago: 4, ascendido: 5 };

function hechicero(partida: Partida, quien: string): Personaje {
  const p = Object.values(partida.personajes).find((x) => norm(x.nombre) === norm(quien) || (x.jugador && norm(x.jugador) === norm(quien)));
  if (!p) throw new Error(`No hay ningún personaje llamado «${quien}».`);
  if (p.clase !== "Hechicero" || !p.magia) throw new Error(`${p.nombre} no es un Hechicero.`);
  return p;
}

/** Aprende un nuevo tipo de magia en una escuela (nivel 5: el segundo; nivel 9: el tercero). El del don ya los domina todos. */
export function aprenderTipo(partida: Partida, d: { quien: string; tipo: string; maestro: string }): string {
  const p = hechicero(partida, d.quien);
  const m = p.magia!;
  if (m.don) return `${p.nombre} tiene el don arcano: ya domina todos los tipos de magia y aprende los hechizos con solo verlos (comprender_magia con visto=true).`;
  const t = buscarTipo(d.tipo);
  if (!t) throw new Error(`«${d.tipo}» no es un tipo de magia conocido.`);
  m.tipos ??= tiposDeEscuelas(m.escuelas);
  if (m.tipos.includes(t.id)) throw new Error(`${p.nombre} ya domina la magia de ${t.nombre}.`);
  const max = tiposMax(p.nivel, false);
  if (m.tipos.length >= max) throw new Error(`${p.nombre} (nivel ${p.nivel}) solo puede dominar ${max} tipo(s) de magia y ya domina ${m.tipos.join(", ")}: el segundo llega en el nivel 5 y el tercero en el 9.`);
  if (d.maestro.trim().length < 3) throw new Error("Di quién o qué escuela le enseña (maestro).");
  m.tipos.push(t.id);
  if (!m.escuelas.includes(t.escuela)) m.escuelas.push(t.escuela);
  const antes = m.hechizos.length;
  sincronizarGrimorio(p);
  let licencia: string;
  if (t.licenciado) { (m.licencias ??= []).push(t.id); licencia = `${nombreEscuelaHechiceria(t.id)} (con licencia de la Inquisición) le concede su licencia para ese tipo.`; }
  else licencia = `${t.nombre} es magia negra: nadie la licencia y la Inquisición la persigue. Aprenderla es herejía.`;
  return `${p.nombre} estudia la magia de ${t.nombre} con ${d.maestro.trim()}. ${licencia} Ahora domina ${m.tipos.join(", ")} (${m.tipos.length}/${max}) y su grimorio gana ${m.hechizos.length - antes} hechizo(s).`;
}

/** Comprender un hechizo o un tipo de magia aunque no se domine (y, con el don arcano, aprender un hechizo con solo verlo). */
export function comprenderMagia(partida: Partida, d: { quien: string; hechizo: string; visto?: boolean }): string {
  const p = hechicero(partida, d.quien);
  const m = p.magia!;
  const t = buscarTipo(d.hechizo);
  if (t) {
    const quedan = m.don || (m.tipos ?? []).includes(t.id);
    return `${p.nombre} comprende la magia de ${t.nombre}: ${t.canaliza}. ${t.licenciado ? `La enseña la ${nombreEscuelaHechiceria(t.id)}, con licencia de la Inquisición.` : "Es magia negra: nadie la licencia y la Inquisición la persigue."} ${quedan ? "Además la domina." : "No la domina: comprenderla no es poder lanzarla; necesita estudiarla con un maestro (aprender_tipo)."}`;
  }
  const h: Hechizo | undefined = buscarHechizo(d.hechizo);
  if (!h) throw new Error(`No conozco el hechizo ni el tipo «${d.hechizo}».`);
  const tipo = buscarTipo(tipoDe(h))!;
  const lineas = [`${p.nombre} comprende ${h.nombre} (${tipo.nombre}, círculo ${h.circulo}): ${h.efecto}. Para lanzarlo ${tipo.canaliza}.${h.salvacion ? ` Salvación: ${h.salvacion}.` : ""}`];
  const sabe = m.hechizos.some((x) => norm(x) === norm(h.nombre));
  const domina = m.don || (m.tipos ?? tiposDeEscuelas(m.escuelas)).includes(tipo.id);
  if (sabe) lineas.push("Ya lo sabe lanzar.");
  else if (m.don && d.visto) {
    const tope = CIRCULO_MAX[m.maestria] ?? 2;
    if (h.circulo > tope) lineas.push(`Lo ha visto y entiende cómo se canaliza, pero su poder aún no llega al círculo ${h.circulo} (su maestría, ${m.maestria}, alcanza el ${tope}); lo aprenderá cuando crezca.`);
    else { m.hechizos.push(h.nombre); if (m.tipos && !m.tipos.includes(tipo.id)) m.tipos.push(tipo.id); lineas.push(`Con el don arcano le basta verlo: entiende cómo se canaliza y ya sabe lanzar ${h.nombre}, con las mismas reglas y precios que cualquier hechizo.`); }
  } else if (domina) lineas.push("Domina ese tipo: lo aprende con el grimorio al subir el círculo que domina, o con un maestro.");
  else lineas.push(`No domina la magia de ${tipo.nombre}: lo comprende pero no puede lanzarlo.${m.don ? "" : " Necesita estudiar el tipo en una escuela (aprender_tipo)."}`);
  return lineas.join(" ");
}

/** Nota para el DM (no para los jugadores): lanzar un tipo sin licencia, ante la Inquisición, es herejía. */
export function avisoLicencia(p: Personaje, h: Hechizo): string {
  if (p.clase !== "Hechicero" || !p.magia) return "";
  const tipo = buscarTipo(tipoDe(h));
  if (!tipo) return "";
  if (!tipo.licenciado) return `⚠ (solo DM) ${h.nombre} es magia negra (${tipo.nombre}): la Inquisición persigue a quien la practica.`;
  if (!(p.magia.licencias ?? []).includes(tipo.id)) return `⚠ (solo DM) ${p.nombre} no tiene licencia de la Inquisición para la magia de ${tipo.nombre}: si lo ven, es un hereje.`;
  return "";
}
