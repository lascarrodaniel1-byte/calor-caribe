import { velocidadDe } from "../../src/velocidad.ts";
import { BESTIARIO } from "../../src/bestiario.ts";
import { localizar } from "../../src/combate.ts";
import { nuevaPartida, normalizarPartida } from "../../src/estado.ts";
import { ejecutar } from "../../src/herramientas.ts";
let ok = 0, mal = 0; const t = (c: boolean, m: string, x = "") => { console.log(c ? "ok   " : "FALLA", m, x); c ? ok++ : mal++; };
const txt = (r: any) => (typeof r === "string" ? r : r?.contenido ?? JSON.stringify(r));
const mk = (raza = "Humano del Faro", enemigo = "Hambriento") => { const p = nuevaPartida(); normalizarPartida(p); const E = (n: string, d: object): any => ejecutar(n, d, p);
  E("guardar_personaje", { don_arcano: false, nombre: "Pj", jugador: "Pj", raza, clase: "Mercenario del Cuervo", nivel: 5, pv_max: 60, ca: 12, atributos: { fue: 16, des: 14, con: 14, int: 10, sab: 10, car: 10 }, inventario: ["Espada larga"], dote: "Terco" }, p);
  E("aparecer_criatura", { nombre: enemigo, repetir: true }); E("iniciativa", { participantes: ["Pj", enemigo] });
  E("plano", { escena: "sala", poner: [{ nombre: "Pj" }] }); E("plano", { poner: [{ nombre: enemigo, ref: "Pj", direccion: "N", metros: 30 }] });
  return { p, E }; };
const pos = (p: any, n: string) => p.plano.puntos[n];
// 1. dentro del límite
{ const { p, E } = mk(); const r = txt(E("plano", { mover: [{ nombre: "Pj", direccion: "N", metros: 9 }] }));
  t(/se mueve/.test(r) && pos(p, "Pj").y !== 0, "se puede mover hasta su velocidad (9 m)", r.slice(0, 80));
  const r2 = txt(E("plano", { mover: [{ nombre: "Pj", direccion: "N", metros: 2 }] }));
  t(/se queda corto/.test(r2) && /solo avanza 0 de los 2 m/.test(r2), "no puede pasarse en el mismo asalto", r2.slice(0, 160));
  t(Math.abs(pos(p, "Pj").y) === 9 || Math.abs(pos(p, "Pj").x) + Math.abs(pos(p, "Pj").y) === 9, "y se queda donde estaba (movimiento recortado)", JSON.stringify(pos(p, "Pj")));
  E("siguiente_asalto", {}); const r3 = txt(E("plano", { mover: [{ nombre: "Pj", direccion: "S", metros: 9 }] })); t(/se mueve/.test(r3), "con el asalto nuevo se renueva el movimiento"); }
// 2. correr: el doble
{ const { p, E } = mk(); E("accion_combate", { quien: "Pj", accion: "correr" });
  const r = txt(E("plano", { mover: [{ nombre: "Pj", direccion: "N", metros: 18 }] })); t(/se mueve/.test(r), "correr da el doble (18 m)", r.slice(0, 80));
  E("siguiente_asalto", {}); const r2 = txt(E("plano", { mover: [{ nombre: "Pj", direccion: "N", metros: 12 }] })); t(/se queda corto/.test(r2), "al asalto siguiente el doble ya no vale", r2.slice(0, 100)); }
// 3. en el agua: mitad para quien no es del agua
{ const { p, E } = mk(); E("agua", { accion: "entrar", quienes: ["Pj"] });
  const r = txt(E("plano", { mover: [{ nombre: "Pj", direccion: "N", metros: 6 }] })); t(/se queda corto/.test(r) && /mitad por el agua/.test(r) && /solo avanza 4.5 de los 6/.test(r), "en el agua, se recorta a 4,5 m en vez de 9", r.slice(0, 160));
  const r2 = txt(E("plano", { mover: [{ nombre: "Pj", direccion: "N", metros: 4.5 }] })); t(!/se queda corto/.test(r2) || /solo avanza 0/.test(r2), "agotado el movimiento, ya no avanza más"); }
// 4. Tritón: sin penalización en el agua
{ const { p, E } = mk("Tritón de las Mareas"); E("agua", { accion: "entrar", quienes: ["Pj"] });
  const r = txt(E("plano", { mover: [{ nombre: "Pj", direccion: "N", metros: 9 }] })); t(/se mueve/.test(r), "el Tritón nada a 9 m", r.slice(0, 80)); }
// 5. sirena (3 m en tierra, nada 12): en tierra va lento, en el agua rápido
{ const { p, E } = mk("Humano del Faro", "Sirena");
  const r = txt(E("plano", { mover: [{ nombre: "Sirena", direccion: "S", metros: 9 }] })); t(/se queda corto/.test(r) && /solo avanza 3 de los 9/.test(r), "la sirena en tierra solo mueve 3 m", r.slice(0, 120));
  E("agua", { accion: "entrar", quienes: ["Sirena"] }); const r2 = txt(E("plano", { mover: [{ nombre: "Sirena", direccion: "S", metros: 12 }] })); t(/se mueve/.test(r2), "en el agua nada a 12 m", r2.slice(0, 80)); }
// 6. agarrado: velocidad 0
{ const { p, E } = mk(); E("condicion", { objetivo: "Pj", accion: "aplicar", condicion: "agarrado", nota: "por Hambriento" });
  const r = txt(E("plano", { mover: [{ nombre: "Pj", direccion: "N", metros: 1.5 }] })); t(/se queda corto/.test(r) && /velocidad 0/.test(r) && /solo avanza 0/.test(r), "agarrado no se mueve", r.slice(0, 140)); }
// 7. fuera de combate no hay límite
{ const p = nuevaPartida(); normalizarPartida(p); const E = (n: string, d: object): any => ejecutar(n, d, p);
  E("plano", { escena: "calle", poner: [{ nombre: "Ana" }] }); const r = txt(E("plano", { mover: [{ nombre: "Ana", direccion: "N", metros: 50 }] })); t(/se mueve/.test(r), "sin combate, sin límite", r.slice(0, 80)); }
// 8. velocidad por raza
for (const [raza, v] of [["Enano de Karak-Dûm", 7.5], ["Mediano de Hollín", 7.5], ["Varg", 10.5], ["Humano del Faro", 9]] as const) {
  const { p, E } = mk(raza); const r = txt(E("plano", { mover: [{ nombre: "Pj", direccion: "N", metros: 12 }] }));
  const hecho = Math.hypot(p.plano.puntos.Pj.x, p.plano.puntos.Pj.y);
  t(Math.abs(hecho - Math.min(12, v)) < 0.11, `${raza}: se mueve ${v} m por asalto`, `recorrido ${hecho.toFixed(1)} m`);
}
{ const { p, E } = mk("Enano de Karak-Dûm"); E("agua", { accion: "entrar", quienes: ["Pj"] }); E("plano", { mover: [{ nombre: "Pj", direccion: "N", metros: 12 }] });
  const hecho = Math.hypot(p.plano.puntos.Pj.x, p.plano.puntos.Pj.y); t(Math.abs(hecho - 3.8) < 0.15, "el enano en el agua: la mitad de 7,5 m (≈3,8 m)", hecho.toFixed(2)); }
// 9. voladores: se mueven a su velocidad de vuelo
for (const [bicho, v] of [["Grifo", 24], ["Wyverno", 24]] as const) {
  const { p, E } = mk("Humano del Faro", bicho); const r = txt(E("plano", { mover: [{ nombre: bicho, direccion: "N", metros: v }] }));
  t(!/se queda corto/.test(r), `${bicho} puede moverse ${v} m (vuelo) en un asalto`, r.slice(0, 140));
  const r2 = txt(E("plano", { mover: [{ nombre: bicho, direccion: "N", metros: 3 }] })); t(/se queda corto/.test(r2), `${bicho} no pasa de su velocidad de vuelo`, r2.slice(0, 100)); }
// 10. todo el bestiario: velocidad finita y > 0 sin condiciones
{   const malos: string[] = [];
  for (const c of BESTIARIO) { const { p } = mk("Humano del Faro", c.nombre); let v: number; try { v = velocidadDe(p, localizar(p, c.nombre)).metros; } catch (e) { malos.push(`${c.nombre}: error`); continue; } if (!Number.isFinite(v) || v <= 0) malos.push(`${c.nombre}: ${v} (${c.velocidad})`); }
  t(malos.length === 0, `las ${BESTIARIO.length} criaturas tienen velocidad finita > 0`, malos.join("; ")); }
console.log(`${ok} ok, ${mal} fallas`);
