// Turnos de la mesa: cada jugador habla cuando le toca, de uno en uno y en orden,
// para que el DM reciba una sola acción cada vez y la secuencia sea siempre clara
// (acción → respuesta del DM → siguiente jugador). Aquí vive solo la lógica; la
// página guarda a los jugadores en `jugadores/<id>` y el turno en `mesa/orden`.

export interface Jugador {
  id: string;
  nombre: string;
  /** Cuándo se sentó a la mesa: fija su puesto en el orden. */
  entrada: number;
  /** Última vez que su página dio señales de vida (0 si se fue). */
  visto: number;
}

export interface Orden {
  modo: "turnos" | "libre";
  /** Id del jugador al que le toca. */
  turno: string;
  ronda: number;
  /** Desde cuándo le toca. */
  desde: number;
}

/** Una página en segundo plano late poco: se da bastante margen antes de dar a alguien por ausente. */
export const ACTIVO_MS = 150_000;
/** Cuánto hay que esperar a quien tiene el turno (y sigue conectado) antes de poder saltarlo. */
export const ESPERA_SALTO_MS = 120_000;

export const ordenInicial = (): Orden => ({ modo: "turnos", turno: "", ronda: 1, desde: 0 });

export const activo = (j: Jugador, ahora: number) => ahora - (j.visto || 0) < ACTIVO_MS;

/** Los jugadores sentados a la mesa, en el orden en que llegaron. */
export function ordenar(js: Jugador[]): Jugador[] {
  return js.filter((j) => j.nombre).sort((a, b) => (a.entrada || 0) - (b.entrada || 0) || a.id.localeCompare(b.id));
}

/** Los que participan en la ronda: los conectados (y quien tiene el turno, aunque se haya ido). */
export function enRonda(js: Jugador[], o: Orden, ahora: number): Jugador[] {
  return ordenar(js).filter((j) => activo(j, ahora) || j.id === o.turno);
}

/** ¿Se juega por turnos? Con un solo jugador no hay nada que ordenar. */
export function porTurnos(js: Jugador[], o: Orden, ahora: number): boolean {
  return o.modo !== "libre" && enRonda(js, o, ahora).length > 1;
}

/** A quién le toca ahora: el guardado, o el primero conectado si aún no hay turno (o se fue de la lista). */
export function quienToca(js: Jugador[], o: Orden, ahora: number): Jugador | null {
  const l = ordenar(js);
  if (!l.length) return null;
  return l.find((j) => j.id === o.turno) ?? l.find((j) => activo(j, ahora)) ?? l[0];
}

export interface Siguiente {
  jugador: Jugador;
  /** Con este paso se completa la ronda y empieza otra. */
  nuevaRonda: boolean;
}

/** A quién pasa la palabra: el siguiente conectado en el orden; al dar la vuelta, empieza otra ronda. */
export function siguiente(js: Jugador[], actualId: string, ahora: number): Siguiente | null {
  const l = ordenar(js).filter((j) => activo(j, ahora) || j.id === actualId);
  if (!l.length) return null;
  const i = l.findIndex((j) => j.id === actualId);
  if (i < 0) return { jugador: l[0], nuevaRonda: false };
  const n = (i + 1) % l.length;
  return { jugador: l[n], nuevaRonda: n <= i };
}

/** ¿Puede este jugador saltar el turno del que le toca? Si éste se fue, enseguida; si sigue ahí, tras esperar. */
export function puedeSaltar(js: Jugador[], o: Orden, yoId: string, ahora: number): boolean {
  const t = quienToca(js, o, ahora);
  if (!t || t.id === yoId) return false;
  return !activo(t, ahora) || (o.desde > 0 && ahora - o.desde >= ESPERA_SALTO_MS);
}

export interface InfoTurno {
  actuante: string;
  /** Nombres en el orden de la ronda. */
  orden: string[];
  ronda: number;
  /** Quien recibe la palabra después. */
  siguiente: string;
  /** El actuante es el último de la ronda. */
  cierraRonda: boolean;
}

/** Lo que se le dice al DM de la secuencia, para que narre una acción cada vez y dé la palabra bien. */
export function bloqueTurnos(t: InfoTurno): string {
  return [
    "# TURNOS (la mesa juega por turnos: una acción cada vez, en orden)",
    `Orden de la ronda ${t.ronda}: ${t.orden.join(" → ")}.`,
    `Acaba de actuar: ${t.actuante}. Narra SOLO su acción y su consecuencia inmediata (tiradas, heridas, lo que dicen los PNJ). No hables, decidas ni muevas a los demás jugadores, y no avances el tiempo más allá de lo que dura su acción.`,
    t.cierraRonda
      ? `${t.actuante} es el último de la ronda: tras narrar su acción, cierra la ronda: el mundo responde (los enemigos y los PNJ actúan, pasa el tiempo, la amenaza avanza) y la trama avanza un paso. Luego da la palabra a ${t.siguiente}, que abre la ronda siguiente.`
      : `Termina dándole la palabra a ${t.siguiente} por su nombre («¿Qué hace ${t.siguiente}?»), y deja abierta la situación para que le toque actuar.`,
  ].join("\n");
}

/** Mensaje al jugador que intenta hablar fuera de su turno. */
export function textoFueraDeTurno(quien: string): string {
  return `No es tu turno: le toca a ${quien}. Ve preparando tu acción en la caja de texto; podrás enviarla en cuanto te llegue la palabra.`;
}
