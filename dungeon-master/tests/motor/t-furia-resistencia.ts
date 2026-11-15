// Resistencia de la Furia (Berserker): mitad del daño físico (corte/cortante, punta/perforante, contundente) en TODOS los daños con tipo
// que recibe un PJ: atacar (una sola vez, tras la armadura), habilidades de criaturas, trampas, caída, tragado y modificar_personaje.
// Una sola mitad aunque haya varias fuentes; el radiante del Castigo y los daños no físicos no se resisten. Dados fijos.
import { nuevaPartida, normalizarPartida } from "../../src/estado.ts";
import { ejecutar } from "../../src/herramientas.ts";
import { iniciarRegistroDados, liberarDados } from "../../src/dados.ts";
import { danoConResistencia, esDanoFisico } from "../../src/rasgos.ts";
let ok = 0, mal = 0; const t = (c: boolean, m: string, x = "") => { console.log(c ? "ok   " : "FALLA", m, x); c ? ok++ : mal++; };
const txt = (r: any) => (typeof r === "string" ? r : r?.contenido ?? JSON.stringify(r));
const dados = (caras: number, ...v: number[]) => v.map((valor) => ({ caras, valor }));

function mk(raza = "Humano del Faro", furia = true) {
  const p = nuevaPartida(); normalizarPartida(p); const E = (n: string, d: object): any => ejecutar(n, d, p);
  E("tirar_don_arcano", { jugador: "Ana" });
  E("guardar_personaje", { nombre: "Brun", jugador: "Ana", raza, clase: "Berserker de Ceniza", nivel: 5, pv_max: 100, ca: 12, atributos: { fue: 16, des: 12, con: 14, int: 10, sab: 10, car: 10 }, inventario: ["Hacha"], don_arcano: false, dote: "Terco" });
  if (furia) p.personajes["Brun"].furia = { activa: true, asaltos: 10 } as any;
  return { p, E, B: () => p.personajes["Brun"] };
}
const hab = (E: any, tipo: string, dano = "2d6", extra: object = {}) => E("habilidad_criatura", { criatura: "Hambriento", habilidad_nueva: { nombre: "Golpe", descripcion: "x", dano, tipo_dano: tipo, ...extra }, objetivos: ["Brun"] });
function conCriatura(raza?: string, furia = true) { const m = mk(raza, furia); m.E("aparecer_criatura", { nombre: "Hambriento" }); return m; }
const perdida = (m: ReturnType<typeof mk>) => 100 - m.B().pv;

// Habilidades de criaturas: físicas 10 → 5 con furia; 10 sin furia; no físicas intactas.
for (const tipo of ["contundente", "cortante", "perforante", "corte", "punta", "Contundente", "CORTANTE"]) {
  const m = conCriatura(); iniciarRegistroDados(dados(6, 5, 5)); const r = hab(m.E, tipo); liberarDados();
  t(!r.error && perdida(m) === 5, `habilidad ${tipo} 10 → 5 en furia`, txt(r).slice(-120));
}
{ const m = conCriatura("Humano del Faro", false); iniciarRegistroDados(dados(6, 5, 5)); hab(m.E, "contundente"); liberarDados(); t(perdida(m) === 10, "habilidad contundente 10 sin furia: 10"); }
{ const m = conCriatura(); iniciarRegistroDados(dados(6, 5, 5)); hab(m.E, "fuego"); liberarDados(); t(perdida(m) === 10, "habilidad de fuego no se reduce con Furia"); }
{ const m = conCriatura(); iniciarRegistroDados(dados(6, 5, 5)); hab(m.E, "radiante"); liberarDados(); t(perdida(m) === 10, "habilidad radiante no se reduce con Furia"); }
{ const m = conCriatura(); iniciarRegistroDados(dados(6, 5, 5)); const r = hab(m.E, "contundente"); liberarDados(); t(/Furia/.test(txt(r)) && /10 → 5/.test(txt(r)), "la nota dice que es la Furia (10 → 5)"); }
// Mitad por salvación primero, resistencia después: 2d6=11 → mitad 5 → resistencia 2.
{ const m = conCriatura(); iniciarRegistroDados([...dados(6, 5, 6), ...dados(20, 20)]); hab(m.E, "contundente", "2d6", { salvacion: "des", cd: 1, mitad_si_exito: true }); liberarDados(); t(perdida(m) === 2, "salvación (mitad) y luego Furia: 11 → 5 → 2", String(perdida(m))); }
// Redondeo hacia abajo: 7 → 3.
{ const m = conCriatura(); iniciarRegistroDados(dados(6, 3, 4)); hab(m.E, "contundente"); liberarDados(); t(perdida(m) === 3, "redondeo hacia abajo: 7 → 3"); }

// Función central: sin acumulación y reconocimiento de tipos.
{
  const { B } = mk("Cenizo"); const p = B();
  t(danoConResistencia(p, 10, "fuego").dano === 5, "Cenizo + furia, fuego: 10 → 5 (racial)");
  t(danoConResistencia(p, 10, "contundente").dano === 5, "Cenizo + furia, contundente: 10 → 5 (Furia)");
  t(danoConResistencia(p, 10, "radiante").dano === 10, "radiante: sin resistencia");
  t(danoConResistencia(p, 10).dano === 10, "sin tipo: sin resistencia");
  t(["corte", "cortante", "punta", "perforante", "contundente"].every(esDanoFisico) && !["fuego", "radiante", "eléctrico", "frío", ""].some(esDanoFisico), "tipos físicos reconocidos (ambos vocabularios)");
  p.furia = undefined; t(danoConResistencia(p, 10, "contundente").dano === 10, "furia inactiva: no resiste");
}
{ // racial + Furia del mismo tipo: una sola mitad (un tipo mixto no existe, pero la función no puede encadenar dos mitades)
  const { B } = mk("Enano de Karak-Dûm"); const r = danoConResistencia(B(), 10, "veneno"); t(r.dano === 5 && (r.nota.match(/→/g) ?? []).length === 1, "una sola mitad aunque haya varias fuentes", r.nota);
}

// Caída: 12 m = 4d6 contundente: 20 → 10 con furia, 20 sin ella.
{ const m = mk(); iniciarRegistroDados(dados(6, 5, 5, 5, 5)); const r = m.E("caida", { quien: "Brun", metros: 12 }); liberarDados(); t(perdida(m) === 10, "caída 20 → 10 en furia", txt(r).slice(0, 160)); }
{ const m = mk("Humano del Faro", false); iniciarRegistroDados(dados(6, 5, 5, 5, 5)); m.E("caida", { quien: "Brun", metros: 12 }); liberarDados(); t(perdida(m) === 20, "caída 20 sin furia: 20"); }

// Trampa física.
{
  const m = mk(); m.E("trampa", { accion: "colocar", nombre: "Hoz", cd_detectar: 10, efecto: { nombre: "Hoz", descripcion: "Una hoz oculta.", dano: "2d6", tipo_dano: "cortante" } });
  iniciarRegistroDados(dados(6, 5, 5)); const r = m.E("trampa", { accion: "disparar", nombre: "Hoz", quienes: ["Brun"] }); liberarDados();
  t(!r.error && perdida(m) === 5, "trampa cortante 10 → 5 en furia", txt(r).slice(-100));
}

// modificar_personaje con tipo_dano.
{ const m = mk(); m.E("modificar_personaje", { nombre: "Brun", pv_cambio: -10, tipo_dano: "contundente" }); t(perdida(m) === 5, "modificar_personaje -10 contundente → 5 en furia");
  const n = mk(); n.E("modificar_personaje", { nombre: "Brun", pv_cambio: -10, tipo_dano: "veneno" }); t(perdida(n) === 10, "modificar_personaje veneno no se resiste"); }

// Atacar: sigue igual (una sola mitad, tras la armadura).
function atacando(furia: boolean, extra: object = {}, tipo = "corte") {
  const m = mk("Humano del Faro", furia);
  m.E("guardar_personaje", { nombre: "Aldo", jugador: "Beto", raza: "Humano del Faro", clase: "Mercenario del Cuervo", nivel: 5, pv_max: 50, ca: 12, atributos: { fue: 16, des: 14, con: 14, int: 10, sab: 10, car: 10 }, inventario: ["Espada larga"], don_arcano: false, dote: "Terco" });
  iniciarRegistroDados([...dados(20, 15), ...dados(6, 5, 5)]);
  const r = m.E("atacar", { atacante: "Aldo", objetivo: "Brun", dano: "2d6", bono: 50, tipo_dano: tipo, temerario: false, ...extra });
  liberarDados(); return { m, r };
}
{ const a = atacando(true); t(perdida(a.m) === 5, "atacar corte 10 → 5 en furia (una sola vez)", txt(a.r).slice(-160)); }
{ const a = atacando(false); t(perdida(a.m) === 10, "atacar 10 sin furia: 10"); }
{ const a = atacando(true, {}, "punta"); t(perdida(a.m) === 5, "atacar punta 10 → 5 en furia"); }

// Castigo radiante: se suma sin resistirse (arma 10 físico → 5; radiante 2d8 intacto).
{
  const p = nuevaPartida(); normalizarPartida(p); const E = (n: string, d: object): any => ejecutar(n, d, p);
  E("tirar_don_arcano", { jugador: "Ana" });
  E("guardar_personaje", { nombre: "Brun", jugador: "Ana", raza: "Humano del Faro", clase: "Berserker de Ceniza", nivel: 6, pv_max: 100, ca: 12, atributos: { fue: 16, des: 12, con: 14, int: 10, sab: 10, car: 10 }, inventario: ["Hacha"], don_arcano: false, dote: "Terco" });
  E("guardar_personaje", { nombre: "Sir", jugador: "Beto", raza: "Humano del Faro", clase: "Caballero Juramentado", nivel: 6, pv_max: 60, ca: 12, atributos: { fue: 16, des: 12, con: 14, int: 10, sab: 10, car: 12 }, inventario: ["Espada larga"], don_arcano: false, dote: "Terco" });
  p.personajes["Brun"].furia = { activa: true, asaltos: 10 } as any;
  E("juramento", { quien: "Sir", accion: "jurar", votos: ["verdad"] });
  iniciarRegistroDados([...dados(20, 15), ...dados(6, 5, 5), ...dados(8, 4, 4, 4, 4, 4, 4)]);
  const r = E("atacar", { atacante: "Sir", objetivo: "Brun", dano: "2d6", bono: 50, tipo_dano: "corte", castigo: true, temerario: false });
  liberarDados();
  const rad = /Radiante: .*?= (\d+)/.exec(txt(r));
  const radN = rad ? Number(rad[1]) : -1;
  t(!r.error && radN > 0 && 100 - p.personajes["Brun"].pv === 5 + radN, `Castigo: el arma se resiste (10 → 5) y el radiante (${radN}) no`, txt(r).slice(-300));
  t(/ni la armadura ni la Furia/.test(txt(r)), "el aviso del radiante lo dice");
}

console.log(`${ok} ok, ${mal} fallas`);
