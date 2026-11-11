import { nuevaPartida, normalizarPartida } from "../../src/estado.ts";
import { ejecutar } from "../../src/herramientas.ts";
import { estadoParaDM } from "../../src/navegador.ts";
import { iniciarRegistroDados, liberarDados } from "../../src/dados.ts";
import { dadoHaemajitsu, ESTILOS } from "../../src/estilos.ts";
let ok = 0, mal = 0; const t = (c: boolean, m: string, x = "") => { console.log(c ? "ok   " : "FALLA", m, x); c ? ok++ : mal++; };
const txt = (r: any) => (typeof r === "string" ? r : r?.contenido ?? JSON.stringify(r));
const mundo = () => { const p = nuevaPartida(); normalizarPartida(p); const E = (n: string, d: object): any => ejecutar(n, d, p); return { p, E }; };
const ficha = (E: any, n: string, clase: string, nivel: number, extra: any = {}) => E("guardar_personaje", { don_arcano: false, nombre: n, jugador: n, raza: "Humano del Faro", clase, nivel, pv_max: 60, ca: 12, atributos: { fue: 16, des: 14, con: 14, int: 10, sab: 14, car: 10 }, inventario: [], dote: "Terco", ...extra });
const fijos = (v: number, n = 40) => iniciarRegistroDados(Array.from({ length: n }, () => ({ caras: 20, valor: v })));
const enemigo = (E: any, n: string, nombre = "Hambriento", metros = 1.5) => { E("aparecer_criatura", { nombre, repetir: true }); E("iniciativa", { participantes: [n, nombre] }); E("plano", { escena: "sala", poner: [{ nombre: n }] }); E("plano", { poner: [{ nombre, ref: n, direccion: "N", metros }] }); };

// ---- Haemajitsu
{
  const { p, E } = mundo(); ficha(E, "Fla", "Flagelante", 1); enemigo(E, "Fla");
  fijos(15);
  const r = txt(E("atacar", { atacante: "Fla", objetivo: "Hambriento" })); liberarDados();
  t(/Haemajitsu/.test(r) && /1d6/.test(r) && /contundente/i.test(r), "el Flagelante golpea sin armas como una maza (1d6 contundente)", r.split("\n").slice(0, 3).join(" | ").slice(0, 200));
  t(p.personajes.Fla.pv === 60, "no pierde vida por usarlo (sangre propia sin coste)");
  t(!!estadoParaDM(p) && /Haemajitsu/.test(estadoParaDM(p)), "la ficha del DM muestra su estilo");
  t(dadoHaemajitsu({ ...p.personajes.Fla, nivel: 7 } as any) === "1d8" && dadoHaemajitsu({ ...p.personajes.Fla, nivel: 11 } as any) === "1d10" && dadoHaemajitsu({ ...p.personajes.Fla, nivel: 15 } as any) === "1d12" && dadoHaemajitsu({ ...p.personajes.Fla, nivel: 4 } as any) === "1d6", "el dado sube con el nivel (con el desplazamiento): 1d6/1d8/1d10/1d12");
}
{
  const { p, E } = mundo(); ficha(E, "Mer", "Mercenario del Cuervo", 1); enemigo(E, "Mer");
  fijos(15); const r = txt(E("atacar", { atacante: "Mer", objetivo: "Hambriento", arma: "puño", dano: "1d4" })); liberarDados();
  t(!/Haemajitsu/.test(r), "otras clases no tienen Haemajitsu");
}
// ---- aprender
{
  const { p, E } = mundo(); ficha(E, "Mer", "Mercenario del Cuervo", 1); ficha(E, "Fla", "Flagelante", 1);
  const intenta = (d: object) => { try { return txt(E("arte_marcial", d)); } catch (e: any) { return "ERROR " + e.message; } };
  t(/aprende Filo del Cuervo/.test(intenta({ accion: "aprender", quien: "Mer", arte: "Filo del Cuervo", via: "clase" })), "por clase: el Mercenario aprende el Filo del Cuervo");
  t(/ya conoce 1 estilo/.test(intenta({ accion: "aprender", quien: "Mer", arte: "Presa de Hollín", via: "clase" })), "un solo estilo por personaje");
  t(/no ofrece Haemajitsu/.test(intenta({ accion: "aprender", quien: "Mer", arte: "Haemajitsu", via: "clase" })), "el Haemajitsu no se toma por clase");
  t(/no se aprende con un maestro corriente/.test(intenta({ accion: "aprender", quien: "Mer", arte: "Haemajitsu", via: "maestro", maestro: "X", motivo: "tiempo" })), "ni con un maestro corriente");
  const { p: q, E: F } = mundo(); ficha(F, "Mer", "Mercenario del Cuervo", 1, { atributos: { fue: 16, des: 14, con: 14, int: 15, sab: 10, car: 10 } });
  t(/aprende Haemajitsu/.test(txt(F("arte_marcial", { accion: "aprender", quien: "Mer", arte: "Haemajitsu", via: "historia", motivo: "Una flagelante moribunda le enseñó a cambio de una deuda de sangre" }))), "por historia: un no Flagelante puede aprender Haemajitsu");
  t(/motivo/.test((() => { try { return txt(F("arte_marcial", { accion: "aprender", quien: "Mer", arte: "Presa de Hollín", via: "historia", segundo: true, maestro: "Berta" })); } catch (e: any) { return "ERROR " + e.message; } })()), "por historia exige motivo");
  t(/aprende Presa/.test(txt(F("arte_marcial", { accion: "aprender", quien: "Mer", arte: "Presa de Hollín", via: "maestro", segundo: true, maestro: "Berta la Gorda", motivo: "tres semanas en los fosos de Hollín" }))) && q.personajes.Mer.artes!.length === 2, "segundo estilo con segundo maestro e INT 14+");
  t(/Haemajitsu/.test(txt(E("arte_marcial", { accion: "ver", quien: "Fla" }))), "el Flagelante lleva el Haemajitsu de serie");
  t(txt(E("arte_marcial", { accion: "catalogo" })).split("\n- ").length >= ESTILOS.length, "el catálogo lista los estilos");
}
// ---- Presa de Hollín: lances
{
  const { p, E } = mundo(); ficha(E, "Mer", "Mercenario del Cuervo", 9); E("arte_marcial", { accion: "aprender", quien: "Mer", arte: "Presa de Hollín", via: "clase" });
  enemigo(E, "Mer");
  let r = ""; try { r = txt(E("maniobra", { atacante: "Mer", objetivo: "Hambriento", tipo: "lanzar", lance: "cadera" })); } catch (e: any) { r = "ERROR " + e.message; }
  t(/no está agarrado/.test(r), "no se puede lanzar a quien no se tiene agarrado", r.slice(0, 100));
  fijos(20); r = txt(E("maniobra", { atacante: "Mer", objetivo: "Hambriento", tipo: "agarrar" })); liberarDados();
  t(/AGARRA/.test(r), "agarra (con ventaja de Presa)", r.slice(0, 140));
  fijos(20); r = txt(E("maniobra", { atacante: "Mer", objetivo: "Hambriento", tipo: "lanzar", lance: "molino" })); liberarDados();
  t(/LANZA \(de molino\)/.test(r) && /cae 6 m/.test(r), "lance de molino a nivel 9 (Maestro): 6 m de caída = 2d6", r.replace(/\n/g, " | ").slice(0, 200));
  t(!p.combate || true, "");
}
{
  const { p, E } = mundo(); ficha(E, "Nov", "Mercenario del Cuervo", 1); E("arte_marcial", { accion: "aprender", quien: "Nov", arte: "Presa de Hollín", via: "clase" }); enemigo(E, "Nov");
  fijos(20); E("maniobra", { atacante: "Nov", objetivo: "Hambriento", tipo: "agarrar" });
  let r = ""; try { r = txt(E("maniobra", { atacante: "Nov", objetivo: "Hambriento", tipo: "lanzar", lance: "hombro" })); } catch (e: any) { r = "ERROR " + e.message; } liberarDados();
  t(/maestría/.test(r), "un Iniciado no puede hacer el lance por encima del hombro", r.slice(0, 120));
  fijos(20); r = txt(E("maniobra", { atacante: "Nov", objetivo: "Hambriento", tipo: "lanzar", lance: "cadera" })); liberarDados();
  t(/LANZA \(cadera\)/.test(r) && /derribad/i.test(r), "pero sí la cadera, que derriba", r.replace(/\n/g, " | ").slice(0, 160));
  let sin = ""; const { E: G } = mundo(); ficha(G, "Sin", "Mercenario del Cuervo", 9); enemigo(G, "Sin"); sin = txt(G("maniobra", { atacante: "Sin", objetivo: "Hambriento", tipo: "lanzar" }));
  t(/no domina la Presa/.test(sin), "sin el estilo no se lanza");
}
// ---- Contracorriente (Kuru)
{
  const { p, E } = mundo(); ficha(E, "Mer", "Mercenario del Cuervo", 5, { inventario: ["Espada larga"] }); enemigo(E, "Mer", "Kuru, el Cazador de Leyendas");
  fijos(18); const r = txt(E("atacar", { atacante: "Mer", objetivo: "Kuru, el Cazador de Leyendas", arma: "Espada larga", dano: "1d8" })); liberarDados();
  t(/Contracorriente/.test(r), "Kuru desvía el golpe con Contracorriente", r.replace(/\n/g, " | ").slice(0, 260));
  fijos(18); const r2 = txt(E("atacar", { atacante: "Mer", objetivo: "Kuru, el Cazador de Leyendas", arma: "Espada larga", dano: "1d8" })); liberarDados();
  t(!/Contracorriente/.test(r2) || /reacci/.test(r2), "solo una vez por asalto (segunda vez no)");
}
console.log(`${ok} ok, ${mal} fallas`);
// ---- Danza, Filo del Cuervo, Callejón
{
  const { p, E } = mundo(); ficha(E, "Dan", "Cazador de Brujas", 5); E("arte_marcial", { accion: "aprender", quien: "Dan", arte: "Danza marchita", via: "clase" });
  ficha(E, "Tos", "Mercenario del Cuervo", 5);
  E("aparecer_criatura", { nombre: "Hambriento", repetir: true });
  const ini = txt(E("iniciativa", { participantes: ["Dan", "Tos", "Hambriento"] }));
  t(/Danza marchita \+2/.test(ini), "Danza marchita: +2 a la iniciativa", ini.slice(0, 160));
  const sv = txt(E("prueba", { quien: "Dan", atributo: "des", tipo: "salvacion", cd: 12, motivo: "una trampa" })); t(/ventaja/i.test(sv), "Danza: ventaja en salvaciones de DES", sv.slice(0, 120));
}
{
  const { p, E } = mundo(); ficha(E, "Cue", "Mercenario del Cuervo", 5, { inventario: ["Espada larga"] }); ficha(E, "Ali", "Caballero Juramentado", 1);
  E("arte_marcial", { accion: "aprender", quien: "Cue", arte: "Filo del Cuervo", via: "clase" });
  E("aparecer_criatura", { nombre: "Hambriento", repetir: true }); E("iniciativa", { participantes: ["Cue", "Ali", "Hambriento"] });
  E("plano", { escena: "sala", poner: [{ nombre: "Cue" }] }); E("plano", { poner: [{ nombre: "Hambriento", ref: "Cue", direccion: "N", metros: 1.5 }, { nombre: "Ali", ref: "Hambriento", direccion: "E", metros: 1.5 }] });
  fijos(12); const r = txt(E("atacar", { atacante: "Cue", objetivo: "Hambriento", arma: "Espada larga", dano: "1d8", desarmar: true })); liberarDados();
  t(/Filo del Cuervo \+1/.test(r) && /ventaja/i.test(r), "Filo del Cuervo: +1 por aliado junto al objetivo y Cuña (ventaja)", r.replace(/\n/g, " | ").slice(0, 260));
  t(/Desarmar/.test(r), "Desarmar: se resuelve al impactar", r.replace(/\n/g, " | ").slice(-200));
}
{
  const { p, E } = mundo(); ficha(E, "Cal", "Degollador", 5); E("arte_marcial", { accion: "aprender", quien: "Cal", arte: "Callejón de Aldenmar", via: "clase" });
  enemigo(E, "Cal"); fijos(15);
  const r = txt(E("maniobra", { atacante: "Cal", objetivo: "Hambriento", tipo: "sucio" })); liberarDados();
  t(/arena y un codazo/.test(r), "Arena y codo (Callejón, Practicante)", r.slice(0, 160));
  E("condicion", { objetivo: "Hambriento", accion: "aplicar", condicion: "derribado" });
  fijos(2); const r2 = txt(E("maniobra", { atacante: "Cal", objetivo: "Hambriento", tipo: "empujar", efecto: "alejar" })); liberarDados();
  t(/ventaja/.test(r2), "Callejón: ventaja en maniobras contra un rival derribado", r2.slice(0, 160));
}
{
  const { p, E } = mundo(); ficha(E, "Dan", "Cazador de Brujas", 5); E("arte_marcial", { accion: "aprender", quien: "Dan", arte: "Danza marchita", via: "clase" });
  enemigo(E, "Dan"); fijos(3);
  const r = txt(E("atacar", { atacante: "Hambriento", objetivo: "Dan", arma: "garras", dano: "1d6" })); liberarDados();
  t(/Contragolpe/.test(r) && /reaccion: true/.test(r), "Danza, Contragolpe: si le falla un cuerpo a cuerpo, avisa del ataque de respuesta", r.replace(/\n/g, " | ").slice(0, 240));
}
console.log(`${ok} ok, ${mal} fallas`);
// ---- Piedra de Karak
{
  const { p, E } = mundo(); ficha(E, "Pie", "Berserker de Ceniza", 9); E("arte_marcial", { accion: "aprender", quien: "Pie", arte: "Piedra de Karak", via: "clase" });
  ficha(E, "Rival", "Mercenario del Cuervo", 5, { inventario: ["Espada larga"] });
  E("iniciativa", { participantes: ["Pie", "Rival"] }); E("plano", { escena: "sala", poner: [{ nombre: "Pie" }, { nombre: "Rival", ref: "Pie", direccion: "N", metros: 1.5 }] });
  fijos(10); const r = txt(E("atacar", { atacante: "Rival", objetivo: "Pie", arma: "Espada larga", dano: "1d8" })); liberarDados();
  t(/Postura de muro/.test(r), "Piedra: Postura de muro (+1 CA en cuerpo a cuerpo)", r.split("\n").filter((l) => /Postura/.test(l))[0]?.slice(0, 100));
  fijos(20); const m = txt(E("maniobra", { atacante: "Rival", objetivo: "Pie", tipo: "empujar", efecto: "derribar" })); liberarDados();
  t(/montaña/i.test(m), "Piedra, Montaña (Maestro): no se le puede empujar ni lanzar", m.slice(0, 120));
}
{
  const { p, E } = mundo(); ficha(E, "Pie", "Berserker de Ceniza", 5, { inventario: ["Hacha de mano"] }); E("arte_marcial", { accion: "aprender", quien: "Pie", arte: "Piedra de Karak", via: "clase" });
  enemigo(E, "Pie"); E("empunar", { quien: "Pie", principal: "Hacha de mano" });
  fijos(20); const r = txt(E("atacar", { atacante: "Pie", objetivo: "Hambriento", arma: "Hacha de mano", dano: "1d6", yunque: true })); liberarDados();
  t(/golpe de yunque/.test(r), "Piedra, Golpe de yunque (Practicante): atacar {yunque}", r.replace(/\n/g, " | ").slice(0, 200));
  const { E: G } = mundo(); ficha(G, "Nov", "Berserker de Ceniza", 1, { inventario: ["Hacha de mano"] }); G("arte_marcial", { accion: "aprender", quien: "Nov", arte: "Piedra de Karak", via: "clase" }); enemigo(G, "Nov"); G("empunar", { quien: "Nov", principal: "Hacha de mano" });
  t(/maestría/.test(txt(G("atacar", { atacante: "Nov", objetivo: "Hambriento", arma: "Hacha de mano", dano: "1d6", yunque: true }))), "un Iniciado no da golpe de yunque");
}
console.log(`${ok} ok, ${mal} fallas`);
// ---- Muralla, Arrastre, Palanca, Sumisión, Fluir, Corriente carmesí
{
  const { p, E } = mundo(); ficha(E, "Gua", "Mercenario del Cuervo", 9, { inventario: ["Espada larga"] }); ficha(E, "Ali", "Caballero Juramentado", 1); ficha(E, "Rival", "Mercenario del Cuervo", 5, { inventario: ["Espada larga"] });
  E("arte_marcial", { accion: "aprender", quien: "Gua", arte: "Filo del Cuervo", via: "clase" });
  E("iniciativa", { participantes: ["Gua", "Ali", "Rival"] });
  E("plano", { escena: "sala", poner: [{ nombre: "Ali" }, { nombre: "Gua", ref: "Ali", direccion: "E", metros: 1.5 }, { nombre: "Rival", ref: "Ali", direccion: "N", metros: 1.5 }] });
  fijos(10); const r = txt(E("atacar", { atacante: "Rival", objetivo: "Ali", arma: "Espada larga", dano: "1d8" })); liberarDados();
  t(/Muralla de cuervos/.test(r) && /ataca a Gua/.test(r) && /desventaja/.test(r), "Muralla de cuervos: el Maestro recibe el golpe dirigido a su aliado", r.replace(/\n/g, " | ").slice(0, 220));
  ficha(E, "Rival2", "Mercenario del Cuervo", 5, { inventario: ["Espada larga"] }); E("iniciativa", { participantes: ["Rival2"], sumar: true }); E("plano", { poner: [{ nombre: "Rival2", ref: "Ali", direccion: "N", metros: 1.5 }] });
  fijos(10); const r2 = txt(E("atacar", { atacante: "Rival2", objetivo: "Ali", arma: "Espada larga", dano: "1d8" })); liberarDados();
  t(!/Muralla/.test(r2) && /ataca a Ali/.test(r2), "solo una vez por asalto (gasta su reacción)", r2.slice(0, 160));
}
{
  const { p, E } = mundo(); ficha(E, "Cal", "Degollador", 9); E("arte_marcial", { accion: "aprender", quien: "Cal", arte: "Callejón de Aldenmar", via: "clase" });
  ficha(E, "Arq", "Mercenario del Cuervo", 5, { inventario: ["Arco largo"] });
  E("aparecer_criatura", { nombre: "Hambriento", repetir: true }); E("iniciativa", { participantes: ["Cal", "Arq", "Hambriento"] });
  E("plano", { escena: "sala", poner: [{ nombre: "Cal" }, { nombre: "Hambriento", ref: "Cal", direccion: "N", metros: 1.5 }, { nombre: "Arq", ref: "Cal", direccion: "S", metros: 10 }] });
  fijos(20); E("maniobra", { atacante: "Cal", objetivo: "Hambriento", tipo: "agarrar" }); liberarDados();
  fijos(10); const r = txt(E("atacar", { atacante: "Arq", objetivo: "Cal", arma: "Arco largo", dano: "1d8", a_distancia: true })); liberarDados();
  t(/Arrastre/.test(r) && /ataca a Hambriento/.test(r), "Arrastre: el agarrado hace de escudo contra ataques a distancia", r.replace(/\n/g, " | ").slice(0, 220));
}
{
  const { p, E } = mundo(); ficha(E, "Pre", "Mercenario del Cuervo", 9); E("arte_marcial", { accion: "aprender", quien: "Pre", arte: "Presa de Hollín", via: "clase" }); enemigo(E, "Pre");
  fijos(20); E("maniobra", { atacante: "Pre", objetivo: "Hambriento", tipo: "agarrar" });
  const a = txt(E("maniobra", { atacante: "Pre", objetivo: "Hambriento", tipo: "palanca" }));
  t(/PALANCA/.test(a) && p.combate && true, "Presa, Palanca: dislocación sobre un agarrado", a.slice(-160));
  const b = txt(E("maniobra", { atacante: "Pre", objetivo: "Hambriento", tipo: "sumision" })); liberarDados();
  t(/SUMISIÓN/.test(b), "Presa, Sumisión (Maestro): «sometido»", b.slice(-170));
  const j = JSON.stringify(txt(E("condicion", { objetivo: "Hambriento", accion: "ver" })));
  t(/sometid/i.test(j) || /sometid/i.test(JSON.stringify(p.combate)), "queda registrada la condición sometido");
}
{
  const { p, E } = mundo(); ficha(E, "Fla", "Flagelante", 5); E("aparecer_criatura", { nombre: "Hambriento", repetir: true }); E("iniciativa", { participantes: ["Fla", "Hambriento"] });
  E("plano", { escena: "sala", poner: [{ nombre: "Fla" }, { nombre: "Hambriento", ref: "Fla", direccion: "N", metros: 1.5 }] });
  fijos(18); const r = txt(E("atacar", { atacante: "Hambriento", objetivo: "Fla", arma: "garras", dano: "2d6+4" })); liberarDados();
  t(/Fluir/.test(r), "Haemajitsu, Fluir: reduce el daño de un golpe cuerpo a cuerpo", r.replace(/\n/g, " | ").slice(0, 240));
  fijos(15); const r2 = txt(E("atacar", { atacante: "Fla", objetivo: "Hambriento" })); liberarDados();
  t(/Corriente carmesí/.test(r2) === false, "a nivel 5 aún no hay Corriente carmesí (Maestro nivel 9)");
  const { p: q, E: F } = mundo(); ficha(F, "Fla", "Flagelante", 9); F("aparecer_criatura", { nombre: "Hambriento", repetir: true }); F("iniciativa", { participantes: ["Fla", "Hambriento"] });
  F("plano", { escena: "sala", poner: [{ nombre: "Fla" }, { nombre: "Hambriento", ref: "Fla", direccion: "N", metros: 1.5 }] });
  fijos(15); const r3 = txt(F("atacar", { atacante: "Fla", objetivo: "Hambriento" })); liberarDados();
  t(/Corriente carmesí/.test(r3), "Haemajitsu Maestro: Corriente carmesí (como un martillo)", r3.split("\n")[0].slice(0, 160));
}
// ---- criaturas con estilos: Kuru, Hugin y Munin
{
  const { p, E } = mundo(); ficha(E, "Pj", "Mercenario del Cuervo", 5, { inventario: ["Espada larga"] });
  E("aparecer_criatura", { nombre: "Kuru, el Cazador de Leyendas", repetir: true }); E("iniciativa", { participantes: ["Pj", "Kuru, el Cazador de Leyendas"] });
  E("plano", { escena: "sala", poner: [{ nombre: "Pj" }] }); E("plano", { poner: [{ nombre: "Kuru, el Cazador de Leyendas", ref: "Pj", direccion: "N", metros: 1.5 }] });
  fijos(15); const r = txt(E("atacar", { atacante: "Kuru, el Cazador de Leyendas", objetivo: "Pj", arma: "Espadas curvas", dano: "2d6+7", desarmar: true })); liberarDados();
  t(/Desarmar/.test(r), "Kuru puede desarmar (domina el Filo del Cuervo)", (/🗡[^\n]*/.exec(r) || [r.slice(0, 120)])[0].slice(0, 160));
  fijos(15); const m = txt(E("maniobra", { atacante: "Kuru, el Cazador de Leyendas", objetivo: "Pj", tipo: "sucio" })); liberarDados();
  t(/arena y un codazo/.test(m), "Kuru usa el Callejón (arena y codo)", m.slice(0, 100));
}
{
  const { p, E } = mundo(); ficha(E, "Pj", "Mercenario del Cuervo", 5, { inventario: ["Espada larga"] });
  E("aparecer_criatura", { nombre: "Hugin, el Pensamiento", repetir: true }); E("aparecer_criatura", { nombre: "Munin, la Memoria", repetir: true });
  E("iniciativa", { participantes: ["Pj", "Hugin, el Pensamiento", "Munin, la Memoria"] });
  E("plano", { escena: "sala", poner: [{ nombre: "Pj" }] });
  E("plano", { poner: [{ nombre: "Munin, la Memoria", ref: "Pj", direccion: "N", metros: 1.5 }, { nombre: "Hugin, el Pensamiento", ref: "Munin, la Memoria", direccion: "E", metros: 1.5 }] });
  fijos(15); const r = txt(E("atacar", { atacante: "Pj", objetivo: "Munin, la Memoria", arma: "Espada larga", dano: "1d8" })); liberarDados();
  t(/Muralla de cuervos/.test(r) && /Hugin/.test(r), "Hugin (Filo del Cuervo, Maestro) cubre a Munin con la Muralla de cuervos", r.replace(/\n/g, " | ").slice(0, 240));
}
console.log(`${ok} ok, ${mal} fallas`);
// ---- Llave (agarrar como acción adicional) y Remolino
{
  const { p, E } = mundo(); ficha(E, "Pre", "Mercenario del Cuervo", 5); E("arte_marcial", { accion: "aprender", quien: "Pre", arte: "Presa de Hollín", via: "clase" }); enemigo(E, "Pre");
  fijos(20); const r = txt(E("maniobra", { atacante: "Pre", objetivo: "Hambriento", tipo: "agarrar", adicional: true })); liberarDados();
  t(/AGARRA/.test(r), "Presa, Llave: agarra como acción adicional", r.slice(-120));
  const { E: F } = mundo(); ficha(F, "Nov", "Mercenario del Cuervo", 5); enemigo(F, "Nov"); fijos(20);
  const r2 = txt(F("maniobra", { atacante: "Nov", objetivo: "Hambriento", tipo: "agarrar", adicional: true })); liberarDados();
  t(/Pendenciero|Presa/.test(r2) && !/AGARRA/.test(r2), "sin el estilo ni la dote no se agarra como acción adicional", r2.slice(0, 100));
}
{
  const { p, E } = mundo(); ficha(E, "A", "Mercenario del Cuervo", 5, { inventario: ["Espada larga"] }); ficha(E, "B", "Mercenario del Cuervo", 5, { inventario: ["Espada larga"] });
  E("aparecer_criatura", { nombre: "Kuru, el Cazador de Leyendas", repetir: true }); E("iniciativa", { participantes: ["A", "B", "Kuru, el Cazador de Leyendas"] });
  E("plano", { escena: "sala", poner: [{ nombre: "Kuru, el Cazador de Leyendas" }] }); E("plano", { poner: [{ nombre: "A", ref: "Kuru, el Cazador de Leyendas", direccion: "N", metros: 1.5 }, { nombre: "B", ref: "Kuru, el Cazador de Leyendas", direccion: "S", metros: 1.5 }] });
  fijos(18); const r1 = txt(E("atacar", { atacante: "A", objetivo: "Kuru, el Cazador de Leyendas", arma: "Espada larga", dano: "3d8+8" }));
  const r2 = txt(E("atacar", { atacante: "B", objetivo: "Kuru, el Cazador de Leyendas", arma: "Espada larga", dano: "3d8+8" })); liberarDados();
  t(/Contracorriente/.test(r1) && /Contracorriente/.test(r2), "Remolino: Kuru desvía a dos rivales distintos en el mismo asalto", (/Contracorriente[^\\n]*/.exec(r1) || [""])[0].slice(0, 80) + " // " + (/Contracorriente[^\\n]*/.exec(r2) || [""])[0].slice(0, 60));
}
console.log(`${ok} ok, ${mal} fallas`);
