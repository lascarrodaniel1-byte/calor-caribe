// Avance automático del reloj al acabar un turno (bloque 1 de la optimización; 3 minutos = PROPUESTA A CONFIRMAR): lo decide la función pura
// `segundosAutomaticos` y lo aplica `tiempoDeTurno`. Solo si el DM no movió el reloj, sin combate, sin creación de personajes y con reloj; deja el
// aviso público «🕒 … · ⏱ automático» y cuenta las consecuencias del tiempo (hambre, sed, estados que caducan). La pista de repaso sobre saltos
// narrados sigue funcionando (los 3 minutos automáticos no cuentan como «avance»). Dados fijos donde importa.
import { nuevaPartida, normalizarPartida } from "../../src/estado.ts";
import { ejecutar, fijarAccionesDelTurno, segundosAutomaticos, tiempoDeTurno, SEGUNDOS_TURNO_AUTOMATICO } from "../../src/herramientas.ts";
import { pistasDeRepaso } from "../../src/repaso.ts";
import { sistemaWeb } from "../../src/prompt-web.ts";
import { iniciarRegistroDados, liberarDados } from "../../src/dados.ts";
let ok = 0, mal = 0; const t = (c: boolean, m: string, x = "") => { console.log(c ? "ok   " : "FALLA", m, x); c ? ok++ : mal++; };
const R = <T>(f: () => T, dados: { caras: number; valor: number }[]): T => { iniciarRegistroDados(dados); try { return f(); } finally { liberarDados(); } };

function mk() {
  const p = nuevaPartida(); normalizarPartida(p); const E = (n: string, x: object): any => ejecutar(n, x, p);
  E("guardar_personaje", { don_arcano: false, nombre: "Aldo", jugador: "Ana", raza: "Humano del Faro", clase: "Mercenario del Cuervo", nivel: 5, pv_max: 90, ca: 12, atributos: { fue: 16, des: 14, con: 14, int: 10, sab: 12, car: 10 }, inventario: [] });
  E("tiempo", { fijar: { dia: 1, hora: 10, minuto: 0 } });
  return { p, E };
}

// ---- la función pura
t(SEGUNDOS_TURNO_AUTOMATICO === 180, "propuesta: 3 minutos por turno");
t(segundosAutomaticos({}, {}) === 0 && segundosAutomaticos({ reloj: undefined }, { relojAntes: 5 }) === 0, "sin reloj: 0");
{
  const r = { reloj: { segundos: 36000 } };
  t(segundosAutomaticos(r, { relojAntes: 36000 }) === 180, "exploración o diálogo con el reloj sin mover: 180 s");
  t(segundosAutomaticos(r) === 180, "sin referencia previa (relojAntes sin definir): 180 s");
  t(segundosAutomaticos(r, { relojAntes: 35000 }) === 0, "el DM ya movió el reloj en el turno: 0");
  t(segundosAutomaticos(r, { relojAntes: 36000, enCombate: true }) === 0, "en combate: 0 (los asaltos ya cuentan 6 s)");
  t(segundosAutomaticos(r, { relojAntes: 36000, creando: true }) === 0, "creación de personajes (fase previa): 0");
}

// ---- tiempoDeTurno: avanza 3 minutos y deja el aviso
{
  const { p } = mk(); const a = p.reloj!.segundos;
  const av = tiempoDeTurno(p, a);
  t(p.reloj!.segundos === a + 180, "un turno sin movimiento del reloj avanza 180 s", String(p.reloj!.segundos - a));
  t(av.length >= 1 && /^🕒 Día 1, 10:03 \(mañana\) · ⏱ automático$/.test(av[0]), "el primer aviso es «🕒 Día 1, 10:03 … · ⏱ automático»", av[0]);
  t(av.filter((x) => /^🕒/.test(x)).length === 1, "un solo aviso 🕒 (sin ruido extra)");
}
// el DM movió el reloj con cualquiera de las herramientas: no se duplica
for (const [nombre, datos] of [
  ["tiempo", { avanzar: { minutos: 30 } }],
  ["pasar_tiempo", { dias: 1, calidad: "reposo" }],
  ["descanso", { tipo: "corto" }],
] as [string, object][]) {
  const { p, E } = mk(); const a = p.reloj!.segundos;
  const r = E(nombre, datos);
  const despues = p.reloj!.segundos;
  const av = tiempoDeTurno(p, a);
  t(!r.error && despues !== a && av.length === 0 && p.reloj!.segundos === despues, `${nombre}: el DM movió el reloj, el programa no suma otra vez`, `${despues - a} s · ${r.error ? r.contenido : ""}`);
}
{
  const { p, E } = mk(); const a = p.reloj!.segundos;
  E("viajar", { destino: "Pozonegro", region: "Aldenmar", horas: 2, tipo: "aldea", cita: "nos ponemos en camino" });
  const movido = p.reloj!.segundos !== a;
  const av = tiempoDeTurno(p, a);
  t(!movido || av.length === 0, "viajar: si movió el reloj, no se duplica (o no mueve y entonces suma)", String(p.reloj!.segundos - a));
}
// combate (antes o durante el turno) y creación: nada
{
  const { p, E } = mk(); const a = p.reloj!.segundos;
  E("aparecer_criatura", { nombre: "Ogro", repetir: true });
  E("iniciativa", { participantes: ["Aldo", ...Object.values(p.jefes).map((j: any) => j.nombre)] });
  const r0 = p.reloj!.segundos;
  t(tiempoDeTurno(p, r0, { enCombate: !!p.combate }).length === 0 && p.reloj!.segundos === r0, "en combate no avanza (ni deja aviso)", String(r0 - a));
  const c = mk(); const b = c.p.reloj!.segundos;
  t(tiempoDeTurno(c.p, b, { creando: true }).length === 0 && c.p.reloj!.segundos === b, "creando personajes no avanza");
}
{ const p = nuevaPartida(); normalizarPartida(p); delete (p as any).reloj; t(tiempoDeTurno(p, undefined).length === 0 && !p.reloj, "sin reloj no hace nada ni lo crea"); }

// ---- las consecuencias del tiempo siguen funcionando por el mismo camino
{ // estado de daño que caduca por reloj fuera de combate (quemado: 18 s)
  const { p, E } = mk(); E("aparecer_criatura", { nombre: "Elemental de fuego" });
  const j: any = Object.values(p.jefes)[0]; j.pv = j.pv_max = 5000;
  R(() => E("habilidad_criatura", { criatura: j.nombre, habilidad: "Oleada de fuego", objetivos: ["Aldo"] }), Array.from({ length: 9 }, () => ({ caras: 20, valor: 1 })));
  const quemado = () => p.personajes.Aldo.condiciones.some((x: string) => /^quemado/.test(x));
  const antes = quemado();
  const a = p.reloj!.segundos;
  const av = tiempoDeTurno(p, a);
  t(antes && !quemado() && av.some((x) => /ya no está quemado/.test(x)), "los estados por daño caducan con los 3 minutos automáticos (aviso ⏱)", av.join(" | ").slice(0, 120));
}
{ // hambre y sed: tras 30 h sin beber, el avance automático avisa de la deshidratación (revisarSustento)
  const { p } = mk();
  p.reloj!.segundos += 30 * 3600; // el DM movió el reloj por su cuenta sin llamar a nada que cuente el sustento
  const a = p.reloj!.segundos;
  const av = tiempoDeTurno(p, a);
  t(p.reloj!.segundos === a + 180 && av[0].startsWith("🕒") && av.some((x) => /deshidratado/.test(x)), "el sustento se revisa en el mismo paso (sed y hambre corren)", av.join(" | ").slice(0, 120));
}
{ // el aviso de estación: cruzar el día 90 por el avance automático
  const { p } = mk(); p.calendario = { inicio: 1, anomalias: [] } as any; 
  p.reloj!.segundos = 90 * 86400 - 100; const a = p.reloj!.segundos;
  const av = tiempoDeTurno(p, a);
  t(av.some((x) => /Llega|Llegan/.test(x)), "el cambio de estación se avisa también con el avance automático", av.join(" | ").slice(0, 100));
}

// ---- repaso: sigue detectando saltos narrados sin avanzar (los 3 minutos automáticos no cuentan)
{
  const { p } = mk(); const a = p.reloj!.segundos;
  const texto = "Dormís hasta que amanece y el campamento despierta bajo la ceniza.";
  const antes = pistasDeRepaso(p, { texto, llamadas: [], relojAntes: a });
  tiempoDeTurno(p, a);
  const despues = pistasDeRepaso(p, { texto, llamadas: [], relojAntes: a });
  t(antes.some((x) => /reloj apenas se movió/.test(x)) && despues.some((x) => /reloj apenas se movió/.test(x)), "narrar «amanece» sin avanzar el reloj sigue dando pista, con y sin los 3 minutos", String(despues.length));
  t(pistasDeRepaso(p, { texto: "Aldo habla con Berta en la barra.", llamadas: [], relojAntes: a }).every((x) => !/reloj/.test(x)), "una conversación sin saltos no avisa del reloj");
  const { p: q, E: Eq } = mk(); const b = q.reloj!.segundos;
  fijarAccionesDelTurno(["Ana: dormimos hasta el amanecer"]);
  Eq("tiempo", { avanzar: { horas: 8 }, cita: "dormimos hasta el amanecer" });
  fijarAccionesDelTurno(null);
  t(!pistasDeRepaso(q, { texto, llamadas: ["tiempo"], relojAntes: b }).some((x) => /reloj apenas se movió/.test(x)), "si el DM avanzó las horas, no hay pista");
}

// ---- guardas del DM: tiempo ≥ 6 h sigue exigiendo cita
{
  const { p, E } = mk(); const a = p.reloj!.segundos;
  fijarAccionesDelTurno(["Ana: esperamos"]);
  const sin = E("tiempo", { avanzar: { horas: 8 } });
  const con = E("tiempo", { avanzar: { horas: 8 }, cita: "esperamos" });
  fijarAccionesDelTurno(null);
  t(!!sin.error && !con.error && p.reloj!.segundos === a + 8 * 3600, "tiempo avanzar ≥ 6 h sigue exigiendo cita literal del turno");
}

// ---- el prompt ya no manda avanzar el reloj a pasos pequeños y cabe en el límite
{
  const s = sistemaWeb();
  t(/suma solo 3 min por turno/.test(s) && !/conversar, 10 min/.test(s), "el prompt dice que el programa suma 3 min por turno y no pide avanzar a pasos de 10 min");
  t(s.length <= 67600, "prompt fijo ≤ 67.600", String(s.length));
}
console.log(`${ok} ok, ${mal} fallas`);
