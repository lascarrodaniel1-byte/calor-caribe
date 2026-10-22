// Estado persistente de la partida: historial de la conversación, fichas y notas del mundo.
import type { Leyenda } from "./leyenda.js";
import { textoLeyenda } from "./leyenda.js";
import type { Runas, RegistroMagia } from "./cazador_base.js";
import { textoCazador } from "./cazador_base.js";
import { textoDegollador, type Dardos } from "./degollador_base.js";
import { textoFlagelante } from "./flagelante_base.js";
import { textoSegador, type AlmaSellada, type Sello } from "./segador_base.js";
import { textoBarbero } from "./barbero_base.js";
import { textoManos } from "./manos.js";
import type { Juramento } from "./juramento_base.js";
import { textoJuramento } from "./juramento_base.js";
import { textoRecursos } from "./recursos.js";
import { textoProgresion } from "./progresion.js";
import { textoMuerte } from "./muerte.js";
import { textoEfectos } from "./condiciones.js";
import type Anthropic from "@anthropic-ai/sdk";
import type { EstadoRegentes } from "./regentes.js";
import type { EstadoJefe } from "./bestiario.js";
import type { EstadoBehelit } from "./behelit.js";
import { armaduraDe, textoArmadura } from "./armadura.js";
import { veteraniaDe, type EstadoCombate, type Veterania } from "./combate.js";
import type { Objeto } from "./equipo.js";
import { pvMaxEfectivo, resumenHerida, type Herida } from "./heridas.js";
import { magiaInicial, textoMagia, type MagiaPersonaje } from "./magia.js";
import { mapaVacio, migrarMapa, type EstadoMapa } from "./mapa.js";
import { normalizarTrama, tramaVacia, type Pnj, type Trama } from "./narrativa.js";
import type { Plano, Reloj } from "./espacio.js";
import type { RegistroEncuentro } from "./encuentros.js";
import { secuenciaVacia, type Secuencia } from "./secuencia.js";
import { valor } from "./reglas.js";

export interface Personaje {
  nombre: string;
  jugador?: string;
  /** Don arcano de nacimiento: físico o mágico (el mágico es magia.don). */
  don?: "fisico" | "magico";
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
  /** Salvaciones contra muerte mientras está a 0 PV (ver muerte.ts). */
  /** Puntos de experiencia (si falta, los del umbral de su nivel). */
  px?: number;
  /** Usos gastados de rasgos con usos limitados (ver recursos.ts). */
  gastados?: Record<string, number>;
  /** Hazañas, fama y, si la hay, la Leyenda (ver leyenda.ts). */
  leyenda?: Leyenda;
  /** Furia del Berserker (ver furia.ts). */
  furia?: { activa: boolean; asaltos: number; marcados?: string[] };
  /** Marcas de Ceniza que no se pueden quitar (las de la furia). */
  ceniza_fija?: number;
  /** Juramento del Caballero Juramentado (ver juramento_base.ts). */
  juramento?: Juramento;
  /** Papeles de runas del Cazador de Brujas (ver cazador.ts). */
  papeles?: { hojas: number; estacas: number };
  mascota?: { tipo: "halcon" | "raton"; nombre: string };
  /** Degollador: a quién estudió (su primer ataque contra él lleva ventaja) y los dardos de su cerbatana. */
  presa?: { objetivo: string; usada: boolean };
  /** Segador: su Deuda con Neter, las almas que lleva selladas y sus invocaciones. */
  deuda?: number;
  almas?: AlmaSellada[];
  invocaciones?: string[];
  pielHueso?: boolean;
  /** Almas selladas por un Segador: habilidades que no puede usar. */
  sellos?: Sello[];
  /** Barbero-Cirujano: anestesia mágica en este paciente (bono al próximo tratamiento: 2, o 4 si es profunda) y usos que le quedan del kit de sanador. */
  anestesia?: number;
  kit_usos?: number;
  dardos?: Dardos;
  /** Rivales cuya sangre tiene guardada (para marcarlos a distancia con un papel). */
  muestras?: string[];
  /** Qué empuña en cada mano (ver manos.ts) y su estilo de lucha. */
  manos?: { principal?: string; secundaria?: string; dosManos?: boolean };
  estilo?: string;
  /** Mariscal de la Compañía del Cuervo Negro (si ganó el concurso). */
  mariscal?: "Hugin" | "Munin";
  /** Rasgos de clase ganados al subir de nivel. */
  rasgos?: string[];
  muerte?: { exitos: number; fallos: number; estable: boolean; desventaja?: boolean };
}

export interface Partida {
  creada: string;
  /** Don arcano que el DM tiró para cada jugador antes de crear su personaje (d20: 19 físico, 20 mágico); no se repite. `don` = tiene el mágico. */
  dones?: Record<string, { don: boolean; tipo?: "fisico" | "magico" | "ninguno"; tirada?: number; texto: string }>;
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
  /** PNJ con nombre: voz, deseos, actitud y lo que ya han dicho. */
  pnjs?: Record<string, Pnj>;
  /** Hilo de la trama: objetivo, pistas, hilos abiertos y amenaza. */
  trama?: Trama;
  /** Secuencia de turnos y asuntos pendientes (la escribe el DM al final de cada respuesta). */
  secuencia?: Secuencia;
  /** Plano de la escena actual: dónde está cada uno, en metros (norte arriba). */
  plano?: Plano;
  /** Día y hora del mundo. */
  reloj?: Reloj;
  /** Últimos encuentros (para no repetir enemigos). */
  encuentros?: RegistroEncuentro[];
  /** Runas dispuestas por un Cazador de Brujas en la escena. */
  runas?: Runas;
  /** Hechizos y maldiciones recientes (los rastrea el Cazador de Brujas). */
  hechizos?: RegistroMagia[];
  /** Política de los regentes: influencia, espías, relaciones y jugadas. */
  regentes?: EstadoRegentes;
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
  partida.pnjs ??= {};
  partida.trama = normalizarTrama(partida.trama ?? tramaVacia());
  partida.secuencia ??= secuenciaVacia();
  partida.mapa.lugares ??= {};
  partida.mapa.rastro ??= [];
  migrarMapa(partida.mapa);
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

/** Ficha abreviada: lo que el DM necesita de un jugador que no actúa en este turno (la completa, con consultar_reglas ficha). */
export function fichaCorta(p: Personaje): string {
  const maxEf = pvMaxEfectivo(p);
  const heridas = p.heridas.map((h) => `${h.id} ${h.gravedad} ${h.ubicacion}${h.sangrando ? " sangrando" : ""}${h.podre ? " con Podre" : ""}`).join("; ");
  return (
    `${p.nombre}${p.jugador ? ` (${p.jugador})` : ""} — ${p.raza} ${p.clase} nv. ${p.nivel} · PV ${p.pv}/${maxEf} · CA ${p.ca}` +
    (p.condiciones.length ? ` · ${p.condiciones.join(", ")}` : "") +
    (p.anemia ? ` · anemia −${p.anemia}` : "") +
    (heridas ? ` · Heridas: ${heridas}` : "") +
    (p.secuelas.length ? ` · ${p.secuelas.length} secuela(s)` : "")
  );
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
    p.don === "fisico" ? "  Don arcano FÍSICO: competencia +1 y FUE, DES y CON hasta 24" : p.don === "magico" ? "  Don arcano MÁGICO" : "",
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
    textoMuerte(p) ? `  ${textoMuerte(p)}` : "",
    textoProgresion(p),
    textoRecursos(p),
    textoLeyenda(p),
    textoManos(p),
    textoJuramento(p),
    textoCazador(p),
    textoDegollador(p),
    textoFlagelante(p),
    textoSegador(p),
    textoBarbero(p),
    p.furia?.activa ? `  🔥 EN FURIA (pelo cenizo, ${p.furia.asaltos} asalto(s)) · INT y CAR a la mitad, +2 al modificador de FUE${p.nivel < 3 ? " · EN TRANCE: no distingue aliados de enemigos" : ""}${p.nivel >= 5 ? " · heridas rojas cerradas mientras dure" : ""}` : "",
    p.condiciones.length ? `  Condiciones: ${p.condiciones.join(", ")}${textoEfectos(p.condiciones) ? ` → ${textoEfectos(p.condiciones)}` : ""}` : "",
    p.heridas.length ? `  Heridas:\n${p.heridas.map((h) => `    ${resumenHerida(h)}`).join("\n")}` : "",
    p.secuelas.length ? `  Secuelas: ${p.secuelas.join("; ")}` : "",
    p.ceniza ? `  Ceniza: ${p.ceniza}` : "",
    textoMagia(p.magia),
    p.notas ? `  Notas: ${p.notas}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}
