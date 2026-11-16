// Revisión de puntos ciegos de los estados por tipo de daño, el botín y la ficha (docs/DANOS.md; BALANCE §19-§20): cada arreglo con su prueba.
// A1 caducidad por RELOJ fuera de combate y purga al iniciar uno · A2 «quemado» a mano arde · A3 botín sugerido sin aplicar avisa en el repaso
// A4 el agua apaga el fuego y «sumergido» resiste el fuego · A5 modificar_personaje con tipo_dano da estado · A6 el estado solo cuenta el daño del arma
// A7 ventajas raciales en la salvación del estado · A8 quemado a 0 PV = daño en el suelo · A9 Hiel por el registro (con duración) · A10 avisos del avance automático
// A11 temas del prompt · A12 CA con corroído · A13 Ulfhedinn de uno en uno a niveles bajos. Dados fijos.
import { nuevaPartida, normalizarPartida, fichaCorta, fichaTexto } from "../../src/estado.ts";
import { estadoParaDM } from "../../src/navegador.ts";
import { ejecutar, cerrarAsalto } from "../../src/herramientas.ts";
import { perfilDePersonaje } from "../../src/rasgos.ts";
import { pistasDeRepaso } from "../../src/repaso.ts";
import { sistemaWeb, consultarReglas, catalogoCompacto } from "../../src/prompt-web.ts";
import { TABLA } from "../../src/encuentros.ts";
import { iniciarRegistroDados, liberarDados } from "../../src/dados.ts";
let ok = 0, mal = 0; const t = (c: boolean, m: string, x = "") => { console.log(c ? "ok   " : "FALLA", m, x); c ? ok++ : mal++; };
const txt = (r: any) => (typeof r === "string" ? r : r?.contenido ?? JSON.stringify(r));
const d = (caras: number, ...v: number[]) => v.map((valor) => ({ caras, valor }));
const R = <T>(f: () => T, dados: { caras: number; valor: number }[]): T => { iniciarRegistroDados(dados); try { return f(); } finally { liberarDados(); } };
const FALLA = d(20, 1, 1, 1, 1, 1, 1, 1, 1, 1);

function mk(raza = "Humano del Faro", crit = "Ogro", extra: object = {}) {
  const p = nuevaPartida(); normalizarPartida(p); const E = (n: string, x: object): any => ejecutar(n, x, p);
  E("guardar_personaje", { don_arcano: false, nombre: "Aldo", jugador: "Ana", raza, clase: "Mercenario del Cuervo", nivel: 5, pv_max: 90, ca: 12, atributos: { fue: 16, des: 14, con: 14, int: 10, sab: 14, car: 10 }, inventario: ["Espada larga"], ...extra });
  E("aparecer_criatura", { nombre: crit });
  const j: any = Object.values(p.jefes)[0]; j.pv = j.pv_max = 5000;
  return { p, E, j, pj: p.personajes.Aldo as any };
}
const oleada = (m: ReturnType<typeof mk>) => R(() => m.E("habilidad_criatura", { criatura: m.j.nombre, habilidad: "Oleada de fuego", objetivos: ["Aldo"] }), FALLA);
const reg = (m: ReturnType<typeof mk>) => (m.p.estadosDano ?? []) as any[];

// ---- A1. Estados fuera de combate: caducan por reloj y no pasan al combate siguiente
{
  const m = mk("Humano del Faro", "Elemental de fuego");
  oleada(m);
  t(m.pj.condiciones.some((x: string) => /^quemado/.test(x)) && reg(m).length === 1 && reg(m)[0].seg === 18 && reg(m)[0].hasta === undefined, "fuera de combate el quemado se registra con plazo de reloj (3 asaltos = 18 s)", JSON.stringify(reg(m)));
  const r = m.E("pasar_tiempo", { dias: 1, calidad: "reposo", cita: "descansamos todo el día" });
  t(!m.pj.condiciones.some((x: string) => /^quemado/.test(x)) && reg(m).length === 0 && /ya no está quemado/.test(txt(r)), "pasar_tiempo: el quemado caduca (aviso ⏱) y sale del registro", m.pj.condiciones.join("|"));
}
{ // con reloj fijado: 5 s no, 20 s sí
  const m = mk("Humano del Faro", "Elemental de fuego"); m.E("tiempo", { fijar: { hora: 8 } });
  oleada(m);
  m.E("tiempo", { avanzar: { segundos: 5 } });
  t(m.pj.condiciones.some((x: string) => /^quemado/.test(x)) && reg(m)[0].seg === 13, "reloj: a los 5 s aún arde (quedan 13 s)", JSON.stringify(reg(m)));
  const r = m.E("tiempo", { avanzar: { segundos: 20 } });
  t(!m.pj.condiciones.some((x: string) => /^quemado/.test(x)) && reg(m).length === 0 && /⏱/.test(txt(r)), "reloj: a los 25 s ya no está quemado", m.pj.condiciones.join("|"));
}
{ // eléctrico (breve = 6 s) sobre una criatura fuera de combate y luego un combate: no hereda la parálisis (p4/p10)
  const m = mk();
  R(() => m.E("danar_criatura", { nombre: m.j.nombre, cantidad: 10, tipo_dano: "eléctrico", cd_estado: 13, por: "Aldo" }), d(20, 1));
  t(m.j.condiciones.some((x: string) => /^paralizado/.test(x)) && reg(m)[0]?.seg === 6, "fuera de combate: paralizado breve = 6 s de reloj", JSON.stringify(reg(m)));
  const r = m.E("iniciativa", { participantes: ["Aldo"], pnj: [{ nombre: "x", bono_ataque: 1, ca: 10, pv: 5 }] });
  t(!m.j.condiciones.some((x: string) => /^paralizado/.test(x)) && reg(m).length === 0 && /venía de antes del combate/.test(txt(r)), "iniciativa: el estado heredado se purga (con aviso)", m.j.condiciones.join("|"));
  for (let i = 0; i < 4; i++) m.E("siguiente_asalto", {});
  t(m.j.condiciones.length === 0, "tras 4 asaltos la criatura sigue sin condiciones heredadas");
}
{ // corroído dura hasta el descanso: ni el reloj ni la purga lo quitan
  const m = mk("Humano del Faro", "Ogro");
  R(() => m.E("danar_criatura", { nombre: "Aldo", cantidad: 1, tipo_dano: "ácido" }), d(20, 1)); // criatura no es Aldo: probamos con modificar_personaje abajo
  R(() => m.E("modificar_personaje", { nombre: "Aldo", pv_cambio: -10, tipo_dano: "ácido", cd_estado: 13 }), d(20, 1));
  t(m.pj.condiciones.some((x: string) => /^corroído/.test(x)) && reg(m)[0]?.seg === undefined && reg(m)[0]?.hasta === undefined, "corroído: sin plazo de reloj ni de asaltos");
  m.E("pasar_tiempo", { dias: 3, calidad: "reposo", cita: "esperamos tres días" });
  t(m.pj.condiciones.some((x: string) => /^corroído/.test(x)), "corroído sobrevive al paso del tiempo");
  m.E("iniciativa", { participantes: ["Aldo"], pnj: [{ nombre: "x", bono_ataque: 1, ca: 10, pv: 5 }] });
  t(m.pj.condiciones.some((x: string) => /^corroído/.test(x)), "corroído sobrevive a la purga al iniciar combate");
  m.E("terminar_combate", {}); m.E("descanso", { tipo: "largo" });
  t(!m.pj.condiciones.some((x: string) => /^corroído/.test(x)), "el descanso sí lo quita");
}

// ---- A2. «Quemado» puesto a mano arde y caduca
{
  const m = mk(); m.E("iniciativa", { participantes: ["Aldo"], pnj: [{ nombre: "x", bono_ataque: 1, ca: 10, pv: 5 }] });
  m.E("condicion", { objetivo: "Aldo", accion: "aplicar", condicion: "quemado (antorcha)" });
  t(reg(m).length === 1 && reg(m)[0].id === "quemado" && reg(m)[0].hasta !== undefined, "condicion quemado a mano queda registrado con su plazo", JSON.stringify(reg(m)));
  const pv0 = m.pj.pv;
  const r = R(() => m.E("siguiente_asalto", {}), d(4, 3));
  t(m.pj.pv === pv0 - 3 && /arde/.test(txt(r)), "el quemado manual arde al abrirse el asalto", `${pv0} → ${m.pj.pv}`);
  m.E("condicion", { objetivo: "Aldo", accion: "aplicar", condicion: "quemado (antorcha)" });
  t(reg(m).length === 1, "reaplicarlo no duplica el registro");
  for (let i = 0; i < 4; i++) R(() => m.E("siguiente_asalto", {}), d(4, 1));
  t(!m.pj.condiciones.some((x: string) => /^quemado/.test(x)) && reg(m).every((e: any) => e.inmuneHasta !== undefined || e.id !== "quemado"), "caduca a los 3 asaltos", m.pj.condiciones.join("|"));
  const n = mk(); n.E("modificar_personaje", { nombre: "Aldo", agregar_condiciones: ["quemado"] });
  t(reg(n).length === 1 && reg(n)[0].seg === 18, "agregar_condiciones quemado también se registra (fuera de combate, por reloj)", JSON.stringify(reg(n)));
  const o = mk(); o.E("iniciativa", { participantes: ["Aldo"], pnj: [{ nombre: "x", bono_ataque: 1, ca: 10, pv: 5 }] }); o.E("condicion", { objetivo: "Aldo", accion: "aplicar", condicion: "quemado" }); o.E("terminar_combate", {});
  t(!o.pj.condiciones.some((x: string) => /^quemado/.test(x)) && reg(o).length === 0, "terminar_combate limpia el quemado manual");
}

// ---- A3. Botín sugerido sin aplicar: el repaso avisa
{
  const m = mk();
  const r = m.E("generar_botin", { origen: "saqueo", cantidad: 2 });
  const oro = m.p.botinPendiente?.oro ?? 0;
  t(oro > 0 && /Oro: \d+ po/.test(txt(r)), "generar_botin apunta el oro sugerido como pendiente", JSON.stringify(m.p.botinPendiente));
  const texto = "Registráis el cadáver del bandido: encontráis 14 po y una daga; Aldo se lo guarda todo.";
  const pistas = pistasDeRepaso(m.p, { texto, llamadas: ["generar_botin"] });
  t(pistas.some((x) => /sin aplicar/.test(x) && new RegExp(`${oro} po`).test(x)), "el repaso avisa del botín sin aplicar aunque se llamara a generar_botin", pistas.join("|").slice(0, 200));
  m.E("modificar_personaje", { nombre: "Aldo", oro_cambio: oro });
  const objs = [...(m.p.botinPendiente?.objetos ?? [])];
  for (const o of objs) m.E("modificar_personaje", { nombre: "Aldo", agregar_objetos: [o] });
  t(m.p.botinPendiente === undefined && m.pj.oro >= oro, "al registrarlo con modificar_personaje el pendiente se vacía (sin doble conteo)", JSON.stringify(m.p.botinPendiente));
  t(!pistasDeRepaso(m.p, { texto, llamadas: ["generar_botin", "modificar_personaje"] }).some((x) => /sin aplicar/.test(x)), "y ya no avisa");
  const c = mk(); c.E("generar_botin", { origen: "compra", cantidad: 2 });
  t(c.p.botinPendiente === undefined, "una compra no deja botín pendiente");
}

// ---- A4. El agua apaga el fuego; sumergido resiste el fuego
{
  const m = mk("Humano del Faro", "Elemental de fuego");
  oleada(m);
  const r = m.E("agua", { accion: "sumergir", quienes: ["Aldo"] });
  t(!m.pj.condiciones.some((x: string) => /^quemado/.test(x)) && reg(m).length === 0 && /apaga/.test(txt(r)), "agua sumergir apaga el quemado y lo quita del registro", txt(r).slice(0, 160));
  t(perfilDePersonaje(m.pj).resiste!.some((x) => x.tipo === "fuego"), "sumergido resiste el fuego (dato en perfilDePersonaje)");
  const pv0 = m.pj.pv; m.E("modificar_personaje", { nombre: "Aldo", pv_cambio: -10, tipo_dano: "fuego", sin_estado: true });
  t(pv0 - m.pj.pv === 5, "y recibe la mitad", `${pv0 - m.pj.pv}`);
  const n = mk("Humano del Faro", "Elemental de fuego"); oleada(n);
  const r2 = n.E("agua", { accion: "entrar", quienes: ["Aldo"] });
  t(!n.pj.condiciones.some((x: string) => /^quemado/.test(x)) && /apaga/.test(txt(r2)), "agua entrar también lo apaga");
  const s = mk(); const a = s.E("agua", { accion: "sumergir", quienes: ["Aldo"] }); t(!/apaga/.test(txt(a)), "sin fuego no hay aviso de apagar");
  t(!perfilDePersonaje(mk().pj).resiste!.some((x) => x.tipo === "fuego"), "sin sumergir no resiste el fuego");
}

// ---- A5. modificar_personaje con tipo_dano da estado como sobre una criatura
{
  const m = mk();
  const r = R(() => m.E("modificar_personaje", { nombre: "Aldo", pv_cambio: -10, tipo_dano: "fuego", cd_estado: 13 }), FALLA);
  t(m.pj.condiciones.some((x: string) => /^quemado/.test(x)) && /sufre un estado/.test(txt(r)) && m.pj.pv === 80, "daño de fuego narrado sobre un PJ: salvación fallada → quemado", m.pj.condiciones.join("|"));
  const n = mk(); R(() => n.E("modificar_personaje", { nombre: "Aldo", pv_cambio: -10, tipo_dano: "fuego", sin_estado: true }), FALLA);
  t(n.pj.condiciones.length === 0, "sin_estado: true lo desactiva");
  const o = mk(); R(() => o.E("modificar_personaje", { nombre: "Aldo", pv_cambio: -10, tipo_dano: "fuego", cd_estado: 13 }), d(20, 20));
  t(o.pj.condiciones.length === 0, "salvación superada: sin estado");
  const q = mk(); R(() => q.E("modificar_personaje", { nombre: "Aldo", pv_cambio: -10, tipo_dano: "cortante" }), FALLA);
  t(q.pj.condiciones.length === 0, "daño físico: sin estado");
  const u = mk(); R(() => u.E("modificar_personaje", { nombre: "Aldo", pv_cambio: 10, tipo_dano: "fuego" }), FALLA);
  t(u.pj.condiciones.length === 0, "curar no da estado");
  const g = mk("Cenizo"); R(() => g.E("modificar_personaje", { nombre: "Aldo", pv_cambio: -10, tipo_dano: "fuego", cd_estado: 13 }), d(20, 1, 1)); // resistente: ventaja (1,1 sigue fallando)
  t(g.pj.pv === 85, "el Cenizo recibe la mitad", String(g.pj.pv));
  t(/modificar_personaje/.test(consultarReglas("estados")) && /sin_estado/.test(consultarReglas("estados")), "consultar_reglas estados lo documenta");
}

// ---- A6. El estado cuenta solo el daño del arma, no el del Castigo radiante
{
  const m = mk("Humano del Faro", "Ogro", { clase: "Caballero Juramentado", nivel: 6, pv_max: 60, inventario: ["Espada larga"] });
  m.E("juramento", { quien: "Aldo", accion: "jurar", votos: ["verdad"] });
  const r = R(() => m.E("atacar", { atacante: "Aldo", objetivo: m.j.nombre, dano: "1d4-3", bono: 50, tipo_dano: "fuego", castigo: true, temerario: false }), [...d(20, 15, 1, 1, 1), ...d(4, 1), ...d(8, 4, 4, 4, 4, 4, 4)]);
  t(!m.j.condiciones.some((x: string) => /^quemado/.test(x)) && /Radiante/.test(txt(r)) && reg(m).length === 0, "arma de fuego con daño propio 0 + Castigo: sin quemado", txt(r).slice(-200));
}

// ---- A7. Ventajas raciales contra miedo/veneno en la salvación del estado
{
  const m = mk("Humano del Faro", "Ogro");
  const r = R(() => m.E("modificar_personaje", { nombre: "Aldo", pv_cambio: -10, tipo_dano: "psíquico", cd_estado: 30 }), d(20, 1, 2));
  t(/ventaja: Obstinación/.test(txt(r)), "psíquico → asustado: el Humano del Faro tira con ventaja (Obstinación) y la tirada lo dice", txt(r).slice(-260));
  const n = mk("Mediano de Hollín"); const r2 = R(() => n.E("modificar_personaje", { nombre: "Aldo", pv_cambio: -10, tipo_dano: "psíquico", cd_estado: 30 }), d(20, 1, 2));
  t(/ventaja: Valiente/.test(txt(r2)), "el Mediano: Valiente");
  const e = mk("Enano de Karak-Dûm"); const r3 = R(() => e.E("modificar_personaje", { nombre: "Aldo", pv_cambio: -10, tipo_dano: "veneno", cd_estado: 30 }), d(20, 1, 2));
  t(/ventaja/.test(txt(r3)), "veneno: el Enano tira con ventaja");
  const o = mk("Humano del Faro"); const r4 = R(() => o.E("modificar_personaje", { nombre: "Aldo", pv_cambio: -10, tipo_dano: "fuego", cd_estado: 30 }), d(20, 1, 2));
  t(!/\(ventaja/.test(txt(r4)), "fuego: sin ventaja racial");
}

// ---- A8. Quemado a 0 PV: daño en el suelo
{
  const m = mk("Humano del Faro", "Elemental de fuego"); m.E("iniciativa", { participantes: ["Aldo"], pnj: [] });
  oleada(m);
  m.pj.pv = 0; m.pj.condiciones.push("inconsciente");
  const r = R(() => m.E("siguiente_asalto", {}), d(4, 2));
  t(/arde/.test(txt(r)) && (m.pj.muerte?.fallos ?? 0) === 1, "un PJ a 0 PV que sigue quemado sufre el fuego como un fallo de salvación contra muerte", `${JSON.stringify(m.pj.muerte)} ${txt(r).slice(-200)}`);
  m.pj.condiciones.push("muerto");
  const r2 = R(() => m.E("siguiente_asalto", {}), d(4, 2));
  t(!/Aldo arde/.test(txt(r2)), "un muerto ya no arde");
}

// ---- A9. Hiel por el registro de estados, con duración y sin duplicar
{
  const m = mk(); m.pj.condiciones.length = 0; m.pj.inventario.push("Hiel de Víbora Gris");
  const r = R(() => m.E("usar_vial", { vial: "Hiel de Víbora Gris", receptor: "Aldo", portador: "Aldo", via: "bebido" }), [...d(20, 1), ...d(6, 3, 3, 3, 3)]);
  const re = reg(m);
  t(m.pj.condiciones.filter((x: string) => /^envenenado/.test(x)).length === 1 && re.some((e: any) => e.id === "envenenado" && e.seg === 3600 && e.persiste), "Hiel: envenenado registrado (1 hora = 3600 s)", JSON.stringify(re));
  t(m.pj.condiciones.some((x: string) => /^paralizado/.test(x)) && re.some((e: any) => e.id === "paralizado" && e.seg === 60), "fallo por 5 o más: paralizado 1 minuto = 60 s", JSON.stringify(re));
  m.E("terminar_combate", {});
  t(m.pj.condiciones.some((x: string) => /^envenenado/.test(x)), "el estado de la Hiel sobrevive al fin del combate");
  m.E("tiempo", { fijar: { hora: 8 } }); m.E("tiempo", { avanzar: { minutos: 2 } });
  t(!m.pj.condiciones.some((x: string) => /^paralizado/.test(x)) && m.pj.condiciones.some((x: string) => /^envenenado/.test(x)), "a los 2 minutos acaba la parálisis y sigue el veneno");
  m.E("modificar_personaje", { nombre: "Aldo", agregar_condiciones: ["envenenado"] });
  t(m.pj.condiciones.filter((x: string) => /^envenenado/.test(x)).length === 1, "envenenado manual encima de uno registrado: sin duplicado");
  m.E("tiempo", { avanzar: { horas: 2 } });
  t(!m.pj.condiciones.some((x: string) => /^envenenado/.test(x)) && reg(m).length === 0, "pasada la hora, caduca");
  const n = mk(); n.pj.condiciones.length = 0; n.E("modificar_personaje", { nombre: "Aldo", agregar_condiciones: ["envenenado"] }); n.pj.inventario.push("Hiel de Víbora Gris");
  R(() => n.E("usar_vial", { vial: "Hiel de Víbora Gris", receptor: "Aldo", portador: "Aldo", via: "bebido" }), [...d(20, 1), ...d(6, 3, 3, 3, 3)]);
  t(n.pj.condiciones.filter((x: string) => /^envenenado/.test(x)).length === 1, "Hiel sobre un envenenado manual: sin duplicado");
}

// ---- A10. El avance automático avisa de quemaduras y caducidades
{
  const m = mk("Humano del Faro", "Elemental de fuego"); m.E("iniciativa", { participantes: ["Aldo"], pnj: [] }); oleada(m);
  const c = R(() => cerrarAsalto(m.p), d(4, 3, 3));
  t(!!c && c.avisos[0].startsWith("⚔ Asalto") && c.avisos.some((a) => /^🔥 .*arde/.test(a)), "cerrarAsalto: aviso 🔥 de la quemadura", JSON.stringify(c?.avisos));
  let ultimo: string[] = [];
  for (let i = 0; i < 3; i++) { const x = R(() => cerrarAsalto(m.p), d(4, 1, 1)); ultimo = x?.avisos ?? ultimo; if (x?.avisos.some((a) => /^⏱/.test(a))) break; }
  t(ultimo.some((a) => /^⏱ .*ya no está quemado/.test(a)), "y el aviso ⏱ de la caducidad", JSON.stringify(ultimo));
}

// ---- A11. El prompt lista los temas estados y tesoro
{
  const s = sistemaWeb(), cat = catalogoCompacto();
  t(/consultar_reglas\(tema.*\| tesoro \| estados \|/.test(cat), "la lista de temas de consultar_reglas incluye «tesoro» y «estados»");
  t(s.length <= 67600, "el prompt sigue ≤ 67.600", String(s.length));
}

// ---- A12. CA efectiva con corroído
{
  const m = mk(); m.pj.condiciones.push("corroído (ácido: hasta el descanso)");
  t(/CA 11 \(12, −1 corroído\)/.test(fichaCorta(m.pj)) && /CA 11 \(12, −1 corroído\)/.test(fichaTexto(m.pj)), "fichaCorta y fichaTexto: CA 11 (12, −1 corroído)", fichaCorta(m.pj).slice(0, 120));
  t(/CA 11 \(12, −1 corroído\)/.test(estadoParaDM(m.p)), "el estado del DM la muestra");
  const n = mk(); t(/CA 12\b/.test(fichaCorta(n.pj)) && !/corroído/.test(fichaCorta(n.pj)), "sin corroído, CA normal");
}

// ---- A13. Ulfhedinn: de uno en uno por debajo del nivel 7
{
  const u = TABLA.find((x) => x.id === "ulfhedinn")!;
  t(u.soloUnoHastaNivel === 7 && u.peligro === 4, "la plantilla del Ulfhedinn dice «solo uno hasta el nivel 7»");
  const cuenta = (nivel: number) => { let max = 0, vistos = 0; for (let i = 0; i < 2500; i++) { const p = nuevaPartida(); normalizarPartida(p); const E = (a: string, x: object): any => ejecutar(a, x, p);
    E("guardar_personaje", { don_arcano: false, nombre: "Aldo", jugador: "Ana", raza: "Humano del Faro", clase: "Mercenario del Cuervo", nivel, pv_max: 90, ca: 12, atributos: { fue: 16, des: 14, con: 14, int: 10, sab: 14, car: 10 }, inventario: ["Espada larga"] });
    E("ubicacion", { lugar: "Claro", region: "El Bosque de Velo Rojo", tipo: "otro" }); E("tiempo", { fijar: { hora: 23 } });
    const r = E("encuentro", { sin_jefe: true, dificultad: "mortal", tipo: "combate" }); const m = /plantilla «Ulfhedinn» \((\d+);/.exec(txt(r)); if (m) { vistos++; max = Math.max(max, Number(m[1])); } }
    return { max, vistos }; };
  const a = cuenta(5), b = cuenta(9);
  t(a.vistos > 0 && a.max === 1, `nivel 5: Ulfhedinn siempre de uno (${a.vistos} apariciones, máximo ${a.max})`);
  t(b.vistos > 0 && b.max >= 2, `nivel 9: puede salir en pareja (máximo ${b.max})`);
}

console.log(`${ok} ok, ${mal} fallas`);
