// Idiomas de Velmora: cada personaje habla Común, el de su raza y, según su clase, uno más; con INT alta sabe algún otro.
// Quien no conoce el idioma de quien habla no lo entiende. Se aprenden con un maestro y tiempo.
import type { Partida, Personaje } from "./estado.js";
import { avanzarSiHay } from "./espacio.js";
import { resolverPrueba } from "./pruebas.js";
import { idiomasIniciales } from "./idiomas_base.js";

export { idiomasIniciales };

export interface Idioma { id: string; nombre: string; quienes: string; nota: string }

export const IDIOMAS: Idioma[] = [
  { id: "comun", nombre: "Común", quienes: "todo el mundo", nota: "La lengua de Aldenmar y de las rutas: la entiende casi todo el que no es una bestia." },
  { id: "karak", nombre: "Lengua de Karak", quienes: "enanos de Karak-Dûm", nota: "Gutural y exacta, hecha para gritar entre túneles; cada palabra tiene su sitio en la piedra." },
  { id: "marchito", nombre: "Susurro marchito", quienes: "elfos marchitos", nota: "Casi sin consonantes fuertes: parece un suspiro. Los marchitos la hablan bajo, aun a gritos." },
  { id: "hollin", nombre: "Jerga de Hollín", quienes: "medianos de Hollín y la gente de las ciénagas", nota: "Mezcla de refranes y trueques; todo es una oferta." },
  { id: "varg", nombre: "Aullido varg", quienes: "vargs", nota: "Más gestos, olores y aullidos que palabras: el que no la conoce solo capta el humor." },
  { id: "palido", nombre: "Lengua pálida", quienes: "nacidos pálidos y la Corte Pálida", nota: "Antigua y cortés: la de los salones de Vel Morhal." },
  { id: "ceniza", nombre: "Habla de ceniza", quienes: "cenizos", nota: "Frases cortas y calmas, con silencios que dicen más que las palabras." },
  { id: "solar", nombre: "Sol viejo", quienes: "Inquisición, sacerdotes, caballeros, cazadores y hechiceros", nota: "La lengua litúrgica de Ka'i, hoy de ritos, sentencias y grimorios; casi nadie la habla en la calle." },
  { id: "cuervo", nombre: "Código del Cuervo", quienes: "la Compañía del Cuervo Negro", nota: "Jerga de campamento y contratos: señales, plumas y frases hechas que identifican a un mercenario." },
  { id: "bajos", nombre: "Argot de Aldenmar", quienes: "asesinos, ladrones y cirujanos de los barrios bajos", nota: "El idioma de los callejones: dobles sentidos y tapados." },
];

export const buscarIdioma = (n: string): Idioma | undefined => {
  const x = n.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
  const sin = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  return IDIOMAS.find((i) => i.id === x || sin(i.nombre) === x) ?? (x.length >= 4 ? IDIOMAS.find((i) => x.startsWith(i.id.slice(0, 4)) || sin(i.nombre).includes(x)) : undefined);
};
export const nombreIdioma = (id: string) => IDIOMAS.find((i) => i.id === id)?.nombre ?? id;

const norm = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
const vivos = (partida: Partida) => Object.values(partida.personajes).filter((p) => !p.condiciones.includes("muerto"));
const sabe = (p: Personaje, id: string) => (p.idiomas ?? ["comun"]).includes(id);

export interface DatosIdioma {
  accion: "lista" | "ver" | "comprobar" | "aprender";
  quien?: string;
  quienes?: string[];
  idioma?: string;
  /** aprender: quién lo enseña. */
  maestro?: string;
  /** aprender: días de estudio (por defecto 30). */
  dias?: number;
}

export function idioma(partida: Partida, d: DatosIdioma): { texto: string; publico: string | null } {
  if (d.accion === "lista") return { texto: IDIOMAS.map((i) => `- ${i.nombre} (${i.id}): ${i.quienes}. ${i.nota}`).join("\n"), publico: null };
  if (d.accion === "ver") {
    const l = d.quienes?.length ? vivos(partida).filter((p) => d.quienes!.some((n) => norm(n) === norm(p.nombre) || (p.jugador && norm(n) === norm(p.jugador)))) : vivos(partida);
    return { texto: l.map((p) => `${p.nombre}: ${(p.idiomas ?? ["comun"]).map(nombreIdioma).join(", ")}`).join("\n") || "No hay personajes.", publico: null };
  }
  const i = buscarIdioma(d.idioma ?? "");
  if (!i) throw new Error(`Di el idioma: ${IDIOMAS.map((x) => x.id).join(", ")}.`);
  if (d.accion === "comprobar") {
    const l = vivos(partida);
    const entienden = l.filter((p) => sabe(p, i.id)), no = l.filter((p) => !sabe(p, i.id));
    return { texto: `${i.nombre}: lo entienden ${entienden.map((p) => p.nombre).join(", ") || "ninguno"}${no.length ? `; NO lo entienden ${no.map((p) => p.nombre).join(", ")} (oyen sonidos sin sentido: dales solo el tono, los gestos y lo que se vea)` : ""}.`, publico: null };
  }
  // aprender
  const p = vivos(partida).find((x) => norm(x.nombre) === norm(d.quien ?? "") || (x.jugador && norm(x.jugador) === norm(d.quien ?? "")));
  if (!p) throw new Error(`No hay ningún personaje «${d.quien ?? ""}».`);
  if (sabe(p, i.id)) throw new Error(`${p.nombre} ya habla ${i.nombre}.`);
  if (!d.maestro) throw new Error("aprender: un idioma no se aprende solo, di quién lo enseña (maestro): un PNJ, un libro, alguien que lo habla.");
  const dias = d.dias ?? 30;
  const r = resolverPrueba(partida, { quien: p.nombre, atributo: "int", cd: 12 + (dias < 30 ? 3 : 0), motivo: `aprender ${i.nombre} con ${d.maestro}` });
  avanzarSiHay(partida, dias * 86400);
  if (!r.exito) return { texto: `${r.texto}\nTras ${dias} días con ${d.maestro}, a ${p.nombre} se le atraganta: no lo aprende todavía (puede insistir otro tanto).`, publico: null };
  (p.idiomas ??= ["comun"]).push(i.id);
  return { texto: `${r.texto}\nTras ${dias} días con ${d.maestro}, ${p.nombre} ya habla ${i.nombre}.`, publico: `🗣 ${p.nombre} aprende ${i.nombre}.` };
}

export function textoIdiomas(partida: Partida): string {
  const l = vivos(partida);
  if (!l.length) return "";
  return `## Idiomas del grupo\n${l.map((p) => `- ${p.nombre}: ${(p.idiomas ?? ["comun"]).map(nombreIdioma).join(", ")}`).join("\n")}`;
}

export const REGLAS_IDIOMAS = `## Idiomas
- Todos hablan Común y el idioma de su raza; según su clase, uno más (Mercenario: Código del Cuervo; Caballero, Cazador de Brujas y Hechicero: Sol viejo; Degollador: Argot de Aldenmar), y con INT alta, algún otro (se pasan en idiomas al guardar la ficha). El estado trae los idiomas del grupo. Cuando alguien hable otro idioma (un vampiro en Lengua pálida, un sacerdote en Sol viejo, un varg), comprueba quién lo entiende con idioma {accion: comprobar, idioma}: quien no lo entiende oye sonidos sin sentido y solo capta el tono y los gestos. Los Hambrientos y ghuls no hablan; los jefes hablan Común y su lengua. Aprender un idioma (idioma {accion: aprender, quien, idioma, maestro, dias}) lleva un maestro y unos 30 días, con una prueba de INT (CD 12).`;
