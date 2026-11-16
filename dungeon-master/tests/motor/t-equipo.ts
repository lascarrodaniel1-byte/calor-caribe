// Equipo y botín (src/equipo.ts): generarBotin sin excepciones en todos los orígenes, legendarias (con 1 libre ya no se tira un 1d1),
// calidad/clase válidas y distribución básica. Los dados están fijados cuando el resultado depende de ellos.
import { nuevaPartida, normalizarPartida } from "../../src/estado.ts";
import { generarBotin, LEGENDARIAS, ORIGENES, CALIDADES_OBJETO, BASES } from "../../src/equipo.ts";
import { iniciarRegistroDados, liberarDados, tirar } from "../../src/dados.ts";
let ok = 0, mal = 0; const t = (c: boolean, m: string, x = "") => { console.log(c ? "ok   " : "FALLA", m, x); c ? ok++ : mal++; };
const nueva = () => { const p = nuevaPartida(); normalizarPartida(p); return p; };
const marcar = (p: any, n: number) => { LEGENDARIAS.slice(0, n).forEach((l, i) => { p.objetos[`L${i}`] = { id: `L${i}`, nombre: `${l.nombre} [L${i}]`, calidad: "legendario", apariencia: "", verdad: "", precio: 1, identificado: true }; }); };
const legendarias = (p: any) => Object.values<any>(p.objetos).filter((o) => o.calidad === "legendario");

// dados 1d1: sigue siendo inválido (la corrección es no tirarlo)
let lanza = false; try { tirar("1d1"); } catch { lanza = true; }
t(lanza, "tirar('1d1') sigue siendo un error (no se toca dados.ts)");

// Queda exactamente 1 legendaria libre: botín de jefe con calidad legendaria forzada
{
  const p = nueva(); marcar(p, LEGENDARIAS.length - 1);
  let err = ""; let r: any;
  try { r = generarBotin(p, { origen: "jefe", cantidad: 1, calidad: "legendario", incluir_viales: false }); } catch (e: any) { err = e.message; }
  t(!err, "queda 1 legendaria libre: no lanza excepción", err);
  const ult = LEGENDARIAS[LEGENDARIAS.length - 1].nombre;
  t(!!r && r.dm.includes(ult), "entrega la última legendaria", r?.dm?.slice(0, 80));
  t(legendarias(p).length === LEGENDARIAS.length, "ahora están las cinco halladas");
  // con todas halladas: ya no entrega legendarias (cae a reliquia)
  const r2 = generarBotin(p, { origen: "jefe", cantidad: 3, calidad: "legendario", incluir_viales: false });
  t(legendarias(p).length === LEGENDARIAS.length && !LEGENDARIAS.some((l) => r2.dm.includes(`- ${l.nombre} [`)), "con las cinco halladas no entrega más legendarias", r2.dm.slice(0, 80));
}
// Muchas veces con 4 de 5 halladas y botín de jefe normal (calidad por tabla): nunca lanza
{
  let fallos = 0, ultima = 0;
  for (let i = 0; i < 3000; i++) {
    const p = nueva(); marcar(p, LEGENDARIAS.length - 1);
    try { generarBotin(p, { origen: "jefe", cantidad: 10, incluir_viales: false }); if (legendarias(p).length === LEGENDARIAS.length) ultima++; } catch { fallos++; }
  }
  t(fallos === 0, "3000 botines de jefe ×10 con 1 legendaria libre: 0 excepciones", `${fallos} fallos`);
  t(ultima > 0, "y la última legendaria llega a entregarse alguna vez", `${ultima}`);
}
// Cada legendaria se puede entregar cuando es la única libre (con dado 100 que da legendario en el origen jefe)
for (let k = 0; k < LEGENDARIAS.length; k++) {
  const p = nueva(); LEGENDARIAS.forEach((l, i) => { if (i !== k) p.objetos[`L${i}`] = { id: `L${i}`, nombre: `${l.nombre} [L${i}]`, calidad: "legendario", apariencia: "", verdad: "", precio: 1, identificado: true } as any; });
  const r = generarBotin(p, { origen: "jefe", cantidad: 1, calidad: "legendario", incluir_viales: false });
  t(r.dm.includes(LEGENDARIAS[k].nombre), `única libre «${LEGENDARIAS[k].nombre}» se entrega`);
}
// Con 0 halladas y dados fijos: el índice del d5 elige esa legendaria
for (const i of [1, 3, 5]) {
  const p = nueva(); iniciarRegistroDados([{ caras: LEGENDARIAS.length, valor: i }]);
  const r = generarBotin(p, { origen: "jefe", cantidad: 1, calidad: "legendario", incluir_viales: false }); liberarDados();
  t(r.dm.includes(`- ${LEGENDARIAS[i - 1].nombre} [`), `dado fijo ${i} de ${LEGENDARIAS.length} → legendaria ${i}`);
}

// Cada origen, cantidades 1-10, 200 llamadas: sin excepciones, calidad y clase válidas
for (const origen of ORIGENES) {
  let err = "", n = 0, malas = 0;
  const p = nueva();
  for (let i = 0; i < 200; i++) {
    const cantidad = 1 + (i % 10);
    try {
      const antes = Object.keys(p.objetos).length;
      const r = generarBotin(p, { origen, cantidad });
      n++;
      if (!r.dm || typeof r.jugadores !== "string") malas++;
      if (Object.keys(p.objetos).length - antes < cantidad) malas++;
    } catch (e: any) { err = e.message; }
  }
  t(!err && n === 200 && !malas, `generarBotin «${origen}»: 200 llamadas (1-10 objetos) sin excepciones`, err || `${malas} anómalas`);
  const objs = Object.values<any>(p.objetos);
  t(objs.every((o) => (CALIDADES_OBJETO as readonly string[]).includes(o.calidad)), `«${origen}»: calidades válidas`);
  t(objs.every((o) => o.nombre && o.precio >= 0 && typeof o.verdad === "string"), `«${origen}»: nombre, precio y verdad presentes`);
  t(legendarias(p).length <= LEGENDARIAS.length && new Set(legendarias(p).map((o) => o.nombre.replace(/ \[.*$/, ""))).size === legendarias(p).length, `«${origen}»: ninguna legendaria repetida`);
}
// Clase pedida: todos los objetos de esa clase base
for (const clase of ["arma", "armadura", "accesorio"] as const) {
  const p = nueva(); const r = generarBotin(p, { origen: "hallazgo", cantidad: 8, clase, calidad: "normal", incluir_viales: false });
  const nombres = Object.values<any>(p.objetos).map((o) => o.nombre);
  t(nombres.length === 8 && nombres.every((n) => BASES.some((b) => b.clase === clase && n.startsWith(b.nombre))), `clase «${clase}» respetada`, r.dm.slice(0, 60));
}
// Calidad pedida respetada (no legendaria; el Behelit raro es otro objeto, siempre reliquia)
for (const c of ["defectuoso", "normal", "de calidad", "encantado", "maldito", "reliquia"] as const) {
  const p = nueva(); generarBotin(p, { origen: "jefe", cantidad: 5, calidad: c, incluir_viales: false });
  t(Object.values<any>(p.objetos).filter((o) => !o.nombre.startsWith("Huevo de piedra")).every((o) => o.calidad === c), `calidad «${c}» respetada`);
}
// Distribución básica: tienda sin legendarias ni reliquias; jefe más rico que saqueo (media de precio)
{
  const media = (origen: any) => { const p = nueva(); for (let i = 0; i < 400; i++) generarBotin(p, { origen, cantidad: 5, incluir_viales: false }); const o = Object.values<any>(p.objetos); return { p, m: o.reduce((s, x) => s + x.precio, 0) / o.length }; };
  const c = media("compra"), s = media("saqueo"), j = media("jefe");
  t(!Object.values<any>(c.p.objetos).some((o) => o.calidad === "legendario"), "compra: nunca legendarias");
  t(j.m > s.m, "jefe: precio medio mayor que saqueo", `${j.m.toFixed(0)} > ${s.m.toFixed(0)}`);
}
// Lista de 1 elemento en la rama de catalizador (dados fijos: probabilidad ≤ 100 y d de catálogo)
{
  const p = nueva(); iniciarRegistroDados([{ caras: 100, valor: 50 }, { caras: 100, valor: 1 }]);
  let err = ""; try { generarBotin(p, { origen: "hallazgo", cantidad: 1, calidad: "normal", incluir_viales: false }); } catch (e: any) { err = e.message; } liberarDados();
  t(!err, "botín con dados fijos sin excepción", err);
}
console.log(`${ok} ok, ${mal} fallas`);
