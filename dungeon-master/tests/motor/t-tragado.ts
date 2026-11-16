// Tragar de verdad (Bakunawa): estado «tragado», daño eléctrico por turno, límite de 1, cobertura total y las vías de escape
// (daño desde dentro, presión de los aliados, Atletismo/Acrobacias, retirada y muerte); solo en el mar: el filtro del encuentro,
// la velocidad y aparecer_criatura; y que las demás criaturas no cambian. Dados fijos.
import { nuevaPartida, normalizarPartida } from "../../src/estado.ts";
import { ejecutar } from "../../src/herramientas.ts";
import { BESTIARIO } from "../../src/bestiario.ts";
import { iniciarRegistroDados, liberarDados } from "../../src/dados.ts";
import { enMar, TABLA } from "../../src/encuentros.ts";
import { efectos, reconocer, tragadoPor } from "../../src/condiciones.ts";
import { velocidadDe } from "../../src/velocidad.ts";
import { localizar } from "../../src/combate.ts";
import { consultarReglas } from "../../src/prompt-web.ts";
let ok = 0, mal = 0; const t = (c: boolean, m: string, x = "") => { console.log(c ? "ok   " : "FALLA", m, x); c ? ok++ : mal++; };
const txt = (r: any) => (typeof r === "string" ? r : r?.contenido ?? JSON.stringify(r));
const d20 = (...v: number[]) => v.map((valor) => ({ caras: 20, valor }));
const d6 = (n: number, valor: number) => Array.from({ length: n }, () => ({ caras: 6, valor }));

function mk(opts: { pv?: number; segundo?: boolean; fue?: number; des?: number } = {}) {
  const p = nuevaPartida(); normalizarPartida(p); const E = (n: string, d: object): any => ejecutar(n, d, p);
  E("tirar_don_arcano", { jugador: "Ana" });
  const pj = (nombre: string, jugador: string) => E("guardar_personaje", { nombre, jugador, raza: "Humano del Faro", clase: "Mercenario del Cuervo", nivel: 5, pv_max: opts.pv ?? 100, ca: 12, atributos: { fue: opts.fue ?? 16, des: opts.des ?? 14, con: 14, int: 10, sab: 10, car: 10 }, inventario: ["Espada larga"], don_arcano: false, dote: "Terco" });
  pj("Aldo", "Ana"); if (opts.segundo) pj("Brea", "Beto");
  E("aparecer_criatura", { nombre: "Bakunawa" });
  E("iniciativa", { participantes: opts.segundo ? ["Aldo", "Brea", "Bakunawa"] : ["Aldo", "Bakunawa"] });
  return { p, E, B: () => p.jefes["Bakunawa"], A: () => p.personajes["Aldo"] };
}
const agarrar = (E: any, quien: string) => E("condicion", { objetivo: quien, accion: "aplicar", condicion: "agarrado", nota: "por Bakunawa" });
function tragado(opts: Parameters<typeof mk>[0] = {}, quien = "Aldo") {
  const m = mk(opts); agarrar(m.E, quien); iniciarRegistroDados(d20(1)); const r = m.E("habilidad_criatura", { criatura: "Bakunawa", habilidad: "Tragar", objetivos: [quien] }); liberarDados();
  return { ...m, r };
}

// ---- tragar
{ const m = mk(); const sin = m.E("habilidad_criatura", { criatura: "Bakunawa", habilidad: "Tragar", objetivos: ["Aldo"] });
  t(!!sin.error && /no está agarrado/.test(txt(sin)) && !tragadoPor(m.A().condiciones), "Tragar exige que el objetivo ya esté agarrado", txt(sin).slice(0, 90));
  agarrar(m.E, "Aldo"); iniciarRegistroDados(d20(20)); const bien = m.E("habilidad_criatura", { criatura: "Bakunawa", habilidad: "Tragar", objetivos: ["Aldo"] }); liberarDados();
  t(!bien.error && !tragadoPor(m.A().condiciones) && m.A().condiciones.some((c: string) => /agarrad/.test(c)), "si supera la salvación de FUE, sigue agarrado y no lo traga", txt(bien).slice(-90));
  m.B().gastadas = []; m.p.combate.turnos = {};
  iniciarRegistroDados(d20(1)); const mal1 = m.E("habilidad_criatura", { criatura: "Bakunawa", habilidad: "Tragar", objetivos: ["Aldo"] }); liberarDados();
  const c = m.A().condiciones as string[]; const ef = efectos(c);
  t(!mal1.error && tragadoPor(c) === "Bakunawa" && !c.some((x) => reconocer(x)?.id === "agarrado"), "si falla la salvación de FUE, queda «tragado (por Bakunawa)» (y deja de estar agarrado)", c.join("|"));
  t(ef.ids.includes("tragado") && ef.velocidad0 && ef.ataca === "desventaja", "tragado es del catálogo: retenido (velocidad 0) y cegado (desventaja al atacar)");
  t(/FUE.*CD 19/.test(txt(mal1)) && /ESCAPES/.test(txt(mal1)) && /4d6/.test(txt(mal1)) && /25\+ de daño/.test(txt(mal1)) && /CD 20/.test(txt(mal1)), "el resultado le da al DM el daño y las vías de escape", txt(mal1).slice(-200)); }

// ---- límite de uno a la vez
{ const m = tragado({ segundo: true }); agarrar(m.E, "Brea"); m.B().gastadas = []; m.p.combate.turnos = {};
  const dos = m.E("habilidad_criatura", { criatura: "Bakunawa", habilidad: "Tragar", objetivos: ["Brea"] });
  t(!!dos.error && /máximo 1/.test(txt(dos)) && !tragadoPor(m.p.personajes["Brea"].condiciones) && tragadoPor(m.A().condiciones) === "Bakunawa", "no puede tragar a un segundo mientras tiene a uno dentro (límite 1)", txt(dos).slice(0, 110));
  const dobles = m.E("habilidad_criatura", { criatura: "Bakunawa", habilidad: "Tragar", objetivos: ["Aldo", "Brea"] });
  t(!!dobles.error, "Tragar es contra un solo objetivo"); }

// ---- daño eléctrico al empezar el turno
{ const m = tragado({ segundo: true }); iniciarRegistroDados(d6(4, 6)); const r = txt(m.E("siguiente_asalto", {})); liberarDados();
  t(m.A().pv === 76 && /⚡/.test(r) && /eléctrico/.test(r) && /Aldo/.test(r), "al abrirse el asalto, el tragado sufre 4d6 eléctrico (24) con aviso ⚡", `${m.A().pv} ${r.slice(0, 120)}`);
  t(m.p.personajes["Brea"].pv === 100, "quien no está dentro no lo sufre");
  iniciarRegistroDados(d6(4, 1)); m.E("siguiente_asalto", {}); liberarDados(); t(m.A().pv === 72, "y otra vez en cada asalto mientras siga dentro", String(m.A().pv)); }
{ const m = tragado({ pv: 10 }); m.A().pv = 0; iniciarRegistroDados(d6(4, 6)); m.E("siguiente_asalto", {}); liberarDados();
  t(!m.A().condiciones.includes("muerto") && tragadoPor(m.A().condiciones) === "Bakunawa", "sin muerte instantánea: a 0 PV el daño eléctrico no lo mata de golpe y sigue dentro", m.A().condiciones.join("|")); }
{ const m = tragado({ pv: 100 }); m.A().pv = 5; iniciarRegistroDados(d6(4, 6)); const r = txt(m.E("siguiente_asalto", {})); liberarDados();
  t(m.A().pv <= 1 && /cae a 0 PV dentro/.test(r), "a 0 PV (o 1 con Terco) cae dentro, con aviso", r.slice(0, 160)); }

// ---- cobertura total
{ const m = tragado({ segundo: true });
  const fuera = m.E("atacar", { atacante: "Brea", objetivo: "Aldo", dano: "1d6" });
  t(!!fuera.error && /cobertura total/.test(txt(fuera)), "un aliado de fuera no puede atacar al tragado (cobertura total)", txt(fuera).slice(0, 100));
  const a = m.E("atacar", { atacante: "Aldo", objetivo: "Brea", dano: "1d6" }); t(!!a.error && /solo puede atacar a Bakunawa/.test(txt(a)), "el tragado solo puede atacar a quien lo tragó");
  const maza = m.E("atacar", { atacante: "Aldo", objetivo: "Bakunawa", dano: "1d6", tipo_dano: "contundente" }); t(!!maza.error && /cortante o perforante/.test(txt(maza)), "desde dentro no vale el daño contundente");
  const dist = m.E("atacar", { atacante: "Aldo", objetivo: "Bakunawa", dano: "1d6", a_distancia: true }); t(!!dist.error, "ni a distancia");
  m.p.combate.turnos = {}; const hab = m.E("habilidad_criatura", { criatura: "Bakunawa", habilidad_nueva: { nombre: "Rayo", descripcion: "x", salvacion: "des", cd: 10 }, objetivos: ["Brea"] }); t(!hab.error, "otras habilidades siguen funcionando con quien está fuera");
  m.E("aparecer_criatura", { nombre: "Hambriento" });
  m.p.combate.turnos = {}; const h2 = m.E("habilidad_criatura", { criatura: "Hambriento", habilidad_nueva: { nombre: "Rayo", descripcion: "x", salvacion: "des", cd: 10 }, objetivos: ["Aldo"] }); t(!!h2.error && /cobertura total/.test(txt(h2)), "una habilidad de otra criatura no alcanza al tragado", txt(h2).slice(0, 90));
  const ok1 = m.E("atacar", { atacante: "Aldo", objetivo: "Bakunawa", dano: "1d6", arma: "Espada larga" }); t(!ok1.error, "pero con arma cortante sí puede atacar a la Bakunawa desde dentro", txt(ok1).slice(0, 90)); }

// ---- escape 1: daño desde dentro (conjuro con danar_criatura por, o ataque)
{ const m = tragado(); const j = m.B();
  const poco = txt(m.E("danar_criatura", { nombre: "Bakunawa", cantidad: 24, por: "Aldo" })); t(tragadoPor(m.A().condiciones) === "Bakunawa" && !/salvación de CON/.test(poco), "24 de daño desde dentro no bastan (umbral 25)");
  iniciarRegistroDados(d20(20)); const sal = txt(m.E("danar_criatura", { nombre: "Bakunawa", cantidad: 1, por: "Aldo" })); liberarDados();
  t(tragadoPor(m.A().condiciones) === "Bakunawa" && /aguanta/.test(sal) && /CD 17/.test(sal), "25 en un turno: salvación de CON; si la supera, no lo suelta", sal.slice(-140));
  m.E("siguiente_asalto", {}); iniciarRegistroDados(d20(1)); const vom = txt(m.E("danar_criatura", { nombre: "Bakunawa", cantidad: 25, por: "Aldo" })); liberarDados();
  t(!tragadoPor(m.A().condiciones) && m.A().condiciones.some((c: string) => /derribad/.test(c)) && /vomita/.test(vom), "si falla la salvación de CON, lo vomita y cae derribado", vom.slice(-160));
  t(m.A().pv >= 0 && j.pv > 0, "y la criatura sigue viva"); }
{ const m = tragado(); iniciarRegistroDados(d20(1)); m.E("siguiente_asalto", {}); // el asalto 2 reinicia la cuenta
  m.E("danar_criatura", { nombre: "Bakunawa", cantidad: 20, por: "Aldo" }); const r = txt(m.E("danar_criatura", { nombre: "Bakunawa", cantidad: 6, por: "Aldo" })); liberarDados();
  t(!tragadoPor(m.A().condiciones) && /FALLA/.test(r), "el daño desde dentro se suma dentro del mismo turno (20 + 6)", r.slice(-120)); }
{ const m = tragado(); m.E("siguiente_asalto", {}); m.E("danar_criatura", { nombre: "Bakunawa", cantidad: 20, por: "Aldo" }); m.E("siguiente_asalto", {}); const r = txt(m.E("danar_criatura", { nombre: "Bakunawa", cantidad: 20, por: "Aldo" }));
  t(tragadoPor(m.A().condiciones) === "Bakunawa" && !/salvación de CON/.test(r), "pero no se acumula de un turno a otro"); }
// por ataque (atacar)
{ const m = tragado(); iniciarRegistroDados(d20(20, 20, 20, 1, 1)); const r = m.E("atacar", { atacante: "Aldo", objetivo: "Bakunawa", arma: "Espada larga", dano: "30" }); liberarDados();
  t(!r.error && /salvación de CON/.test(txt(r)) && !tragadoPor(m.A().condiciones), "atacar con arma cortante desde dentro con mucho daño también cuenta (escupe)", txt(r).slice(-200)); }

// ---- escape 2: presión de los aliados (daño de fuera)
{ const m = tragado({ segundo: true });
  const a = txt(m.E("danar_criatura", { nombre: "Bakunawa", cantidad: 49, por: "Brea" })); t(tragadoPor(m.A().condiciones) === "Bakunawa" && !/salvación de CON/.test(a), "49 de daño de fuera en un asalto no bastan (umbral 50)");
  iniciarRegistroDados(d20(1)); const b = txt(m.E("danar_criatura", { nombre: "Bakunawa", cantidad: 1, por: "Brea" })); liberarDados();
  t(!tragadoPor(m.A().condiciones) && /FALLA/.test(b) && /derribado/.test(m.A().condiciones.join("|")), "con 50 en un asalto (de fuera), salvación de CON; si falla, lo vomita", b.slice(-140));
  const m2 = tragado(); iniciarRegistroDados(d20(20, 1)); m2.E("danar_criatura", { nombre: "Bakunawa", cantidad: 60 }); const c = txt(m2.E("danar_criatura", { nombre: "Bakunawa", cantidad: 60 })); liberarDados();
  t(tragadoPor(m2.A().condiciones) === "Bakunawa" && !/salvación de CON/.test(c), "una sola salvación por asalto: superada, no se repite hasta el siguiente"); }

// ---- escape 3: Atletismo o Acrobacias CD 20 (maniobra escapar)
{ const m = tragado(); iniciarRegistroDados(d20(1)); const f = txt(m.E("maniobra", { atacante: "Aldo", objetivo: "Bakunawa", tipo: "escapar" })); liberarDados();
  t(tragadoPor(m.A().condiciones) === "Bakunawa" && /no lo consigue/.test(f) && /CD 20/.test(f), "abrirse paso con un resultado bajo no basta y sigue dentro", f.slice(0, 140));
  iniciarRegistroDados(d20(20)); const s = txt(m.E("maniobra", { atacante: "Aldo", objetivo: "Bakunawa", tipo: "escapar" })); liberarDados();
  t(!tragadoPor(m.A().condiciones) && /SALE/.test(s) && /Atletismo/.test(s) && m.A().condiciones.some((c: string) => /derribad/.test(c)), "con un 20 (Atletismo) sale por la garganta y cae derribado", s.slice(0, 160)); }
{ const m = tragado({ fue: 8, des: 20 }); iniciarRegistroDados(d20(17)); const s = txt(m.E("maniobra", { atacante: "Aldo", objetivo: "Bakunawa", tipo: "escapar" })); liberarDados();
  t(!tragadoPor(m.A().condiciones) && /Acrobacias/.test(s), "con más DES usa Acrobacias (17 + 5 = 22 ≥ CD 20) y sale", s.slice(0, 140)); }
{ const m = mk(); agarrar(m.E, "Aldo"); iniciarRegistroDados(d20(20, 1)); const s = txt(m.E("maniobra", { atacante: "Aldo", objetivo: "Bakunawa", tipo: "escapar" })); liberarDados();
  t(/SE ZAFA/.test(s), "agarrado (sin tragar), escapar sigue siendo la prueba enfrentada de siempre", s.slice(0, 100)); }

// ---- escape 4: retirada táctica y muerte
{ const m = tragado(); const j = m.B(); const cant = j.pv - Math.floor(j.pv_max / 2); const r = txt(m.E("danar_criatura", { nombre: "Bakunawa", cantidad: cant, por: "Brea" }));
  t(!tragadoPor(m.A().condiciones) && /retirada táctica/.test(r) && /escupe/.test(r) && m.A().condiciones.some((c: string) => /derribad/.test(c)), "al caer a la mitad de PV se sumerge (retirada táctica) y escupe a los tragados antes", r.slice(-170)); }
{ const m = tragado(); const r = txt(m.E("danar_criatura", { nombre: "Bakunawa", cantidad: 9999 }));
  t(!tragadoPor(m.A().condiciones) && /cae muerta/.test(r) && !m.p.jefes["Bakunawa"], "si la Bakunawa muere, lo escupe", r.slice(-120)); }
{ const m = tragado(); m.E("terminar_combate", {}); t(!tragadoPor(m.A().condiciones), "al acabar el combate nadie sigue tragado"); }
{ const m = tragado(); iniciarRegistroDados(d6(4, 6)); m.E("danar_criatura", { nombre: "Bakunawa", cantidad: 9999 }); const pv = m.A().pv; m.E("siguiente_asalto", {}); liberarDados(); t(m.A().pv === pv, "tras salir ya no sufre el daño eléctrico"); }
// con plano: cae a 3 m
{ const m = tragado(); m.E("plano", { escena: "mar", poner: [{ nombre: "Bakunawa" }] }); m.E("plano", { poner: [{ nombre: "Aldo", ref: "Bakunawa", direccion: "N", metros: 1 }] });
  iniciarRegistroDados(d20(20)); m.E("maniobra", { atacante: "Aldo", objetivo: "Bakunawa", tipo: "escapar" }); liberarDados();
  const a = m.p.plano.puntos["Aldo"], b = m.p.plano.puntos["Bakunawa"]; const dist = Math.hypot(a.x - b.x, a.y - b.y);
  t(Math.abs(dist - 3) < 0.6, "el que sale queda a 3 m de la Bakunawa en el plano", dist.toFixed(1)); }

// ---- solo en el mar: encuentro, aparecer, velocidad, ficha
{ const p = nuevaPartida(); normalizarPartida(p);
  t(!enMar(p) && !enMar(p, "Aldenmar") && !enMar(p, "Las Ciénagas de Hollín") && !enMar(p, "La Marca Hueca") && !enMar(p, "Karak-Dûm"), "las regiones de tierra no son mar (Aldenmar no cuenta aunque lleve «mar»)");
  t(enMar(p, "Mar abierto frente a la Ciudad-Faro") && enMar(p, "Costa de Hollín") && enMar(p, "Puerto de Aldenmar") && enMar(p, "Estuario de Hollín"), "el mar, la costa, el puerto y el estuario sí");
  p.mapa.lugares["muelle"] = { id: "muelle", nombre: "Muelle viejo", region: "Aldenmar", tipo: "puerto", x: 1, y: 1, descripcion: "" } as any; p.mapa.lugares["plaza"] = { id: "plaza", nombre: "Plaza mayor", region: "Aldenmar", tipo: "ciudad", x: 1, y: 1, descripcion: "" } as any;
  p.mapa.posicion = "plaza"; const enPlaza = enMar(p); p.mapa.posicion = "muelle"; const enMuelle = enMar(p);
  t(!enPlaza && enMuelle, "un lugar de tipo puerto es mar; una plaza no");
  p.mapa.posicion = "plaza"; E0(p); }
function E0(p: any) { const E = (n: string, d: object): any => ejecutar(n, d, p);
  E("tirar_don_arcano", { jugador: "Ana" }); E("guardar_personaje", { nombre: "Aldo", jugador: "Ana", raza: "Humano del Faro", clase: "Mercenario del Cuervo", nivel: 13, pv_max: 100, ca: 12, atributos: { fue: 16, des: 14, con: 14, int: 10, sab: 10, car: 10 }, inventario: ["Espada larga"], don_arcano: false, dote: "Terco" });
  const sorteo = (region?: string): { sale: boolean; n: number } => { let n = 0, sale = false;
    for (let v = 1; v <= 1000; v += 1) { p.encuentros = []; iniciarRegistroDados([{ caras: 1000, valor: v }, { caras: 100, valor: 90 }, { caras: 100, valor: 90 }, { caras: 100, valor: 90 }]);
      const r = ejecutar("encuentro", { tipo: "peligro", dificultad: "mortal", sin_jefe: true, ...(region ? { region } : {}) }, p); n++; if (/Bakunawa en el mar/.test(txt(r))) sale = true; }
    liberarDados(); return { sale, n }; };
  t(!sorteo().sale, "en tierra (plaza de Aldenmar) la Bakunawa no sale en ninguno de los 1000 sorteos posibles");
  t(!sorteo("Las Ciénagas de Hollín").sale && !sorteo("Aldenmar").sale, "ni forzando una región de tierra");
  t(sorteo("Mar abierto frente a la Ciudad-Faro").sale, "con región de mar sí puede salir (mismo nivel y dificultad)");
  p.mapa.posicion = "muelle"; t(sorteo().sale, "en un puerto sí puede salir");
  p.mapa.posicion = "plaza"; p.personajes["Aldo"].nave = "Gaviota"; p.naves = { Gaviota: { nombre: "Gaviota", estado: "a flote" } };
  t(sorteo().sale, "a bordo de una nave, aunque el lugar sea de tierra, sí puede salir");
  p.naves.Gaviota.estado = "hundida"; t(!sorteo().sale, "con la nave hundida, ya no cuenta");
  delete p.personajes["Aldo"].nave;
  // aparecer_criatura en tierra: aviso
  const q = nuevaPartida(); normalizarPartida(q); const Q = (n: string, d: object): any => ejecutar(n, d, q);
  const tierra = txt(Q("aparecer_criatura", { nombre: "Bakunawa" })); t(/SOLO vive en el mar/.test(tierra), "aparecer_criatura en tierra avisa al DM de que solo vive en el mar");
  const q2 = nuevaPartida(); normalizarPartida(q2); q2.mapa.lugares["muelle"] = { id: "muelle", nombre: "Muelle", region: "Aldenmar", tipo: "puerto", x: 1, y: 1, descripcion: "" } as any; q2.mapa.posicion = "muelle";
  t(!/SOLO vive en el mar/.test(txt(ejecutar("aparecer_criatura", { nombre: "Bakunawa" }, q2))), "y en un puerto no avisa");
  const lobo = txt(Q("aparecer_criatura", { nombre: "Hambriento" })); t(!/SOLO vive/.test(lobo), "ninguna otra criatura avisa");
  // velocidad
  const B = q.jefes["Bakunawa"]; const v0 = velocidadDe(q, localizar(q, "Bakunawa")); Q("agua", { accion: "entrar", quienes: ["Bakunawa"] }); const v1 = velocidadDe(q, localizar(q, "Bakunawa"));
  t(v0.metros === 0 && /0 m en tierra/.test(v0.motivos.join(" ")) && v1.metros === 24 && !!B, "velocidad: 0 m fuera del agua, 24 m nadando", `${v0.metros} ${v1.metros}`);
  // ficha / lore
  const def = BESTIARIO.find((c) => c.nombre === "Bakunawa")!; const ficha = consultarReglas("criatura", "Bakunawa");
  t(def.solo_mar === true && /nunca sale a tierra/i.test(ficha) && /SOLO EN EL MAR/.test(ficha) && !/solo sale a la costa en noches de luna|solo se acerca a la costa/i.test(JSON.stringify(def)), "la ficha dice que NUNCA sale del mar y ya no sale a la costa en noches de luna");
  t(/vulnerable al fuego solo mientras esté fuera del agua, algo que ella nunca hace/.test(ficha), "la nota de vulnerabilidad al fuego ya no contradice (nunca sale por su voluntad)");
  t(/TRAGADO/.test(ficha) && /4d6 de daño eléctrico/.test(ficha) && /CD 17/.test(ficha) && /Atletismo o Acrobacias CD 20/.test(ficha) && /25 o más/.test(ficha) && /50 o más/.test(ficha) && /derribada? a 3 m|derribado a 3 m/.test(ficha), "la ficha sirve bajo demanda las reglas de escape completas (consultar_reglas criatura)");
  t(def.traga?.dano === "4d6" && def.traga.tipo_dano === "eléctrico" && def.traga.max === 1 && def.traga.umbral_dentro === 25 && def.traga.cd_escape === 20 && def.peligro === 5 && def.vd === "18", "parámetros: 4d6 eléctrico, máx. 1, 25 desde dentro, CD 20; peligro 5 / VD 18 intactos");
  t(BESTIARIO.filter((c) => c.traga || c.solo_mar).map((c) => c.nombre).join() === "Bakunawa", "solo la Bakunawa tiene el estado de tragado y el límite del mar");
  t(TABLA.filter((x) => x.mar && x.bestiario).map((x) => x.id).join() === "bakunawa", "solo la plantilla bakunawa (de criatura) está limitada al mar; el pecio es un hallazgo sin criatura");
  // otras criaturas con «Tragar» siguen con su texto de siempre (condición libre, sin estado nuevo)
  const gusano = BESTIARIO.find((c) => c.habilidades.some((h) => h.nombre === "Tragar" && c.nombre !== "Bakunawa"))!;
  const hh = gusano.habilidades.find((h) => h.nombre === "Tragar")!; t(!gusano.traga && !reconocer(hh.condicion ?? "") && tragadoPor([hh.condicion ?? ""]) === null, `${gusano.nombre}: su «tragado: 6d6…» sigue siendo texto libre (no es el estado nuevo)`); }
console.log(`${ok} ok, ${mal} fallas`);
