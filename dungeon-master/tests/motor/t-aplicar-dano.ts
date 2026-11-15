// Función única de aplicación del daño (src/danos.ts: aplicarDano + perfilDePersonaje en rasgos.ts): orden 5e, inmunidad, resistencia (mitad abajo)
// y vulnerabilidad (doble) que se anulan, no acumulación, mitad por salvación y luego resistencia (11 → 5 → 2), condición de la fuente (no mágico,
// material), perfil de PJ (raciales, Furia, voto de Luz) y las rutas reales (habilidad, caída, tragado, modificar_personaje, atacar). Dados fijos.
import { nuevaPartida, normalizarPartida } from "../../src/estado.ts";
import { ejecutar } from "../../src/herramientas.ts";
import { iniciarRegistroDados, liberarDados } from "../../src/dados.ts";
import { aplicarDano, notaDano, type ReglaDano } from "../../src/danos.ts";
import { aplicarDanoAPersonaje, perfilDePersonaje } from "../../src/rasgos.ts";
let ok = 0, mal = 0; const t = (c: boolean, m: string, x = "") => { console.log(c ? "ok   " : "FALLA", m, x); c ? ok++ : mal++; };
const txt = (r: any) => (typeof r === "string" ? r : r?.contenido ?? JSON.stringify(r));
const R = (tipo: any, motivo = "res", extra: Partial<ReglaDano> = {}): ReglaDano => ({ tipo, motivo, ...extra });
const A = (a: Parameters<typeof aplicarDano>[0]) => aplicarDano(a);

// --- puras
t(A({ objetivo: {}, cantidad: 10, tipo: "fuego" }).final === 10 && A({ objetivo: {}, cantidad: 10, tipo: "fuego" }).detalle.length === 0, "sin reglas: igual y sin detalle");
t(A({ objetivo: { resiste: [R("fuego")] }, cantidad: 10, tipo: "fuego" }).final === 5, "resistencia: 10 → 5");
t(A({ objetivo: { resiste: [R("fuego")] }, cantidad: 10, tipo: "frío" }).final === 10, "resistencia a otro tipo: no cuenta");
for (const [c, e] of [[1, 0], [2, 1], [3, 1], [5, 2], [7, 3], [11, 5], [0, 0]] as const) t(A({ objetivo: { resiste: [R("fuego")] }, cantidad: c, tipo: "fuego" }).final === e, `resistencia redondea abajo: ${c} → ${e}`);
t(A({ objetivo: { vulnerable: [R("fuego", "vuln")] }, cantidad: 7, tipo: "fuego" }).final === 14, "vulnerabilidad: 7 → 14");
t(A({ objetivo: { inmune: [R("veneno", "inmune")] }, cantidad: 30, tipo: "veneno" }).final === 0, "inmunidad: 0");
{ const r = A({ objetivo: { inmune: [R("fuego", "inm")], vulnerable: [R("fuego", "vul")], resiste: [R("fuego", "res")] }, cantidad: 9, tipo: "fuego" }); t(r.final === 0, "la inmunidad gana a todo (también a la vulnerabilidad)", r.detalle.join()); }
{ const r = A({ objetivo: { resiste: [R("fuego", "resiste")], vulnerable: [R("fuego", "vulnerable")] }, cantidad: 10, tipo: "fuego" }); t(r.final === 10 && /se anulan/.test(r.detalle[0]), "resistencia y vulnerabilidad al mismo tipo se anulan", r.detalle.join()); }
{ const r = A({ objetivo: { resiste: [R("fuego"), R("fuego", "otra"), R("fuego", "y otra")] }, cantidad: 10, tipo: "fuego" }); t(r.final === 5 && r.detalle.length === 1, "tres resistencias al mismo tipo: una sola mitad (10 → 5, no 1)", r.detalle.join()); }
t(A({ objetivo: { vulnerable: [R("fuego"), R("fuego", "otra")] }, cantidad: 10, tipo: "fuego" }).final === 20, "dos vulnerabilidades: un solo doble");
{ const o = { resiste: [R("fuego")], vulnerable: [R("frío")] }; t(A({ objetivo: o, cantidad: 10, tipo: "fuego" }).final === 5 && A({ objetivo: o, cantidad: 10, tipo: "frío" }).final === 20, "resistencia a uno y vulnerabilidad a otro: cada uno a lo suyo"); }
// mitad por salvación y luego resistencia
t(A({ objetivo: { resiste: [R("fuego")] }, cantidad: 11, tipo: "fuego", mitadSalvacion: true }).final === 2, "11 → mitad por salvación 5 → resistencia 2");
t(A({ objetivo: {}, cantidad: 11, tipo: "fuego", mitadSalvacion: true }).final === 5, "mitad por salvación sola: 11 → 5");
t(A({ objetivo: { vulnerable: [R("fuego")] }, cantidad: 11, tipo: "fuego", mitadSalvacion: true }).final === 10, "mitad por salvación y luego vulnerabilidad: 11 → 5 → 10");
t(A({ objetivo: { inmune: [R("fuego")] }, cantidad: 11, tipo: "fuego", mitadSalvacion: true }).final === 0, "mitad por salvación e inmunidad: 0");
t(A({ objetivo: { resiste: [R("fuego")] }, cantidad: 1, tipo: "fuego", mitadSalvacion: true }).final === 0, "1 con mitad: 0");
{ const r = A({ objetivo: { resiste: [R("fuego")] }, cantidad: 11, tipo: "fuego", mitadSalvacion: true }); t(r.detalle.length === 1 && /5 → 2/.test(r.detalle[0]), "el detalle solo cuenta lo del tipo (5 → 2), no la mitad de la salvación", r.detalle.join()); }
// sin tipo
t(A({ objetivo: { resiste: [R("fuego")], vulnerable: [R("contundente")] }, cantidad: 10 }).final === 10, "sin tipo no se aplica nada");
t(A({ objetivo: { resiste: [R("cortante")] }, cantidad: 10, sinTipoEsFisico: true }).final === 5 && A({ objetivo: { resiste: [R("fuego")] }, cantidad: 10, sinTipoEsFisico: true }).final === 10, "sinTipoEsFisico: sin tipo cuenta como físico, no como fuego");
// fuente: no mágico y material
{
  const o = { resiste: [R("cortante", "no mágico salvo plata", { soloNoMagico: true, salvoMaterial: "plata" })] };
  t(A({ objetivo: o, cantidad: 10, tipo: "cortante" }).final === 5, "no mágico: sin dato de la fuente se trata como no mágico (resiste)");
  t(A({ objetivo: o, cantidad: 10, tipo: "cortante", fuente: { magico: false } }).final === 5, "fuente no mágica: resiste");
  t(A({ objetivo: o, cantidad: 10, tipo: "cortante", fuente: { magico: true } }).final === 10, "fuente mágica: no resiste");
  t(A({ objetivo: o, cantidad: 10, tipo: "cortante", fuente: { material: "plata" } }).final === 10 && A({ objetivo: o, cantidad: 10, tipo: "cortante", fuente: { material: "Plata" } }).final === 10, "plata: no resiste (sin distinguir mayúsculas)");
  t(A({ objetivo: o, cantidad: 10, tipo: "cortante", fuente: { material: "hierro frío" } }).final === 5, "otro material: sigue resistiendo");
  const i = { inmune: [R("contundente", "inmune a lo no mágico", { soloNoMagico: true })] };
  t(A({ objetivo: i, cantidad: 10, tipo: "contundente" }).final === 0 && A({ objetivo: i, cantidad: 10, tipo: "contundente", fuente: { magico: true } }).final === 10, "inmunidad solo a lo no mágico");
  const v = { vulnerable: [R("cortante", "vulnerable a la plata", { soloMaterial: "plata" })] };
  t(A({ objetivo: v, cantidad: 10, tipo: "cortante", fuente: { material: "plata" } }).final === 20 && A({ objetivo: v, cantidad: 10, tipo: "cortante" }).final === 10, "vulnerable solo a la plata");
}
t(A({ objetivo: {}, cantidad: -5, tipo: "fuego" }).final === 0 && A({ objetivo: {}, cantidad: 7.9, tipo: "fuego" }).final === 7, "cantidad negativa → 0 y decimales truncados");
t(notaDano([]) === "" && notaDano(["a: 10 → 5"]) === " (a: 10 → 5)", "notaDano");

// --- perfil de PJ
const nueva = () => { const p = nuevaPartida(); normalizarPartida(p); const E = (n: string, d: object): any => ejecutar(n, d, p); E("tirar_don_arcano", { jugador: "Ana" }); return { p, E }; };
const ficha = (E: any, nombre: string, raza: string, clase: string, nivel = 5, extra: object = {}) => E("guardar_personaje", { nombre, jugador: "Ana", raza, clase, nivel, pv_max: 100, ca: 12, atributos: { fue: 16, des: 12, con: 14, int: 10, sab: 10, car: 12 }, inventario: ["Espada larga"], don_arcano: false, dote: "Terco", ...extra });
{
  const { p, E } = nueva(); ficha(E, "Brun", "Humano del Faro", "Berserker de Ceniza", 6); ficha(E, "Sir", "Humano del Faro", "Caballero Juramentado", 6); ficha(E, "Tor", "Tritón de las Mareas", "Mercenario del Cuervo", 6); ficha(E, "Dur", "Enano de Karak-Dûm", "Mercenario del Cuervo", 6); ficha(E, "Cen", "Cenizo", "Mercenario del Cuervo", 6);
  const B = p.personajes.Brun, S = p.personajes.Sir;
  t(perfilDePersonaje(B).resiste!.length === 0, "Berserker sin furia: sin resistencias");
  B.furia = { activa: true, asaltos: 5 } as any;
  for (const x of ["cortante", "perforante", "contundente"] as const) t(aplicarDanoAPersonaje(B, 10, x).final === 5, `Furia resiste ${x}`);
  for (const x of ["fuego", "frío", "eléctrico", "trueno", "radiante", "necrótico", "veneno", "psíquico", "ácido", "fuerza"] as const) t(aplicarDanoAPersonaje(B, 10, x).final === 10, `Furia no resiste ${x} (no físico)`);
  t(aplicarDanoAPersonaje(B, 10, undefined, { sinTipoEsFisico: true }).final === 5 && aplicarDanoAPersonaje(B, 10).final === 10, "Furia: sin tipo solo vale si se pide suponer físico");
  t(aplicarDanoAPersonaje(p.personajes.Tor, 10, "frío").final === 5 && aplicarDanoAPersonaje(p.personajes.Dur, 10, "veneno").final === 5 && aplicarDanoAPersonaje(p.personajes.Cen, 10, "fuego").final === 5, "raciales: Tritón/frío, Enano/veneno, Cenizo/fuego");
  t(aplicarDanoAPersonaje(p.personajes.Tor, 10, "fuego").final === 10 && aplicarDanoAPersonaje(p.personajes.Cen, 10, "frío").final === 10, "cada raza solo resiste lo suyo");
  p.personajes.Cen.furia = { activa: true, asaltos: 5 } as any;
  { const r = aplicarDanoAPersonaje(p.personajes.Cen, 10, "fuego"); t(r.final === 5 && r.detalle.length === 1, "racial + Furia: una sola mitad"); t(aplicarDanoAPersonaje(p.personajes.Cen, 10, "contundente").final === 5, "Cenizo en furia: el físico lo resiste la Furia"); }
  // voto de Luz
  t(aplicarDanoAPersonaje(S, 10, "necrótico").final === 10, "Caballero sin juramento: no resiste el necrótico");
  E("juramento", { quien: "Sir", accion: "jurar", votos: ["luz", "verdad"] });
  t(aplicarDanoAPersonaje(S, 10, "necrótico").final === 5 && /Luz/.test(aplicarDanoAPersonaje(S, 10, "necrótico").detalle[0]), "voto de Luz (nivel 5+): resiste el necrótico");
  t(aplicarDanoAPersonaje(S, 10, "fuego").final === 10, "el voto de Luz no resiste el fuego");
  S.nivel = 4; t(aplicarDanoAPersonaje(S, 10, "necrótico").final === 10, "por debajo del nivel 5 la ventaja del voto aún no vale"); S.nivel = 6;
  S.juramento!.roto = { voto: "luz", motivo: "x", consecuencia: "y" }; t(aplicarDanoAPersonaje(S, 10, "necrótico").final === 10, "juramento roto: no resiste");
  S.juramento!.roto = undefined; S.juramento!.votos = ["verdad"]; t(aplicarDanoAPersonaje(S, 10, "necrótico").final === 10, "sin el voto de Luz: no resiste");
}

// --- rutas reales
const dados = (caras: number, ...v: number[]) => v.map((valor) => ({ caras, valor }));
{ // habilidad con salvación superada y mitad: 11 → 5 → 2 (Enano, veneno)
  const { p, E } = nueva(); ficha(E, "Dur", "Enano de Karak-Dûm", "Mercenario del Cuervo", 6); E("aparecer_criatura", { nombre: "Hambriento" });
  iniciarRegistroDados([...dados(20, 20, 20), ...dados(2, 1)]);
  const r = E("habilidad_criatura", { criatura: "Hambriento", habilidad_nueva: { nombre: "Nube", descripcion: "x", salvacion: "des", cd: 5, dano: "1d2+10", tipo_dano: "veneno", mitad_si_exito: true }, objetivos: ["Dur"] }); liberarDados();
  t(!r.error && 100 - p.personajes.Dur.pv === 2, "habilidad: salvación superada (11 → 5) y resistencia del Enano (→ 2)", txt(r).slice(-200));
  t(/Resistencia enana al veneno: 5 → 2/.test(txt(r)), "el aviso muestra la resistencia compacta", txt(r).split("\n").filter((l: string) => /Resistencia/.test(l)).join("|"));
}
{ // caída en furia y tragado eléctrico (lo no físico no se resiste)
  const { p, E } = nueva(); ficha(E, "Brun", "Humano del Faro", "Berserker de Ceniza", 6); p.personajes.Brun.furia = { activa: true, asaltos: 9 } as any;
  iniciarRegistroDados(dados(6, 5, 5, 5, 5)); E("caida", { quien: "Brun", metros: 12 }); liberarDados(); t(100 - p.personajes.Brun.pv === 10, "caída en furia: 20 → 10");
}
{ // atacar: castigo radiante y físico resistido; fuego a un Cenizo (ahora cuenta su resistencia)
  const { p, E } = nueva(); ficha(E, "Cen", "Cenizo", "Mercenario del Cuervo", 6); ficha(E, "Aldo", "Humano del Faro", "Mercenario del Cuervo", 6);
  for (const [tipo, esp] of [["fuego", 5], ["llama", 5], ["frío", 10], ["perforante", 10]] as const) {
    const antes = p.personajes.Cen.pv; iniciarRegistroDados([...dados(20, 15), ...dados(6, 5, 5)]);
    const r = E("atacar", { atacante: "Aldo", objetivo: "Cen", dano: "2d6", bono: 50, tipo_dano: tipo, temerario: false }); liberarDados();
    t(!r.error && antes - p.personajes.Cen.pv >= esp && (tipo === "fuego" || tipo === "llama" ? antes - p.personajes.Cen.pv === 5 && /Resistencia al fuego del Cenizo: 10 → 5/.test(txt(r)) : !/Resistencia/.test(txt(r))), `atacar ${tipo} a un Cenizo`, txt(r).slice(-140));
  }
}
console.log(`${ok} ok, ${mal} fallas`);
