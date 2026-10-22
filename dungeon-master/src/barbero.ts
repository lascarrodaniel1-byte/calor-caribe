// Barbero-Cirujano: cirujano de campo independiente. Anatomía (golpear nervios), diagnóstico, amputación, kit de sanador
// y Mano firme con usos reales.
import type { Partida, Personaje } from "./estado.js";
import { aplicarCondicion, localizar, type DatosAtaque, type ResultadoAtaque } from "./combate.js";
import { describir, tirar } from "./dados.js";
import { esBarberoC, KIT_USOS } from "./barbero_base.js";
import { infligirSecuela, REGLAS, resumenHerida } from "./heridas.js";
import { resolverPrueba } from "./pruebas.js";
import { competencia, mod, salvacion, signo, valor } from "./reglas.js";
import { RECURSOS_CLASE, usarRecurso } from "./recursos.js";

const norm = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
const SIN_NERVIOS = /no-muerto|no muerto|ghul|espectro|vampiro|esqueleto|aut[oó]mata|constructo|hambriento|elemental|planta|vegetal/i;

function barbero(partida: Partida, quien: string): Personaje {
  const p = Object.values(partida.personajes).find((x) => norm(x.nombre) === norm(quien) || (x.jugador && norm(x.jugador) === norm(quien)));
  if (!p) throw new Error(`No hay ningún personaje llamado «${quien}».`);
  if (!esBarberoC(p)) throw new Error(`${p.nombre} no es un Barbero-Cirujano.`);
  return p;
}
const paciente = (partida: Partida, n: string): Personaje => {
  const p = Object.values(partida.personajes).find((x) => norm(x.nombre) === norm(n) || (x.jugador && norm(x.jugador) === norm(n)));
  if (!p) throw new Error(`No hay ningún personaje llamado «${n}».`);
  return p;
};

RECURSOS_CLASE["Barbero-Cirujano"] = [
  {
    nombre: "Mano firme",
    desde: 1,
    max: (p) => (p.nivel >= 5 ? 2 : 1),
    recarga: "largo",
    efecto: (p) => `${p.nombre} respira hondo y su pulso no tiembla: repite la tirada de tratamiento fallida.`,
  },
];

/** Gasta un uso de Mano firme (para tratar_herida). Devuelve un mensaje si ya no le quedan. */
export function gastarManoFirme(partida: Partida, p: Personaje): string | null {
  try { usarRecurso(partida, { quien: p.nombre, recurso: "Mano firme" }); return null; } catch (e) { return `${(e as Error).message} No puede repetir la tirada.`; }
}

// ------------------------------------------------------------------ kit de sanador

export function usosKit(p: Personaje): number { return p.kit_usos ?? KIT_USOS; }

/** Un tratamiento con el kit gasta un uso (solo se cuenta al Barbero-Cirujano). */
export function gastarKit(p: Personaje): string | null {
  if (!esBarberoC(p)) return null;
  const n = usosKit(p);
  if (n <= 0) return "El kit de sanador se ha quedado sin usos: repónlo antes de tratar con él.";
  p.kit_usos = n - 1;
  return null;
}

export function kitSanador(partida: Partida, d: { quien: string; accion: "ver" | "reponer"; usos?: number }): string {
  const p = barbero(partida, d.quien);
  if (d.accion === "ver") return `${p.nombre}: kit de sanador ${usosKit(p)}/${KIT_USOS} usos.`;
  const n = Math.max(1, d.usos ?? KIT_USOS);
  p.kit_usos = Math.min(KIT_USOS, usosKit(p) + n);
  return `${p.nombre} repone su kit de sanador: ${p.kit_usos}/${KIT_USOS} usos.`;
}

// ------------------------------------------------------------------ anatomía: nervios

/** Tras un golpe a un nervio: si hirió, el objetivo hace una salvación de CON o queda incapacitado en parte. */
export function golpeNervio(partida: Partida, e: DatosAtaque, r: ResultadoAtaque): string {
  if (!e.nervio) return "";
  const p = Object.values(partida.personajes).find((x) => norm(x.nombre) === norm(e.atacante));
  if (!p || !esBarberoC(p)) return "";
  if ((r.resultado !== "impacto" && r.resultado !== "critico") || !((r.dano ?? 0) > 0)) return `🩺 El golpe al nervio no encuentra su sitio${r.resultado === "impacto" || r.resultado === "critico" ? " (la armadura lo frena)" : ""}.`;
  const c = localizar(partida, e.objetivo);
  const naturaleza = c.tipo === "criatura" ? `${c.j.definicion.temple ?? ""} ${c.j.definicion.nombre} ${c.j.definicion.descripcion}` : c.tipo === "pnj" ? c.n.temple ?? "" : c.p.condiciones.join(" ");
  if (SIN_NERVIOS.test(naturaleza)) return `🩺 ${c.nombre} no tiene nervios que golpear.`;
  const cd = 8 + competencia(p) + Math.max(mod(valor(p, "sab")), mod(valor(p, "des"))) + (r.resultado === "critico" ? 2 : 0);
  let resiste: boolean;
  let linea: string;
  if (c.tipo === "pj") {
    const s = salvacion(c.p, "con", cd);
    resiste = s.exito; linea = `${c.nombre}: ${s.texto}.`;
  } else {
    const con = c.tipo === "criatura" ? Number(/CON\s*(\d+)/i.exec(c.j.definicion.atributos)?.[1] ?? 10) : 10;
    const t = tirar(`1d20${signo(mod(con))}`);
    resiste = t.total >= cd; linea = `${c.nombre}: salvación de CON ${describir(t)} vs CD ${cd} → ${resiste ? "éxito" : "fallo"}.`;
  }
  if (resiste) return `🩺 Golpe al nervio (${e.nervio}): ${linea} Aguanta el entumecimiento.`;
  const cond = e.nervio === "brazo" ? "brazo entumecido (1 minuto)" : e.nervio === "pierna" ? "pierna entumecida (1 minuto)" : "paralizado (1 asalto)";
  const efecto = aplicarCondicion(partida, { objetivo: c.nombre, accion: "aplicar", condicion: cond }).split("\n")[0];
  return `🩺 Golpe al nervio (${e.nervio}): ${linea} ¡LO INCAPACITA! ${efecto}`;
}

// ------------------------------------------------------------------ diagnóstico

export function diagnosticar(partida: Partida, d: { quien: string; paciente: string; herida?: string }): string {
  const b = barbero(partida, d.quien);
  const p = paciente(partida, d.paciente);
  const hs = d.herida ? p.heridas.filter((x) => x.id.toLowerCase() === d.herida!.toLowerCase()) : p.heridas;
  if (!hs.length) throw new Error(`${p.nombre} no tiene ${d.herida ? `la herida ${d.herida}` : "heridas que examinar"}.`);
  const lineas = hs.map((h) => {
    const reg = REGLAS[h.gravedad];
    return `${resumenHerida(h)}\n   Diagnóstico de ${b.nombre}: tratarla CD ${reg.cdTratar}${h.podre ? " (+4, hay Podre)" : ""}${h.estado === "infectada" ? " (+2, infectada)" : ""}; riesgo de infección CD ${reg.cdInfeccion}; convalecencia ${reg.dias} días; ${h.zona_vital === "roja" ? "ZONA ROJA: cuenta atrás" : h.zona_vital === "ambar" ? "zona ámbar" : "zona verde"}${h.estructura ? `; estructura: ${h.estructura}` : ""}.`;
  });
  return `${b.nombre} examina a ${p.nombre}:\n${lineas.join("\n")}`;
}

// ------------------------------------------------------------------ amputación

export function amputar(partida: Partida, d: { quien: string; paciente: string; herida: string; anestesia?: boolean }): string {
  const b = barbero(partida, d.quien);
  const p = paciente(partida, d.paciente);
  const h = p.heridas.find((x) => x.id.toLowerCase() === d.herida.toLowerCase());
  if (!h) throw new Error(`${p.nombre} no tiene la herida ${d.herida}.`);
  if (!/brazo|pierna/.test(h.ubicacion)) throw new Error(`Solo se amputa un brazo o una pierna: la herida ${h.id} está en ${h.ubicacion}.`);
  if (h.gravedad === "leve") throw new Error(`La herida ${h.id} es leve: no hay que cortar nada.`);
  if (!b.inventario.some((x) => /sierra de huesos|herramientas de cirujano/i.test(x))) throw new Error(`${b.nombre} necesita su sierra de huesos o sus herramientas de cirujano.`);
  const anest = d.anestesia || (p.anestesia ?? 0) > 0;
  const cd = 15 + (anest ? 0 : 3);
  const r = resolverPrueba(partida, { quien: b.nombre, habilidad: "medicina", cd, motivo: `amputar ${h.ubicacion} de ${p.nombre}${anest ? " (con anestesia)" : ""}`, bono: 2 + (b.nivel >= 2 ? 1 : 0) });
  p.anestesia = undefined;
  const lineas = [r.texto];
  if (!r.exito) {
    const dano = tirar("2d6").total;
    p.pv = Math.max(0, p.pv - dano);
    lineas.push(`La sierra se encalla: ${p.nombre} pierde ${dano} PV (PV ${p.pv}). Puede reintentarse.`);
    return lineas.join("\n");
  }
  const choque = tirar("2d6").total;
  p.pv = Math.max(0, p.pv - choque);
  p.heridas = p.heridas.filter((x) => x !== h);
  infligirSecuela(p, `miembro amputado (${h.ubicacion})`);
  lineas.push(`${b.nombre} corta ${h.ubicacion} de ${p.nombre}${h.podre ? " y la Podre se queda en el miembro cortado" : ""}: la herida desaparece. Choque: ${choque} PV (PV ${p.pv}). Le queda una secuela permanente.`);
  return lineas.join("\n");
}
