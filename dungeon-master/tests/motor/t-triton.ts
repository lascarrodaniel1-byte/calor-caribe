import { nuevaPartida, normalizarPartida } from "../../src/estado.ts";
import { ejecutar } from "../../src/herramientas.ts";
import { BESTIARIO, buscarCriatura, fichaCriatura } from "../../src/bestiario.ts";
import { RAZAS } from "../../src/mundo.ts";
import { TABLA } from "../../src/encuentros.ts";
import { danoConResistencia, rasgosAutomaticos } from "../../src/rasgos.ts";
let ok = 0, mal = 0; const t = (c: boolean, m: string, x = "") => { console.log(c ? "ok   " : "FALLA", m, x); c ? ok++ : mal++; };
const txt = (r: any) => (typeof r === "string" ? r : r?.contenido ?? JSON.stringify(r));
const P = nuevaPartida(); normalizarPartida(P);
const g = (n: string, raza: string) => txt(ejecutar("guardar_personaje", { don_arcano: false, nombre: n, jugador: n, raza, clase: "Mercenario del Cuervo", nivel: 1, pv_max: 20, ca: 12, atributos: { fue: 14, des: 12, con: 14, int: 10, sab: 10, car: 10 }, inventario: ["Espada larga"], dote: "Terco" }, P));
t(RAZAS.some((r) => r.nombre === "Tritón de las Mareas"), "la raza existe");
const r1 = g("Nerea", "Tritón de las Mareas"); t(!/no es una raza|raza no|inválid/i.test(r1) && P.personajes.Nerea?.raza === "Tritón de las Mareas", "se puede crear un Tritón", r1.slice(0, 90));
g("Hugo", "Humano del Faro");
const a = txt(ejecutar("agua", { accion: "sumergir", quienes: ["Nerea", "Hugo"] }, P));
t(/Tritón, respira bajo el agua/.test(a) && P.personajes.Nerea.sumergido?.anfibio === true, "el Tritón se sumerge sin gastar aire", a.slice(0, 120));
t(/aire/.test(a) && !!P.personajes.Hugo.sumergido && !P.personajes.Hugo.sumergido.anfibio, "el humano sí gasta aire");
ejecutar("agua", { accion: "nadar", quienes: [], minutos: 30 }, P);
t(P.personajes.Nerea.pv > 0 && !P.personajes.Nerea.condiciones.includes("muerto"), "tras 30 min bajo el agua el Tritón sigue vivo", String(P.personajes.Nerea.pv));
t(P.personajes.Hugo.pv <= 1 || P.personajes.Hugo.condiciones.includes("muerto"), "y el humano se ahoga", JSON.stringify([P.personajes.Hugo.pv, P.personajes.Hugo.condiciones]));
const v = txt(ejecutar("agua", { accion: "ver" }, P)); t(/Nerea: respira bajo el agua/.test(v), "el estado lo muestra", v.slice(0, 80));
t(danoConResistencia(P.personajes.Nerea, 10, "frío").dano === 5 && danoConResistencia(P.personajes.Nerea, 10, "fuego").dano === 10, "resiste el frío y no el fuego");
t(rasgosAutomaticos(P.personajes.Nerea).some((x) => /Anfibio/.test(x)), "el DM sabe que es automático");
const h = buscarCriatura("Hombre pez"); t(!!h && buscarCriatura("Hombres pez") === h && /sirena/i.test(h!.descripcion), "Hombre pez en el bestiario (alias)");
t(BESTIARIO.every((c) => !!c.vd), "todas las criaturas tienen VD", BESTIARIO.filter((c) => !c.vd).map((c) => c.nombre).join());
t(/VD 5/.test(fichaCriatura(buscarCriatura("Sirena")!)), "la ficha muestra el VD");
t(TABLA.some((e) => e.bestiario === "Hombre pez") && TABLA.every((e) => !e.bestiario || !!buscarCriatura(e.bestiario)), "encuentro de hombres pez con plantilla válida");
const ap = txt(ejecutar("aparecer_criatura", { nombre: "Hombre pez", cantidad: 2 }, P)); t(!/no existe|no hay/i.test(ap), "aparecer_criatura lo acepta", ap.slice(0, 100));
console.log(`${ok} ok, ${mal} fallas`);
// ---- sed del Tritón
{
  const Q = nuevaPartida(); normalizarPartida(Q);
  const mk = (n: string, raza: string) => ejecutar("guardar_personaje", { don_arcano: false, nombre: n, jugador: n, raza, clase: "Mercenario del Cuervo", nivel: 1, pv_max: 20, ca: 12, atributos: { fue: 14, des: 12, con: 14, int: 10, sab: 10, car: 10 }, inventario: ["Espada larga"], dote: "Terco" }, Q);
  ejecutar("tiempo", { fijar: { dia: 1, hora: 8, minuto: 0 } }, Q);
  mk("Nerea", "Tritón de las Mareas"); mk("Hugo", "Humano del Faro");
  const r = RAZAS.find((x) => x.nombre === "Tritón de las Mareas")!; t(r.atributos === "+2 CON, +1 FUE", "bonus de FUE y no de CAR", r.atributos);
  for (let i = 0; i < 7; i++) ejecutar("tiempo", { avanzar: { horas: 1 } }, Q); // 7 h en tierra
  const c = (n: string) => Q.personajes[n].condiciones.join();
  t(/con sed/.test(c("Nerea")) && !/con sed/.test(c("Hugo")), "a las 7 h, el Tritón ya tiene sed y el humano no", c("Nerea") + " | " + c("Hugo"));
  for (let i = 0; i < 6; i++) ejecutar("tiempo", { avanzar: { horas: 1 } }, Q); // 13 h
  t(/deshidratado/.test(c("Nerea")) && /con sed/.test(c("Hugo")), "a las 13 h, deshidratado el Tritón y con sed el humano", c("Nerea") + " | " + c("Hugo"));
  ejecutar("agua", { accion: "sumergir", quienes: ["Nerea"] }, Q);
  const sed0 = Q.personajes.Nerea.sustento!.seco;
  for (let i = 0; i < 3; i++) ejecutar("tiempo", { avanzar: { horas: 1 } }, Q);
  t(Q.personajes.Nerea.sustento!.seco === sed0, "sumergido no se seca más", String(sed0));
  ejecutar("agua", { accion: "emerger", quienes: ["Nerea"] }, Q);
  ejecutar("sustento", { accion: "beber", quienes: ["Nerea"], libre: true }, Q);
  t(!/sed|deshidratado/.test(c("Nerea")) && Q.personajes.Nerea.sustento!.seco === 0, "beber le quita la sed y la sed extra", c("Nerea"));
  for (let i = 0; i < 25; i++) ejecutar("tiempo", { avanzar: { horas: 1 } }, Q);
  t(/piel reseca/.test(c("Nerea")), "tras un día en tierra, piel reseca", c("Nerea"));
  ejecutar("agua", { accion: "sumergir", quienes: ["Nerea"] }, Q); ejecutar("tiempo", { avanzar: { minutos: 5 } }, Q);
  t(!/piel reseca/.test(c("Nerea")), "al sumergirse la piel se recompone", c("Nerea"));
}
console.log(`${ok} ok, ${mal} fallas`);
{
  const h = buscarCriatura("Hombre lagarto"); t(!!h && buscarCriatura("Hombres lagarto") === h && h!.vd === "3", "Hombre lagarto en el bestiario con alias y VD");
  const Z = nuevaPartida(); normalizarPartida(Z);
  const ap = txt(ejecutar("aparecer_criatura", { nombre: "Hombre lagarto", cantidad: 3 }, Z)); t(!/no existe|no hay/i.test(ap), "aparecer_criatura lo acepta", ap.slice(0, 80));
  t(TABLA.some((e) => e.bestiario === "Hombre lagarto") && TABLA.every((e) => !e.bestiario || !!buscarCriatura(e.bestiario)), "encuentro con plantilla válida");
}
console.log(`${ok} ok, ${mal} fallas`);
