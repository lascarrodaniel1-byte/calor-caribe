// Mapa de Velmora: regiones fijas, lugares que el DM va descubriendo y la
// posición del grupo (también a mitad de un viaje). Coordenadas en píxeles de la
// ilustración del mapa (web/mapa-velmora.jpg, 1260 × 832), sobre la que la página
// dibuja los lugares y el sello del grupo.
import { tirar } from "./dados.js";

export const ANCHO = 1260;
export const ALTO = 832;
/** Versión de las coordenadas guardadas: la 1 era un lienzo de 1000 × 700. */
export const VERSION_MAPA = 2;
/** Zona útil de la ilustración (el Mar de Ceniza ocupa el borde izquierdo). */
const MARGEN = { izq: 190, der: 50, arr: 50, aba: 60 };

export interface Region {
  nombre: string;
  x: number;
  y: number;
}

export const REGIONES: Region[] = [
  { nombre: "Las Agujas de Vahl", x: 255, y: 150 },
  { nombre: "Karak-Dûm", x: 640, y: 150 },
  { nombre: "El Bosque de Velo Rojo", x: 1010, y: 290 },
  { nombre: "Aldenmar", x: 610, y: 420 },
  { nombre: "Las Ciénagas de Hollín", x: 295, y: 575 },
  { nombre: "La Marca Hueca", x: 870, y: 620 },
];

/** Centros de las regiones en el lienzo antiguo de 1000 × 700, para migrar partidas guardadas. */
const CENTROS_V1: Record<string, [number, number]> = {
  "Las Agujas de Vahl": [190, 140],
  "Karak-Dûm": [520, 115],
  "El Bosque de Velo Rojo": [820, 230],
  Aldenmar: [470, 370],
  "Las Ciénagas de Hollín": [230, 510],
  "La Marca Hueca": [770, 530],
};
export const NOMBRES_REGIONES = REGIONES.map((r) => r.nombre) as [string, ...string[]];

export const TIPOS_LUGAR = ["ciudad", "aldea", "posada", "fortaleza", "ruina", "mazmorra", "cueva", "templo", "bosque", "campamento", "camino", "puerto", "otro"] as const;
export type TipoLugar = (typeof TIPOS_LUGAR)[number];

export interface Lugar {
  id: string;
  nombre: string;
  region: string;
  tipo: TipoLugar;
  x: number;
  y: number;
  descripcion: string;
}

export interface EstadoMapa {
  lugares: Record<string, Lugar>;
  /** Lugar donde está el grupo (o desde donde partió si viaja). */
  posicion?: string;
  /** Viaje en curso: de dónde a dónde y cuánto llevan (0 a 1). */
  ruta?: { desde: string; hasta: string; progreso: number };
  /** Lugares por los que ha pasado el grupo, en orden. */
  rastro: string[];
  /** Versión de las coordenadas (ver VERSION_MAPA). */
  v?: number;
}

export const mapaVacio = (): EstadoMapa => ({ lugares: {}, rastro: [], v: VERSION_MAPA });

/** Pasa los lugares de una partida guardada con el lienzo antiguo al de la ilustración. */
export function migrarMapa(m: EstadoMapa): EstadoMapa {
  if (m.v === VERSION_MAPA) return m;
  for (const l of Object.values(m.lugares)) {
    const nueva = REGIONES.find((r) => r.nombre === l.region);
    const vieja = CENTROS_V1[l.region];
    if (nueva && vieja) {
      // Conserva su posición respecto al centro de su región, en la nueva escala.
      l.x = Math.round(nueva.x + (l.x - vieja[0]) * 1.1);
      l.y = Math.round(nueva.y + (l.y - vieja[1]) * 1.1);
    } else {
      l.x = Math.round((l.x * ANCHO) / 1000);
      l.y = Math.round((l.y * ALTO) / 700);
    }
    l.x = Math.min(ANCHO - MARGEN.der, Math.max(MARGEN.izq, l.x));
    l.y = Math.min(ALTO - MARGEN.aba, Math.max(MARGEN.arr, l.y));
  }
  m.v = VERSION_MAPA;
  return m;
}

const normal = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

export function buscarLugar(m: EstadoMapa, nombre: string): Lugar | undefined {
  const n = normal(nombre);
  const todos = Object.values(m.lugares);
  return todos.find((l) => normal(l.nombre) === n) ?? todos.find((l) => normal(l.nombre).includes(n) || n.includes(normal(l.nombre)));
}

export function buscarRegion(nombre: string): Region | undefined {
  const n = normal(nombre);
  return REGIONES.find((r) => normal(r.nombre) === n) ?? REGIONES.find((r) => normal(r.nombre).includes(n) || n.includes(normal(r.nombre).replace(/^(las?|el) /, "")));
}

/** Busca un hueco libre cerca de un punto para no pisar otros lugares. */
function huecoCerca(m: EstadoMapa, x: number, y: number, radioMin: number, radioMax: number) {
  let mejor = { x, y, dist: -1 };
  const otros = Object.values(m.lugares);
  const k = ANCHO / 1000; // los radios están pensados para el lienzo antiguo
  for (let i = 0; i < 12; i++) {
    const ang = (tirar("1d360").total * Math.PI) / 180;
    const r = (radioMin + Math.random() * (radioMax - radioMin)) * k;
    const px = Math.round(Math.min(ANCHO - MARGEN.der, Math.max(MARGEN.izq, x + Math.cos(ang) * r)));
    const py = Math.round(Math.min(ALTO - MARGEN.aba, Math.max(MARGEN.arr, y + Math.sin(ang) * r)));
    const dist = otros.length ? Math.min(...otros.map((o) => Math.hypot(o.x - px, o.y - py))) : 999;
    if (dist > mejor.dist) mejor = { x: px, y: py, dist };
    if (dist > 70 * k) break;
  }
  return { x: mejor.x, y: mejor.y };
}

export interface DatosLugar {
  nombre: string;
  region?: string;
  cerca_de?: string;
  tipo?: TipoLugar;
  descripcion?: string;
}

/** Devuelve el lugar con ese nombre, creándolo en el mapa si es nuevo. */
export function asegurarLugar(m: EstadoMapa, d: DatosLugar): { lugar: Lugar; nuevo: boolean } {
  const existente = buscarLugar(m, d.nombre);
  if (existente) {
    if (d.descripcion) existente.descripcion = d.descripcion;
    if (d.tipo) existente.tipo = d.tipo;
    return { lugar: existente, nuevo: false };
  }
  let ancla = d.cerca_de ? buscarLugar(m, d.cerca_de) : undefined;
  const region = (d.region && buscarRegion(d.region)) || (ancla && buscarRegion(ancla.region)) || buscarRegion(d.nombre) || REGIONES[3];
  // Si la región indicada no es la del lugar de referencia, manda la región.
  if (ancla && ancla.region !== region.nombre) ancla = undefined;
  // Un lugar con el nombre de la región va en su centro; el resto, alrededor.
  const esLaRegion = normal(region.nombre).includes(normal(d.nombre)) || normal(d.nombre).includes(normal(region.nombre).replace(/^(las?|el) /, ""));
  const pos = ancla
    ? huecoCerca(m, ancla.x, ancla.y, 45, 80)
    : esLaRegion && !Object.values(m.lugares).some((l) => l.x === region.x && l.y === region.y)
      ? { x: region.x, y: region.y }
      : huecoCerca(m, region.x, region.y, 40, 110);
  const id = `L${Object.keys(m.lugares).length + 1}`;
  const lugar: Lugar = { id, nombre: d.nombre, region: region.nombre, tipo: d.tipo ?? "otro", x: pos.x, y: pos.y, descripcion: d.descripcion ?? "" };
  m.lugares[id] = lugar;
  return { lugar, nuevo: true };
}

export interface DatosUbicacion extends DatosLugar {
  viajando_hacia?: string;
  destino_region?: string;
  destino_cerca_de?: string;
  destino_tipo?: TipoLugar;
  progreso?: number;
}

export function moverGrupo(m: EstadoMapa, d: DatosUbicacion): string {
  const { lugar, nuevo } = asegurarLugar(m, d);
  const partes: string[] = [];
  if (nuevo) partes.push(`Nuevo lugar en el mapa: ${lugar.nombre} (${lugar.region}).`);
  if (d.viajando_hacia) {
    const r = asegurarLugar(m, {
      nombre: d.viajando_hacia,
      region: d.destino_region,
      cerca_de: d.destino_cerca_de ?? (d.destino_region ? undefined : lugar.nombre),
      tipo: d.destino_tipo,
    });
    if (r.nuevo) partes.push(`Nuevo lugar en el mapa: ${r.lugar.nombre} (${r.lugar.region}).`);
    const progreso = Math.max(0, Math.min(1, d.progreso ?? 0));
    m.posicion = lugar.id;
    m.ruta = { desde: lugar.id, hasta: r.lugar.id, progreso };
    if (m.rastro[m.rastro.length - 1] !== lugar.id) m.rastro.push(lugar.id);
    partes.unshift(`🧭 De camino: ${lugar.nombre} → ${r.lugar.nombre} (${Math.round(progreso * 100)} % del viaje).`);
  } else {
    m.posicion = lugar.id;
    m.ruta = undefined;
    if (m.rastro[m.rastro.length - 1] !== lugar.id) m.rastro.push(lugar.id);
    partes.unshift(`📍 El grupo está en ${lugar.nombre} (${lugar.region}).`);
  }
  return partes.join("\n");
}

export function textoMapa(m: EstadoMapa): string {
  const pos = m.posicion ? m.lugares[m.posicion] : undefined;
  const donde = m.ruta
    ? `De camino de ${m.lugares[m.ruta.desde]?.nombre} a ${m.lugares[m.ruta.hasta]?.nombre} (${Math.round(m.ruta.progreso * 100)} %).`
    : pos
      ? `En ${pos.nombre} (${pos.region}).`
      : "Sin ubicación todavía: fíjala con la acción ubicacion en cuanto empiece la escena.";
  const lugares = Object.values(m.lugares)
    .map((l) => `- ${l.nombre} (${l.tipo}, ${l.region})${l.descripcion ? `: ${l.descripcion}` : ""}`)
    .join("\n");
  return `Posición del grupo: ${donde}${lugares ? `\nLugares conocidos en el mapa:\n${lugares}` : ""}`;
}

export const REGLAS_MAPA = `## Mapa (usa la acción ubicacion)
Los jugadores ven en todo momento un mapa de Velmora con la posición del grupo. Mantenlo al día:
- Al empezar la aventura, fija dónde están.
- Cada vez que el grupo llegue a otro lugar (otra ciudad, una ruina, una cueva, un campamento), llama a ubicacion con ese lugar.
- Cuando emprendan un viaje, llama a ubicacion con el lugar de partida y viajando_hacia el destino, y actualiza progreso (0 a 1) en las paradas del camino; al llegar, llama con el destino y sin viajando_hacia.
- Reutiliza siempre el mismo nombre para el mismo sitio. Para un sitio nuevo, indica su región o cerca_de qué lugar conocido está, y su tipo.
No hace falta llamarla por moverse dentro del mismo edificio o la misma escena.`;
