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
  /** Lo lleva a cabo cuando los protagonistas no lo ven: qué hace y hacia dónde va. Nadie se queda parado. */
  agenda?: string;
  /** Arco de la historia en el que incide. */
  arco?: string;
  /** Turnos seguidos fuera de escena sin moverse (lo lleva la página). */
  fuera_turnos?: number;
  /** Lo que ya ha revelado, prometido o dicho de importante (lo más reciente al final). */
  dicho: string[];
}

export type FaseArco = "inicio" | "nudo" | "desenlace";

/** Un arco: una historia con principio, nudo y final. */
export interface Arco {
  nombre: string;
  /** El principio: de qué va, quién interviene y qué se juega. */
  premisa: string;
  fase: FaseArco;
  /** El nudo: la complicación o el giro que lo tensa. */
  nudo?: string;
  /** Hacia dónde apunta el final (puede cambiar). */
  final_previsto?: string;
  /** Qué ha pasado en el último paso de fase. */
  hito?: string;
  pnjs: string[];
  /** Turnos desde que se abrió. */
  turnos: number;
  /** Turnos en la fase actual. */
  turnos_fase: number;
}

export interface ArcoCerrado {
  nombre: string;
  desenlace: string;
}

export interface Trama {
  objetivo: string;
  pistas: string[];
  /** Nombres de los arcos abiertos (los detalles están en `arcos`). */
  hilos: string[];
  arcos?: Arco[];
  /** Arcos ya resueltos, del más antiguo al más reciente: no se reabren. */
  cerrados?: ArcoCerrado[];
  amenaza: string;
  /** 0-6: al llegar a 6, la amenaza golpea. */
  reloj: number;
  /** Cuántas veces ha avanzado la trama (lo usa la página para saber si un turno avanzó). */
  avances: number;
  /** Turnos seguidos sin avanzar (lo lleva la página). */
  sin_avance: number;
}

export const MAX_ARCOS = 3;
export const MAX_HILOS = MAX_ARCOS;
/** Cuántos turnos como mucho en cada fase antes de que el programa avise al DM de que empuje. */
export const RITMO = { inicio: 3, nudo: 7, desenlace: 3 } as const;
/** Turnos fuera de escena tras los que un PNJ con nombre tiene que mover ficha (y que su eco llegue a los protagonistas). */
export const FUERA_ECO = 3;
const MAX_CERRADOS = 8;
const MUERTO = /muert|abatid|cad[aá]ver|ejecutad|destruid/i;
const MAX_PNJS = 40;
const MAX_DICHO = 8;

export const tramaVacia = (): Trama => ({ objetivo: "", pistas: [], hilos: [], arcos: [], cerrados: [], amenaza: "", reloj: 0, avances: 0, sin_avance: 0 });

/** Partidas anteriores: cada hilo suelto se convierte en un arco (en su nudo) y `hilos` pasa a ser la lista de sus nombres. */
export function normalizarTrama(t: Trama): Trama {
  t.arcos ??= [];
  t.cerrados ??= [];
  for (const h of t.hilos ?? []) {
    if (!t.arcos.some((a) => a.nombre === h)) t.arcos.push({ nombre: h, premisa: h, fase: "nudo", pnjs: [], turnos: 0, turnos_fase: 0 });
  }
  t.hilos = t.arcos.map((a) => a.nombre);
  return t;
}

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
  agenda?: string;
  arco?: string;
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
  if (d.agenda !== undefined) p.agenda = d.agenda;
  if (d.arco !== undefined) {
    p.arco = d.arco;
    const a = partida.trama?.arcos?.find((x) => igual(x.nombre, d.arco!));
    if (a && !a.pnjs.some((n) => igual(n, p.nombre))) a.pnjs.push(p.nombre);
  }
  // Mover ficha (agenda, estado, volver a escena) cuenta como haber actuado: se reinicia su cuenta de turnos parado.
  if (d.agenda !== undefined || d.estado !== undefined || d.en_escena === true) p.fuera_turnos = 0;
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
    (p.agenda ? ` Agenda: ${p.agenda}.` : "") +
    (p.arco ? ` Arco: ${p.arco}.` : "") +
    (p.dicho.length ? ` Ya ha dicho: ${p.dicho.map((x) => `«${x}»`).join(" ")}` : "")
  );
}

export interface DatosTrama {
  objetivo?: string;
  revelar_pista?: string;
  retirar_pista?: string;
  /** Alias antiguo de abrir_arco (el texto es la premisa). */
  abrir_hilo?: string;
  /** Alias antiguo de cerrar_arco. */
  cerrar_hilo?: string;
  resolucion?: string;
  abrir_arco?: string;
  premisa?: string;
  final_previsto?: string;
  avanzar_arco?: string;
  fase?: "nudo" | "desenlace";
  hito?: string;
  cerrar_arco?: string;
  desenlace?: string;
  amenaza?: string;
  avanzar_amenaza?: number;
}

function buscarArco(t: Trama, nombre: string): Arco {
  const n = nombre.toLowerCase().trim();
  const arcos = t.arcos ?? [];
  const a = arcos.find((x) => igual(x.nombre, nombre)) ?? arcos.find((x) => x.nombre.toLowerCase().includes(n) || n.includes(x.nombre.toLowerCase()));
  if (!a) throw new Error(`No hay ningún arco abierto llamado "${nombre}". Abiertos: ${arcos.map((x) => x.nombre).join(" | ") || "ninguno"}`);
  return a;
}

export function actualizarTrama(partida: Partida, d: DatosTrama): string {
  partida.trama ??= tramaVacia();
  const t = normalizarTrama(partida.trama);
  const log: string[] = [];
  let avanza = false;
  const cerrar = d.cerrar_arco ?? d.cerrar_hilo;
  if (cerrar) {
    const a = buscarArco(t, cerrar);
    const fin = d.desenlace ?? d.resolucion;
    if (!fin) throw new Error(`Un arco no se cierra sin desenlace: di cómo acaba «${a.nombre}» (qué se consiguió, qué costó, qué cambia).`);
    t.arcos = t.arcos!.filter((x) => x !== a);
    t.cerrados = [...(t.cerrados ?? []), { nombre: a.nombre, desenlace: fin }].slice(-MAX_CERRADOS);
    t.pistas.push(`${a.nombre}: ${fin}`);
    log.push(`Arco cerrado: ${a.nombre} → ${fin}`);
    // Los PNJ que incidían en él no se quedan parados: pasan a otra historia o a su propia agenda.
    const huerfanos = a.pnjs.filter((n) => Object.values(partida.pnjs ?? {}).some((p) => igual(p.nombre, n) && !MUERTO.test(p.estado ?? "")));
    if (huerfanos.length) log.push(`Con este final, ${huerfanos.join(", ")} ya no ${huerfanos.length > 1 ? "tienen" : "tiene"} su asunto: dales una nueva agenda o un nuevo arco (pnj).`);
    avanza = true;
  }
  const abrir = d.abrir_arco ?? d.abrir_hilo;
  if (abrir) {
    if ((t.arcos ?? []).length >= MAX_ARCOS)
      throw new Error(`Ya hay ${MAX_ARCOS} arcos abiertos (${t.arcos!.map((a) => a.nombre).join(" | ")}). Lleva uno al desenlace (cerrar_arco) antes de abrir otro: la historia debe avanzar hasta su final, no acumular asuntos.`);
    if (t.arcos!.some((a) => igual(a.nombre, abrir))) throw new Error(`Ya existe un arco llamado "${abrir}".`);
    const premisa = d.premisa ?? (d.abrir_hilo ? abrir : "");
    if (!premisa) throw new Error("Un arco empieza con su premisa: de qué va, quién interviene y qué se juega (premisa).");
    t.arcos!.push({ nombre: abrir, premisa, fase: "inicio", final_previsto: d.final_previsto, pnjs: [], turnos: 0, turnos_fase: 0 });
    log.push(`Arco abierto (inicio): ${abrir} — ${premisa}`);
  }
  if (d.avanzar_arco) {
    const a = buscarArco(t, d.avanzar_arco);
    if (!d.fase) throw new Error("Falta la fase a la que pasa el arco: nudo o desenlace.");
    if (!d.hito) throw new Error(`Cuenta qué pasó para que «${a.nombre}» pase a ${d.fase} (hito): la complicación, el giro o la decisión.`);
    const orden = { inicio: 0, nudo: 1, desenlace: 2 } as const;
    if (orden[d.fase] <= orden[a.fase]) throw new Error(`«${a.nombre}» ya está en ${a.fase}: solo puede avanzar a ${a.fase === "inicio" ? "nudo o desenlace" : "desenlace"}.`);
    a.fase = d.fase;
    a.hito = d.hito;
    if (d.fase === "nudo") a.nudo = d.hito;
    if (d.final_previsto) a.final_previsto = d.final_previsto;
    a.turnos_fase = 0;
    log.push(`Arco ${d.fase === "nudo" ? "al nudo" : "al desenlace"}: ${a.nombre} — ${d.hito}`);
    avanza = true;
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
  t.hilos = (t.arcos ?? []).map((a) => a.nombre);
  if (avanza) {
    t.avances += 1;
    t.sin_avance = 0;
  }
  if (!log.length) throw new Error("No hay nada que actualizar en la trama.");
  return log.join("\n");
}

/** Cuenta un turno más: los arcos envejecen en su fase y los PNJ fuera de escena llevan un turno más sin moverse. */
export function contarTurno(partida: Partida): void {
  const t = partida.trama ? normalizarTrama(partida.trama) : null;
  for (const a of t?.arcos ?? []) {
    a.turnos += 1;
    a.turnos_fase += 1;
  }
  for (const p of Object.values(partida.pnjs ?? {})) {
    if (MUERTO.test(p.estado ?? "")) continue;
    p.fuera_turnos = p.en_escena ? 0 : (p.fuera_turnos ?? 0) + 1;
  }
}

const ETAPA = { inicio: "INICIO", nudo: "NUDO", desenlace: "DESENLACE" } as const;

/** Avisos de ritmo de un arco (vacío si va bien). */
function avisoArco(a: Arco): string {
  if (a.fase === "inicio" && a.turnos_fase >= RITMO.inicio) return `⚠ Lleva ${a.turnos_fase} turnos en el inicio: plantea ya la complicación y pásalo al nudo (avanzar_arco).`;
  if (a.fase === "nudo" && a.turnos_fase >= RITMO.nudo) return `⚠ El nudo se alarga (${a.turnos_fase} turnos): acércalo al desenlace con una decisión, un giro o un coste (avanzar_arco a desenlace).`;
  if (a.fase === "desenlace" && a.turnos_fase >= RITMO.desenlace) return `⚠ Lleva ${a.turnos_fase} turnos en el desenlace: ciérralo ya, con su consecuencia (cerrar_arco).`;
  return "";
}

export function textoTrama(t: Trama): string {
  normalizarTrama(t);
  const arcos = t.arcos ?? [];
  return [
    `Objetivo del grupo: ${t.objetivo || "(sin fijar)"}`,
    `Arcos abiertos (${arcos.length}/${MAX_ARCOS}; cada uno debe llegar a su desenlace):`,
    ...(arcos.length
      ? arcos.map(
          (a) =>
            `- «${a.nombre}» [${ETAPA[a.fase]} · ${a.turnos_fase} turno(s) en esta fase] ${a.premisa}` +
            (a.nudo ? ` | Nudo: ${a.nudo}` : "") +
            (a.final_previsto ? ` | Final previsto: ${a.final_previsto}` : "") +
            (a.pnjs.length ? ` | Inciden: ${a.pnjs.join(", ")}` : "") +
            (avisoArco(a) ? `\n  ${avisoArco(a)}` : ""),
        )
      : ["  ninguno" + (t.objetivo ? " ⚠ abre un arco (abrir_arco) para el siguiente tramo de la historia: la historia necesita siempre su próximo inicio, nudo y desenlace" : "")]),
    t.cerrados?.length ? `Arcos ya resueltos (no los reabras ni los repitas): ${t.cerrados.slice(-5).map((c) => `${c.nombre} → ${c.desenlace}`).join(" | ")}` : "",
    t.pistas.length ? `Ya revelado (no lo contradigas ni lo vuelvas a esconder): ${t.pistas.slice(-10).join(" | ")}` : "",
    t.amenaza ? `Amenaza: ${t.amenaza} — reloj ${t.reloj}/6` : "",
    t.sin_avance >= 3 ? `⚠ Llevas ${t.sin_avance} turnos sin que la trama avance: en este turno haz avanzar un arco (nudo, desenlace), revela una pista o haz avanzar la amenaza.` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/** PNJ vivos fuera de escena: qué hacen mientras tanto y cuáles tienen que mover ficha ya. */
export function textoPnjsFuera(pnjs: Pnj[]): string {
  const fuera = pnjs.filter((p) => !p.en_escena && !MUERTO.test(p.estado ?? ""));
  if (!fuera.length) return "";
  return fuera
    .map((p) => {
      const n = p.fuera_turnos ?? 0;
      const aviso = !p.agenda
        ? n >= 2
          ? ` ⚠ sin agenda: dale una (pnj agenda) para que no se quede parado`
          : ""
        : n >= FUERA_ECO
          ? ` ⚠ lleva ${n} turnos fuera: que mueva ficha y su acción tenga eco en la escena (un rumor, un mensaje, una huella, una llegada) o cierre su asunto; luego actualiza su agenda`
          : "";
      return `- ${textoPnj(p, true)}${p.agenda ? ` · hace/hará: ${p.agenda}` : ""}${p.arco ? ` · arco «${p.arco}»` : ""} · ${n} turno(s) fuera${aviso}`;
    })
    .join("\n");
}

export const REGLAS_NARRATIVA = `## Voces y trama (que no se repita, no dé vueltas y nada quede en el aire)
- Cada PNJ con nombre tiene su propia voz: regístralo con pnj (rol, voz —léxico, muletillas, ritmo, lo que nunca diría—, quiere, actitud). Habla siempre con esa voz y desde lo que quiere.
- Nunca repitas una frase ya dicha. Si los jugadores preguntan lo mismo otra vez, el PNJ reacciona a la insistencia (se impacienta, sospecha, cede algo más) y dice algo distinto. Cuando un PNJ revele, prometa o mienta en algo importante, apúntalo en dijo.
- Interacciones distintas, respuestas distintas: el soborno, la amenaza, la adulación y la pregunta directa no producen el mismo diálogo; la actitud del PNJ cambia según cómo lo traten (actualiza actitud).

## Arcos: la historia se cuenta en principio, nudo y desenlace
- TODO se narra en arcos con tres tiempos. INICIO: se plantea quién, qué se juega y por qué importa (premisa). NUDO: aparece la complicación, el giro, el coste o una decisión difícil; aquí está la tensión. DESENLACE: se resuelve, con consecuencias claras (qué se consiguió, qué costó, qué cambia), y se cierra. Lleva los arcos con la herramienta trama: abrir_arco (nombre, premisa, final_previsto), avanzar_arco (fase nudo o desenlace + hito: qué pasó) y cerrar_arco (desenlace). Pasan al jugador como avisos 📖, así que cada paso se siente.
- Hay arcos grandes (el objetivo de la campaña) y pequeños (un encargo, un misterio, un enemigo, una escena). Como mucho ${MAX_ARCOS} abiertos a la vez: antes de abrir otro, lleva uno a su final. Cada escena es un mini-arco: entra con un gancho, tensa algo y SALE cerrando o pasando el testigo a otro arco; nunca termines una escena dejando algo flotando.
- Respeta el ritmo (el programa te avisa con ⚠ si un arco se alarga): inicio 1-3 turnos, nudo 4-7, desenlace 1-3. Las respuestas que se ganan con una buena tirada o una buena idea se dan claras, no con más enigmas.
- Nada queda en el aire: toda promesa, pregunta, misterio, deuda, amenaza u objeto que introduzcas tiene que resolverse (en su arco) o descartarse de forma explícita («el rumor era falso», «el cerrajero se cansó de esperar y abrió la puerta él mismo»). No abras un misterio nuevo sin cerrar otro ni escondas otra vez lo que ya se supo. Los pendientes de la marca de secuencia tienen que ir vaciándose: cada uno acaba en un desenlace.
- Al empezar una campaña abre el primer arco (con su premisa) y al menos un PNJ con agenda propia que choque con el grupo.

## PNJ vivos: nadie se queda parado porque el grupo se vaya
- Cada PNJ con nombre tiene una agenda (pnj agenda: qué hace y hacia dónde va cuando los protagonistas no lo ven) y, si pesa en la historia, un arco (pnj arco). Los PNJ no esperan: mientras el grupo hace otra cosa, ellos persiguen lo que quieren, y eso cambia el mundo.
- Cuando un PNJ está fuera de escena, su avance llega a los protagonistas como ECO breve (una o dos frases: un rumor, un mensaje, una huella, una consecuencia, una llegada inesperada), cuando toca y no en cada turno. NO cuentes lo que hace cada PNJ en cada momento: la narración siempre se centra en los protagonistas y los PNJ existen para empujarlos, tentarlos, estorbarlos o ayudarlos.
- El programa te avisa de qué PNJ llevan turnos fuera de escena sin moverse: haz que muevan ficha (y actualiza su agenda o su estado). Si el arco de un PNJ se cierra, dale una agenda nueva o dale un final (se va, muere, cambia de bando).
- Mantén la verdad al día, sobre todo cuando juegan varios: cada acción puede cambiar cosas distintas. Antes de narrar, registra TODO lo que cambió: la ficha (modificar_personaje), la ubicación, el estado, la agenda y la actitud del PNJ (pnj: estado, actitud, agenda, en_escena), la trama (trama) y las notas.
- Un hecho que sustituye a otro no se apunta aparte: corrige la nota vieja con anotar_mundo (nota + reemplaza) o bórrala (olvidar) para que no queden dos versiones. Una pista que resultó falsa se retira con trama.retirar_pista.
- Al recapitular o resumir, parte del ESTADO ACTUAL (trama, PNJ, notas, fichas, situación) y no de los turnos antiguos. Si dos fuentes se contradicen, vale la más reciente. Lo que cambió se cuenta como cambio («antes…, ahora…»), nunca como si siguiera igual. Si dudas de algo, no lo afirmes: cuéntalo como lo último que sabíais.
- Si los jugadores están atascados o dan vueltas, no añadas complicaciones: dales una salida clara (un PNJ que habla, una pista evidente, la amenaza que les obliga a moverse) y lleva el arco al siguiente tiempo. Cada vez que pierden tiempo, avanza el reloj de la amenaza (avanzar_amenaza); a 6, golpea.`;
