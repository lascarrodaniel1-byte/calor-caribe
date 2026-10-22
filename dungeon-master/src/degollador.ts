// Degollador: asesino a sueldo. Estudia a su presa (su primer ataque contra ella tiene ventaja y furtivo), sopla dardos
// impregnados con viales por la cerbatana (la víctima los resiste con CON, como los viales), y abre puertas, ventanas,
// cerraduras y ataduras para entrar y escapar de cualquier sitio.
import type { Partida, Personaje } from "./estado.js";
import { danar } from "./bestiario.js";
import { aplicarCondicion, localizar, type DatosAtaque, type ResultadoAtaque } from "./combate.js";
import { describir, tirar } from "./dados.js";
import { CD_ACCESO_SEGURO, dardosDe, DARDOS_POR_VIAL, esDegollador, furtivoDados, MAX_DARDOS, SUSTANCIAS, totalDardos } from "./degollador_base.js";
import { resolverPrueba } from "./pruebas.js";
import { ALDESCANSAR, RECURSOS_CLASE, usarRecurso } from "./recursos.js";
import { mod, signo } from "./reglas.js";
import { usarVial, type NombreVial } from "./viales.js";

const norm = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

function degollador(partida: Partida, quien: string): Personaje {
  const p = Object.values(partida.personajes).find((x) => norm(x.nombre) === norm(quien) || (x.jugador && norm(x.jugador) === norm(quien)));
  if (!p) throw new Error(`No hay ningún personaje llamado «${quien}».`);
  if (!esDegollador(p)) throw new Error(`${p.nombre} no es un Degollador.`);
  return p;
}

/** Turno del personaje en el combate (para la acción adicional). */
function turnoDe(partida: Partida, p: Personaje): { adicional?: string } | undefined {
  if (!partida.combate) return undefined;
  partida.combate.turnos ??= {};
  const clave = Object.keys(partida.combate.turnos).find((k) => norm(k) === norm(p.nombre)) ?? p.nombre;
  return (partida.combate.turnos[clave] ??= {});
}

// ------------------------------------------------------------------ estudiar a la presa

let estudiando = false;
RECURSOS_CLASE["Degollador"] = [
  {
    nombre: "Estudiar a la presa",
    desde: 1,
    max: () => 1,
    recarga: "corto",
    efecto: (p) => {
      if (!estudiando || !p.presa) throw new Error("Estudiar a la presa se usa con estudiar_presa, diciendo a quién.");
      return `${p.nombre} estudia a ${p.presa.objetivo}: aprende su rutina, sus descuidos y por dónde entrarle. Su primer ataque contra ${p.presa.objetivo} tendrá ventaja y sumará ${furtivoDados(p.nivel)}d6 de ataque furtivo (lo aplica el programa).`;
    },
  },
];
ALDESCANSAR.push((p, tipo) => { if (tipo === "largo" && p.presa) delete p.presa; });

export function estudiarPresa(partida: Partida, d: { quien: string; objetivo: string }): string {
  const p = degollador(partida, d.quien);
  if (partida.combate) throw new Error("Estudiar a la presa lleva un rato (al menos un minuto de observación): no se hace en pleno combate.");
  if (!d.objetivo.trim()) throw new Error("Di a quién estudia.");
  const antes = p.presa;
  p.presa = { objetivo: d.objetivo.trim(), usada: false };
  estudiando = true;
  try {
    return usarRecurso(partida, { quien: p.nombre, recurso: "Estudiar a la presa" });
  } catch (e) {
    p.presa = antes;
    throw e;
  } finally {
    estudiando = false;
  }
}

/** Antes de atacar: si el objetivo es su presa estudiada, el primer ataque tiene ventaja y suma el furtivo. */
export function aplicarPresa(partida: Partida, e: DatosAtaque): { e: DatosAtaque; nota?: string; confirmar: () => void; deshacer: () => void } {
  const nada = { e, confirmar: () => {}, deshacer: () => {} };
  if (e.reaccion) return nada;
  const p = Object.values(partida.personajes).find((x) => norm(x.nombre) === norm(e.atacante));
  if (!p || !esDegollador(p) || !p.presa || p.presa.usada) return nada;
  const a = norm(p.presa.objetivo), b = norm(e.objetivo);
  if (!(a === b || a.includes(b) || b.includes(a))) return nada;
  const dados = furtivoDados(p.nivel);
  const presa = p.presa;
  presa.usada = true;
  return {
    e: { ...e, ventaja: true, dano: e.dano ? `${e.dano}+${dados}d6` : e.dano },
    nota: `🎯 Presa estudiada: ${p.nombre} golpea a ${presa.objetivo} sabiendo por dónde entrarle — ventaja${e.dano ? ` y ataque furtivo (+${dados}d6)` : ""}.`,
    confirmar: () => {},
    deshacer: () => { presa.usada = false; },
  };
}

// ------------------------------------------------------------------ dardos de la cerbatana

export function dardos(partida: Partida, d: { quien: string; accion: "ver" | "impregnar" | "reponer"; sustancia?: string; cantidad?: number; usa_accion?: boolean }): string {
  const p = degollador(partida, d.quien);
  const D = dardosDe(p);
  const resumen = () => `${p.nombre}: ${D.sanos} dardo(s) sano(s)${D.impregnados.filter((x) => x.n > 0).map((x) => `, ${x.n} con ${x.sustancia}`).join("")}.`;
  if (d.accion === "ver") return resumen();
  if (d.accion === "reponer") {
    const n = Math.max(1, d.cantidad ?? 10);
    if (totalDardos(D) + n > MAX_DARDOS) throw new Error(`No le caben tantos dardos: lleva ${totalDardos(D)} y el máximo es ${MAX_DARDOS}.`);
    D.sanos += n;
    return `${p.nombre} repone ${n} dardo(s). ${resumen()}`;
  }
  if (!d.sustancia) throw new Error(`Di con qué sustancia: ${SUSTANCIAS.join(" o ")}.`);
  const sus = SUSTANCIAS.find((s) => norm(s).includes(norm(d.sustancia!)) || norm(d.sustancia!).includes(norm(s)));
  if (!sus) throw new Error(`«${d.sustancia}» no sirve para impregnar dardos: solo ${SUSTANCIAS.join(" y ")}.`);
  const i = p.inventario.findIndex((x) => norm(x).includes(norm(sus)));
  if (i < 0) throw new Error(`${p.nombre} no lleva ${sus} en el inventario.`);
  if (D.sanos < 1) throw new Error(`${p.nombre} no tiene dardos sanos que impregnar.`);
  if (partida.combate && !d.usa_accion) throw new Error("Impregnar dardos en pleno combate cuesta una acción: confírmalo con usa_accion=true.");
  const n = Math.min(DARDOS_POR_VIAL, D.sanos);
  p.inventario.splice(i, 1);
  D.sanos -= n;
  const ya = D.impregnados.find((x) => x.sustancia === sus);
  if (ya) ya.n += n; else D.impregnados.push({ sustancia: sus, n });
  return `${p.nombre} impregna ${n} dardo(s) con ${sus} (el vial se gasta${partida.combate ? "; gasta su acción" : ""}). ${resumen()}`;
}

/** Antes de soplar: que haya cerbatana en la mano y dardos. Devuelve qué dardo saldrá. */
export function prepararSoplo(partida: Partida, e: DatosAtaque): { e: DatosAtaque; dardo: "sano" | "impregnado"; sustancia?: string } | null {
  const p = Object.values(partida.personajes).find((x) => norm(x.nombre) === norm(e.atacante));
  if (!p) return null; // un PNJ o una criatura: sin cuenta de dardos
  const m = p.manos;
  if (m && !/cerbatana/i.test(`${m.principal ?? ""} ${m.secundaria ?? ""}`)) throw new Error(`${p.nombre} no empuña la cerbatana: lleva ${m.principal ?? "nada"}${m.secundaria ? ` y ${m.secundaria}` : ""}. Usa empuñar antes.`);
  const D = dardosDe(p);
  if (totalDardos(D) < 1) throw new Error(`${p.nombre} no tiene dardos para la cerbatana.`);
  const imp = D.impregnados.find((x) => x.n > 0);
  const dardo = e.dardo ?? (imp ? "impregnado" : "sano");
  if (dardo === "impregnado" && !imp) throw new Error(`${p.nombre} no tiene dardos impregnados.`);
  if (dardo === "sano" && D.sanos < 1) throw new Error(`${p.nombre} solo tiene dardos impregnados: indica dardo: impregnado.`);
  return { e: { ...e, a_distancia: true, dano: e.dano ?? "1", atributo: e.atributo ?? "des" }, dardo, sustancia: dardo === "impregnado" ? imp!.sustancia : undefined };
}

const INMUNES = /no-muerto|no muerto|ghul|espectro|vampiro|aut[oó]mata|constructo/i;

/** Efecto de la sustancia sobre quien recibe el dardo: salvación de CON, igual que con los viales. */
function efectoSustancia(partida: Partida, objetivo: string, sustancia: string): { texto: string; muerto?: string } {
  const c = localizar(partida, objetivo);
  if (c.tipo === "pj") {
    return { texto: `${c.p.nombre} recibe el dardo con ${sustancia}:\n${usarVial({ vial: sustancia as NombreVial, receptor: c.p, via: "arma", dosis: 1 })}` };
  }
  const naturaleza = c.tipo === "criatura" ? `${c.j.definicion.temple ?? ""} ${c.j.definicion.nombre} ${c.j.definicion.descripcion}` : c.n.temple ?? "";
  if (INMUNES.test(naturaleza)) return { texto: `${c.nombre} recibe el dardo con ${sustancia}, pero su naturaleza no siente venenos ni sueños: sin efecto.` };
  const con = c.tipo === "criatura" ? Number(/CON\s*(\d+)/i.exec(c.j.definicion.atributos)?.[1] ?? 10) : 10;
  const hiel = sustancia === "Hiel de Víbora Gris";
  const cd = hiel ? 13 : 12;
  const t = tirar(`1d20${signo(mod(con))}`);
  const exito = t.total >= cd;
  const margen = t.total - cd;
  const lineas = [`${c.nombre} recibe el dardo con ${sustancia}: salvación de CON ${describir(t)} vs CD ${cd} → ${exito ? "éxito" : "fallo"}.`];
  let muerto: string | undefined;
  if (hiel) {
    const dano = tirar("4d6").total;
    const final = exito ? Math.floor(dano / 2) : dano;
    const ef = [`${final} de daño de veneno`];
    if (c.tipo === "criatura") { danar(c.j, final); if (c.j.pv <= 0) muerto = c.j.nombre; }
    else if (c.n.pv !== undefined) c.n.pv = Math.max(0, c.n.pv - final);
    if (!exito) { aplicarCondicion(partida, { objetivo: c.nombre, accion: "aplicar", condicion: "envenenado (1 hora)" }); ef.push("envenenado 1 hora"); }
    if (!exito && margen <= -5) { aplicarCondicion(partida, { objetivo: c.nombre, accion: "aplicar", condicion: "paralizado (1 minuto)" }); ef.push("paralizado 1 minuto"); }
    lineas.push(`Hiel de Víbora Gris: ${ef.join("; ")}.`);
  } else if (exito) lineas.push("Leche de Amapola Negra: se resiste; queda adormilado (desventaja en pruebas de SAB 1 hora).");
  else {
    aplicarCondicion(partida, { objetivo: c.nombre, accion: "aplicar", condicion: "dormido (1d4 horas; despierta si lo hieren o lo sacuden)" });
    lineas.push(`Leche de Amapola Negra: cae dormido ${tirar("1d4").total} hora(s); despierta si lo hieren o lo sacuden con fuerza.`);
  }
  return { texto: lineas.join("\n"), muerto };
}

/** Tras soplar: gasta el dardo y, si era impregnado y llegó a la carne, aplica la sustancia. */
export function resolverSoplo(partida: Partida, e: DatosAtaque, r: ResultadoAtaque, previo: { dardo: "sano" | "impregnado"; sustancia?: string }): { texto: string; muerto?: string } {
  const p = Object.values(partida.personajes).find((x) => norm(x.nombre) === norm(e.atacante))!;
  const D = dardosDe(p);
  if (previo.dardo === "sano") { D.sanos--; return { texto: "" }; }
  const x = D.impregnados.find((s) => s.sustancia === previo.sustancia)!;
  x.n--;
  D.impregnados = D.impregnados.filter((s) => s.n > 0);
  if ((r.resultado === "impacto" || r.resultado === "critico") && (r.dano ?? 0) > 0) {
    const ef = efectoSustancia(partida, e.objetivo, previo.sustancia!);
    return { texto: `🧪 ${ef.texto}`, muerto: ef.muerto };
  }
  const motivo = r.resultado === "impacto" || r.resultado === "critico" ? "la armadura frena el dardo antes de llegar a la carne" : "el dardo no da en el blanco";
  return { texto: `🧪 El dardo con ${previo.sustancia} se pierde: ${motivo}; la sustancia no hace efecto.` };
}

// ------------------------------------------------------------------ entrar y salir

const OBSTACULOS = {
  ventana: { cd: 10, herramientas: false, nombre: "una ventana" },
  puerta_atrancada: { cd: 12, herramientas: false, nombre: "una puerta atrancada" },
  cerradura_simple: { cd: 10, herramientas: true, nombre: "una cerradura sencilla" },
  cerradura_buena: { cd: 15, herramientas: true, nombre: "una buena cerradura" },
  cerradura_maestra: { cd: 20, herramientas: true, nombre: "una cerradura maestra" },
  reja: { cd: 15, herramientas: true, nombre: "una reja" },
  ataduras: { cd: 12, herramientas: false, nombre: "unas ataduras" },
  cadenas: { cd: 15, herramientas: true, nombre: "unas cadenas" },
} as const;
export const NOMBRES_OBSTACULOS = Object.keys(OBSTACULOS) as [keyof typeof OBSTACULOS, ...(keyof typeof OBSTACULOS)[]];

export function forzarAcceso(partida: Partida, d: { quien: string; obstaculo: keyof typeof OBSTACULOS; cd?: number; sellado_magico?: boolean }): string {
  const p = degollador(partida, d.quien);
  if (p.condiciones.includes("muerto") || p.pv <= 0) throw new Error(`${p.nombre} no está en condiciones de forzar nada.`);
  const o = OBSTACULOS[d.obstaculo];
  if (d.sellado_magico) throw new Error(`${o.nombre[0].toUpperCase() + o.nombre.slice(1)} está sellado por magia: ni la maña ni las ganzúas lo abren.`);
  if (o.herramientas && !p.inventario.some((x) => /herramientas? de ladr[oó]n|ganz[uú]a/i.test(x))) throw new Error(`${p.nombre} necesita sus herramientas de ladrón para ${o.nombre}.`);
  const cd = d.cd ?? o.cd;
  const lineas: string[] = [];
  // En combate: la acción; desde el nivel 2, acción adicional (Acción astuta).
  const t = turnoDe(partida, p);
  if (t) {
    if (p.nivel >= 2) {
      if (t.adicional) throw new Error(`${p.nombre} ya usó su acción adicional este asalto (${t.adicional}).`);
      t.adicional = "forzar un acceso";
      lineas.push("Lo hace como acción adicional.");
    } else lineas.push("En combate gasta su acción.");
  }
  let exito: boolean;
  if (p.nivel >= 3 && cd <= CD_ACCESO_SEGURO) {
    exito = true;
    lineas.push(`Entrar y salir: con su oficio, ${o.nombre} (CD ${cd}) no se le resiste; no hace falta tirar.`);
  } else {
    const r = resolverPrueba(partida, { quien: p.nombre, habilidad: "juego_de_manos", cd, ventaja: true, motivo: `forzar ${o.nombre} (Entrar y salir: ventaja)` });
    exito = r.exito;
    lineas.push(r.texto);
  }
  if (exito) {
    if (d.obstaculo === "ataduras" || d.obstaculo === "cadenas") {
      try { aplicarCondicion(partida, { objetivo: p.nombre, accion: "quitar", condicion: "retenido" }); } catch { /* sin condición que quitar */ }
      lineas.push(`${p.nombre} se libera de ${o.nombre}.`);
    } else lineas.push(`${p.nombre} abre ${o.nombre} sin ruido: puede entrar o salir.`);
  } else lineas.push(`${o.nombre[0].toUpperCase() + o.nombre.slice(1)} no cede. Puede reintentarlo (cada intento lleva cerca de un minuto y se puede oír).`);
  return lineas.join("\n");
}
