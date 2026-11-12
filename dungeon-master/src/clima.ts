// Estaciones y clima por región. Todo el lore (nombres, descripciones, tono) son PROPUESTAS a confirmar por el dueño (ver docs/CLIMA.md).
// OPCIONAL por partida: sin `partida.calendario` nada de esto actúa (clima neutro, factores 1) y las partidas antiguas siguen igual.
// Datos y funciones puras: el clima de cada día sale de una semilla (día + región), sin Math.random, así que es el mismo para todos y estable al recargar.
import type { Partida, Personaje } from "./estado.js";
import { buscarRegion } from "./mapa.js";

export const DIAS_ANIO = 360;
export const DIAS_ESTACION = 90;
/** Día del año en que cae el «Día 1» de una partida nueva: mitad del otoño (día 45 de 90). */
export const INICIO_DEFECTO = 225;
const DIA = 86400;

export const ESTACIONES = ["Primavera", "Verano", "Otoño", "Invierno"] as const;
export type Estacion = (typeof ESTACIONES)[number];
export const ICONO_ESTACION = ["🌱", "☀️", "🍂", "❄️"] as const;
export const TEMPERATURAS = ["helada", "fría", "fresca", "templada", "cálida", "tórrida"] as const;
export type Temperatura = (typeof TEMPERATURAS)[number];
export const BASE = "Marca de Velmora";

export interface PerfilEstacion {
  /** Cómo la llaman allí («el Invierno de Ceniza»). */
  nombreLocal: string;
  descripcion: string;
  temperatura: Temperatura;
  /** Climas posibles con su peso. */
  climas: Record<string, number>;
  /** Hora (decimal) del amanecer y del ocaso. */
  luz: [number, number];
  notas?: string;
}
type Perfiles = [PerfilEstacion, PerfilEstacion, PerfilEstacion, PerfilEstacion];
const P = (nombreLocal: string, descripcion: string, temperatura: Temperatura, climas: Record<string, number>, luz: [number, number], notas?: string): PerfilEstacion => ({ nombreLocal, descripcion, temperatura, climas, luz, ...(notas ? { notas } : {}) });

export const PERFILES: Record<string, Perfiles> = {
  "Aldenmar": [
    P("el Deshielo Gris", "La nieve sucia se funde en regueros negros por las calles y las hogueras de la Llama Gris humean sobre el barro.", "fresca", { nublado: 4, lluvia: 3, niebla: 2, ceniza: 1, despejado: 1, tormenta: 1 }, [7, 19]),
    P("el Sol Pálido", "El disco gris apenas calienta, pero el aire de la Ciudad-Faro se vuelve espeso y huele a brasa y a piedra recalentada.", "cálida", { despejado: 3, nublado: 3, tormenta: 2, calima: 1, ceniza: 1 }, [6, 20], "Luz tenue: el día no llega a ser claro del todo."),
    P("la Lluvia Negra", "Cae ceniza mezclada con agua: los tejados chorrean tinta y los faroleros no dan abasto.", "fresca", { ceniza: 4, lluvia: 3, niebla: 2, nublado: 2, tormenta: 1 }, [7.5, 18]),
    P("el Invierno de Ceniza", "Nieve gris sobre una ciudad que huele a humo; las campanas suenan apagadas y la luz muere pronto.", "fría", { ceniza: 3, nieve: 3, nublado: 2, ventisca: 1, niebla: 1, aguanieve: 1 }, [8.5, 16.5]),
  ],
  "Las Agujas de Vahl": [
    P("el Deshielo de Vahl", "Los neveros se parten con estruendo y los pasos se llenan de aludes menudos y de agua helada.", "fresca", { nublado: 3, despejado: 2, lluvia: 2, nieve: 2, ventisca: 1 }, [7, 18.5]),
    P("el Breve Estío", "Unas pocas semanas de aire fino y cielo duro en las que los monasterios abren sus puertas a los vientos.", "templada", { despejado: 4, nublado: 2, tormenta: 2, lluvia: 1 }, [6, 20]),
    P("los Vientos Ciegos", "Rachas que silban entre las agujas y arrancan el aliento; la niebla de altura se come los senderos.", "fría", { nublado: 3, niebla: 2, nieve: 2, ventisca: 1, despejado: 1 }, [8, 17]),
    P("la Larga Nevada", "Meses de nieve que no cesa: los monasterios se cierran, los flagelantes ayunan y el silencio pesa como una losa.", "helada", { ventisca: 4, nieve: 4, nublado: 1, despejado: 1 }, [9, 15.5], "El día más corto de Velmora."),
  ],
  "Karak-Dûm": [
    P("el Turno del Deshielo", "Las galerías gotean y el eco de las forjas se mezcla con el agua que baja por las grietas del Sello.", "fresca", { nublado: 3, niebla: 2, despejado: 2, lluvia: 2 }, [7.5, 18.5], "Bajo tierra casi no se nota la estación: perfil casi constante."),
    P("el Turno de la Forja Viva", "El calor de las forjas sube por los pozos y la piedra suda; fuera, el sol herido apenas se distingue.", "fresca", { despejado: 3, nublado: 3, niebla: 2, tormenta: 1 }, [7.5, 18.5], "Bajo tierra casi no se nota la estación: perfil casi constante."),
    P("el Turno de las Sombras", "Las galerías se enfrían y los centinelas del Sello doblan las guardias mientras las puertas crujen.", "fresca", { nublado: 3, niebla: 2, despejado: 2, lluvia: 1 }, [7.5, 18.5], "Bajo tierra casi no se nota la estación: perfil casi constante."),
    P("el Turno del Hielo en las Puertas", "La escarcha cubre los portones sellados y el aliento se hiela en las bocas de las minas.", "fría", { nublado: 3, nieve: 2, niebla: 1, despejado: 1 }, [8, 18], "Bajo tierra casi no se nota la estación: perfil casi constante."),
  ],
  "El Bosque de Velo Rojo": [
    P("la Savia Roja", "El bosque rezuma savia color óxido y las voces de los muertos suenan más cerca, húmedas, entre las hojas nuevas.", "fresca", { lluvia: 3, niebla: 3, nublado: 2, despejado: 1 }, [7, 19]),
    P("el Verano de Susurros", "Bochorno bajo el dosel rojo: el aire no se mueve y cada rama parece murmurar un nombre.", "templada", { niebla: 3, despejado: 2, tormenta: 2, nublado: 2 }, [6, 20.5]),
    P("la Caída Roja", "Las hojas caen como gotas de sangre seca y alfombran los senderos con un crujido que delata a todo el que pasa.", "fresca", { niebla: 4, lluvia: 3, nublado: 2, ceniza: 1 }, [7.5, 18]),
    P("el Invierno de los Callados", "La nieve se come las voces: durante semanas el bosque enmudece, y ese silencio es peor que el murmullo.", "fría", { nieve: 3, niebla: 3, nublado: 2, ventisca: 1 }, [8.5, 16.5]),
  ],
  "Las Ciénagas de Hollín": [
    P("las Crecidas", "El agua negra sube y borra los senderos; los barqueros cobran el doble y los troncos flotan como cadáveres.", "templada", { lluvia: 4, niebla: 3, nublado: 2, tormenta: 1 }, [6.5, 19.5]),
    P("las Fiebres", "Calor de caldo y nubes de insectos; el aire huele a podredumbre y los febriles deliran en las barcazas.", "tórrida", { calima: 3, tormenta: 3, niebla: 2, despejado: 1, lluvia: 1 }, [5.5, 20.5], "Tórrida: la sed corre más deprisa."),
    P("las Nieblas Espesas", "La niebla no se levanta en semanas y la voz se pierde a tres pasos: los hombres lagarto cazan a gusto.", "fresca", { niebla: 4, lluvia: 3, nublado: 2, ceniza: 1 }, [7, 18.5]),
    P("la Helada Negra", "Una escarcha de hollín cubre las cañas y el cieno cruje bajo las botas; el frío cala hasta el hueso húmedo.", "fría", { niebla: 4, nublado: 2, lluvia: 2, aguanieve: 1 }, [7.5, 17.5]),
  ],
  "La Marca Hueca": [
    P("el Fango de la Guerra", "El páramo se vuelve un lodazal donde afloran huesos, hebillas y estandartes de hace un siglo.", "fresca", { nublado: 3, lluvia: 2, despejado: 2, tormenta: 1 }, [6.5, 19.5]),
    P("la Sed de la Marca", "El polvo de los huesos flota en un aire reseco y sin sombra; los pozos del páramo se agotan.", "cálida", { calima: 4, despejado: 3, tormenta: 1, nublado: 1 }, [5.5, 20.5]),
    P("el Viento de Estandartes", "Un viento seco arrastra ceniza y jirones de tela por los campos de batalla, con un lamento casi humano.", "fresca", { ceniza: 3, nublado: 3, lluvia: 2, tormenta: 1, niebla: 1 }, [7, 18]),
    P("el Invierno de los Cuervos", "Nieve sobre los muertos del campo y bandadas negras que no se van: el páramo parece un cementerio de verdad.", "fría", { nublado: 3, nieve: 2, ceniza: 2, niebla: 2, ventisca: 1 }, [8, 17]),
  ],
  [BASE]: [
    P("la Primavera Herida", "El deshielo llega sin alegría: brotes pálidos bajo un sol que no termina de curarse.", "templada", { nublado: 3, lluvia: 3, despejado: 2, niebla: 1 }, [6.5, 19.5]),
    P("el Verano Pálido", "Días largos y de luz lechosa; calor sin brillo que reseca los caminos.", "cálida", { despejado: 3, nublado: 2, tormenta: 2, calima: 1 }, [5.5, 20.5]),
    P("el Otoño Gris", "Lluvias frías y cielos bajos; las hojas caen sobre un mundo que ya huele a ceniza.", "fresca", { nublado: 3, lluvia: 3, ceniza: 2, niebla: 1 }, [7, 18.5]),
    P("el Invierno Sin Sol", "Noches largas y un sol que apenas asoma: la nieve sucia cubre los caminos y el frío no perdona.", "fría", { nublado: 3, nieve: 2, ceniza: 2, niebla: 1, ventisca: 1 }, [8, 17]),
  ],
};

// «Llovizna»: clima suave entre nublado y lluvia, derivado donde hay lluvia (y no hace un frío de nieve).
for (const v of Object.values(PERFILES)) for (const e of v) if ("lluvia" in e.climas && e.temperatura !== "helada") e.climas.llovizna = Math.max(1, Math.round(e.climas.lluvia / 2));
/** Climas «de agua»: sacian al Tritón y le dan bonus (la niebla no cuenta). */
export const CLIMAS_AGUA = ["llovizna", "lluvia", "tormenta"];

/** Climas que se empujan al intensificarse cada estación (solo los que la región ya tiene). */
const EXTREMOS: string[][] = [["lluvia", "tormenta"], ["calima", "tormenta", "despejado"], ["tormenta", "ceniza", "niebla"], ["nieve", "ventisca"]];
const ETIQUETA: Record<string, string> = { ceniza: "lluvia de ceniza", calima: "calima", ventisca: "ventisca", aguanieve: "aguanieve" };
export const etiquetaClima = (c: string): string => ETIQUETA[c] ?? c;

// ------------------------------------------------------------------ anomalías
export interface Anomalia {
  id: string;
  nombre: string;
  causa: string;
  tipo: "larga" | "intensa" | "ambas";
  /** Estación base que afecta. */
  estacion: string;
  /** Región o «todas». */
  region: string;
  /** Día de la partida en que empieza. */
  desde: number;
  /** Días que alarga la estación (0-60). */
  extraDias: number;
  /** 0 (solo larga) a 3. */
  intensidad: number;
  /** Último día de la partida de la estación base (sin la prórroga). */
  fin: number;
  /** Último día de la anomalía (fin + extraDias, o antes si se termina). */
  hasta: number;
  /** ¿Lo saben los jugadores o es un rumor del DM? */
  publica: boolean;
  /** Cerrada por el DM antes de tiempo. */
  terminada?: boolean;
}
export interface Calendario { inicio: number; anomalias?: Anomalia[] }

export const MAX_EXTRA_DIAS = 60;
export const MAX_INTENSIDAD = 3;

const sinTildes = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const hash = (s: string): number => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
/** PRNG mulberry32: determinista a partir de una semilla entera. */
export function mulberry32(a: number): () => number {
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export const diaDe = (segundos: number): number => Math.floor(segundos / DIA) + 1;
export const diaDePartida = (p: Partida): number => (p.reloj ? diaDe(p.reloj.segundos) : 1);

/** Nombre canónico de una región (o «Marca de Velmora» si no hay región clara). */
export function nombreRegion(region?: string): string {
  const r = region ? buscarRegion(region) : undefined;
  return r?.nombre ?? BASE;
}
/** Región donde está el grupo (si viaja, la de partida). */
export function regionActual(p: Partida): string {
  const m = p.mapa;
  const id = m?.ruta?.desde ?? m?.posicion;
  return nombreRegion(id ? m.lugares?.[id]?.region : undefined);
}
const perfiles = (region: string): Perfiles => PERFILES[nombreRegion(region)] ?? PERFILES[BASE];

/** Activa el calendario si la partida no lo tiene y ya hay reloj. Idempotente; devuelve si lo activó. */
export function activarCalendario(p: Partida): boolean {
  if (p.calendario || !p.reloj) return false;
  p.calendario = { inicio: INICIO_DEFECTO, anomalias: [] };
  return true;
}

export interface Fecha { diaAnio: number; estacion: number; diaEstacion: number; extendida?: Anomalia }
const anomaliasDe = (cal: Calendario, region: string): Anomalia[] => (cal.anomalias ?? []).filter((a) => a.region === "todas" || a.region === region);
const diaAnioDe = (inicio: number, base: number) => ((((inicio + base - 2) % DIAS_ANIO) + DIAS_ANIO) % DIAS_ANIO) + 1;

/** Estación y día dentro de ella para un día de la partida. Las anomalías «largas» retrasan el cambio de estación (desfase acumulado): los días anteriores no cambian. */
export function fechaDe(cal: Calendario, region: string, dia: number): Fecha {
  const largas = anomaliasDe(cal, region).filter((a) => a.extraDias > 0).sort((x, y) => x.fin - y.fin);
  let desfase = 0;
  for (const a of largas) {
    if (dia > a.fin + a.extraDias) desfase += a.extraDias;
    else if (dia > a.fin) {
      const da = diaAnioDe(cal.inicio, a.fin - desfase);
      return { diaAnio: da, estacion: Math.floor((da - 1) / DIAS_ESTACION), diaEstacion: DIAS_ESTACION + (dia - a.fin), extendida: a };
    }
  }
  const da = diaAnioDe(cal.inicio, dia - desfase);
  return { diaAnio: da, estacion: Math.floor((da - 1) / DIAS_ESTACION), diaEstacion: ((da - 1) % DIAS_ESTACION) + 1 };
}
/** La estación de un día (null sin calendario). */
export function estacionDe(p: Partida, region?: string, dia?: number): Fecha | null {
  return p.calendario ? fechaDe(p.calendario, nombreRegion(region ?? regionActual(p)), dia ?? diaDePartida(p)) : null;
}
export const anomaliaEn = (cal: Calendario, region: string, dia: number): Anomalia | undefined => {
  const l = anomaliasDe(cal, region).filter((a) => a.desde <= dia && dia <= a.hasta);
  return l.find((a) => a.region !== "todas") ?? l[0];
};
const intensidadDe = (a?: Anomalia) => (a && a.tipo !== "larga" ? a.intensidad : 0);

const escalon = (t: Temperatura, est: number): Temperatura => {
  const i = TEMPERATURAS.indexOf(t);
  const sube = est === 1 ? true : est === 3 ? false : i >= 3;
  return TEMPERATURAS[Math.max(0, Math.min(5, i + (sube ? 1 : -1)))];
};

/** Pesos de los climas de un día (con la anomalía intensa empujando hacia lo extremo de la estación). */
export function pesosClima(region: string, est: number, intensidad: number): Record<string, number> {
  const w = { ...perfiles(region)[est].climas };
  if (intensidad > 0) for (const c of EXTREMOS[est]) if (c in w) w[c] *= 1 + intensidad;
  return w;
}

/** El clima del día, determinista (semilla = región + día). Sin calendario: null. */
export function climaDe(p: Partida, region: string, dia: number): { clima: string; etiqueta: string } | null {
  if (!p.calendario) return null;
  const reg = nombreRegion(region);
  const f = fechaDe(p.calendario, reg, dia);
  const w = pesosClima(reg, f.estacion, intensidadDe(anomaliaEn(p.calendario, reg, dia)));
  const total = Object.values(w).reduce((a, b) => a + b, 0);
  let x = mulberry32(hash(`${reg}|${dia}`))() * total;
  let elegido = Object.keys(w)[0];
  for (const [c, v] of Object.entries(w)) { elegido = c; x -= v; if (x < 0) break; }
  return { clima: elegido, etiqueta: etiquetaClima(elegido) };
}

export interface Condiciones {
  region: string;
  fecha: Fecha;
  estacion: string;
  nombreLocal: string;
  clima: string;
  etiqueta: string;
  temperatura: Temperatura;
  /** Multiplicadores (1 = sin efecto). */
  factorSed: number;
  factorHambre: number;
  factorViaje: number;
  intensidad: number;
  anomalia?: Anomalia;
}
const FACTOR_SED: Partial<Record<Temperatura, number>> = { cálida: 1.25, tórrida: 1.5 };
const FACTOR_HAMBRE: Partial<Record<Temperatura, number>> = { helada: 1.25, fría: 1.1 };
const FACTOR_VIAJE: Record<string, number> = { nieve: 0.75, aguanieve: 0.75, ventisca: 0.6, tormenta: 0.6 };
const r2 = (n: number) => Math.round(n * 100) / 100;

/** Todo lo que el calendario cambia en un día y región (null sin calendario). La intensidad multiplica el exceso de cada factor en +25 % por nivel. */
export function condicionesDe(p: Partida, region?: string, dia?: number): Condiciones | null {
  const cal = p.calendario;
  if (!cal) return null;
  const reg = nombreRegion(region ?? regionActual(p));
  const d = dia ?? diaDePartida(p);
  const fecha = fechaDe(cal, reg, d);
  const an = anomaliaEn(cal, reg, d);
  const n = intensidadDe(an);
  const perfil = perfiles(reg)[fecha.estacion];
  const c = climaDe(p, reg, d)!;
  const temperatura = n > 0 ? escalon(perfil.temperatura, fecha.estacion) : perfil.temperatura;
  const k = 1 + 0.25 * n;
  const sed = 1 + ((FACTOR_SED[temperatura] ?? 1) * (c.clima === "calima" ? 1.1 : 1) - 1) * k;
  const hambre = 1 + ((FACTOR_HAMBRE[temperatura] ?? 1) - 1) * k;
  const viaje = Math.max(0.3, 1 - (1 - (FACTOR_VIAJE[c.clima] ?? 1)) * k);
  return { region: reg, fecha, estacion: ESTACIONES[fecha.estacion], nombreLocal: perfil.nombreLocal, clima: c.clima, etiqueta: c.etiqueta, temperatura, factorSed: r2(sed), factorHambre: r2(hambre), factorViaje: r2(viaje), intensidad: n, anomalia: an };
}

/** Multiplicador de peso de un encuentro según la estación: ×2 si está en su lista y ×0,5 si no (×1,5 más por nivel de una anomalía intensa). Sin calendario o sin lista: 1. */
export function pesoEstacion(p: Partida, region: string, estaciones?: string[]): number {
  if (!p.calendario || !estaciones?.length) return 1;
  const reg = nombreRegion(region);
  const f = fechaDe(p.calendario, reg, diaDePartida(p));
  if (!estaciones.includes(ESTACIONES[f.estacion])) return 0.5;
  return 2 * Math.pow(1.5, intensidadDe(anomaliaEn(p.calendario, reg, diaDePartida(p))));
}

// ------------------------------------------------------------------ luz
const hhmm = (h: number) => `${String(Math.floor(h)).padStart(2, "0")}:${String(Math.round((h % 1) * 60)).padStart(2, "0")}`;
export interface Luz { estado: "día" | "amanecer" | "ocaso" | "noche cerrada"; amanecer: number; ocaso: number }
/** La luz a una hora dada (decimal) en una región y estación. Una hora de amanecer y otra de ocaso. */
export function luzA(region: string, est: number, hora: number): Luz {
  const [a, o] = perfiles(region)[est].luz;
  const estado = hora >= a && hora < o ? "día" : hora >= a - 1 && hora < a ? "amanecer" : hora >= o && hora < o + 1 ? "ocaso" : "noche cerrada";
  return { estado, amanecer: a, ocaso: o };
}
export function luzActual(p: Partida): Luz | null {
  const f = estacionDe(p);
  if (!f || !p.reloj) return null;
  return luzA(regionActual(p), f.estacion, (p.reloj.segundos % DIA) / 3600);
}

// ------------------------------------------------------------------ textos
const coma = (n: number) => String(n).replace(".", ",");
const SIGUIENTE = (e: number) => ESTACIONES[(e + 1) % 4].toLowerCase();
const plural = (n: string) => /^(las|los) /.test(n);
const mayus = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/** Avisos de factores activos («calor: la sed corre ×1,25»). */
export function textoFactores(c: Condiciones): string[] {
  const out: string[] = [];
  if (c.factorSed > 1) out.push(`calor: la sed corre ×${coma(c.factorSed)} (no a cubierto ni en el agua)`);
  if (c.factorHambre > 1) out.push(`frío: el hambre corre ×${coma(c.factorHambre)}`);
  if (c.factorViaje < 1) out.push(`${c.etiqueta}: el viaje rinde ×${coma(c.factorViaje)} de km`);
  return out;
}

export function estadoAnomalia(a: Anomalia, hoy: number): string {
  const quedan = a.hasta - hoy;
  const ya = hoy >= a.desde;
  const rasgo = a.tipo === "larga" ? `alarga ${a.extraDias} días` : a.tipo === "intensa" ? `intensidad ${a.intensidad}` : `alarga ${a.extraDias} días e intensidad ${a.intensidad}`;
  return `${a.nombre} (${a.tipo}: ${rasgo}; ${a.estacion}, ${a.region === "todas" ? "todas las regiones" : a.region}) — causa: ${a.causa}. ${ya ? `Quedan ${Math.max(0, quedan)} día(s) (hasta el día ${a.hasta}).` : `Empieza el día ${a.desde}.`} ${a.publica ? "Pública." : "RUMOR: los jugadores no lo saben."}`;
}

/** Línea del estado del DM: estación, clima de hoy, temperatura, luz y factores activos. Vacía sin calendario. */
export function textoEstacion(p: Partida): string {
  const c = condicionesDe(p);
  if (!c) return "";
  const l = luzActual(p)!;
  const hoy = diaDePartida(p);
  const prox = c.fecha.diaEstacion >= DIAS_ESTACION && !c.fecha.extendida ? ` Mañana cambia la estación.` : "";
  const fact = textoFactores(c);
  const lineas = [
    `${ICONO_ESTACION[c.fecha.estacion]} ${c.estacion} (${c.nombreLocal}), día ${c.fecha.diaEstacion}${c.fecha.diaEstacion > DIAS_ESTACION ? ` (se alarga: más allá de los ${DIAS_ESTACION})` : `/${DIAS_ESTACION}`} en ${c.region}. Hoy: ${c.etiqueta}, temperatura ${c.temperatura}. Luz: ${l.estado} (amanece ${hhmm(l.amanecer)}, ocaso ${hhmm(l.ocaso)}).${prox}`,
    perfiles(c.region)[c.fecha.estacion].descripcion,
    fact.length ? `Factores activos (los aplica el motor): ${fact.join("; ")}.` : "",
  ];
  const an = anomaliaEn(p.calendario!, c.region, hoy);
  if (an) lineas.push(`ANOMALÍA ESTACIONAL activa: ${estadoAnomalia(an, hoy)}`);
  return `## Estación y clima\n${lineas.filter(Boolean).join("\n")}`;
}

/** Texto corto del panel de la página: «🍂 Otoño · lluvia de ceniza», o con anomalía pública «🥶 Invierno intenso · Hambruna del Wendigo». */
export function textoPanel(p: Partida): { texto: string; titulo: string } | null {
  const c = condicionesDe(p);
  if (!c) return null;
  const an = c.anomalia?.publica ? c.anomalia : undefined;
  const titulo = `${c.nombreLocal} en ${c.region}: ${perfiles(c.region)[c.fecha.estacion].descripcion}`;
  if (!an) return { texto: `${ICONO_ESTACION[c.fecha.estacion]} ${c.estacion} · ${c.etiqueta}`, titulo };
  const intensa = an.tipo !== "larga";
  const icono = intensa ? (c.fecha.estacion === 1 ? "🥵" : c.fecha.estacion === 3 ? "🥶" : "⚠️") : "⏳";
  const rasgo = intensa ? "intenso" : c.fecha.estacion === 0 ? "larga" : "largo";
  return { texto: `${icono} ${c.estacion} ${rasgo} · ${an.nombre}`, titulo };
}

/** Avisos públicos al avanzar el reloj: cambio de estación y comienzo o fin de una anomalía pública. */
export function avisosDeCalendario(p: Partida, segAntes: number): string[] {
  const cal = p.calendario;
  if (!cal || !p.reloj) return [];
  const dA = diaDe(segAntes), dD = diaDePartida(p);
  if (dD <= dA) return [];
  const reg = regionActual(p);
  const A = fechaDe(cal, reg, dA), D = fechaDe(cal, reg, dD);
  const aA = anomaliaEn(cal, reg, dA), aD = anomaliaEn(cal, reg, dD);
  const out: string[] = [];
  if (aA?.publica && aA !== aD) out.push(`🌤 ${aA.nombre} termina: ${perfiles(reg)[A.estacion].nombreLocal} vuelve a su curso.`);
  if (aD?.publica && aD !== aA) out.push(mensajeInicio(aD, reg));
  if (A.estacion !== D.estacion) {
    const pf = perfiles(reg)[D.estacion];
    out.push(`${ICONO_ESTACION[D.estacion]} ${plural(pf.nombreLocal) ? "Llegan" : "Llega"} ${pf.nombreLocal} en ${reg}… ${pf.descripcion}`);
  }
  return out;
}
function mensajeInicio(a: Anomalia, reg: string): string {
  const est = ESTACIONES.indexOf(a.estacion as Estacion);
  const loc = perfiles(reg)[Math.max(0, est)].nombreLocal;
  const t = a.tipo === "intensa" ? `${mayus(loc)} golpea con una fuerza fuera de lo común.` : `${mayus(loc)} se alarga: nadie sabe cuándo llegará ${SIGUIENTE(Math.max(0, est))}…${a.tipo === "ambas" ? " Y viene más cruda que nunca." : ""}`;
  return `${a.tipo === "intensa" ? (est === 1 ? "🥵" : "🥶") : "⏳"} ${a.nombre}. ${t}`;
}

// ------------------------------------------------------------------ la herramienta
export interface DatosClima {
  accion: "ver" | "pronostico" | "anomalia" | "terminar_anomalia";
  id?: string;
  nombre?: string;
  causa?: string;
  tipo?: Anomalia["tipo"];
  estacion?: string;
  region?: string;
  desde?: number;
  extra_dias?: number;
  intensidad?: number;
  publica?: boolean;
}
const hayCalendario = (p: Partida) => { if (!p.calendario) throw new Error("Esta partida no tiene calendario (las estaciones son opcionales): no hay clima que consultar."); return p.calendario; };

const vago = (c: Record<string, number>): string => {
  const total = Object.values(c).reduce((a, b) => a + b, 0);
  const l = Object.entries(c).sort((a, b) => b[1] - a[1]).filter(([, v]) => v / total >= 0.15).slice(0, 3);
  return l.map(([k, v], i) => `${i === 0 && v / total >= 0.35 ? "lo más probable" : "posible"}: ${etiquetaClima(k)}`).join(", ");
};

export function clima(p: Partida, d: DatosClima): { texto: string; aviso?: string } {
  const cal = hayCalendario(p);
  const hoy = diaDePartida(p);
  const reg = regionActual(p);
  if (d.accion === "ver") {
    const c = condicionesDe(p)!;
    const l = luzActual(p)!;
    const fact = textoFactores(c);
    const todas = (cal.anomalias ?? []).filter((a) => a.hasta >= hoy && !a.terminada);
    return { texto: [
      `${ICONO_ESTACION[c.fecha.estacion]} ${c.estacion} (${c.nombreLocal}), día ${c.fecha.diaEstacion} en ${c.region}. Hoy: ${c.etiqueta}, temperatura ${c.temperatura}. Luz: ${l.estado} (amanece ${hhmm(l.amanecer)}, ocaso ${hhmm(l.ocaso)}).`,
      perfiles(c.region)[c.fecha.estacion].descripcion,
      fact.length ? `Factores activos: ${fact.join("; ")}.` : "Sin factores especiales hoy.",
      ...todas.map((a) => `Anomalía: ${estadoAnomalia(a, hoy)}`),
    ].join("\n") };
  }
  if (d.accion === "pronostico") {
    const lineas: string[] = [];
    for (let i = 1; i <= 3; i++) {
      const f = fechaDe(cal, reg, hoy + i), an = anomaliaEn(cal, reg, hoy + i);
      const pf = perfiles(reg)[f.estacion];
      lineas.push(`${i === 1 ? "Mañana" : `Dentro de ${i} días`}: ${vago(pesosClima(reg, f.estacion, intensidadDe(an)))}; temperatura ${pf.temperatura}.`);
    }
    const f0 = fechaDe(cal, reg, hoy), f3 = fechaDe(cal, reg, hoy + 3);
    if (f0.estacion !== f3.estacion) lineas.push(`Se huele el cambio de estación: ${perfiles(reg)[f3.estacion].nombreLocal} está a la vuelta.`);
    const pub = anomaliaEn(cal, reg, hoy);
    if (pub?.publica) lineas.push(`Y ${pub.nombre} sigue ahí: quedan unos ${Math.max(0, pub.hasta - hoy)} días.`);
    return { texto: `Pronóstico de ${reg} (probabilidades vagas, no es el clima exacto):\n${lineas.join("\n")}` };
  }
  if (d.accion === "terminar_anomalia") {
    const a = (cal.anomalias ?? []).filter((x) => x.hasta >= hoy && !x.terminada).find((x) => (d.id ? x.id.toLowerCase() === d.id.toLowerCase() : true));
    if (!a) throw new Error(`No hay ninguna anomalía activa${d.id ? ` con id «${d.id}»` : ""}. Activas: ${(cal.anomalias ?? []).filter((x) => x.hasta >= hoy && !x.terminada).map((x) => x.id).join(", ") || "ninguna"}.`);
    a.extraDias = hoy >= a.fin ? hoy - a.fin : 0;
    a.hasta = hoy;
    a.terminada = true;
    return { texto: `Anomalía «${a.nombre}» terminada (la estación ${hoy > a.fin ? "vuelve a su curso desde mañana" : "sigue su curso normal"}).`, aviso: a.publica ? `🌤 ${a.nombre} termina: el tiempo vuelve a su curso.` : undefined };
  }
  // anomalia
  if (!d.nombre?.trim()) throw new Error("Falta el nombre de la anomalía (p. ej. «El Invierno Largo»).");
  if ((d.causa ?? "").trim().length < 20) throw new Error("La anomalía necesita una causa narrativa clara (mínimo 20 caracteres): qué hecho de la historia la provoca.");
  const tipo = d.tipo ?? "larga";
  if (!["larga", "intensa", "ambas"].includes(tipo)) throw new Error("tipo: larga, intensa o ambas.");
  const extra = tipo === "intensa" ? 0 : Math.round(d.extra_dias ?? 0);
  const inten = tipo === "larga" ? 0 : Math.round(d.intensidad ?? 1);
  if (extra < 0 || extra > MAX_EXTRA_DIAS) throw new Error(`extra_dias: de 0 a ${MAX_EXTRA_DIAS}.`);
  if (tipo !== "intensa" && extra < 1) throw new Error("Una anomalía «larga» o «ambas» necesita extra_dias de 1 a 60.");
  if (tipo !== "larga" && (inten < 1 || inten > MAX_INTENSIDAD)) throw new Error(`intensidad: de 1 a ${MAX_INTENSIDAD}.`);
  const region = d.region && sinTildes(d.region) === "todas" ? "todas" : d.region ? (buscarRegion(d.region)?.nombre ?? (() => { throw new Error(`Región desconocida «${d.region}»: usa el nombre de una región o «todas».`); })()) : reg;
  const clave = region === "todas" ? "todas" : region;
  const desde0 = Math.round(d.desde ?? hoy);
  if (desde0 < hoy) throw new Error(`La anomalía no puede empezar en el pasado (hoy es el día ${hoy}).`);
  const choca = (cal.anomalias ?? []).find((a) => a.hasta >= hoy && !a.terminada && (a.region === clave || a.region === "todas" || clave === "todas"));
  if (choca) throw new Error(`Ya hay una anomalía activa en esa región («${choca.nombre}», ${choca.id}): termínala antes (terminar_anomalia) o espera a que acabe.`);
  // Estación afectada y su último día (sin la prórroga de esta anomalía).
  const base = (d.estacion ? ESTACIONES.find((e) => sinTildes(e) === sinTildes(d.estacion!)) : undefined) ?? (d.estacion ? (() => { throw new Error(`estacion: ${ESTACIONES.join(", ")}.`); })() : ESTACIONES[fechaDe(cal, clave, desde0).estacion]);
  const idx = ESTACIONES.indexOf(base);
  let d0 = desde0;
  while (fechaDe(cal, clave, d0).estacion !== idx && d0 < desde0 + 400) d0++;
  let fin = d0;
  while (fechaDe(cal, clave, fin + 1).estacion === idx) fin++;
  const a: Anomalia = { id: `A${(cal.anomalias?.length ?? 0) + 1}`, nombre: d.nombre.trim().slice(0, 60), causa: d.causa!.trim().slice(0, 300), tipo, estacion: base, region, desde: d0, extraDias: extra, intensidad: inten, fin, hasta: fin + extra, publica: d.publica ?? true };
  (cal.anomalias ??= []).push(a);
  const empieza = a.desde <= hoy;
  return { texto: `Anomalía creada (${a.id}): ${estadoAnomalia(a, hoy)}`, aviso: a.publica && empieza ? mensajeInicio(a, region === "todas" ? reg : region) : undefined };
}

// ------------------------------------------------------------------ adaptación por raza y clase (confirmada por el dueño)
export type Nivel = "inmune" | "bien" | "mal";
export interface Adaptacion { frio?: Nivel; calor?: Nivel; humedad?: "bien" | "mal"; nota: string }
export const ADAPTACION_RAZA: Record<string, Adaptacion> = {
  "Enano de Karak-Dûm": { frio: "bien", calor: "mal", nota: "hijo de la piedra fría" },
  "Mediano de Hollín": { humedad: "bien", frio: "mal", nota: "criado en las ciénagas" },
  "Varg": { frio: "bien", calor: "mal", nota: "sangre de lobo" },
  "Nacido Pálido": { frio: "bien", calor: "mal", nota: "sangre fría" },
  "Tritón de las Mareas": { frio: "bien", humedad: "bien", calor: "mal", nota: "piel que pide agua" },
  "Cenizo": { calor: "inmune", frio: "mal", nota: "brasas bajo la piel" },
};
export const ADAPTACION_CLASE: Record<string, Adaptacion> = {
  "Berserker de Ceniza": { frio: "inmune", calor: "mal", nota: "la furia y el pelo gris" },
  "Cazador de Brujas": { humedad: "bien", frio: "bien", nota: "explorador nato" },
  "Caballero Juramentado": { calor: "mal", nota: "el hierro pesa al sol" },
  "Flagelante": { frio: "bien", nota: "el dolor lo curte" },
};
const RANGO: Record<string, number> = { inmune: 3, bien: 2, mal: 1 };
/** Mejor de las dos (raza y clase) para inmune/bien; «mal» solo si ninguna lo compensa. */
const combinar = (a?: string, b?: string): string | undefined => [a, b].filter(Boolean).sort((x, y) => RANGO[y!] - RANGO[x!])[0];
export interface AdaptacionPj { frio?: Nivel; calor?: Nivel; humedad?: "bien" | "mal"; fuentes: Record<string, string> }
export function adaptacionDe(p: Personaje): AdaptacionPj {
  const r = ADAPTACION_RAZA[p.raza], c = ADAPTACION_CLASE[p.clase];
  const fuentes: Record<string, string> = {};
  const eje = (k: "frio" | "calor" | "humedad") => {
    const v = combinar(r?.[k], c?.[k]);
    if (v) fuentes[k] = (c?.[k] === v ? p.clase : p.raza);
    return v as Nivel | undefined;
  };
  return { frio: eje("frio"), calor: eje("calor"), humedad: eje("humedad") as "bien" | "mal" | undefined, fuentes };
}
/** Aplica un nivel de adaptación al exceso de un factor (inmune: ninguno; bien: la mitad; mal: +25 %). */
export const aplicarNivel = (factor: number, nivel?: string): number => (!nivel || factor === 1 ? factor : r2(1 + (factor - 1) * (nivel === "inmune" ? 0 : nivel === "bien" ? 0.5 : 1.25)));
export const factorSedDe = (c: Condiciones, p: Personaje): number => aplicarNivel(c.factorSed, adaptacionDe(p).calor);
export const factorHambreDe = (c: Condiciones, p: Personaje): number => aplicarNivel(c.factorHambre, adaptacionDe(p).frio);

/** Freno de viaje del grupo: el peor adaptado de los presentes; con un Cazador de Brujas, la mitad del freno de todos. */
export function factorViajeGrupo(c: Condiciones, pjs: Personaje[]): { factor: number; notas: string[] } {
  if (c.factorViaje >= 1 || !pjs.length) return { factor: c.factorViaje, notas: [] };
  const eje = /nieve|ventisca/.test(c.clima) ? "frio" : "humedad";
  const exceso = 1 - c.factorViaje;
  let peor = pjs[0], fp = 2;
  for (const p of pjs) {
    const a = adaptacionDe(p)[eje as "frio"];
    const f = a === "inmune" || (eje === "humedad" && a === "bien") ? 1 : 1 - exceso * (a === "bien" ? 0.5 : a === "mal" ? 1.25 : 1);
    if (f < fp) { fp = f; peor = p; }
  }
  const notas: string[] = [];
  const ad = adaptacionDe(peor);
  if (ad[eje as "frio"] === "mal") notas.push(`${peor.nombre} sufre con ${c.etiqueta} (${ad.fuentes[eje]}) y frena al grupo`);
  else if (fp < 1) notas.push(`${peor.nombre} es el peor adaptado y marca el ritmo del grupo`);
  let factor = Math.max(0.3, fp);
  const cazador = pjs.find((p) => p.clase === "Cazador de Brujas");
  if (cazador && factor < 1) { factor = r2(1 - (1 - factor) * 0.5); notas.push(`${cazador.nombre} (Cazador de Brujas) reduce a la mitad el freno del clima`); }
  return { factor: r2(factor), notas };
}

/** Línea de la ficha del DM: adaptaciones al clima (solo con calendario y si hay alguna). */
export function lineaClimaFicha(p: Personaje, partida: Partida): string {
  if (!partida.calendario) return "";
  const a = adaptacionDe(p);
  const f = (k: "frio" | "calor" | "humedad", nombre: string) => (a[k] ? `${a[k] === "inmune" ? "inmune" : a[k]} ${a[k] === "inmune" ? `al ${nombre}` : k === "humedad" ? `con la humedad` : `con el ${nombre}`} (${a.fuentes[k]})` : "");
  const l = [f("frio", "frío"), f("calor", "calor"), f("humedad", "humedad"), p.raza === "Tritón de las Mareas" ? "sacia su sed y gana +1 con lluvia (+2 en tormenta)" : ""].filter(Boolean);
  return l.length ? `Clima: ${l.join(", ")}` : "";
}

// ------------------------------------------------------------------ lugar abierto y lluvia del Tritón
const INTERIOR = new Set(["posada", "fortaleza", "mazmorra", "cueva", "templo"]);
/** ¿El grupo está al aire libre? Si no hay dato del lugar, se asume exterior. */
export function alAireLibre(p: Partida): boolean {
  const id = p.mapa?.ruta ? undefined : p.mapa?.posicion;
  const l = id ? p.mapa.lugares?.[id] : undefined;
  return !l || !INTERIOR.has(l.tipo);
}
/** ¿Llueve (llovizna, lluvia o tormenta) ese día donde está el grupo y al aire libre? */
export function lluviaAbierta(p: Partida, dia: number): string | null {
  if (!p.calendario || !alAireLibre(p)) return null;
  const c = climaDe(p, regionActual(p), dia);
  return c && CLIMAS_AGUA.includes(c.clima) ? c.clima : null;
}
/** «Bendición de la lluvia»: el Tritón, al aire libre, +1 con llovizna o lluvia y +2 en tormenta (ataques, pruebas y salvaciones). Sin calendario: 0. */
export function bonoClima(p: Partida, pj: Personaje): { bono: number; texto: string } {
  if (pj.raza !== "Tritón de las Mareas") return { bono: 0, texto: "" };
  const c = lluviaAbierta(p, diaDePartida(p));
  if (!c) return { bono: 0, texto: "" };
  const bono = c === "tormenta" ? 2 : 1;
  return { bono, texto: `${c} +${bono}` };
}

// ------------------------------------------------------------------ reglas (consultar_reglas «clima»)
export function textoTablaRegiones(): string {
  return Object.entries(PERFILES).map(([r, v]) => `- ${r}: ${v.map((e, i) => `${ESTACIONES[i]} ${e.nombreLocal} (${e.temperatura})`).join(" · ")}`).join("\n");
}
export function textoTablaAdaptacion(): string {
  const f = (n: string, a: Adaptacion) => `- ${n}: ${[a.frio ? `frío ${a.frio}` : "", a.calor ? `calor ${a.calor}` : "", a.humedad ? `humedad ${a.humedad}` : ""].filter(Boolean).join(", ")} (${a.nota})`;
  return [...Object.entries(ADAPTACION_RAZA), ...Object.entries(ADAPTACION_CLASE)].map(([n, a]) => f(n, a)).join("\n");
}
export const REGLAS_CLIMA = `## Estaciones y clima (opcional por partida; los nombres y descripciones regionales son una PROPUESTA a confirmar)
- Año de 360 días y 4 estaciones de 90 (Primavera, Verano, Otoño, Invierno); cada región las llama a su manera. El estado trae «Estación y clima»: estación, día, clima de hoy (igual para todos y estable), temperatura y luz. Narra con eso (luz, frío, calor, ceniza) y no lo contradigas. clima {accion: ver} lo repite; clima {accion: pronostico} da los 3 próximos días solo con probabilidades vagas.
- Lo aplica el motor (no lo repitas): calor (cálida ×1,25 de sed, tórrida ×1,5; calima ×1,1) para quien no está a cubierto ni en el agua; frío (fría ×1,1 de hambre, helada ×1,25); nieve y aguanieve ×0,75 de km al viajar, ventisca y tormenta ×0,6; encuentros típicos de la estación ×2 y los de otra ×0,5. Fuera de amanecer-ocaso el estado dice «amanecer», «ocaso» o «noche cerrada». Karak-Dûm, bajo tierra, casi no varía.
- ADAPTACIÓN (raza y clase se combinan; «inmune» anula el extra, «bien» lo reduce a la mitad, «mal» +25 %): el grupo viaja al ritmo del peor adaptado y un Cazador de Brujas reduce a la mitad el freno de todos.
${textoTablaAdaptacion()}
- TRITONES Y LA LLUVIA: con llovizna, lluvia o tormenta y al aire libre el Tritón no acumula sed, no se le reseca la piel y gana +1 (+2 en tormenta) a ataques, pruebas y salvaciones («Bendición de la lluvia»); la niebla no cuenta.
- ANOMALÍAS: una estación puede alargarse (hasta 60 días) o volverse intensa (1-3) por un hecho de la historia: clima {accion: anomalia, nombre, causa (≥20 letras), tipo: larga|intensa|ambas, extra_dias, intensidad, region, estacion, desde, publica, cita}. Con turno en marcha exige cita literal de un jugador (o origen: "trama" con un arco abierto). Una por región y no en el pasado. Intensa: +25 % por nivel a los factores, clima más extremo, un escalón más de temperatura y encuentros de estación ×1,5 por nivel. clima {accion: terminar_anomalia, id} la cierra cuando la causa se resuelve. publica: false = rumor solo del DM. Se avisa a la mesa al empezar y al terminar.
- Tabla región × estación (nombre local y temperatura):
${textoTablaRegiones()}`;
