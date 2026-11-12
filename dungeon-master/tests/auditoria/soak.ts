import { nuevaPartida, normalizarPartida } from "../../src/estado.ts";
import { ejecutar } from "../../src/herramientas.ts";
import { estadoParaDM } from "../../src/navegador.ts";
import { RAZAS, CLASES } from "../../src/mundo.ts";
import { BESTIARIO } from "../../src/bestiario.ts";
import { ESTILOS } from "../../src/estilos.ts";
let seed = Number(process.argv[2] || 1); const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
const CAL = process.argv[3] === "calendario"; // con estaciones y anomalías activas (el resto de semillas, sin calendario)
const pick = <T,>(a: readonly T[]) => a[Math.floor(rnd() * a.length)];
const malos = /TypeError|Cannot read|is not a function|undefined is not|is not iterable|Maximum call stack|RangeError|ReferenceError|NaN|\[object Object\]/;
const fallos: string[] = []; let llamadas = 0; const motivos: Record<string, number> = {}; const stats: Record<string, [number, number]> = {}; const t0 = Date.now();
const call = (P: any, n: string, d: any) => { llamadas++; try { const r: any = ejecutar(n, d, P); const s = typeof r === "string" ? r : JSON.stringify(r); const bad0 = !!(r && typeof r === "object" && r.error) || /^(Argumentos no válidos|Herramienta desconocida|⚠|Error)/.test(s) || /no está|no puede|no llega|no empuña|necesita|Primero|no domina|no existe|no hay|ya |solo/i.test(s.slice(0, 80)); const bad = bad0; (stats[n] ??= [0, 0])[bad ? 1 : 0]++; if (bad && (n === "atacar" || n === "maniobra")) { const k2 = n + ": " + s.slice(0, 60).replace(/[A-Z_a-z0-9]+_[0-9]+/g, "X"); motivos[k2] = (motivos[k2] || 0) + 1; } if (malos.test(s)) fallos.push(`${n} ${JSON.stringify(d).slice(0, 100)} → ${s.slice(0, 160)}`); return s; } catch (e: any) { fallos.push(`${n} LANZA ${String(e?.message).slice(0, 140)}`); return ""; } };
for (let partidaN = 0; partidaN < 25; partidaN++) {
  const P = nuevaPartida(); normalizarPartida(P);
  const pjs: string[] = [];
  for (let i = 0; i < 4; i++) {
    const clase = pick(CLASES).nombre, raza = pick(RAZAS).nombre, n = `P${partidaN}_${i}`;
    call(P, "guardar_personaje", { don_arcano: rnd() < 0.2 ? "fisico" : false, nombre: n, jugador: n, genero: pick(["Masculino", "Femenino", "No binario"]), raza, clase, nivel: 1 + Math.floor(rnd() * 12), pv_max: 30 + Math.floor(rnd() * 60), ca: 10 + Math.floor(rnd() * 8), atributos: { fue: 8 + Math.floor(rnd() * 12), des: 8 + Math.floor(rnd() * 12), con: 10 + Math.floor(rnd() * 8), int: 10, sab: 10, car: 10 }, inventario: ["Espada larga", "Daga", "Arco largo"], dote: "Terco", ...(clase === "Hechicero" ? { tipos_magia: ["fuego"], linaje: "noble" } : {}) });
    if (P.personajes[n]) { pjs.push(n); call(P, "empunar", { quien: n, principal: "Espada larga" }); }
    const est = pick(ESTILOS.filter((e) => !e.soloHistoria)); call(P, "arte_marcial", { accion: "aprender", quien: n, arte: est.nombre, via: "maestro", maestro: "X", motivo: "entrenamiento largo" });
  }
  call(P, "tiempo", { fijar: { dia: 1, hora: 8 } });
  if (CAL) {
    P.calendario = { inicio: 1 + Math.floor(rnd() * 360), anomalias: [] };
    call(P, "ubicacion", { lugar: "Sitio " + partidaN, region: pick(["Aldenmar", "Las Agujas de Vahl", "Las Ciénagas de Hollín", "Karak-Dûm", "La Marca Hueca", "El Bosque de Velo Rojo"]), tipo: pick(["aldea", "posada", "cueva", "camino"]) });
    if (rnd() < 0.7) call(P, "clima", { accion: "anomalia", nombre: "Anomalía de prueba", causa: "Un hecho de la historia lo provoca desde hace días", tipo: pick(["larga", "intensa", "ambas"]), extra_dias: 1 + Math.floor(rnd() * 60), intensidad: 1 + Math.floor(rnd() * 3), publica: rnd() < 0.5 });
  }
  const enemigos: string[] = [];
  for (let i = 0; i < 3; i++) { const c = pick(BESTIARIO); call(P, "aparecer_criatura", { nombre: c.nombre, repetir: true }); enemigos.push(c.nombre); }
  const todos = [...pjs, ...new Set(enemigos)];
  call(P, "iniciativa", { participantes: todos });
  call(P, "plano", { escena: "arena", poner: [{ nombre: pjs[0] }] });
  for (const n of todos.slice(1)) call(P, "plano", { poner: [{ nombre: n, ref: pjs[0], direccion: pick(["N", "S", "E", "O"]), metros: 1.5 + Math.floor(rnd() * 6) }] });
  if (rnd() < 0.5) call(P, "agua", { accion: pick(["entrar", "sumergir"]), quienes: todos });
  for (let ronda = 0; ronda < 8; ronda++) {
    for (let k = 0; k < 10; k++) { if (k % 3 === 0) call(P, "siguiente_asalto", {});
      const a = pick(todos), o = pick(todos.filter((x) => x !== a)); const q = rnd();
      if (q < 0.7 && !(P.combate?.turnos)) { /* nada */ }
      if (q < 0.75) call(P, "plano", { poner: [{ nombre: a, ref: o, direccion: pick(["N", "S", "E", "O"]), metros: 1.5 }] });
      if (q < 0.45) call(P, "atacar", { atacante: a, objetivo: o, arma: P.personajes[a] ? "Espada larga" : pick(["garras", "mordisco", "zarpazo"]), dano: pick(["1d8+3", "2d6+4", "1d4"]), ...(rnd() < 0.2 ? { desarmar: true } : {}), ...(rnd() < 0.2 ? { yunque: true } : {}), ...(rnd() < 0.2 ? { a_distancia: true } : {}) });
      else if (q < 0.6) call(P, "maniobra", { atacante: a, objetivo: o, tipo: pick(["agarrar", "empujar", "escapar", "lanzar", "sucio", "palanca", "sumision"]), lance: pick(["cadera", "hombro", "molino"]), ...(rnd() < 0.3 ? { contra: pick(todos) } : {}) });
      else if (q < 0.75) call(P, "plano", { mover: [{ nombre: a, direccion: pick(["N", "S", "E", "O", "NE"]), metros: 1 + Math.floor(rnd() * 12) }] });
      else if (q < 0.82) call(P, "accion_combate", { quien: a, accion: pick(["correr", "esquivar", "retirarse"]) });
      else if (q < 0.88) call(P, "agua", { accion: pick(["entrar", "sumergir", "emerger", "salir"]), quienes: [a] });
      else if (q < 0.94) call(P, "modificar_personaje", { nombre: pick(pjs), pv_cambio: -Math.floor(rnd() * 15), tipo_dano: pick(["fuego", "frío", "veneno", "corte"]) });
      else call(P, "prueba", { quien: pick(pjs), habilidad: pick(["atletismo", "sigilo", "percepcion"]), cd: 12, motivo: "algo" });
    }
    call(P, "siguiente_asalto", {});
    if (CAL) { call(P, "tiempo", { avanzar: { horas: 1 + Math.floor(rnd() * 200) } }); call(P, pick(["clima", "clima", "viajar", "sustento"]), { accion: pick(["ver", "pronostico", "comer", "beber"]), horas: 1 + Math.floor(rnd() * 8), ritmo: "normal", terreno: pick(["camino", "dificil"]) }); }
    for (const n of pjs) { const p = P.personajes[n]; if (p && (Number.isNaN(p.pv) || p.pv > p.pv_max + 100 || p.condiciones.length !== new Set(p.condiciones).size)) fallos.push(`invariante: ${n} pv=${p.pv}/${p.pv_max} conds=${p.condiciones.join("|")}`); }
  }
  try { const e = estadoParaDM(P); if (malos.test(e)) fallos.push("estadoParaDM contiene " + (malos.exec(e) || [""])[0]); JSON.parse(JSON.stringify(P)); } catch (er: any) { fallos.push("estado/serialización: " + er.message); }
}
console.log(`${llamadas} llamadas en ${Math.round((Date.now() - t0) / 1000)} s · problemas: ${fallos.length}`);
console.log(Object.entries(stats).map(([k, v]) => `${k}: ${v[0]} ok / ${v[1]} rechazadas`).join(" · "));
console.log(Object.entries(motivos).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => v + " × " + k).join("\n"));
console.log([...new Set(fallos)].slice(0, 30).join("\n"));
