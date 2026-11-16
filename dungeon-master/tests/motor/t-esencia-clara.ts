// Vial «Esencia Clara» (nombre propuesto): quita los 9 estados temporales y nada más, exige receptor, se consume, sin inmunidad, y entra en tiendas y botín.
import { nuevaPartida, normalizarPartida } from "../../src/estado.ts";
import { ejecutar } from "../../src/herramientas.ts";
import { VIALES, NOMBRES_VIALES } from "../../src/viales.ts";
import { VIALES_ORIGEN, extrasBotin } from "../../src/equipo.ts";
import { ESTADOS_TEMPORALES } from "../../src/condiciones.ts";
import { comando } from "../../src/mesa.ts";
import { sistemaWeb, consultarReglas } from "../../src/prompt-web.ts";
import { iniciarRegistroDados, liberarDados } from "../../src/dados.ts";
let ok = 0, mal = 0; const t = (c: boolean, m: string, x = "") => { console.log(c ? "ok   " : "FALLA", m, x); c ? ok++ : mal++; };
const txt = (r: any) => (typeof r === "string" ? r : r?.contenido ?? JSON.stringify(r));
const d = (caras: number, ...v: number[]) => v.map((valor) => ({ caras, valor }));
const V = "Esencia Clara";

function mk() {
  const p = nuevaPartida(); normalizarPartida(p); const E = (n: string, x: object): any => ejecutar(n, x, p);
  const ficha = (nombre: string, extra: object = {}) => E("guardar_personaje", { don_arcano: false, nombre, jugador: nombre, raza: "Humano del Faro", clase: "Mercenario del Cuervo", nivel: 5, pv_max: 90, ca: 12, atributos: { fue: 16, des: 14, con: 14, int: 10, sab: 14, car: 10 }, inventario: ["Espada larga", V], ...extra });
  ficha("Aldo"); ficha("Brisa");
  return { p, E, A: () => p.personajes.Aldo as any, B: () => p.personajes.Brisa as any };
}
const NUEVE = ["quemado (fuego: 3 asaltos)", "paralizado (eléctrico: 1 turno)", "ralentizado (frío: 3 asaltos)", "envenenado (veneno: 3 asaltos)", "ensordecido (trueno: 3 asaltos)", "cegado (radiante)", "aturdido (psíquico)", "corroído (ácido: hasta el descanso)", "debilitado (necrótico: 3 asaltos)"];
const RESTO = ["agotamiento 2", "enfermedad grave: fiebre de los pantanos", "derribado", "hechizado", "maldito por la Corte"];

// ---- el vial existe y cuesta 40-60 po
t(V in VIALES && (NOMBRES_VIALES as readonly string[]).includes(V), "está en VIALES y en el enum del esquema (NOMBRES_VIALES)");
t(VIALES[V].precio! >= 40 && VIALES[V].precio! <= 60, "precio 40-60 po", String(VIALES[V].precio));
t(ESTADOS_TEMPORALES.length === 9, "los estados temporales son 9");

// ---- limpia los 9 (condición y registro) y respeta lo que no debe
{
  const m = mk(); m.A().condiciones.push(...NUEVE, ...RESTO);
  m.p.estadosDano = [{ nombre: "Aldo", id: "quemado", texto: NUEVE[0], tipo: "fuego", hasta: 9 }, { nombre: "Aldo", id: "paralizado", texto: NUEVE[1], tipo: "eléctrico", seg: 6 }, { nombre: "Aldo", id: "corroido", texto: NUEVE[7], tipo: "ácido" }, { nombre: "Brisa", id: "quemado", texto: "quemado", tipo: "fuego", hasta: 5 }];
  m.A().pv = 40;
  const r = m.E("usar_vial", { vial: V, receptor: "Aldo", portador: "Brisa" }); // Aldo está paralizado y aturdido: se la da Brisa
  const c: string[] = m.A().condiciones;
  t(!r.error && NUEVE.every((x) => !c.includes(x)), "quita los 9 estados temporales", c.join("|"));
  t(RESTO.every((x) => c.includes(x)), "NO quita agotamiento, enfermedad, derribado, hechizado ni maldiciones", c.join("|"));
  t((m.p.estadosDano ?? []).every((e: any) => e.nombre !== "Aldo") && m.p.estadosDano!.length === 1, "limpia también el registro de Aldo (con y sin duración) y no toca el de Brisa", JSON.stringify(m.p.estadosDano));
  t(m.A().pv === 40, "no cura PV");
  t(/quemado/.test(txt(r)) && /no toca maldiciones/i.test(txt(r)) && /no deja inmunidad/.test(txt(r)), "el aviso dice qué quitó y qué no toca", txt(r).slice(0, 220));
  t(!m.B().inventario.includes(V) && m.B().inventario.includes("Espada larga") && m.A().inventario.includes(V), "se descuenta del inventario del portador (Brisa), no del receptor");
  const solo = mk(); solo.A().condiciones.push("quemado (fuego: 3 asaltos)"); const rs = solo.E("usar_vial", { vial: V, receptor: "Aldo", portador: "Aldo" });
  t(!rs.error && !solo.A().inventario.includes(V) && !solo.A().condiciones.length, "quien no está incapacitado puede bebérselo él mismo y se gasta");
}
// ---- heridas no se tocan; sin inmunidad: puede volver a quemarse al instante
{
  const m = mk(); m.E("infligir_herida", { nombre: "Aldo", causa: "cero_pv", tipo: "corte" }); const h = m.A().heridas.length;
  m.A().condiciones.push("quemado (fuego: 3 asaltos)");
  m.E("usar_vial", { vial: V, receptor: "Aldo", portador: "Aldo" });
  t(m.A().heridas.length === h, "las heridas siguen");
  m.E("aparecer_criatura", { nombre: "Elemental de fuego" }); const j: any = Object.values(m.p.jefes)[0]; j.pv = j.pv_max = 5000;
  m.E("iniciativa", { participantes: ["Aldo"], pnj: [] });
  iniciarRegistroDados(d(20, 1, 1, 1, 1, 1, 1, 1, 1, 1)); const r = m.E("habilidad_criatura", { criatura: j.nombre, habilidad: "Oleada de fuego", objetivos: ["Aldo"] }); liberarDados();
  t(m.A().condiciones.some((x: string) => /^quemado/.test(x)) && !/inmune este asalto/.test(txt(r)), "sin asalto de inmunidad: se quema de nuevo en el acto", txt(r).slice(0, 80));
}
// ---- «paralizado» de la Hiel y «quemado» a mano (sin duración) también se van
{
  const m = mk(); m.A().condiciones.length = 0; m.A().inventario.push("Hiel de Víbora Gris");
  iniciarRegistroDados([...d(20, 1), ...d(6, 3, 3, 3, 3)]); m.E("usar_vial", { vial: "Hiel de Víbora Gris", receptor: "Aldo", portador: "Aldo", via: "bebido" }); liberarDados();
  m.A().condiciones.push("quemado"); // a mano, sin registro
  t(m.A().condiciones.some((x: string) => /^paralizado/.test(x)) && (m.p.estadosDano?.length ?? 0) >= 2, "preparado: Hiel (paralizado + envenenado) y quemado manual", m.A().condiciones.join("|"));
  // incapacitado (paralizado): otro debe dárselo
  const e1 = m.E("usar_vial", { vial: V, receptor: "Aldo", portador: "Aldo" });
  t(e1.error && /incapacitado/.test(txt(e1)) && m.A().inventario.includes(V), "un incapacitado no puede dárselo a sí mismo (error, el vial no se gasta)", txt(e1).slice(0, 120));
  const e2 = m.E("usar_vial", { vial: V, receptor: "Aldo" });
  t(e2.error && /incapacitado/.test(txt(e2)), "sin portador tampoco");
  const dar = m.E("usar_vial", { vial: V, receptor: "Aldo", portador: "Brisa" });
  t(!dar.error && !m.A().condiciones.some((x: string) => /^(paralizado|envenenado|quemado)/.test(x)) && (m.p.estadosDano?.length ?? 0) === 0 && !m.B().inventario.includes(V), "otro (Brisa) se la da: se van todos, también los sin duración, y se gasta SU vial", m.A().condiciones.join("|"));
  m.B().inventario.push(V); m.B().condiciones.push("aturdido");
  m.A().condiciones.push("cegado");
  const e3 = m.E("usar_vial", { vial: V, receptor: "Aldo", portador: "Brisa" });
  t(e3.error && /Brisa está incapacitado/.test(txt(e3)), "el portador incapacitado tampoco puede darlo");
}
// ---- receptor obligatorio; sin estados: error y no se gasta; el muerto no
{
  const m = mk(); m.A().condiciones.push("quemado");
  t(!!m.E("usar_vial", { vial: V, portador: "Aldo" }).error, "sin receptor: error (receptor obligatorio)");
  const n = mk(); const r = n.E("usar_vial", { vial: V, receptor: "Aldo", portador: "Aldo" });
  t(r.error && /ningún estado temporal/.test(txt(r)) && n.A().inventario.includes(V), "sin estados temporales: error y el vial no se gasta");
  const o = mk(); o.A().condiciones.push("muerto", "quemado"); const r2 = o.E("usar_vial", { vial: V, receptor: "Aldo", portador: "Aldo" });
  t(r2.error && /muerto/.test(txt(r2)) && o.A().condiciones.includes("muerto"), "no revive ni limpia a un muerto");
  const q = mk(); const r3 = q.E("usar_vial", { vial: V, receptor: "Aldo", portador: "Brisa" }); // Brisa lleva uno; Aldo sin estados → error, no gasta
  t(r3.error && q.B().inventario.includes(V), "el portador no pierde el vial si falla");
  const s = mk(); s.A().inventario = ["Espada larga"]; s.A().condiciones.push("quemado"); const r4 = s.E("usar_vial", { vial: V, receptor: "Aldo", portador: "Aldo" });
  t(r4.error && /no lleva/.test(txt(r4)), "sin el vial en el inventario: no se puede usar");
}
// ---- tiendas y hallazgos: reparto y suma 100
{
  for (const o of Object.keys(VIALES_ORIGEN) as (keyof typeof VIALES_ORIGEN)[]) {
    const tb = VIALES_ORIGEN[o].tabla;
    t(tb[tb.length - 1][0] === 100 && tb.every((x, i) => i === 0 || x[0] > tb[i - 1][0]), `tabla de viales de ${o}: creciente y suma 100`);
    const pct = tb.map(([m], i) => m - (i ? tb[i - 1][0] : 0)); const e = pct[tb.findIndex(([, n]) => n === V)];
    const cota: Record<string, [number, number]> = { compra: [15, 20], hallazgo: [15, 20], saqueo: [5, 10], jefe: [5, 15] };
    t(e >= cota[o][0] && e <= cota[o][1], `Esencia Clara en ${o}: ${e} % de los viales (cota ${cota[o].join("-")})`);
  }
  const p = mk().p; let n = 0, vial = 0; for (let i = 0; i < 4000; i++) { const dm: string[] = [], j: string[] = []; extrasBotin(p, { origen: "compra", cantidad: 2 }, dm, j); for (const l of j) if (/^- Vial:/.test(l)) { vial++; if (new RegExp(`${V} — 50 po`).test(l)) n++; } }
  t(vial > 0 && n / vial > 0.12 && n / vial < 0.22, `en tienda la Esencia Clara sale en ≈${Math.round((n / vial) * 100)} % de los viales a 50 po`);
  const q = mk().p; let h = 0; for (let i = 0; i < 300; i++) { const dm: string[] = [], j: string[] = []; extrasBotin(q, { origen: "hallazgo", cantidad: 2, incluir_viales: false }, dm, j); h += j.filter((l) => /Vial/.test(l)).length; }
  t(h === 0, "incluir_viales: false no da ninguno");
}
// ---- visible a jugadores, documentado y NO en el prompt fijo
{
  const c = comando(mk().p, "/viales"); t(!!c && new RegExp(V).test(c.texto) && c.publico === false, "/viales (mesa) lo lista", c?.texto.slice(0, 40));
  t(consultarReglas("viales")?.includes(V) && /Esencia Clara/.test(consultarReglas("estados")), "consultar_reglas viales y estados lo describen");
  t(!sistemaWeb().includes(V), "el prompt fijo no lo menciona", String(sistemaWeb().length));
}
console.log(`${ok} ok, ${mal} fallas`);
