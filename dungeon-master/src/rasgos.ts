// Rasgos que el MOTOR aplica solo (sin que el DM tenga que acordarse). Los umbrales de nivel pasan por nvl() (niveles.ts).
// Lo que no está aquí lo aplica el DM con su herramienta o lo narra; ver docs/AUDITORIA_RASGOS.md.
import type { Personaje } from "./estado.js";
import { nvl, NIVEL_ATAQUE_ADICIONAL, NIVEL_PRESA_MARCADA, NIVEL_VETERANO } from "./niveles.js";

/** Clases con Ataque adicional (nivel real 4, sin desplazar: ver NIVEL_ATAQUE_ADICIONAL). El Degollador y el Hechicero no lo tienen. */
export const CON_ATAQUE_ADICIONAL = new Set(["Mercenario del Cuervo", "Berserker de Ceniza", "Caballero Juramentado", "Cazador de Brujas", "Flagelante", "Segador", "Barbero-Cirujano"]);

/** Ataques de la acción de Atacar: 2 con Ataque adicional (la Acción súbita los repite en un segundo turno de acción). */
export const ataquesPorAccion = (p: Personaje): number => (CON_ATAQUE_ADICIONAL.has(p.clase) && p.nivel >= NIVEL_ATAQUE_ADICIONAL ? 2 : 1);
/** Veterano de compañía (Mercenario, nivel real 3 sin desplazar: NIVEL_VETERANO): crítico con 19-20 en el d20. */
export const criticoVeterano = (p: Personaje): boolean => p.clase === "Mercenario del Cuervo" && p.nivel >= NIVEL_VETERANO;
/** Ataque temerario (Berserker, base nivel 2): ventaja en sus ataques cuerpo a cuerpo de FUE; los ataques contra él también la tienen. */
export const temerarioActivo = (p: Personaje): boolean => p.clase === "Berserker de Ceniza" && p.nivel >= nvl(2);
/** Presa marcada (Cazador de Brujas, nivel real 3 sin desplazar: NIVEL_PRESA_MARCADA): una vez por turno, +1d8 contra una criatura ya herida. */
export const presaMarcada = (p: Personaje): boolean => p.clase === "Cazador de Brujas" && p.nivel >= NIVEL_PRESA_MARCADA;
/** Desviar proyectiles (Flagelante, base nivel 3): reacción para reducir el daño de un proyectil. */
export const desviaProyectiles = (p: Personaje): boolean => p.clase === "Flagelante" && p.nivel >= nvl(3);
/** Sentido del peligro (Berserker, base nivel 2): ventaja en salvaciones de DES. */
export const sentidoDelPeligro = (p: Personaje): boolean => p.clase === "Berserker de Ceniza" && p.nivel >= nvl(2);

/** Resistencia racial al daño de un elemento (mitad de daño): el Enano al veneno, el Cenizo al fuego, el Tritón al frío. */
export function resisteRacial(p: Personaje, tipo?: string): string | null {
  if (!tipo) return null;
  if (p.raza === "Enano de Karak-Dûm" && /veneno|ponzo/i.test(tipo)) return "Resistencia enana al veneno";
  if (p.raza === "Tritón de las Mareas" && /fr[ií]o|hielo|helad|escarcha|gélid|gelid/i.test(tipo)) return "Resistencia al frío del Tritón";
  if (p.raza === "Cenizo" && /fuego|llama|ígneo|igneo|quemadura/i.test(tipo)) return "Resistencia al fuego del Cenizo";
  return null;
}
/** Aplica la resistencia racial a un daño: devuelve el daño final y la nota (vacía si no hay). */
export function danoConResistencia(p: Personaje, dano: number, tipo?: string): { dano: number; nota: string } {
  const r = resisteRacial(p, tipo);
  return r ? { dano: Math.floor(dano / 2), nota: ` (${r}: ${dano} → ${Math.floor(dano / 2)})` } : { dano, nota: "" };
}

const MIEDO = /asust|miedo|terror|pavor|pánico|panico|intimid|aterr/i;
const HECHIZO = /hechiz|encant|embrujo|domin(a|ar|io)|fascin/i;
const VENENO = /veneno|ponzoñ|ponzon|toxin|envenen/i;

/** Ventaja racial en una salvación según contra qué sea (el texto del motivo). Devuelve el nombre del rasgo. */
export function ventajaRacial(p: Personaje, contra?: string): string | null {
  if (!contra) return null;
  if (MIEDO.test(contra)) {
    if (p.raza === "Humano del Faro") return "Obstinación";
    if (p.raza === "Mediano de Hollín") return "Valiente";
  }
  if (HECHIZO.test(contra) && p.raza === "Elfo Marchito") return "Ventaja contra ser hechizado";
  if (VENENO.test(contra) && p.raza === "Enano de Karak-Dûm") return "Resistencia al veneno";
  return null;
}

/** Lo que el motor aplica por sí solo a este personaje (se lo dice al DM para que no lo repita ni lo olvide). */
export function rasgosAutomaticos(p: Personaje): string[] {
  const l: string[] = [];
  if (ataquesPorAccion(p) > 1) l.push("Ataque adicional (el motor deja 2 ataques por acción de Atacar y avisa del tercero)");
  if (criticoVeterano(p)) l.push("Veterano de compañía (crítico con 19-20)");
  if (temerarioActivo(p)) l.push("Ataque temerario (ventaja en sus ataques cuerpo a cuerpo de FUE y los ataques contra él también la tienen; atacar con temerario:false lo evita) y Sentido del peligro (ventaja en salvaciones de DES)");
  if (presaMarcada(p)) l.push("Presa marcada (+1d8 una vez por turno contra una criatura ya herida)");
  if (desviaProyectiles(p)) l.push("Desviar proyectiles (reacción automática: reduce 1d10 + DES + nivel el daño de un proyectil)");
  if (p.raza === "Humano del Faro") l.push("Obstinación (ventaja en salvaciones contra el miedo)");
  if (p.raza === "Mediano de Hollín") l.push("Valiente (ventaja en salvaciones contra el miedo)");
  if (p.raza === "Elfo Marchito") l.push("Ventaja en salvaciones contra ser hechizado");
  if (p.raza === "Enano de Karak-Dûm") l.push("Ventaja en salvaciones contra veneno y mitad de daño de veneno (en modificar_personaje pasa tipo_dano: \"veneno\")");
  if (p.raza === "Tritón de las Mareas") l.push("Anfibio (agua sumergir: no se ahoga ni gasta aire y nada de verdad, sin desventaja al luchar), Resistencia al frío (mitad de daño; en modificar_personaje pasa tipo_dano: \"frío\") y Piel que pide agua (en tierra la sed corre al doble y tras un día sin mojarse sale «piel reseca»: lo lleva el reloj, no lo repitas)");
  if (p.raza === "Cenizo") l.push("Resistencia al fuego (mitad de daño; en modificar_personaje pasa tipo_dano: \"fuego\"), Brasa interior (1 por descanso largo, la gasta tratar_herida cauterizar) y Llama sagrada (atacar con arma «Llama sagrada»)");
  if (p.raza === "Varg") l.push("Mordisco (atacar con arma «Mordisco»: 1d6 + FUE sin pasar dano), Olfato de lobo (ventaja en Percepción si el motivo habla de olfato/rastro) y Furia de la luna (usar_recurso: +2 al daño cuerpo a cuerpo 10 asaltos)");
  if (p.raza === "Nacido Pálido") l.push("Mordisco vampírico (atacar con arma «Mordisco vampírico»: 1d4 + CON y se cura lo que hiere; 1 por descanso corto) y Andar de araña (usar_recurso)");
  if (p.raza === "Mediano de Hollín") l.push("Sigilo natural (ventaja en Sigilo si el motivo dice que se esconde tras una criatura más grande)");
  if (p.raza === "Humano del Faro" && p.habilidad_extra) l.push(`Competencia extra en ${p.habilidad_extra}`);
  return l;
}
