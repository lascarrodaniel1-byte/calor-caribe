// Fase 2 del bestiario como datos (docs/BALANCE.md §17): inmunidades a CONDICIONES, vulnerabilidades por material «sal» y «hierro caliente»,
// defensas condicionadas por estado («varada» de la Bakunawa), la adaptación de Kuru, PNJ con ficha de criatura y las rutas de daño a criaturas
// (caída, Hiel, Senda de la Ceniza, danar_criatura). Dados fijos.
import { nuevaPartida, normalizarPartida } from "../../src/estado.ts";
import { ejecutar } from "../../src/herramientas.ts";
import { BESTIARIO, buscarCriatura, perfilDeJefe, lineaResistencias, fichaCriatura } from "../../src/bestiario.ts";
import { CONDICIONES_INMUNIDAD, condicionInmune } from "../../src/condiciones.ts";
import { aplicarDano, normalizarMaterial } from "../../src/danos.ts";
import { TESORO } from "../../src/tesoro.ts";
import { iniciarRegistroDados, liberarDados } from "../../src/dados.ts";
let ok = 0, mal = 0; const t = (c: boolean, m: string, x = "") => { console.log(c ? "ok   " : "FALLA", m, x); c ? ok++ : mal++; };
const txt = (r: any) => (typeof r === "string" ? r : r?.contenido ?? JSON.stringify(r));
const dados = (caras: number, ...v: number[]) => v.map((valor) => ({ caras, valor }));
const C = (n: string) => buscarCriatura(n)!;

function mk(criatura: string, inventario: string[] = ["Espada larga"]) {
  const p = nuevaPartida(); normalizarPartida(p); const E = (n: string, d: object): any => ejecutar(n, d, p);
  E("guardar_personaje", { don_arcano: false, nombre: "Aldo", jugador: "Ana", raza: "Humano del Faro", clase: "Mercenario del Cuervo", nivel: 5, pv_max: 900, ca: 12, atributos: { fue: 16, des: 14, con: 14, int: 10, sab: 14, car: 10 }, inventario, dote: "Terco" });
  E("aparecer_criatura", { nombre: criatura });
  const j = Object.values(p.jefes)[0]; j.pv = j.pv_max = 5000;
  return { p, E, j, perdida: () => 5000 - j.pv };
}
const cond = (m: ReturnType<typeof mk>, c: string) => txt(m.E("condicion", { objetivo: m.j.nombre, accion: "aplicar", condicion: c }));

// ---- 1. Inmunidades a condiciones: datos migrados de la prosa
const ESPERADAS: Record<string, string[]> = {
  "Gigante de hueso": ["asustado"], "Apóstol": ["asustado"], "Lich": ["asustado", "hechizado", "agotado", "dormido"],
  "Ulfhedinn": ["asustado", "agotado"], "Hombre oso": ["asustado", "agotado"], "Gárgola": ["agotado"], "Golem de piedra": ["asustado", "hechizado", "agotado"],
  "Golem de carne": ["agotado"], "Elemental de agua": ["agotado"], "Elemental de tierra": ["agotado"], "Elemental de aire": ["agotado", "agarrado", "derribado"],
  "Djinn": ["agotado"], "Bakunawa": ["envenenado"], "La Madre de los Hambrientos": ["asustado"], "Hugin, el Pensamiento": ["asustado"],
};
for (const [n, l] of Object.entries(ESPERADAS)) t(JSON.stringify([...(C(n).inmunidadesCondicion ?? [])].sort()) === JSON.stringify([...l].sort()), `${n}: inmune a las condiciones ${l.join(", ")} (dato)`);
t(BESTIARIO.filter((c) => c.inmunidadesCondicion).length === Object.keys(ESPERADAS).length, "solo esas criaturas tienen inmunidades a condiciones (nada inventado)");
t(BESTIARIO.every((c) => (c.inmunidadesCondicion ?? []).every((x) => (CONDICIONES_INMUNIDAD as readonly string[]).includes(x))), "las inmunidades a condiciones son de la lista cerrada");
// coherencia prosa ↔ datos, en los dos sentidos
{
  const KW: Record<string, RegExp> = { asustado: /asustad/i, hechizado: /hechizad/i, agotado: /agotad/i, envenenado: /envenenad/i, dormido: /sue[ñn]o|dormid/i, agarrado: /agarrad/i, derribado: /derribad/i };
  const falta: string[] = [];
  for (const c of BESTIARIO) {
    const inm = c.rasgos.filter((r) => /inmune/i.test(r));
    for (const [id, re] of Object.entries(KW)) {
      const prosa = inm.some((r) => re.test(r)), dato = !!c.inmunidadesCondicion?.includes(id as never);
      if (prosa && !dato) falta.push(`${c.nombre}: prosa «${id}» sin dato`);
      if (dato && !prosa) falta.push(`${c.nombre}: dato «${id}» sin prosa`);
    }
  }
  t(falta.length === 0, "prosa ↔ datos: cada «inmune a la condición …» de los rasgos está en la ficha y al revés", falta.join(" | "));
}
t(condicionInmune(["agotado"], "agotamiento 2") === "agotado" && condicionInmune(["dormido"], "dormido (sueño)") === "dormido" && condicionInmune(["asustado"], "asustado 1 minuto") === "asustado" && condicionInmune(["asustado"], "paralizado") === undefined && condicionInmune(undefined, "asustado") === undefined, "condicionInmune reconoce las variantes de texto");

// ---- 2. El motor rechaza la condición con aviso claro (y no rechaza lo demás)
{
  const m = mk("Lich");
  for (const c of ["asustado 1 minuto", "hechizado", "agotamiento 1", "dormido"]) { const r = cond(m, c); t(/es inmune a la condición/.test(r) && !(m.j.condiciones ?? []).length, `Lich rechaza «${c}»`, r.slice(0, 90)); }
  const r = cond(m, "paralizado 1 minuto"); t(/Lich: paralizado/.test(r) && (m.j.condiciones ?? []).length === 1, "el Lich no es inmune al paralizado: se aplica", r.slice(0, 60));
  t(/ya no está/.test(txt(m.E("condicion", { objetivo: m.j.nombre, accion: "quitar", condicion: "paralizado" }))), "quitar una condición sigue funcionando");
  const g = mk("Gárgola"); t(/inmune a la condición agotado/.test(cond(g, "agotamiento 2")) && /Gárgola: asustado/.test(cond(g, "asustado")), "Gárgola: agotamiento no, asustado sí");
  const a = mk("Elemental de aire"); t(/inmune a la condición agarrado/.test(cond(a, "agarrado (por Aldo)")) && /inmune a la condición derribado/.test(cond(a, "derribado")) && /Elemental de aire: cegado/.test(cond(a, "cegado")), "Elemental de aire: ni agarrado ni derribado");
  const b = mk("Bakunawa"); t(/inmune a la condición envenenado/.test(cond(b, "envenenado (1 hora)")), "Bakunawa: no se envenena");
  const h = mk("Hugin, el Pensamiento"); t(/inmune a la condición asustado/.test(cond(h, "asustado")), "Hugin: no se asusta");
  const mad = mk("La Madre de los Hambrientos"); t(/inmune a la condición asustado/.test(cond(mad, "asustado")) && /La Madre de los Hambrientos: hechizado/.test(cond(mad, "hechizado")), "Madre: asustado no, hechizado sí");
  // la caída no derriba a quien es inmune al derribo
  const ae = mk("Elemental de aire"); ae.E("caida", { quien: ae.j.nombre, metros: 9 }); t(!(ae.j.condiciones ?? []).some((x) => /derribad/.test(x)), "caída: el Elemental de aire no queda derribado");
  const f = fichaCriatura(C("Lich")); t(/inmune a las condiciones asustado, hechizado, agotado, dormido/.test(f), "la ficha de la criatura lista las condiciones a las que es inmune", "");
}

// ---- 3. Material «sal» y «hierro caliente»
{
  t(normalizarMaterial("hierro cálido") === "hierro caliente" && normalizarMaterial("Hierro candente") === "hierro caliente" && normalizarMaterial("sal gorda") === "sal" && normalizarMaterial("plata") === "plata", "alias de material: hierro cálido/candente → hierro caliente; sal gorda → sal");
  for (const n of ["Sirena", "Hombre pez"]) {
    const v = C(n).vulnerabilidades!;
    t(v.some((x) => x.tipo === "ácido" && x.soloMaterial === "sal") && v.some((x) => x.tipo === "fuego" && x.soloMaterial === "hierro caliente") && C(n).rasgos.some((r) => /Vulnerable a(l| la)? (sal|hierro)/i.test(r) && /hierro caliente/.test(r) && /sal/.test(r)), `${n}: vulnerable a la sal (ácido) y al hierro caliente (fuego), dato y prosa`);
    const s = mk(n);
    iniciarRegistroDados([...dados(20, 15), ...dados(6, 3, 3)]); const r = txt(s.E("atacar", { atacante: "Aldo", objetivo: s.j.nombre, dano: "2d6", bono: 50, tipo_dano: "ácido", material: "sal", apuntar: "torso", temerario: false })); liberarDados();
    t(s.perdida() === 12 && /vulnerable a ácido \(sal\): 6 → 12/.test(r), `${n}: la sal le hace doble daño`, r.split("\n").filter((l) => /vulnerable/.test(l)).join("|"));
    const h = mk(n); iniciarRegistroDados([...dados(20, 15), ...dados(6, 3, 3)]); h.E("atacar", { atacante: "Aldo", objetivo: h.j.nombre, dano: "2d6", bono: 50, tipo_dano: "fuego", material: "hierro cálido", apuntar: "torso", temerario: false }); liberarDados();
    t(h.perdida() === 12, `${n}: el hierro cálido (alias) le hace doble daño`);
    const o = mk(n); iniciarRegistroDados([...dados(20, 15), ...dados(6, 3, 3)]); o.E("atacar", { atacante: "Aldo", objetivo: o.j.nombre, dano: "2d6", bono: 50, tipo_dano: "fuego", apuntar: "torso", temerario: false }); liberarDados();
    t(o.perdida() === 6, `${n}: el fuego corriente (sin material) pasa normal`);
  }
  const ef = C("Elemental de fuego"); t(ef.vulnerabilidades!.some((x) => x.tipo === "ácido" && x.soloMaterial === "sal") && ef.vulnerabilidades!.some((x) => x.soloMaterial === "agua"), "Elemental de fuego: vulnerable al agua y a la sal (datos)");
  const frasco = TESORO.find((x) => x.id === "frasco_sal")!, hierro = TESORO.find((x) => x.id === "hierro_marcar");
  t(frasco.material === "sal" && hierro?.material === "hierro caliente", "el catálogo define el material «sal» (Frascos de sal) y «hierro caliente» (Hierro de marcar)");
  // lanzar un frasco de sal: contra un no-muerto o contra quien es vulnerable a la sal (Sirena), no contra cualquiera
  const p = mk("Sirena"); p.E("modificar_personaje", { nombre: "Aldo", agregar_inventario: ["Frascos de sal (3)"] });
  const personajeAldo = p.p.personajes["Aldo"]; if (!personajeAldo.inventario.some((x) => /sal/i.test(x))) personajeAldo.inventario.push("Frascos de sal (3)");
  iniciarRegistroDados([...dados(20, 15), ...dados(6, 3)]); const l = p.E("sal", { quien: "Aldo", accion: "lanzar", objetivo: p.j.nombre }); liberarDados();
  t(!l.error && p.perdida() === 6 && /vulnerable a ácido \(sal\)/.test(txt(l)), "sal {lanzar} contra una Sirena: el frasco cuenta como sal (1d6 doble)", txt(l).slice(0, 160));
  const w = mk("Wendigo"); w.p.personajes["Aldo"].inventario.push("Frascos de sal (3)"); const l2 = w.E("sal", { quien: "Aldo", accion: "lanzar", objetivo: w.j.nombre }); t(l2.error === true, "sal {lanzar} contra una criatura que no es no-muerto ni vulnerable a la sal: error");
}

// ---- 4. Defensas condicionadas: la Bakunawa «varada» es vulnerable al fuego
{
  const b = mk("Bakunawa");
  const golpe = (tipo: string) => { iniciarRegistroDados([...dados(20, 15), ...dados(6, 5, 5, 5, 5)]); const a = b.perdida(); const r = b.E("atacar", { atacante: "Aldo", objetivo: b.j.nombre, dano: "2d6", bono: 80, tipo_dano: tipo, apuntar: "torso", temerario: false }); liberarDados(); return { d: b.perdida() - a, s: txt(r) }; };
  const g1 = golpe("fuego"); t(g1.d === 10 && !/vulnerable/.test(g1.s), "Bakunawa en el agua: el fuego pasa normal", String(g1.d));
  const c = cond(b, "varada"); t(/Bakunawa: varada/.test(c) && !/texto libre/.test(c), "«varada» está en el catálogo de condiciones", c.slice(0, 80));
  const g2 = golpe("fuego"); t(g2.d === 20 && /vulnerable a fuego: 10 → 20/.test(g2.s), "varada: el fuego le hace doble daño");
  const g3 = golpe("frío"); t(g3.d === 5, "varada: sigue resistiendo el frío");
  b.E("condicion", { objetivo: b.j.nombre, accion: "quitar", condicion: "varada" });
  const g4 = golpe("fuego"); t(g4.d === 10, "al volver al agua (quitar «varada»), el fuego pasa normal otra vez");
  const r = b.E("danar_criatura", { nombre: b.j.nombre, cantidad: 10, tipo_dano: "fuego" }); t(txt(r).includes("−10 PV"), "danar_criatura también usa el estado");
  b.E("condicion", { objetivo: b.j.nombre, accion: "aplicar", condicion: "varada" }); const r2 = b.E("danar_criatura", { nombre: b.j.nombre, cantidad: 10, tipo_dano: "fuego" }); t(/−20 PV/.test(txt(r2)), "danar_criatura varada: doble");
  t(/mientras esté «varada»: vulnerable a fuego/.test(lineaResistencias(C("Bakunawa"))), "la ficha dice la defensa condicionada");
  t(C("Bakunawa").rasgos.some((r) => /vulnerable al fuego solo mientras esté fuera del agua/.test(r)), "la prosa de la Bakunawa dice lo mismo");
}

// ---- 5. Adaptación de Kuru: resistencia al tipo nuevo desde su siguiente turno, hasta 3 tipos por combate
{
  const k = mk("Kuru, el Cazador de Leyendas");
  k.j.definicion = { ...k.j.definicion, blindaje: [], artes: [], ca: 1 }; // sin armadura ni Contracorriente: solo la adaptación
  const gol = (tipo: string, extra: object = {}) => { if (k.p.combate) k.p.combate.turnos = {}; iniciarRegistroDados([...dados(20, 15), ...dados(6, 5, 5, 5, 5)]); const a = k.perdida(); k.E("atacar", { atacante: "Aldo", objetivo: k.j.nombre, dano: "2d6", bono: 80, tipo_dano: tipo, apuntar: "torso", temerario: false, ...extra }); liberarDados(); return k.perdida() - a; };
  k.p.combate = { ronda: 1, orden: [], pnj: {}, sorprendidos: [] } as any;
  const d1 = gol("fuego"); t(d1 === 10, "Kuru: el primer fuego pasa entero (aprende)", String(d1));
  const mismoAsalto = gol("fuego"); t(mismoAsalto === 10, "…pero la resistencia no vale hasta su siguiente turno (mismo asalto: entero)", String(mismoAsalto));
  k.p.combate!.ronda = 2;
  t(gol("fuego") === 5, "asalto siguiente: el fuego le hace la mitad (adaptado)");
  t(gol("eléctrico") === 10 && gol("ácido") === 10 && gol("frío") === 10, "tres tipos nuevos más: aprende hasta 3 por combate (fuego, eléctrico y ácido)");
  k.p.combate!.ronda = 3;
  t(gol("eléctrico") === 5 && gol("ácido") === 5, "asalto 3: resiste eléctrico y ácido");
  t(gol("frío") === 10 && gol("frío") === 10, "el cuarto tipo (frío) ya no lo aprende: pasa entero siempre");
  t((k.j.adaptaciones ?? []).length === 3, "adaptaciones guardadas: 3 como máximo", JSON.stringify(k.j.adaptaciones));
  t(gol("cortante") === 10 && gol("perforante") === 10 && (k.j.adaptaciones ?? []).every((x) => x.tipo !== "cortante" && x.tipo !== "perforante"), "el daño físico (armas) no lo endurece: solo los tipos no físicos");
  const n = mk("Kuru, el Cazador de Leyendas"); n.j.definicion = { ...n.j.definicion, blindaje: [], artes: [], ca: 1 }; n.p.combate = { ronda: 1, orden: [], pnj: {}, sorprendidos: [] } as any;
  n.E("danar_criatura", { nombre: n.j.nombre, cantidad: 10, tipo_dano: "fuego" }); n.p.combate!.ronda = 2; n.E("danar_criatura", { nombre: n.j.nombre, cantidad: 10, tipo_dano: "fuego" });
  t(n.perdida() === 15, "danar_criatura también aprende y aplica la adaptación (10 + 5)");
  t(perfilDeJefe({ definicion: C("Kuru, el Cazador de Leyendas"), condiciones: [], adaptaciones: [{ tipo: "fuego", desde: 5 }] }, 4).resiste?.length === 0, "perfilDeJefe: la adaptación aún no vale antes de su asalto");
}

// ---- 6. PNJ con ficha de criatura
{
  const p = nuevaPartida(); normalizarPartida(p); const E = (n: string, d: object): any => ejecutar(n, d, p);
  E("guardar_personaje", { don_arcano: false, nombre: "Aldo", jugador: "Ana", raza: "Humano del Faro", clase: "Mercenario del Cuervo", nivel: 5, pv_max: 900, ca: 12, atributos: { fue: 16, des: 14, con: 14, int: 10, sab: 14, car: 10 }, inventario: ["Espada larga"], dote: "Terco" });
  const r = E("iniciativa", { participantes: ["Aldo"], pnj: [{ nombre: "Guardián de piedra", bono_ataque: 5, ca: 10, pv: 5000, criatura: "Golem de piedra" }, { nombre: "Soldado", bono_ataque: 5, ca: 10, pv: 5000 }, { nombre: "Fantoche", bono_ataque: 5, ca: 10, pv: 5000, criatura: "Wendigo" }] });
  t(!r.error, "iniciativa acepta criatura en el PNJ", txt(r).slice(0, 80));
  const g = (n: string, tipo: string, extra: object = {}) => { p.combate!.turnos = {}; iniciarRegistroDados([...dados(20, 15), ...dados(6, 5, 5)]); const pj = p.combate!.pnj[n]; const a = pj.pv!; E("atacar", { atacante: "Aldo", objetivo: n, dano: "2d6", bono: 80, tipo_dano: tipo, temerario: false, ...extra }); liberarDados(); return a - pj.pv!; };
  t(g("Guardián de piedra", "cortante") === 5, "PNJ Golem de piedra: resiste el cortante no mágico (mitad)");
  t(g("Guardián de piedra", "cortante", { magico: true }) === 10, "…y no el mágico");
  t(g("Guardián de piedra", "veneno") === 0, "…inmune al veneno");
  t(g("Soldado", "veneno") === 10 && g("Soldado", "cortante") === 10, "PNJ sin ficha: sin cambios");
  t(g("Fantoche", "fuego") === 20 && g("Fantoche", "frío") === 0, "PNJ Wendigo: vulnerable al fuego e inmune al frío");
  t(/es inmune a la condición asustado/.test(txt(E("condicion", { objetivo: "Guardián de piedra", accion: "aplicar", condicion: "asustado" }))) && /Soldado: asustado/.test(txt(E("condicion", { objetivo: "Soldado", accion: "aplicar", condicion: "asustado" }))), "PNJ con ficha: inmune a las condiciones de su ficha; sin ficha, no");
  p.combate!.pnj["Guardián de piedra"].pv = 5000; const c = E("caida", { quien: "Guardián de piedra", metros: 9 }); t(!c.error && p.combate!.pnj["Guardián de piedra"].pv! < 5000, "caída de un PNJ con ficha: funciona");
}

// ---- 7. Rutas de daño a criaturas: caída (contundente), Hiel (veneno) y la ficha
{
  const g = mk("Gigante de hueso"); iniciarRegistroDados(dados(6, 3, 3, 3)); const r = txt(g.E("caida", { quien: g.j.nombre, metros: 9 })); liberarDados();
  t(g.perdida() === 18 && /vulnerable a contundente: 9 → 18/.test(r), "caída sobre un Gigante de hueso (vulnerable al contundente): doble", r.split("\n").filter((l) => /vulnerable/.test(l)).join("|"));
  const e = mk("Elemental de fuego"); iniciarRegistroDados(dados(6, 3, 3, 3)); e.E("caida", { quien: e.j.nombre, metros: 9 }); liberarDados();
  t(e.perdida() === 4, "caída sobre un Elemental de fuego (resiste lo físico no mágico): mitad");
}
t(BESTIARIO.every((c) => lineaResistencias(c) !== undefined) && /inmune a las condiciones/.test(fichaCriatura(C("Lich"))), "la ficha del Lich enseña las inmunidades a condiciones");
void aplicarDano;
console.log(`${ok} ok, ${mal} fallas`);
