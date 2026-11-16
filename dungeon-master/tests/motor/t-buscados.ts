// Tablero de buscados de la Llama Gris (src/buscados.ts): catálogo, flujo aceptar → pista → entregar, pago como sugerencia, reputación,
// plazos, carteles de la trama, partidas antiguas, exportar/importar, tamaño acotado y que no engorda el prompt fijo. Dados fijos.
import { nuevaPartida, normalizarPartida, type Partida } from "../../src/estado.ts";
import { ejecutar } from "../../src/herramientas.ts";
import { BESTIARIO, buscarCriatura } from "../../src/bestiario.ts";
import { REGIONES } from "../../src/mapa.ts";
import { TEMAS, todosLosTemas } from "../../src/saber.ts";
import { TABLA } from "../../src/encuentros.ts";
import { VETERANIAS } from "../../src/combate.ts";
import { estadoParaDM } from "../../src/navegador.ts";
import { sistemaWeb, consultarReglas, catalogoCompacto } from "../../src/prompt-web.ts";
import { iniciarRegistroDados, liberarDados } from "../../src/dados.ts";
import {
  BANDA_VIVA, BUSCADOS, DELITOS, FRACCION_MUERTO, MAX_CONTRATOS, MAX_GENERADOS, MAX_PROPIOS, RANGOS_LLAMA, generarBuscado, lineaBuscados, rangoLlama, vistaTablon,
  buscadosVacio, normalizarBuscados,
} from "../../src/buscados.ts";
let ok = 0, mal = 0; const t = (c: boolean, m: string, x = "") => { console.log(c ? "ok   " : "FALLA", m, x); c ? ok++ : mal++; };
const d = (caras: number, ...v: number[]) => v.map((valor) => ({ caras, valor }));
const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

function mk(extra: { clase?: string } = {}) {
  const p = nuevaPartida(); normalizarPartida(p); const E = (n: string, x: object): any => ejecutar(n, x, p);
  const ficha = (nombre: string, e: object = {}) => E("guardar_personaje", { don_arcano: false, nombre, jugador: nombre, raza: "Humano del Faro", clase: "Mercenario del Cuervo", nivel: 5, pv_max: 90, ca: 12, atributos: { fue: 16, des: 14, con: 14, int: 12, sab: 14, car: 10 }, inventario: ["Espada larga"], ...e });
  ficha("Aldo", extra.clase ? { clase: extra.clase } : {}); ficha("Brisa");
  E("ubicacion", { lugar: "Casa de Registros", region: "Aldenmar", tipo: "ciudad" });
  return { p, E, B: (x: object): any => E("buscados", x) };
}
const txt = (r: any) => (typeof r === "string" ? r : r?.contenido ?? "");

// ---- 1. catálogo
{
  const ids = BUSCADOS.map((x) => x.id);
  t(BUSCADOS.length >= 14 && BUSCADOS.length <= 18, "entre 14 y 18 buscados fijos", String(BUSCADOS.length));
  t(new Set(ids).size === ids.length, "ids únicos");
  const regiones = new Set(REGIONES.map((r) => r.nombre));
  t(BUSCADOS.every((x) => regiones.has(x.region)), "todas las regiones existen en el mapa");
  t(REGIONES.every((r) => BUSCADOS.some((x) => x.region === r.nombre)), "cada región tiene al menos un cartel");
  t(BUSCADOS.every((x) => x.lugar.length > 3 && x.descripcion.length > 20), "lugar y descripción pública");
  t(BUSCADOS.every((x) => !x.perfil.criatura || !!buscarCriatura(x.perfil.criatura)), "criaturas enlazadas existen en el bestiario", BUSCADOS.filter((x) => x.perfil.criatura && !buscarCriatura(x.perfil.criatura)).map((x) => x.id).join());
  t(BUSCADOS.every((x) => !x.perfil.escolta || BESTIARIO.some((c) => norm(x.perfil.escolta!).includes(norm(c.nombre).slice(0, 4)))), "toda escolta nombra una criatura del bestiario", BUSCADOS.filter((x) => x.perfil.escolta).map((x) => x.perfil.escolta).join("|"));
  t(BUSCADOS.every((x) => x.perfil.pnj ? (VETERANIAS as readonly string[]).includes(x.perfil.pnj.veterania) && x.perfil.pnj.pv > 0 : !!x.perfil.criatura), "perfil: PNJ con veteranía válida o criatura");
  t([1, 2, 3, 4, 5].every((n) => BUSCADOS.some((x) => x.peligro === n)), "hay carteles de peligro 1 a 5");
  t(Object.keys(DELITOS).every((k) => BUSCADOS.some((x) => x.delito === k)), "los 7 delitos aparecen");
  t(BUSCADOS.every((x) => x.muerta === null || (x.muerta <= x.viva && x.muerta >= Math.ceil(x.viva / 2))), "viva ≥ muerta ≥ la mitad de la viva");
  t(BUSCADOS.some((x) => x.muerta === null) && BUSCADOS.some((x) => x.muerta !== null), "hay «solo vivo» y los hay con precio de muerto");
  t(BUSCADOS.every((x) => x.viva >= BANDA_VIVA[x.peligro][0] && x.viva <= BANDA_VIVA[x.peligro][1]), "cada recompensa cae en la banda de su peligro", BUSCADOS.filter((x) => x.viva < BANDA_VIVA[x.peligro][0] || x.viva > BANDA_VIVA[x.peligro][1]).map((x) => x.id).join());
  const bandas = ([1, 2, 3, 4] as const).every((n) => BANDA_VIVA[n][1] < BANDA_VIVA[(n + 1) as 2][0]);
  const maxP = (n: number) => Math.max(...BUSCADOS.filter((x) => x.peligro === n).map((x) => x.viva)), minP = (n: number) => Math.min(...BUSCADOS.filter((x) => x.peligro === n).map((x) => x.viva));
  t(bandas && [1, 2, 3, 4].every((n) => maxP(n) < minP(n + 1)), "recompensas monótonas por peligro (las bandas no se solapan)");
  t(BUSCADOS.every((x) => x.pistas.length >= 1 && x.pistas.length <= 3 && x.pistas.every((y) => y.capa === "rumor" || y.capa === "erudito")), "pistas: 1-3 y solo capas rumor y erudito");
  // ninguna capa restringida ni secreta se cuela en cartel, pistas ni emisor
  const prohibido = todosLosTemas().flatMap((x) => [x.restringido, x.secreto]).filter(Boolean).map((s) => norm(s!));
  const delata = TEMAS.map((x) => x.delata).filter(Boolean) as RegExp[];
  const textos = BUSCADOS.map((x) => ({ id: x.id, t: [x.descripcion, x.lugar, ...x.pistas.map((y) => y.texto), x.emisor.oficial, x.emisor.rango].join(" ") }));
  const copia = (a: string) => { for (let i = 0; i + 28 <= a.length; i += 7) if (prohibido.some((s) => s.includes(a.slice(i, i + 28)))) return true; return false; };
  t(textos.every((x) => !copia(norm(x.t)) && !delata.some((r) => r.test(x.t)) && !/dracone|vaskar|aesir|æsir|primus|kashi|falange|hijo de ka/i.test(norm(x.t))), "ninguna capa restringida ni secreta (ni su delator) en los carteles", textos.filter((x) => copia(norm(x.t))).map((x) => x.id).join());
  t(BUSCADOS.every((x) => /sello/.test(x.emisor.sello) && x.emisor.oficial && x.emisor.rango), "cada cartel lleva sello, oficial y rango");
  t(BUSCADOS.every((x) => x.plazo === null || (x.plazo >= 10 && x.plazo <= 90)), "plazos razonables");
  t(RANGOS_LLAMA.every((r, i) => i === 0 || (r.min > RANGOS_LLAMA[i - 1].min && r.maxPeligro >= RANGOS_LLAMA[i - 1].maxPeligro && r.plus >= RANGOS_LLAMA[i - 1].plus)), "rangos: puntos, peligro y plus crecientes");
  t(TABLA.some((e) => e.id === "tablon" && e.tipo === "hallazgo" && e.peligro === 1), "hay encuentro «tablón de buscados» (hallazgo, peligro 1)");
}

// ---- 2. generador determinista y acotado
{
  const g = () => { iniciarRegistroDados([...d(16, 3, 7, 2, 5, 11, 4), ...d(12, 5, 8, 2, 9, 1, 7), ...d(100, 50, 60), ...d(5, 2, 3, 4, 1), ...d(4, 3, 2, 1, 4), ...d(3, 1, 2, 3), ...d(2, 1, 2, 1, 2), ...d(6, 3, 4)]); const x = generarBuscado("Aldenmar", 3, "G01"); liberarDados(); return JSON.stringify(x); };
  const a = g(), b = g();
  t(a === b, "con dados fijos el generador da el mismo cartel", a.slice(0, 80));
  const x = JSON.parse(a);
  t(x.region === "Aldenmar" && x.peligro === 3 && x.viva >= 250 && x.viva <= 400 && (x.muerta === null || x.muerta >= Math.ceil(x.viva / 2)) && x.id === "G01", "región, peligro, banda y mitad mínima", `${x.viva}/${x.muerta}`);
  let todoBien = true;
  for (const r of REGIONES) for (const pe of [1, 2, 3, 4, 5]) { const y = generarBuscado(r.nombre, pe, "G99"); if (y.peligro !== pe || y.viva < BANDA_VIVA[pe as 1][0] || y.viva > BANDA_VIVA[pe as 1][1] || !(y.muerta === null || y.muerta >= Math.ceil(y.viva / 2)) || !Object.keys(DELITOS).includes(y.delito) || y.pistas.length !== 3 || y.region !== r.nombre) todoBien = false; }
  t(todoBien, "30 generados (6 regiones × 5 peligros) válidos");
  t(generarBuscado("Narnia", 9, "G98").region === "Aldenmar" && generarBuscado("Aldenmar", 9, "G98").peligro === 5, "región desconocida → Aldenmar y peligro acotado a 5");
}

// ---- 3. flujo completo: ver, detalle, aceptar, pista, entregar (vivo)
{
  const m = mk();
  const oro0 = m.p.personajes.Aldo.oro;
  const v = m.B({ accion: "ver" });
  t(!v.error && /B02/.test(txt(v)) && /B15/.test(txt(v)) && !/B01 /.test(txt(v)), "ver: los de Aldenmar y las circulares de peligro 4-5, no los de otra región de peligro bajo", txt(v).slice(0, 200));
  t(/B12/.test(txt(v)) && /B14/.test(txt(v)), "las circulares de peligro 4 de otras regiones también salen");
  t(!!v.aviso && /📜/.test(v.aviso) && !/OCULTO/.test(v.aviso), "ver: los jugadores ven el tablón");
  const dt = m.B({ accion: "detalle", id: "B02" });
  t(/Hambrientos/.test(txt(dt)) && /ataque \+3/.test(txt(dt)) && /Pistas \(0\/3\)/.test(txt(dt)), "detalle (DM): perfil de combate, escolta y pistas", txt(dt).slice(0, 80));
  t(!!dt.aviso && !/ataque \+3/.test(dt.aviso) && !/Rumor|rumor/.test(dt.aviso), "detalle: lo que ven los jugadores no lleva perfil ni pistas sin revelar");
  const sin = m.B({ accion: "entregar", id: "B02", estado: "vivo" });
  t(!!sin.error && /acéptalo primero/.test(txt(sin)), "entregar sin contrato: error");
  const ac = m.B({ accion: "aceptar", id: "B02", quien: "Aldo" });
  t(!ac.error && /hasta el día 16/.test(txt(ac)) && m.p.buscados!.estados.B02 === "tomado", "aceptar: plazo y estado «tomado»", txt(ac).slice(0, 100));
  const otra = m.B({ accion: "aceptar", id: "B02", quien: "Brisa" });
  t(!!otra.error && /no está disponible/.test(txt(otra)), "otro no puede aceptar un cartel ya tomado");
  iniciarRegistroDados(d(20, 20));
  const p1 = m.B({ accion: "pista", id: "B02", quien: "Aldo" });
  liberarDados();
  t(!p1.error && /Pista 1\/3/.test(txt(p1)) && /Rumor de taberna/.test(txt(p1)) && m.p.buscados!.pistas.B02 === 1, "pista: éxito entrega la primera (rumor) y la cuenta", txt(p1).slice(0, 160));
  iniciarRegistroDados(d(20, 1));
  const f1 = m.B({ accion: "pista", id: "B02", quien: "Aldo" });
  liberarDados();
  t(!f1.error && /Fallo/.test(txt(f1)) && m.p.buscados!.pistas.B02 === 1, "pista: un fallo no revela nada ni gasta la pista", txt(f1).slice(-100));
  iniciarRegistroDados(d(20, 20, 20, 20));
  m.B({ accion: "pista", id: "B02", quien: "Aldo" }); const p3 = m.B({ accion: "pista", id: "B02", quien: "Aldo" }); const p4 = m.B({ accion: "pista", id: "B02", quien: "Aldo" });
  liberarDados();
  t(/Archivos de la Casa de Registros/.test(txt(p3)) && /no quedan más pistas/.test(txt(p4)), "la tercera es de archivo (erudito) y luego no quedan", txt(p3).slice(0, 60));
  const ent = m.B({ accion: "entregar", id: "B02", estado: "vivo" });
  t(!ent.error && /Pago: 50 po/.test(txt(ent)) && /oro_cambio: 50/.test(txt(ent)), "entregar vivo: paga la recompensa viva como SUGERENCIA (oro_cambio)", txt(ent).slice(0, 160));
  t(m.p.botinPendiente?.oro === 50 && m.p.personajes.Aldo.oro === oro0 && m.p.personajes.Brisa.oro === oro0, "el pago queda en botinPendiente y NO toca las fichas");
  t(m.p.buscados!.rep === 2 && m.p.buscados!.estados.B02 === "entregado" && !m.p.buscados!.contratos.B02, "reputación +2, cartel «entregado», contrato cerrado");
  const again = m.B({ accion: "aceptar", id: "B02", quien: "Aldo" });
  t(!!again.error, "un cartel entregado no se puede volver a aceptar");
  const v2 = m.B({ accion: "ver" });
  t(!/B02 /.test(txt(v2)), "y sale del tablón");
}

// ---- 4. entregar muerto, solo vivo, equivocado, sin pruebas
{
  const m = mk();
  m.B({ accion: "aceptar", id: "B03", quien: "Aldo" });
  const sp = m.B({ accion: "entregar", id: "B03", estado: "muerto" });
  t(!sp.error && /Sin pruebas no hay pago/.test(txt(sp)) && !m.p.botinPendiente && !!m.p.buscados!.contratos.B03, "muerto sin pruebas: no se paga y el contrato sigue");
  const mu = m.B({ accion: "entregar", id: "B03", estado: "muerto", datos: { pruebas: "su sello" } });
  t(/Pago: 30 po/.test(txt(mu)) && m.p.botinPendiente?.oro === 30 && m.p.buscados!.rep === 1, "muerto con pruebas: paga la reducida (+1 de reputación)", txt(mu).slice(0, 120));
  m.B({ accion: "aceptar", id: "B06", quien: "Aldo" });
  const sv = m.B({ accion: "entregar", id: "B06", estado: "muerto", datos: { pruebas: "el cuerpo" } });
  t(/solo se pagan los gastos/.test(txt(sv)) && /Pago: 15 po/.test(txt(sv)) && m.p.buscados!.rep === -1 && m.p.botinPendiente?.oro === 45, "«solo vivo» entregado muerto: pago mínimo (10 %) y −2 de reputación", txt(sv).slice(0, 140));
  m.B({ accion: "aceptar", id: "B04", quien: "Brisa" });
  const eq = m.B({ accion: "entregar", id: "B04", estado: "vivo", datos: { equivocado: true } });
  t(/Falta grave/.test(txt(eq)) && /Sin pago/.test(txt(eq)) && m.p.botinPendiente?.oro === 45 && m.p.buscados!.rep === -5 && m.p.buscados!.estados.B04 === "activo", "entregar al equivocado: sin pago, falta grave (−4) y el cartel sigue activo", txt(eq).slice(0, 100));
  t(rangoLlama(m.p.buscados!.rep).nombre === "Sospechoso", "con −5 la mesa es «Sospechoso»");
  const peli = m.B({ accion: "aceptar", id: "B04", quien: "Aldo" });
  t(!!peli.error && /peligro 1 o menos/.test(txt(peli)), "un sospechoso solo acepta contratos de peligro 1", txt(peli).slice(0, 100));
}

// ---- 5. reputación: sube, desbloquea y da plus
{
  const m = mk();
  const bloq = m.B({ accion: "aceptar", id: "B07", quien: "Aldo" });
  t(!!bloq.error && /peligro 2 o menos/.test(txt(bloq)), "sin licencia no se aceptan contratos de peligro 3");
  m.p.buscados!.rep = 3;
  t(!m.B({ accion: "aceptar", id: "B07", quien: "Aldo" }).error, "con 3 puntos (Aspirante) sí");
  t(!!m.B({ accion: "aceptar", id: "B12", quien: "Brisa" }).error, "pero no el de peligro 4");
  m.p.buscados!.rep = 8;
  t(!m.B({ accion: "aceptar", id: "B12", quien: "Brisa" }).error, "con 8 (Cazador licenciado) el de peligro 4");
  t(!!m.B({ accion: "aceptar", id: "B15", quien: "Brisa" }).error, "y el 5 aún no");
  const r8 = m.B({ accion: "entregar", id: "B12", estado: "vivo", quien: "Brisa" });
  t(/Pago: 825 po/.test(txt(r8)) && /\+10%/.test(txt(r8)) && m.p.botinPendiente?.oro === 825, "Cazador licenciado: +10 % (750 → 825)", txt(r8).slice(0, 100));
  m.p.buscados!.rep = 16;
  t(!m.B({ accion: "aceptar", id: "B15", quien: "Brisa" }).error, "con 16 (Cazador de la Llama) el de peligro 5");
  const r16 = m.B({ accion: "entregar", id: "B15", estado: "vivo" });
  t(/Pago: 1920 po/.test(txt(r16)) && /\+20%/.test(txt(r16)), "Cazador de la Llama: +20 % (1600 → 1920)", txt(r16).slice(0, 100));
  t(m.p.buscados!.rep === 18 && rangoLlama(30).nombre === "Cazador de la Llama" && rangoLlama(-10).nombre === "Sospechoso", "la reputación sube con cada entrega limpia");
  m.p.buscados!.rep = 29; m.p.buscados!.estados.B03 = "activo"; m.B({ accion: "aceptar", id: "B03", quien: "Aldo" }); m.B({ accion: "entregar", id: "B03", estado: "vivo" });
  t(m.p.buscados!.rep === 30, "tope de reputación 30");
}

// ---- 6. plazo vencido, abandonar, capturar, retirar, límite de contratos
{
  const m = mk();
  m.B({ accion: "aceptar", id: "B01", quien: "Aldo" }); // plazo 20 días: vence el día 21
  m.p.buscados!.contratos.B01.vence = 0; // el día 1 ya es posterior (avanzar 22 días mataría de sed al grupo de prueba)
  const v = m.B({ accion: "ver" });
  t(/Venció el plazo del contrato B01/.test(txt(v)) && m.p.buscados!.rep === -1 && m.p.buscados!.estados.B01 === "activo" && !m.p.buscados!.contratos.B01, "plazo vencido (día 1 > día 0): el contrato fracasa (−1) y el cartel vuelve a estar activo", txt(v).slice(0, 120));
  m.p.buscados!.rep = 0;
  m.B({ accion: "aceptar", id: "B02", quien: "Aldo" });
  const cap = m.B({ accion: "capturar", id: "B02" });
  t(m.p.buscados!.estados.B02 === "capturado" && /custodia/.test(txt(cap)), "capturar: «capturado»");
  t(/capturado/.test(estadoParaDM(m.p)), "y el estado del DM lo refleja");
  const ab = m.B({ accion: "abandonar", id: "B02" });
  t(/sin pago ni castigo/.test(txt(ab)) && m.p.buscados!.estados.B02 === "activo" && m.p.buscados!.rep === 0, "abandonar: sin castigo y vuelve al tablón");
  m.p.buscados!.rep = 16;
  const idsOk = ["B02", "B03", "B04", "B07", "B11"];
  for (const id of idsOk) m.B({ accion: "aceptar", id, quien: "Aldo" });
  const sexto = m.B({ accion: "aceptar", id: "B05", quien: "Aldo" });
  t(Object.keys(m.p.buscados!.contratos).length === MAX_CONTRATOS && !!sexto.error && /contratos en curso/.test(txt(sexto)), "límite de contratos simultáneos", String(MAX_CONTRATOS));
  const ret = m.B({ accion: "retirar", id: "B02" });
  t(m.p.buscados!.estados.B02 === "prescrito" && !m.p.buscados!.contratos.B02 && !/B02 /.test(txt(m.B({ accion: "ver" }))), "retirar: prescrito, cierra el contrato y sale del tablón", txt(ret).slice(0, 60));
  t(!!m.B({ accion: "aceptar", id: "B99", quien: "Aldo" }).error && !!m.B({ accion: "aceptar", id: "B03", quien: "Fantasma" }).error && !!m.B({ accion: "aceptar", id: "B03" }).error, "ids y personajes inexistentes dan error legible");
  m.p.personajes.Brisa.condiciones.push("muerto");
  t(!!m.B({ accion: "aceptar", id: "B05", quien: "Brisa" }).error, "un muerto no lleva contratos");
}

// ---- 7. cartel de la trama: personaje del grupo, visible o no
{
  const m = mk();
  const base = { nombre: "Brisa", alias: "la Rubia", delito: "desercion", descripcion: "Mercenaria de pelo rubio y una espada corta.", viva: 300, firma: "Marsh", rango_firma: "guardia de la Llama Gris", plazo: 30, pista_rumor: "Se la vio en el puerto." };
  const sinV = m.B({ accion: "cartel", datos: base });
  t(!!sinV.error && /decide tú/.test(txt(sinV)) && !m.p.buscados!.propios.length, "un PJ en un cartel exige que el DM decida «visible»", txt(sinV).slice(0, 100));
  const oc = m.B({ accion: "cartel", datos: { ...base, visible: false } });
  t(!oc.error && /OCULTO/.test(txt(oc)) && oc.aviso === null, "oculto: el DM lo sabe y los jugadores no reciben aviso", txt(oc).slice(0, 100));
  t(vistaTablon(m.p)!.carteles.every((c) => c.id !== "P01"), "el panel de jugadores no lo muestra");
  t(!/P01/.test(m.B({ accion: "ver" }).aviso ?? "") && /P01.*OCULTO/.test(txt(m.B({ accion: "ver" }))), "ver: solo el DM lo ve, marcado como oculto");
  t(!!m.B({ accion: "aceptar", id: "P01", quien: "Aldo" }).error, "oculto no se puede aceptar");
  const mo = m.B({ accion: "cartel", id: "P01", datos: { visible: true } });
  t(!mo.error && /VISIBLE/.test(txt(mo)) && !!mo.aviso, "el DM lo publica con cartel {id, visible: true}");
  const c = vistaTablon(m.p)!.carteles.find((x) => x.id === "P01");
  t(!!c && c.nombre === "Brisa" && c.viva === 300 && c.muerta === 180 && /Marsh/.test(c.firma) && c.plazo === 30 && c.pistas.length === 0, "ahora el panel lo muestra con firma, recompensas y sin pistas reveladas", JSON.stringify(c)?.slice(0, 120));
  const own = m.B({ accion: "aceptar", id: "P01", quien: "Aldo" });
  t(!!own.error && /es del grupo/.test(txt(own)), "los compañeros no pueden cobrar su propia cabeza");
  t(!!m.B({ accion: "cartel", id: "B01", datos: { visible: false } }).error, "solo se edita el visible de los carteles propios");
  const nv = m.B({ accion: "cartel", datos: { nombre: "Orrin Voss", delito: "brujeria", descripcion: "Un hombre.", viva: 200, solo_vivo: true, firma: "Marsh" } });
  t(!nv.error && /P02/.test(txt(nv)) && m.p.buscados!.propios[1].muerta === null && m.p.buscados!.propios[1].visible === true, "un cartel de un PNJ es visible por defecto; solo_vivo", txt(nv).slice(0, 80));
  const mal1 = m.B({ accion: "cartel", datos: { nombre: "X", delito: "robo", descripcion: "x", viva: 10, firma: "Y" } });
  t(!!mal1.error && /delito/.test(txt(mal1)), "delito fuera de la ley de la Llama: error legible", txt(mal1).slice(0, 100));
  t(!!m.B({ accion: "cartel", datos: { nombre: "Z", delito: "herejia", descripcion: "x", viva: 100, muerta: 10, firma: "Y" } }).error, "la recompensa por el muerto no baja de la mitad");
  t(!!m.B({ accion: "cartel", datos: { nombre: "Z", delito: "herejia", descripcion: "x", viva: 100 } }).error, "sin firma: error");
  // el cartel de un PNJ se cobra con todo el flujo
  m.p.buscados!.rep = 0;
  m.B({ accion: "aceptar", id: "P02", quien: "Aldo" });
  const cp = m.B({ accion: "entregar", id: "P02", estado: "vivo" });
  t(/Pago: 200 po/.test(txt(cp)) && m.p.botinPendiente?.oro === 200, "cobrar un cartel propio: pago sugerido", txt(cp).slice(0, 100));
  // límite de carteles propios
  const n = mk();
  let ultimo: any;
  for (let i = 0; i < MAX_PROPIOS + 2; i++) ultimo = n.B({ accion: "cartel", datos: { nombre: `Buscado ${i}`, delito: "herejia", descripcion: "x", viva: 100, firma: "Marsh" } });
  t(n.p.buscados!.propios.length === MAX_PROPIOS && !!ultimo.error && /retira alguno/.test(txt(ultimo)), "límite de carteles propios", String(MAX_PROPIOS));
  n.B({ accion: "retirar", id: "P03" });
  t(!n.B({ accion: "cartel", datos: { nombre: "Nuevo", delito: "herejia", descripcion: "x", viva: 100, firma: "Marsh" } }).error && n.p.buscados!.propios.length === MAX_PROPIOS, "al retirar uno prescrito hay sitio");
}

// ---- 8. tablón por lugar, renovación procedural y ganchos de clase
{
  const m = mk();
  m.E("ubicacion", { lugar: "Cueva del lobo", region: "Aldenmar", tipo: "cueva" });
  const sin = m.B({ accion: "ver" });
  t(/no hay tablón/.test(txt(sin)) && sin.aviso === null && vistaTablon(m.p)!.hay === false && vistaTablon(m.p)!.carteles.length === 0, "en una cueva no hay tablón (y el panel queda vacío)", txt(sin).slice(0, 80));
  m.E("ubicacion", { lugar: "Muelle de Hollín", region: "Las Ciénagas de Hollín", tipo: "puerto" });
  const c = m.B({ accion: "ver" });
  t(/B01/.test(txt(c)) && /B06/.test(txt(c)) && !/B02 /.test(txt(c)), "en Hollín salen los carteles de las Ciénagas", txt(c).slice(0, 80));
  const antes = m.p.buscados!.generados.length;
  t(antes >= 1 && m.p.buscados!.generados[0].id === "G01", "el primer ver del día genera un cartel (G01)");
  m.B({ accion: "ver" });
  t(m.p.buscados!.generados.length === antes, "no más de uno por día del mundo");
  m.p.reloj!.segundos += 86400; m.B({ accion: "ver" });
  t(m.p.buscados!.generados.length === antes + 1, "al pasar el día, otro nuevo");
  m.B({ accion: "ver", datos: { renovar: true } }); m.B({ accion: "ver", datos: { renovar: true } });
  for (let i = 0; i < 20; i++) m.B({ accion: "ver", datos: { renovar: true } });
  t(m.p.buscados!.generados.length <= MAX_GENERADOS, "generados acotados", String(m.p.buscados!.generados.length));
  const nuevoMax = Math.max(...m.p.buscados!.generados.map((x) => x.peligro));
  t(nuevoMax <= 3, "un grupo sin rango no recibe carteles generados que no pueda aceptar", String(nuevoMax));
  // ganchos
  const k = mk({ clase: "Cazador de Brujas" });
  iniciarRegistroDados(d(20, 20, 20));
  const pj = k.B({ accion: "pista", id: "B06", quien: "Aldo" });
  liberarDados();
  t(/Cazador de Brujas: ventaja/.test(txt(pj)) && /ventaja/.test(txt(pj)), "el Cazador de Brujas rastrea brujas con ventaja", txt(pj).slice(0, 120));
  const dg = mk({ clase: "Degollador" });
  dg.p.personajes.Aldo.presa = { objetivo: "Marga Veyl", usada: false };
  iniciarRegistroDados(d(20, 20, 20));
  const pd = dg.B({ accion: "pista", id: "B02", quien: "Aldo" });
  liberarDados();
  t(/Degollador: ya estudió a su presa/.test(txt(pd)), "el Degollador que estudió a su presa rastrea con ventaja");
}

// ---- 9. partida antigua, exportar/importar, tamaño
{
  const p = nuevaPartida(); normalizarPartida(p);
  t(p.buscados === undefined && lineaBuscados(p) === "" && vistaTablon(p) === undefined, "partida sin buscados: nada que mostrar, nada creado");
  const e = ejecutar("buscados", { accion: "ver" }, p) as any;
  t(!e.error && !!p.buscados, "la primera acción crea el estado");
  const vieja = JSON.parse(JSON.stringify({ ...nuevaPartida(), buscados: { rep: 5 } })) as Partida;
  normalizarPartida(vieja);
  t(vieja.buscados!.rep === 5 && Array.isArray(vieja.buscados!.propios) && typeof vieja.buscados!.contratos === "object" && vieja.buscados!.n.g === 0, "un estado recortado se completa en normalizarPartida");
  const raro = { buscados: { rep: "x" } } as unknown as Partida; normalizarBuscados(raro);
  t(raro.buscados!.rep === 0, "reputación corrupta → 0");
  const m = mk();
  m.B({ accion: "aceptar", id: "B02", quien: "Aldo" });
  m.B({ accion: "cartel", datos: { nombre: "Brisa", delito: "desercion", descripcion: "Mercenaria.", viva: 300, firma: "Marsh", visible: true } });
  iniciarRegistroDados(d(20, 20)); m.B({ accion: "pista", id: "B02", quien: "Aldo" }); liberarDados();
  const viaje = JSON.parse(JSON.stringify(m.p)) as Partida; normalizarPartida(viaje);
  t(JSON.stringify(viaje.buscados) === JSON.stringify(m.p.buscados) && viaje.buscados!.contratos.B02.quien === "Aldo" && viaje.buscados!.propios[0].nombre === "Brisa" && viaje.buscados!.pistas.B02 === 1, "exportar → importar conserva contratos, pistas, carteles propios y reputación");
  t(JSON.stringify(vistaTablon(viaje)) === JSON.stringify(vistaTablon(m.p)), "y el panel de los jugadores es idéntico");
  // tamaño acotado
  const g = mk(); g.p.buscados = buscadosVacio(); g.p.buscados.rep = 16;
  for (let i = 0; i < 40; i++) g.B({ accion: "ver", datos: { renovar: true } });
  for (let i = 0; i < 20; i++) g.B({ accion: "cartel", datos: { nombre: `Buscado ${i}`, delito: "herejia", descripcion: "x".repeat(300), viva: 100, firma: "Marsh", pista_rumor: "y".repeat(200), pista_erudita: "z".repeat(200) } });
  for (const id of BUSCADOS.map((x) => x.id)) g.B({ accion: "aceptar", id, quien: "Aldo" });
  const tam = JSON.stringify(g.p.buscados).length;
  t(tam < 40000, "el estado del tablero queda acotado (< 40 KB en el peor caso)", String(tam));
}

// ---- 10. el estado del DM: una línea y solo con contratos; y el prompt fijo no engorda
{
  const m = mk();
  t(!/Cazarrecompensas/.test(estadoParaDM(m.p)), "sin contratos activos el estado del DM no dice nada");
  m.B({ accion: "ver" });
  t(!/Cazarrecompensas/.test(estadoParaDM(m.p)), "ni siquiera tras ver el tablón");
  m.B({ accion: "aceptar", id: "B02", quien: "Aldo" });
  const est = estadoParaDM(m.p);
  const linea = est.split("\n").filter((l) => /Contratos de la Llama/.test(l));
  t(linea.length === 1 && linea[0].length < 220 && /Marga Veyl/.test(linea[0]) && /vence día 16/.test(linea[0]), "con un contrato: una línea breve (nombre, quién, plazo)", linea[0]);
  const s = sistemaWeb();
  t(BUSCADOS.every((x) => !s.includes(x.nombre) && !s.includes(`"${x.id}"`)) && !s.includes("Marga Veyl"), "ningún buscado del catálogo está en sistemaWeb()");
  t(s.length <= 67600, "prompt fijo ≤ 67.600", String(s.length));
  t(/\| clima \| buscados \|/.test(catalogoCompacto()) && /buscados\(accion: /.test(catalogoCompacto()), "el catálogo compacto lista la acción y el tema");
  const reglas = consultarReglas("buscados");
  t(/pista/.test(reglas) && /oro_cambio/.test(reglas) && /Cazador licenciado/.test(reglas) && /SUGERENCIA/.test(reglas) && /docs\/BUSCADOS\.md/.test(reglas), "consultar_reglas buscados trae las reglas completas");
  t(RANGOS_LLAMA.every((r) => reglas.includes(r.nombre)) && reglas.includes(`${Math.round(FRACCION_MUERTO * 100)} %`), "…con todos los rangos y la fracción del muerto");
}

console.log(`${ok} ok, ${mal} fallas`);
