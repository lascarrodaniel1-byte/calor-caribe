// Segador de Neter: recolector de almas. Neter, dios de las cosechas y la vegetación, pactó al morir con sus fieles para
// trasladar su esencia a ellos. El Segador blande una guadaña de los huesos del dios, descarga fuerza sobrenatural, habla con
// los muertos y sella las almas de los vivos a los que hiere (les quita su habilidad firma). Todo poder suma Deuda con
// Neter, que pesa más cuanto más poder tiene y se paga con almas.
import type { Partida, Personaje } from "./estado.js";
import { localizar, puedeActuar, turnoDe, type Combatiente, type DatosAtaque, type ResultadoAtaque } from "./combate.js";
import { describir, tirar } from "./dados.js";
import { terminarFuria } from "./furia.js";
import { infligir } from "./heridas.js";
import { envejecer } from "./magia.js";
import { competencia, mod, salvacion, signo, valor } from "./reglas.js";
import { ALDESCANSAR, RECURSOS_CLASE, usarRecurso } from "./recursos.js";
import { capacidadAlmas, DEUDA_COBRO, esSegador, etapaDeuda, exigirLibre, FIRMAS, INVOCACIONES, multiplicadorDeuda, selloDe, type AlmaSellada } from "./segador_base.js";

const norm = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
const GUADANA = "Guadaña de Neter";

function segador(partida: Partida, quien: string): Personaje {
  const p = Object.values(partida.personajes).find((x) => norm(x.nombre) === norm(quien) || (x.jugador && norm(x.jugador) === norm(quien)));
  if (!p) throw new Error(`No hay ningún personaje llamado «${quien}».`);
  if (!esSegador(p)) throw new Error(`${p.nombre} no es un Segador.`);
  return p;
}
const vivo = (p: Personaje) => {
  if (p.condiciones.includes("muerto") || p.pv <= 0) throw new Error(`${p.nombre} está a 0 PV o muerto.`);
};

// ------------------------------------------------------------------ Deuda de Neter

/** Suma Deuda (multiplicada por el nivel). Devuelve lo que ha pasado. */
export function sumarDeuda(p: Personaje, puntos: number, causa: string): string {
  const mult = multiplicadorDeuda(p.nivel);
  const antes = p.deuda ?? 0;
  const suma = puntos * mult;
  p.deuda = antes + suma;
  const lineas = [`Deuda de Neter +${suma}${mult > 1 ? ` (${puntos} ×${mult} por su poder)` : ""} por ${causa}: ${p.deuda}.`];
  const e0 = etapaDeuda(antes), e1 = etapaDeuda(p.deuda);
  if (e1.desde > e0.desde && e1.desde < DEUDA_COBRO) lineas.push(`Etapa «${e1.nombre}»: ${e1.efecto}.`);
  if (p.deuda >= DEUDA_COBRO) lineas.push(cobro(p));
  return lineas.join(" ");
}

/** Paga Deuda con almas. */
export function pagarDeuda(p: Personaje, puntos: number, causa: string): string {
  const antes = p.deuda ?? 0;
  p.deuda = Math.max(0, antes - puntos);
  return `Neter recibe ${causa}: la Deuda baja ${antes - p.deuda} (${p.deuda}).`;
}

/** A 15, Neter cobra por su cuenta: años de vida, una herida grave o la guadaña se resiste un día. */
function cobro(p: Personaje): string {
  const d = tirar("1d3").total;
  p.deuda = (p.deuda ?? 0) - 5;
  if (d === 1) {
    const a = tirar("1d6").total;
    if (p.magia) { p.magia.anios_perdidos = Math.round((p.magia.anios_perdidos + a) * 10) / 10; const log: string[] = []; envejecer(p, log); return `☠ NETER COBRA: le arranca ${a} año(s) de vida. ${log.join(" ")} La Deuda baja a ${p.deuda}.`; }
    return `☠ NETER COBRA: le arranca ${a} año(s) de vida (envejece de golpe). La Deuda baja a ${p.deuda}.`;
  }
  if (d === 2) {
    const h = infligir(p, { causa: "menor", gravedad: "grave", tipo: "contusion", descripcion: "Neter cobra: un hueso se le parte desde dentro" });
    return `☠ NETER COBRA: un hueso se le parte desde dentro. ${h} La Deuda baja a ${p.deuda}.`;
  }
  if (!p.condiciones.includes("guadaña fría (1 día)")) p.condiciones.push("guadaña fría (1 día)");
  p.inventario = p.inventario.filter((x) => !new RegExp(GUADANA, "i").test(x));
  if (p.manos?.principal && new RegExp(GUADANA, "i").test(p.manos.principal)) p.manos = {};
  return `☠ NETER COBRA: la guadaña se queda fría y callada un día entero y no puede invocarla. La Deuda baja a ${p.deuda}.`;
}

RECURSOS_CLASE["Segador"] = [
  {
    nombre: "Descarga sobrenatural",
    desde: 1,
    max: (p) => (p.nivel >= 2 ? 2 : 1),
    recarga: "corto",
    efecto: (p) => `${p.nombre} canaliza la fuerza del dios muerto.`,
  },
];
ALDESCANSAR.push((p, tipo) => {
  if (!esSegador(p)) return;
  delete p.pielHueso;
  if (tipo === "largo") p.condiciones = p.condiciones.filter((c) => !/guadaña fría/.test(c));
});

// ------------------------------------------------------------------ guadaña y descarga

export function guadana(partida: Partida, d: { quien: string; accion: "invocar" | "despedir" }): string {
  const p = segador(partida, d.quien);
  vivo(p);
  const tiene = p.inventario.some((x) => new RegExp(GUADANA, "i").test(x));
  if (d.accion === "despedir") {
    if (!tiene) throw new Error(`${p.nombre} no tiene la guadaña invocada.`);
    p.inventario = p.inventario.filter((x) => !new RegExp(GUADANA, "i").test(x));
    if (p.manos?.principal && new RegExp(GUADANA, "i").test(p.manos.principal)) p.manos = {};
    return `${p.nombre} despide la guadaña: los huesos de Neter se deshacen en polvo entre sus manos.`;
  }
  if (p.condiciones.some((c) => /guadaña fría/.test(c))) throw new Error(`La guadaña está dormida (Neter cobró): no responde hasta el próximo descanso largo.`);
  if (tiene && p.manos?.dosManos && new RegExp(GUADANA, "i").test(p.manos.principal ?? "")) throw new Error(`${p.nombre} ya empuña la guadaña.`);
  const t = partida.combate ? turnoDe(partida, p.nombre) : undefined;
  if (t) {
    if (t.adicional) throw new Error(`${p.nombre} ya usó su acción adicional este asalto (${t.adicional}).`);
    t.adicional = "invocar la guadaña";
  }
  if (!tiene) p.inventario.push(GUADANA);
  p.manos = { principal: GUADANA, dosManos: true };
  return `${p.nombre} invoca la guadaña: un hueso largo y blanco del dios muerto se cierra en sus manos${t ? " (acción adicional)" : ""}. Ataca con CAR, 1d10 cortante, alcance 3 m, a dos manos${p.nivel >= 3 ? ", mágica" : ""}.`;
}

/** Gasta un uso de la descarga y prepara los rayos (uno; dos desde el nivel 5). */
export function prepararDescarga(partida: Partida, d: { quien: string; objetivo: string; objetivo2?: string }): { ataques: DatosAtaque[]; nota: string; deuda: () => string } {
  const p = segador(partida, d.quien);
  vivo(p);
  const r = usarRecurso(partida, { quien: p.nombre, recurso: "Descarga sobrenatural" });
  const rayos = p.nivel >= 5 ? 2 : 1;
  const base = { atacante: p.nombre, arma: "Descarga sobrenatural", dano: "1d10", a_distancia: true, atributo: "car" as const, tipo_dano: "contundente" as const };
  const ataques: DatosAtaque[] = [{ ...base, objetivo: d.objetivo }];
  if (rayos === 2) ataques.push({ ...base, objetivo: d.objetivo2 ?? d.objetivo });
  // La Deuda se suma después de los rayos: si Neter cobra, no le quita la descarga a medias.
  return { ataques, nota: r.replace(/ Quedan.*/, ""), deuda: () => sumarDeuda(p, 1, "la descarga") };
}

/** Una criatura muerta bajo la guadaña o la descarga paga la Deuda (su peligro). */
export function cosechar(partida: Partida, e: DatosAtaque, r: ResultadoAtaque): string {
  if (!r.muerto) return "";
  const p = Object.values(partida.personajes).find((x) => norm(x.nombre) === norm(e.atacante));
  if (!p || !esSegador(p) || !(/guada[ñn]a|descarga sobrenatural/i.test(e.arma ?? "") || (!e.arma && /guada[ñn]a/i.test(p.manos?.principal ?? "")))) return "";
  const j = Object.values(partida.jefes).find((x) => norm(x.nombre) === norm(r.muerto!));
  const valorAlma = j ? j.definicion.peligro : 1;
  return `💀 ${p.nombre} siega el alma de ${r.muerto}. ` + pagarDeuda(p, valorAlma, `el alma de ${r.muerto} (peligro ${valorAlma})`);
}

/** Tras herir con la guadaña: su sangre está fresca para sellar un alma este asalto. */
export function anotarHerida(partida: Partida, e: DatosAtaque, r: ResultadoAtaque): void {
  if (!partida.combate || !((r.dano ?? 0) > 0)) return;
  const p = Object.values(partida.personajes).find((x) => norm(x.nombre) === norm(e.atacante));
  if (!p || !esSegador(p) || !/guada[ñn]a/i.test(e.arma ?? p.manos?.principal ?? "")) return;
  const t = turnoDe(partida, p.nombre);
  (t.heridos ??= []).push(e.objetivo);
}

// ------------------------------------------------------------------ sellar almas

function cdSello(p: Personaje) {
  return 8 + competencia(p) + mod(valor(p, "car"));
}

export function sellarAlma(partida: Partida, d: { quien: string; objetivo: string; habilidad?: string; con_sangre?: boolean }): string {
  const p = segador(partida, d.quien);
  vivo(p);
  if (p.nivel < 2) throw new Error(`${p.nombre} aún no sabe sellar almas (nivel 2).`);
  if ((p.almas ?? []).length >= capacidadAlmas(p.nivel)) throw new Error(`${p.nombre} ya sostiene ${capacidadAlmas(p.nivel)} alma(s) selladas (su límite): libera una con liberar_alma o entrégala a Neter.`);
  const c = localizar(partida, d.objetivo);
  if (c.nombre === p.nombre) throw new Error("No puede sellar su propia alma.");
  // La sangre tiene que ser fresca: lo hirió con la guadaña este mismo turno.
  if (partida.combate) {
    const t = turnoDe(partida, p.nombre);
    if (!(t.heridos ?? []).some((n) => norm(n) === norm(c.nombre))) throw new Error(`${p.nombre} no ha herido a ${c.nombre} con la guadaña este asalto: sin su sangre fresca no puede sellar su alma.`);
    if (t.adicional) throw new Error(`${p.nombre} ya usó su acción adicional este asalto (${t.adicional}).`);
    t.adicional = "sellar un alma";
  } else if (!d.con_sangre) throw new Error("Fuera de combate hace falta su sangre fresca: pasa con_sangre=true si acaba de herirlo con la guadaña.");
  // La víctima: qué habilidad.
  const sellos = c.tipo === "pj" ? (c.p.sellos ??= []) : c.tipo === "criatura" ? (c.j.sellos ??= []) : (c.n.sellos ??= []);
  let habilidad = d.habilidad;
  if (c.tipo === "pj") {
    const firmas = FIRMAS[c.p.clase] ?? ["Habilidad de clase"];
    habilidad = habilidad ? firmas.find((f) => norm(f).includes(norm(habilidad!)) || norm(habilidad!).includes(norm(f))) : firmas.find((f) => !selloDe(sellos, f));
    if (!habilidad) throw new Error(`${c.p.nombre} (${c.p.clase}) no tiene esa habilidad que sellar. Sus habilidades firma: ${firmas.join(", ")}.`);
  } else {
    habilidad ??= c.tipo === "criatura" ? (c.j.definicion.habilidades[0]?.nombre ?? c.j.definicion.rasgos[0]) : undefined;
    if (!habilidad) throw new Error("Di qué poder o rasgo sella (habilidad).");
  }
  if (selloDe(sellos, habilidad)) throw new Error(`${c.nombre} ya tiene sellada su ${habilidad}.`);
  const cd = cdSello(p);
  let exito: boolean;
  let linea: string;
  if (c.tipo === "pj") {
    const s = salvacion(c.p, "car", cd);
    exito = s.exito; linea = `${c.nombre}: ${s.texto}.`;
  } else {
    const car = c.tipo === "criatura" ? Number(/CAR\s*(\d+)/i.exec(c.j.definicion.atributos)?.[1] ?? 10) : 10;
    const t = tirar(`1d20${signo(mod(car))}`);
    exito = t.total >= cd; linea = `${c.nombre}: salvación de CAR ${describir(t)} vs CD ${cd} → ${exito ? "éxito" : "fallo"}.`;
  }
  const lineas = [`${p.nombre} hunde la mano en la sangre de ${c.nombre} y reclama su alma para Neter. ${linea}`];
  if (exito) { // superó la salvación: el alma resiste
    lineas.push(`El alma de ${c.nombre} resiste: la sangre se seca sin sellar nada.`);
  } else {
    sellos.push({ habilidad, por: p.nombre });
    const valorAlma = (c.tipo === "criatura" ? c.j.definicion.peligro : c.tipo === "pj" ? Math.max(1, Math.ceil(c.p.nivel / 2)) : 1) * 2;
    (p.almas ??= []).push({ nombre: c.nombre, habilidad, valor: valorAlma } as AlmaSellada);
    lineas.push(`¡ALMA SELLADA! ${c.nombre} pierde su ${habilidad} mientras ${p.nombre} la sostenga (${p.almas.length}/${capacidadAlmas(p.nivel)}).`);
    if (c.tipo === "pj" && /furia/i.test(habilidad) && c.p.furia?.activa) lineas.push(terminarFuria(c.p, "su alma sellada la apaga"));
    if (/ataque adicional/i.test(habilidad)) lineas.push("(El Ataque adicional no lo lleva el motor: ya no ataca dos veces. Júzgalo tú.)");
  }
  lineas.push(sumarDeuda(p, 3, "sellar un alma"));
  return lineas.join("\n");
}

function sellosDe(c: Combatiente | { p: Personaje }): Sello_[] | undefined {
  return "tipo" in c ? (c.tipo === "pj" ? c.p.sellos : c.tipo === "criatura" ? c.j.sellos : c.n.sellos) : c.p.sellos;
}
type Sello_ = NonNullable<Personaje["sellos"]>[number];

export function liberarAlma(partida: Partida, d: { quien: string; nombre?: string; por?: "voluntad" | "rito" }): string {
  const p = segador(partida, d.quien);
  const lista = (p.almas ??= []).filter((a) => !d.nombre || norm(a.nombre) === norm(d.nombre));
  if (!lista.length) throw new Error(`${p.nombre} no sostiene ninguna alma${d.nombre ? ` de ${d.nombre}` : ""}.`);
  const lineas: string[] = [];
  for (const a of lista) {
    let c: Combatiente | undefined;
    try { c = localizar(partida, a.nombre); } catch { /* ya no está en escena */ }
    const sel = c ? sellosDe(c) : undefined;
    if (sel) { const i = sel.findIndex((s) => norm(s.habilidad) === norm(a.habilidad) && s.por === p.nombre && !s.permanente); if (i >= 0) sel.splice(i, 1); }
    p.almas = p.almas!.filter((x) => x !== a);
    lineas.push(`El alma de ${a.nombre} queda libre${d.por === "rito" ? " por el rito de las Hermanas" : ""}: recupera su ${a.habilidad}.`);
  }
  return lineas.join("\n");
}

/** Si un Segador muere, sus almas quedan libres. */
export function liberarSiMuere(partida: Partida): string[] {
  const out: string[] = [];
  for (const p of Object.values(partida.personajes)) {
    if (esSegador(p) && p.condiciones.includes("muerto") && p.almas?.length) {
      out.push(`${p.nombre} ha muerto: sus almas selladas quedan libres y la guadaña vuelve a los huesos de Neter.`);
      try { out.push(liberarAlma(partida, { quien: p.nombre })); } catch { /* nada */ }
    }
  }
  return out;
}

export function entregarAlmas(partida: Partida, d: { quien: string; en_tumba: boolean; nombre?: string }): string {
  const p = segador(partida, d.quien);
  if (!d.en_tumba) throw new Error("Las almas solo se entregan en una tumba de Neter (en_tumba=true).");
  const lista = (p.almas ??= []).filter((a) => !d.nombre || norm(a.nombre) === norm(d.nombre));
  if (!lista.length) throw new Error(`${p.nombre} no sostiene ninguna alma que entregar.`);
  const lineas: string[] = [];
  for (const a of lista) {
    let c: Combatiente | undefined;
    try { c = localizar(partida, a.nombre); } catch { /* ya no está en escena */ }
    const sel = c ? sellosDe(c) : undefined;
    const s = sel?.find((x) => norm(x.habilidad) === norm(a.habilidad) && x.por === p.nombre);
    if (s) s.permanente = true;
    p.almas = p.almas!.filter((x) => x !== a);
    lineas.push(`${p.nombre} entrega a Neter el alma de ${a.nombre}: su ${a.habilidad} se pierde para siempre. ${pagarDeuda(p, a.valor, `un alma sellada (${a.valor})`)}`);
  }
  return lineas.join("\n");
}

// ------------------------------------------------------------------ hablar con los muertos e invocaciones

export function hablarConMuertos(partida: Partida, d: { quien: string; objetivo: string; preguntas?: number }): string {
  const p = segador(partida, d.quien);
  vivo(p);
  const n = Math.min(3, Math.max(1, d.preguntas ?? 3));
  const gratis = (p.invocaciones ?? []).includes("Voz de los muertos") && /esp[ií]ritu|fantasma|sombra/i.test(d.objetivo);
  const coste = gratis ? "La Voz de los muertos hace que no le cueste Deuda." : sumarDeuda(p, 1, "hablar con los muertos");
  return `${p.nombre} apoya la mano en ${d.objetivo} y Neter le presta su voz: puede hacerle hasta ${n} pregunta(s); responde con lo que sabía en vida, a su modo, y no miente (pero solo sabe lo que supo). ${coste}`;
}

export function invocacion(partida: Partida, d: { quien: string; accion: "ver" | "elegir" | "usar"; nombre?: string }): string {
  const p = segador(partida, d.quien);
  const elegidas = (p.invocaciones ??= []);
  const todas = INVOCACIONES.join(", ");
  if (d.accion === "ver") return `${p.nombre}: invocaciones ${elegidas.join(", ") || "ninguna"} (elegibles: ${todas}).`;
  const nombre = INVOCACIONES.find((x) => d.nombre && (norm(x).includes(norm(d.nombre)) || norm(d.nombre).includes(norm(x))));
  if (!nombre) throw new Error(`Di cuál: ${todas}.`);
  if (d.accion === "elegir") {
    if (p.nivel < 2) throw new Error(`${p.nombre} aún no tiene invocaciones (nivel 2).`);
    const max = p.nivel >= 9 ? 4 : p.nivel >= 5 ? 3 : 2;
    if (elegidas.includes(nombre)) throw new Error(`${p.nombre} ya tiene ${nombre}.`);
    if (elegidas.length >= max) throw new Error(`${p.nombre} ya tiene sus ${max} invocaciones.`);
    elegidas.push(nombre);
    return `${p.nombre} recibe de Neter la invocación «${nombre}» (${elegidas.length}/${max}).`;
  }
  if (!elegidas.includes(nombre)) throw new Error(`${p.nombre} no tiene la invocación «${nombre}».`);
  vivo(p);
  switch (nombre) {
    case "Ojos del dios muerto": return `Los ojos de ${p.nombre} se vuelven blancos una hora: ve en la oscuridad a 18 m y sabe quién, a 18 m, está a punto de morir (el cuarto final de sus PV). ${sumarDeuda(p, 1, "los ojos del dios muerto")}`;
    case "Presencia sepulcral": return `Una hora de frío de tumba en torno a ${p.nombre}: las bestias lo evitan y quien lo mira a los ojos hace una salvación de SAB (CD ${cdSello(p)}) o queda asustado un minuto. ${sumarDeuda(p, 1, "la presencia sepulcral")}`;
    case "Voz de los muertos": return `${p.nombre} oye a los espíritus de la zona una hora y puede hablar con ellos sin gastar Deuda.`;
    default: p.pielHueso = true; return `Una piel de hueso blanco cubre a ${p.nombre} una hora (hasta el próximo descanso): +2 a la CA. ${sumarDeuda(p, 2, "la piel de hueso")}`;
  }
}

/** Hechizo lanzado por un Segador: suma su círculo a la Deuda. */
export function deudaPorHechizo(p: Personaje, circulo: number, nombre: string): string {
  if (!esSegador(p) || circulo < 1) return "";
  return sumarDeuda(p, circulo, `el hechizo ${nombre}`);
}
