// Tragar de verdad (Bakunawa): quien falla la salvación de la habilidad Tragar queda «tragado (por X)» —cegado, retenido y con
// cobertura total— y sufre daño eléctrico al empezar su turno. Sale por una de tres vías: lo escupe (daño suficiente desde dentro o
// presión de los aliados de fuera), se abre paso (maniobra escapar: Atletismo o Acrobacias) o la criatura cae o se sumerge.
// Todo se deriva de la condición del personaje («tragado (por Bakunawa)»): no hay otro estado que sincronizar.
import { agregarCondicion, reconocer, tragadoPor } from "./condiciones.js";
import { describir, tirar } from "./dados.js";
import type { EstadoJefe, Traga } from "./bestiario.js";
import type { Partida, Personaje } from "./estado.js";
import { danoEnSuelo } from "./muerte.js";
import { aplicarDanoAPersonaje } from "./rasgos.js";
import { notaDano } from "./danos.js";
import { mod, signo } from "./reglas.js";

const igual = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/** Los personajes vivos que tiene dentro esta criatura. */
export function dentroDe(partida: Partida, nombre: string): Personaje[] {
  return Object.values(partida.personajes).filter((p) => !p.condiciones.includes("muerto") && igual(tragadoPor(p.condiciones) ?? "", nombre));
}

/** Resumen de las vías de escape, para el DM (sale al tragar a alguien). */
export function escapesTexto(c: Traga): string {
  return `ESCAPES: (1) desde dentro, ${c.umbral_dentro}+ de daño a la criatura en un turno suyo (arma cortante o perforante, o conjuro) → la criatura salva CON CD ${c.cd_vomito} o lo vomita; (2) como acción, maniobra escapar (Atletismo o Acrobacias CD ${c.cd_escape}); (3) los aliados de fuera solo ayudan dañándola: ${c.umbral_asalto}+ de daño en un asalto (de fuera y de dentro) → la misma salvación; (4) si la criatura muere o se sumerge, lo escupe. Quien sale cae derribado a 3 m.`;
}

/** Antes de tirar nada: ¿puede esta criatura tragar a este objetivo ahora? (lanza un Error con el motivo). */
export function validarTragar(partida: Partida, j: EstadoJefe, objetivos: Personaje[]): void {
  const c = j.definicion.traga;
  if (!c) return;
  if (objetivos.length !== 1) throw new Error(`Tragar es contra UN solo objetivo (la criatura tiene un límite de ${c.max} tragado(s) a la vez).`);
  const p = objetivos[0];
  if (tragadoPor(p.condiciones)) throw new Error(`${p.nombre} ya está tragado (por ${tragadoPor(p.condiciones)}).`);
  const dentro = dentroDe(partida, j.nombre);
  if (dentro.length >= c.max) throw new Error(`${j.nombre} ya tiene dentro a ${dentro.map((x) => x.nombre).join(", ")} (máximo ${c.max} a la vez): no puede tragar a otro hasta que lo escupa.`);
  if (!p.condiciones.some((x) => reconocer(x)?.id === "agarrado")) throw new Error(`${p.nombre} no está agarrado: Tragar solo vale contra una criatura Grande o menor que ya tenga agarrada (Mordisco devastador o maniobra agarrar).`);
}

/** El objetivo falló la salvación de Tragar: queda dentro. */
export function tragarA(partida: Partida, j: EstadoJefe, p: Personaje, log: string[]): void {
  const c = j.definicion.traga;
  if (!c) return;
  const resto = p.condiciones.filter((x) => reconocer(x)?.id !== "agarrado");
  p.condiciones.splice(0, p.condiciones.length, ...resto);
  agregarCondicion(p.condiciones, `tragado (por ${j.nombre})`);
  log.push(`  🫧 ${p.nombre} es TRAGADO por ${j.nombre}: cegado y retenido dentro, con cobertura total (nadie de fuera lo alcanza). Sufre ${c.dano} de daño ${c.tipo_dano} al empezar cada turno suyo. ${escapesTexto(c)}`);
}

/** Al abrirse cada asalto: el daño de quien está dentro (su turno empieza con él). Devuelve las líneas (🎲⚡). */
export function danoDeTragados(partida: Partida): string[] {
  const out: string[] = [];
  for (const j of Object.values(partida.jefes)) {
    const c = j.definicion.traga;
    if (!c || j.pv <= 0) continue;
    for (const p of dentroDe(partida, j.nombre)) {
      const t = tirar(c.dano);
      const res = aplicarDanoAPersonaje(p, t.total, c.tipo_dano), nota = notaDano(res.detalle);
      const suelo = p.pv <= 0;
      p.pv = Math.max(0, p.pv - res.final);
      out.push(`🎲⚡ ${p.nombre}, tragado por ${j.nombre}, sufre ${describir(t)} de daño ${c.tipo_dano} al empezar su turno${nota}: PV ${p.pv}/${p.pv_max}.`);
      if (suelo && res.final > 0) { const s = danoEnSuelo(p, Math.min(res.final, Math.max(1, p.pv_max - 1)), false); if (s) out.push(`  ${s}`); } // sin muerte instantánea
      else if (p.pv === 0) out.push(`  ¡${p.nombre} cae a 0 PV dentro! Sigue tragado: sus aliados deben presionar a ${j.nombre} (${c.umbral_asalto}+ de daño en un asalto) o él seguirá sufriéndolo.`);
    }
  }
  return out;
}

/** Saca a uno de dentro: ya no está tragado, cae derribado y, si hay plano, a 3 m de la criatura. */
function salir(partida: Partida, quien: string, p: Personaje): string {
  const resto = p.condiciones.filter((x) => !tragadoPor([x]));
  p.condiciones.splice(0, p.condiciones.length, ...resto);
  agregarCondicion(p.condiciones, "derribado");
  let plano = "";
  const pts = partida.plano?.puntos ?? {};
  const kp = Object.keys(pts).find((k) => igual(k, p.nombre)), kq = Object.keys(pts).find((k) => igual(k, quien));
  if (kp && kq) { // en el plano: a 3 m de ella, en la dirección en que estaba (o al sur)
    const dx = pts[kp].x - pts[kq].x, dy = pts[kp].y - pts[kq].y, d = Math.hypot(dx, dy);
    const [ux, uy] = d < 0.01 ? [0, 1] : [dx / d, dy / d];
    pts[kp].x = Math.round((pts[kq].x + ux * 3) * 10) / 10; pts[kp].y = Math.round((pts[kq].y + uy * 3) * 10) / 10;
    plano = " (en el plano, a 3 m de ella)";
  }
  return `${p.nombre} sale de ${quien}: cae derribado a 3 m de ella.${plano}`;
}

/** La criatura escupe a todos los que tiene dentro. */
export function escupir(partida: Partida, j: EstadoJefe, motivo: string): string[] {
  return dentroDe(partida, j.nombre).map((p) => `🫧 ${motivo}: ${salir(partida, j.nombre, p)}`);
}

/** Caída de la criatura o fin del combate: quienes estaban dentro salen (sin más). Devuelve las líneas. */
export function liberarTragados(partida: Partida, nombre: string): string[] {
  return dentroDe(partida, nombre).map((p) => `🫧 ${salir(partida, nombre, p)}`);
}

const modCon = (atributos: string): number => mod(Number(/CON\s+(\d+)/i.exec(atributos)?.[1] ?? 10));

/**
 * La criatura acaba de recibir `cantidad` de daño (ya restado de sus PV). Si lleva a alguien dentro: la retirada táctica (primera vez que
 * cae a la mitad de sus PV) lo escupe; y el daño de fuera y de dentro cuenta como presión: 25+ desde dentro en un turno, o 50+ en total en un asalto,
 * obligan una sola vez por asalto a una salvación de CON (sin Resistencia legendaria); si falla, lo vomita. `por` = quién causa el daño.
 */
export function presionDeDano(partida: Partida, j: EstadoJefe, cantidad: number, por?: string): string[] {
  const c = j.definicion.traga;
  if (!c || cantidad <= 0) return [];
  const dentro = dentroDe(partida, j.nombre);
  if (!dentro.length) return [];
  if (j.pv <= 0) return escupir(partida, j, `${j.nombre} cae muerta`);
  const pvAntes = Math.min(j.pv_max, j.pv + cantidad);
  if (pvAntes > j.pv_max / 2 && j.pv <= j.pv_max / 2) return escupir(partida, j, `${j.nombre} cae a la mitad de sus PV y se sumerge para huir (retirada táctica): escupe a los tragados antes`);
  const ronda = partida.combate?.ronda ?? 0;
  if (!j.trago || j.trago.ronda !== ronda) j.trago = { ronda, fuera: 0, dentro: 0, probado: false };
  const e = j.trago;
  if (por && dentro.some((p) => igual(p.nombre, por))) e.dentro += cantidad; else e.fuera += cantidad;
  if (e.probado) return [];
  const desdeDentro = e.dentro >= c.umbral_dentro;
  if (!desdeDentro && e.fuera + e.dentro < c.umbral_asalto) return [];
  e.probado = true;
  const t = tirar(`1d20${signo(modCon(j.definicion.atributos))}`);
  const motivo = desdeDentro ? `${por} le ha causado ${e.dentro} de daño desde dentro en su turno (umbral ${c.umbral_dentro})` : `${j.nombre} ha recibido ${e.fuera + e.dentro} de daño este asalto (umbral ${c.umbral_asalto})`;
  const cab = `🎲 ${motivo}: salvación de CON de ${j.nombre} ${describir(t)} contra CD ${c.cd_vomito}`;
  if (t.total >= c.cd_vomito) return [`${cab} → aguanta y no los suelta (no puede usar Resistencia legendaria).`];
  return [`${cab} → FALLA: los vomita.`, ...escupir(partida, j, `${j.nombre} los vomita`)];
}

/** Abrirse paso por la garganta (maniobra escapar de quien está tragado): prueba de Atletismo o Acrobacias contra la CD de la criatura. */
export function abrirsePaso(partida: Partida, p: Personaje, bono: number, hab: string, modo: "normal" | "ventaja" | "desventaja" = "normal"): string {
  const quien = tragadoPor(p.condiciones)!;
  const j = Object.values(partida.jefes).find((x) => igual(x.nombre, quien));
  const cd = j?.definicion.traga?.cd_escape ?? 20;
  const t = tirar(`1d20${signo(bono)}`, modo);
  const cab = `${p.nombre} se abre paso por la garganta de ${quien} (${hab} ${describir(t)} contra CD ${cd}${modo !== "normal" ? `, ${modo}` : ""})`;
  if (t.total < cd) return `${cab} → no lo consigue: sigue dentro (gasta su acción).`;
  return `${cab} → ¡SALE! ${salir(partida, quien, p)}`;
}
