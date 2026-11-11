import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { nuevaPartida, normalizarPartida } from "../../src/estado.ts";
import { ejecutar } from "../../src/herramientas.ts";
import { estadoParaDM } from "../../src/navegador.ts";
import { RASGOS_NIVEL } from "../../src/progresion.ts";
import { nvl } from "../../src/niveles.ts";
import { rangoDe, buscarTema, textoSaber, fugasDeSaber } from "../../src/saber.ts";
import { pistasDeRepaso } from "../../src/repaso.ts";
import { TERRITORIOS, territorioEn } from "../../src/mapa.ts";
import { iniciarRegistroDados, liberarDados } from "../../src/dados.ts";
let ok = 0, mal = 0; const t = (c: boolean, m: string, x = "") => { console.log(c ? "ok   " : "FALLA", m, x); c ? ok++ : mal++; };
const txt = (r: any) => (typeof r === "string" ? r : r?.contenido ?? JSON.stringify(r));
const mundo = () => { const p = nuevaPartida(); normalizarPartida(p); const E = (n: string, d: object): any => ejecutar(n, d, p); return { p, E }; };
const ficha = (E: any, n: string, clase: string, nivel: number, raza = "Humano del Faro", extra: any = {}) => E("guardar_personaje", { don_arcano: false, nombre: n, jugador: n, raza, clase, nivel, pv_max: 60, ca: 12, atributos: { fue: 16, des: 14, con: 14, int: 10, sab: 14, car: 10 }, inventario: ["Espada larga", "Arco largo"], dote: "Terco", ...extra });
const combate = (E: any, n: string, metros = 1.5) => { E("aparecer_criatura", { nombre: "Hambriento", repetir: true }); E("iniciativa", { participantes: [n, "Hambriento"] }); E("plano", { escena: "sala", poner: [{ nombre: n }] }); E("plano", { poner: [{ nombre: "Hambriento", ref: n, direccion: "N", metros }] }); };
const fijos = (v: number, n = 30) => iniciarRegistroDados(Array.from({ length: n }, () => ({ caras: 20, valor: v })));
// ---- umbrales: ninguna puerta de nivel sin desplazar
{ const dir = fileURLToPath(new URL("../../src/", import.meta.url)); const permitidos = new Set(["combate.ts", "encuentros.ts", "sustento.ts", "compania.ts", "progresion.ts", "niveles.ts"]); const malos: string[] = [];
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".ts") && !permitidos.has(x))) readFileSync(dir + f, "utf8").split("\n").forEach((l, i) => { if (/nivel[^=<>!a-zA-Z_]{0,12}(>=|<=|>|<)\s*[0-9]+/.test(l) && !/nvl\(/.test(l.replace(/nivel[^=<>!a-zA-Z_]{0,12}(>=|<=|>|<)\s*nvl\(\d+\)/g, ""))) malos.push(`${f}:${i + 1}`); });
  t(malos.length === 0, "ninguna puerta de nivel se queda sin desplazar con nvl()", malos.join(", ")); }
t(nvl(1) === 1 && nvl(3) === 5 && nvl(19) === 20 && !RASGOS_NIVEL["Berserker de Ceniza"][3] && !!RASGOS_NIVEL["Berserker de Ceniza"][5], "el reequilibrio: Furia lúcida pasa del 3 al 5");
// ---- ataque adicional, crítico 19-20, temerario, presa, desviar
{ const { p, E } = mundo(); ficha(E, "Mer7", "Mercenario del Cuervo", 7); ficha(E, "Mer6", "Mercenario del Cuervo", 6); combate(E, "Mer7"); p.jefes["Hambriento"].pv = p.jefes["Hambriento"].pv_max = 999; fijos(12);
  t(!E("atacar", { atacante: "Mer7", objetivo: "Hambriento", dano: "1d4", bono: 50 }).error && !E("atacar", { atacante: "Mer7", objetivo: "Hambriento", dano: "1d4" }).error && /ya hizo 2 ataque/.test(txt(E("atacar", { atacante: "Mer7", objetivo: "Hambriento", dano: "1d4" }))), "nivel 7: dos ataques por acción y el tercero se bloquea");
  E("atacar", { atacante: "Mer6", objetivo: "Hambriento", dano: "1d4", bono: 50 }); t(/ya hizo 1 ataque/.test(txt(E("atacar", { atacante: "Mer6", objetivo: "Hambriento", dano: "1d4" }))), "nivel 6: un solo ataque");
  E("siguiente_asalto", {}); E("usar_recurso", { quien: "Mer7", recurso: "Acción súbita" }); let n = 0; for (let i = 0; i < 5; i++) if (!E("atacar", { atacante: "Mer7", objetivo: "Hambriento", dano: "1d4", bono: 50 }).error) n++; t(n === 4, "Acción súbita: cuatro ataques", String(n)); liberarDados(); }
{ const { p, E } = mundo(); ficha(E, "A", "Mercenario del Cuervo", 5); ficha(E, "B", "Mercenario del Cuervo", 4); combate(E, "A"); p.jefes["Hambriento"].pv = p.jefes["Hambriento"].pv_max = 999;
  fijos(19); const ra = txt(E("atacar", { atacante: "A", objetivo: "Hambriento", dano: "1d4" })), rb = txt(E("atacar", { atacante: "B", objetivo: "Hambriento", dano: "1d4" })); liberarDados();
  t(/→ ¡CRÍTICO!/.test(ra) && !/→ ¡CRÍTICO!/.test(rb), "Veterano de compañía: el 19 natural crita a nivel 5 y no a nivel 4"); }
{ const { p, E } = mundo(); ficha(E, "Brak", "Berserker de Ceniza", 4); combate(E, "Brak"); p.jefes["Hambriento"].pv = p.jefes["Hambriento"].pv_max = 999; fijos(12);
  t(/ataque temerario/.test(txt(E("atacar", { atacante: "Brak", objetivo: "Hambriento", dano: "1d4" }))) && /atacó con temeridad/.test(txt(E("atacar", { atacante: "Hambriento", objetivo: "Brak", dano: "1d4" }))), "Ataque temerario: ventaja propia y de sus enemigos"); liberarDados(); }
{ const { p, E } = mundo(); ficha(E, "Caz", "Cazador de Brujas", 7); combate(E, "Caz"); p.jefes["Hambriento"].pv_max = 999; p.jefes["Hambriento"].pv = 900; fijos(12);
  t(/Presa marcada/.test(txt(E("atacar", { atacante: "Caz", objetivo: "Hambriento", dano: "1d4", bono: 50 }))), "Presa marcada contra una criatura herida"); liberarDados(); }
{ const q = mundo(); ficha(q.E, "Fla", "Flagelante", 5); combate(q.E, "Fla"); q.p.jefes["Hambriento"].pv = q.p.jefes["Hambriento"].pv_max = 999; let v = false; for (let i = 0; i < 40 && !v; i++) { v = /Desviar proyectiles/.test(txt(q.E("atacar", { atacante: "Hambriento", objetivo: "Fla", dano: "6d6", bono: 99, a_distancia: true }))); q.E("siguiente_asalto", {}); } t(v, "Flagelante desvía proyectiles solo"); }
// ---- razas
{ const { p, E } = mundo(); ficha(E, "Lobo", "Mercenario del Cuervo", 1, "Varg"); combate(E, "Lobo"); p.jefes["Hambriento"].pv = p.jefes["Hambriento"].pv_max = 999; fijos(12);
  t(/Daño: 1d6/.test(txt(E("atacar", { atacante: "Lobo", objetivo: "Hambriento", arma: "Mordisco", bono: 50 }))), "Varg: el Mordisco trae su daño");
  E("usar_recurso", { quien: "Lobo", recurso: "Furia de la luna" }); E("siguiente_asalto", {}); t(/Furia de la luna: \+2/.test(txt(E("atacar", { atacante: "Lobo", objetivo: "Hambriento", dano: "1d4", bono: 50 }))), "Furia de la luna: +2 al daño"); liberarDados(); }
{ const { p, E } = mundo(); ficha(E, "Pal", "Mercenario del Cuervo", 1, "Nacido Pálido"); combate(E, "Pal"); p.jefes["Hambriento"].pv = p.jefes["Hambriento"].pv_max = 999; p.personajes["Pal"].pv = 10; fijos(12);
  t(/Mordisco vampírico: Pal recupera/.test(txt(E("atacar", { atacante: "Pal", objetivo: "Hambriento", arma: "Mordisco vampírico", bono: 50 }))) && p.personajes["Pal"].pv > 10, "Mordisco vampírico: se cura lo que muerde");
  t(!!E("usar_recurso", { quien: "Pal", recurso: "Mordisco vampírico" }).error, "usar_recurso no gasta el Mordisco vampírico (lo gasta el ataque)"); liberarDados(); }
{ const { p, E } = mundo(); ficha(E, "Cen", "Mercenario del Cuervo", 1, "Cenizo"); combate(E, "Cen", 10); p.jefes["Hambriento"].pv = p.jefes["Hambriento"].pv_max = 999; fijos(12);
  const l = E("atacar", { atacante: "Cen", objetivo: "Hambriento", arma: "Llama sagrada", bono: 50 }); t(!l.error && /Daño: 1d8/.test(txt(l)), "Llama sagrada alcanza a 10 m", txt(l).slice(0, 70));
  const f = mundo(); ficha(f.E, "Cen2", "Mercenario del Cuervo", 1, "Cenizo"); combate(f.E, "Cen2", 25); t(!!f.E("atacar", { atacante: "Cen2", objetivo: "Hambriento", arma: "Llama sagrada" }).error, "…y no a 25 m (alcance 18)"); liberarDados();
  t(!!E("usar_recurso", { quien: "Cen", recurso: "Brasa interior" }).error, "usar_recurso no gasta la Brasa interior");
  E("modificar_personaje", { nombre: "Cen", pv_cambio: -10, tipo_dano: "fuego" }); t(p.personajes["Cen"].pv === 55, "el Cenizo resiste el fuego (−10 → −5)"); }
{ const { E } = mundo(); ficha(E, "Hum", "Mercenario del Cuervo", 1); ficha(E, "Ena", "Mercenario del Cuervo", 1, "Enano de Karak-Dûm");
  t(/ventaja/.test(txt(E("prueba", { quien: "Hum", atributo: "sab", tipo: "salvacion", cd: 10, motivo: "miedo ante el espectro" }))) && /ventaja/.test(txt(E("prueba", { quien: "Ena", atributo: "con", tipo: "salvacion", cd: 10, motivo: "dardo con veneno" }))), "ventajas raciales en salvaciones (miedo, veneno)"); }
// ---- saber
t(rangoDe("reo condenado") === "vulgo" && rangoDe("tendero general") !== "alto" || rangoDe("tendero general") === "vulgo", "«condenado» no es conde ni un tendero general es un general", `${rangoDe("reo condenado")} ${rangoDe("tendero general")}`);
t(rangoDe("escriba del archivo") === "letrado" && rangoDe("consejero de Ceniza") === "alto" && rangoDe("posadera") === "vulgo" && rangoDe("duquesa de Vel") === "alto", "rangos por rol");
t(buscarTema("Lobo de Ceniza") === undefined && buscarTema("varg")?.id === "lobo" && buscarTema("Ysolde")?.id === "ysolde" && buscarTema("Juez Sin Ojos")?.id === "juez", "buscarTema: exacto para claves genéricas, sin falsos positivos");
t(buscarTema("El Juez Sin Ojos")?.id === "juez" && buscarTema("Ysolde, la Reina Pálida")?.id === "ysolde" && buscarTema("Vaskar, el Lobo del Eclipse")?.id === "lobo", "los jefes con tema escrito a mano no usan el de su ficha (que filtraría su secreto)");
{ const { p } = mundo(); const j = buscarTema("juez")!; t(/Primer Inquisidor/.test(textoSaber(p, j, "vulgo")) && !/hijo de ka/i.test(textoSaber(p, j, "alto", "inquisidor mayor de la Llama Gris")), "el vulgo sabe lo público; ni un alto cargo sabe el secreto");
  t(fugasDeSaber(p, "Los inquisidores guardan un rayo de luz solar en el cofre.").length === 0 && fugasDeSaber(p, "Es hijo de Ka'i, el dios del sol.").length === 1, "un objeto público no dispara el aviso de secreto; el secreto sí"); }
// ---- repaso, mapa, monstruos
{ const { p } = mundo(); const r0 = p.reloj!.segundos; t(pistasDeRepaso(p, { texto: "Pasan tres horas de camino. Llegan a Pozonegro y Berta, llamada Berta la Gorda, les cobra 5 platas.", llamadas: [], relojAntes: r0 }).length >= 3 && pistasDeRepaso(p, { texto: "Aldo habla con Berta.", llamadas: [], relojAntes: r0 }).length === 0, "el repaso detecta omisiones y no da falsas alarmas en una escena tranquila"); }
t(TERRITORIOS.length === 3 && territorioEn(515, 430)?.regente === "Juez Sin Ojos" && !territorioEn(225, 215), "fronteras: Aldenmar es de la Llama Gris y las Agujas, tierra libre");
{ const { E } = mundo(); const u = E("ubicacion", { lugar: "Vel Morhal", region: "La Marca Hueca", tipo: "fortaleza", direccion: "S" }); t(/Dominio de la Corte Pálida/.test(String(u.aviso)) && !/Ysolde/.test(String(u.aviso)) && /Ysolde/.test(String(u.contenido ?? "")) === false, "el aviso a los jugadores no nombra al regente secreto"); }
{ const { p, E } = mundo(); E("tirar_don_arcano", { jugador: "Ana" }); ficha(E, "Aldo", "Mercenario del Cuervo", 1); E("aparecer_criatura", { nombre: "Lich" }); E("aparecer_criatura", { nombre: "Wendigo" }); t(!!p.jefes["Lich"] && !!p.jefes["Wendigo"], "Lich y Wendigo se pueden invocar"); const est = estadoParaDM(p); t(/Libro de sucesos|Rasgos que el MOTOR/.test(est) || est.length > 0, "el estado del DM se genera"); }
console.log(`${ok} ok, ${mal} fallas`);
