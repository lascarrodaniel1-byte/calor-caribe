// Guardas del turno: sin combate, infligir_herida y los saltos de tiempo de 6 h o más exigen citar lo que escribieron los jugadores.
import { nuevaPartida, normalizarPartida } from "../../src/estado.ts";
import { ejecutar, fijarAccionesDelTurno, accionesDelTurno } from "../../src/herramientas.ts";
let ok = 0, mal = 0; const t = (c: boolean, m: string, x = "") => { console.log(c ? "ok   " : "FALLA", m, x); c ? ok++ : mal++; };
const txt = (r: any) => (typeof r === "string" ? r : r?.contenido ?? JSON.stringify(r));

function mesa() {
  const p = nuevaPartida(); normalizarPartida(p);
  const E = (n: string, d: object): any => ejecutar(n, d, p);
  for (const [n, clase] of [["Ana", "Mercenario del Cuervo"], ["Varok", "Mercenario del Cuervo"]])
    E("guardar_personaje", { don_arcano: false, nombre: n, jugador: n, raza: "Humano del Faro", clase, nivel: 1, pv_max: 20, ca: 12, atributos: { fue: 16, des: 14, con: 14, int: 10, sab: 10, car: 10 }, inventario: ["Espada larga"] });
  E("tiempo", { fijar: { dia: 1, hora: 9 } });
  return { p, E, varok: p.personajes.Varok, ana: p.personajes.Ana };
}
const herida = { nombre: "Varok", causa: "menor", tipo: "corte", gravedad: "leve", ubicacion: "brazo derecho" };
const seg = (p: any) => p.reloj.segundos;
const estados = (p: any) => Object.values<any>(p.personajes).map((x) => `${x.sustento?.hambre ?? 0}/${x.sustento?.sed ?? 0}/${x.condiciones.join(",")}`).join(";");

// (a) infligir con contexto y sin combate
{ const { p, E, varok } = mesa();
  fijarAccionesDelTurno(["Ana: Pulso la palanca del Altar Quemado con cuidado", "Varok: Miro el mapa"]);
  t(accionesDelTurno()?.length === 2, "accionesDelTurno devuelve las acciones fijadas");
  let r = E("infligir_herida", herida);
  t(!!r.error && /No inflijas heridas por tu cuenta/.test(r.contenido) && /Ana: Pulso la palanca/.test(r.contenido), "sin cita: error claro en español con la lista de acciones", r.contenido.slice(0, 90));
  t(varok.heridas.length === 0, "sin cita: no se crea la herida");
  r = E("infligir_herida", { ...herida, cita: "esto no lo escribió nadie" });
  t(!!r.error && varok.heridas.length === 0, "cita falsa: error y sin herida");
  r = E("infligir_herida", { ...herida, cita: "corto" });
  t(!!r.error && varok.heridas.length === 0, "cita de 5 letras que no aparece: error");
  r = E("infligir_herida", { ...herida, cita: "PULSO LA PALANCA DEL ALTAR   QUEMADO" });
  t(!r.error && varok.heridas.length === 1, "cita literal con otra capitalización: herida creada", String(r.error ? r.contenido : ""));
  fijarAccionesDelTurno(["Ana: Pulsó la acción del péndulo"]);
  r = E("infligir_herida", { ...herida, cita: "PULSO LA ACCION DEL PENDULO" });
  t(!r.error, "la cita ignora tildes", String(r.error ? r.contenido : ""));
  fijarAccionesDelTurno(null);
  t(accionesDelTurno() === null, "fijar null limpia el contexto"); }

// con combate en curso: sin cita funciona
{ const { p, E, varok } = mesa();
  E("aparecer_criatura", { nombre: "Hambriento", repetir: true }); E("iniciativa", { participantes: ["Ana", "Varok", "Hambriento"] });
  t(!!p.combate, "hay combate en curso");
  fijarAccionesDelTurno(["Ana: Ataco"]);
  const r = E("infligir_herida", herida);
  t(!r.error && varok.heridas.length === 1, "con combate: infligir sin cita funciona", String(r.error ? r.contenido : ""));
  fijarAccionesDelTurno(null); }

// (b) sin contexto: todo como antes
{ const { p, E, varok } = mesa();
  t(accionesDelTurno() === null, "por defecto no hay contexto");
  let r = E("infligir_herida", herida);
  t(!r.error && varok.heridas.length === 1, "sin contexto: infligir sin cita funciona");
  const a = seg(p);
  r = E("pasar_tiempo", { dias: 1, calidad: "esfuerzo" });
  t(!r.error && seg(p) === a + 86400, "sin contexto: pasar_tiempo sin cita avanza el reloj");
  t(!/comer y beber corren/.test(txt(r)), "sin contexto: sin aviso de sustento");
  r = E("tiempo", { avanzar: { horas: 8 } });
  t(!r.error, "sin contexto: tiempo horas 8 sin cita permitido"); }

// (c) pasar_tiempo con contexto
{ const { p, E, varok, ana } = mesa();
  fijarAccionesDelTurno(["Ana: Dormimos hasta el amanecer junto a la hoguera", "Varok: vigilo"]);
  p.personajes.Ana.pv = 10;
  const a = seg(p), pv = ana.pv, h = varok.heridas.length;
  let r = E("pasar_tiempo", { dias: 1, calidad: "esfuerzo" });
  t(!!r.error && /No avances el reloj por tu cuenta/.test(r.contenido) && /Dormimos hasta el amanecer/.test(r.contenido), "sin cita: error claro", r.contenido.slice(0, 80));
  t(seg(p) === a && ana.pv === pv && varok.heridas.length === h, "sin cita: reloj, PV y heridas intactos");
  r = E("pasar_tiempo", { dias: 1, calidad: "esfuerzo", cita: "no lo dijo nadie" });
  t(!!r.error && seg(p) === a, "cita falsa: error y reloj intacto");
  r = E("pasar_tiempo", { dias: 1, calidad: "esfuerzo", cita: "dormimos hasta el amanecer" });
  t(!r.error && seg(p) === a + 86400, "con cita válida: el reloj avanza un día", String(r.error ? r.contenido : ""));
  t(/El reloj avanza 1 día\(s\): recuerda que comer y beber corren \(sustento\): narra el paso del tiempo\./.test(txt(r)), "el texto lleva el aviso de sustento");
  fijarAccionesDelTurno(null); }

// (d) tiempo avanzar
{ const { p, E } = mesa();
  fijarAccionesDelTurno(["Ana: Descansamos y dormimos ocho horas"]);
  const a = seg(p);
  let r = E("tiempo", { avanzar: { minutos: 20 } });
  t(!r.error && seg(p) === a + 1200, "20 minutos sin cita: permitido", String(r.error ? r.contenido : ""));
  r = E("tiempo", { avanzar: { horas: 5, minutos: 59 } });
  t(!r.error, "5 h 59 min sin cita: permitido", String(r.error ? r.contenido : ""));
  const b = seg(p);
  r = E("tiempo", { avanzar: { horas: 8 } });
  t(!!r.error && /No avances el reloj por tu cuenta/.test(r.contenido) && seg(p) === b, "8 h sin cita: error y reloj intacto");
  r = E("tiempo", { avanzar: { horas: 3, minutos: 180 } });
  t(!!r.error, "3 h + 180 min suman 6 h: exige cita");
  r = E("tiempo", { avanzar: { horas: 8 }, cita: "dormimos ocho horas" });
  t(!r.error && seg(p) === b + 8 * 3600, "8 h con cita: ok", String(r.error ? r.contenido : ""));
  t(/comer y beber corren/.test(txt(r)), "8 h con cita: aviso de sustento");
  r = E("tiempo", { fijar: { hora: 23 } });
  t(!/cita/.test(r.contenido), "fijar no pide cita");
  fijarAccionesDelTurno(null); }

// (e) el incidente
{ const { p, E, varok, ana } = mesa();
  fijarAccionesDelTurno(["Ana: Miro el mapa"]);
  const a = seg(p), antes = estados(p);
  let r = E("infligir_herida", { nombre: "Varok", causa: "menor", tipo: "quemadura", ubicacion: "pierna derecha", descripcion: "quemadura en la pierna" });
  t(!!r.error && varok.heridas.length === 0, "incidente: la herida inventada se rechaza");
  r = E("pasar_tiempo", { dias: 1, calidad: "esfuerzo" });
  t(!!r.error, "incidente: el día inventado se rechaza");
  t(seg(p) === a, "incidente: el reloj no se mueve");
  t(varok.heridas.length === 0 && ana.heridas.length === 0, "incidente: ni heridas");
  t(estados(p) === antes && !/deshidratado|hambriento/i.test(estados(p)), "incidente: ni hambre ni sed", estados(p));
  fijarAccionesDelTurno(null); }

// (f) tiempo fijar con contexto
{ const { p, E } = mesa(); // reloj fijado a mano: Día 1, 09:00
  fijarAccionesDelTurno(["Ana: Esperamos hasta que anochezca"]);
  const a = seg(p), antes = estados(p);
  let r = E("tiempo", { fijar: { dia: 2, hora: 8 } });
  t(!!r.error && /No avances el reloj por tu cuenta/.test(r.contenido) && seg(p) === a && estados(p) === antes, "fijar +23 h sin cita: error, reloj y sustento intactos", r.contenido.slice(0, 70));
  r = E("tiempo", { fijar: { hora: 20 } });
  t(!!r.error && seg(p) === a, "fijar +11 h sin cita: error");
  r = E("tiempo", { fijar: { dia: 2, hora: 9 }, cita: "esto no lo dijo nadie" });
  t(!!r.error && seg(p) === a, "fijar con cita falsa: error");
  r = E("tiempo", { fijar: { hora: 14, minuto: 59 } });
  t(!r.error && seg(p) === a + 5 * 3600 + 59 * 60, "fijar +5 h 59 min sin cita: permitido", String(r.error ? r.contenido : ""));
  const b = seg(p);
  r = E("tiempo", { fijar: { hora: 3 } });
  t(!!r.error && /no retrocede/.test(r.contenido) && !/cita/.test(r.contenido) && seg(p) === b, "fijar hacia atrás: sigue rechazado por retroceder, sin pedir cita");
  r = E("tiempo", { fijar: { hora: 14, minuto: 59 } });
  t(!r.error && seg(p) === b, "fijar a la misma hora: permitido sin cita");
  const c = seg(p);
  r = E("tiempo", { fijar: { dia: 2, hora: 3 } });
  t(!!r.error && seg(p) === c, "fijar con dia +1 (24 h) sin cita: error");
  r = E("tiempo", { fijar: { hora: 5 }, avanzar: { horas: 5 } });
  t(!!r.error && seg(p) === c, "fijar +2 h con avanzar 5 h: suman 7 h y exigen cita");
  r = E("tiempo", { fijar: { dia: 2, hora: 8 }, cita: "esperamos hasta que anochezca" });
  t(!r.error && seg(p) === 86400 + 8 * 3600 && /comer y beber corren/.test(txt(r)), "fijar +29 h con cita válida: ok y aviso de sustento", String(r.error ? r.contenido : ""));
  fijarAccionesDelTurno(null);
  r = E("tiempo", { fijar: { dia: 9, hora: 8 } });
  t(!r.error, "sin contexto: fijar adelante sin cita permitido"); }

// fijar la primera vez (reloj automático) sin cita
{ const p = nuevaPartida(); normalizarPartida(p);
  ejecutar("guardar_personaje", { don_arcano: false, nombre: "Ana", jugador: "Ana", raza: "Humano del Faro", clase: "Mercenario del Cuervo", nivel: 1, pv_max: 20, ca: 12, atributos: { fue: 16, des: 14, con: 14, int: 10, sab: 10, car: 10 }, inventario: [] }, p);
  fijarAccionesDelTurno(["Ana: Miro el mapa"]);
  const r: any = ejecutar("tiempo", { fijar: { dia: 5, hora: 22 } }, p);
  t(!r.error && p.reloj?.segundos === 4 * 86400 + 22 * 3600, "primera fijación: permitida sin cita aunque sea lejana", String(r.error ? r.contenido : ""));
  fijarAccionesDelTurno(null); }

// el incidente con fijar
{ const { p, E } = mesa();
  fijarAccionesDelTurno(["Ana: Miro el mapa"]);
  const a = seg(p), antes = estados(p);
  const r = E("tiempo", { fijar: { dia: 2, hora: 8 } });
  t(!!r.error && seg(p) === a && estados(p) === antes, "incidente: fijar el día 2 a las 8 se rechaza sin tocar hambre/sed", estados(p));
  fijarAccionesDelTurno(null); }

// (g) idiomas y nave
{ const { p, E, ana } = mesa();
  fijarAccionesDelTurno(["Ana: Estudiamos karak con el enano durante un mes", "Varok: Zarpamos hacia el sur toda la jornada"]);
  const a = seg(p);
  let r = E("idioma", { accion: "aprender", quien: "Ana", idioma: "karak", maestro: "el enano", dias: 30 });
  t(!!r.error && /No avances el reloj por tu cuenta/.test(r.contenido) && seg(p) === a && !(ana.idiomas ?? []).includes("karak"), "idioma 30 días sin cita: error, reloj y estudio intactos");
  r = E("idioma", { accion: "aprender", quien: "Ana", idioma: "karak", maestro: "el enano", dias: 1 });
  t(!!r.error && seg(p) === a, "idioma 1 día sin cita: error (24 h)");
  r = E("idioma", { accion: "comprobar", idioma: "karak" });
  t(!r.error, "idioma comprobar no pide cita");
  r = E("idioma", { accion: "aprender", quien: "Ana", idioma: "karak", maestro: "el enano", dias: 3, cita: "estudiamos karak con el enano" });
  t(!r.error && seg(p) === a + 3 * 86400 && /comer y beber corren/.test(txt(r)), "idioma con cita: ok, reloj +3 días y aviso", String(r.error ? r.contenido : ""));
  const b = seg(p);
  E("nave", { accion: "crear", nave: "Gaviota", tipo: "bote" });
  E("nave", { accion: "abordar", nave: "Gaviota", quienes: ["Ana", "Varok"] });
  r = E("nave", { accion: "navegar", nave: "Gaviota", horas: 8, viento: "normal" });
  t(!!r.error && /No avances el reloj por tu cuenta/.test(r.contenido) && seg(p) === b, "nave 8 h sin cita: error y reloj intacto", String(r.contenido).slice(0, 60));
  r = E("nave", { accion: "navegar", nave: "Gaviota", horas: 8, viento: "normal", cita: "zarpamos hacia el sur" });
  t(!r.error && seg(p) === b + 8 * 3600 && /comer y beber corren/.test(txt(r)), "nave 8 h con cita: ok y aviso", String(r.error ? r.contenido : ""));
  const c = seg(p);
  r = E("nave", { accion: "navegar", nave: "Gaviota", horas: 2, viento: "normal" });
  t(!r.error && seg(p) === c + 7200, "nave 2 h sin cita: permitida", String(r.error ? r.contenido : ""));
  fijarAccionesDelTurno(null); }

// sin contexto: idiomas y nave como antes
{ const { p, E } = mesa();
  fijarAccionesDelTurno(null);
  const a = seg(p);
  let r = E("idioma", { accion: "aprender", quien: "Ana", idioma: "karak", maestro: "el enano", dias: 2 });
  t(!r.error && seg(p) === a + 2 * 86400 && !/comer y beber corren/.test(txt(r)), "sin contexto: idioma sin cita, sin aviso");
  E("nave", { accion: "crear", nave: "Gaviota", tipo: "bote" }); E("nave", { accion: "abordar", nave: "Gaviota", quienes: ["Ana"] });
  r = E("nave", { accion: "navegar", nave: "Gaviota", horas: 10, viento: "normal" });
  t(!r.error && seg(p) === a + 2 * 86400 + 36000, "sin contexto: nave 10 h sin cita permitida"); }

// (i) viajar: guarda de cita desde 6 h (el reloj avanza exactamente `horas`; ritmo y terreno solo cambian los km)
{ const { p, E, ana } = mesa();
  (ana.inventario as any[]).push("Raciones de viaje (5)", "Odre de agua (2)");
  const inv = () => JSON.stringify(Object.values<any>(p.personajes).map((x) => x.inventario));
  fijarAccionesDelTurno(["Ana: Seguimos el camino hasta Pozonegro", "Varok: Miro el mapa"]);
  const a = seg(p), i0 = inv(), s0 = estados(p);
  let r = E("viajar", { horas: 8, ritmo: "normal", terreno: "camino", motivo: "Pozonegro" });
  t(!!r.error && /No avances el reloj por tu cuenta/.test(r.contenido) && seg(p) === a && inv() === i0 && estados(p) === s0, "viajar 8 h sin cita: error, reloj, raciones y agua intactos", String(r.contenido).slice(0, 60));
  r = E("viajar", { horas: 8, ritmo: "normal", terreno: "camino", cita: "esto no lo escribió nadie" });
  t(!!r.error && seg(p) === a, "viajar 8 h con cita falsa: error y reloj intacto");
  r = E("viajar", { horas: 5, ritmo: "lento", terreno: "dificil" });
  t(!r.error && seg(p) === a + 5 * 3600, "viajar 5 h lento y difícil sin cita: permitido (ritmo y terreno no alargan el reloj)", String(r.error ? r.contenido : ""));
  const b = seg(p);
  r = E("viajar", { horas: 8, ritmo: "normal", terreno: "camino", cita: "seguimos el camino hasta Pozonegro" });
  t(!r.error && seg(p) === b + 8 * 3600 && /comer y beber corren/.test(txt(r)), "viajar 8 h con cita: ok, reloj +8 h y aviso", String(r.error ? r.contenido : ""));
  const c = seg(p);
  r = E("viajar", { horas: 3, ritmo: "normal", terreno: "camino" });
  t(!r.error && seg(p) === c + 3 * 3600 && !/comer y beber corren/.test(txt(r)), "viajar 3 h sin cita: permitido y sin aviso", String(r.error ? r.contenido : ""));
  fijarAccionesDelTurno(null); }

// viajar sin contexto: como antes
{ const { p, E } = mesa();
  fijarAccionesDelTurno(null);
  const a = seg(p);
  const r = E("viajar", { horas: 8, ritmo: "normal", terreno: "camino" });
  t(!r.error && seg(p) === a + 8 * 3600 && !/comer y beber corren/.test(txt(r)), "sin contexto: viajar 8 h sin cita, sin aviso", String(r.error ? r.contenido : "")); }

// (h) pasar_tiempo con personajes parciales
{ const { p, E } = mesa();
  let r = E("pasar_tiempo", { dias: 1, calidad: "esfuerzo", personajes: ["Ana"] });
  t(!r.error && /Ojo: el reloj del mundo avanza para todos \(1 personajes no descansan y sufren hambre y sed\)\./.test(txt(r)), "parcial: línea de Ojo con el número de quienes no descansan", txt(r).slice(-120));
  r = E("pasar_tiempo", { dias: 1, calidad: "esfuerzo", personajes: ["Ana", "Varok"] });
  t(!r.error && !/Ojo:/.test(txt(r)), "personajes = todos: sin Ojo");
  r = E("pasar_tiempo", { dias: 1, calidad: "esfuerzo" });
  t(!r.error && !/Ojo:/.test(txt(r)), "sin personajes: sin Ojo"); }

console.log(`${ok} ok, ${mal} fallas`);
