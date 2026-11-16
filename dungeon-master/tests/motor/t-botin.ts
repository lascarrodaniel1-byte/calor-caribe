// Generador de botín con peligro, región y criatura (src/botin.ts): retrocompatibilidad, oro sugerido (nunca aplicado solo), proporción de equipo
// mágico por peligro, reparto por categorías, región, criatura, objetos únicos, esquema de la herramienta, catalizador raro al azar y la línea del prompt.
import { nuevaPartida, normalizarPartida } from "../../src/estado.ts";
import { generarBotinDe, esBotinNuevo } from "../../src/botin.ts";
import { extrasBotin, tirarCalidad, generarBotin, ORIGENES } from "../../src/equipo.ts";
import { TESORO, MONEDA_PELIGRO } from "../../src/tesoro.ts";
import { ejecutar } from "../../src/herramientas.ts";
import { sistemaWeb } from "../../src/prompt-web.ts";
import { iniciarRegistroDados, liberarDados } from "../../src/dados.ts";
let ok = 0, mal = 0; const t = (c: boolean, m: string, x = "") => { console.log(c ? "ok   " : "FALLA", m, x); c ? ok++ : mal++; };
const nueva = () => { const p = nuevaPartida(); normalizarPartida(p); return p; };
const lineas = (dm: string) => dm.split("\n").slice(1);
const del = (dm: string) => lineas(dm).filter((l) => !/^- (Oro|Vial|Catalizador|Huevo|Pista escrita)/.test(l));
const idsDe = (dm: string) => del(dm).map((l) => TESORO.find((x) => l.startsWith(`- ${x.nombre}`))).filter(Boolean) as typeof TESORO;

// Retrocompatibilidad: sin peligro, región, criatura ni categorías es el generador antiguo (sin oro, mismo encabezado)
{
  t(!esBotinNuevo({ origen: "saqueo", cantidad: 3 }) && esBotinNuevo({ origen: "saqueo", cantidad: 3, peligro: 1 }) && esBotinNuevo({ origen: "saqueo", cantidad: 1, criatura: "Ogro" }), "esBotinNuevo distingue la petición antigua de la nueva");
  let anomalias = 0;
  for (const origen of ORIGENES) for (let i = 0; i < 60; i++) {
    const r = generarBotinDe(nueva(), { origen, cantidad: 1 + (i % 6) });
    if (!r.dm.startsWith(`Botín (${origen}). Añade al inventario`) || /Oro:/.test(r.dm) || typeof r.jugadores !== "string") anomalias++;
  }
  t(anomalias === 0, "sin datos nuevos: encabezado y contenido del generador antiguo, sin oro", String(anomalias));
}

// Oro sugerido: sale en el texto, no cambia ninguna ficha, la compra no lo da y respeta el techo de cada peligro
{
  const p = nueva();
  ejecutar("guardar_personaje", { don_arcano: false, nombre: "Ana", jugador: "Ana", genero: "Femenino", raza: "Humano del Faro", clase: "Mercenario del Cuervo", nivel: 3, pv_max: 20, ca: 14, oro: 7, atributos: { fue: 16, des: 14, con: 14, int: 12, sab: 12, car: 10 }, inventario: ["Espada larga"], dote: "Terco" }, p);
  const antes = JSON.stringify(Object.values(p.personajes));
  let max: Record<string, number> = {}, sin = 0, compraOro = 0;
  for (const origen of ["saqueo", "hallazgo", "jefe"] as const) for (const peligro of [1, 2, 3, 4, 5]) for (let i = 0; i < 40; i++) {
    const r = generarBotinDe(p, { origen, cantidad: 2, peligro });
    const m = /- Oro: (\d+) po/.exec(r.dm);
    if (!m) { sin++; continue; }
    const k = `${origen}${peligro}`; max[k] = Math.max(max[k] ?? 0, Number(m[1]));
    if (!r.dm.includes(`oro_cambio: ${m[1]}`) || !r.jugadores.includes(`- ${m[1]} po`)) sin++;
  }
  t(sin === 0, "saqueo, hallazgo y jefe dan oro sugerido (oro_cambio) en el texto del DM y a la vista de los jugadores");
  t(JSON.stringify(Object.values(p.personajes)) === antes && p.personajes[Object.keys(p.personajes)[0]].oro === 7, "el oro NUNCA se aplica solo: la ficha no cambia");
  for (let i = 0; i < 60; i++) if (/Oro:/.test(generarBotinDe(nueva(), { origen: "compra", cantidad: 3, peligro: 3 }).dm)) compraOro++;
  t(compraOro === 0, "la compra no da oro");
  const techo = (pel: 1 | 2 | 3 | 4 | 5, mult: number) => { const m = MONEDA_PELIGRO[pel]; const [n, c] = m.dados.split("d").map(Number); return Math.round(n * c * m.mult * mult); };
  t([1, 2, 3, 4, 5].every((pl) => max[`saqueo${pl}`] <= techo(pl as 1, 0.5) && max[`hallazgo${pl}`] <= techo(pl as 1, 1) && max[`jefe${pl}`] <= techo(pl as 1, 2)), "el oro nunca pasa del techo de dados × origen", JSON.stringify(max));
  t(max.saqueo1 <= 3 && max.jefe5 <= 1200 && max.jefe5 > max.jefe1 * 5, "P1 saqueo ≤ 3 po; P5 jefe hasta 1.200 po");
}

// Proporción de equipo mágico por peligro (tabla del saqueo común): ~0 % en P1-2, 5 % en P3, 12 % en P4, 25 % en P5
{
  const prop = (pel: number) => { let m = 0; const N = 20000; for (let i = 0; i < N; i++) if (["encantado", "maldito", "reliquia", "legendario"].includes(tirarCalidad("saqueo", pel))) m++; return (100 * m) / N; };
  const [p1, p2, p3, p4, p5] = [1, 2, 3, 4, 5].map(prop);
  t(p1 === 0 && p2 === 0, "saqueo P1-2: 0 % de equipo mágico", `${p1} ${p2}`);
  t(Math.abs(p3 - 5) < 1.2 && Math.abs(p4 - 12) < 1.5 && Math.abs(p5 - 25) < 2, "saqueo P3 ≈ 5 %, P4 ≈ 12 %, P5 ≈ 25 %", `${p3.toFixed(1)} ${p4.toFixed(1)} ${p5.toFixed(1)}`);
  // hallazgo y jefe: sin reliquias por debajo de P3 ni legendarias por debajo de P5
  let rel = 0, leg = 0;
  for (let i = 0; i < 6000; i++) { if (tirarCalidad("hallazgo", 2) === "reliquia") rel++; if (["legendario"].includes(tirarCalidad("jefe", 4))) leg++; if (tirarCalidad("jefe", 2) === "reliquia") rel++; }
  t(rel === 0 && leg === 0, "hallazgo P≤2 sin reliquias; jefe P<5 sin legendarias; jefe P≤2 sin reliquias");
  let hay = false; for (let i = 0; i < 6000; i++) if (tirarCalidad("hallazgo", 4) === "reliquia") hay = true;
  t(hay, "hallazgo P4 conserva las reliquias de su tabla");
}

// Reparto: variedad de categorías y diversidad; el equipo ya no es todo el botín
{
  const p = nueva(), cats = new Set<string>(), ids = new Set<string>(); let eq = 0, tot = 0;
  for (let i = 0; i < 300; i++) {
    const r = generarBotinDe(p, { origen: "saqueo", cantidad: 4, peligro: 3, region: "Ciénagas", incluir_viales: false });
    for (const x of idsDe(r.dm)) { cats.add(x.categoria); ids.add(x.id); }
    for (const l of del(r.dm)) { tot++; if (/\((defectuoso|normal|de calidad|encantado|maldito|reliquia|legendario),/.test(l)) eq++; }
  }
  t(cats.size >= 9, "300 saqueos P3: al menos 9 categorías del catálogo", [...cats].join());
  t(ids.size >= 60, "300 saqueos P3: al menos 60 objetos distintos del catálogo", String(ids.size));
  t(eq / tot < 0.4, "el equipo es menos del 40 % de los objetos", `${((100 * eq) / tot).toFixed(0)}%`);
}

// Región: lo náutico solo en el mar; lo de una región, sobre todo en ella; lo de peligro alto, no en P1
{
  const naut = (region?: string) => { let n = 0; const p = nueva(); for (let i = 0; i < 200; i++) n += idsDe(generarBotinDe(p, { origen: "saqueo", cantidad: 4, peligro: 3, region, incluir_viales: false }).dm).filter((x) => x.categoria === "nautico").length; return n; };
  t(naut("Aldenmar") === 0 && naut(undefined) === 0 && naut("Karak-Dûm") === 0, "sin mar no sale nada náutico");
  t(naut("el mar abierto") > 20 && naut("puerto de Aldenmar") > 20, "en el mar y en puertos sale loot náutico");
  const p1 = nueva(); let alto = 0;
  for (let i = 0; i < 300; i++) alto += idsDe(generarBotinDe(p1, { origen: "saqueo", cantidad: 4, peligro: 1, incluir_viales: false }).dm).filter((x) => x.peligroMin > 1).length;
  t(alto === 0, "peligro 1: nada con peligroMin mayor");
  const cuenta = (region: string) => { let n = 0; const p = nueva(); for (let i = 0; i < 300; i++) n += idsDe(generarBotinDe(p, { origen: "hallazgo", cantidad: 4, peligro: 3, region, incluir_viales: false }).dm).filter((x) => x.regiones?.includes("Karak")).length; return n; };
  t(cuenta("Karak-Dûm") > cuenta("Aldenmar") * 1.5, "lo de Karak sale más en Karak que en Aldenmar");
}

// Criatura: sus trofeos con probabilidad; nunca los de otra; sin criatura, ninguno; criatura desconocida no falla
{
  const p = nueva(); let ogro = 0, ajenos = 0, sinCriatura = 0;
  for (let i = 0; i < 200; i++) {
    for (const x of idsDe(generarBotinDe(p, { origen: "saqueo", cantidad: 2, criatura: "Ogro", incluir_viales: false }).dm)) { if (x.criaturas?.includes("Ogro")) ogro++; else if (x.criaturas) ajenos++; }
    sinCriatura += idsDe(generarBotinDe(p, { origen: "saqueo", cantidad: 3, peligro: 2, incluir_viales: false }).dm).filter((x) => x.criaturas).length;
  }
  t(ogro > 30, "saquear un Ogro da sus trofeos con frecuencia", String(ogro));
  t(ajenos === 0 && sinCriatura === 0, "nunca salen piezas de otra criatura, ni sin criatura", `${ajenos} ${sinCriatura}`);
  let err = ""; try { const r = generarBotinDe(nueva(), { origen: "saqueo", cantidad: 2, criatura: "Dragón inventado" }); if (!/P2/.test(r.dm)) err = "sin P2"; } catch (e: any) { err = e.message; }
  t(!err, "criatura desconocida: tabla por defecto (P2) sin excepción", err);
  t(/P4/.test(generarBotinDe(nueva(), { origen: "saqueo", cantidad: 1, criatura: "Wendigo" }).dm), "el peligro por defecto es el de la criatura");
}

// Categorías pedidas, clase y calidad pedidas
{
  const p = nueva(); let fuera = 0;
  for (let i = 0; i < 200; i++) fuera += idsDe(generarBotinDe(p, { origen: "hallazgo", cantidad: 3, peligro: 3, categorias: ["documento", "gema_arte"], incluir_viales: false }).dm).filter((x) => x.categoria !== "documento" && x.categoria !== "gema_arte").length;
  t(fuera === 0, "categorias limita el reparto");
  const q = nueva(); const r = generarBotinDe(q, { origen: "jefe", cantidad: 4, peligro: 5, calidad: "encantado", incluir_viales: false });
  t(del(r.dm).length === 4 && del(r.dm).every((l) => /\(encantado,/.test(l)), "calidad pedida: solo equipo de esa calidad");
  const r2 = generarBotinDe(nueva(), { origen: "hallazgo", cantidad: 5, peligro: 2, categorias: ["equipo"], clase: "armadura", incluir_viales: false });
  t(del(r2.dm).length === 5 && del(r2.dm).every((l) => /\((defectuoso|normal|de calidad|encantado|maldito|reliquia),/.test(l)), "categorias [equipo] + clase: solo equipo");
}

// Objetos únicos: una sola vez por partida y con su [O#]
{
  const p = nueva(); const vistos: string[] = [];
  for (let i = 0; i < 500; i++) for (const l of del(generarBotinDe(p, { origen: "jefe", cantidad: 6, peligro: 5, categorias: ["objeto_trama"], incluir_viales: false }).dm)) { const m = /^- (.*?) \[O\d+\]/.exec(l); if (m) vistos.push(m[1]); }
  t(vistos.length > 0 && new Set(vistos).size === vistos.length, "cada objeto único sale como mucho una vez por partida", `${vistos.length}`);
  t(vistos.length <= TESORO.filter((x) => x.unico).length, "y nunca más que los que hay");
  const u = Object.values(p.objetos).filter((o) => TESORO.some((x) => x.unico && o.nombre.startsWith(x.nombre)));
  t(u.length === vistos.length && u.every((o) => o.calidad === "normal" && o.precio > 0), "los únicos se registran como objetos normales con precio");
}

// Compra: precios a la vista y variedad no de combate
{
  const r = generarBotinDe(nueva(), { origen: "compra", cantidad: 8, peligro: 2 });
  t(r.jugadores.split("\n").filter((l) => /— \d+ po/.test(l)).length >= 6, "compra: los jugadores ven el precio de cada cosa", r.jugadores.slice(0, 80));
}

// La herramienta: esquema nuevo, fuzz de entradas y validación
{
  const p = nueva(); let err = "";
  try {
    const r = ejecutar("generar_botin", { origen: "saqueo", cantidad: 3, peligro: 4, region: "Marca Hueca", criatura: "Hambriento" }, p) as any;
    if (r.error || !/Oro: \d+ po/.test(r.contenido)) err = "sin oro: " + r.contenido.slice(0, 80);
    const r2 = ejecutar("generar_botin", { origen: "saqueo", cantidad: 3 }, p) as any;
    if (r2.error || /Oro:/.test(r2.contenido)) err = "oro en petición antigua";
    const r3 = ejecutar("generar_botin", { origen: "hallazgo", cantidad: 2, categorias: ["documento"] }, p) as any;
    if (r3.error) err = r3.contenido;
  } catch (e: any) { err = e.message; }
  t(!err, "generar_botin por la herramienta: petición nueva y antigua", err);
  let rechazo = 0;
  for (const mala of [{ peligro: 6 }, { peligro: 0 }, { categorias: ["nada"] }, { peligro: 2.5 }]) { try { if ((ejecutar("generar_botin", { origen: "saqueo", cantidad: 1, ...mala }, p) as any).error) rechazo++; } catch { rechazo++; } }
  t(rechazo === 4, "peligro fuera de 1-5, decimal o categoría desconocida se rechazan", String(rechazo));
}

// Catalizador raro: al azar entre los que tienen precio (ya no siempre la Piedra de brasa)
{
  const nombre = (k: number) => { const dm: string[] = [], jug: string[] = []; iniciarRegistroDados([{ caras: 1000, valor: 999 }, { caras: 100, valor: 10 }, { caras: 8, valor: 5 }, { caras: 100, valor: 90 }, { caras: 5, valor: k }]); extrasBotin(nueva(), { origen: "hallazgo", cantidad: 1, incluir_viales: false }, dm, jug); liberarDados(); return dm[0] ?? ""; };
  const sal = [1, 2, 3, 4, 5].map(nombre);
  t(new Set(sal).size === 5 && sal.every((l) => l.includes("Catalizador")), "catalizador raro sustituido por uno con precio ELEGIDO AL AZAR (5 valores del dado, 5 resultados)", sal.map((l) => l.slice(15, 35)).join(" | "));
  t(!sal.some((l) => /Reloj de arena|Diente de dios|Bastón/.test(l)), "el sustituto siempre tiene precio");
}

// Línea del prompt: UNA, la que sustituye a la de generar_botin, y el prompt fijo sigue ≤ 67.600
{
  const s = sistemaWeb(), l = s.split("\n").filter((x) => x.includes("generar_botin"));
  t(l.length === 1 && /peligro/.test(l[0]) && /tesoro/.test(l[0]), "el prompt nombra generar_botin en una sola línea, con peligro y el tema tesoro");
  t(s.length <= 67600, "prompt fijo ≤ 67.600", String(s.length));
  t(!/CATEGORIAS_TESORO|objeto_trama|gema_arte|comida_bebida/.test(s), "el catálogo no entra en el prompt fijo");
}
void generarBotin;
console.log(`${ok} ok, ${mal} fallas`);
