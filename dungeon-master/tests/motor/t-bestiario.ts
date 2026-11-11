import { nuevaPartida, normalizarPartida } from "../../src/estado.ts";
import { ejecutar } from "../../src/herramientas.ts";
import { BESTIARIO } from "../../src/bestiario.ts";
import { TEMPLES } from "../../src/combate.ts";
import { NOMBRES_PIEZAS, proteccion } from "../../src/armadura.ts";
import { reconocer } from "../../src/condiciones.ts";
import { buscarTema, textoSaber } from "../../src/saber.ts";
import { bestiarioGrupo } from "../../src/codice.ts";
const ejecutarCon = (p: any, n: string, d: object): any => ejecutar(n, d, p);
type Region = Parameters<typeof proteccion>[1];
let ok = 0, mal = 0; const t = (c: boolean, m: string, x = "") => { console.log(c ? "ok   " : "FALLA", m, x); c ? ok++ : mal++; };
const nuevos = ["Ulfhedinn", "Hombre oso", "Gárgola", "Golem de piedra", "Golem de carne", "Elemental de fuego", "Elemental de agua", "Elemental de tierra", "Elemental de aire", "Djinn", "Duende", "Grifo", "Hidra", "Sirena", "Arpía", "Leshen", "Moira"];
t(nuevos.every((n) => BESTIARIO.some((c) => c.nombre === n)), `las ${nuevos.length} criaturas nuevas están en el bestiario`);
t(new Set(BESTIARIO.map((c) => c.nombre)).size === BESTIARIO.length, "sin nombres repetidos");
const malos: string[] = [];
for (const c of BESTIARIO) {
  if (c.temple && !TEMPLES[c.temple]) malos.push(`${c.nombre}: temple «${c.temple}»`);
  for (const b of c.blindaje ?? []) if (!(NOMBRES_PIEZAS as string[]).includes(b)) malos.push(`${c.nombre}: blindaje «${b}»`);
  if (!/^\d+(d\d+(\+\d+)?)?$/.test(c.pv)) malos.push(`${c.nombre}: pv «${c.pv}»`);
  for (const h of c.habilidades) { if (h.salvacion && !h.cd) malos.push(`${c.nombre}/${h.nombre}: salvación sin CD`); if (nuevos.includes(c.nombre) && h.condicion && !reconocer(h.condicion) && !/^agotamiento \d$/.test(h.condicion)) malos.push(`${c.nombre}/${h.nombre}: condición «${h.condicion}» no reconocida`); }
  if (!c.ataques.length || !c.descripcion || !c.region) malos.push(`${c.nombre}: ficha incompleta`);
}
t(malos.length === 0, "todas las fichas tienen temple, blindaje, PV, condiciones y salvaciones válidos", malos.join(" | "));
// cada criatura se puede invocar, golpear y usar sus habilidades sin error
const fallos: string[] = [];
for (const c of BESTIARIO) {
  const p = nuevaPartida(); normalizarPartida(p); const E = (n: string, d: object): any => ejecutar(n, d, p);
  E("tirar_don_arcano", { jugador: "Ana" }); E("guardar_personaje", { nombre: "Aldo", jugador: "Ana", raza: "Humano del Faro", clase: "Mercenario del Cuervo", nivel: 1, pv_max: 500, ca: 12, atributos: { fue: 12, des: 12, con: 12, int: 10, sab: 10, car: 10 }, inventario: ["Daga"], don_arcano: false, dote: "Terco" });
  const a = E("aparecer_criatura", { nombre: c.nombre }); if (a.error || !(p.jefes[c.nombre]?.pv_max > 0)) { fallos.push(`${c.nombre}: no aparece`); continue; }
  const r = E("atacar", { atacante: c.nombre, objetivo: "Aldo", dano: "1d6" }); if (r.error) fallos.push(`${c.nombre}: atacar → ${String(r.contenido).slice(0, 60)}`);
  for (const h of c.habilidades) { const u = E("habilidad_criatura", { criatura: c.nombre, habilidad: h.nombre, objetivos: ["Aldo"] }); if (u.error && !/recarga|no se ha recargado/i.test(String(u.contenido))) fallos.push(`${c.nombre}/${h.nombre}: ${String(u.contenido).slice(0, 60)}`); }
}
t(fallos.length === 0, "las 40+ criaturas se invocan, atacan y usan sus habilidades sin error", fallos.join(" | "));
const g = bestiarioGrupo(nuevaPartida() as any); t(nuevos.every((n) => g.entradas.some((e) => e.nombre === n)), "las nuevas salen en el bestiario del grupo");
// Ulfhedinn y hombre oso: berserkers que murieron en la furia sin rito
{ const u = BESTIARIO.find((c) => c.nombre === "Ulfhedinn")!, h = BESTIARIO.find((c) => c.nombre === "Hombre oso")!;
  t(u.temple === "no-muerto" && h.temple === "no-muerto" && [u, h].every((c) => c.rasgos.some((r) => /Berserker de Ceniza que murió durante su furia/.test(r)) && c.rasgos.some((r) => /rito de sal y fuego/.test(r))), "ambos son berserkers de Ceniza muertos en plena furia sin rito (no-muertos)");
  t(![u, h].some((c) => /berserker|murió|muerto/i.test(c.descripcion)), "su descripción pública solo cuenta cómo se ven, no su origen");
  const p = nuevaPartida(); normalizarPartida(p); const tm = buscarTema("Ulfhedinn")!; t(buscarTema("Hombre oso")?.id === "caidos" && tm.id === "caidos", "los dos comparten el tema de lore «berserkers caídos»");
  t(/leyenda dice/.test(textoSaber(p, tm, "vulgo")) && !/rito de sal y fuego/.test(textoSaber(p, tm, "vulgo")) && /rito de sal y fuego/.test(textoSaber(p, tm, "letrado")), "el vulgo conoce la leyenda como rumor; los eruditos confirman la verdad");
  const q = nuevaPartida(); normalizarPartida(q); const E = (n: string, d: object): any => ejecutar(n, d, q); E("aparecer_criatura", { nombre: "Ulfhedinn" }); E("danar_criatura", { nombre: "Ulfhedinn", cantidad: 9999 });
  const e = bestiarioGrupo(q).entradas.find((x) => x.nombre === "Ulfhedinn")!; const js = JSON.stringify(e);
  t(/leyenda dice/.test(js) && /rito de sal y fuego/.test(js) && !/Origen \(secreto/.test(js), "tras derrotarlo, su ficha del grupo muestra la leyenda y la verdad erudita, sin la nota secreta del DM"); }
{ const { buscarCriatura } = { buscarCriatura: (n: string) => BESTIARIO.find((c) => c.nombre.toLowerCase() === n.toLowerCase() || c.alias?.some((a) => a.toLowerCase() === n.toLowerCase())) };
  t(buscarCriatura("Hombre lobo")?.nombre === "Ulfhedinn", "«Hombre lobo» es otro nombre del Ulfhedinn");
  const p = nuevaPartida(); normalizarPartida(p); const r = ejecutarCon(p, "aparecer_criatura", { nombre: "Hombre lobo" }); t(!r.error && p.jefes["Hombre lobo"]?.definicion.nombre === "Ulfhedinn", "aparecer_criatura acepta «Hombre lobo»", String(r.contenido).slice(0, 50));
  const u = BESTIARIO.find((c) => c.nombre === "Ulfhedinn")!, h = BESTIARIO.find((c) => c.nombre === "Hombre oso")!;
  t([u, h].every((c) => c.rasgos.some((r) => /Piel fusionada/.test(r)) && c.rasgos.some((r) => /se le fundió con la carne/.test(r))) && /hombre lobo/i.test(u.descripcion) && /hombre oso/i.test(h.descripcion), "la piel se fusiona con ellos: son hombres lobo y hombres oso, no hombres con una piel");
  const { encuentrosDe } = { encuentrosDe: null as any }; void encuentrosDe; }
// El Juez lleva loriga, yelmo, brigantina y grebas: INTERMEDIO entre las placas completas (un 1d8+4 de espada dejaba pasar ~0,8 PV) y la loriga con yelmo (~3,6); el Djinn es de peligro 3
{ const juez = BESTIARIO.find((c) => c.nombre === "El Juez Sin Ojos")!; const pesos: [Region, number][] = [["cabeza", 1], ["cuello", 1], ["torso", 4], ["abdomen", 3], ["brazos", 4], ["piernas", 7]]; let medio = 0;
  for (const [r, w] of pesos) { const prot = proteccion(juez.blindaje ?? [], r, "corte").valor; let suma = 0; for (let d = 1; d <= 8; d++) suma += Math.max(0, d + 4 - prot); medio += (w / 20) * (suma / 8); }
  t(!(juez.blindaje ?? []).includes("placas_completas") && Math.abs(medio - 1.98) < 0.1, "el Juez intermedio: un 1d8+4 de espada le deja pasar ≈ 2 PV de media (entre ~0,8 de las placas y ~3,6 de loriga con yelmo)", medio.toFixed(2));
  t(juez.ca === 19 && juez.pv === "180" && juez.ataques.length === 1 && /\+11, 2d6\+5/.test(juez.ataques[0]), "el Juez conserva CA 19, 180 PV y su ataque (solo cambia el blindaje)");
  t(BESTIARIO.find((c) => c.nombre === "Djinn")!.peligro === 3 && BESTIARIO.find((c) => c.nombre === "Djinn")!.vd === "6", "Djinn: peligro 3, VD 6"); }
console.log(`${ok} ok, ${mal} fallas`);
