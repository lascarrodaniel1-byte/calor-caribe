// Experiencia de arcos y misiones: porcentaje fijo del tramo del nivel (BALANCE §21).
import { nuevaPartida, normalizarPartida } from "../../src/estado.ts";
import { ejecutar } from "../../src/herramientas.ts";
import { darExperiencia, PX_NIVEL, PX_MISION, pxActual } from "../../src/progresion.ts";

let ok = 0, mal = 0;
const t = (c: boolean, m: string) => { console.log(c ? "ok   " : "FALLA", m); c ? ok++ : mal++; };
const mundo = (niveles: number[]) => {
  const p = nuevaPartida(); normalizarPartida(p);
  niveles.forEach((n, i) => ejecutar("guardar_personaje", { don_arcano: false, nombre: `P${i}`, jugador: `J${i}`, raza: "Humano del Faro", clase: "Mercenario del Cuervo", nivel: n, pv_max: 60, ca: 12, atributos: { fue: 14, des: 14, con: 14, int: 10, sab: 10, car: 10 } } as any, p));
  return p;
};
const tramo = (n: number) => PX_NIVEL[n] - PX_NIVEL[n - 1];
t(PX_MISION.menor === 0.15 && PX_MISION.normal === 0.3 && PX_MISION.mayor === 0.5 && PX_MISION.epica === 0.8, "porcentajes 15/30/50/80");

for (const imp of ["menor", "normal", "mayor", "epica"] as const) for (const n of [1, 2, 5, 8]) {
  const p = mundo([n]); const antes = pxActual(p.personajes.P0);
  darExperiencia(p, { accion: "mision", importancia: imp });
  t(pxActual(p.personajes.P0) - antes === Math.round(PX_MISION[imp] * tramo(n)), `${imp}, nivel ${n}: ${Math.round(PX_MISION[imp] * tramo(n))} PX`);
}
{ const p = mundo([2]); darExperiencia(p, { accion: "mision" }); t(pxActual(p.personajes.P0) === 300 + 180, "sin importancia = normal"); }
{ // fijo: da lo mismo cerca o lejos del umbral
  const a = mundo([2]), b = mundo([2]); b.personajes.P0.px = 890;
  const x = pxActual(a.personajes.P0), y = pxActual(b.personajes.P0);
  darExperiencia(a, { accion: "mision" }); darExperiencia(b, { accion: "mision" });
  t(pxActual(a.personajes.P0) - x === pxActual(b.personajes.P0) - y && pxActual(b.personajes.P0) - y === 180, "cerca del umbral da lo mismo que lejos (no asintótico)");
}
{ const p = mundo([2]); for (let i = 0; i < 4; i++) darExperiencia(p, { accion: "mision" }); t(pxActual(p.personajes.P0) >= PX_NIVEL[2], "cuatro arcos normales desde el inicio del nivel 2 alcanzan el umbral"); }
{ const p = mundo([1, 3, 8]); const r = darExperiencia(p, { accion: "mision", importancia: "mayor" });
  t(pxActual(p.personajes.P0) === 300 / 1 * 0 + 0 + 150 && pxActual(p.personajes.P1) === 900 + 900 && pxActual(p.personajes.P2) === 34000 + 7000, "personajes de niveles distintos: cada uno su tramo");
  t(/\+150 PX/.test(r) && /\+900 PX/.test(r) && /\+7000 PX/.test(r), "el aviso lista a cada uno"); }
{ const p = mundo([1]); p.personajes.P0.px = 280; const r = darExperiencia(p, { accion: "mision" }); t(/puede subir de nivel/.test(r), "cruzar el umbral avisa «puede subir de nivel»"); }
{ const p = mundo([20]); const r = darExperiencia(p, { accion: "mision", importancia: "epica" }); t(/\+0 PX/.test(r) && pxActual(p.personajes.P0) === PX_NIVEL[19], "nivel 20: no da nada"); }
{ const p = mundo([2]); p.personajes.P0.condiciones.push("muerto"); let e = false; try { darExperiencia(p, { accion: "mision" }); } catch { e = true; } t(e, "sin personajes vivos: error"); }
{ const p = mundo([2, 2]); p.personajes.P1.condiciones.push("muerto"); darExperiencia(p, { accion: "mision" }); t(pxActual(p.personajes.P0) === 480 && pxActual(p.personajes.P1) === 300, "los muertos no cobran"); }
{ const p = mundo([2, 2]); darExperiencia(p, { accion: "mision", quienes: ["J1"] }); t(pxActual(p.personajes.P0) === 300 && pxActual(p.personajes.P1) === 480, "quienes limita el reparto"); }
{ // por la herramienta trama
  const p = mundo([2]); ejecutar("trama", { abrir_arco: "Arco de prueba", premisa: "Una deuda del puerto" } as any, p);
  const r: any = ejecutar("trama", { cerrar_arco: "Arco de prueba", desenlace: "Se pagó la deuda", importancia: "epica" } as any, p);
  t(pxActual(p.personajes.P0) === 300 + 480, "trama cerrar_arco épica da el 80 % del tramo"); t(/✨/.test(JSON.stringify(r)), "el aviso ✨ sigue saliendo"); }
console.log(`${ok} ok, ${mal} fallas`);
