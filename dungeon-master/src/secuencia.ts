// La secuencia de la mesa por turnos: el DM deja, al final de cada respuesta,
// una marca breve con lo que pasó en ese turno y la lista COMPLETA de asuntos
// pendientes. El programa la quita del texto que ven los jugadores, la guarda en
// orden y se la devuelve al DM en cada turno, para que no olvide nada (ni lo
// ocurrido turno a turno ni lo que quedó abierto). Si el DM no la escribe, el
// programa anota el turno él mismo.
import type { Partida } from "./estado.js";
import { textoReloj } from "./espacio.js";

export interface Paso {
  ronda: number;
  jugador: string;
  /** Lo que pidió el jugador, abreviado. */
  accion: string;
  /** Lo que pasó. */
  resultado: string;
  /** El DM no escribió la marca: el resultado es el comienzo de su narración. */
  auto?: boolean;
  /** Día y hora del mundo al acabar el turno. */
  hora?: string;
}

/** Dónde está y qué hace alguien ahora, de dónde viene y a dónde va. */
export interface Situacion {
  ahora: string;
  /** Lo que hacía o dónde estaba antes del último cambio. */
  antes?: string;
  rumbo?: string;
  /** En qué paso de la secuencia se actualizó por última vez. */
  paso: number;
}

export interface Secuencia {
  pasos: Paso[];
  /** Asuntos abiertos que hay que resolver (enemigos vivos, puertas abiertas, deudas, plazos…). */
  pendientes: string[];
  /** La escena en una frase: dónde, cuándo, quién está y qué ocurre. */
  escena?: string;
  /** Por personaje (o PNJ en escena): su situación actual. */
  situacion?: Record<string, Situacion>;
  /** Cuántos pasos se han registrado en total (los pasos antiguos se recortan). */
  total?: number;
}

export const MAX_PASOS = 30;
const MAX_PENDIENTES = 12;

export const secuenciaVacia = (): Secuencia => ({ pasos: [], pendientes: [], situacion: {}, total: 0 });

const MARCA = /<<\s*secuencia\b([\s\S]*?)>>\s*$/i;
const NADA = /^\s*(nada|ninguno|ninguna|-|—|no hay|sin pendientes)\.?\s*$/i;

export interface MarcaSecuencia {
  /** El texto sin la marca, listo para mostrar y guardar. */
  limpio: string;
  resultado?: string;
  /** Lista completa y actualizada de pendientes, si el DM la dio. */
  pendientes?: string[];
  /** La escena en una frase. */
  escena?: string;
  /** Una línea por personaje: «dónde está y qué hace → a dónde va». */
  personajes?: Record<string, string>;
}

const lista = (t: string) =>
  NADA.test(t)
    ? []
    : t
        .split(";")
        .map((x) => x.trim().slice(0, 160))
        .filter((x) => x && !NADA.test(x))
        .slice(0, MAX_PENDIENTES);

/** Separa la marca del final de la respuesta del DM. Admite el formato por líneas y el antiguo de una sola línea («a || b»). */
export function extraerMarca(texto: string): MarcaSecuencia {
  const m = MARCA.exec(texto);
  if (!m) return { limpio: ocultarMarcaParcial(texto).trimEnd() };
  const limpio = texto.slice(0, m.index).trimEnd();
  const cuerpo = m[1].replace(/^\s*:/, "").trim();
  const salida: MarcaSecuencia = { limpio };
  if (!cuerpo.includes("\n") && cuerpo.includes("||")) {
    const [res, pend] = cuerpo.split("||");
    salida.resultado = (res ?? "").trim().slice(0, 400) || undefined;
    if (pend !== undefined) salida.pendientes = lista(pend);
    return salida;
  }
  for (const linea of cuerpo.split("\n")) {
    const k = /^\s*([^:]{1,60}?)\s*:\s*(.+?)\s*$/.exec(linea);
    if (!k) continue;
    const clave = k[1].toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    const valor = k[2];
    if (clave === "resultado") salida.resultado = valor.slice(0, 400);
    else if (clave === "pendientes") salida.pendientes = lista(valor);
    else if (clave === "escena") salida.escena = valor.slice(0, 300);
    else (salida.personajes ??= {})[k[1].trim()] = valor.slice(0, 300);
  }
  return salida;
}

/** Mientras el texto llega a trozos, la marca a medio escribir no se enseña. */
export function ocultarMarcaParcial(texto: string): string {
  const i = texto.lastIndexOf("<<");
  if (i < 0) return texto;
  const resto = texto.slice(i).replace(/\s+/g, "").toLowerCase();
  const prefijo = "<<secuencia";
  return prefijo.startsWith(resto) || resto.startsWith(prefijo) ? texto.slice(0, i).trimEnd() : texto;
}

const resumir = (t: string, n: number) => {
  const plano = t.replace(/\*+/g, "").replace(/\s+/g, " ").trim();
  return plano.length > n ? plano.slice(0, n - 1).trimEnd() + "…" : plano;
};

export interface DatosPaso {
  ronda: number;
  jugador: string;
  accion: string;
  /** Narración limpia del DM (para el resultado si no escribió la marca). */
  narracion: string;
  marca: MarcaSecuencia;
}

/** Añade el paso de este turno a la secuencia y actualiza los pendientes. */
export function registrarPaso(partida: Partida, d: DatosPaso): Paso {
  partida.secuencia ??= secuenciaVacia();
  const s = partida.secuencia;
  const paso: Paso = {
    ronda: d.ronda,
    jugador: d.jugador,
    accion: resumir(d.accion, 160),
    resultado: d.marca.resultado ?? resumir(d.narracion, 260),
    ...(d.marca.resultado ? {} : { auto: true }),
    ...(partida.reloj ? { hora: textoReloj(partida.reloj) } : {}),
  };
  s.pasos.push(paso);
  if (s.pasos.length > MAX_PASOS) s.pasos.splice(0, s.pasos.length - MAX_PASOS);
  if (d.marca.pendientes) s.pendientes = d.marca.pendientes;
  s.total = (s.total ?? 0) + 1;
  if (d.marca.escena) s.escena = d.marca.escena;
  for (const [quien, texto] of Object.entries(d.marca.personajes ?? {})) {
    const nombre = resolverNombre(partida, quien);
    s.situacion ??= {};
    const [ahora, rumbo] = texto.split(/\s*(?:→|->|=>)\s*/);
    const previa = s.situacion[nombre];
    const nuevo = (ahora ?? "").trim().slice(0, 200);
    if (!nuevo) continue;
    s.situacion[nombre] = {
      ahora: nuevo,
      ...(previa && previa.ahora !== nuevo ? { antes: previa.ahora } : previa?.antes ? { antes: previa.antes } : {}),
      ...(rumbo?.trim() ? { rumbo: rumbo.trim().slice(0, 160) } : {}),
      paso: s.total,
    };
  }
  const nombres = Object.keys(s.situacion ?? {});
  if (nombres.length > 20) for (const k of nombres.slice(0, nombres.length - 20)) delete s.situacion![k];
  return paso;
}

const sinTildes = (t: string) => t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

/** El nombre canónico de quien nombra el DM: el del personaje (o su jugador) o el del PNJ; si no se conoce, el que dio. */
export function resolverNombre(partida: Partida, dado: string): string {
  const n = sinTildes(dado);
  for (const p of Object.values(partida.personajes)) if (sinTildes(p.nombre) === n || (p.jugador && sinTildes(p.jugador) === n)) return p.nombre;
  for (const k of Object.keys(partida.pnjs ?? {})) if (sinTildes(k) === n) return k;
  return dado.trim().slice(0, 60);
}

/** El tablero: lo primero que lee el DM. Quién es cada uno, qué acaba de hacer, dónde estaba, dónde está y a dónde va. */
export function tablero(partida: Partida): string {
  const s = partida.secuencia;
  const pjs = Object.values(partida.personajes);
  if (!pjs.length && !s?.escena) return "";
  const lugar = partida.mapa.posicion ? partida.mapa.lugares[partida.mapa.posicion]?.nombre : undefined;
  const lineas = pjs.map((p) => {
    const ultimo = [...(s?.pasos ?? [])].reverse().find((x) => x.jugador === p.jugador || x.jugador === p.nombre || x.jugador.split(", ").includes(p.jugador ?? "\0"));
    const sit = s?.situacion?.[p.nombre];
    const partes = [
      `${p.nombre}${p.jugador ? ` (lo juega ${p.jugador})` : ""}: ${p.raza} ${p.clase}${p.pv < p.pv_max / 2 ? ", malherido" : ""}${p.condiciones.length ? `, ${p.condiciones.join("/")}` : ""}`,
      ultimo ? `ACABA DE: ${ultimo.accion} → ${ultimo.resultado}` : "ACABA DE: nada aún",
      sit?.antes ? `ANTES: ${sit.antes}` : "",
      `AHORA: ${sit?.ahora ?? (lugar ? `en ${lugar} (sin más detalle)` : "sin ubicar")}${sit && (s?.total ?? 0) - sit.paso >= 2 ? ` (anotado hace ${(s?.total ?? 0) - sit.paso} turnos: puede haber cambiado, confírmalo)` : ""}`,
      sit?.rumbo ? `RUMBO: ${sit.rumbo}` : "",
    ].filter(Boolean);
    return `- ${partes.join(" · ")}`;
  });
  const otros = Object.entries(s?.situacion ?? {})
    .filter(([k]) => !pjs.some((p) => p.nombre === k))
    .map(([k, v]) => `- ${k} (PNJ): ${v.ahora}${v.rumbo ? ` · RUMBO: ${v.rumbo}` : ""}`);
  return [
    "## TABLERO (léelo primero: dónde está cada uno)",
    ...(partida.reloj ? [`AHORA: ${textoReloj(partida.reloj)}`] : ["HORA: sin fijar (fíjala con tiempo fijar)"]),
    `ESCENA: ${s?.escena ?? (lugar ? `el grupo está en ${lugar}` : "sin fijar: sitúala tú en tu próxima respuesta")}`,
    ...lineas,
    ...otros,
  ].join("\n");
}

/** Lo que se le enseña al DM: los turnos recientes en orden y los asuntos abiertos. */
export function textoSecuencia(s: Secuencia | undefined, rondaActual?: number): string {
  if (!s || (!s.pasos.length && !s.pendientes.length)) return "";
  const recientes = rondaActual === undefined ? s.pasos.slice(-12) : s.pasos.filter((p) => p.ronda >= rondaActual - 1).slice(-20);
  const lineas = recientes.map((p, i) => `${i + 1}. [ronda ${p.ronda}${p.hora ? ` · ${p.hora}` : ""}] ${p.jugador}: ${p.accion} → ${p.resultado}${p.auto ? " (anotado por el programa)" : ""}`);
  return [
    "## Secuencia de turnos (lo ocurrido, en orden; es canon)",
    lineas.join("\n") || "(aún sin turnos)",
    s.pendientes.length ? `Asuntos pendientes (resuélvelos cuando toque; no los olvides): ${s.pendientes.join(" · ")}` : "Asuntos pendientes: ninguno.",
  ].join("\n");
}

export const REGLAS_SECUENCIA = `## Secuencia y tablero (para no olvidar nada ni confundirte)
Al principio de lo que recibes tienes el TABLERO: para cada personaje, quién es y quién lo juega, qué ACABA DE hacer, dónde estaba ANTES, dónde está AHORA y su RUMBO, más la ESCENA en una frase. Léelo antes de narrar y úsalo para situarte: no mezcles personajes con jugadores, ni a un PNJ con otro, ni pongas a nadie donde no está.
Al FINAL de CADA respuesta, en líneas aparte y sin comentarlas, escribe la marca con este formato exacto (los jugadores no la ven):
<<secuencia
resultado: qué ha pasado en este turno, en una frase con nombres
pendientes: lista COMPLETA y actualizada de asuntos abiertos separados por «;» (o «nada»)
escena: la escena ahora, en una frase (dónde, cuándo, quién está, qué ocurre)
NombreDelPersonaje: dónde está y qué hace ahora → a dónde se dirige
OtroPersonaje: dónde está y qué hace ahora → a dónde se dirige
>>
- Pon una línea por cada personaje que haya cambiado de sitio, de actividad o de rumbo (y por los PNJ importantes en escena). Usa el nombre exacto del tablero.
- Los pendientes son lo que ha quedado abierto: enemigos vivos o en camino, una puerta abierta, una herida que sangra, un plazo, una promesa, una deuda. Escribe la lista entera cada vez: quita lo resuelto y añade lo nuevo.
- Antes de escribirla repasa el tablero y la secuencia: no contradigas lo ocurrido. Con el cierre de ronda, resuelve los pendientes que correspondan antes de dar la palabra.
- Si los jugadores te corrigen, tienen razón: acepta la corrección sin discutir y rehaz el turno con ella.`;
