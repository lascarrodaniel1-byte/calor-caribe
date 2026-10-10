// Armaduras y armas: lo que llevas puesto decide si un golpe atraviesa y lo
// grave que es la herida. Cada pieza protege unas regiones y frena distinto el
// corte, la punta y el golpe contundente; cada arma penetra distinto. Un cuchillo
// lanzado al azar no pasa una coraza; una maza hace daño grave aun a través de ella.
import type { Personaje } from "./estado.js";
import type { Ubicacion } from "./heridas.js";

export const TIPOS_DANO = ["corte", "punta", "contundente"] as const;
export type TipoDano = (typeof TIPOS_DANO)[number];
type Prot = Record<TipoDano, number>;

type Region = "cabeza" | "cuello" | "torso" | "abdomen" | "brazos" | "piernas";
const TODO: Region[] = ["cabeza", "cuello", "torso", "abdomen", "brazos", "piernas"];

interface Pieza {
  nombre: string;
  regiones: Region[];
  metal: boolean;
  prot: Prot;
}

/** Piezas de armadura (y pieles naturales de criaturas). */
export const PIEZAS: Record<string, Pieza> = {
  gambeson: { nombre: "gambesón", regiones: ["torso", "abdomen", "brazos"], metal: false, prot: { corte: 4, punta: 2, contundente: 2 } },
  cuero: { nombre: "armadura de cuero", regiones: ["torso", "abdomen", "brazos"], metal: false, prot: { corte: 1, punta: 1, contundente: 1 } },
  cuero_endurecido: { nombre: "cuero endurecido o tachonado", regiones: ["torso", "abdomen"], metal: false, prot: { corte: 2, punta: 2, contundente: 1 } },
  pieles: { nombre: "pieles", regiones: ["torso", "abdomen", "brazos"], metal: false, prot: { corte: 1, punta: 0, contundente: 1 } },
  cota_malla: { nombre: "cota de malla", regiones: ["torso", "abdomen", "brazos"], metal: true, prot: { corte: 5, punta: 3, contundente: 0 } },
  loriga: { nombre: "loriga larga de malla", regiones: ["torso", "abdomen", "brazos", "piernas"], metal: true, prot: { corte: 5, punta: 3, contundente: 0 } },
  almofar: { nombre: "almófar de malla", regiones: ["cabeza", "cuello"], metal: true, prot: { corte: 5, punta: 3, contundente: 0 } },
  escamas: { nombre: "armadura de escamas", regiones: ["torso", "abdomen", "brazos"], metal: true, prot: { corte: 4, punta: 3, contundente: 1 } },
  brigantina: { nombre: "brigantina", regiones: ["torso", "abdomen"], metal: true, prot: { corte: 5, punta: 4, contundente: 2 } },
  coraza: { nombre: "coraza (peto y espaldar)", regiones: ["torso", "abdomen"], metal: true, prot: { corte: 8, punta: 6, contundente: 3 } },
  brazales: { nombre: "brazales de placas", regiones: ["brazos"], metal: true, prot: { corte: 8, punta: 6, contundente: 2 } },
  grebas: { nombre: "grebas y quijotes", regiones: ["piernas"], metal: true, prot: { corte: 8, punta: 6, contundente: 2 } },
  yelmo: { nombre: "yelmo", regiones: ["cabeza"], metal: true, prot: { corte: 8, punta: 6, contundente: 2 } },
  gorjal: { nombre: "gorjal", regiones: ["cuello"], metal: true, prot: { corte: 8, punta: 6, contundente: 2 } },
  placas_completas: { nombre: "armadura de placas completa", regiones: TODO, metal: true, prot: { corte: 8, punta: 6, contundente: 3 } },
  // Naturales
  pellejo: { nombre: "pellejo grueso", regiones: TODO, metal: false, prot: { corte: 1, punta: 1, contundente: 1 } },
  escamas_naturales: { nombre: "escamas", regiones: TODO, metal: true, prot: { corte: 4, punta: 3, contundente: 1 } },
  hueso: { nombre: "cuerpo de hueso", regiones: TODO, metal: false, prot: { corte: 2, punta: 4, contundente: -2 } },
};
export const NOMBRES_PIEZAS = Object.keys(PIEZAS) as [string, ...string[]];

interface Arma {
  nombre: string;
  patron: RegExp;
  tipo: TipoDano;
  /** Resta a la protección (negativa si el arma es ligera contra el metal). */
  penetracion: number;
  /** Las armas pensadas para romper (mazas, martillos) agravan la herida. */
  brutal?: number;
}

/** Armas conocidas, de más específica a más genérica. */
export const ARMAS: Arma[] = [
  { nombre: "pico de guerra", patron: /pico de (guerra|cuervo)|martillo de pico/i, tipo: "punta", penetracion: 4 },
  { nombre: "misericordia o estoque", patron: /misericordia|estoque|rapier|punzón/i, tipo: "punta", penetracion: 2 },
  { nombre: "virote de ballesta", patron: /virote|ballesta/i, tipo: "punta", penetracion: 2 },
  { nombre: "martillo de guerra", patron: /martillo/i, tipo: "contundente", penetracion: 2, brutal: 2 },
  { nombre: "maza", patron: /maza|lucero|mangual|mayal|clava/i, tipo: "contundente", penetracion: 1, brutal: 2 },
  { nombre: "garrote", patron: /garrote|porra|bast[oó]n|cayado|pu[ñn]o|patada|cabezazo|culatazo/i, tipo: "contundente", penetracion: 0, brutal: 1 },
  { nombre: "golpe de gigante", patron: /roca|pisot|cola|aplast|embest|coletazo|pu[ñn]o de hueso/i, tipo: "contundente", penetracion: 2, brutal: 2 },
  { nombre: "daga o cuchillo", patron: /daga|cuchill|pu[ñn]al|navaja|cuchilla|estilete/i, tipo: "punta", penetracion: -1 },
  { nombre: "hacha pesada", patron: /hacha (a dos manos|de guerra|grande)|gran hacha|guada[ñn]a|alabarda|bisarma/i, tipo: "corte", penetracion: 2 },
  { nombre: "hacha", patron: /hacha|hachuela/i, tipo: "corte", penetracion: 1 },
  { nombre: "espadón", patron: /espad[oó]n|mandoble|espada a dos manos|montante/i, tipo: "corte", penetracion: 1 },
  { nombre: "espada", patron: /espada|sable|alfanje|falcata|cimitarra|filo/i, tipo: "corte", penetracion: 0 },
  { nombre: "lanza", patron: /lanza|pica|jabalina|venablo|tridente|horca/i, tipo: "punta", penetracion: 1 },
  { nombre: "flecha", patron: /flecha|arco|dardo/i, tipo: "punta", penetracion: 0 },
  { nombre: "colmillos", patron: /mordisco|colmillo|picotazo|aguij/i, tipo: "punta", penetracion: 0 },
  { nombre: "garras", patron: /garra|zarpa|u[ñn]as|flagelo|l[aá]tigo/i, tipo: "corte", penetracion: 0 },
];

export function reconocerArma(texto?: string): Arma | undefined {
  return texto ? ARMAS.find((a) => a.patron.test(texto)) : undefined;
}

/** Piezas que lleva un PJ: las de su ficha o, si no tiene, las deducidas de su inventario. */
export function armaduraDe(p: Personaje): { piezas: string[]; deducida: boolean } {
  if (p.armadura) return { piezas: p.armadura, deducida: false };
  const inv = p.inventario.join(" | ").toLowerCase();
  const piezas: string[] = [];
  if (/placas completas|armadura de placas|arnés/.test(inv)) piezas.push("placas_completas", "gambeson");
  else {
    if (/coraza|peto/.test(inv)) piezas.push("coraza");
    if (/brigantina/.test(inv)) piezas.push("brigantina");
    if (/loriga/.test(inv)) piezas.push("loriga");
    else if (/cota de malla|camisote/.test(inv)) piezas.push("cota_malla");
    if (/escamas/.test(inv)) piezas.push("escamas");
    if (/gambes|acolchad|perpunte/.test(inv) || piezas.some((x) => ["cota_malla", "loriga", "coraza", "escamas"].includes(x))) piezas.push("gambeson");
    if (/cuero (tachonado|endurecido|hervido)/.test(inv)) piezas.push("cuero_endurecido");
    else if (/armadura de cuero|jub[oó]n de cuero/.test(inv)) piezas.push("cuero");
    if (/pieles/.test(inv)) piezas.push("pieles");
    if (/yelmo|casco|bacinete|celada/.test(inv)) piezas.push("yelmo");
    if (/alm[oó]far/.test(inv)) piezas.push("almofar");
    if (/gorjal/.test(inv)) piezas.push("gorjal");
    if (/brazales/.test(inv)) piezas.push("brazales");
    if (/grebas/.test(inv)) piezas.push("grebas");
  }
  return { piezas: [...new Set(piezas)], deducida: true };
}

export function regionDe(u: Ubicacion): Region {
  if (u.startsWith("brazo")) return "brazos";
  if (u.startsWith("pierna")) return "piernas";
  return u as Region;
}

export interface Proteccion {
  valor: number;
  piezas: string[];
}

/** Protección en una región contra un tipo de daño: la mejor capa más la mitad de la segunda. */
export function proteccion(piezas: string[], region: Region, tipo: TipoDano, soloBlandas = false): Proteccion {
  const capas = piezas
    .map((k) => PIEZAS[k])
    .filter((x): x is Pieza => !!x && x.regiones.includes(region) && (!soloBlandas || !x.metal))
    .sort((a, b) => b.prot[tipo] - a.prot[tipo]);
  if (!capas.length) return { valor: 0, piezas: [] };
  const primera = capas[0].prot[tipo];
  const segunda = capas[1] ? Math.max(0, Math.floor(capas[1].prot[tipo] / 2)) : 0;
  return { valor: primera + segunda, piezas: capas.slice(0, 2).map((c) => c.nombre) };
}

export const textoArmadura = (piezas: string[]) => piezas.map((k) => PIEZAS[k]?.nombre ?? k).join(", ");

export const REGLAS_ARMADURA = `## Armaduras y armas (las aplica atacar)
- La CA decide si te tocan; la armadura decide si el golpe ATRAVIESA. Cada golpe cae en una región (se tira, o la eliges con apuntar) y la protección de esa región se resta al daño según el tipo: corte, punta o contundente.
- Protección por pieza (corte/punta/contundente; regiones): ${Object.entries(PIEZAS).map(([k, p]) => `${k} ${p.prot.corte}/${p.prot.punta}/${p.prot.contundente} (${p.regiones.length === 6 ? "todo" : p.regiones.join(", ")})`).join("; ")}. Varias capas: la mejor más la mitad de la segunda. La malla se lleva siempre sobre gambesón.
- Armas (se reconocen por el nombre del arma o del ataque, o pasa tipo_dano): ${ARMAS.map((a) => `${a.nombre} ${a.tipo}${a.penetracion ? ` pen ${a.penetracion > 0 ? "+" : ""}${a.penetracion}` : ""}${a.brutal ? ` brutal +${a.brutal}` : ""}`).join("; ")}. La penetración resta protección (las dagas, ligeras, la suman contra el metal).
- Si el golpe no atraviesa, no hay daño ni herida. Si atraviesa, la protección que quede rebaja la gravedad de la herida; las armas brutales (mazas, martillos) la agravan aunque haya placas.
- apuntar: una región concreta (−2; cabeza o cuello −4) o "hueco" (buscar las juntas de la armadura con una daga o un estoque: −6 recluta, −5 curtido, −4 veterano, −3 leyenda): en un hueco el metal no cuenta y la herida es más grave.
- Los PJ llevan su armadura en la ficha (armadura en guardar_personaje y modificar_personaje); si falta, se deduce del inventario. Los PNJ, en pnj.armadura; las criaturas, en blindaje (escamas, pellejo, hueso: las mazas destrozan a los esqueletos).`;
