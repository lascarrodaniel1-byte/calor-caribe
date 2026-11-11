// Simulador de equilibrio de combate (Monte Carlo) de Mesa de Velmora.
//
// Usa el MOTOR REAL: todo pasa por `ejecutar(nombre, entrada, partida)` de src/herramientas.ts (guardar_personaje, empunar,
// aparecer_criatura, iniciativa, plano, atacar, siguiente_asalto, agua, arte_marcial). No cambia ninguna regla ni dato del juego.
//
// Uso:
//   npx tsx tests/balance/simular.ts [--n 60] [--semilla 1] [--rapido] [--detalle] [--comparar] [--solo-primero] [--json ruta]
//     --n N          combates por celda (60 por defecto; --rapido lo deja en 20 salvo que se indique --n)
//     --semilla S    semilla del generador (1 por defecto). Misma semilla => mismos resultados.
//     --rapido       menos combates por celda y menos criaturas en el detalle
//     --detalle      además, tabla por criatura (solo contra 1 criatura) y nivel
//     --comparar     las dos comparaciones: artes marciales con/sin estilo y agua vs tierra (con/sin Tritón)
//     --solo-comparar  solo las comparaciones (sin la tabla principal)
//     --criatura TXT   solo el detalle de las criaturas cuyo nombre contenga TXT (usa --n-detalle para el nº de combates)
//     --solo-primero las criaturas atacan una sola vez con su PRIMER ataque (versión estricta); por defecto usan su acción de Atacar
//                    completa (la línea con «(xN)» N veces, o el primer ataque una vez)
//     --niveles 1,5,9,13   niveles del grupo
//     --json ruta    vuelca los resultados en JSON
//   Depuración: BALANCE_DEBUG=1 (rechazos y combates sin final) · BALANCE_TRACE=1 (cada ataque, resumido)
//
// Determinismo: los dados del motor salen de crypto.getRandomValues (src/dados.ts); aquí se sustituye por un PRNG mulberry32
// sembrado POR COMBATE con hash(semilla, id de celda, nº de combate), así cada combate es reproducible por sí solo.
//
// LIMITACIONES (el simulador es deliberadamente simple; ver docs/BALANCE.md):
//  - Nadie lanza hechizos ni usa habilidades especiales (ni PJ ni criaturas: aliento, canto de sirena, regeneración manual,
//    habilidad_criatura, presagios, guaridas…). Los Hechiceros pelean con su bastón: son un lastre.
//  - Nadie usa maniobras (agarrar, empujar…), ni furia explícita, ni curación, ni descansos, ni objetos, ni Segundo aliento.
//  - Política fija: se coloca (teletransporte en el plano) junto al enemigo más cercano y ataca al de menos PV al alcance.
//  - Sin aproximación, sin ataques de oportunidad, sin cobertura, sin sorpresa, sin terreno.
//  - Un PJ a 0 PV queda fuera (no se tiran salvaciones contra la muerte ni lo estabilizan).
//  - Sin objetos mágicos ni mejoras de equipo por nivel: la CA de los PJ es fija por clase (tabla CA_CLASE).
import { nuevaPartida, normalizarPartida, type Partida, type Personaje } from "../../src/estado.ts";
import { ejecutar, type Resultado } from "../../src/herramientas.ts";
import { BESTIARIO, type Criatura } from "../../src/bestiario.ts";
import { CLASES, RAZAS, clase as buscarClase } from "../../src/mundo.ts";
import { ESTILOS } from "../../src/estilos.ts";
import { ataquesPorAccion } from "../../src/rasgos.ts";
import { rumbo } from "../../src/espacio.ts";
import { DIRECCIONES } from "../../src/mapa.ts";
import { mod } from "../../src/reglas.ts";
import { writeFileSync } from "node:fs";

// ------------------------------------------------------------------ argumentos
const argv = process.argv.slice(2);
const flag = (n: string) => argv.includes(`--${n}`);
const opt = (n: string, def: string) => { const i = argv.indexOf(`--${n}`); return i >= 0 && argv[i + 1] ? argv[i + 1] : def; };
const RAPIDO = flag("rapido");
const N = Number(opt("n", RAPIDO ? "20" : "60"));
const SEMILLA = Number(opt("semilla", "1"));
const SOLO_PRIMERO = flag("solo-primero");
const NIVELES = opt("niveles", "1,5,9,13").split(",").map(Number);
const MAX_ASALTOS = 20;

// ------------------------------------------------------------------ PRNG con semilla
let estado = 1;
const mulberry = (): number => { estado = (estado + 0x6d2b79f5) | 0; let t = Math.imul(estado ^ (estado >>> 15), 1 | estado); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return (t ^ (t >>> 14)) >>> 0; };
(globalThis.crypto as unknown as { getRandomValues: (b: Uint32Array) => Uint32Array }).getRandomValues = (b: Uint32Array) => { b[0] = mulberry(); return b; };
const hash = (s: string): number => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const sembrar = (id: string) => { estado = (hash(`${SEMILLA}|${id}`) || 1) | 0; };
const azar = () => mulberry() / 0x100000000;

// ------------------------------------------------------------------ grupos de PJ
type Atr = "fue" | "des" | "con" | "int" | "sab" | "car";
interface Plantilla {
  clase: string;
  serie: Record<Atr, number>; // serie estándar 15,14,13,12,10,8 repartida según la clase
  principal: Atr; // donde van los aumentos de característica
  ca: number;
  inventario: string[];
  principalArma: string;
  secundaria?: string;
  dosManos?: boolean;
  dado: string; // dado de daño del arma principal
  dosArmas?: boolean; // ataca también con la mano secundaria (arma ligera)
  dadoSec?: string;
}
const PLANTILLAS: Record<string, Plantilla> = {
  "Mercenario del Cuervo": { clase: "Mercenario del Cuervo", serie: { fue: 15, con: 14, des: 13, sab: 12, int: 10, car: 8 }, principal: "fue", ca: 18, inventario: ["Cota de mallas", "Espada larga", "Escudo"], principalArma: "Espada larga", secundaria: "Escudo", dado: "1d8" },
  "Caballero Juramentado": { clase: "Caballero Juramentado", serie: { fue: 15, car: 14, con: 13, des: 12, sab: 10, int: 8 }, principal: "fue", ca: 18, inventario: ["Armadura de escamas", "Espada larga", "Escudo"], principalArma: "Espada larga", secundaria: "Escudo", dado: "1d8" },
  "Berserker de Ceniza": { clase: "Berserker de Ceniza", serie: { fue: 15, con: 14, des: 13, sab: 12, int: 10, car: 8 }, principal: "fue", ca: 14, inventario: ["Pieles", "Hacha a dos manos"], principalArma: "Hacha a dos manos", dosManos: true, dado: "1d12" },
  "Cazador de Brujas": { clase: "Cazador de Brujas", serie: { des: 15, sab: 14, con: 13, fue: 12, int: 10, car: 8 }, principal: "des", ca: 15, inventario: ["Cuero tachonado", "Shotel", "Shotel curvo"], principalArma: "Shotel", secundaria: "Shotel curvo", dado: "1d6", dosArmas: true, dadoSec: "1d6" },
  "Degollador": { clase: "Degollador", serie: { des: 15, con: 14, int: 13, sab: 12, fue: 10, car: 8 }, principal: "des", ca: 15, inventario: ["Armadura de cuero", "Daga", "Cuchillo"], principalArma: "Daga", secundaria: "Cuchillo", dado: "1d4", dosArmas: true, dadoSec: "1d4" },
  "Flagelante": { clase: "Flagelante", serie: { des: 15, sab: 14, con: 13, fue: 12, int: 10, car: 8 }, principal: "des", ca: 14, inventario: ["Maza", "Hábito raído"], principalArma: "Maza", dado: "1d6" },
  "Hechicero": { clase: "Hechicero", serie: { int: 15, con: 14, des: 13, sab: 12, car: 10, fue: 8 }, principal: "des", ca: 12, inventario: ["Bastón", "Daga", "Ropa de viaje"], principalArma: "Bastón", dado: "1d6" },
};
// Composiciones variadas de 4 (se rotan por nº de combate).
const COMPOSICIONES: string[][] = [
  ["Mercenario del Cuervo", "Caballero Juramentado", "Cazador de Brujas", "Hechicero"],
  ["Berserker de Ceniza", "Flagelante", "Degollador", "Mercenario del Cuervo"],
  ["Caballero Juramentado", "Berserker de Ceniza", "Cazador de Brujas", "Degollador"],
  ["Mercenario del Cuervo", "Flagelante", "Hechicero", "Cazador de Brujas"],
  ["Berserker de Ceniza", "Caballero Juramentado", "Flagelante", "Degollador"],
];
const RAZAS_TIERRA = RAZAS.filter((r) => r.nombre !== "Tritón de las Mareas").map((r) => r.nombre);

function bonosRaza(nombreRaza: string): Partial<Record<Atr, number>> {
  const t = RAZAS.find((r) => r.nombre === nombreRaza)?.atributos ?? "";
  if (/todos los atributos/.test(t)) return { fue: 1, des: 1, con: 1, int: 1, sab: 1, car: 1 };
  const out: Partial<Record<Atr, number>> = {};
  for (const m of t.matchAll(/\+(\d)\s+(FUE|DES|CON|INT|SAB|CAR)/g)) out[m[2].toLowerCase() as Atr] = Number(m[1]);
  return out;
}
const dadoGolpeDe = (c: string) => buscarClase(c)?.dadoGolpe ?? 8;
function pvMax(c: string, nivel: number, con: number): number {
  const d = dadoGolpeDe(c), m = mod(con);
  return Math.max(1, d + m + (nivel - 1) * (Math.floor(d / 2) + 1 + m));
}

interface OpcionesGrupo { nivel: number; indice: number; razas?: string[]; composicion?: string[] }
interface Escena { p: Partida; E: (n: string, d: object) => Resultado; pjs: string[]; plantillas: Record<string, Plantilla> }
const errores: Record<string, number> = {}; // errores de integración agrupados
const anotar = (clave: string) => { errores[clave] = (errores[clave] ?? 0) + 1; };

function montarGrupo(o: OpcionesGrupo): Escena {
  const p = nuevaPartida(); normalizarPartida(p);
  const E = (n: string, d: object): Resultado => { try { return ejecutar(n, d, p); } catch (e) { anotar(`EXCEPCION en ${n}: ${String((e as Error).message).slice(0, 80)}`); return { contenido: String((e as Error).message), aviso: null, error: true }; } };
  const comp = o.composicion ?? COMPOSICIONES[o.indice % COMPOSICIONES.length];
  const pjs: string[] = [], plantillas: Record<string, Plantilla> = {};
  comp.forEach((cl, j) => {
    const t = PLANTILLAS[cl];
    const raza = o.razas?.[j] ?? RAZAS_TIERRA[(o.indice * 3 + j * 2) % RAZAS_TIERRA.length];
    const atr = { ...t.serie } as Record<Atr, number>;
    for (const [k, v] of Object.entries(bonosRaza(raza))) atr[k as Atr] += v as number;
    // Aumentos de característica de los niveles 4, 8, 12 (+2 al principal hasta 20; el resto a CON).
    for (const n of [4, 8, 12, 16, 19]) if (o.nivel >= n) { const k: Atr = atr[t.principal] <= 18 ? t.principal : "con"; atr[k] = Math.min(20, atr[k] + 2); }
    const nombre = `${cl.split(" ")[0]}${j + 1}`;
    const extra: Record<string, unknown> = {};
    if (cl === "Hechicero") { extra.tipos_magia = ["fuego"]; extra.linaje = "noble"; }
    if (raza === "Humano del Faro") extra.dote = "Terco";
    const r = E("guardar_personaje", { don_arcano: false, nombre, jugador: nombre, genero: "Femenino", raza, clase: cl, nivel: o.nivel, pv_max: pvMax(cl, o.nivel, atr.con), ca: t.ca, atributos: atr, inventario: t.inventario, ...extra });
    if (r.error) anotar(`guardar_personaje rechazado (${cl}/${raza}): ${r.contenido.slice(0, 80)}`);
    const e = E("empunar", t.dosManos ? { quien: nombre, principal: t.principalArma, a_dos_manos: true } : { quien: nombre, principal: t.principalArma, ...(t.secundaria ? { secundaria: t.secundaria } : {}) });
    if (e.error) anotar(`empunar rechazado (${cl}): ${e.contenido.slice(0, 80)}`);
    pjs.push(nombre); plantillas[nombre] = t;
  });
  return { p, E, pjs, plantillas };
}

// ------------------------------------------------------------------ criaturas: parseo del ataque
interface AtaqueCr { arma: string; dano: string; tipo?: string; veces: number }
const TIPOS: Record<string, string> = { cortante: "corte", perforante: "punta", contundente: "contundente" };
function parsearAtaque(c: Criatura): AtaqueCr {
  const lineas = c.ataques.filter((l) => /:\s*\+\d+/.test(l) && !/arrojadiz|a distancia|\d+\/\d+ m|si tiene|objetivo apresado|solo si/i.test(l));
  const multi = SOLO_PRIMERO ? undefined : lineas.find((l) => /\(x\d/i.test(l));
  const linea = multi ?? lineas[0] ?? c.ataques[0] ?? "";
  const veces = multi ? Number(/\(x(\d+)/i.exec(multi)![1]) : 1;
  const arma = (/^([^:(]+)/.exec(linea)?.[1] ?? "").trim();
  const resto = linea.slice(linea.indexOf(",") + 1).split(";")[0];
  const trozos = [...resto.matchAll(/(\d*d\d+)(\s*[+-]\s*\d+)?/g)].map((m) => `${m[1]}${(m[2] ?? "").replace(/\s+/g, "")}`);
  const dano = trozos.length ? trozos.join("+") : "1d6+2";
  const tipo = Object.keys(TIPOS).find((k) => resto.includes(k));
  return { arma: arma || "ataque", dano, tipo: tipo ? TIPOS[tipo] : undefined, veces };
}

// ------------------------------------------------------------------ combate
export interface Resultado1 {
  victoria: boolean; derrota: boolean; empate: boolean; asaltos: number; pjCaidos: number; pjMuertos: number; pjTotal: number;
  pvRestantes: number; pvTotal: number; rechazadas: number; acciones: number; anomalias: string[];
}
/** Activo = vivo, con PV y consciente. (Un Terco que cae a 0 por una herida queda con 1 PV pero «inconsciente»: el motor no lo deja actuar; ver docs/BALANCE.md.) */
const vivoPJ = (p: Personaje) => !p.condiciones.includes("muerto") && p.pv > 0 && !p.condiciones.includes("inconsciente");

function posicionar(sc: Escena, enemigos: string[], metros = 10) {
  const { E, pjs } = sc;
  E("plano", { escena: "arena", poner: [{ nombre: pjs[0] }] });
  const rel: [string, string, string][] = [[pjs[1], pjs[0], "E"], [pjs[2], pjs[0], "S"], [pjs[3], pjs[1], "S"]];
  E("plano", { poner: rel.map(([n, ref, dir]) => ({ nombre: n, ref, direccion: dir, metros: 1.5 })) });
  E("plano", { poner: enemigos.map((n, i) => ({ nombre: n, ref: i === 0 ? pjs[0] : enemigos[i - 1], direccion: i === 0 ? "N" : "E", metros: i === 0 ? metros : 2 })) });
}

function simularCombate(sc: Escena, defs: { nombre: string; def: Criatura }[], opciones: { agua?: "entrar" | "sumergir"; alIniciar?: (sc: Escena) => void } = {}): Resultado1 {
  const { p, E, pjs } = sc;
  const nombres = defs.map((d) => d.nombre);
  const ataques: Record<string, AtaqueCr> = {};
  for (const d of defs) {
    const r = E("aparecer_criatura", { nombre: d.nombre, plantilla: d.def.nombre, repetir: true });
    if (r.error) anotar(`aparecer_criatura rechazado (${d.def.nombre}): ${r.contenido.slice(0, 80)}`);
    ataques[d.nombre] = parsearAtaque(d.def);
  }
  opciones.alIniciar?.(sc);
  const ini = E("iniciativa", { participantes: [...pjs, ...nombres] });
  if (ini.error) anotar(`iniciativa rechazada: ${ini.contenido.slice(0, 80)}`);
  posicionar(sc, nombres);
  if (opciones.agua) { const r = E("agua", { accion: opciones.agua, quienes: [...pjs, ...nombres] }); if (r.error) anotar(`agua rechazada: ${r.contenido.slice(0, 80)}`); }

  let rechazadas = 0, acciones = 0;
  const anomalias: string[] = [];
  const pos = (n: string) => p.plano?.puntos[n];
  const dist = (a: string, b: string) => { const x = pos(a), y = pos(b); return x && y ? Math.hypot(x.x - y.x, x.y - y.y) : Infinity; };
  const vivosEnem = () => nombres.filter((n) => (p.jefes[n]?.pv ?? 0) > 0);
  const vivosPJ = () => pjs.filter((n) => vivoPJ(p.personajes[n]));
  const pvDe = (n: string) => (p.personajes[n] ? p.personajes[n].pv : p.jefes[n]?.pv ?? 0);
  const fin = () => !vivosEnem().length || !vivosPJ().length;
  const llamar = (nombre: string, datos: object): Resultado => {
    acciones++;
    const r = E(nombre, datos);
    if (process.env.BALANCE_TRACE) console.log(`  [${nombre}] ${r.contenido.split("\n").filter((l) => /^→|^Daño|−.*PV|^[A-Za-zÁ-ú0-9 ]+ ataca|Torpeza|ventaja|desventaja/.test(l)).join(" | ").slice(0, 260)}`);
    if (r.error && process.env.BALANCE_DEBUG) console.log("RECHAZO", nombre, JSON.stringify(datos), r.contenido.slice(0, 200));
    if (r.error) { rechazadas++; anotar(`${nombre} rechazado: ${r.contenido.replace(/\s+/g, " ").replace(/\d+(\.\d+)?/g, "#").slice(0, 90)}`); }
    return r;
  };
  /** Se coloca junto al rival más cercano y devuelve los rivales al alcance (≤ 2 m), el de menos PV primero. */
  const acercarse = (yo: string, rivales: string[]): string[] => {
    if (!rivales.length) return [];
    let cerca = rivales.slice().sort((a, b) => dist(yo, a) - dist(yo, b))[0];
    if (dist(yo, cerca) > 1.9) {
      const rb = pos(cerca) && pos(yo) ? rumbo(pos(cerca)!, pos(yo)!) : { dir: DIRECCIONES[0] };
      E("plano", { poner: [{ nombre: yo, ref: cerca, direccion: rb.dir, metros: 1.5 }] });
    }
    return rivales.filter((r) => dist(yo, r) <= 2).sort((a, b) => pvDe(a) - pvDe(b));
  };
  const contragolpes = (txt: string) => {
    for (const m of txt.matchAll(/atacar \{atacante: «([^»]+)», objetivo: «([^»]+)», reaccion: true/g)) {
      const [, quien, contra] = m;
      if (!p.personajes[quien] || !vivoPJ(p.personajes[quien]) || (p.jefes[contra]?.pv ?? 0) <= 0) continue;
      const t = sc.plantillas[quien];
      const am = Math.max(mod(p.personajes[quien].atributos.fue), mod(p.personajes[quien].atributos.des));
      llamar("atacar", { atacante: quien, objetivo: contra, arma: t.principalArma, dano: `${t.dado}${am >= 0 ? "+" : ""}${am}`, reaccion: true });
    }
  };

  const turnoPJ = (n: string) => {
    const pj = p.personajes[n], t = sc.plantillas[n];
    if (!vivoPJ(pj)) return;
    const am = Math.max(mod(pj.atributos.fue), mod(pj.atributos.des)); // el motor ataca con el mayor de FUE o DES
    const dano = `${t.dado}${am >= 0 ? "+" : ""}${am}`;
    const veces = ataquesPorAccion(pj);
    let ultimo: string | undefined;
    for (let k = 0; k < veces && !fin(); k++) {
      const alcance = acercarse(n, vivosEnem());
      if (!alcance.length) break;
      ultimo = alcance[0];
      let r = llamar("atacar", { atacante: n, objetivo: ultimo, arma: t.principalArma, dano });
      if (r.error && /no empu/i.test(r.contenido)) { E("empunar", { quien: n, principal: t.principalArma, ...(t.dosManos ? { a_dos_manos: true } : t.secundaria ? { secundaria: t.secundaria } : {}) }); r = llamar("atacar", { atacante: n, objetivo: ultimo, arma: t.principalArma, dano }); }
      if (r.error) break;
      contragolpes(r.contenido);
    }
    if (t.dosArmas && ultimo && (p.jefes[ultimo]?.pv ?? 0) > 0 && vivoPJ(pj) && !fin()) {
      const r = llamar("atacar", { atacante: n, objetivo: ultimo, mano_secundaria: true, dano: `${t.dadoSec}${am >= 0 ? "+" : ""}${am}` });
      if (!r.error) contragolpes(r.contenido);
    }
  };
  const turnoCriatura = (n: string) => {
    const j = p.jefes[n];
    if (!j || j.pv <= 0) return;
    const a = ataques[n];
    for (let k = 0; k < a.veces && !fin(); k++) {
      const alcance = acercarse(n, vivosPJ());
      if (!alcance.length) break;
      const r = llamar("atacar", { atacante: n, objetivo: alcance[0], arma: a.arma, dano: a.dano, ...(a.tipo ? { tipo_dano: a.tipo } : {}) });
      if (r.error) break;
      contragolpes(r.contenido);
    }
  };

  let asaltos = 0;
  for (let ronda = 1; ronda <= MAX_ASALTOS && !fin(); ronda++) {
    asaltos = ronda;
    if (ronda > 1) { const r = llamar("siguiente_asalto", {}); void r; }
    const orden = (p.combate?.orden ?? []).map((o) => o.nombre);
    if (!orden.length) { anomalias.push("sin orden de iniciativa"); break; }
    for (const n of orden) {
      if (fin()) break;
      if (p.personajes[n]) turnoPJ(n); else turnoCriatura(n);
    }
  }
  // Invariantes: nada de NaN ni PV imposibles.
  for (const n of pjs) { const q = p.personajes[n]; if (!Number.isFinite(q.pv) || q.pv > q.pv_max) anomalias.push(`PV imposibles en ${n}: ${q.pv}/${q.pv_max}`); }
  for (const n of nombres) { const j = p.jefes[n]; if (j && (!Number.isFinite(j.pv) || j.pv < 0 || j.pv > j.pv_max)) anomalias.push(`PV imposibles en ${n}: ${j.pv}/${j.pv_max}`); }
  for (const n of pjs) { const q = p.personajes[n]; if (q.pv > 0 && q.condiciones.includes("inconsciente") && !q.condiciones.includes("muerto")) anotar("MOTOR: PJ con PV>0 pero «inconsciente» (Terco que cae a 0 por una herida: no puede actuar)"); }
  const caidos = pjs.filter((n) => !vivoPJ(p.personajes[n])).length;
  const muertos = pjs.filter((n) => p.personajes[n].condiciones.includes("muerto")).length;
  const victoria = !vivosEnem().length && vivosPJ().length > 0;
  const derrota = !vivosPJ().length;
  if (!victoria && !derrota && asaltos >= MAX_ASALTOS && !fin()) {
    anomalias.push("el combate no termina en 20 asaltos");
    if (process.env.BALANCE_DEBUG) console.log("TIMEOUT", pjs.map((n) => `${n}:${p.personajes[n].pv}/${p.personajes[n].pv_max}[${p.personajes[n].condiciones}]`).join(" "), "|", nombres.map((n) => `${n}:${p.jefes[n]?.pv}/${p.jefes[n]?.pv_max}[${p.jefes[n]?.condiciones}]`).join(" "));
  }
  return {
    victoria, derrota, empate: !victoria && !derrota, asaltos, pjCaidos: caidos, pjMuertos: muertos, pjTotal: pjs.length,
    pvRestantes: pjs.reduce((s, n) => s + Math.max(0, p.personajes[n].pv), 0), pvTotal: pjs.reduce((s, n) => s + p.personajes[n].pv_max, 0),
    rechazadas, acciones, anomalias,
  };
}

// ------------------------------------------------------------------ celdas
export interface Celda {
  id: string; etiqueta: string; n: number; victorias: number; derrotas: number; empates: number; asaltos: number; caidos: number; muertos: number; pjs: number;
  pvFrac: number; pvFracVictorias: number; rechazadas: number; acciones: number; anomalias: string[];
}
function agregar(id: string, etiqueta: string, rs: Resultado1[]): Celda {
  const n = rs.length, vic = rs.filter((r) => r.victoria);
  const sum = (f: (r: Resultado1) => number, a = rs) => a.reduce((s, r) => s + f(r), 0);
  return {
    id, etiqueta, n, victorias: vic.length, derrotas: sum((r) => (r.derrota ? 1 : 0)), empates: sum((r) => (r.empate ? 1 : 0)),
    asaltos: sum((r) => r.asaltos) / n, caidos: sum((r) => r.pjCaidos), muertos: sum((r) => r.pjMuertos), pjs: sum((r) => r.pjTotal),
    pvFrac: sum((r) => r.pvRestantes / r.pvTotal) / n, pvFracVictorias: vic.length ? sum((r) => r.pvRestantes / r.pvTotal, vic) / vic.length : NaN,
    rechazadas: sum((r) => r.rechazadas), acciones: sum((r) => r.acciones), anomalias: [...new Set(rs.flatMap((r) => r.anomalias))],
  };
}
const semaforo = (v: number) => (v < 0.2 ? "🔴" : v < 0.4 || v > 0.95 ? "🟡" : "🟢");
const pct = (x: number) => `${(x * 100).toFixed(0)}%`;

const MONSTRUOS = BESTIARIO.filter((c) => c.categoria !== "jefe");
const JEFES = BESTIARIO.filter((c) => c.categoria === "jefe");
const POR_PELIGRO = (n: number) => MONSTRUOS.filter((c) => c.peligro === n);
const TRIO_POOL = BESTIARIO.filter((c) => c.categoria !== "jefe" && c.peligro <= 2);

interface Encuentro { id: string; etiqueta: string; elegir: (i: number) => Criatura[] }
const ENCUENTROS: Encuentro[] = [
  ...[1, 2, 3, 4, 5].map((pl): Encuentro => ({ id: `solo-p${pl}`, etiqueta: `1 criatura, peligro ${pl}`, elegir: (i) => [POR_PELIGRO(pl)[i % POR_PELIGRO(pl).length]] })),
  { id: "trio", etiqueta: "3 criaturas, peligro 1-2", elegir: () => [0, 1, 2].map(() => TRIO_POOL[Math.floor(azar() * TRIO_POOL.length)]) },
  { id: "jefe", etiqueta: "1 jefe", elegir: (i) => [JEFES[i % JEFES.length]] },
];
function nombresUnicos(defs: Criatura[]) { const c: Record<string, number> = {}; return defs.map((d) => { c[d.nombre] = (c[d.nombre] ?? 0) + 1; return { nombre: c[d.nombre] > 1 ? `${d.nombre} ${c[d.nombre]}` : d.nombre, def: d }; }); }

/** `semilla` permite que varias variantes compartan los mismos dados de partida (comparaciones apareadas, menos ruido). */
function correrCelda(id: string, etiqueta: string, n: number, hacer: (i: number) => Resultado1, semilla?: string): Celda {
  const rs: Resultado1[] = [];
  for (let i = 0; i < n; i++) { sembrar(`${semilla ?? id}|${i}`); rs.push(hacer(i)); }
  return agregar(id, etiqueta, rs);
}
const celdaEncuentro = (enc: Encuentro, nivel: number, n: number) =>
  correrCelda(`${enc.id}|n${nivel}`, `${enc.etiqueta} · nivel ${nivel}`, n, (i) => {
    const sc = montarGrupo({ nivel, indice: i });
    return simularCombate(sc, nombresUnicos(enc.elegir(i)));
  });

// ------------------------------------------------------------------ salida
const pad = (s: string, w: number) => s + " ".repeat(Math.max(0, w - [...s].length));
const fila = (c: Celda) => `${semaforo(c.victorias / c.n)} ${pad(pct(c.victorias / c.n), 5)} asaltos ${pad(c.asaltos.toFixed(1), 5)} caídos ${pad(pct(c.caidos / c.pjs), 5)} PV ${pad(pct(c.pvFrac), 5)} rech ${c.rechazadas}`;
const resultados: Record<string, unknown> = { semilla: SEMILLA, n: N, soloPrimero: SOLO_PRIMERO };
const t0 = Date.now();
const seg = () => `${((Date.now() - t0) / 1000).toFixed(0)}s`;

function tablaPrincipal() {
  console.log(`\n=== TABLA PRINCIPAL (n=${N} combates/celda, semilla ${SEMILLA}, grupo de 4, ${SOLO_PRIMERO ? "criaturas con su primer ataque" : "criaturas con su acción de Atacar completa"}) ===`);
  console.log("Celda: 🔴 victorias<20%  🟡 20-40% o >95%  🟢 resto | %vic · asaltos medios · %PJ a 0 PV o muertos · %PV restantes del grupo · acciones rechazadas\n");
  const celdas: Celda[] = [];
  console.log(pad("Encuentro", 28) + NIVELES.map((n) => pad(`Nivel ${n}`, 46)).join(""));
  for (const enc of ENCUENTROS) {
    const cs = NIVELES.map((nv) => celdaEncuentro(enc, nv, N));
    celdas.push(...cs);
    console.log(pad(enc.etiqueta, 28) + cs.map((c) => pad(`${semaforo(c.victorias / c.n)} ${pct(c.victorias / c.n)} · ${c.asaltos.toFixed(1)}a · ${pct(c.caidos / c.pjs)} · ${pct(c.pvFrac)} · r${c.rechazadas}${c.empates ? ` · E${c.empates}` : ""}`, 46)).join(""));
  }
  resultados.principal = celdas;
  console.log(`(${seg()})`);
}

function tablaDetalle() {
  const nd = Number(opt("n-detalle", RAPIDO ? "6" : "16"));
  console.log(`\n=== DETALLE por criatura (1 criatura sola; n=${nd}/celda) ===`);
  const solo = opt("criatura", "");
  const lista = [...MONSTRUOS, ...JEFES].filter((c) => !solo || c.nombre.toLowerCase().includes(solo.toLowerCase())).sort((a, b) => a.peligro - b.peligro || Number(a.vd?.split("/")[0] ?? 0) - Number(b.vd?.split("/")[0] ?? 0));
  console.log(pad("Criatura", 36) + pad("P", 3) + pad("VD", 5) + NIVELES.map((n) => pad(`N${n}`, 12)).join(""));
  const out: Celda[] = [];
  for (const c of lista) {
    const cs = NIVELES.map((nv) => correrCelda(`det|${c.nombre}|n${nv}`, `${c.nombre} · nivel ${nv}`, nd, (i) => simularCombate(montarGrupo({ nivel: nv, indice: i }), [{ nombre: c.nombre, def: c }])));
    out.push(...cs);
    console.log(pad(c.nombre, 36) + pad(String(c.peligro), 3) + pad(c.vd ?? "?", 5) + cs.map((x) => pad(`${semaforo(x.victorias / x.n)} ${pct(x.victorias / x.n)}`, 12)).join(""));
  }
  resultados.detalle = out;
  console.log(`(${seg()})`);
}

function comparar() {
  const nc = Number(opt("n-comparar", String(Math.max(N, RAPIDO ? 30 : 100))));
  console.log(`\n=== COMPARACIÓN A: artes marciales (n=${nc}/celda; mismos dados en las tres variantes) ===`);
  console.log("Estilo de clase (el primero que ofrece su clase): " + ["Mercenario del Cuervo", "Caballero Juramentado", "Berserker de Ceniza", "Cazador de Brujas", "Degollador"].map((c) => `${c} → ${ESTILOS.find((e) => !e.soloHistoria && e.clases.includes(c))?.nombre}`).join("; ") + ". El Flagelante ya lleva el Haemajitsu de serie (en las tres variantes).");
  const estiloDe = (cl: string) => ESTILOS.find((e) => !e.soloHistoria && e.clases.includes(cl));
  const cA: Celda[] = [];
  const casos: [number, string][] = [[5, "Ogro"], [5, "Troll de ciénaga"], [5, "Gigante de hueso"], [9, "Troll de ciénaga"], [9, "Ogro"], [9, "Gigante de hueso"], [9, "Dragón joven de ceniza"], [9, "Apóstol"]];
  for (const [nivel, objetivo] of casos) {
    const def = BESTIARIO.find((c) => c.nombre === objetivo)!;
    for (const modo of ["sin estilo", "un luchador (1.º Mercenario)", "todos con estilo de clase"]) {
      const c = correrCelda(`arte|${objetivo}|n${nivel}|${modo}`, `${objetivo} · nivel ${nivel} · ${modo}`, nc, (i) => {
        const sc = montarGrupo({ nivel, indice: i });
        for (const pj of sc.pjs) {
          const cl = sc.p.personajes[pj].clase; const e = estiloDe(cl);
          if (!e || cl === "Flagelante" || modo === "sin estilo") continue;
          if (modo.startsWith("un luchador") && !(cl === "Mercenario del Cuervo" && pj === sc.pjs.find((x) => sc.p.personajes[x].clase === cl))) continue;
          const r = sc.E("arte_marcial", { accion: "aprender", quien: pj, arte: e.nombre, via: "clase" });
          if (r.error) anotar(`arte_marcial rechazado (${cl}): ${r.contenido.slice(0, 80)}`);
        }
        return simularCombate(sc, [{ nombre: def.nombre, def }]);
      }, `arte|${objetivo}|n${nivel}`);
      cA.push(c);
      console.log(`${pad(c.etiqueta, 66)} ${fila(c)}`);
    }
  }
  resultados.compararArtes = cA;

  console.log(`\n=== COMPARACIÓN B: agua (n=${nc}/celda) ===`);
  const cB: Celda[] = [];
  const sirena = BESTIARIO.find((c) => c.nombre === "Sirena")!, pez = BESTIARIO.find((c) => c.nombre === "Hombre pez")!;
  const bando = nombresUnicos([sirena, pez, pez]);
  for (const nivel of [5, 9]) {
    const variantes: { nombre: string; agua?: "entrar" | "sumergir"; tritones: number }[] = [
      { nombre: "en tierra", tritones: 0 },
      { nombre: "en el agua (entrar)", agua: "entrar", tritones: 0 },
      { nombre: "sumergidos", agua: "sumergir", tritones: 0 },
      { nombre: "sumergidos + 1 Tritón", agua: "sumergir", tritones: 1 },
      { nombre: "sumergidos + 4 Tritones", agua: "sumergir", tritones: 4 },
      { nombre: "en el agua (entrar) + 1 Tritón", agua: "entrar", tritones: 1 },
    ];
    for (const v of variantes) {
      const c = correrCelda(`agua|n${nivel}|${v.nombre}`, `Sirena + 2 Hombres pez · nivel ${nivel} · ${v.nombre}`, nc, (i) => {
        const razas = [0, 1, 2, 3].map((j) => (j < v.tritones ? "Tritón de las Mareas" : RAZAS_TIERRA[(i * 3 + j * 2) % RAZAS_TIERRA.length]));
        // El Tritón ocupa el hueco del Hechicero/Degollador, no el del frente: se rota desde el último.
        razas.reverse();
        const sc = montarGrupo({ nivel, indice: i, razas });
        return simularCombate(sc, bando.map((b) => ({ ...b })), { agua: v.agua });
      }, `agua|n${nivel}`);
      cB.push(c);
      console.log(`${pad(c.etiqueta, 72)} ${fila(c)}`);
    }
  }
  resultados.compararAgua = cB;
  console.log(`(${seg()})`);
}

// ------------------------------------------------------------------ main
const soloComparar = flag("solo-comparar");
if (!soloComparar && !opt("criatura", "")) tablaPrincipal();
if (flag("detalle") || opt("criatura", "")) tablaDetalle();
if (flag("comparar") || soloComparar) comparar();

console.log("\n=== INTEGRACIÓN: errores del motor y acciones rechazadas (agrupados) ===");
const claves = Object.entries(errores).sort((a, b) => b[1] - a[1]);
if (!claves.length) console.log("ninguno");
for (const [k, v] of claves) console.log(`${String(v).padStart(6)}  ${k}`);
const anomalias = new Set<string>();
for (const v of Object.values(resultados)) if (Array.isArray(v)) for (const c of v as Celda[]) for (const a of c.anomalias ?? []) anomalias.add(`${c.etiqueta}: ${a}`);
console.log(anomalias.size ? `\nANOMALÍAS (${anomalias.size}):\n${[...anomalias].slice(0, 30).join("\n")}` : "\nSin anomalías (NaN, PV imposibles, combates que no terminan).");
resultados.errores = errores;
const j = opt("json", "");
if (j) writeFileSync(j, JSON.stringify(resultados, null, 1));
console.log(`\nTiempo total: ${seg()}`);
