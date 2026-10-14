// Mapa de Velmora: regiones fijas, lugares que el DM va descubriendo y la
// posición del grupo (también a mitad de un viaje). Coordenadas en píxeles de la
// ilustración del mapa (web/mapa-velmora.jpg, 821 × 953), sobre la que la página
// dibuja los lugares y el sello del grupo. El NORTE es siempre ARRIBA del mapa: un
// lugar «al norte» de otro tiene una y menor.
import { tirar } from "./dados.js";

export const ANCHO = 821;
export const ALTO = 953;
/** Versión de las coordenadas guardadas: la 1 era un lienzo de 1000 × 700 y la 2, la ilustración apaisada de 1260 × 832. */
export const VERSION_MAPA = 3;
/** Zona útil de la ilustración (el mar rodea la tierra). */
const MARGEN = { izq: 60, der: 30, arr: 40, aba: 50 };

export interface Region {
  nombre: string;
  x: number;
  y: number;
}

export const REGIONES: Region[] = [
  { nombre: "Las Agujas de Vahl", x: 225, y: 215 },
  { nombre: "Karak-Dûm", x: 548, y: 135 },
  { nombre: "El Bosque de Velo Rojo", x: 700, y: 325 },
  { nombre: "Aldenmar", x: 515, y: 430 },
  { nombre: "Las Ciénagas de Hollín", x: 370, y: 770 },
  { nombre: "La Marca Hueca", x: 690, y: 790 },
];

/** Centros de las regiones en la ilustración apaisada de 1260 × 832, para migrar partidas guardadas de la versión 2. */
const CENTROS_V2: Record<string, [number, number]> = {
  "Las Agujas de Vahl": [255, 150],
  "Karak-Dûm": [640, 150],
  "El Bosque de Velo Rojo": [1010, 290],
  Aldenmar: [610, 420],
  "Las Ciénagas de Hollín": [295, 575],
  "La Marca Hueca": [870, 620],
};

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
    const v2 = m.v === 2;
    const vieja = v2 ? CENTROS_V2[l.region] : CENTROS_V1[l.region];
    if (nueva && vieja) {
      // Conserva su posición (y su rumbo) respecto al centro de su región, en la nueva escala.
      const k = v2 ? 0.65 : 0.72;
      l.x = Math.round(nueva.x + (l.x - vieja[0]) * k);
      l.y = Math.round(nueva.y + (l.y - vieja[1]) * k);
    } else {
      const w = v2 ? 1260 : 1000, h = v2 ? 832 : 700;
      l.x = Math.round((l.x * ANCHO) / w);
      l.y = Math.round((l.y * ALTO) / h);
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

/** Puntos cardinales: el norte es arriba (y menor). */
export const DIRECCIONES = ["N", "NE", "E", "SE", "S", "SO", "O", "NO"] as const;
export type Direccion = (typeof DIRECCIONES)[number];
export const VECTOR: Record<Direccion, [number, number]> = {
  N: [0, -1], NE: [Math.SQRT1_2, -Math.SQRT1_2], E: [1, 0], SE: [Math.SQRT1_2, Math.SQRT1_2],
  S: [0, 1], SO: [-Math.SQRT1_2, Math.SQRT1_2], O: [-1, 0], NO: [-Math.SQRT1_2, -Math.SQRT1_2],
};
export const NOMBRE_DIRECCION: Record<Direccion, string> = { N: "norte", NE: "noreste", E: "este", SE: "sureste", S: "sur", SO: "suroeste", O: "oeste", NO: "noroeste" };
/** Distancias en píxeles del mapa. */
export const DISTANCIAS = { pegado: 30, cerca: 60, lejos: 120, muy_lejos: 220 } as const;
export type Distancia = keyof typeof DISTANCIAS;

/** Rumbo y distancia aproximada de a hacia b, en palabras («al norte, cerca»). */
export function rumboEntre(a: { x: number; y: number }, b: { x: number; y: number }): { dir: Direccion; texto: string } {
  const dx = b.x - a.x, dy = b.y - a.y;
  const d = Math.hypot(dx, dy);
  const ang = (Math.atan2(dx, -dy) * 180) / Math.PI; // 0 = norte, 90 = este
  const dir = DIRECCIONES[Math.round(((ang + 360) % 360) / 45) % 8];
  const dist = d <= 12 ? "en el mismo sitio" : d <= 45 ? "pegado" : d <= 90 ? "cerca" : d <= 170 ? "lejos" : "muy lejos";
  return { dir, texto: d <= 12 ? dist : `al ${NOMBRE_DIRECCION[dir]}, ${dist}` };
}

const limitar = (x: number, y: number) => ({
  x: Math.round(Math.min(ANCHO - MARGEN.der, Math.max(MARGEN.izq, x))),
  y: Math.round(Math.min(ALTO - MARGEN.aba, Math.max(MARGEN.arr, y))),
});

/** Punto a esa distancia y rumbo de otro (el norte es arriba). */
export function desde(o: { x: number; y: number }, dir: Direccion, dist: Distancia | number): { x: number; y: number } {
  const px = typeof dist === "number" ? dist : DISTANCIAS[dist];
  const [vx, vy] = VECTOR[dir];
  return limitar(o.x + vx * px, o.y + vy * px);
}

/** Busca un hueco libre cerca de un punto para no pisar otros lugares. */
function huecoCerca(m: EstadoMapa, x: number, y: number, radioMin: number, radioMax: number) {
  let mejor = { x, y, dist: -1 };
  const otros = Object.values(m.lugares);
  const k = ANCHO / 1000 / 0.82; // los radios están pensados para el lienzo antiguo
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
  /** Hacia dónde queda respecto a cerca_de (o al centro de su región): el norte es arriba del mapa. */
  direccion?: Direccion;
  distancia?: Distancia;
  tipo?: TipoLugar;
  descripcion?: string;
}

/** Devuelve el lugar con ese nombre, creándolo en el mapa si es nuevo. */
/** Si hay otro lugar casi encima, se desplaza un poco en perpendicular para que no se tapen. */
function sinSolapar(m: EstadoMapa, p: { x: number; y: number }, dir: Direccion, ignorar?: string) {
  let { x, y } = p;
  const otros = Object.values(m.lugares).filter((l) => l.id !== ignorar);
  const [vx, vy] = VECTOR[dir];
  for (let i = 1; i <= 4 && otros.some((o) => Math.hypot(o.x - x, o.y - y) < 26); i++) {
    const lado = i % 2 ? 1 : -1;
    ({ x, y } = limitar(p.x + -vy * 30 * lado * Math.ceil(i / 2), p.y + vx * 30 * lado * Math.ceil(i / 2)));
  }
  return { x, y };
}

export function asegurarLugar(m: EstadoMapa, d: DatosLugar): { lugar: Lugar; nuevo: boolean; movido?: string } {
  const existente = buscarLugar(m, d.nombre);
  if (existente) {
    if (d.descripcion) existente.descripcion = d.descripcion;
    if (d.tipo) existente.tipo = d.tipo;
    // Con rumbo indicado, se recoloca (así se corrige un lugar mal puesto): el norte es arriba.
    const ref = d.cerca_de ? buscarLugar(m, d.cerca_de) : undefined;
    if (d.direccion && (ref || d.region || existente.region) && ref?.id !== existente.id) {
      const base = ref ?? buscarRegion(d.region ?? existente.region) ?? REGIONES[3];
      const pos = sinSolapar(m, desde(base, d.direccion, d.distancia ?? "cerca"), d.direccion, existente.id);
      existente.x = pos.x;
      existente.y = pos.y;
      const nombreBase = ref?.nombre ?? (base as Region).nombre;
      return { lugar: existente, nuevo: false, movido: `${existente.nombre} queda al ${NOMBRE_DIRECCION[d.direccion]} de ${nombreBase} (${d.distancia ?? "cerca"}).` };
    }
    return { lugar: existente, nuevo: false };
  }
  let ancla = d.cerca_de ? buscarLugar(m, d.cerca_de) : undefined;
  const region = (d.region && buscarRegion(d.region)) || (ancla && buscarRegion(ancla.region)) || buscarRegion(d.nombre) || REGIONES[3];
  // Si la región indicada no es la del lugar de referencia, manda la región.
  if (ancla && ancla.region !== region.nombre) ancla = undefined;
  // Un lugar con el nombre de la región va en su centro; el resto, alrededor.
  const esLaRegion = normal(region.nombre).includes(normal(d.nombre)) || normal(d.nombre).includes(normal(region.nombre).replace(/^(las?|el) /, ""));
  const pos = d.direccion && !esLaRegion
    ? sinSolapar(m, desde(ancla ?? region, d.direccion, d.distancia ?? "cerca"), d.direccion)
    : ancla
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
  destino_direccion?: Direccion;
  destino_distancia?: Distancia;
  progreso?: number;
}

export function moverGrupo(m: EstadoMapa, d: DatosUbicacion): string {
  const { lugar, nuevo, movido } = asegurarLugar(m, d);
  const partes: string[] = [];
  if (nuevo) partes.push(`Nuevo lugar en el mapa: ${lugar.nombre} (${lugar.region}${d.direccion ? `, al ${NOMBRE_DIRECCION[d.direccion]}` : ""}).`);
  if (movido) partes.push(`Corregido en el mapa: ${movido}`);
  if (nuevo && !d.direccion && (d.cerca_de || d.region)) partes.push("Aviso: no indicaste direccion (N, NE, E…): el sitio se ha puesto sin un rumbo concreto. Si queda «al norte/sur/…» de algo, vuelve a llamar con direccion para que el mapa sea fiel.");
  if (d.viajando_hacia) {
    const r = asegurarLugar(m, {
      nombre: d.viajando_hacia,
      region: d.destino_region,
      cerca_de: d.destino_cerca_de ?? (d.destino_region ? undefined : lugar.nombre),
      tipo: d.destino_tipo,
      direccion: d.destino_direccion,
      distancia: d.destino_distancia,
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
    .map((l) => {
      // Rumbo desde el grupo (si hay posición): así «ve al norte» se dice con la dirección real.
      const rumbo = pos && pos.id !== l.id ? ` → desde el grupo: ${rumboEntre(pos, l).texto}` : "";
      return `- ${l.nombre} (${l.tipo}, ${l.region})${rumbo}${l.descripcion ? `: ${l.descripcion}` : ""}`;
    })
    .join("\n");
  return `El NORTE es ARRIBA del mapa (N arriba, S abajo, E derecha, O izquierda). Posición del grupo: ${donde}${lugares ? `\nLugares conocidos en el mapa (con su rumbo real desde el grupo; no mandes al norte a quien está al sur de su destino):\n${lugares}` : ""}`;
}

export const REGLAS_MAPA = `## Mapa (usa la acción ubicacion)
Los jugadores ven en todo momento un mapa de Velmora con la posición del grupo. Mantenlo al día:
- Al empezar la aventura, fija dónde están.
- Cada vez que el grupo llegue a otro lugar (otra ciudad, una ruina, una cueva, un campamento), llama a ubicacion con ese lugar.
- Cuando emprendan un viaje, llama a ubicacion con el lugar de partida y viajando_hacia el destino, y actualiza progreso (0 a 1) en las paradas del camino; al llegar, llama con el destino y sin viajando_hacia.
- Reutiliza siempre el mismo nombre para el mismo sitio. Para un sitio nuevo, indica su región o cerca_de qué lugar conocido está, su tipo y SIEMPRE su direccion (N, NE, E, SE, S, SO, O, NO) y distancia (pegado, cerca, lejos, muy_lejos) respecto a ese lugar o al centro de su región. El NORTE es ARRIBA del mapa: «la garita norte» va al norte de la ciudad, no al sur. Si un sitio quedó mal colocado, vuelve a llamar con su nombre y la direccion correcta: se recoloca.
- En el estado ves el rumbo real de cada lugar desde el grupo: úsalo cuando mandes a alguien («al norte», «al suroeste»); si dices que algo queda al norte, comprueba que lo esté.
No hace falta llamarla por moverse dentro del mismo edificio o la misma escena (eso es del plano de la escena).`;
