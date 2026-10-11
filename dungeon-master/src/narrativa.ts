// Herramientas de narración: los PNJ con voz propia (y lo que ya han dicho, para
// no repetirse) y el hilo de la trama (objetivo, pistas, como mucho tres hilos
// abiertos y una amenaza que avanza), para que la historia avance en vez de dar
// vueltas sobre el mismo punto.
import type { Partida } from "./estado.js";

export interface Pnj {
  nombre: string;
  rol: string;
  /** Cómo habla: registro, muletillas, ritmo, acento, lo que nunca diría. */
  voz: string;
  quiere: string;
  actitud: string;
  /** Cómo está ahora: vivo, herido, muerto, capturado… */
  estado?: string;
  en_escena: boolean;
  /** Lo que ya ha revelado, prometido o dicho de importante (lo más reciente al final). */
  dicho: string[];
}

export interface Trama {
  objetivo: string;
  pistas: string[];
  hilos: string[];
  amenaza: string;
  /** 0-6: al llegar a 6, la amenaza golpea. */
  reloj: number;
  /** Cuántas veces ha avanzado la trama (lo usa la página para saber si un turno avanzó). */
  avances: number;
  /** Turnos seguidos sin avanzar (lo lleva la página). */
  sin_avance: number;
}

export const MAX_HILOS = 3;
const MAX_PNJS = 40;
const MAX_DICHO = 8;

export const tramaVacia = (): Trama => ({ objetivo: "", pistas: [], hilos: [], amenaza: "", reloj: 0, avances: 0, sin_avance: 0 });

const igual = (a: string, b: string) => a.toLowerCase().trim() === b.toLowerCase().trim();

export interface DatosPnj {
  nombre: string;
  rol?: string;
  voz?: string;
  quiere?: string;
  actitud?: string;
  estado?: string;
  en_escena?: boolean;
  dijo?: string;
}

export function registrarPnj(partida: Partida, d: DatosPnj): string {
  partida.pnjs ??= {};
  const clave = Object.keys(partida.pnjs).find((k) => igual(k, d.nombre)) ?? d.nombre;
  const previo = partida.pnjs[clave];
  if (!previo && !d.voz) throw new Error(`${d.nombre} es nuevo: dale una voz (cómo habla) para que no suene como los demás.`);
  const p: Pnj = previo ?? { nombre: d.nombre, rol: "", voz: "", quiere: "", actitud: "", en_escena: true, dicho: [] };
  if (d.rol !== undefined) p.rol = d.rol;
  if (d.voz !== undefined) p.voz = d.voz;
  if (d.quiere !== undefined) p.quiere = d.quiere;
  if (d.actitud !== undefined) p.actitud = d.actitud;
  if (d.estado !== undefined) p.estado = d.estado;
  if (d.en_escena !== undefined) p.en_escena = d.en_escena;
  if (d.dijo && !p.dicho.some((x) => igual(x, d.dijo!.slice(0, 200)))) {
    p.dicho.push(d.dijo.slice(0, 200));
    if (p.dicho.length > MAX_DICHO) p.dicho.splice(0, p.dicho.length - MAX_DICHO);
  }
  partida.pnjs[clave] = p;
  // Si hay demasiados, se olvida a los que llevan más tiempo fuera de escena.
  const claves = Object.keys(partida.pnjs);
  if (claves.length > MAX_PNJS) {
    const fuera = claves.filter((k) => !partida.pnjs![k].en_escena);
    for (const k of fuera.slice(0, claves.length - MAX_PNJS)) delete partida.pnjs[k];
  }
  return `${previo ? "PNJ actualizado" : "PNJ nuevo"}: ${textoPnj(p)}`;
}

export function textoPnj(p: Pnj, corto = false): string {
  if (corto) return `${p.nombre} (${p.rol}${p.estado ? `, ${p.estado}` : ""}${p.actitud ? `, ${p.actitud}` : ""})`;
  return (
    `${p.nombre} — ${p.rol || "?"}. Estado: ${p.estado || "vivo"}. Voz: ${p.voz || "?"}. Quiere: ${p.quiere || "?"}. Actitud: ${p.actitud || "?"}.` +
    (p.dicho.length ? ` Ya ha dicho: ${p.dicho.map((x) => `«${x}»`).join(" ")}` : "")
  );
}

export interface DatosTrama {
  objetivo?: string;
  revelar_pista?: string;
  retirar_pista?: string;
  abrir_hilo?: string;
  cerrar_hilo?: string;
  resolucion?: string;
  amenaza?: string;
  avanzar_amenaza?: number;
}

export function actualizarTrama(partida: Partida, d: DatosTrama): string {
  partida.trama ??= tramaVacia();
  const t = partida.trama;
  const log: string[] = [];
  let avanza = false;
  if (d.cerrar_hilo) {
    const i = t.hilos.findIndex((h) => igual(h, d.cerrar_hilo!) || h.toLowerCase().includes(d.cerrar_hilo!.toLowerCase()));
    if (i < 0) throw new Error(`No hay ningún hilo abierto llamado "${d.cerrar_hilo}". Abiertos: ${t.hilos.join(" | ") || "ninguno"}`);
    const [h] = t.hilos.splice(i, 1);
    log.push(`Hilo cerrado: ${h}${d.resolucion ? ` → ${d.resolucion}` : ""}`);
    if (d.resolucion) t.pistas.push(`${h}: ${d.resolucion}`);
    avanza = true;
  }
  if (d.abrir_hilo) {
    if (t.hilos.length >= MAX_HILOS)
      throw new Error(`Ya hay ${MAX_HILOS} hilos abiertos (${t.hilos.join(" | ")}). Cierra o resuelve uno antes de abrir otro: la trama debe avanzar, no enredarse.`);
    t.hilos.push(d.abrir_hilo);
    log.push(`Hilo abierto: ${d.abrir_hilo}`);
  }
  if (d.retirar_pista) {
    const buscado = d.retirar_pista.toLowerCase().trim();
    const coinciden = t.pistas.map((x, k) => [x, k] as const).filter(([x]) => x.toLowerCase().includes(buscado));
    if (!coinciden.length) throw new Error(`No hay ninguna pista que contenga "${d.retirar_pista}". Pistas: ${t.pistas.join(" | ") || "ninguna"}`);
    if (coinciden.length > 1) throw new Error(`"${d.retirar_pista}" aparece en varias pistas: ${coinciden.map(([x]) => `«${x}»`).join(" | ")}. Usa un trozo más específico.`);
    log.push(`Pista retirada: ${t.pistas.splice(coinciden[0][1], 1)[0]}`);
    avanza = true;
  }
  if (d.revelar_pista) {
    t.pistas.push(d.revelar_pista);
    if (t.pistas.length > 20) t.pistas.splice(0, t.pistas.length - 20);
    log.push(`Pista revelada: ${d.revelar_pista}`);
    avanza = true;
  }
  if (d.objetivo !== undefined && !igual(d.objetivo, t.objetivo)) {
    t.objetivo = d.objetivo;
    log.push(`Objetivo: ${d.objetivo}`);
    avanza = true;
  }
  if (d.amenaza !== undefined) {
    t.amenaza = d.amenaza;
    t.reloj = 0;
    log.push(`Amenaza: ${d.amenaza}`);
  }
  if (d.avanzar_amenaza) {
    t.reloj = Math.max(0, Math.min(6, t.reloj + d.avanzar_amenaza));
    log.push(`La amenaza avanza: ${t.reloj}/6${t.reloj >= 6 ? " — ¡GOLPEA! Hazlo ocurrir ahora, en la ficción." : ""}`);
    avanza = true;
  }
  if (avanza) {
    t.avances += 1;
    t.sin_avance = 0;
  }
  if (!log.length) throw new Error("No hay nada que actualizar en la trama.");
  return log.join("\n");
}

export function textoTrama(t: Trama): string {
  return [
    `Objetivo del grupo: ${t.objetivo || "(sin fijar)"}`,
    `Hilos abiertos (${t.hilos.length}/${MAX_HILOS}): ${t.hilos.join(" | ") || "ninguno"}`,
    t.pistas.length ? `Ya revelado (no lo contradigas ni lo vuelvas a esconder): ${t.pistas.slice(-10).join(" | ")}` : "",
    t.amenaza ? `Amenaza: ${t.amenaza} — reloj ${t.reloj}/6` : "",
    t.sin_avance >= 3 ? `⚠ Llevas ${t.sin_avance} turnos sin que la trama avance: en este turno revela una pista, cierra un hilo o haz avanzar la amenaza.` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export const REGLAS_NARRATIVA = `## Voces y trama (que no se repita ni dé vueltas)
- Cada PNJ con nombre tiene su propia voz: regístralo con pnj (rol, voz —léxico, muletillas, ritmo, lo que nunca diría—, quiere, actitud). Habla siempre con esa voz y desde lo que quiere.
- Nunca repitas una frase ya dicha. Si los jugadores preguntan lo mismo otra vez, el PNJ reacciona a la insistencia (se impacienta, sospecha, cede algo más) y dice algo distinto. Cuando un PNJ revele, prometa o mienta en algo importante, apúntalo en dijo.
- Interacciones distintas, respuestas distintas: el soborno, la amenaza, la adulación y la pregunta directa no producen el mismo diálogo; la actitud del PNJ cambia según cómo lo traten (actualiza actitud).
- La trama avanza en cada escena: al acabar un turno algo debe haber cambiado (una pista nueva, una puerta que se abre o se cierra, un precio, una consecuencia, un enemigo que mueve ficha). Regístralo con trama.
- Como mucho ${MAX_HILOS} hilos abiertos a la vez: no abras un misterio nuevo sin cerrar otro. No inventes giros que deshagan lo ya revelado ni escondas otra vez lo que ya se supo. Las respuestas que se ganan con una buena tirada o una buena idea se dan claras, no con más enigmas.
- Mantén la verdad al día, sobre todo cuando juegan varios: cada acción puede cambiar cosas distintas. Antes de narrar, registra TODO lo que cambió: la ficha (modificar_personaje), la ubicación, el estado y la actitud del PNJ (pnj: estado, actitud, en_escena), la trama (trama) y las notas.
- Un hecho que sustituye a otro no se apunta aparte: corrige la nota vieja con anotar_mundo (nota + reemplaza) o bórrala (olvidar) para que no queden dos versiones. Una pista que resultó falsa se retira con trama.retirar_pista.
- Al recapitular o resumir, parte del ESTADO ACTUAL (trama, PNJ, notas, fichas, situación) y no de los turnos antiguos. Si dos fuentes se contradicen, vale la más reciente. Lo que cambió se cuenta como cambio («antes…, ahora…»), nunca como si siguiera igual. Si dudas de algo, no lo afirmes: cuéntalo como lo último que sabíais.
- Si los jugadores están atascados o dan vueltas, no añadas complicaciones: dales una salida clara (un PNJ que habla, una pista evidente, la amenaza que les obliga a moverse). Cada vez que pierden tiempo, avanza el reloj de la amenaza (avanzar_amenaza); a 6, golpea.`;
