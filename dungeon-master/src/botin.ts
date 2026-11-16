// Generador de botín con peligro, región y criatura (propuesta de loot): reparte sobre el catálogo de tesoro (tesoro.ts) además del equipo
// de equipo.ts. Sin peligro, región, criatura ni categorías se comporta exactamente como el generador antiguo (`generarBotin`).
// Nunca modifica la partida salvo registrar objetos [O#]: el oro es una SUGERENCIA (oro_cambio) que aplica el DM con modificar_personaje.
import { tirar } from "./dados.js";
import { buscarCriatura } from "./bestiario.js";
import { bonusDe, enMar, familiaDe } from "./encuentros.js";
import { tesoroGuarida } from "./guarida.js";
import { buscarTema, TEMAS } from "./saber.js";
import type { Partida } from "./estado.js";
import { crearObjeto, elegir, extrasBotin, generarBotin, generarUno, tirarCalidad, type CalidadObjeto, type Origen, type PeticionBotin } from "./equipo.js";
import { CATEGORIAS_TESORO, oroSugerido, tesoroDe, tesoroPorId, TESORO, type CategoriaTesoro, type EntradaTesoro } from "./tesoro.js";

export interface PeticionBotinTesoro extends PeticionBotin {
  /** 1-5: cuánto vale el lugar o la criatura (por defecto, el de la criatura o 2). */
  peligro?: number;
  /** Región o lugar (Aldenmar, Ciénagas, Karak, Velo Rojo, Marca Hueca, Agujas, mar…). */
  region?: string;
  /** Criatura saqueada (del bestiario o inventada). */
  criatura?: string;
  /** Limita el reparto a estas categorías del catálogo (y «equipo» para armas y armaduras). */
  categorias?: (CategoriaTesoro | "equipo")[];
}

type Cat = CategoriaTesoro | "equipo";
/** Peso de cada categoría por origen (la moneda va aparte, por fórmula). */
const PESOS: Record<Origen, Partial<Record<Cat, number>>> = {
  saqueo: { equipo: 22, material: 12, ingrediente: 10, comida_bebida: 10, herramienta: 8, documento: 6, gema_arte: 6, curiosidad: 8, trofeo: 8, llave_sello: 2, nautico: 10, moneda: 3 },
  hallazgo: { equipo: 30, gema_arte: 12, documento: 12, curiosidad: 10, material: 8, ingrediente: 6, herramienta: 6, llave_sello: 6, comida_bebida: 2, trofeo: 2, objeto_trama: 6, nautico: 8, moneda: 4 },
  jefe: { equipo: 40, gema_arte: 12, documento: 8, trofeo: 12, llave_sello: 6, objeto_trama: 12, curiosidad: 6, material: 4, moneda: 4 },
  compra: { equipo: 35, herramienta: 20, comida_bebida: 15, ingrediente: 10, material: 10, documento: 5, curiosidad: 5 },
};
/** Qué pesa más según la familia de la criatura (familiaDe de encuentros.ts). */
const FAMILIA: Record<string, Partial<Record<Cat, number>>> = {
  "no-muertos": { curiosidad: 1.5, material: 1.5, gema_arte: 1.2, comida_bebida: 0.3 },
  fauna: { trofeo: 2.5, ingrediente: 1.5, comida_bebida: 0.5, documento: 0.2, llave_sello: 0.2 },
  monstruos: { trofeo: 2, material: 1.5, ingrediente: 1.5, documento: 0.3 },
  humanos: { documento: 2, herramienta: 1.5, comida_bebida: 1.5, llave_sello: 1.5, gema_arte: 1.3, trofeo: 0.2 },
  inquisicion: { documento: 2, llave_sello: 2, herramienta: 1.3, trofeo: 0.2 },
  culto: { documento: 2, curiosidad: 1.5, ingrediente: 1.3, trofeo: 0.2 },
  corte_palida: { gema_arte: 2, documento: 1.5, llave_sello: 1.5, trofeo: 0.2 },
};

const norm = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
const elegirPeso = <T>(l: { x: T; w: number }[]): T | undefined => {
  const total = l.reduce((s, y) => s + y.w, 0);
  if (!(total > 0)) return undefined;
  let r = (tirar("1d1000").total - 0.5) / 1000 * total;
  for (const y of l) { r -= y.w; if (r <= 0) return y.x; }
  return l[l.length - 1].x;
};
const yaHay = (partida: Partida, nombre: string) => Object.values(partida.objetos).some((o) => o.nombre.startsWith(nombre));

/** ¿Es una petición con datos nuevos? Si no, vale el generador antiguo. */
export const esBotinNuevo = (b: PeticionBotinTesoro) => b.peligro !== undefined || !!b.region || !!b.criatura || !!b.categorias?.length;

/** Registra una entrada del catálogo: devuelve la línea para el DM y la de los jugadores. */
function entrada(partida: Partida, x: EntradaTesoro, compra: boolean): { dm: string; jug: string } {
  const n = !x.cant ? 1 : x.cant[0] === x.cant[1] ? x.cant[0] : tirar(`1d${x.cant[1] - x.cant[0] + 1}`).total + x.cant[0] - 1;
  const nombre = x.cant ? `${x.nombre} (${n})` : x.nombre;
  const valor = x.valor_po * n;
  if (x.unico) {
    const o = crearObjeto(partida, { nombre: x.nombre, calidad: "normal", apariencia: x.sabor ?? x.nombre, verdad: x.uso ?? x.sabor ?? x.nombre, precio: valor });
    return { dm: `- ${o.nombre} — ${valor} po: ${x.uso ?? x.sabor ?? ""}`, jug: `- ${o.nombre}${compra ? ` — ${valor} po` : ""}${x.sabor ? `: ${x.sabor}` : ""}` };
  }
  return { dm: `- ${nombre} — ${valor} po${x.material && x.uso ? `: ${x.uso}` : ""}`, jug: `- ${nombre}${compra ? ` — ${valor} po` : ""}${x.sabor ? `: ${x.sabor}` : ""}` };
}

/** Temas del saber por región (sin Æsir: es secreto del DM). */
const TEMAS_REGION: Record<string, string[]> = { aldenmar: ["juez", "inquisicion", "cuervo"], cienagas: ["madre", "podre"], "marca hueca": ["ysolde", "podre"], "velo rojo": ["lobo", "caidos"], agujas: ["dioses", "caidos"], karak: ["dioses"] };
function rumorHallado(criatura: string | undefined, lugar: string): { nombre: string; texto: string } | undefined {
  const propio = criatura ? buscarTema(criatura) : undefined;
  const clave = Object.keys(TEMAS_REGION).find((k) => lugar.includes(k));
  const pool = propio ? [propio] : TEMAS.filter((x) => x.id !== "aesir" && (!clave || TEMAS_REGION[clave].includes(x.id)));
  const x = pool.length ? elegir(pool) : undefined;
  const texto = x?.rumor ?? x?.publico;
  return x && texto && x.id !== "aesir" ? { nombre: x.nombre, texto } : undefined;
}

/** Botín con peligro, región, criatura y categorías (retrocompatible: sin ellos, el antiguo). */
export function generarBotinDe(partida: Partida, b: PeticionBotinTesoro): { dm: string; jugadores: string } {
  if (!esBotinNuevo(b)) return generarBotin(partida, b);
  const c = b.criatura ? buscarCriatura(b.criatura) : undefined;
  const peligro = Math.min(5, Math.max(1, Math.round(b.peligro ?? c?.peligro ?? 2)));
  const region = b.region ?? c?.region ?? "";
  const lugar = norm(`${region} ${bonusDe(region)?.clave ?? ""}`);
  const familia = c ? familiaDe(c.nombre) : "";
  const mar = enMar(partida, region || undefined);
  const dm: string[] = [], jug: string[] = [];
  const compra = b.origen === "compra";
  const vistos = new Set<string>();

  // (1) Lo que lleva la criatura: su botín estructurado (L3) o, si no lo tiene, lo que el catálogo le asigna; cada pieza con su probabilidad.
  // En un hallazgo en la guarida de un jefe, lo que guarda su guarida (guarida.ts) en lugar de lo que lleva encima.
  if (b.criatura) {
    const guar = b.origen === "hallazgo" && c ? tesoroGuarida(c.nombre) : undefined;
    const items = guar?.piezas ?? c?.botinItems ?? tesoroDe(c?.nombre ?? b.criatura).filter((x) => !x.unico).map((x) => ({ id: x.id, probabilidad: 40 }));
    for (const it of items) {
      const x = tesoroPorId(it.id);
      if (!x || vistos.has(x.id) || (x.unico && yaHay(partida, x.nombre)) || tirar("1d100").total > it.probabilidad) continue;
      vistos.add(x.id);
      const l = entrada(partida, x, compra);
      dm.push(l.dm); jug.push(l.jug);
    }
  }

  // (2) La tabla por origen × peligro × región × familia sobre el catálogo (y el equipo)
  const permitidas = b.categorias?.length ? new Set<Cat>(b.categorias) : undefined;
  const forzarEquipo = !!(b.clase || b.calidad); // pedir clase o calidad es pedir equipo
  for (let i = 0; i < b.cantidad; i++) {
    let hecho = false;
    for (let intento = 0; intento < 8 && !hecho; intento++) {
      const pesos: { x: Cat; w: number }[] = Object.entries(PESOS[b.origen]).map(([k, w]) => {
        const cat = k as Cat;
        let peso = w as number * (FAMILIA[familia]?.[cat] ?? 1);
        if (cat === "trofeo" && !c) peso = 0; // sin criatura no hay trofeos que sacar
        if (cat === "nautico") peso = mar ? peso * 3 : 0; // en el mar, buena parte del botín es de nave
        if (permitidas && !permitidas.has(cat)) peso = 0;
        if (forzarEquipo) peso = cat === "equipo" ? 1 : 0;
        return { x: cat, w: peso };
      });
      const cat = elegirPeso(pesos);
      if (!cat) break;
      if (cat === "equipo") {
        const o = generarUno(partida, b.origen, b.clase, b.calidad ?? (tirarCalidad(b.origen, peligro) as CalidadObjeto));
        dm.push(`- ${o.nombre} (${o.calidad}, ${o.precio} po): ${o.verdad}`);
        jug.push(`- ${o.nombre}${compra ? ` — ${o.precio} po` : ""}: ${o.apariencia}`);
        hecho = true;
        continue;
      }
      const cand = TESORO.filter((x) => x.categoria === cat && x.peligroMin <= peligro && !vistos.has(x.id) && (!x.unico || !yaHay(partida, x.nombre))
        && (!x.criaturas || (c && x.criaturas.includes(c.nombre))))
        .map((x) => {
          let w = 1;
          if (x.regiones?.length) w = x.regiones.some((r) => (r === "mar" ? mar : lugar.includes(norm(r)))) ? 4 : 0.3;
          if (x.criaturas) w *= 6;
          if (peligro >= 3 && x.valor_po >= 20) w *= 1.5;
          if (peligro <= 2 && x.valor_po > 40) w *= 0.3;
          return { x, w };
        });
      const x = elegirPeso(cand);
      if (!x) continue;
      vistos.add(x.id);
      const l = entrada(partida, x, compra);
      dm.push(l.dm); jug.push(l.jug);
      hecho = true;
    }
  }

  // (2 bis) Un hallazgo a veces trae una pista escrita: un rumor del saber del mundo (solo la capa de rumor o la pública; nunca lo erudito, lo restringido ni lo secreto)
  if (b.origen === "hallazgo" && tirar("1d100").total <= 20) {
    const r = rumorHallado(c?.nombre, lugar);
    if (r) { dm.push(`- Pista escrita (rumor sobre «${r.nombre}», puede estar deformado; cuéntalo tú): ${r.texto}`); jug.push("- Un papel con un rumor anotado"); }
  }

  // (3) Oro sugerido (nunca se aplica solo) y (4) extras de siempre: Behelit, catalizador y viales
  const oro = compra ? 0 : oroSugerido(peligro, b.origen);
  if (oro) { dm.push(`- Oro: ${oro} po (sugerido: súmalo con modificar_personaje {oro_cambio: ${oro}} a quien lo recoja)`); jug.push(`- ${oro} po`); }
  extrasBotin(partida, b, dm, jug);
  return {
    dm: `Botín (${b.origen}, P${peligro}${b.criatura ? `, ${b.criatura}` : ""}${region && !b.criatura ? `, ${region}` : ""}). Añade con modificar_personaje lo que se queden (nombre exacto, con su [O#]); el oro, con oro_cambio.\n${dm.join("\n")}`,
    jugadores: jug.join("\n"),
  };
}

export const CATEGORIAS_BOTIN: readonly Cat[] = ["equipo", ...CATEGORIAS_TESORO];
