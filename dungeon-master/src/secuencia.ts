// La secuencia de la mesa por turnos: el DM deja, al final de cada respuesta,
// una marca breve con lo que pasó en ese turno y la lista COMPLETA de asuntos
// pendientes. El programa la quita del texto que ven los jugadores, la guarda en
// orden y se la devuelve al DM en cada turno, para que no olvide nada (ni lo
// ocurrido turno a turno ni lo que quedó abierto). Si el DM no la escribe, el
// programa anota el turno él mismo.
import type { Partida } from "./estado.js";

export interface Paso {
  ronda: number;
  jugador: string;
  /** Lo que pidió el jugador, abreviado. */
  accion: string;
  /** Lo que pasó. */
  resultado: string;
  /** El DM no escribió la marca: el resultado es el comienzo de su narración. */
  auto?: boolean;
}

export interface Secuencia {
  pasos: Paso[];
  /** Asuntos abiertos que hay que resolver (enemigos vivos, puertas abiertas, deudas, plazos…). */
  pendientes: string[];
}

export const MAX_PASOS = 30;
const MAX_PENDIENTES = 12;

export const secuenciaVacia = (): Secuencia => ({ pasos: [], pendientes: [] });

const MARCA = /<<\s*secuencia\s*:([\s\S]*?)>>\s*$/i;
const NADA = /^\s*(nada|ninguno|ninguna|-|—|no hay|sin pendientes)\.?\s*$/i;

export interface MarcaSecuencia {
  /** El texto sin la marca, listo para mostrar y guardar. */
  limpio: string;
  resultado?: string;
  /** Lista completa y actualizada de pendientes, si el DM la dio. */
  pendientes?: string[];
}

/** Separa la marca del final de la respuesta del DM. */
export function extraerMarca(texto: string): MarcaSecuencia {
  const m = MARCA.exec(texto);
  if (!m) return { limpio: ocultarMarcaParcial(texto).trimEnd() };
  const limpio = texto.slice(0, m.index).trimEnd();
  const [res, pend] = m[1].split("||");
  const resultado = (res ?? "").trim().slice(0, 400) || undefined;
  const pendientes =
    pend === undefined
      ? undefined
      : NADA.test(pend)
        ? []
        : pend
            .split(";")
            .map((x) => x.trim().slice(0, 160))
            .filter((x) => x && !NADA.test(x))
            .slice(0, MAX_PENDIENTES);
  return { limpio, resultado, pendientes };
}

/** Mientras el texto llega a trozos, la marca a medio escribir no se enseña. */
export function ocultarMarcaParcial(texto: string): string {
  const i = texto.lastIndexOf("<<");
  if (i < 0) return texto;
  const resto = texto.slice(i).replace(/\s+/g, "").toLowerCase();
  const prefijo = "<<secuencia:";
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
  };
  s.pasos.push(paso);
  if (s.pasos.length > MAX_PASOS) s.pasos.splice(0, s.pasos.length - MAX_PASOS);
  if (d.marca.pendientes) s.pendientes = d.marca.pendientes;
  return paso;
}

/** Lo que se le enseña al DM: los turnos recientes en orden y los asuntos abiertos. */
export function textoSecuencia(s: Secuencia | undefined, rondaActual?: number): string {
  if (!s || (!s.pasos.length && !s.pendientes.length)) return "";
  const recientes = rondaActual === undefined ? s.pasos.slice(-12) : s.pasos.filter((p) => p.ronda >= rondaActual - 1).slice(-20);
  const lineas = recientes.map((p, i) => `${i + 1}. [ronda ${p.ronda}] ${p.jugador}: ${p.accion} → ${p.resultado}${p.auto ? " (anotado por el programa)" : ""}`);
  return [
    "## Secuencia de turnos (lo ocurrido, en orden; es canon)",
    lineas.join("\n") || "(aún sin turnos)",
    s.pendientes.length ? `Asuntos pendientes (resuélvelos cuando toque; no los olvides): ${s.pendientes.join(" · ")}` : "Asuntos pendientes: ninguno.",
  ].join("\n");
}

export const REGLAS_SECUENCIA = `## Secuencia (para no olvidar nada)
Al FINAL de CADA respuesta, en una línea aparte y sin comentarla, escribe la secuencia del turno con este formato exacto:
<<secuencia: qué ha pasado en este turno, en una frase con nombres (quién hizo qué y con qué resultado) || lista COMPLETA y actualizada de asuntos pendientes, separados por «;»>>
- Los pendientes son lo que ha quedado abierto y debe resolverse: enemigos vivos o en camino, una puerta abierta, una herida que sangra, un plazo, una promesa o una deuda. Escribe la lista entera cada vez (quita lo ya resuelto, añade lo nuevo); si no hay ninguno, escribe «nada».
- Los jugadores no ven esta marca. Antes de escribirla repasa la sección «Secuencia de turnos» que recibes: no contradigas nada de lo ocurrido y no dejes un pendiente sin resolver más tiempo del necesario.
- Con el cierre de ronda, resuelve los pendientes que correspondan (los enemigos actúan, el tiempo pasa) antes de dar la palabra.`;
