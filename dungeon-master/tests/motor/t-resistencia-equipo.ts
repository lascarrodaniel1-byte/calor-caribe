// Resistencia elemental del equipo en dos niveles (docs/DANOS.md; BALANCE §20; propuesta a confirmar):
//  · FUERTE: encantamiento de armadura/escudo/accesorio con [O#] → mitad del daño del tipo (mismo mecanismo que las raciales; no se acumula con racial, Furia, Luz ni sumergido).
//  · LEVE: material rudimentario (pieles de bárbaro…) → −2 por golpe del tipo (tras la mitad por salvación, nunca bajo 0) y ventaja en la salvación del estado; no suma a la completa.
import { nuevaPartida, normalizarPartida, fichaTexto } from "../../src/estado.ts";
import { ejecutar } from "../../src/herramientas.ts";
import { aplicarDanoAPersonaje, perfilDePersonaje } from "../../src/rasgos.ts";
import { aplicarDano, normalizarTipo, TIPOS_DANO_CANONICOS, type TipoDano } from "../../src/danos.ts";
import { ENCANTAMIENTOS_RESISTENTES, MATERIALES_RESISTENTES, PUNTOS_LEVE, resistenciasDeEquipo } from "../../src/resistencia_objeto.ts";
import { generarUno, generarBotin, BASES } from "../../src/equipo.ts";
import { generarBotinDe } from "../../src/botin.ts";
import { TESORO } from "../../src/tesoro.ts";
import { BESTIARIO } from "../../src/bestiario.ts";
import { sistemaWeb, consultarReglas } from "../../src/prompt-web.ts";
import { iniciarRegistroDados, liberarDados } from "../../src/dados.ts";
let ok = 0, mal = 0; const t = (c: boolean, m: string, x = "") => { console.log(c ? "ok   " : "FALLA", m, x); c ? ok++ : mal++; };
const txt = (r: any) => (typeof r === "string" ? r : r?.contenido ?? JSON.stringify(r));
const d = (caras: number, ...v: number[]) => v.map((valor) => ({ caras, valor }));
const R = <T>(f: () => T, dados: { caras: number; valor: number }[]): T => { iniciarRegistroDados(dados); try { return f(); } finally { liberarDados(); } };

function mk(raza = "Humano del Faro", inventario: string[] = [], clase = "Mercenario del Cuervo") {
  const p = nuevaPartida(); normalizarPartida(p); const E = (n: string, x: object): any => ejecutar(n, x, p);
  E("guardar_personaje", { don_arcano: false, nombre: "Aldo", jugador: "Ana", raza, clase, nivel: 6, pv_max: 90, ca: 12, atributos: { fue: 16, des: 14, con: 14, int: 10, sab: 14, car: 10 }, inventario: ["Espada larga", ...inventario] });
  return { p, E, A: () => p.personajes.Aldo as any };
}
const dano = (pj: any, n: number, tipo: string, o: { mitadSalvacion?: boolean } = {}) => aplicarDanoAPersonaje(pj, n, normalizarTipo(tipo), o);
const ENC = (clave: string) => ENCANTAMIENTOS_RESISTENTES.find((x) => x.nombre === clave)!;

// ---- 1. Los datos
{
  const arm = ENCANTAMIENTOS_RESISTENTES.filter((x) => x.clase === "armadura");
  const tipos = new Set(arm.map((x) => x.tipo));
  t(["fuego", "necrótico", "frío", "eléctrico", "ácido", "veneno", "radiante", "trueno", "psíquico"].every((x) => tipos.has(x as TipoDano)) && arm.length === 9, "9 encantamientos de armadura con resistencia, uno por tipo elemental (2 de siempre + 7 nuevos)");
  t(ENC("ignífuga").tipo === "fuego" && ENC("de los vivos").tipo === "necrótico", "«ignífuga» y «de los vivos» ya no son solo texto");
  t(new Set(ENCANTAMIENTOS_RESISTENTES.map((x) => x.nombre)).size === ENCANTAMIENTOS_RESISTENTES.length && ENCANTAMIENTOS_RESISTENTES.every((x) => !(TIPOS_DANO_CANONICOS as readonly string[]).includes(x.tipo) === false), "nombres únicos y tipos canónicos");
  t(MATERIALES_RESISTENTES.length >= 6 && MATERIALES_RESISTENTES.length <= 10 && MATERIALES_RESISTENTES.every((m) => m.precio >= 5 && m.precio <= 20), `${MATERIALES_RESISTENTES.length} materiales rudimentarios, 5-20 po`);
  t(MATERIALES_RESISTENTES.every((m) => { const x = TESORO.find((y) => y.id === m.id); return !!x && x.categoria === "material" && x.valor_po === m.precio && x.nombre === m.nombre; }), "todos están en el catálogo de tesoro (categoría material) con su precio");
  t(MATERIALES_RESISTENTES.flatMap((m) => m.criaturas ?? []).every((c) => BESTIARIO.some((b) => b.nombre === c)), "las criaturas que los dan existen en el bestiario");
  t(MATERIALES_RESISTENTES.some((m) => m.tipo === "frío" && m.criaturas?.includes("Wendigo")) && MATERIALES_RESISTENTES.some((m) => m.nombre === "Pieles de bárbaro"), "Wendigo → piel de frío; pieles de bárbaro → frío");
  t(PUNTOS_LEVE === 2, "la protección leve resta 2");
}

// ---- 2. NIVEL FUERTE: cada encantamiento da mitad de su tipo y nada más
for (const e of ENCANTAMIENTOS_RESISTENTES) {
  const base = e.clase === "armadura" ? "Cota de mallas" : "Capa";
  const m = mk("Humano del Faro", [`${base} ${e.nombre} [O1]`]);
  const otro: TipoDano = e.tipo === "fuego" ? "frío" : "fuego";
  t(dano(m.A(), 10, e.tipo).final === 5 && dano(m.A(), 10, otro).final === 10 && dano(m.A(), 10, "cortante").final === 10, `${e.nombre} (${e.clase}): ${e.tipo} 10 → 5; otros tipos intactos`);
}
{ // escudo, y sin [O#] / defectuoso no dan nada
  t(dano(mk("Humano del Faro", ["Escudo ignífuga [O2]"]).A(), 10, "fuego").final === 5, "escudo ignífuga (con [O#]) resiste el fuego");
  t(dano(mk("Humano del Faro", ["Cota de mallas ignífuga"]).A(), 10, "fuego").final === 10, "sin [O#] no cuenta (nombre suelto sin objeto registrado)");
  t(dano(mk("Humano del Faro", ["Cota de mallas en mal estado [O3]"]).A(), 10, "fuego").final === 10, "objeto defectuoso (sin encantamiento): nada");
  const p = mk("Humano del Faro", ["Cota de mallas ignífuga [O4]"]); p.A().inventario = p.A().inventario.filter((x: string) => !/ignífuga/.test(x));
  t(dano(p.A(), 10, "fuego").final === 10, "equipo vendido o perdido: deja de dar la resistencia");
  const q = mk("Humano del Faro", ["Cota de mallas ignífuga [O5]"]); q.E("modificar_personaje", { nombre: "Aldo", quitar_objetos: ["Cota de mallas ignífuga [O5]"] });
  t(dano(q.A(), 10, "fuego").final === 10, "quitar_objetos: la pierde");
  q.E("modificar_personaje", { nombre: "Aldo", agregar_objetos: ["Cota de mallas ignífuga [O5]"] });
  t(dano(q.A(), 10, "fuego").final === 5, "y al recuperarla la recupera");
}
// maldito: sigue dando la resistencia (el efecto es real; la maldición va aparte)
{
  const p = nuevaPartida(); normalizarPartida(p);
  let o: any; for (let i = 0; i < 400 && !o; i++) { const x = generarUno(p, "hallazgo", "armadura", "maldito"); if (/ignífuga/.test(x.nombre)) o = x; }
  t(!!o && /MALDITO/.test(o.verdad), "se generó una armadura ignífuga MALDITA", o?.nombre);
  const m = mk("Humano del Faro", [o.nombre]); t(dano(m.A(), 10, "fuego").final === 5, "la maldita sigue resistiendo el fuego (efecto real), con su maldición aparte");
}
// reparto: los encantamientos nuevos salen en hallazgos; las reliquias de resistencia dan DOS tipos
{
  const p = nuevaPartida(); normalizarPartida(p); const vistos = new Set<string>(); let rel = 0, rel2 = 0, coherente = true;
  for (let i = 0; i < 1500; i++) {
    const x = generarUno(p, "hallazgo", "armadura", i % 3 === 0 ? "reliquia" : "encantado");
    const dentro = ENCANTAMIENTOS_RESISTENTES.filter((e) => e.clase === "armadura" && x.nombre.includes(` ${e.nombre}`));
    for (const e of dentro) vistos.add(e.nombre);
    const res = resistenciasDeEquipo([x.nombre]).filter((r) => r.nivel === "completa");
    if (res.length !== new Set(dentro.map((e) => e.tipo)).size) coherente = false;
    if (x.calidad === "reliquia" && dentro.length) { rel++; if (new Set(dentro.map((e) => e.tipo)).size === 2) rel2++; }
  }
  t(vistos.size === 9, `salen los 9 encantamientos de resistencia en armaduras encantadas (${vistos.size}/9)`);
  t(coherente, "lo que dice el nombre y lo que da el perfil coinciden en todos los objetos generados");
  t(rel > 0 && rel2 === rel, `toda reliquia de armadura con resistencia da dos tipos (${rel2}/${rel})`);
  const q = nuevaPartida(); normalizarPartida(q); let acc = 0; for (let i = 0; i < 1500; i++) { const x = generarUno(q, "hallazgo", "accesorio", "encantado"); if (resistenciasDeEquipo([x.nombre]).length) acc++; }
  t(acc > 0, `los accesorios encantados también pueden resistir (${acc}/1500)`);
}

// ---- 3. NO SE ACUMULA: una sola mitad aunque haya varias fuentes del mismo tipo
{
  const cenizo = mk("Cenizo", ["Cota de mallas ignífuga [O1]"]); const r = dano(cenizo.A(), 20, "fuego");
  t(r.final === 10 && r.detalle.length === 1 && /Cenizo/.test(r.detalle[0]), "Cenizo + ignífuga: una sola mitad (20 → 10), y manda el motivo racial", r.detalle.join("|"));
  const doble = mk("Humano del Faro", ["Cota de mallas ignífuga [O1]", "Capa de brasa mansa [O2]"]); t(dano(doble.A(), 20, "fuego").final === 10, "dos encantamientos del mismo tipo: una mitad");
  const luz = mk("Humano del Faro", ["Cota de mallas de los vivos [O1]"], "Caballero Juramentado"); luz.E("juramento", { quien: "Aldo", accion: "jurar", votos: ["luz"] });
  t(perfilDePersonaje(luz.A()).resiste!.filter((x) => x.tipo === "necrótico").length === 2 && dano(luz.A(), 20, "necrótico").final === 10, "Voto de Luz + «de los vivos»: una sola mitad (el caso necrótico)");
  const enano = mk("Enano de Karak-Dûm", ["Cota de mallas de la víbora gris [O1]"]); t(dano(enano.A(), 20, "veneno").final === 10, "Enano + de la víbora gris: una mitad");
  const sub = mk("Humano del Faro", ["Cota de mallas ignífuga [O1]"]); sub.A().condiciones.push("sumergido"); t(dano(sub.A(), 20, "fuego").final === 10, "sumergido + ignífuga: una mitad");
  const tri = mk("Tritón de las Mareas", ["Cota de mallas del Turno del Hielo [O1]"]); t(dano(tri.A(), 20, "frío").final === 10, "Tritón + del Turno del Hielo: una mitad");
  const furia = mk("Humano del Faro", ["Cota de mallas ignífuga [O1]"], "Berserker de Ceniza"); furia.A().furia = { activa: true, asaltos: 10 };
  t(dano(furia.A(), 20, "fuego").final === 10 && dano(furia.A(), 20, "cortante").final === 10, "Furia + ignífuga: la Furia resiste lo físico y la ignífuga el fuego; cada tipo, una mitad");
}

// ---- 4. NIVEL LEVE: −2 por golpe, tras la mitad por salvación, nunca bajo 0, y no suma a la completa
{
  const m = mk("Humano del Faro", ["Pieles de bárbaro"]);
  t(dano(m.A(), 10, "frío").final === 8 && dano(m.A(), 10, "fuego").final === 10 && dano(m.A(), 10, "cortante").final === 10, "pieles de bárbaro: frío 10 → 8; otros tipos intactos");
  t(dano(m.A(), 10, "frío", { mitadSalvacion: true }).final === 3, "tras la mitad por salvación: 10 → 5 → 3");
  t(dano(m.A(), 1, "frío").final === 0 && dano(m.A(), 2, "frío").final === 0 && dano(m.A(), 3, "frío").final === 1, "nunca baja de 0 (1 → 0, 2 → 0, 3 → 1)");
  const r = dano(m.A(), 10, "frío"); t(/pieles de bárbaro \(leve, −2\)/.test(r.detalle.join(";")) && /10 → 8/.test(r.detalle.join(";")), "el detalle dice cuál y cuánto", r.detalle.join("|"));
  const dos = mk("Humano del Faro", ["Pieles de bárbaro", "Lana empapada en cera"]); t(dano(dos.A(), 10, "frío").final === 8, "dos materiales del mismo tipo: −2 una sola vez");
  const mixto = mk("Humano del Faro", ["Pieles de bárbaro", "Cota de mallas del Turno del Hielo [O1]"]); const x = dano(mixto.A(), 10, "frío");
  t(x.final === 5 && x.detalle.length === 1, "leve + completa del mismo tipo: manda la completa (10 → 5, no 3)", x.detalle.join("|"));
  const trit = mk("Tritón de las Mareas", ["Pieles de bárbaro"]); t(dano(trit.A(), 10, "frío").final === 5, "Tritón + pieles: la racial manda (10 → 5)");
  for (const mat of MATERIALES_RESISTENTES) { const y = mk("Humano del Faro", [mat.nombre]); t(dano(y.A(), 10, mat.tipo).final === 8, `${mat.nombre}: ${mat.tipo} 10 → 8`); }
  // aplicarDano puro: vulnerabilidad después de la leve
  const v = aplicarDano({ objetivo: { reduce: [{ tipo: "frío", motivo: "x", puntos: 2 }], vulnerable: [{ tipo: "frío", motivo: "v" }] }, cantidad: 10, tipo: "frío" });
  t(v.final === 16, "leve y luego vulnerabilidad (10 → 8 → 16)", String(v.final));
  const sinTipo = aplicarDano({ objetivo: { reduce: [{ tipo: "frío", motivo: "x", puntos: 2 }] }, cantidad: 10 });
  t(sinTipo.final === 10, "sin tipo no se aplica nada");
}
// por las herramientas: modificar_personaje muestra la nota solo si hay mecanismo
{
  const m = mk("Humano del Faro", ["Pieles de bárbaro"]); const r = m.E("modificar_personaje", { nombre: "Aldo", pv_cambio: -10, tipo_dano: "frío", sin_estado: true });
  t(m.A().pv === 82 && /pieles de bárbaro \(leve, −2\): 10 → 8/.test(r.aviso ?? ""), "modificar_personaje: −8 PV y el aviso lo dice", String(r.aviso));
  const n = mk(); const r2 = n.E("modificar_personaje", { nombre: "Aldo", pv_cambio: -10, tipo_dano: "frío", sin_estado: true });
  t(n.A().pv === 80 && !/leve|resistencia/.test(r2.aviso ?? ""), "sin equipo: sin nota nueva en pantalla", String(r2.aviso));
  const f = mk("Humano del Faro", ["Pieles de bárbaro", "Cota de mallas ignífuga [O1]"]);
  t(/Resiste por equipo: .*frío: pieles de bárbaro \(leve, −2 por golpe/.test(fichaTexto(f.A())) && /fuego: Cota de mallas ignífuga \[O1\]/.test(fichaTexto(f.A())), "la ficha del DM lo muestra", fichaTexto(f.A()).split("\n").find((l) => /Resiste/.test(l)));
  t(!/Resiste por equipo/.test(fichaTexto(mk().A())), "sin equipo no hay línea nueva en la ficha");
  // aviso de un ataque real
  const a = mk("Humano del Faro", ["Cota de mallas ignífuga [O1]"]); a.E("aparecer_criatura", { nombre: "Ogro" });
  const at = R(() => a.E("habilidad_criatura", { criatura: Object.values<any>(a.p.jefes)[0].nombre, habilidad_nueva: { nombre: "Soplo", descripcion: "x", dano: "2d6", tipo_dano: "fuego" }, objetivos: ["Aldo"] }), [...d(20, 1), ...d(6, 5, 5)]);
  t(/Cota de mallas ignífuga \[O1\]: resistencia a fuego: 10 → 5/.test(txt(at)) && a.A().pv === 85, "habilidad de criatura: 10 de fuego → 5 con aviso del mecanismo", txt(at).slice(0, 200));
}

// ---- 5. VENTAJA en la salvación del estado
{
  const m = mk("Humano del Faro", ["Pieles de bárbaro"]);
  const r = R(() => m.E("modificar_personaje", { nombre: "Aldo", pv_cambio: -10, tipo_dano: "frío", cd_estado: 30 }), d(20, 1, 2));
  t(/ventaja: pieles de bárbaro/.test(txt(r)), "frío con pieles: la salvación del estado tira con ventaja y lo dice", txt(r).slice(-200));
  const n = mk(); const r2 = R(() => n.E("modificar_personaje", { nombre: "Aldo", pv_cambio: -10, tipo_dano: "frío", cd_estado: 30 }), d(20, 1, 2)); t(!/\(ventaja/.test(txt(r2)), "sin pieles, sin ventaja");
  const o = mk("Humano del Faro", ["Pieles de bárbaro"]); const r3 = R(() => o.E("modificar_personaje", { nombre: "Aldo", pv_cambio: -10, tipo_dano: "fuego", cd_estado: 30 }), d(20, 1, 2)); t(!/\(ventaja/.test(txt(r3)), "las pieles no dan ventaja contra el fuego");
  const c = mk("Humano del Faro", ["Pieles de bárbaro", "Cota de mallas del Turno del Hielo [O1]"]); const r4 = R(() => c.E("modificar_personaje", { nombre: "Aldo", pv_cambio: -10, tipo_dano: "frío", cd_estado: 30 }), d(20, 1, 2));
  t((txt(r4).match(/\(ventaja/g) ?? []).length === 1, "con leve y completa: la ventaja cuenta una sola vez", txt(r4).slice(-200));
  const e = mk("Humano del Faro", ["Cota de mallas del Turno del Hielo [O1]"]); const r5 = R(() => e.E("modificar_personaje", { nombre: "Aldo", pv_cambio: -10, tipo_dano: "frío", cd_estado: 30 }), d(20, 1, 2)); t(/\(ventaja/.test(txt(r5)), "el encantamiento (resistencia completa) también da ventaja");
  // el estado sale igual si falla con ventaja (1 y 1)
  t(m.A().condiciones.some((x: string) => /^(ralentizado|paralizado)/.test(x)), "fallando ambas tiradas, el estado se aplica igual");
}

// ---- 6. Tienda y botín los reparten
{
  const p = nuevaPartida(); normalizarPartida(p); const cuenta: Record<string, number> = {};
  for (let i = 0; i < 400; i++) for (const l of generarBotinDe(p, { origen: "compra", cantidad: 4, categorias: ["material"], incluir_viales: false }).jugadores.split("\n")) for (const m of MATERIALES_RESISTENTES) if (l.includes(m.nombre)) cuenta[m.id] = (cuenta[m.id] ?? 0) + 1;
  t(MATERIALES_RESISTENTES.filter((m) => m.peligroMin <= 2).every((m) => (cuenta[m.id] ?? 0) > 0), "la tienda vende los materiales rudimentarios de peligro ≤ 2", JSON.stringify(cuenta));
  const reg = (region: string) => { const q = nuevaPartida(); normalizarPartida(q); let n = 0; for (let i = 0; i < 600; i++) for (const l of generarBotinDe(q, { origen: "saqueo", cantidad: 4, peligro: 2, region, categorias: ["material"], incluir_viales: false }).dm.split("\n")) if (l.includes("Pieles de bárbaro")) n++; return n; };
  const ag = reg("Las Agujas de Vahl"), al = reg("Karak-Dûm"); t(ag > al * 2, `las pieles de bárbaro abundan en las Agujas (${ag}) más que en Karak (${al})`);
  const w = nuevaPartida(); normalizarPartida(w); let pieles = 0, ajenas = 0;
  for (let i = 0; i < 400; i++) for (const l of generarBotinDe(w, { origen: "saqueo", cantidad: 5, criatura: "Wendigo", categorias: ["material", "trofeo"], incluir_viales: false }).dm.split("\n")) { if (l.includes("Piel helada de wendigo")) pieles++; if (l.includes("Cuero de dragón de ceniza")) ajenas++; }
  t(pieles > 0 && ajenas === 0, `el Wendigo deja piel helada (${pieles}) y no cuero de dragón`);
  const e = nuevaPartida(); normalizarPartida(e); let dr = 0; for (let i = 0; i < 400; i++) for (const l of generarBotinDe(e, { origen: "saqueo", cantidad: 5, criatura: "Dragón joven de ceniza", incluir_viales: false }).dm.split("\n")) if (l.includes("Cuero de dragón de ceniza")) dr++;
  t(dr > 0, `el Dragón joven de ceniza deja cuero de dragón (${dr})`);
  void BASES; void generarBotin;
}

// ---- 7. Documentado bajo demanda y fuera del prompt fijo
{
  const e = consultarReglas("equipo") ?? "", ts = consultarReglas("tesoro") ?? "", es = consultarReglas("estados") ?? "";
  t(/resistencia/i.test(e) && /leve/i.test(e + ts) && /encantamiento/i.test(e), "consultar_reglas equipo describe los dos niveles");
  t(/LEVE/.test(ts) && /Pieles de bárbaro → frío/.test(e), "consultar_reglas tesoro remite a la protección leve y equipo lista los materiales");
  t(/ventaja/.test(es) && /equipo/i.test(es), "consultar_reglas estados menciona la ventaja del equipo");
  const s = sistemaWeb();
  t(s.length <= 67600, "el prompt sigue ≤ 67.600", String(s.length));
  t(!/Pieles de bárbaro|del Velo Mudo|del lodo negro|resistencia por equipo/i.test(s), "nada de esto en el prompt fijo");
}
console.log(`${ok} ok, ${mal} fallas`);
