// Resistencias, inmunidades y vulnerabilidades por criatura (fase C): datos estructurados en la ficha (migrados de la prosa de rasgos, sin inventar
// nada), aplicados por atacar y danar_criatura con aplicarDano. «No mágico»: fuente.magico (objeto encantado del inventario o magico: true).
// Armadura y ficha no se duplican. Dados fijos.
import { nuevaPartida, normalizarPartida } from "../../src/estado.ts";
import { ejecutar } from "../../src/herramientas.ts";
import { BESTIARIO, buscarCriatura, fichaCriatura, perfilDeCriatura, lineaResistencias } from "../../src/bestiario.ts";
import { iniciarRegistroDados, liberarDados } from "../../src/dados.ts";
import { aplicarDano, normalizarTipo } from "../../src/danos.ts";
let ok = 0, mal = 0; const t = (c: boolean, m: string, x = "") => { console.log(c ? "ok   " : "FALLA", m, x); c ? ok++ : mal++; };
const txt = (r: any) => (typeof r === "string" ? r : r?.contenido ?? JSON.stringify(r));
const dados = (caras: number, ...v: number[]) => v.map((valor) => ({ caras, valor }));

// --- datos: lo que la prosa dice, estructurado
const C = (n: string) => buscarCriatura(n)!;
const tiene = (n: string, k: "resistencias" | "inmunidades" | "vulnerabilidades", tipo: string, extra: object = {}) => !!C(n)[k]?.some((r) => r.tipo === tipo && Object.entries(extra).every(([a, b]) => (r as any)[a] === b));
const FIS = ["cortante", "perforante", "contundente"];
for (const n of ["Banshee del Velo", "Lich", "Ulfhedinn", "Hombre oso", "Elemental de fuego", "Elemental de agua", "Elemental de aire"]) t(FIS.every((f) => tiene(n, "resistencias", f, { soloNoMagico: true })), `${n}: resiste lo físico no mágico`);
for (const n of ["Gárgola", "Golem de piedra", "Elemental de tierra"]) t(tiene(n, "resistencias", "cortante", { soloNoMagico: true }) && tiene(n, "resistencias", "perforante", { soloNoMagico: true }) && !tiene(n, "resistencias", "contundente"), `${n}: resiste cortante y perforante no mágico, no el contundente`);
t(tiene("Banshee del Velo", "inmunidades", "necrótico") && tiene("La Madre de los Hambrientos", "inmunidades", "necrótico") && tiene("La Madre de los Hambrientos", "inmunidades", "veneno"), "inmunidades al necrótico (Banshee, Madre) y veneno (Madre)");
for (const n of ["Gigante de hueso", "Apóstol", "Lich", "Ulfhedinn", "Hombre oso", "Gárgola", "Golem de piedra", "Golem de carne", "Elemental de fuego", "Elemental de agua", "Elemental de tierra", "Elemental de aire", "Djinn"]) t(tiene(n, "inmunidades", "veneno"), `${n}: inmune al veneno`);
t(tiene("Elemental de fuego", "inmunidades", "fuego") && tiene("Dragón joven de ceniza", "inmunidades", "fuego") && tiene("Kharoth, Dragón Antiguo del Sol Herido", "inmunidades", "fuego") && tiene("Wendigo", "inmunidades", "frío"), "inmunidades al fuego (Elemental, Dragón joven, Kharoth) y al frío (Wendigo)");
for (const n of ["Wendigo", "Leshen", "Golem de carne"]) t(tiene(n, "vulnerabilidades", "fuego") && !C(n).vulnerabilidades!.some((r) => r.soloMaterial), `${n}: vulnerable al fuego`);
t(tiene("Lich", "vulnerabilidades", "fuego", { soloMaterial: "llama gris" }) && tiene("Lich", "vulnerabilidades", "radiante", { soloMaterial: "luz solar primigenia" }), "Lich: vulnerable al fuego de la Llama Gris y a la luz solar primigenia (solo esas fuentes)");
t(tiene("Gigante de hueso", "vulnerabilidades", "contundente") && tiene("Gárgola", "vulnerabilidades", "contundente") && tiene("Elemental de tierra", "vulnerabilidades", "trueno"), "vulnerabilidades al contundente (Gigante de hueso, Gárgola) y al trueno (Elemental de tierra)");
t(tiene("Bakunawa", "resistencias", "frío") && tiene("Bakunawa", "resistencias", "eléctrico") && tiene("Djinn", "resistencias", "eléctrico") && tiene("Djinn", "resistencias", "trueno") && tiene("Elemental de agua", "resistencias", "fuego"), "resistencias elementales (Bakunawa, Djinn, Elemental de agua)");
// Coherencia prosa ↔ datos: toda «inmune a …/vulnerable al …» de un tipo de daño que aparece en los rasgos está en la ficha estructurada.
{
  const falta: string[] = [];
  for (const c of BESTIARIO) for (const r of c.rasgos) {
    for (const m of r.matchAll(/inmune (?:al?|el) ([\p{L}]+)(?: y (?:al?|el) ([\p{L}]+))?/giu)) for (const w of [m[1], m[2]]) { const tp = w && normalizarTipo(w); if (tp && !c.inmunidades?.some((x) => x.tipo === tp)) falta.push(`${c.nombre}: inmune ${tp}`); }
    for (const m of r.matchAll(/inmune a ([\p{L}, ]+?)(?: y [\p{L}]+)?[;.:]/giu)) for (const w of m[1].split(/,| y /).map((x) => x.trim())) { const tp = normalizarTipo(w); if (tp && !c.inmunidades?.some((x) => x.tipo === tp)) falta.push(`${c.nombre}: inmune ${tp}`); }
    for (const m of r.matchAll(/vulnerable al (fuego|trueno|daño contundente)(?! de la Llama| solo)/giu)) { const tp = normalizarTipo(m[1].replace("daño ", "")); if (tp && !c.vulnerabilidades?.some((x) => x.tipo === tp)) falta.push(`${c.nombre}: vulnerable ${tp}`); }
  }
  // Excepciones conocidas: «inmune al fuego» de Kharoth/Dragón joven/Elemental ya están; la Bakunawa solo resiste (no es inmune al veneno: su ficha dice «envenenado»).
  t(falta.length === 0, "todo «inmune a …» (tipo de daño) de la prosa está en los datos", [...new Set(falta)].join(" | "));
}
t(BESTIARIO.filter((c) => c.resistencias || c.inmunidades || c.vulnerabilidades).length === 23, "23 criaturas con datos de resistencias (20 de la fase C + Hambriento, Ghul de las fosas e Ysolde)", String(BESTIARIO.filter((c) => c.resistencias || c.inmunidades || c.vulnerabilidades).length));
t(/Daño por tipo.*inmune a fuego, veneno/.test(fichaCriatura(C("Elemental de fuego"))) && !/Daño por tipo/.test(fichaCriatura(C("Ogro"))), "la ficha dice qué aplica el programa (y nada en las criaturas sin datos)");
t(lineaResistencias(C("Lich")).includes("vulnerable a fuego (llama gris)"), "línea de la ficha del Lich", lineaResistencias(C("Lich")));
{ const pf = perfilDeCriatura(C("Wendigo")); t(aplicarDano({ objetivo: pf, cantidad: 10, tipo: "fuego" }).final === 20 && aplicarDano({ objetivo: pf, cantidad: 10, tipo: "frío" }).final === 0 && aplicarDano({ objetivo: pf, cantidad: 10, tipo: "cortante" }).final === 10, "perfilDeCriatura: Wendigo fuego ×2, frío 0, resto igual"); }


// --- Corrección de incoherencias (docs/BALANCE.md §14): inmunidades de no-muertos y necróticos, y redacción daño ↔ condición
const NOMUERTOS = ["Hambriento", "Ghul de las fosas", "Banshee del Velo", "Gigante de hueso", "Lich", "Ulfhedinn", "Hombre oso", "La Madre de los Hambrientos", "Ysolde, la Reina Pálida"];
const habla = (n: string, tipo: string) => C(n).rasgos.some((r) => /inmune/i.test(r) && new RegExp(`\\b${tipo}\\b`, "i").test(r));
for (const n of NOMUERTOS) t(tiene(n, "inmunidades", "veneno") && habla(n, "veneno"), `${n}: no-muerto, inmune al veneno (dato y prosa)`);
t(["Hambriento", "Ghul de las fosas", "Banshee del Velo", "Ysolde, la Reina Pálida"].every((n) => /^(no-muerto|no-muerto torpe|espectro|vampiro)$/.test(C(n).temple ?? "")), "Hambriento, Ghul, Banshee e Ysolde son de veras no-muertos por su temple");
for (const n of ["Lich", "Ysolde, la Reina Pálida", "Banshee del Velo", "La Madre de los Hambrientos"]) t(tiene(n, "inmunidades", "necrótico") && habla(n, "necrótico"), `${n}: inmune al necrótico (dato y prosa)`);
// Vaerth (cambiaformas, no es no-muerto) ataca con necrótico pero se queda SIN inmunidad: sin razón narrativa (ver §14)
t(!C("Vaerth, el Sin Rostro").inmunidades && !C("Vaerth, el Sin Rostro").resistencias && !C("Vaerth, el Sin Rostro").rasgos.some((r) => /inmune/i.test(r)), "Vaerth: ni inmunidad ni resistencia al necrótico (decisión documentada)");
// regla general: un no-muerto (temple) que ataca con daño necrótico es inmune a él
{ const mal: string[] = [];
  for (const c of BESTIARIO) if (/^(no-muerto|no-muerto torpe|espectro|vampiro)$/.test(c.temple ?? "") && (c.ataques.some((a) => /necrótico/i.test(a)) || c.habilidades.some((h) => h.tipo_dano === "necrótico")) && !tiene(c.nombre, "inmunidades", "necrótico")) mal.push(c.nombre);
  t(mal.length === 0, "todo no-muerto que ataca con necrótico es inmune al necrótico", mal.join(" | ")); }
// los datos de inmunidad están dichos en la prosa (sentido inverso de la prueba de arriba)
{ const falta: string[] = [];
  for (const c of BESTIARIO) for (const i of c.inmunidades ?? []) if (!c.rasgos.some((r) => /inmune/i.test(r) && r.split(/[;:]/).some((trozo) => /inmune/i.test(trozo) && trozo.toLowerCase().split(/[^\p{L}]+/u).some((w) => normalizarTipo(w) === i.tipo)))) falta.push(`${c.nombre}: ${i.tipo}`);
  t(falta.length === 0, "toda inmunidad de los datos aparece en un rasgo «inmune…»", falta.join(" | ")); }
// redacción: daño y condición separados (nunca «inmune a envenenado/asustado/miedo/hechizo/agotamiento» a secas)
{ const mal: string[] = [];
  for (const c of BESTIARIO) for (const r of c.rasgos) if (/inmune\s+(?:a|al|a la|a los)\s+(?:envenenad|asustad|miedo|hechiz|agotamiento|sueño)/i.test(r) || /inmune[^;.]*,\s*(?:miedo|hechizo|agotamiento|sueño)\b/i.test(r) || /inmune a veneno/i.test(r)) mal.push(`${c.nombre}: ${r.slice(0, 70)}`);
  t(mal.length === 0, "redacción de inmunidades: «al veneno» (daño) y «a quedar/a la condición …» (condiciones), sin mezclar", mal.join(" | ")); }
{ const b = C("Bakunawa"); const r = b.rasgos.find((x) => /Escamas de mar profundo/.test(x))!;
  t(/inmune al veneno y a la condición envenenado/.test(r) && !/inmune a ahogamiento, a envenenado/.test(r) && tiene("Bakunawa", "inmunidades", "veneno") && tiene("Bakunawa", "resistencias", "frío") && tiene("Bakunawa", "resistencias", "eléctrico"), "Bakunawa: inmune al veneno (dato) y a la condición envenenado (solo prosa), sigue resistiendo frío y eléctrico", r.slice(0, 160));
  t(!(b.inmunidades ?? []).some((x) => (x.tipo as string) === "envenenado") && BESTIARIO.every((c) => (c.inmunidades ?? []).every((x) => !!normalizarTipo(x.tipo))), "ninguna inmunidad de datos es una condición: todas son tipos de daño del catálogo"); }

// --- atacar
function mk(criatura: string, inventario: string[] = ["Espada larga"]) {
  const p = nuevaPartida(); normalizarPartida(p); const E = (n: string, d: object): any => ejecutar(n, d, p);
  E("guardar_personaje", { don_arcano: false, nombre: "Aldo", jugador: "Ana", raza: "Humano del Faro", clase: "Mercenario del Cuervo", nivel: 5, pv_max: 900, ca: 12, atributos: { fue: 16, des: 14, con: 14, int: 10, sab: 14, car: 10 }, inventario, dote: "Terco" });
  E("aparecer_criatura", { nombre: criatura });
  const j = Object.values(p.jefes)[0]; j.pv = j.pv_max = 5000;
  return { p, E, j, perdida: () => 5000 - j.pv };
}
function golpe(m: ReturnType<typeof mk>, tipo: string | undefined, extra: object = {}, dano = "2d6") {
  iniciarRegistroDados([...dados(20, 15), ...dados(6, 5, 5, 5, 5)]);
  const antes = m.j.pv;
  const r = m.E("atacar", { atacante: "Aldo", objetivo: m.j.nombre, dano, bono: 50, ...(tipo ? { tipo_dano: tipo } : {}), apuntar: "torso", temerario: false, ...extra });
  liberarDados(); return { r, d: antes - m.j.pv, s: txt(r) };
}
{ // Banshee: sin blindaje; resiste lo físico no mágico
  const m = mk("Banshee del Velo");
  let g = golpe(m, "cortante"); t(!g.r.error && g.d === 5 && /resistencia a cortante no mágico: 10 → 5/.test(g.s), "Banshee: cortante no mágico 10 → 5 (aviso compacto)", g.s.split("\n").filter((l) => /resist/.test(l)).join("|"));
  g = golpe(m, "perforante"); t(g.d === 5, "Banshee: perforante 10 → 5");
  g = golpe(m, "contundente"); t(g.d === 5, "Banshee: contundente 10 → 5");
  g = golpe(m, "cortante", { magico: true }); t(g.d === 10 && !/resistencia/.test(g.s), "Banshee: con magico: true, el daño pasa entero");
  g = golpe(m, "cortante", { magico: false }); t(g.d === 5, "Banshee: magico: false = no mágico");
  g = golpe(m, "necrótico"); t(g.d === 0 && /inmune a necrótico: 10 → 0/.test(g.s), "Banshee: inmune al necrótico", g.s.slice(-100));
  g = golpe(m, "fuego"); t(g.d === 10, "Banshee: el fuego no se resiste (solo lo físico no mágico)");
  g = golpe(m, "fuego", {}, "2d6"); t(!/Sin tipo/.test(g.s), "fuego: sin aviso de «sin tipo»");
}
{ // arma encantada del inventario → mágica sola
  const p = nuevaPartida(); normalizarPartida(p);
  const m = mk("Banshee del Velo", ["Espada larga [O1]"]);
  m.p.objetos["O1"] = { id: "O1", nombre: "Espada larga", calidad: "encantado", apariencia: "x", verdad: "plata y sal", precio: 0, identificado: true } as any;
  const g = golpe(m, "cortante", { arma: "Espada larga" }); t(g.d === 10 && !/resistencia/.test(g.s), "Banshee: la espada encantada del inventario cuenta como mágica", g.s.slice(-100));
  m.p.objetos["O1"].calidad = "normal"; const h = golpe(m, "cortante", { arma: "Espada larga" }); t(h.d === 5, "con el objeto de calidad normal, no es mágica");
}
{ // Elemental de fuego: inmune al fuego y al veneno
  const m = mk("Elemental de fuego");
  t(golpe(m, "fuego").d === 0 && golpe(m, "veneno").d === 0 && golpe(m, "frío").d === 10, "Elemental de fuego: fuego y veneno 0, frío 10");
}
{ // Wendigo: vulnerable al fuego, inmune al frío
  const m = mk("Wendigo"); const f = golpe(m, "fuego"); t(f.d === 20 && /vulnerable a fuego: 10 → 20/.test(f.s), "Wendigo: fuego ×2", f.s.slice(-90)); t(golpe(m, "frío").d === 0, "Wendigo: inmune al frío");
}
{ // Lich: vulnerable al fuego solo de la Llama Gris; el blindaje de hueso (contundente −2) y la ficha no se duplican
  const m = mk("Lich");
  t(golpe(m, "fuego").d === 10, "Lich: fuego corriente 10 (la vulnerabilidad es solo de la Llama Gris)");
  t(golpe(m, "fuego", { material: "llama gris" }).d === 20, "Lich: fuego con material «llama gris» ×2");
  t(golpe(m, "radiante", { magico: true }).d === 10 && golpe(m, "radiante", { magico: true, material: "luz solar primigenia" }).d === 20, "Lich: radiante ×2 solo con luz solar primigenia");
  t(golpe(m, "veneno").d === 0, "Lich: inmune al veneno");
}
{ // Armadura y ficha: no se duplican. Gárgola (piedra: corte 5, punta 4, contundente 1) resiste cortante/perforante no mágico y es vulnerable al contundente.
  const m = mk("Gárgola"); const g = golpe(m, "cortante", {}, "2d6+10"); // 20 de daño: la piedra frena 5 → 15; la resistencia NO se suma (manda el blindaje)
  t(g.d === 15 && !/resistencia a cortante/.test(g.s), "Gárgola: cortante 20 → armadura 15 y la resistencia de la ficha no se suma", g.s.split("\n").filter((l) => /Cae en|resist/.test(l)).join("|"));
  const c = golpe(m, "contundente", {}, "2d6+10"); t(c.d === 38, "Gárgola: contundente 20 → la piedra frena 1 → 19 → vulnerable ×2 = 38", String(c.d));
  const f = golpe(m, "fuego", {}, "2d6+10"); t(f.d === 20, "Gárgola: el fuego no se toca");
}
{ // Golem de piedra: contundente sin resistencia
  const m = mk("Golem de piedra"); t(golpe(m, "contundente", {}, "2d6+10").d > 0, "Golem de piedra recibe contundente");
}
{ // Corrección §14: los nuevos inmunes no reciben ese daño
  t(golpe(mk("Hambriento"), "veneno").d === 0 && golpe(mk("Ghul de las fosas"), "veneno").d === 0, "Hambriento y Ghul: el veneno no les hace nada");
  const y = mk("Ysolde, la Reina Pálida"); t(golpe(y, "necrótico").d === 0 && golpe(y, "veneno").d === 0 && golpe(y, "radiante", { magico: true }).d === 10, "Ysolde: necrótico y veneno 0; el radiante pasa entero (no hay vulnerabilidad en su ficha)");
  const l = mk("Lich"); t(golpe(l, "necrótico").d === 0, "Lich: inmune al necrótico");
  const b = mk("Banshee del Velo"); t(golpe(b, "veneno").d === 0, "Banshee: inmune al veneno");
  const k = mk("Bakunawa"); t(golpe(k, "veneno").d === 0 && golpe(k, "frío").d === 5, "Bakunawa: veneno 0 (y el frío sigue a la mitad)");
  const v = mk("Vaerth, el Sin Rostro"); t(golpe(v, "necrótico").d === 10, "Vaerth: el necrótico pasa entero (sin cambio)"); }
// --- el castigo radiante y la inmunidad (Madre: necrótico; el radiante pasa)
// --- danar_criatura con tipo
{
  const m = mk("Wendigo");
  let r = m.E("danar_criatura", { nombre: m.j.nombre, cantidad: 10 }); t(m.perdida() === 10 && !/vulnerable/.test(txt(r)), "danar_criatura sin tipo: el daño es final (como siempre)");
  m.j.pv = 5000; r = m.E("danar_criatura", { nombre: m.j.nombre, cantidad: 10, tipo_dano: "fuego" }); t(m.perdida() === 20 && /vulnerable a fuego: 10 → 20/.test(txt(r)), "danar_criatura con tipo fuego: ×2 y lo dice", txt(r).slice(0, 120));
  m.j.pv = 5000; m.E("danar_criatura", { nombre: m.j.nombre, cantidad: 10, tipo_dano: "hielo" }); t(m.perdida() === 0, "danar_criatura «hielo» (alias): inmune al frío");
  m.j.pv = 4000; r = m.E("danar_criatura", { nombre: m.j.nombre, cantidad: -30, tipo_dano: "fuego" }); t(m.j.pv === 4030, "curar (cantidad negativa) no pasa por resistencias");
  const b = mk("Banshee del Velo"); b.E("danar_criatura", { nombre: b.j.nombre, cantidad: 10, tipo_dano: "cortante" }); t(b.perdida() === 5, "danar_criatura cortante a la Banshee: mitad"); b.j.pv = 5000; b.E("danar_criatura", { nombre: b.j.nombre, cantidad: 10, tipo_dano: "cortante", magico: true }); t(b.perdida() === 10, "…y con magico: true, entero");
  const x = mk("Banshee del Velo"); const e = x.E("danar_criatura", { nombre: x.j.nombre, cantidad: 10, tipo_dano: "mágico" }); t(!!e.error && /no son tipos de daño/.test(txt(e)), "danar_criatura «mágico»: error claro");
}
// --- las criaturas sin datos no cambian
{ const m = mk("Ogro"); const g = golpe(m, "fuego"); t(g.d === 10, "Ogro (sin datos): el fuego pasa entero"); }
console.log(`${ok} ok, ${mal} fallas`);
