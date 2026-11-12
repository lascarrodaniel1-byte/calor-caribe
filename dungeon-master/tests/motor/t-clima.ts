// Estaciones y clima por región: calendario, variantes, clima determinista, efectos (sed, hambre, viaje, encuentros, luz), anomalías,
// adaptación por raza y clase, Tritones y la lluvia, avisos y herramienta `clima`. Todo opcional: sin `calendario` nada cambia.
import { nuevaPartida, normalizarPartida } from "../../src/estado.ts";
import { ejecutar, fijarAccionesDelTurno, tiempoDeTurno } from "../../src/herramientas.ts";
import { iniciarRegistroDados, liberarDados } from "../../src/dados.ts";
import { revisarSustento, sustentoVisible } from "../../src/sustento.ts";
import { TABLA } from "../../src/encuentros.ts";
import { estadoParaDM } from "../../src/navegador.ts";
import * as C from "../../src/clima.ts";
let ok = 0, mal = 0; const t = (c: boolean, m: string, x = "") => { console.log(c ? "ok   " : "FALLA", m, x); c ? ok++ : mal++; };
const txt = (r: any) => (typeof r === "string" ? r : r?.contenido ?? JSON.stringify(r));
const DIA = 86400;
const CIE = "Las Ciénagas de Hollín", ALD = "Aldenmar", AGU = "Las Agujas de Vahl", MARCA = "La Marca Hueca";
const fijos = (v: number, n = 40) => iniciarRegistroDados(Array.from({ length: n }, () => ({ caras: 20, valor: v })));

/** Una mesa: personajes [nombre, raza, clase], región del grupo, calendario opcional y día/hora del reloj. */
function mesa(pjs: [string, string, string][], o: { region?: string; tipo?: string; inicio?: number; dia?: number; hora?: number; cal?: boolean } = {}) {
  const p = nuevaPartida(); normalizarPartida(p);
  const E = (n: string, d: object): any => ejecutar(n, d, p);
  for (const [n, raza, clase] of pjs)
    E("guardar_personaje", { don_arcano: false, nombre: n, jugador: n, raza, clase, nivel: 3, pv_max: 40, ca: 12, atributos: { fue: 16, des: 14, con: 14, int: 10, sab: 10, car: 10 }, inventario: ["Espada larga"] });
  E("ubicacion", { lugar: "Sitio de prueba", region: o.region ?? ALD, tipo: o.tipo ?? "aldea" });
  p.reloj = { segundos: ((o.dia ?? 1) - 1) * DIA + (o.hora ?? 8) * 3600 };
  for (const x of Object.values(p.personajes)) delete x.sustento; // el sustento empieza en el momento fijado
  if (o.cal !== false) p.calendario = { inicio: o.inicio ?? C.INICIO_DEFECTO, anomalias: [] };
  return { p, E };
}
/** Primer día de la partida (desde `desde`) que cumple la condición, para no depender de adivinar el clima. */
const buscar = (p: any, region: string, f: (c: C.Condiciones) => boolean, desde = 1, hasta = 400): number => {
  for (let d = desde; d <= hasta; d++) { const c = C.condicionesDe(p, region, d); if (c && f(c)) return d; }
  throw new Error("no hay día así");
};
const irA = (p: any, dia: number, hora = 8) => { p.reloj.segundos = (dia - 1) * DIA + hora * 3600; };
/** Horas «efectivas» sin beber y sin comer tras dejar pasar `horas` desde el inicio del día. */
function horas(p: any, nombre: string, h = 12) {
  revisarSustento(p); p.reloj.segundos += h * 3600; revisarSustento(p);
  const v = sustentoVisible(p, p.personajes[nombre])!; return { sed: v.sed.horas, hambre: v.hambre.horas };
}

// ---- calendario: estación por día del año
{
  const f = (inicio: number, dia: number) => C.fechaDe({ inicio, anomalias: [] }, "Aldenmar", dia);
  t(f(1, 1).estacion === 0 && f(1, 1).diaEstacion === 1, "inicio 1, día 1: Primavera día 1");
  t(f(1, 90).estacion === 0 && f(1, 90).diaEstacion === 90, "día 90: último de la Primavera");
  t(f(1, 91).estacion === 1 && f(1, 91).diaEstacion === 1, "día 91: Verano día 1 (límite 90/91)");
  t(f(1, 360).estacion === 3 && f(1, 360).diaEstacion === 90 && f(1, 361).estacion === 0 && f(1, 361).diaEstacion === 1, "360 es Invierno 90 y 361 vuelve a Primavera 1");
  t(f(91, 1).estacion === 1, "inicio 91: el día 1 cae en Verano");
  t(f(270, 1).estacion === 2 && f(270, 1).diaEstacion === 90 && f(270, 2).estacion === 3 && f(270, 2).diaEstacion === 1, "inicio 270: Otoño 90 y luego Invierno 1");
  t(f(360, 2).diaAnio === 1 && f(360, 2).estacion === 0, "inicio 360, día 2: vuelta de año, día 1 del año");
  const d = f(C.INICIO_DEFECTO, 1);
  t(d.estacion === 2 && d.diaEstacion === 45, "por defecto el Día 1 cae a mitad de otoño (día 45)", `${d.estacion}/${d.diaEstacion}`);
  t(C.ESTACIONES.join() === "Primavera,Verano,Otoño,Invierno", "nombres base en español");
}
// ---- activarCalendario
{
  const p = nuevaPartida();
  t(C.activarCalendario(p) === false && !p.calendario, "sin reloj no se activa");
  normalizarPartida(p);
  t(C.activarCalendario(p) === true && p.calendario?.inicio === C.INICIO_DEFECTO, "con reloj se activa con el inicio por defecto");
  p.calendario!.inicio = 100;
  t(C.activarCalendario(p) === false && p.calendario!.inicio === 100, "es idempotente: no pisa un calendario existente");
}
// ---- variantes regionales
{
  const nombre = (r: string, e: number) => C.PERFILES[r][e].nombreLocal;
  t(nombre(ALD, 3) === "el Invierno de Ceniza", "Aldenmar: el Invierno de Ceniza");
  t(nombre(CIE, 1) === "las Fiebres", "Ciénagas de Hollín: el verano son las Fiebres");
  t(nombre(AGU, 3) === "la Larga Nevada", "Agujas de Vahl: el invierno es la Larga Nevada");
  t(Object.keys(C.PERFILES).length === 7 && C.PERFILES[C.BASE], "seis regiones y el perfil base «Marca de Velmora»");
  t(C.nombreRegion("un sitio cualquiera") === C.BASE && C.nombreRegion(undefined) === C.BASE, "región sin identificar: perfil base");
  t(C.nombreRegion("Aldenmar") === ALD && C.nombreRegion("las agujas de vahl") === AGU, "reconoce las regiones por nombre");
  const todos = Object.values(C.PERFILES).flat();
  t(todos.every((e) => e.descripcion.length > 20 && Object.keys(e.climas).length >= 3 && e.luz[0] < e.luz[1]), "cada perfil tiene descripción, climas y luz coherentes");
  t(todos.every((e) => C.TEMPERATURAS.includes(e.temperatura)), "temperaturas válidas");
  t(C.PERFILES[AGU][3].luz[1] - C.PERFILES[AGU][3].luz[0] < C.PERFILES[C.BASE][3].luz[1] - C.PERFILES[C.BASE][3].luz[0], "el invierno acorta el día y las Agujas más que el resto");
  const karak = C.PERFILES["Karak-Dûm"];
  t(karak.every((e) => ["fresca", "fría"].includes(e.temperatura)) && karak[0].luz[0] === karak[1].luz[0], "Karak-Dûm, bajo tierra, casi no varía");
  t(Object.values(C.PERFILES).every((v) => v.some((e) => "llovizna" in e.climas)), "llovizna existe como clima suave");
}
// ---- clima determinista
{
  const { p } = mesa([["Ana", "Humano del Faro", "Mercenario del Cuervo"]]);
  const a = C.climaDe(p, ALD, 40), b = C.climaDe(p, ALD, 40);
  t(!!a && a.clima === b!.clima, "climaDe es determinista (mismo resultado dos veces)");
  const dias = new Set(Array.from({ length: 40 }, (_, i) => C.climaDe(p, ALD, i + 1)!.clima));
  t(dias.size >= 3, "el clima varía entre días", [...dias].join(","));
  t(Array.from({ length: 40 }, (_, i) => i + 1).some((d) => C.climaDe(p, ALD, d)!.clima !== C.climaDe(p, CIE, d)!.clima), "y entre regiones");
  const q = JSON.parse(JSON.stringify(p));
  t(Array.from({ length: 60 }, (_, i) => C.climaDe(q, MARCA, i + 1)!.clima).join() === Array.from({ length: 60 }, (_, i) => C.climaDe(p, MARCA, i + 1)!.clima).join(), "estable al recargar (copia de la partida: mismo clima)");
  const sin = nuevaPartida(); normalizarPartida(sin);
  t(C.climaDe(sin, ALD, 1) === null && C.condicionesDe(sin) === null, "sin calendario: sin clima ni condiciones");
}
// ---- efectos: sed por calor, hambre por frío (con y sin calendario)
{
  const tor = (() => { const { p } = mesa([["Ana", "Humano del Faro", "Mercenario del Cuervo"]], { region: CIE }); return buscar(p, CIE, (c) => c.temperatura === "tórrida" && c.clima !== "calima" && !C.CLIMAS_AGUA.includes(c.clima)); })();
  const cal = (() => { const { p } = mesa([["Ana", "Humano del Faro", "Mercenario del Cuervo"]], { region: MARCA }); return buscar(p, MARCA, (c) => c.temperatura === "cálida" && c.clima !== "calima"); })();
  const gel = (() => { const { p } = mesa([["Ana", "Humano del Faro", "Mercenario del Cuervo"]], { region: AGU }); return buscar(p, AGU, (c) => c.temperatura === "helada"); })();
  let m = mesa([["Ana", "Humano del Faro", "Mercenario del Cuervo"]], { region: MARCA, dia: cal });
  t(C.condicionesDe(m.p)!.factorSed === 1.25, "cálida: factor de sed ×1,25");
  let h = horas(m.p, "Ana");
  t(h.sed === 15 && h.hambre === 12, "cálido: 12 h reales = 15 h efectivas sin beber (el hambre no cambia)", JSON.stringify(h));
  m = mesa([["Ana", "Humano del Faro", "Mercenario del Cuervo"]], { region: MARCA, dia: cal, cal: false });
  h = horas(m.p, "Ana");
  t(h.sed === 12 && h.hambre === 12, "SIN calendario: 12 h reales = 12 h efectivas (todo neutro)", JSON.stringify(h));
  m = mesa([["Ana", "Humano del Faro", "Mercenario del Cuervo"]], { region: CIE, dia: tor });
  t(C.condicionesDe(m.p)!.factorSed === 1.5, "tórrida: factor de sed ×1,5");
  t(horas(m.p, "Ana").sed === 18, "tórrido: 12 h reales = 18 h efectivas");
  m = mesa([["Ana", "Humano del Faro", "Mercenario del Cuervo"]], { region: AGU, dia: gel });
  t(C.condicionesDe(m.p)!.factorHambre === 1.25, "helada: factor de hambre ×1,25");
  h = horas(m.p, "Ana");
  t(h.hambre === 15 && h.sed === 12, "helado: 12 h reales = 15 h de hambre efectivas (la sed no cambia)", JSON.stringify(h));
  m = mesa([["Ana", "Humano del Faro", "Mercenario del Cuervo"]], { region: CIE, dia: tor, tipo: "posada" });
  t(horas(m.p, "Ana").sed === 12, "bajo techo (posada) no hay extra de sed por calor");
  m = mesa([["Ana", "Humano del Faro", "Mercenario del Cuervo"]], { region: CIE, dia: tor });
  m.p.personajes.Ana.condiciones.push("en el agua");
  t(horas(m.p, "Ana").sed === 12, "en el agua tampoco");
  // beber pone a cero también el extra
  m = mesa([["Ana", "Humano del Faro", "Mercenario del Cuervo"]], { region: CIE, dia: tor });
  horas(m.p, "Ana"); m.p.personajes.Ana.inventario.push("Odre de agua (2)"); m.E("sustento", { accion: "beber", quienes: ["Ana"] });
  t(sustentoVisible(m.p, m.p.personajes.Ana)!.sed.horas === 0, "beber pone la sed a cero (también el extra)");
}
// ---- adaptación por raza y clase
{
  const gel = (() => { const { p } = mesa([["Ana", "Humano del Faro", "Mercenario del Cuervo"]], { region: AGU }); return buscar(p, AGU, (c) => c.temperatura === "helada"); })();
  const tor = (() => { const { p } = mesa([["Ana", "Humano del Faro", "Mercenario del Cuervo"]], { region: CIE }); return buscar(p, CIE, (c) => c.temperatura === "tórrida" && c.clima !== "calima" && !C.CLIMAS_AGUA.includes(c.clima)); })();
  const grupo: [string, string, string][] = [["Hum", "Humano del Faro", "Mercenario del Cuervo"], ["Ber", "Humano del Faro", "Berserker de Ceniza"], ["EnB", "Enano de Karak-Dûm", "Berserker de Ceniza"], ["Enano", "Enano de Karak-Dûm", "Mercenario del Cuervo"], ["Cen", "Cenizo", "Mercenario del Cuervo"], ["Med", "Mediano de Hollín", "Mercenario del Cuervo"]];
  let m = mesa(grupo, { region: AGU, dia: gel });
  revisarSustento(m.p); m.p.reloj.segundos += 12 * 3600; revisarSustento(m.p);
  const hh = (n: string) => sustentoVisible(m.p, m.p.personajes[n])!.hambre.horas;
  t(hh("Hum") === 15, "Humano en invierno helado: hambre ×1,25", String(hh("Hum")));
  t(hh("Ber") === 12, "Berserker: el frío no le acelera el hambre (inmune, factor 1)", String(hh("Ber")));
  t(hh("EnB") === 12, "Enano Berserker: inmune por la clase aunque la raza sea solo «bien»");
  t(hh("Enano") === 13, "Enano (frío bien): la mitad del exceso (12 → 13 h)", String(hh("Enano")));
  t(hh("Med") === 15, "Mediano (frío mal): +25 % del exceso (15 h)", String(hh("Med")));
  m = mesa(grupo, { region: CIE, dia: tor });
  revisarSustento(m.p); m.p.reloj.segundos += 12 * 3600; revisarSustento(m.p);
  const ss = (n: string) => sustentoVisible(m.p, m.p.personajes[n])!.sed.horas;
  t(ss("Hum") === 18 && ss("Cen") === 12, "Cenizo en verano tórrido: sed sin extra frente al Humano (12 frente a 18 h)", `${ss("Cen")}/${ss("Hum")}`);
  t(ss("Ber") > ss("Hum") && ss("Enano") > ss("Hum"), "Berserker y Enano (calor mal) sufren más que el Humano", `${ss("Ber")}/${ss("Enano")}`);
  const tri = mesa([["Tri", "Tritón de las Mareas", "Mercenario del Cuervo"], ["Hum", "Humano del Faro", "Mercenario del Cuervo"]], { region: CIE, dia: tor });
  revisarSustento(tri.p); tri.p.reloj.segundos += 12 * 3600; revisarSustento(tri.p);
  const sv = (n: string) => sustentoVisible(tri.p, tri.p.personajes[n])!.sed.horas;
  t(sv("Tri") >= 31 && sv("Tri") > sv("Hum"), "Tritón al calor: el ×2 de tierra más el calor «mal» (≥ 31 h frente a 18)", `${sv("Tri")}/${sv("Hum")}`);
  // combinación raza + clase
  const a = C.adaptacionDe(m.p.personajes.EnB);
  t(a.frio === "inmune" && a.calor === "mal", "combinación: frío inmune por la clase y calor mal", JSON.stringify(a));
  t(C.adaptacionDe(m.p.personajes.Hum).frio === undefined, "el Humano del Faro es neutral");
  t(C.aplicarNivel(1.25, "mal") === 1.31 && C.aplicarNivel(1.5, "bien") === 1.25 && C.aplicarNivel(1.5, "inmune") === 1 && C.aplicarNivel(1, "mal") === 1, "aplicarNivel: inmune anula, bien mitad, mal +25 % del exceso");
  // viaje: el grupo viaja al ritmo del peor adaptado; el Cazador reduce a la mitad el freno
  const dn = buscar(m.p, AGU, (c) => c.clima === "nieve");
  const cNieve = C.condicionesDe(m.p, AGU, dn)!;
  const pj = (r: string, c: string) => m.p.personajes[r === "Humano del Faro" && c === "Mercenario del Cuervo" ? "Hum" : r === "Mediano de Hollín" ? "Med" : "Ber"];
  const FV = (...ps: any[]) => C.factorViajeGrupo(cNieve, ps).factor;
  t(cNieve.factorViaje === 0.75, "nieve: el viaje rinde ×0,75 de km", String(cNieve.factorViaje));
  t(FV(m.p.personajes.Hum) === 0.75 && FV(m.p.personajes.Hum, m.p.personajes.Ber) === 0.75, "el grupo viaja al ritmo del peor adaptado");
  t(FV(m.p.personajes.Med) < 0.75 && FV(m.p.personajes.Hum, m.p.personajes.Med) < 0.75, "con un Mediano (frío mal) en la nieve el grupo frena más", String(FV(m.p.personajes.Med)));
  t(FV(m.p.personajes.Ber) === 1, "solo Berserkers: la nieve no los frena");
  const cz = mesa([["Caz", "Humano del Faro", "Cazador de Brujas"], ["Hum", "Humano del Faro", "Mercenario del Cuervo"]]);
  t(FV(cz.p.personajes.Hum, cz.p.personajes.Caz) === 0.88 && FV(cz.p.personajes.Hum, cz.p.personajes.Caz) > FV(cz.p.personajes.Hum), "el Cazador de Brujas reduce a la mitad el freno de todos", String(FV(cz.p.personajes.Hum, cz.p.personajes.Caz)));
  const dt = buscar(m.p, CIE, (c) => c.clima === "tormenta");
  const cT = C.condicionesDe(m.p, CIE, dt)!;
  t(cT.factorViaje === 0.6 && C.factorViajeGrupo(cT, [m.p.personajes.Med]).factor === 1, "tormenta en la ciénaga: ×0,6 en general, pero el Mediano (humedad bien) no frena", String(cT.factorViaje));
  t(C.factorViajeGrupo(cT, [m.p.personajes.Hum, m.p.personajes.Med]).factor === 0.6, "el Humano del grupo sí frena en la tormenta");
  // viajar de verdad: km con y sin calendario
  const v1 = mesa([["Hum", "Humano del Faro", "Mercenario del Cuervo"]], { region: AGU, dia: dn });
  const k1 = txt(v1.E("viajar", { horas: 5, ritmo: "normal", terreno: "camino" }));
  const v2 = mesa([["Hum", "Humano del Faro", "Mercenario del Cuervo"]], { region: AGU, dia: dn, cal: false });
  const k2 = txt(v2.E("viajar", { horas: 5, ritmo: "normal", terreno: "camino" }));
  t(/unos 24 km/.test(k2) && !/nieve/.test(k2), "viajar sin calendario: 24 km, sin aviso", k2.split("\n")[0]);
  t(/unos 18 km/.test(k1) && /nieve/.test(k1) && /horas no cambian/.test(k1), "viajar en la nieve con calendario: 18 km (×0,75) y aviso, mismas horas", k1.split("\n").slice(0, 3).join(" | "));
  // la ficha que ve el DM
  t(/Clima: inmune al frío \(Berserker de Ceniza\), mal con el calor/.test(C.lineaClimaFicha(m.p.personajes.Ber, m.p)), "línea de la ficha: inmune al frío, mal con el calor", C.lineaClimaFicha(m.p.personajes.Ber, m.p));
  t(C.lineaClimaFicha(m.p.personajes.Hum, m.p) === "" , "sin adaptación no hay línea");
  const sinCal = mesa([["Ber", "Humano del Faro", "Berserker de Ceniza"]], { cal: false });
  t(C.lineaClimaFicha(sinCal.p.personajes.Ber, sinCal.p) === "", "sin calendario no hay línea de clima en la ficha");
  t(/Clima:/.test(estadoParaDM(m.p)) && !/Clima:/.test(estadoParaDM(sinCal.p)), "el estado del DM lleva la línea solo con calendario");
  t(/Berserker de Ceniza: frío inmune/.test(C.REGLAS_CLIMA) && /Cenizo: .*calor inmune/.test(C.REGLAS_CLIMA), "consultar_reglas «clima» lista la tabla de adaptaciones");
}
// ---- encuentros por estación
{
  const { p } = mesa([["Ana", "Humano del Faro", "Mercenario del Cuervo"]], { inicio: 271, region: AGU });
  const wen = TABLA.find((x) => x.id === "wendigo")!, ban = TABLA.find((x) => x.id === "bandoleros")!, sir = TABLA.find((x) => x.id === "sirena")!;
  t(C.pesoEstacion(p, AGU, wen.estaciones) === 2, "Wendigo en Invierno: peso ×2");
  t(C.pesoEstacion(p, AGU, sir.estaciones) === 0.5, "Sirena en Invierno: peso ×0,5");
  t(C.pesoEstacion(p, AGU, ban.estaciones) === 1 && ban.estaciones === undefined, "plantilla sin estaciones: sin cambio");
  irA(p, 91 + 0, 8); // Primavera (inicio 271: día 91 = 271+90 → día del año 1)
  t(C.pesoEstacion(p, AGU, sir.estaciones) === 2 && C.pesoEstacion(p, AGU, wen.estaciones) === 0.5, "en Primavera: la Sirena ×2 y el Wendigo ×0,5");
  const sin = mesa([["Ana", "Humano del Faro", "Mercenario del Cuervo"]], { cal: false });
  t(C.pesoEstacion(sin.p, AGU, wen.estaciones) === 1, "sin calendario: peso ×1");
  t(["hambrientos", "lobos", "wendigo", "sirena", "hombres_pez", "hombres_lagarto", "duende"].every((id) => TABLA.find((x) => x.id === id)?.estaciones?.length), "las plantillas pedidas tienen estaciones");
  t(TABLA.every((x) => (x.estaciones ?? []).every((e) => (C.ESTACIONES as readonly string[]).includes(e))), "todas las estaciones de la tabla son válidas");
  t(JSON.stringify(TABLA.map((x) => x.peso)).length > 0 && wen.peso === 1, "los pesos base no cambian");
  // con una anomalía intensa, ×1,5 más por nivel
  const w = mesa([["Ana", "Humano del Faro", "Mercenario del Cuervo"]], { inicio: 271, region: AGU });
  w.E("clima", { accion: "anomalia", nombre: "El Invierno del Wendigo", causa: "El Wendigo despertó en las cumbres y el hambre se extiende", tipo: "intensa", intensidad: 2 });
  t(C.pesoEstacion(w.p, AGU, wen.estaciones) === 4.5, "anomalía intensa nivel 2: ×2 × 1,5² en las plantillas de la estación", String(C.pesoEstacion(w.p, AGU, wen.estaciones)));
  // el sorteo corre con calendario sin fallos
  fijos(10); const r = txt(w.E("encuentro", {})); liberarDados();
  t(/ENCUENTRO/.test(r), "el sorteo de encuentros funciona con calendario");
}
// ---- luz
{
  t(C.luzA(ALD, 3, 8).estado === "amanecer" && C.luzA(ALD, 3, 12).estado === "día" && C.luzA(ALD, 3, 16.75).estado === "ocaso" && C.luzA(ALD, 3, 23).estado === "noche cerrada", "luz de Aldenmar en invierno: amanecer, día, ocaso y noche cerrada");
  const { p } = mesa([["Ana", "Humano del Faro", "Mercenario del Cuervo"]], { inicio: 271, region: ALD, hora: 23 });
  t(/Luz: noche cerrada/.test(estadoParaDM(p)), "el estado del DM indica «noche cerrada»");
  irA(p, 1, 12);
  t(/Luz: día/.test(estadoParaDM(p)), "a mediodía, luz de día");
  t(C.luzActual(nuevaPartida()) === null, "sin calendario no hay luz");
}
// ---- aviso de cambio de estación
{
  const { p, E } = mesa([["Ana", "Humano del Faro", "Mercenario del Cuervo"]], { inicio: 1, region: ALD, dia: 90, hora: 20 });
  const r = E("tiempo", { avanzar: { horas: 6 } });
  t(/Llega el Sol Pálido en Aldenmar/.test(r.contenido) && /Llega el Sol Pálido/.test(r.aviso ?? ""), "al cruzar el día 90 llega el aviso público «Llega el Sol Pálido en Aldenmar…»", String(r.aviso).slice(0, 100));
  const r2 = E("tiempo", { avanzar: { horas: 2 } });
  t(!/Llega/.test(r2.contenido), "el aviso no se repite");
  const q = mesa([["Ana", "Humano del Faro", "Mercenario del Cuervo"]], { inicio: 1, region: ALD, dia: 90, hora: 23.99 });
  q.p.reloj.segundos = 90 * DIA - 300;
  const av = tiempoDeTurno(q.p);
  t(av.some((x) => /Llega el Sol Pálido/.test(x)), "también lo da el paso de los 10 minutos de turno", av.join(" | ").slice(0, 100));
  const w = mesa([["Ana", "Humano del Faro", "Mercenario del Cuervo"]], { inicio: 1, region: ALD, dia: 360, hora: 20 });
  w.p.reloj.segundos = 360 * DIA - 60;
  t(tiempoDeTurno(w.p).some((x) => /Llega la Primavera|Llegan|Llega el Deshielo Gris/.test(x)), "del día 360 al 361: llega la Primavera (el Deshielo Gris)");
  const s = mesa([["Ana", "Humano del Faro", "Mercenario del Cuervo"]], { cal: false, dia: 90, hora: 20 });
  t(!/Llega/.test(txt(s.E("tiempo", { avanzar: { horas: 6 } }))), "sin calendario no hay aviso de estación");
}
// ---- herramienta clima
{
  const { p, E } = mesa([["Ana", "Humano del Faro", "Mercenario del Cuervo"]], { region: ALD });
  const ver = txt(E("clima", { accion: "ver" })), pro = txt(E("clima", { accion: "pronostico" }));
  t(/Otoño/.test(ver) && /Hoy:/.test(ver) && /Luz:/.test(ver), "clima ver: estación, clima de hoy y luz", ver.split("\n")[0]);
  t(/Mañana/.test(pro) && /Dentro de 3 días/.test(pro) && /vagas/.test(pro) && /posible|probable/.test(pro), "clima pronostico: tres días con probabilidades vagas", pro.split("\n").slice(0, 3).join(" | "));
  const e = E("clima", { accion: "ver" });
  t(!e.error, "ver no falla con calendario");
  const sin = mesa([["Ana", "Humano del Faro", "Mercenario del Cuervo"]], { cal: false });
  const r = sin.E("clima", { accion: "ver" });
  t(!!r.error && /calendario/.test(r.contenido), "sin calendario la herramienta lo dice");
  const est = estadoParaDM(p);
  t(/## Estación y clima/.test(est) && /Otoño \(la Lluvia Negra\)/.test(est) && /día 45\/90/.test(est) && /temperatura fresca/.test(est), "el estado del DM trae estación (nombre local), día, clima, temperatura y luz", est.split("## Estación y clima\n")[1]?.split("\n")[0]);
  t(!/## Estación y clima/.test(estadoParaDM(sin.p)), "sin calendario el estado no trae la línea");
  const cal = mesa([["Ana", "Humano del Faro", "Mercenario del Cuervo"]], { region: MARCA, dia: buscar(mesa([["A", "Humano del Faro", "Mercenario del Cuervo"]], { region: MARCA }).p, MARCA, (c) => c.temperatura === "cálida" && c.clima !== "calima") });
  t(/calor: la sed corre ×1,25/.test(estadoParaDM(cal.p)), "el estado avisa de los factores activos («calor: la sed corre ×1,25»)");
  const pan = C.textoPanel(p);
  t(!!pan && /^🍂 Otoño · /.test(pan.texto), "texto del panel: «🍂 Otoño · clima»", pan?.texto);
  t(C.textoPanel(sin.p) === null, "sin calendario el panel no muestra nada");
}
// ---- anomalías
{
  const nueva = (o: any = {}) => mesa([["Ana", "Humano del Faro", "Mercenario del Cuervo"]], { inicio: 1, region: ALD, dia: 80, ...o });
  const CAUSA = "Mataron al Wendigo en las cumbres y el invierno no se va";
  // larga
  let m = nueva();
  const antes = [50, 90, 91, 120, 200].map((d) => C.fechaDe(m.p.calendario!, ALD, d).estacion + "/" + C.fechaDe(m.p.calendario!, ALD, d).diaEstacion).join();
  let r = m.E("clima", { accion: "anomalia", nombre: "La Primavera Larga", causa: CAUSA, tipo: "larga", extra_dias: 10 });
  const A = m.p.calendario!.anomalias![0];
  t(!r.error && A.fin === 90 && A.hasta === 100 && A.extraDias === 10 && A.intensidad === 0 && A.publica, "anomalía larga: fin 90, hasta 100, sin intensidad, pública por defecto", JSON.stringify(A));
  const f = (d: number, reg = ALD) => C.fechaDe(m.p.calendario!, reg, d);
  t(f(95).estacion === 0 && f(95).diaEstacion === 95 && f(100).estacion === 0 && f(101).estacion === 1 && f(101).diaEstacion === 1, "la estación siguiente llega 10 días después (101 en vez de 91)");
  t(f(190).estacion === 1 && f(190).diaEstacion === 90 && f(191).estacion === 2, "y todo lo posterior se desplaza 10 días");
  t([50, 90].every((d, i) => f(d).estacion + "/" + f(d).diaEstacion === antes.split(",")[i]), "los días anteriores no cambian de estación");
  t(f(91, "Karak-Dûm").estacion === 1, "otras regiones no se alargan");
  t(/se alarga/.test(r.aviso ?? "") && /La Primavera Larga/.test(r.aviso ?? ""), "aviso público al empezar", String(r.aviso));
  t(C.climaDe(m.p, ALD, 95)!.clima === C.climaDe(m.p, ALD, 95)!.clima, "el clima con anomalía sigue siendo determinista");
  irA(m.p, 95); const pan2 = C.textoPanel(m.p)!;
  t(/⏳ Primavera larga · La Primavera Larga/.test(pan2.texto), "panel: marcador de anomalía pública", pan2.texto);
  t(/ANOMALÍA ESTACIONAL activa: La Primavera Larga/.test(estadoParaDM(m.p)) && /causa: Mataron/.test(estadoParaDM(m.p)), "el estado del DM trae la anomalía con su causa");
  t(/larga/.test(txt(m.E("clima", { accion: "pronostico" }))) || /sigue ahí/.test(txt(m.E("clima", { accion: "pronostico" }))), "el pronóstico menciona la anomalía pública");
  irA(m.p, 100, 20);
  const fin = m.E("tiempo", { avanzar: { horas: 6 } });
  t(/La Primavera Larga termina/.test(fin.contenido) && /Llega el Sol Pálido/.test(fin.contenido), "aviso al terminar la anomalía y llegar la estación siguiente", fin.contenido.split("\n").slice(-3).join(" | "));
  // intensa
  m = nueva({ inicio: 271, dia: 5 });
  const base = C.condicionesDe(m.p, ALD, 20)!;
  r = m.E("clima", { accion: "anomalia", nombre: "El Invierno del Wendigo", causa: CAUSA, tipo: "intensa", intensidad: 2, estacion: "Invierno" });
  const i2 = C.condicionesDe(m.p, ALD, 20)!;
  t(base.temperatura === "fría" && i2.temperatura === "helada", "intensa: sube un escalón la temperatura (fría → helada)", `${base.temperatura} → ${i2.temperatura}`);
  t(i2.factorHambre === 1.38 && base.factorHambre === 1.1, "intensa nivel 2: el hambre por frío ×1,38 (frente a ×1,1 sin ella)", String(i2.factorHambre));
  t(i2.intensidad === 2 && C.pesosClima(ALD, 3, 2).nieve > C.pesosClima(ALD, 3, 0).nieve && C.pesosClima(ALD, 3, 2).ventisca === C.pesosClima(ALD, 3, 0).ventisca * 3, "intensa: empuja el clima hacia lo extremo (más nieve y ventisca)");
  // verano intenso: cálida → tórrida y sed
  m = nueva({ inicio: 91, dia: 5 });
  m.E("clima", { accion: "anomalia", nombre: "El Verano del Sol Herido", causa: "Kharoth ha rasgado el cielo y el sol arde como una herida abierta", tipo: "intensa", intensidad: 3 });
  const ver = C.condicionesDe(m.p, ALD, buscar(m.p, ALD, (c) => c.intensidad === 3 && c.clima !== "calima" && c.temperatura === "tórrida", 5, 40))!;
  t(ver.factorSed === 1.88, "verano intenso nivel 3: sed ×1,88 (tórrida ×1,5 con +75 % del exceso)", String(ver.factorSed));
  // ambas
  m = nueva({ inicio: 1, dia: 80 });
  r = m.E("clima", { accion: "anomalia", nombre: "La Primavera Maldita", causa: CAUSA, tipo: "ambas", extra_dias: 20, intensidad: 1 });
  t(!r.error && m.p.calendario!.anomalias![0].hasta === 110 && m.p.calendario!.anomalias![0].intensidad === 1 && C.fechaDe(m.p.calendario!, ALD, 105).estacion === 0 && C.condicionesDe(m.p, ALD, 100)!.intensidad === 1, "ambas: alarga e intensifica");
  // límites y guardas
  m = nueva();
  const err = (d: any) => { const x = m.E("clima", { accion: "anomalia", nombre: "X", causa: CAUSA, tipo: "larga", extra_dias: 5, ...d }); return x.error ? x.contenido : ""; };
  t(/Argumentos no válidos/.test(err({ extra_dias: 61 })), "extra_dias > 60 se rechaza");
  t(/Argumentos no válidos/.test(err({ tipo: "intensa", intensidad: 4 })), "intensidad > 3 se rechaza");
  t(/causa/.test(err({ causa: undefined })) && /causa/.test(err({ causa: "corta" })), "sin causa (o menos de 20 caracteres) se rechaza");
  t(/pasado/.test(err({ desde: 10 })), "no puede empezar en el pasado");
  t(/necesita extra_dias/.test(err({ extra_dias: 0 })), "una anomalía larga necesita extra_dias");
  t(/Región desconocida/.test(err({ region: "Narnia" })), "región desconocida se rechaza");
  t(err({}) === "", "una anomalía válida se crea");
  t(/Ya hay una anomalía activa/.test(err({})), "máximo una activa por región");
  t(err({ region: "Karak-Dûm" }) === "", "otra región sí puede tener la suya");
  t(/Ya hay una anomalía activa/.test(err({ region: "todas" })), "«todas» choca con las activas");
  // terminar
  const rt = m.E("clima", { accion: "terminar_anomalia", id: "A1" });
  t(!rt.error && m.p.calendario!.anomalias![0].hasta === 80 && /termina/.test(rt.aviso ?? ""), "terminar_anomalia la cierra y avisa", String(rt.aviso));
  t(C.fechaDe(m.p.calendario!, ALD, 95).estacion === 1, "terminada antes de su fin, la estación sigue su curso (95 es Verano)");
  t(!m.E("clima", { accion: "anomalia", nombre: "Otra", causa: CAUSA, tipo: "larga", extra_dias: 3 }).error, "tras terminarla se puede crear otra en esa región");
  t(!!m.E("clima", { accion: "terminar_anomalia", id: "A9" }).error, "terminar una inexistente da error");
  // con contexto de turno: cita u origen trama
  m = nueva();
  const d = { accion: "anomalia", nombre: "El Invierno Largo", causa: CAUSA, tipo: "larga", extra_dias: 5 };
  t(!m.E("clima", d).error, "sin contexto de turno la guarda no actúa");
  m = nueva(); fijarAccionesDelTurno(["Ana: Clavo mi espada en el corazón del Wendigo"]);
  let x = m.E("clima", d);
  t(!!x.error && /cita/.test(x.contenido) && /Wendigo/.test(x.contenido), "con contexto y sin cita: error con las acciones del turno");
  x = m.E("clima", { ...d, cita: "esto no lo escribió nadie" });
  t(!!x.error, "con cita falsa: error");
  x = m.E("clima", { ...d, origen: "trama" });
  t(!!x.error, "origen trama sin arco abierto: error");
  x = m.E("clima", { ...d, cita: "CLAVO MI ESPADA en el corazon del wendigo" });
  t(!x.error, "con cita literal (otra capitalización, sin tildes): se crea", String(x.contenido).slice(0, 80));
  m = nueva(); fijarAccionesDelTurno(["Ana: espero"]); m.p.trama!.arcos = [{ nombre: "El hambre del norte", premisa: "x", fase: "nudo", pnjs: [], turnos: 0, turnos_fase: 0 } as any];
  t(!m.E("clima", { ...d, origen: "trama" }).error, "origen trama con un arco abierto: se crea");
  fijarAccionesDelTurno(null);
  // rumor
  m = nueva(); r = m.E("clima", { ...d, publica: false });
  t(!r.error && r.aviso === null, "anomalía no pública: sin aviso a la mesa al crearse");
  irA(m.p, 82);
  t(C.textoPanel(m.p)!.texto.startsWith("🍂") || C.textoPanel(m.p)!.texto.startsWith("🌱"), "anomalía no pública: el panel no muestra el marcador", C.textoPanel(m.p)!.texto);
  t(/RUMOR/.test(txt(m.E("clima", { accion: "ver" }))) && /RUMOR/.test(estadoParaDM(m.p)), "pero el DM la ve en ver y en su estado");
  t(!/sigue ahí/.test(txt(m.E("clima", { accion: "pronostico" }))), "y el pronóstico no la menciona");
  irA(m.p, 95, 23); m.p.reloj.segundos = 95 * DIA - 100;
  t(!tiempoDeTurno(m.p).some((a) => /Invierno Largo/.test(a)), "su final tampoco se avisa a la mesa");
  // desde futuro: el aviso llega al empezar
  m = nueva(); r = m.E("clima", { ...d, desde: 85 });
  t(!r.error && r.aviso === null, "anomalía futura: sin aviso al crearla");
  irA(m.p, 84, 20); const ini = m.E("tiempo", { avanzar: { horas: 6 } });
  t(/El Invierno Largo/.test(ini.contenido), "el aviso llega el día en que empieza", ini.contenido.split("\n").slice(-2).join(" | "));
}
// ---- Tritones y la lluvia
{
  const prueba = mesa([["Tri", "Tritón de las Mareas", "Mercenario del Cuervo"]], { region: CIE });
  const lluvia = buscar(prueba.p, CIE, (c) => c.clima === "lluvia" || c.clima === "llovizna");
  const tormenta = buscar(prueba.p, CIE, (c) => c.clima === "tormenta");
  const seco = buscar(prueba.p, CIE, (c) => c.clima === "niebla");
  const T = (o: any) => mesa([["Tri", "Tritón de las Mareas", "Mercenario del Cuervo"], ["Hum", "Humano del Faro", "Mercenario del Cuervo"]], { region: CIE, ...o });
  let m = T({ dia: lluvia, hora: 6 });
  m.p.personajes.Tri.condiciones.push("piel reseca");
  revisarSustento(m.p); const antes = sustentoVisible(m.p, m.p.personajes.Tri)!.sed.horas;
  m.p.reloj.segundos += 12 * 3600; const av = revisarSustento(m.p);
  const s = sustentoVisible(m.p, m.p.personajes.Tri)!.sed.horas, h = sustentoVisible(m.p, m.p.personajes.Hum)!.sed.horas;
  t(antes === 0 && s === 0 && h === 12, "Tritón en lluvia: 12 h sin que corra su sed (0 → 0), el humano sí (12)", `${s}/${h}`);
  t(!m.p.personajes.Tri.condiciones.includes("piel reseca") && m.p.sustento === undefined, "la lluvia quita la «piel reseca»");
  t(m.p.personajes.Tri.sustento!.mojado === m.p.reloj.segundos, "y renueva `mojado`");
  t(av.some((x) => /La lluvia sacia a Tri/.test(x)), "aviso al empezar la lluvia", av.join(" | "));
  const av2 = (() => { m.p.reloj.segundos += 1800; return revisarSustento(m.p); })();
  t(!av2.some((x) => /sacia/.test(x)), "el aviso no se repite en cada revisión");
  // sed previa: no se la quita
  m = T({ dia: seco, hora: 4 }); revisarSustento(m.p); m.p.reloj.segundos += 3 * 3600; revisarSustento(m.p);
  const previa = sustentoVisible(m.p, m.p.personajes.Tri)!.sed.horas;
  t(previa === 6, "en un día sin lluvia el Tritón acumula con su ×2 normal (3 h → 6 h)", String(previa));
  // piel reseca tras un día sin mojarse en tiempo seco
  m = T({ dia: seco, hora: 0 }); revisarSustento(m.p); m.p.reloj.segundos += 20 * 3600; revisarSustento(m.p);
  t(sustentoVisible(m.p, m.p.personajes.Tri)!.sed.horas === 40, "sin lluvia, 20 h → 40 h efectivas (×2)");
  // bonus
  const b = (o: any) => { const x = T(o); return { ...x, c: C.bonoClima(x.p, x.p.personajes.Tri) }; };
  t(b({ dia: lluvia }).c.bono === 1 && /\+1/.test(b({ dia: lluvia }).c.texto), "bonus +1 con llovizna o lluvia", b({ dia: lluvia }).c.texto);
  t(b({ dia: tormenta }).c.bono === 2 && /tormenta \+2/.test(b({ dia: tormenta }).c.texto), "bonus +2 en tormenta");
  t(b({ dia: seco }).c.bono === 0, "sin lluvia no hay bonus (la niebla no cuenta)");
  t(b({ dia: lluvia, tipo: "posada" }).c.bono === 0, "bajo techo no hay bonus");
  t(b({ dia: lluvia, cal: false }).c.bono === 0, "sin calendario no hay bonus");
  const hum = T({ dia: tormenta }); t(C.bonoClima(hum.p, hum.p.personajes.Hum).bono === 0, "otras razas no lo tienen");
  // en una prueba, un ataque y una salvación
  const ver = (dia: number, extra: any = {}) => {
    const x = T({ dia, ...extra });
    fijos(10);
    const pr = txt(x.E("prueba", { quien: "Tri", habilidad: "atletismo", cd: 12, motivo: "nadar" }));
    const sv = txt(x.E("prueba", { quien: "Tri", atributo: "con", tipo: "salvacion", cd: 12, motivo: "veneno" }));
    x.E("aparecer_criatura", { nombre: "Hambriento", repetir: true }); x.E("iniciativa", { participantes: ["Tri", "Hambriento"] });
    x.E("plano", { escena: "lluvia", poner: [{ nombre: "Tri" }] }); x.E("plano", { poner: [{ nombre: "Hambriento", ref: "Tri", direccion: "N", metros: 1.5 }] });
    x.E("empunar", { quien: "Tri", principal: "Espada larga" });
    const at = txt(x.E("atacar", { atacante: "Tri", objetivo: "Hambriento", arma: "Espada larga", dano: "1d6" }));
    liberarDados();
    return { pr, sv, at };
  };
  let v = ver(lluvia);
  t(/lluvia \+1|llovizna \+1/.test(v.pr) && /lluvia \+1|llovizna \+1/.test(v.sv) && /lluvia \+1|llovizna \+1/.test(v.at), "con lluvia: +1 en prueba, salvación y ataque, con el texto del desglose", `${v.pr.slice(0, 90)} || ${v.at.slice(0, 120)}`);
  v = ver(tormenta);
  t(/tormenta \+2/.test(v.pr) && /tormenta \+2/.test(v.sv) && /tormenta \+2/.test(v.at), "con tormenta: +2 en las tres");
  v = ver(lluvia, { tipo: "posada" });
  t(!/lluvia \+|llovizna \+|tormenta \+/.test(v.pr + v.sv + v.at), "bajo techo: sin desglose de lluvia");
  v = ver(lluvia, { cal: false });
  t(!/lluvia \+|llovizna \+|tormenta \+/.test(v.pr + v.sv + v.at), "sin calendario: sin desglose de lluvia");
  t(/Clima:.*sacia su sed y gana \+1 con lluvia \(\+2 en tormenta\)/.test(estadoParaDM(T({ dia: lluvia }).p)), "el estado del DM menciona la bendición de la lluvia del Tritón");
  t(/no pasa sed y gana \+1 \(\+2 en tormenta\)/.test(C.REGLAS_CLIMA) || /TRITONES Y LA LLUVIA/.test(C.REGLAS_CLIMA), "consultar_reglas «clima» lo explica");
}
// ---- sin calendario todo es neutro (mismo escenario con y sin calendario en un día templado de interior)
{
  const a = mesa([["Ana", "Humano del Faro", "Mercenario del Cuervo"], ["Tri", "Tritón de las Mareas", "Mercenario del Cuervo"]], { region: ALD, cal: false });
  const b = JSON.parse(JSON.stringify(a.p));
  const fase = (p: any) => { revisarSustento(p); p.reloj.segundos += 30 * 3600; revisarSustento(p); return Object.values<any>(p.personajes).map((x) => `${x.nombre}:${JSON.stringify(x.sustento)}:${x.condiciones.join(",")}`).join(";"); };
  const r1 = fase(a.p), r2 = fase(b);
  t(r1 === r2 && !/extra|vistoClima/.test(r1), "sin calendario: resultados idénticos y sin rastro de clima en el sustento", r1.slice(0, 120));
  t(!("calendario" in a.p) && a.p.calendario === undefined, "sin calendario no se crea nada");
  const e = a.E("encuentro", {});
  t(!/estación|Estación/.test(estadoParaDM(a.p)), "el estado no habla de estaciones");
  t(!e.error, "los encuentros funcionan como siempre");
}

console.log(`${ok} ok, ${mal} fallas`);
