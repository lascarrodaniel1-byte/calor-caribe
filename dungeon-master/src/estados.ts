// Estados por tipo de daño (docs/DANOS.md, «Estados por tipo de daño»; BALANCE §18): un golpe elemental que causa daño FINAL > 0 puede dejar un estado
// (fuego → quemado, eléctrico → paralizado…), con SALVACIÓN contra una CD fija derivada del atacante. Todo el mapa es PROPUESTA A CONFIRMAR.
// Usa el catálogo de condiciones (condiciones.ts): no inventa efectos que el motor no sepa aplicar.
import { describir, tirar } from "./dados.js";
import { condicionInmune, mismaCondicion, reconocer } from "./condiciones.js";
import { esFisico, resiste, type FuenteDano, type PerfilDano, type TipoDano } from "./danos.js";
import { aplicarCondicion, condsDe, localizar, retirarCaido, type Combatiente } from "./combate.js";
import { danarConTipo, inmunidadesCondicionDe, perfilDeJefe, perfilDePnj, type EstadoJefe, type Habilidad } from "./bestiario.js";
import { aplicarDanoAPersonaje, perfilDePersonaje } from "./rasgos.js";
import { ventajaRacial } from "./rasgos.js";
import { competencia, mod, salvacion, signo, valor, type Atributo } from "./reglas.js";
import { danoEnSuelo } from "./muerte.js";
import { aplicarDano } from "./danos.js";
import type { Partida, Personaje } from "./estado.js";
import { segDeAsaltos, type EstadoDano } from "./estados_base.js";

/** Cuánto dura un estado: N asaltos, «breve» (hasta el final de su siguiente turno) o «descanso» (hasta el próximo descanso). */
type Duracion = number | "breve" | "descanso";
interface Paso { condicion: string; duracion: Duracion }
interface DefEstado {
  emoji: string;
  /** Salvación del objetivo. */
  salva: Atributo;
  /** Fallo normal. */
  normal: Paso[];
  /** Fallo por 5 o más, o golpe crítico del atacante. Sin él, vale el normal. */
  fuerte?: Paso[];
}

/** PROPUESTA A CONFIRMAR: tipo de daño → estado. Los tipos físicos no dan estado. */
export const ESTADOS_POR_DANO: Partial<Record<TipoDano, DefEstado>> = {
  fuego: { emoji: "🔥", salva: "des", normal: [{ condicion: "quemado", duracion: 3 }] },
  eléctrico: { emoji: "⚡", salva: "con", normal: [{ condicion: "paralizado", duracion: "breve" }] },
  frío: { emoji: "🥶", salva: "con", normal: [{ condicion: "ralentizado", duracion: 3 }], fuerte: [{ condicion: "paralizado", duracion: "breve" }] },
  ácido: { emoji: "🧪", salva: "des", normal: [{ condicion: "corroído", duracion: "descanso" }] },
  veneno: { emoji: "🤒", salva: "con", normal: [{ condicion: "envenenado", duracion: 3 }] },
  necrótico: { emoji: "💀", salva: "con", normal: [{ condicion: "debilitado", duracion: 3 }] },
  radiante: { emoji: "☀", salva: "con", normal: [{ condicion: "cegado", duracion: "breve" }] },
  trueno: { emoji: "🔔", salva: "con", normal: [{ condicion: "ensordecido", duracion: 3 }], fuerte: [{ condicion: "ensordecido", duracion: 3 }, { condicion: "derribado", duracion: 1 }] },
  psíquico: { emoji: "🧠", salva: "sab", normal: [{ condicion: "asustado", duracion: 2 }], fuerte: [{ condicion: "aturdido", duracion: "breve" }] },
  fuerza: { emoji: "💫", salva: "fue", normal: [{ condicion: "derribado", duracion: 1 }] },
};
/** Condiciones de control fuerte: si ya las sufre, otro golpe NO las alarga (el resto solo se renueva). */
const CONTROL = new Set(["paralizado", "aturdido", "cegado"]);

const registro = (partida: Partida): EstadoDano[] => (partida.estadosDano ??= []);
const ronda = (partida: Partida): number => partida.combate?.ronda ?? 0;

// ------------------------------------------------------------------ CD del atacante

const PROF_PELIGRO: Record<number, number> = { 1: 2, 2: 2, 3: 3, 4: 4, 5: 5 };
const modTexto = (atributos: string, a: string): number => mod(Number(new RegExp(`${a}\\s+(\\d+)`, "i").exec(atributos)?.[1] ?? 10));

/** CD fija del estado: la del atacante. PJ: 8 + competencia + mod (de lanzamiento si ataca con INT/SAB/CAR, si no el mejor de FUE/DES); criatura: la CD de sus habilidades o 8 + competencia + su mejor mod; PNJ: 12; sin atacante: 13. */
export function cdDeEstado(atacante: Combatiente | undefined, atributo?: string): number {
  if (!atacante) return 13;
  if (atacante.tipo === "pj") {
    const p = atacante.p;
    const m = atributo && ["int", "sab", "car"].includes(atributo) ? mod(valor(p, atributo as Atributo)) : Math.max(mod(valor(p, "fue")), mod(valor(p, "des")));
    return 8 + competencia(p) + m;
  }
  if (atacante.tipo === "criatura") {
    const d = atacante.j.definicion;
    const cds = d.habilidades.map((h) => h.cd).filter((x): x is number => typeof x === "number").sort((a, b) => a - b);
    if (cds.length) return cds[Math.floor((cds.length - 1) / 2)];
    return 8 + (PROF_PELIGRO[d.peligro] ?? 3) + Math.max(...["FUE", "DES", "CON", "INT", "SAB", "CAR"].map((a) => modTexto(d.atributos, a)));
  }
  return 12;
}

// ------------------------------------------------------------------ aplicación

const perfilDe = (partida: Partida, c: Combatiente): PerfilDano => (c.tipo === "pj" ? perfilDePersonaje(c.p) : c.tipo === "criatura" ? perfilDeJefe(c.j, ronda(partida)) : perfilDePnj(c.n));
const vivo = (c: Combatiente): boolean => (c.tipo === "pj" ? c.p.pv > 0 && !c.p.condiciones.includes("muerto") : c.tipo === "criatura" ? c.j.pv > 0 : c.n.pv === undefined || c.n.pv > 0);

/** Salvación del estado. `motivo`: por qué hay ventaja (resiste el tipo…); `contra`: contra qué es (miedo, veneno, hechizo…) para las ventajas raciales. El texto dice siempre de dónde viene la ventaja. */
function salvar(c: Combatiente, atr: Atributo, cd: number, o: { motivo?: string; contra?: string } = {}): { exito: boolean; margen: number; texto: string } {
  if (c.tipo === "pj") {
    const racial = ventajaRacial(c.p, o.contra);
    const s = salvacion(c.p, atr, cd, { ventaja: !!o.motivo, contra: o.contra });
    const razon = o.motivo ?? racial;
    const texto = razon ? s.texto.replace(/\(ventaja(?:: [^)]*)?\)/, `(ventaja: ${razon})`) : s.texto;
    return { exito: s.exito, margen: s.margen, texto };
  }
  const ventaja = !!o.motivo;
  const m = c.tipo === "criatura" ? modTexto(c.j.definicion.atributos, atr) : atr === "des" && c.n.des ? mod(c.n.des) : atr === "sab" && c.n.sab ? mod(c.n.sab) : 0;
  const t = tirar(`1d20${signo(m)}`, ventaja ? "ventaja" : "normal");
  const natural = t.dados[0];
  const exito = natural === 20 || (natural !== 1 && t.total >= cd);
  return { exito, margen: t.total - cd, texto: `salvación de ${atr.toUpperCase()} ${describir(t)}${ventaja ? ` (ventaja: ${o.motivo})` : ""} vs CD ${cd} → ${exito ? "éxito" : "fallo"}` };
}

/** Hasta qué asalto vale. «breve» = hasta el final de SU siguiente turno: este asalto si aún no ha actuado (el atacante va antes), el siguiente si ya actuó. */
function hastaDe(partida: Partida, d: Duracion, atacante: Combatiente | undefined, objetivo: Combatiente): number | undefined {
  const r = ronda(partida);
  if (!partida.combate || d === "descanso") return undefined;
  if (d === "breve") {
    const orden = partida.combate.orden;
    const ia = atacante ? orden.findIndex((o) => o.nombre.toLowerCase() === atacante.nombre.toLowerCase()) : -1;
    const ib = orden.findIndex((o) => o.nombre.toLowerCase() === objetivo.nombre.toLowerCase());
    return ia >= 0 && ib >= 0 && ia < ib ? r : r + 1;
  }
  return r + d - 1;
}

/** Segundos de reloj de una duración fuera de combate: «breve» = 1 asalto (6 s), N asaltos = 6·N s; «descanso» no caduca por reloj. */
function segDe(partida: Partida, d: Duracion): number | undefined {
  if (partida.combate || d === "descanso") return undefined;
  return segDeAsaltos(d === "breve" ? 1 : d);
}

const textoDuracion = (d: Duracion): string => (d === "breve" ? "hasta el final de su siguiente turno" : d === "descanso" ? "hasta el descanso" : d === 1 ? "1 asalto" : `${d} asaltos`);
const ETIQUETA_CORTA = (p: Paso): string => (p.duracion === "breve" ? `${p.condicion} (1 turno)` : p.duracion === "descanso" ? `${p.condicion} (CA −1)` : `${p.condicion} (${textoDuracion(p.duracion)})`);

export interface DatosEstadoDano {
  partida: Partida;
  objetivo: Combatiente;
  atacante?: Combatiente;
  tipo?: TipoDano;
  /** Daño FINAL (tras armadura, resistencias e inmunidades). */
  final: number;
  fuente?: FuenteDano;
  /** CD fija; si no, la del atacante. */
  cd?: number;
  /** Atributo del ataque (si es de lanzamiento: int, sab, car). */
  atributo?: string;
  /** Golpe crítico: cuenta como fallo por 5 o más. */
  critico?: boolean;
  /** true: este golpe no da estado. Un texto: da ESE estado (condición del catálogo) en lugar del de siempre. */
  sin?: boolean | string;
}
export interface ResultadoEstado { lineas: string[]; aviso: string | null }

/** Si el golpe deja un estado: comprueba las reglas, tira la salvación y aplica la condición (con su duración). Devuelve líneas para el DM y el aviso compacto. */
export function estadoPorDano(d: DatosEstadoDano): ResultadoEstado {
  const nada: ResultadoEstado = { lineas: [], aviso: null };
  const def = d.tipo ? ESTADOS_POR_DANO[d.tipo] : undefined;
  if (!d.tipo || esFisico(d.tipo) || !def || d.final <= 0 || d.sin === true || !vivo(d.objetivo)) return nada;
  const { partida, objetivo: ob } = d;
  const nombre = ob.nombre;
  const tipo = d.tipo;
  const sobre = typeof d.sin === "string" ? d.sin : undefined;
  const pasos = (sobre ? [{ condicion: sobre, duracion: def.normal[0].duracion }] : def.normal);
  const lista = condsDe(ob);
  // Un inmune a esa condición no la sufre (aviso claro); quien ya la tiene, solo la renueva; quien acaba de recuperarse, es inmune este asalto.
  const inmunes = ob.tipo === "criatura" ? inmunidadesCondicionDe(ob.j) : ob.tipo === "pnj" ? inmunidadesCondicionDe(ob.n) : [];
  const primero = pasos[0];
  const inmune = condicionInmune(inmunes, primero.condicion);
  if (inmune) return { lineas: [`${def.emoji} ${nombre} es inmune a la condición ${inmune} (su ficha): el golpe de ${tipo} no le deja estado.`], aviso: null };
  const idPrimero = reconocer(primero.condicion)?.id ?? primero.condicion;
  const reg = registro(partida);
  const previo = reg.find((x) => x.nombre === nombre && x.id === idPrimero);
  if (previo?.inmuneHasta !== undefined && previo.inmuneHasta >= ronda(partida)) return { lineas: [`${def.emoji} ${nombre} acaba de recuperarse de ${primero.condicion}: este asalto es inmune a ese estado.`], aviso: null };
  if (lista.some((x) => mismaCondicion(x, primero.condicion))) {
    if (previo && !CONTROL.has(idPrimero) && primero.duracion !== "descanso") { // renueva: solo alarga el que ya se tenía por este medio
      const nuevo = hastaDe(partida, primero.duracion, d.atacante, ob);
      if (nuevo !== undefined && (previo.hasta ?? 0) < nuevo) previo.hasta = nuevo;
      const ns = segDe(partida, primero.duracion);
      if (ns !== undefined && previo.seg !== undefined && previo.seg < ns) previo.seg = ns;
      return { lineas: [`${def.emoji} ${nombre} ya está ${primero.condicion}: se renueva (no se acumula).`], aviso: null };
    }
    return { lineas: [`${def.emoji} ${nombre} ya está ${primero.condicion}: no se acumula.`], aviso: null };
  }
  // Salvación contra la CD fija; resistir el tipo da ventaja.
  const cd = d.cd ?? cdDeEstado(d.atacante, d.atributo);
  const motivo = resiste(perfilDe(partida, ob), tipo, d.fuente) ? "resiste el tipo" : undefined;
  const s = salvar(ob, def.salva, cd, { motivo, contra: primero.condicion });
  if (s.exito) return { lineas: [`${def.emoji} ${nombre} aguanta el efecto de ${tipo}: ${s.texto}.`], aviso: null };
  const fuerte = !!def.fuerte && !sobre && (s.margen <= -5 || !!d.critico);
  const aplicar = fuerte ? def.fuerte! : pasos;
  const lineas: string[] = [`${def.emoji} ${nombre} sufre un estado por el daño de ${tipo}: ${s.texto}${fuerte ? " (fallo grave: efecto mayor)" : ""}.`];
  const puestos: Paso[] = [];
  for (const paso of aplicar) {
    const id = reconocer(paso.condicion)?.id ?? paso.condicion;
    const yaEsta = lista.some((x) => mismaCondicion(x, paso.condicion));
    const prev = reg.find((x) => x.nombre === nombre && x.id === id);
    if (yaEsta || (prev?.inmuneHasta !== undefined && prev.inmuneHasta >= ronda(partida)) || condicionInmune(inmunes, paso.condicion)) continue;
    const hasta = hastaDe(partida, paso.duracion, d.atacante, ob);
    const seg = segDe(partida, paso.duracion);
    const texto = `${paso.condicion} (${tipo}: ${textoDuracion(paso.duracion)})`;
    const r = aplicarCondicion(partida, { objetivo: nombre, accion: "aplicar", condicion: texto });
    if (/es inmune a la condición/.test(r)) continue;
    const i = reg.findIndex((x) => x.nombre === nombre && x.id === id);
    if (i >= 0) reg.splice(i, 1);
    reg.push({ nombre, id, texto, tipo, ...(hasta !== undefined ? { hasta } : {}), ...(seg !== undefined ? { seg } : {}) });
    puestos.push(paso);
    lineas.push(`  ${r.split("\n").join("\n  ")}`);
  }
  if (!puestos.length) return { lineas, aviso: null };
  lineas.push(`  (Estado por tipo de daño: la salvación fue contra CD ${cd}; no lo apliques tú otra vez. Termina solo; si se aplica de nuevo antes, solo se renueva.)`);
  return { lineas, aviso: `${def.emoji} ${nombre}: ${puestos.map(ETIQUETA_CORTA).join(" + ")}` };
}

// ------------------------------------------------------------------ gancho para habilidades y trampas (usarHabilidad)

/** El gancho que `usarHabilidad` llama tras dañar a un personaje con una habilidad o trampa. Sin estado si la habilidad lleva `estado: false`, ya trae su propia condición o la criatura no da estados. */
export function ganchoEstados(partida: Partida, e: EstadoJefe | undefined, h: Habilidad): (p: Personaje, info: { tipo: TipoDano; final: number; falla: boolean }, log: string[]) => void {
  return (p, info, log) => {
    if (h.estado === false || (e?.definicion.sinEstados) || (h.condicion && h.estado === undefined) || !info.falla) return; // quien superó la salvación de la habilidad no sufre además el estado
    let atacante: Combatiente | undefined;
    if (e) { try { atacante = localizar(partida, e.nombre); } catch { atacante = undefined; } }
    let ob: Combatiente;
    try { ob = localizar(partida, p.nombre); } catch { return; }
    const r = estadoPorDano({ partida, objetivo: ob, atacante, tipo: info.tipo, final: info.final, cd: h.cd, sin: typeof h.estado === "string" ? h.estado : undefined });
    for (const l of r.lineas) log.push(`  ${l.split("\n").join("\n  ")}`);
  };
}

// ------------------------------------------------------------------ paso del tiempo

function danarArde(partida: Partida, c: Combatiente): string | null {
  const t = tirar("1d4");
  if (c.tipo === "pj") {
    const p = c.p;
    const res = aplicarDanoAPersonaje(p, t.total, "fuego");
    const suelo = p.pv <= 0;
    p.pv = Math.max(0, p.pv - res.final);
    let s = `🔥 ${p.nombre} arde: ${describir(t)} de fuego${res.final !== t.total ? ` → ${res.final}` : ""} (PV ${p.pv}/${p.pv_max}).`;
    if (suelo && res.final > 0) { const x = danoEnSuelo(p, res.final, false); if (x) s += ` ${x}`; }
    return s;
  }
  if (c.tipo === "criatura") {
    const r = danarConTipo(c.j, t.total, "fuego", undefined, ronda(partida));
    const s = `🔥 ${c.nombre} arde: ${describir(t)} de fuego. ${r.texto}`;
    if (c.j.pv <= 0) retirarCaido(partida, c.j);
    return s;
  }
  if (c.n.pv === undefined) return `🔥 ${c.nombre} arde: ${describir(t)} de fuego (lleva tú sus PV).`;
  const fin = c.n.criatura ? aplicarDano({ objetivo: perfilDePnj(c.n), cantidad: t.total, tipo: "fuego" }).final : t.total;
  c.n.pv = Math.max(0, c.n.pv - fin);
  return `🔥 ${c.nombre} arde: ${describir(t)} de fuego → ${c.n.pv}/${c.n.pv_max ?? "?"} PV${c.n.pv === 0 ? " — CAE." : ""}`;
}

/** Un personaje a 0 PV que aún no ha muerto: el fuego que lo sigue quemando le cuenta como daño en el suelo (fallo de salvación contra muerte). */
const enElSuelo = (c: Combatiente): boolean => c.tipo === "pj" && c.p.pv <= 0 && !c.p.condiciones.includes("muerto");

/** Quita la condición de quien la sufre (personaje, criatura en escena o PNJ del combate); sin él, no hace nada. */
function quitarCondicion(partida: Partida, e: EstadoDano): void {
  let l: string[] | undefined;
  try { l = condsDe(localizar(partida, e.nombre)); } catch { l = undefined; }
  if (l) { const resto = l.filter((x) => x !== e.texto); l.splice(0, l.length, ...resto); }
}

/** Fuera de combate los estados caducan por RELOJ: resta `segundos` a los que tienen `seg` y quita los vencidos (con aviso). Lo llama `ejecutar` cuando el reloj avanza (pasar_tiempo, tiempo, asaltos…). */
export function caducarEstadosFuera(partida: Partida, segundos: number): string[] {
  const reg = partida.estadosDano;
  if (!reg?.length || !(segundos > 0)) return [];
  const out: string[] = [];
  for (const e of [...reg]) {
    if (e.seg === undefined) continue;
    e.seg -= segundos;
    if (e.seg > 0) continue;
    reg.splice(reg.indexOf(e), 1);
    quitarCondicion(partida, e);
    out.push(`⏱ ${e.nombre} ya no está ${e.id}${e.tipo ? ` (el estado de ${e.tipo} termina)` : ""}.`);
  }
  if (!reg.length) delete partida.estadosDano;
  return out;
}

/** Al empezar un combate se purgan los estados que venían de fuera y no tienen plazo en asaltos (los de reloj y los sin plazo), salvo «corroído» (hasta el descanso) y los que persisten (Hiel…). */
export function purgarEstadosHeredados(partida: Partida): string[] {
  const reg = partida.estadosDano;
  if (!reg?.length) return [];
  const out: string[] = [];
  partida.estadosDano = reg.filter((e) => {
    if (e.hasta !== undefined || e.inmuneHasta !== undefined || e.id === "corroido" || e.persiste) return true;
    quitarCondicion(partida, e);
    out.push(`⏱ ${e.nombre} ya no está ${e.id}: el estado de ${e.tipo} venía de antes del combate y se da por pasado.`);
    return false;
  });
  if (!partida.estadosDano.length) delete partida.estadosDano;
  return out;
}

/** Al abrirse cada asalto (tras `siguienteAsalto`): arde quien está quemado y acaban los estados cuyo plazo venció; quien se recupera es inmune a él un asalto. */
export function pasarAsaltoEstados(partida: Partida): string[] {
  const r = ronda(partida);
  const reg = partida.estadosDano;
  if (!reg?.length || !partida.combate) return [];
  const out: string[] = [];
  for (const e of [...reg]) {
    let c: Combatiente;
    try { c = localizar(partida, e.nombre); } catch { reg.splice(reg.indexOf(e), 1); continue; } // ya no está en escena
    if (e.inmuneHasta !== undefined) { if (e.inmuneHasta < r) reg.splice(reg.indexOf(e), 1); continue; }
    if (e.hasta !== undefined && e.hasta < r) {
      const l = condsDe(c);
      const resto = l.filter((x) => x !== e.texto);
      l.splice(0, l.length, ...resto);
      e.inmuneHasta = r;
      out.push(`⏱ ${e.nombre} ya no está ${e.id} (el estado de ${e.tipo} termina): este asalto es inmune a él.`);
      continue;
    }
    if (e.id === "quemado" && (vivo(c) || enElSuelo(c))) { const x = danarArde(partida, c); if (x) out.push(x); }
  }
  return out;
}

/** Texto de la regla para consultar_reglas (bajo demanda): el mapa y sus reglas. */
export const REGLAS_ESTADOS = `## Estados por tipo de daño (propuesta a confirmar)
Un golpe elemental (no físico) que causa daño FINAL > 0 puede dejar un estado, con una salvación del objetivo contra una CD fija del atacante (criatura: la de sus habilidades o 8 + competencia + mod; PJ: 8 + competencia + FUE/DES, o su atributo de lanzamiento; trampa: su CD). Resistir el tipo da ventaja en la salvación; el inmune no sufre nada. Lo aplica el programa en atacar, habilidad_criatura, trampa, danar_criatura {tipo_dano} y modificar_personaje {pv_cambio negativo, tipo_dano} (daño elemental que narras sobre un PJ: mismos parámetros cd_estado, atributo y sin_estado, igual que sobre una criatura): no lo apliques tú «de palabra». La salvación cuenta las ventajas raciales contra miedo, veneno y hechizo (asustado, envenenado…) y la tirada dice de dónde viene la ventaja.
${Object.entries(ESTADOS_POR_DANO).map(([t, d]) => `- ${t} → ${d!.normal.map((p) => `${p.condicion} (${textoDuracion(p.duracion)})`).join(" + ")} (salvación de ${d!.salva.toUpperCase()})${d!.fuerte ? `; fallo por 5 o más o crítico: ${d!.fuerte.map((p) => `${p.condicion} (${textoDuracion(p.duracion)})`).join(" + ")}` : ""}`).join("\n")}
- Opt-out: atacar/danar_criatura {sin_estado: true}; en la ficha, estado: false en una habilidad (o sinEstados en la criatura). El daño físico no da estado.
- No se acumula: quien ya lo sufre solo lo renueva (los de control —paralizado, aturdido, cegado— no se alargan). Al terminar, el objetivo es inmune a ese estado un asalto. Acaban solos al cambiar de asalto (siguiente_asalto), al acabar el combate y al descansar (corroído, hasta el descanso).
- Quemado: 1d4 de fuego al empezar cada asalto; se apaga con accion_combate {accion: apagarse} (una acción) o con agua (agua sumergir/entrar lo quita; sumergido resiste el fuego). Si lo pones a mano con condicion o agregar_condiciones también arde y caduca igual (3 asaltos). Un PJ a 0 PV que sigue quemado sufre ese fuego como daño en el suelo (un fallo de salvación contra muerte por asalto).
- Esencia Clara (vial, 50 po; nombre propuesto): quita TODOS los estados temporales (quemado, paralizado, ralentizado, envenenado, ensordecido, cegado, aturdido, corroído, debilitado), también los de la Hiel y los puestos a mano, sin dejar asalto de inmunidad. No toca maldiciones, enfermedades, heridas ni agotamiento. Pide receptor; si está incapacitado, otro debe dársela (portador distinto).
- Duración: en combate, por asaltos. Fuera de combate, por RELOJ («breve» = 1 asalto = 6 s; N asaltos = 6·N s): caducan cuando el reloj avanza (pasar_tiempo, tiempo avanzar); no arden fuera de combate. Al iniciar un combate se purgan los que venían de fuera (menos corroído, hasta el descanso). La Hiel de Víbora Gris deja envenenado 1 h y paralizado 1 min por reloj (sobreviven al combate). Ralentizado: velocidad a la mitad y desventaja en salvaciones de DES. Corroído: CA −1. Debilitado: desventaja en pruebas.
- Tragado: el daño de dentro (eléctrico, ácido) no da estado.`;
