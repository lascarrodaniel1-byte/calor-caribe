// Registro de los estados por tipo de daño (sin dependencias del motor, para que lo usen recursos.ts, acciones.ts y combate.ts sin ciclos de importación).
// La lógica (salvación, aplicación, paso de asaltos) está en estados.ts.
import type { TipoDano } from "./danos.js";
import type { Partida } from "./estado.js";

/** Un estado en curso (para que acabe a su hora y deje un asalto de inmunidad). Vive en `partida.estadosDano`. */
export interface EstadoDano {
  nombre: string;
  /** Id de la condición del catálogo («quemado», «paralizado»…). */
  id: string;
  /** El texto con el que está en la lista de condiciones del objetivo. */
  texto: string;
  tipo: TipoDano;
  /** Último asalto en que vale (en combate); sin `hasta` ni `seg`, dura hasta el descanso o hasta quitarlo. */
  hasta?: number;
  /** Segundos de RELOJ que le quedan (fuera de combate: «breve» = 1 asalto = 6 s, N asaltos = 6·N s). Los resta `caducarEstadosFuera` cuando el reloj avanza. */
  seg?: number;
  /** true: sobrevive al fin del combate y a la purga al iniciar uno (solo lo quita el reloj, un descanso o un limpiaestados): p. ej. la Hiel de Víbora Gris. */
  persiste?: boolean;
  /** Tras acabar, inmune a este estado hasta este asalto (inclusive). */
  inmuneHasta?: number;
}

/** Quita los estados por daño que ya no tienen sentido: `soloPJ` = al acabar un combate (salvo corroído, que dura hasta el descanso); `nombres` = un descanso (todos, también corroído). */
export function limpiarEstados(partida: Partida, o: { descanso?: string[] }): void {
  const reg = partida.estadosDano;
  if (!reg?.length) return;
  const quitar = (e: EstadoDano) => {
    const lista = (() => { const p = partida.personajes[e.nombre] ?? Object.values(partida.personajes).find((x) => x.nombre === e.nombre); return p?.condiciones; })();
    if (lista) { const resto = lista.filter((x) => x !== e.texto); lista.splice(0, lista.length, ...resto); }
  };
  partida.estadosDano = reg.filter((e) => {
    const sale = o.descanso ? o.descanso.some((n) => n.toLowerCase() === e.nombre.toLowerCase()) : e.id !== "corroido" && !e.persiste;
    if (sale) quitar(e);
    return !sale;
  });
  if (!partida.estadosDano.length) delete partida.estadosDano;
}

/** Quien se quita una condición a mano (o la apaga) deja de tenerla en el registro, sin inmunidad. */
export function olvidarEstado(partida: Partida, nombre: string, id: string): void {
  if (!partida.estadosDano) return;
  partida.estadosDano = partida.estadosDano.filter((e) => !(e.nombre.toLowerCase() === nombre.toLowerCase() && e.id === id));
  if (!partida.estadosDano.length) delete partida.estadosDano;
}


/** Segundos de reloj de una duración en asaltos (6 s por asalto). */
export const segDeAsaltos = (asaltos: number): number => Math.max(1, Math.round(asaltos)) * 6;

/** Registra (o renueva) un estado con su plazo: en combate por asaltos (`hasta`), fuera de combate por reloj (`seg`). `seg` explícito (Hiel…) manda siempre por reloj. Sin duración, dura hasta quitarlo. */
export function registrarEstado(partida: Partida, e: { nombre: string; id: string; texto: string; tipo: TipoDano; asaltos?: number; seg?: number; persiste?: boolean }): EstadoDano {
  const reg = (partida.estadosDano ??= []);
  const i = reg.findIndex((x) => x.nombre === e.nombre && x.id === e.id);
  if (i >= 0) reg.splice(i, 1);
  const r = partida.combate?.ronda;
  const porReloj = e.seg !== undefined || (!partida.combate && e.asaltos !== undefined);
  const nuevo: EstadoDano = {
    nombre: e.nombre, id: e.id, texto: e.texto, tipo: e.tipo,
    ...(porReloj ? { seg: e.seg ?? segDeAsaltos(e.asaltos!) } : e.asaltos !== undefined && r !== undefined ? { hasta: r + e.asaltos - 1 } : {}),
    ...(e.persiste ? { persiste: true } : {}),
  };
  reg.push(nuevo);
  return nuevo;
}
