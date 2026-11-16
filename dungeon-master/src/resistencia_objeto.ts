// Resistencia elemental del EQUIPO, en dos niveles (docs/DANOS.md «Resistencia en el equipo»; BALANCE §20; TODO PROPUESTA A CONFIRMAR). Datos puros, sin dependencias del
// motor (patrón de estados_base.ts): los usan rasgos.ts (perfil del personaje), equipo.ts (encantamientos), tesoro.ts (materiales) y estado.ts (ficha).
//  · NIVEL FUERTE (encantamiento de armadura, escudo o accesorio): resistencia COMPLETA (mitad del daño) a un tipo; el mismo mecanismo que las raciales: varias fuentes
//    del MISMO tipo (racial, Furia, Voto de Luz, sumergido, otro encantamiento) no se acumulan. Solo cuenta un objeto del inventario CON su [O#] (registrado por el motor o por crear_objeto).
//  · NIVEL RUDIMENTARIO (material de una prenda): reduce N puntos fijos del tipo por golpe y da VENTAJA en la salvación del estado de ese tipo. Si ya hay resistencia completa
//    al tipo, la leve no suma (manda la mayor); la ventaja del estado cuenta una sola vez.
import type { TipoDano } from "./danos.js";

/** Puntos que resta por golpe un material rudimentario (propuesta a confirmar). */
export const PUNTOS_LEVE = 2;

export interface EncantamientoResistente {
  clase: "armadura" | "accesorio";
  /** Nombre del encantamiento tal como se añade al objeto («Cota de mallas ignífuga»). */
  nombre: string;
  tipo: TipoDano;
  /** Lo que dice la verdad del objeto. */
  texto: string;
}

/** Encantamientos con resistencia completa. «ignífuga» y «de los vivos» ya existían (solo texto); el resto son nuevos (nombres temáticos de Velmora, propuesta a confirmar). */
export const ENCANTAMIENTOS_RESISTENTES: readonly EncantamientoResistente[] = [
  { clase: "armadura", nombre: "ignífuga", tipo: "fuego", texto: "resistencia al fuego" },
  { clase: "armadura", nombre: "de los vivos", tipo: "necrótico", texto: "resistencia al daño necrótico" },
  { clase: "armadura", nombre: "del Turno del Hielo", tipo: "frío", texto: "resistencia al frío" },
  { clase: "armadura", nombre: "de pararrayos", tipo: "eléctrico", texto: "resistencia al daño eléctrico" },
  { clase: "armadura", nombre: "del lodo negro", tipo: "ácido", texto: "resistencia al ácido" },
  { clase: "armadura", nombre: "de la víbora gris", tipo: "veneno", texto: "resistencia al veneno" },
  { clase: "armadura", nombre: "de la penumbra", tipo: "radiante", texto: "resistencia al daño radiante" },
  { clase: "armadura", nombre: "del campanario", tipo: "trueno", texto: "resistencia al trueno" },
  { clase: "armadura", nombre: "del Velo Mudo", tipo: "psíquico", texto: "resistencia al daño psíquico" },
  { clase: "accesorio", nombre: "de brasa mansa", tipo: "fuego", texto: "resistencia al fuego" },
  { clase: "accesorio", nombre: "del sudario", tipo: "necrótico", texto: "resistencia al daño necrótico" },
  { clase: "accesorio", nombre: "del cierzo", tipo: "frío", texto: "resistencia al frío" },
];

export interface MaterialResistente {
  id: string;
  /** Nombre canónico de la prenda o material (el que va al inventario). */
  nombre: string;
  tipo: TipoDano;
  precio: number;
  /** Región donde abunda (trozos del nombre; vacío = en cualquier parte) y criatura de cuyo cuerpo sale. */
  regiones?: string[];
  criaturas?: string[];
  peligroMin: 1 | 2 | 3 | 4 | 5;
  sabor: string;
}

/** Prendas y materiales de armadura con protección leve (baratas, 5-20 po; propuesta a confirmar). Ningún nombre contiene «sal», «agua», «raciones», «cadenas»… (regex de consumo del motor). */
export const MATERIALES_RESISTENTES: readonly MaterialResistente[] = [
  { id: "pieles_barbaro", nombre: "Pieles de bárbaro", tipo: "frío", precio: 8, regiones: ["Agujas", "Velo Rojo"], peligroMin: 1, sabor: "Pieles de oso y lobo cosidas con tendón: huelen a humo" },
  { id: "piel_wendigo", nombre: "Piel helada de wendigo", tipo: "frío", precio: 20, criaturas: ["Wendigo"], regiones: ["Agujas", "Velo Rojo"], peligroMin: 4, sabor: "Una piel gris que no se descongela nunca" },
  { id: "lana_encerada", nombre: "Lana empapada en cera", tipo: "frío", precio: 5, regiones: ["Aldenmar", "Agujas"], peligroMin: 1, sabor: "Un abrigo pesado que no deja pasar el viento" },
  { id: "cuero_dragon", nombre: "Cuero de dragón de ceniza", tipo: "fuego", precio: 20, criaturas: ["Dragón joven de ceniza"], peligroMin: 4, sabor: "Retales de escama blanda, aún tibios" },
  { id: "cuero_engrasado", nombre: "Cuero engrasado", tipo: "eléctrico", precio: 10, regiones: ["Aldenmar", "Hollín"], peligroMin: 1, sabor: "Cuero empapado en grasa de ballena: el rayo resbala" },
  { id: "cuero_lejia", nombre: "Cuero curtido en lejía", tipo: "ácido", precio: 12, regiones: ["Aldenmar", "Ciénagas"], peligroMin: 1, sabor: "Cuero que ya ha visto lo peor de un curtidor" },
  { id: "mandil_curtidor", nombre: "Mandil de curtidor", tipo: "veneno", precio: 10, regiones: ["Aldenmar", "Ciénagas"], peligroMin: 1, sabor: "Cuero grueso y guantes largos, hechos contra emanaciones" },
  { id: "velo_luto", nombre: "Velo de luto", tipo: "radiante", precio: 15, regiones: ["Aldenmar", "Marca Hueca"], peligroMin: 2, sabor: "Seda negra tupida, de las viudas y de la Corte Pálida" },
];

const sinTildes = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const TIENE_ID = /\[O\d+\]/;

export interface ResistenciaEquipo {
  tipo: TipoDano;
  /** «Cota de mallas ignífuga [O3]» o «pieles de bárbaro». */
  fuente: string;
  /** "completa" (encantamiento) o "leve" (material). */
  nivel: "completa" | "leve";
}

/** Lo que el inventario da por sí solo: encantamientos con [O#] (completa) y materiales rudimentarios por nombre (leve). Una entrada por (tipo, nivel): la primera fuente. */
export function resistenciasDeEquipo(inventario: readonly string[] | undefined): ResistenciaEquipo[] {
  const out: ResistenciaEquipo[] = [];
  const hay = (tipo: TipoDano, nivel: ResistenciaEquipo["nivel"]) => out.some((x) => x.tipo === tipo && x.nivel === nivel);
  for (const item of inventario ?? []) {
    const n = sinTildes(item);
    if (TIENE_ID.test(item)) for (const e of ENCANTAMIENTOS_RESISTENTES) if (n.includes(` ${sinTildes(e.nombre)}`) && !hay(e.tipo, "completa")) out.push({ tipo: e.tipo, fuente: item, nivel: "completa" });
    for (const m of MATERIALES_RESISTENTES) if (n.includes(sinTildes(m.nombre)) && !hay(m.tipo, "leve")) out.push({ tipo: m.tipo, fuente: m.nombre.toLowerCase(), nivel: "leve" });
  }
  return out;
}

/** Línea para la ficha del DM («Resiste por equipo: frío — pieles de bárbaro (leve, −2 por golpe)»); vacía si no hay nada. Sin ruido. */
export function textoResistenciasEquipo(inventario: readonly string[] | undefined): string {
  const l = resistenciasDeEquipo(inventario);
  if (!l.length) return "";
  const completas = new Set(l.filter((x) => x.nivel === "completa").map((x) => x.tipo));
  return l.map((x) => `${x.tipo}: ${x.fuente}${x.nivel === "leve" ? ` (leve, −${PUNTOS_LEVE} por golpe${completas.has(x.tipo) ? "; manda la completa" : ""} y ventaja contra el estado)` : ""}`).join("; ");
}
