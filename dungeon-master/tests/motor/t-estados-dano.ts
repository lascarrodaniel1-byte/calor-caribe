// Estados por tipo de daño (docs/DANOS.md; BALANCE §18; propuesta a confirmar): fuego → quemado, eléctrico → paralizado breve, frío → ralentizado (paralizado si falla por 5+ o crítico),
// ácido → corroído, veneno → envenenado, necrótico → debilitado, radiante → cegado breve, trueno → ensordecido (+ derribado), psíquico → asustado (aturdido), fuerza → derribado.
// Solo con daño FINAL > 0 de ese tipo, con salvación contra una CD fija, opt-out, sin acumular, duración corta y un asalto de inmunidad al acabar. Dados fijos.
import { nuevaPartida, normalizarPartida } from "../../src/estado.ts";
import { ejecutar } from "../../src/herramientas.ts";
import { BESTIARIO, buscarCriatura } from "../../src/bestiario.ts";
import { efectos } from "../../src/condiciones.ts";
import { ESTADOS_POR_DANO, cdDeEstado } from "../../src/estados.ts";
import { localizar, limpiarTrasCombate } from "../../src/combate.ts";
import { esFisico, TIPOS_DANO_CANONICOS } from "../../src/danos.ts";
import { limpiarNarracion } from "../../src/secuencia.ts";
import { consultarReglas } from "../../src/prompt-web.ts";
import { iniciarRegistroDados, liberarDados } from "../../src/dados.ts";
let ok = 0, mal = 0; const t = (c: boolean, m: string, x = "") => { console.log(c ? "ok   " : "FALLA", m, x); c ? ok++ : mal++; };
const txt = (r: any) => (typeof r === "string" ? r : r?.contenido ?? JSON.stringify(r));
const d20 = (...v: number[]) => v.map((valor) => ({ caras: 20, valor }));
const d6 = (...v: number[]) => v.map((valor) => ({ caras: 6, valor }));
const d4 = (...v: number[]) => v.map((valor) => ({ caras: 4, valor }));
const con = (n: string, es: string) => (n ? es : "");
void con;

function mk(criatura = "Ogro", extra: object = {}) {
  const p = nuevaPartida(); normalizarPartida(p); const E = (n: string, d: object): any => ejecutar(n, d, p);
  E("guardar_personaje", { don_arcano: false, nombre: "Aldo", jugador: "Ana", raza: "Humano del Faro", clase: "Mercenario del Cuervo", nivel: 5, pv_max: 900, ca: 12, atributos: { fue: 16, des: 14, con: 14, int: 10, sab: 14, car: 10 }, inventario: ["Espada larga"], dote: "Terco" });
  E("aparecer_criatura", { nombre: criatura, ...extra });
  const j = Object.values(p.jefes)[0]; j.pv = j.pv_max = 5000;
  const conds = () => j.condiciones ?? [];
  const tiene = (re: RegExp) => conds().some((x) => re.test(x));
  return { p, E, j, conds, tiene };
}
const dano = (m: ReturnType<typeof mk>, tipo: string, dados: { caras: number; valor: number }[], extra: object = {}) => {
  iniciarRegistroDados(dados); const r = m.E("danar_criatura", { nombre: m.j.nombre, cantidad: 10, tipo_dano: tipo, cd_estado: 13, por: "Aldo", ...extra }); liberarDados(); return txt(r);
};
// Ogro: CON +3, DES −1, SAB −2, FUE +4. CD 13. Fallo normal: total 11 (margen −2); fallo grave: margen ≤ −5; éxito: d20 15.
const NORMAL: Record<string, number> = { con: 8, des: 12, sab: 13, fue: 7 }, GRAVE: Record<string, number> = { con: 2, des: 2, sab: 2, fue: 2 }, EXITO = 15;

// ---- 1. El mapa: cada tipo → su estado (fallo normal y fallo grave)
{
  const ESP: Record<string, { normal: RegExp; grave: RegExp }> = {
    fuego: { normal: /^quemado/, grave: /^quemado/ }, eléctrico: { normal: /^paralizado/, grave: /^paralizado/ }, frío: { normal: /^ralentizado/, grave: /^paralizado/ },
    ácido: { normal: /^corroído/, grave: /^corroído/ }, veneno: { normal: /^envenenado/, grave: /^envenenado/ }, necrótico: { normal: /^debilitado/, grave: /^debilitado/ },
    radiante: { normal: /^cegado/, grave: /^cegado/ }, trueno: { normal: /^ensordecido/, grave: /^derribado|^ensordecido/ }, psíquico: { normal: /^asustado/, grave: /^aturdido/ }, fuerza: { normal: /^derribado/, grave: /^derribado/ },
  };
  t(TIPOS_DANO_CANONICOS.filter((x) => !esFisico(x)).every((x) => ESTADOS_POR_DANO[x]) && TIPOS_DANO_CANONICOS.filter(esFisico).every((x) => !ESTADOS_POR_DANO[x]), "mapa: los 10 tipos no físicos dan estado y los 3 físicos no");
  for (const [tipo, e] of Object.entries(ESP)) {
    const attr = ESTADOS_POR_DANO[tipo as "fuego"]!.salva;
    const a = mk(); const ra = dano(a, tipo, d20(NORMAL[attr]));
    t(a.conds().some((x) => e.normal.test(x)) && /sufre un estado/.test(ra), `${tipo}: fallo normal → ${e.normal.source.replace("^", "")}`, a.conds().join("|"));
    const b = mk(); dano(b, tipo, d20(GRAVE[attr]));
    t(b.conds().some((x) => e.grave.test(x)), `${tipo}: fallo por 5 o más → ${e.grave.source.replace("^", "")}`, b.conds().join("|"));
    const c = mk(); const rc = dano(c, tipo, d20(EXITO));
    t(c.conds().length === 0 && /aguanta el efecto/.test(rc), `${tipo}: salvación superada → sin estado`);
  }
  const tr = mk(); dano(tr, "trueno", d20(GRAVE.con)); t(tr.conds().length === 2 && tr.conds().some((x) => /^ensordecido/.test(x)) && tr.conds().some((x) => /^derribado/.test(x)), "trueno por 5 o más: ensordecido Y derribado");
  const fr = mk(); dano(fr, "frío", d20(NORMAL.con)); t(!fr.conds().some((x) => /paralizado/.test(x)), "frío normal: solo ralentizado (no paraliza)");
  t(efectos(["ralentizado (frío: 3 asaltos)"]).velocidadMitad && efectos(["ralentizado"]).salvDesDesv && efectos(["corroído (ácido)"]).caMenos === 1 && efectos(["debilitado"]).pruebas === "desventaja" && efectos(["quemado (fuego)"]).ids.includes("quemado") && !efectos(["quemado por la sal"]).ids.includes("quemado"), "catálogo: ralentizado (mitad de velocidad, DES desv), corroído (CA −1), debilitado, quemado (y «quemado por la sal» sigue siendo otra cosa)");
}

// ---- 2. Solo con daño final > 0 de ese tipo; físicos sin estado; inmunes; resistentes con ventaja; opt-out
{
  for (const f of ["cortante", "perforante", "contundente"]) { const m = mk(); const r = dano(m, f, d20(1)); t(m.conds().length === 0 && !/estado/.test(r), `${f} (físico): ningún estado`); }
  const sin = mk(); iniciarRegistroDados(d20(1)); sin.E("danar_criatura", { nombre: sin.j.nombre, cantidad: 10, cd_estado: 13 }); liberarDados(); t(sin.conds().length === 0, "danar_criatura sin tipo_dano: sin estado");
  const w = mk("Wendigo"); const rw = dano(w, "frío", d20(1)); t(w.conds().length === 0 && w.j.pv === 5000, "inmune al frío (Wendigo): daño 0 y sin estado", rw.slice(0, 80));
  const ef = mk("Elemental de fuego"); dano(ef, "fuego", d20(1)); t(ef.conds().length === 0, "inmune al fuego (Elemental de fuego): sin estado");
  const g = mk("Gigante de hueso"); const rg = dano(g, "psíquico", d20(NORMAL.sab)); t(g.conds().length === 0 && /inmune a la condición asustado/.test(rg), "inmune a la condición (Gigante de hueso, asustado): el golpe psíquico no le deja estado, con aviso claro", rg.split("\n").filter((l) => /inmune/.test(l)).join("|"));
  const dj = mk("Djinn"); dano(dj, "eléctrico", d20(1, 18)); t(dj.conds().length === 0, "resistente (Djinn, eléctrico): salvación con ventaja (1 y 18 → éxito)");
  const dj2 = mk("Djinn"); const r2 = dano(dj2, "eléctrico", d20(1, 2)); t(dj2.conds().some((x) => /^paralizado/.test(x)) && /ventaja/.test(r2), "resistente: con ventaja también puede fallar (1 y 2), y la tirada lo dice");
  const o = mk(); dano(o, "fuego", d20(1), { sin_estado: true }); t(o.conds().length === 0, "danar_criatura {sin_estado: true}: sin estado");
  const o2 = mk(); o2.j.definicion = { ...o2.j.definicion, sinEstados: true }; t(o2.E("danar_criatura", { nombre: o2.j.nombre, cantidad: 10, tipo_dano: "fuego", cd_estado: 13 }).error !== true, "criatura con sinEstados: el daño sigue (el opt-out es del que causa el estado)");
  const m0 = mk(); const pj = m0.p.personajes["Aldo"]; pj.pv = 0; // el objetivo caído no sufre estados
  t(!!pj && pj.pv === 0, "(un PJ a 0 PV no recibe estados: ver el trampa de abajo)");
}

// ---- 3. No acumula; un estado presente solo se renueva; el control no se alarga
{
  const m = mk(); m.p.combate = { ronda: 1, orden: [{ nombre: "Aldo", total: 20 }, { nombre: m.j.nombre, total: 10 }], pnj: {}, sorprendidos: [] };
  dano(m, "fuego", d20(NORMAL.des)); t(m.conds().length === 1 && m.p.estadosDano![0].hasta === 3, "quemado en el asalto 1: dura hasta el asalto 3 (3 asaltos)");
  m.p.combate.ronda = 2; const r = dano(m, "fuego", d20(NORMAL.des)); t(m.conds().length === 1 && /se renueva/.test(r) && m.p.estadosDano![0].hasta === 4, "otro golpe de fuego: no se duplica, solo renueva (hasta el asalto 4)", r.split("\n").filter((l) => /renueva/.test(l)).join("|"));
  const p = mk(); p.p.combate = { ronda: 1, orden: [{ nombre: "Aldo", total: 20 }, { nombre: p.j.nombre, total: 10 }], pnj: {}, sorprendidos: [] };
  dano(p, "eléctrico", d20(NORMAL.con)); const h0 = p.p.estadosDano![0].hasta; p.p.combate.ronda = 2; const r2 = dano(p, "eléctrico", d20(NORMAL.con));
  t(p.conds().length === 1 && p.p.estadosDano![0].hasta === h0 && /no se acumula/.test(r2), "paralizado dos veces: una sola condición y NO se alarga (control)", String(h0));
  const dist = mk(); dano(dist, "eléctrico", d20(NORMAL.con)); dist.E("condicion", { objetivo: dist.j.nombre, accion: "quitar", condicion: "paralizado" });
  t(dist.conds().length === 0 && !dist.p.estadosDano, "quitar la condición a mano limpia el registro");
}

// ---- 4. Duración y fin: breve = hasta el final de su siguiente turno; un asalto de inmunidad al acabar
{
  const m = mk(); m.p.combate = { ronda: 1, orden: [{ nombre: "Aldo", total: 20 }, { nombre: m.j.nombre, total: 10 }], pnj: {}, sorprendidos: [] };
  dano(m, "eléctrico", d20(NORMAL.con)); // Aldo (iniciativa 20) va antes que el Ogro: pierde SU turno de este asalto → hasta el final del asalto 1
  t(m.p.estadosDano![0].hasta === 1 && m.tiene(/paralizado/), "paralizado breve: el Ogro aún no ha actuado → hasta el final de este asalto");
  const s2 = txt(m.E("siguiente_asalto", {}));
  t(!m.tiene(/paralizado/) && /ya no está paralizado/.test(s2) && m.p.estadosDano![0].inmuneHasta === 2, "al abrirse el asalto 2 acaba solo y queda inmune a él un asalto", s2.split("\n").filter((l) => /paralizado/.test(l)).join("|"));
  const r = dano(m, "eléctrico", d20(1)); t(!m.tiene(/paralizado/) && /inmune a ese estado/.test(r), "el asalto de inmunidad: otro rayo NO lo paraliza otra vez (límite de parálisis encadenada)");
  m.E("siguiente_asalto", {}); const r3 = dano(m, "eléctrico", d20(NORMAL.con)); t(m.tiene(/paralizado/) && /sufre un estado/.test(r3), "pasado el asalto de inmunidad, vuelve a poder sufrirlo");
  // si el objetivo ya actuó este asalto, «su siguiente turno» es el del asalto siguiente
  const n = mk(); n.p.combate = { ronda: 1, orden: [{ nombre: n.j.nombre, total: 20 }, { nombre: "Aldo", total: 10 }], pnj: {}, sorprendidos: [] };
  dano(n, "radiante", d20(NORMAL.con)); t(n.p.estadosDano![0].hasta === 2, "cegado breve: si el objetivo ya había actuado, dura hasta el final de su turno del asalto siguiente");
  // los de N asaltos
  const q = mk(); q.p.combate = { ronda: 1, orden: [{ nombre: "Aldo", total: 20 }, { nombre: q.j.nombre, total: 10 }], pnj: {}, sorprendidos: [] };
  dano(q, "veneno", d20(NORMAL.con)); q.E("siguiente_asalto", {}); q.E("siguiente_asalto", {}); t(q.tiene(/envenenado/), "envenenado (3 asaltos): sigue en el asalto 3");
  const s4 = txt(q.E("siguiente_asalto", {})); t(!q.tiene(/envenenado/) && /ya no está envenenado/.test(s4), "…y acaba al abrirse el asalto 4");
  // el combate acaba: caducan (salvo corroído)
  const c = mk(); c.p.combate = { ronda: 1, orden: [{ nombre: "Aldo", total: 20 }, { nombre: c.j.nombre, total: 10 }], pnj: {}, sorprendidos: [] };
  const pj = c.p.personajes["Aldo"]; pj.condiciones.push("quemado (fuego: 3 asaltos)", "corroído (ácido: hasta el descanso)", "paralizado (eléctrico: hasta el final de su siguiente turno)");
  c.p.estadosDano = [{ nombre: "Aldo", id: "quemado", texto: "quemado (fuego: 3 asaltos)", tipo: "fuego", hasta: 3 }, { nombre: "Aldo", id: "corroido", texto: "corroído (ácido: hasta el descanso)", tipo: "ácido" }, { nombre: "Aldo", id: "paralizado", texto: "paralizado (eléctrico: hasta el final de su siguiente turno)", tipo: "eléctrico", hasta: 1 }];
  limpiarTrasCombate(c.p);
  t(pj.condiciones.length === 1 && /corroído/.test(pj.condiciones[0]) && c.p.estadosDano!.length === 1, "al acabar el combate caducan los estados salvo corroído (que dura hasta el descanso)", pj.condiciones.join("|"));
  c.E("descanso", { tipo: "corto", quienes: ["Aldo"] }); t(pj.condiciones.length === 0 && !c.p.estadosDano, "el descanso quita también el corroído y vacía el registro");
}

// ---- 5. Quemado: 1d4 de fuego al empezar cada asalto; se apaga con una acción
{
  const m = mk(); m.p.combate = { ronda: 1, orden: [{ nombre: "Aldo", total: 20 }, { nombre: m.j.nombre, total: 10 }], pnj: {}, sorprendidos: [] };
  dano(m, "fuego", d20(NORMAL.des)); const antes = m.j.pv;
  iniciarRegistroDados(d4(3)); const s = txt(m.E("siguiente_asalto", {})); liberarDados();
  t(m.j.pv === antes - 3 && /Ogro arde/.test(s), "quemado: al empezar el asalto sufre 1d4 de fuego (3)", s.split("\n").filter((l) => /arde/.test(l)).join("|"));
  const pj = m.p.personajes["Aldo"]; pj.condiciones.push("quemado (fuego: 3 asaltos)"); m.p.estadosDano!.push({ nombre: "Aldo", id: "quemado", texto: "quemado (fuego: 3 asaltos)", tipo: "fuego", hasta: 5 });
  m.p.combate.turnos = {}; const ap = m.E("accion_combate", { quien: "Aldo", accion: "apagarse" });
  t(!ap.error && !pj.condiciones.some((x) => /quemado/.test(x)) && /se apaga/.test(txt(ap)) && !m.p.estadosDano!.some((e) => e.nombre === "Aldo"), "accion_combate {apagarse}: lo apaga y lo quita del registro");
  t(/no está quemado/.test(txt(m.E("accion_combate", { quien: "Aldo", accion: "apagarse" }))), "apagarse sin estar quemado: lo dice");
  const f = mk("Elemental de agua"); f.p.combate = { ronda: 1, orden: [{ nombre: "Aldo", total: 20 }, { nombre: f.j.nombre, total: 10 }], pnj: {}, sorprendidos: [] };
  f.j.condiciones = ["quemado (fuego: 3 asaltos)"]; f.p.estadosDano = [{ nombre: f.j.nombre, id: "quemado", texto: "quemado (fuego: 3 asaltos)", tipo: "fuego", hasta: 4 }];
  iniciarRegistroDados(d4(4)); f.E("siguiente_asalto", {}); liberarDados(); t(f.j.pv === 5000 - 2, "el daño del fuego respeta la resistencia de la criatura (Elemental de agua resiste el fuego: 4 → 2)", String(5000 - f.j.pv));
}

// ---- 6. atacar: armas elementales, crítico (frío: paralizado), CD del atacante y avisos
{
  const m = mk();
  iniciarRegistroDados([...d20(15), ...d6(4, 4), ...d20(NORMAL.des)]); // ataque, 2d6, salvación de DES del Ogro
  const r = m.E("atacar", { atacante: "Aldo", objetivo: m.j.nombre, dano: "2d6", bono: 50, tipo_dano: "fuego", apuntar: "torso", temerario: false }); liberarDados();
  t(m.tiene(/^quemado/) && /sufre un estado por el daño de fuego/.test(txt(r)) && /CD 14/.test(txt(r)), "atacar con fuego: quemado; CD = 8 + competencia 3 + mod FUE 3 = 14", txt(r).split("\n").filter((l) => /CD/.test(l)).join("|"));
  t(/🔥 Ogro: quemado \(3 asaltos\)/.test(r.aviso ?? ""), "el aviso de pantalla lo dice compacto («🔥 Ogro: quemado (3 asaltos)»)", r.aviso);
  t(/quemado/.test(txt(r)) && /no lo apliques tú/.test(txt(r)), "el texto al DM recuerda que ya está aplicado");
  const k = mk(); iniciarRegistroDados([...d20(15), ...d6(4, 4)]); const rk = k.E("atacar", { atacante: "Aldo", objetivo: k.j.nombre, dano: "2d6", bono: 50, tipo_dano: "fuego", apuntar: "torso", temerario: false, sin_estado: true }); liberarDados();
  t(k.conds().length === 0 && !/estado/.test(txt(rk)), "atacar {sin_estado: true}: sin estado");
  const f = mk(); iniciarRegistroDados([...d20(15), ...d6(4, 4)]); f.E("atacar", { atacante: "Aldo", objetivo: f.j.nombre, dano: "2d6", bono: 50, tipo_dano: "cortante", apuntar: "torso", temerario: false }); liberarDados(); t(f.conds().length === 0, "atacar con arma física: sin estado");
  // crítico: el frío paraliza aunque el fallo sea normal
  const c = mk(); iniciarRegistroDados([...d20(20), ...d6(4, 4, 4, 4), ...d20(NORMAL.con)]);
  const rc = c.E("atacar", { atacante: "Aldo", objetivo: c.j.nombre, dano: "2d6", bono: 50, tipo_dano: "frío", apuntar: "torso", temerario: false }); liberarDados();
  t(c.tiene(/^paralizado/) && /fallo grave/.test(txt(rc)), "crítico con frío: paralizado (efecto mayor) aunque la salvación falle por poco", c.conds().join("|"));
  const n = mk(); iniciarRegistroDados([...d20(15), ...d6(4, 4), ...d20(NORMAL.con)]); n.E("atacar", { atacante: "Aldo", objetivo: n.j.nombre, dano: "2d6", bono: 50, tipo_dano: "frío", apuntar: "torso", temerario: false }); liberarDados(); t(n.tiene(/^ralentizado/), "golpe normal con frío: ralentizado");
  // un golpe que se queda en 0 (inmune) no da estado: ya probado arriba; el que mata tampoco
  const mt = mk(); mt.j.pv = 3; iniciarRegistroDados([...d20(15), ...d6(4, 4)]); mt.E("atacar", { atacante: "Aldo", objetivo: mt.j.nombre, dano: "2d6", bono: 50, tipo_dano: "fuego", apuntar: "torso", temerario: false }); liberarDados(); t(mt.conds().length === 0, "si el golpe mata, no hay estado");
  // CD de lanzamiento
  const p = mk(); t(cdDeEstado(localizar(p.p, "Aldo")) === 14 && cdDeEstado(localizar(p.p, "Aldo"), "sab") === 8 + 3 + 2 && cdDeEstado(undefined) === 13, "CD del PJ: FUE/DES, o el atributo de lanzamiento; sin atacante, 13");
  t(cdDeEstado(localizar(p.p, p.j.nombre)) === 8 + 4 + 4 || cdDeEstado(localizar(p.p, p.j.nombre)) > 8, "CD de una criatura: la de su ficha o 8 + competencia + su mejor mod");
  const dr = mk("Dragón joven de ceniza"); t(cdDeEstado(localizar(dr.p, dr.j.nombre)) === 17, "CD de una criatura con habilidades: la de su ficha (Dragón joven: 17)");
}

// ---- 7. Habilidades de criaturas y trampas contra PJ
{
  const m = mk("Dragón joven de ceniza"); const aldo = m.p.personajes["Aldo"]; aldo.pv = aldo.pv_max = 900;
  const ap = (h: string, dados: { caras: number; valor: number }[]) => { iniciarRegistroDados(dados); const r = m.E("habilidad_criatura", { criatura: m.j.nombre, habilidad: h, objetivos: ["Aldo"] }); liberarDados(); return r; };
  const dd = (...v: number[]) => d6(...v);
  // Aliento de ceniza: 16d6 fuego, DES CD 17. Aldo falla la salvación (1) y falla la del estado (1)
  let r = ap("Aliento de ceniza", [...dd(...Array(16).fill(3)), ...d20(1), ...d20(1)]);
  t(aldo.condiciones.some((x) => /^quemado/.test(x)) && /sufre un estado/.test(txt(r)), "habilidad de criatura con daño de fuego: el PJ que falla queda quemado", aldo.condiciones.join("|"));
  aldo.condiciones.length = 0; delete m.p.estadosDano;
  r = ap("Aliento de ceniza", [...dd(...Array(16).fill(3)), ...d20(20)]); // supera la salvación de la habilidad: mitad de daño y sin estado
  t(aldo.condiciones.length === 0 && !/estado/.test(txt(r)), "quien supera la salvación de la habilidad (mitad de daño) no sufre además el estado");
  // opt-out por habilidad
  m.j.definicion = { ...m.j.definicion, habilidades: m.j.definicion.habilidades.map((h) => (h.nombre === "Aliento de ceniza" ? { ...h, estado: false } : h)) };
  m.j.gastadas = []; r = ap("Aliento de ceniza", [...dd(...Array(16).fill(3)), ...d20(1)]); t(aldo.condiciones.length === 0, "habilidad con estado: false: sin estado");
  // opt-out por criatura
  m.j.definicion = { ...m.j.definicion, sinEstados: true, habilidades: m.j.definicion.habilidades.map((h) => ({ ...h, estado: undefined })) }; m.j.gastadas = [];
  r = ap("Aliento de ceniza", [...dd(...Array(16).fill(3)), ...d20(1)]); t(aldo.condiciones.length === 0, "criatura con sinEstados: sin estado");
  // habilidad que ya trae su condición (Juez: Confesión psíquica + aturdido 1 asalto): no se duplica
  const j = mk("El Juez Sin Ojos"); const a2 = j.p.personajes["Aldo"]; a2.pv = a2.pv_max = 900;
  iniciarRegistroDados([...d6(...Array(40).fill(3)), ...d20(1)]); j.E("habilidad_criatura", { criatura: j.j.nombre, habilidad: "Confesión", objetivos: ["Aldo"] }); liberarDados();
  t(a2.condiciones.length === 1 && /aturdido/.test(a2.condiciones[0]), "habilidad con condicion propia (Confesión: aturdido): una sola condición, sin estado extra", a2.condiciones.join("|"));
  // trampa eléctrica contra un PJ
  const tr = mk(); const a3 = tr.p.personajes["Aldo"]; a3.pv = a3.pv_max = 900;
  tr.E("trampa", { accion: "colocar", nombre: "Rayo", cd_detectar: 10, efecto: { nombre: "Arco eléctrico", descripcion: "Salta una chispa.", salvacion: "des", cd: 13, dano: "2d6", tipo_dano: "eléctrico", mitad_si_exito: true } });
  iniciarRegistroDados([...d6(3, 3), ...d20(1), ...d20(1)]); const rt = tr.E("trampa", { accion: "disparar", nombre: "Rayo", quienes: ["Aldo"] }); liberarDados();
  t(a3.condiciones.some((x) => /^paralizado/.test(x)) && /sufre un estado por el daño de eléctrico/.test(txt(rt)), "trampa eléctrica: el PJ que falla queda paralizado", a3.condiciones.join("|"));
  // un PJ a 0 PV no recibe estados
  const cz = mk("Dragón joven de ceniza"); const a4 = cz.p.personajes["Aldo"]; a4.pv = 1; a4.pv_max = 900; a4.gastados = { Terco: 1 }; // sin el Terco disponible
  iniciarRegistroDados([...d6(...Array(16).fill(3)), ...d20(1)]); cz.E("habilidad_criatura", { criatura: cz.j.nombre, habilidad: "Aliento de ceniza", objetivos: ["Aldo"] }); liberarDados();
  t(a4.pv === 0 && !a4.condiciones.some((x) => /quemado/.test(x)), "el PJ que cae a 0 PV por el golpe no recibe el estado");
}

// ---- 8. Tragado: el daño de dentro (eléctrico) no paraliza
{
  const m = mk("Bakunawa"); const a = m.p.personajes["Aldo"]; a.pv = a.pv_max = 900;
  a.condiciones.push(`tragado (por ${m.j.nombre})`); m.p.combate = { ronda: 1, orden: [{ nombre: "Aldo", total: 20 }, { nombre: m.j.nombre, total: 10 }], pnj: {}, sorprendidos: [] };
  iniciarRegistroDados([...d6(3, 3, 3, 3), ...d20(1)]); const s = txt(m.E("siguiente_asalto", {})); liberarDados();
  t(/sufre/.test(s) && !a.condiciones.some((x) => /paralizado/.test(x)) && !m.p.estadosDano, "tragado: el daño eléctrico de dentro no deja estado (está dentro, retenido y cegado)", a.condiciones.join("|"));
  t(consultarReglas("estados").includes("Tragado: el daño de dentro (eléctrico, ácido) no da estado"), "consultar_reglas {tema: estados} lo documenta");
}

// ---- 9. PNJ, corroído en la CA y velocidad
{
  const p = mk(); p.E("iniciativa", { participantes: ["Aldo"], pnj: [{ nombre: "Guardia", bono_ataque: 5, ca: 12, pv: 5000 }] });
  p.p.combate!.turnos = {}; iniciarRegistroDados([...d20(15), ...d6(4, 4), ...d20(NORMAL.des + 0)]);
  const r = p.E("atacar", { atacante: "Aldo", objetivo: "Guardia", dano: "2d6", bono: 50, tipo_dano: "ácido", apuntar: "torso", temerario: false }); liberarDados();
  t(p.p.combate!.pnj["Guardia"].condiciones?.some((x) => /^corroído/.test(x)) && /corroído/.test(r.aviso ?? ""), "PNJ: un golpe ácido lo corroe", r.aviso);
  p.p.combate!.turnos = {}; iniciarRegistroDados([...d20(10), ...d6(1, 1)]); const r2 = p.E("atacar", { atacante: "Aldo", objetivo: "Guardia", dano: "2d6", bono: 0, apuntar: "torso", temerario: false }); liberarDados();
  t(/vs CA 11/.test(txt(r2) + (r2.aviso ?? "")), "corroído: la CA del objetivo baja 1 (12 → 11)", (r2.aviso ?? "").slice(0, 120));
  // PJ ralentizado: velocidad a la mitad
  const a = p.p.personajes["Aldo"]; const v0 = txt(p.E("accion_combate", { quien: "Aldo", accion: "correr" }));
  void v0; a.condiciones.push("ralentizado (frío: 3 asaltos)");
  const { velocidadDe } = await import("../../src/velocidad.ts"); const v1 = velocidadDe(p.p, localizar(p.p, "Aldo")); a.condiciones.length = 0; const v2 = velocidadDe(p.p, localizar(p.p, "Aldo"));
  t(v2.metros > 0 && v1.metros === v2.metros / 2 && v1.motivos.some((m) => /ralentizado/.test(m)), "ralentizado: velocidad a la mitad", `${v1.metros} / ${v2.metros}`);
}

// ---- 10. Avisos: el relato no copia los avisos con los emojis nuevos
{
  const l = "🔥 Ogro: quemado (3 asaltos)\n⚡ Aldo: paralizado (1 turno)\n☀ Aldo: cegado (1 turno)\n🔔 Aldo: ensordecido (3 asaltos)\n💫 Aldo: derribado (1 asalto)\n🧠 Aldo: asustado (2 asaltos)\n🧪 Aldo: corroído (CA −1)";
  const sucio = `La llama lo envuelve. Grita de dolor.\n${l}`;
  const limpio = limpiarNarracion(sucio);
  t(!/quemado \(3 asaltos\)|paralizado \(1 turno\)|ensordecido|corroído/.test(limpio) && /La llama lo envuelve/.test(limpio) && /Grita de dolor/.test(limpio), "limpiarNarracion (avisos al final) quita del relato los avisos de estado (emojis nuevos incluidos)", limpio);
}
// Fichas: los PJ y criaturas no ganan nada sin elemental; todas las criaturas siguen con sus datos
t(BESTIARIO.every((c) => c.habilidades.every((h) => h.estado === undefined || h.estado === false || typeof h.estado === "string")) && !!buscarCriatura("Ogro"), "las fichas siguen válidas (estado: false | texto | sin definir)");
console.log(`${ok} ok, ${mal} fallas`);
