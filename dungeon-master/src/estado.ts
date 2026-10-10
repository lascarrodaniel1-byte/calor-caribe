// Estado persistente de la partida: historial de la conversación, fichas y notas del mundo.
import type Anthropic from "@anthropic-ai/sdk";
import type { EstadoJefe } from "./bestiario.js";
import type { EstadoBehelit } from "./behelit.js";
import { armaduraDe, textoArmadura } from "./armadura.js";
import { veteraniaDe, type EstadoCombate, type Veterania } from "./combate.js";
import type { Objeto } from "./equipo.js";
import { pvMaxEfectivo, resumenHerida, type Herida } from "./heridas.js";
import { magiaInicial, textoMagia, type MagiaPersonaje } from "./magia.js";
import { mapaVacio, type EstadoMapa } from "./mapa.js";
import { valor } from "./reglas.js";

export interface Personaje {
  nombre: string;
  jugador?: string;
  raza: string;
  clase: string;
  nivel: number;
  /** Años de oficio en combate; si falta, se deduce del nivel. */
  veterania?: Veterania;
  /** Rasgos de carácter que pesan en combate (arrogante, prudente…). */
  personalidad?: string[];
  /** Piezas de armadura puestas (ver PIEZAS en armadura.ts); si falta, se deduce del inventario. */
  armadura?: string[];
  pv: number;
  pv_max: number;
  ca: number;
  atributos: Record<"fue" | "des" | "con" | "int" | "sab" | "car", number>;
  inventario: string[];
  oro: number;
  condiciones: string[];
  notas: string;
  heridas: Herida[];
  /** Secuelas permanentes o de larga duración de heridas ya cerradas. */
  secuelas: string[];
  /** Marcas de Ceniza por recibir magia divina. */
  ceniza: number;
  /** Puntos de Fuerza perdidos por pérdida de sangre (falta de hierro). */
  anemia: number;
  /** Sangre perdida en el episodio de hemorragia actual: cuanto más alto, más fácil perder Fuerza. */
  sangrado: number;
  /** Progreso hacia recuperar 1 punto de anemia. */
  anemia_progreso: number;
  /** Puntos de atributo robados por criaturas (vuelven cuando muere el ladrón). */
  robado: Partial<Record<"fue" | "des" | "con" | "int" | "sab" | "car", number>>;
  /** Magia: maestría, escuelas, hechizos y tributos acumulados. */
  magia: MagiaPersonaje;
  /** Viales tomados en las últimas 24 h (se reinician con pasar_tiempo). */
  dosis: { curacion: number; sueno: number };
}

export interface Partida {
  creada: string;
  historial: Anthropic.Beta.BetaMessageParam[];
  personajes: Record<string, Personaje>;
  notas_mundo: string[];
  /** Registro de objetos generados (incluye la verdad oculta de los malditos). */
  objetos: Record<string, Objeto>;
  /** Jefes que han aparecido, con su estado. */
  jefes: Record<string, EstadoJefe>;
  behelit: EstadoBehelit;
  mapa: EstadoMapa;
  /** Combate en curso: orden de iniciativa y PNJ sin ficha. */
  combate?: EstadoCombate;
}

export function nuevaPartida(): Partida {
  return { creada: new Date().toISOString(), historial: [], personajes: {}, notas_mundo: [], objetos: {}, jefes: {}, behelit: { carmesi_creado: false, destinados: [] }, mapa: mapaVacio() };
}

/** Rellena los campos que faltan en fichas y partidas guardadas con versiones anteriores. */
export function normalizar(p: Personaje): Personaje {
  p.heridas ??= [];
  p.secuelas ??= [];
  p.ceniza ??= 0;
  p.anemia ??= 0;
  p.sangrado ??= 0;
  p.anemia_progreso ??= 0;
  p.dosis ??= { curacion: 0, sueno: 0 };
  p.robado ??= {};
  p.magia ??= magiaInicial(p.clase);
  p.magia.tramos_vejez ??= 0;
  return p;
}

/** Completa una partida guardada con versiones anteriores del programa. */
export function normalizarPartida(partida: Partida): Partida {
  partida.historial ??= [];
  partida.notas_mundo ??= [];
  partida.personajes ??= {};
  partida.objetos ??= {};
  partida.jefes ??= {};
  partida.behelit ??= { carmesi_creado: false, destinados: [] };
  partida.mapa ??= mapaVacio();
  partida.mapa.lugares ??= {};
  partida.mapa.rastro ??= [];
  for (const j of Object.values(partida.jefes)) {
    j.presagios ??= [];
    j.robos ??= [];
  }
  Object.values(partida.personajes).forEach(normalizar);
  // Heridas guardadas antes de existir las zonas vitales.
  for (const p of Object.values(partida.personajes)) {
    for (const h of p.heridas) {
      h.zona_vital ??= h.gravedad === "critica" ? "roja" : h.gravedad === "grave" ? "ambar" : "verde";
      h.estructura ??= "";
      h.fallos_viscerales ??= 0;
      h.agonia ??= false;
    }
  }
  return partida;
}

export function fichaTexto(p: Personaje): string {
  const mod = (v: number) => {
    const m = Math.floor((v - 10) / 2);
    return m >= 0 ? `+${m}` : `${m}`;
  };
  const maxEf = pvMaxEfectivo(p);
  return [
    `${p.nombre}${p.jugador ? ` (${p.jugador})` : ""} — ${p.raza} ${p.clase} nv. ${p.nivel}, ${veteraniaDe(p)}${p.veterania ? "" : " (por nivel)"}${p.personalidad?.length ? `, ${p.personalidad.join(" y ")}` : ""}`,
    `  PV ${p.pv}/${maxEf}${maxEf < p.pv_max ? ` (máx. ${p.pv_max} sin heridas)` : ""} · CA ${p.ca} · Oro ${p.oro}`,
    "  " +
      (["fue", "des", "con", "int", "sab", "car"] as const)
        .map((k) => {
          const v = valor(p, k);
          const marcas = [k === "fue" && p.anemia ? `anemia −${p.anemia}` : "", p.robado[k] ? `robado −${p.robado[k]}` : ""].filter(Boolean);
          return `${k.toUpperCase()} ${v}(${mod(v)})${marcas.length ? ` [${marcas.join(", ")}]` : ""}`;
        })
        .join(" "),
    `  Inventario: ${p.inventario.join(", ") || "—"}`,
    (() => {
      const a = armaduraDe(p);
      return `  Armadura: ${a.piezas.length ? textoArmadura(a.piezas) : "ninguna"}${a.deducida && a.piezas.length ? " (deducida del inventario)" : ""}`;
    })(),
    p.condiciones.length ? `  Condiciones: ${p.condiciones.join(", ")}` : "",
    p.heridas.length ? `  Heridas:\n${p.heridas.map((h) => `    ${resumenHerida(h)}`).join("\n")}` : "",
    p.secuelas.length ? `  Secuelas: ${p.secuelas.join("; ")}` : "",
    p.ceniza ? `  Ceniza: ${p.ceniza}` : "",
    textoMagia(p.magia),
    p.notas ? `  Notas: ${p.notas}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}
