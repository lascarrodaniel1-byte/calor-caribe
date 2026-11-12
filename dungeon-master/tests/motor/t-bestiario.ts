import { nuevaPartida, normalizarPartida } from "../../src/estado.ts";
import { ejecutar } from "../../src/herramientas.ts";
import { BESTIARIO, buscarCriatura, textoBestiario } from "../../src/bestiario.ts";
import { ataquesDeCriatura, legendariasDe } from "../../src/combate.ts";
import { iniciarRegistroDados, liberarDados } from "../../src/dados.ts";
import { TABLA } from "../../src/encuentros.ts";
import { TEMPLES } from "../../src/combate.ts";
import { NOMBRES_PIEZAS, proteccion } from "../../src/armadura.ts";
import { reconocer } from "../../src/condiciones.ts";
import { buscarTema, textoSaber } from "../../src/saber.ts";
import { bestiarioGrupo, descubrirCodice } from "../../src/codice.ts";
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
// Gorgon: bestia con forma de toro, aliento petrificante (retenido y luego petrificado) y embestida
{ const G = BESTIARIO.find((c) => c.nombre === "Gorgon")!;
  const buscar = (n: string) => BESTIARIO.find((c) => c.nombre.toLowerCase() === n.toLowerCase()) ?? BESTIARIO.find((c) => c.alias?.some((a) => a.toLowerCase() === n.toLowerCase()));
  t(!!G && G.categoria === "bestia" && G.temple === "bestia" && G.peligro === 3 && G.vd === "7" && BESTIARIO.length === 45, "el Gorgon es una bestia de peligro 3, VD 7 (45 criaturas)");
  t(buscar("Gorgona")?.nombre === "Gorgon" && buscar("Toro de hierro")?.nombre === "Gorgon" && buscarCriatura("Gorgona")?.nombre === "Gorgon", "«Gorgona» y «Toro de hierro» son alias del Gorgon");
  const alias = BESTIARIO.flatMap((c) => [c.nombre, ...(c.alias ?? [])].map((a) => a.toLowerCase())); t(new Set(alias).size === alias.length, "ningún nombre ni alias se repite entre criaturas");
  t((G.blindaje ?? []).length > 0 && G.blindaje!.every((b) => (NOMBRES_PIEZAS as string[]).includes(b)) && !G.blindaje!.includes("placas_completas"), "blindaje válido (escamas naturales), sin ser inmune");
  const pasa = proteccion(G.blindaje ?? [], "torso", "corte").valor; t(pasa > 0 && pasa < 8, "las escamas protegen del filo pero un golpe fuerte atraviesa", String(pasa));
  t(ataquesDeCriatura(G) === 1 && G.ataques.every((a) => !/\(x\d/i.test(a)) && legendariasDe(G) === 0, "economía: un solo ataque por asalto (sin multiataque) y sin acciones legendarias");
  t(G.habilidades.some((h) => h.nombre === "Aliento petrificante" && h.salvacion === "con" && h.recarga === 5 && reconocer(h.condicion ?? "")?.id === "retenido") && G.habilidades.some((h) => h.nombre === "Embestida" && h.salvacion === "fue" && h.cd === 16 && reconocer(h.condicion ?? "")?.id === "derribado"), "aliento (CON, retenido) y embestida (FUE, derribado) con condiciones del catálogo");
  t(/PROPUESTA a confirmar/.test(G.botin ?? "") && G.rasgos.some((r) => /^Origen \(secreto/.test(r) && /PROPUESTA/.test(r)), "la cura y el origen están marcados como propuesta");
  const p = nuevaPartida(); normalizarPartida(p); const E = (n: string, d: object): any => ejecutar(n, d, p);
  E("tirar_don_arcano", { jugador: "Ana" }); E("guardar_personaje", { nombre: "Aldo", jugador: "Ana", raza: "Humano del Faro", clase: "Mercenario del Cuervo", nivel: 1, pv_max: 500, ca: 12, atributos: { fue: 10, des: 10, con: 10, int: 10, sab: 10, car: 10 }, inventario: ["Daga"], don_arcano: false, dote: "Terco" });
  const a = E("aparecer_criatura", { nombre: "Gorgona" }); const pv = p.jefes["Gorgona"]?.pv_max ?? 0;
  t(!a.error && p.jefes["Gorgona"]?.definicion.nombre === "Gorgon" && pv >= 15 * 1 + 45 && pv <= 15 * 10 + 45, "aparecer_criatura crea al Gorgon (por alias) con sus PV", String(pv));
  iniciarRegistroDados(Array.from({ length: 50 }, () => ({ caras: 20, valor: 1 })));
  const r = E("habilidad_criatura", { criatura: "Gorgona", habilidad: "Aliento petrificante", objetivos: ["Aldo"] });
  t(!r.error && /retenido/.test(p.personajes["Aldo"].condiciones.join("|")) && !p.personajes["Aldo"].condiciones.some((c: string) => reconocer(c)?.id === "petrificado"), "el aliento (salvación de CON fallada) deja al personaje retenido, aún no petrificado", String(r.contenido).slice(-160));
  const q = E("condicion", { objetivo: "Aldo", accion: "aplicar", condicion: "petrificado" }); t(!q.error && p.personajes["Aldo"].condiciones.some((c: string) => /petrificado/.test(c)), "el DM resuelve la fase 2 con condicion aplicar «petrificado»", String(q.contenido).slice(0, 80));
  const w = E("condicion", { objetivo: "Aldo", accion: "quitar", condicion: "petrificado" }); t(!w.error && !p.personajes["Aldo"].condiciones.some((c: string) => reconocer(c)?.id === "petrificado"), "y la hiel (el DM) la quita con condicion quitar");
  iniciarRegistroDados(Array.from({ length: 50 }, () => ({ caras: 20, valor: 20 })));
  const ok2 = E("habilidad_criatura", { criatura: "Gorgona", habilidad: "Aliento petrificante", objetivos: ["Aldo"] }); t(/recarga|no se ha recargado/i.test(String(ok2.contenido)) || !ok2.error, "el aliento tiene recarga 5-6 (la segunda vez tira la recarga)");
  liberarDados();
  const q2 = nuevaPartida(); normalizarPartida(q2); const E2 = (n: string, d: object): any => ejecutar(n, d, q2);
  E2("tirar_don_arcano", { jugador: "Ana" }); E2("guardar_personaje", { nombre: "Aldo", jugador: "Ana", raza: "Humano del Faro", clase: "Mercenario del Cuervo", nivel: 1, pv_max: 500, ca: 12, atributos: { fue: 10, des: 10, con: 10, int: 10, sab: 10, car: 10 }, inventario: ["Daga"], don_arcano: false, dote: "Terco" });
  E2("aparecer_criatura", { nombre: "Gorgon" });
  iniciarRegistroDados([{ caras: 10, valor: 5 }, { caras: 10, valor: 5 }, { caras: 20, valor: 1 }]);
  const e = E2("habilidad_criatura", { criatura: "Gorgon", habilidad: "Embestida", objetivos: ["Aldo"] }); liberarDados();
  t(!e.error && q2.personajes["Aldo"].condiciones.some((c: string) => /derribado/.test(c)) && q2.personajes["Aldo"].pv === 500 - 15, "la embestida (dados fijos 5+5+5, salvación fallada) hace 15 de daño y derriba", `${q2.personajes["Aldo"].pv} ${q2.personajes["Aldo"].condiciones}`);
  // encuentro
  const enc = TABLA.find((x) => x.id === "gorgon"); t(!!enc && enc.familia === "fauna" && enc.bestiario === "Gorgon" && !!buscarCriatura(enc.bestiario) && enc.cuantos[0] === 1 && enc.cuantos[1] === 1 && enc.regiones.some((r) => /Marca Hueca/.test(r)) && enc.regiones.some((r) => /Agujas/.test(r)) && enc.regiones.some((r) => /Karak/.test(r)) && enc.peligro === G.peligro, "el encuentro «gorgon» (fauna, 1, Marca Hueca/Agujas/Karak) apunta a una plantilla válida");
  // códice del grupo
  const g0 = bestiarioGrupo(nuevaPartida() as any).entradas.find((x) => x.nombre === "Gorgon"); t(!!g0 && g0.secciones.some((s) => s.titulo === "Cómo ataca" && !!s.bloqueada) && g0.secciones.some((s) => s.titulo === "Rasgos y puntos débiles" && !!s.bloqueada), "el Gorgon sale en el bestiario del grupo con «Cómo ataca» y «Rasgos» bloqueados");
  const r3 = nuevaPartida(); normalizarPartida(r3); const E3 = (n: string, d: object): any => ejecutar(n, d, r3); E3("aparecer_criatura", { nombre: "Gorgon" }); E3("danar_criatura", { nombre: "Gorgon", cantidad: 9999 });
  const g1 = bestiarioGrupo(r3).entradas.find((x) => x.nombre === "Gorgon")!; const js = JSON.stringify(g1);
  t(g1.derrotadas === 1 && g1.secciones.every((s) => !s.bloqueada || s.titulo !== "Cómo ataca") && /Aliento petrificante|Cornada/.test(js) && !/Origen \(secreto/.test(js), "al derrotarlo, el grupo ve cómo ataca y sus rasgos, sin la nota secreta del DM");
  const d = nuevaPartida(); normalizarPartida(d); const dd = descubrirCodice(d, { tema: "Gorgona", texto: "Teme al fuego grande" }); t(/Gorgon/.test(dd) && bestiarioGrupo(d).entradas.find((x) => x.nombre === "Gorgon")!.notas.length === 1, "descubrirCodice anota una nota del grupo sobre el Gorgon por alias");
  t(textoBestiario().includes("- Gorgon (peligro 3, VD 7"), "textoBestiario (consultar_reglas bestiario) lista al Gorgon"); }
console.log(`${ok} ok, ${mal} fallas`);
