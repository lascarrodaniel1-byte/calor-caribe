// La dote gratis al crear personaje es exclusiva del Humano del Faro: el Tritón de las Mareas (y las demás razas) NO la tienen.
import { nuevaPartida, normalizarPartida } from "../../src/estado.ts";
import { ejecutar } from "../../src/herramientas.ts";
import { validarFicha, textoFicha } from "../../src/formulario.ts";
let ok = 0, mal = 0; const t = (c: boolean, m: string, x = "") => { console.log(c ? "ok   " : "FALLA", m, x); c ? ok++ : mal++; };
const txt = (r: any) => (typeof r === "string" ? r : r?.contenido ?? JSON.stringify(r));
const E = (P: any, a: string, d: any) => txt(ejecutar(a, d, P));
const ERR = (P: any, a: string, d: any) => { const r: any = ejecutar(a, d, P); return r.error ? txt(r) : ""; };
const ficha = (n: string, raza: string, extra: any = {}) => ({ don_arcano: false, nombre: n, jugador: n, raza, clase: "Mercenario del Cuervo", nivel: 1, pv_max: 20, ca: 12, atributos: { fue: 14, des: 12, con: 14, int: 10, sab: 10, car: 10 }, inventario: ["Espada larga"], ...extra });
const nueva = () => { const P = nuevaPartida(); normalizarPartida(P); return P; };

for (const raza of ["Tritón de las Mareas", "Enano de Karak-Dûm"]) {
  const P = nueva();
  const r = E(P, "guardar_personaje", ficha("Pj", raza, { dote: "Terco" }));
  t(!P.personajes.Pj.dote_humano && !(P.personajes.Pj.dotes ?? []).length && !/dote GRATIS/.test(r), `${raza}: no tiene dote gratis (ni se aplica la del formulario ni se ofrece)`);
  const m = ERR(P, "dote", { accion: "elegir", quien: "Pj", dote: "Terco" });
  t(/solo el Humano del Faro/.test(m) && !(P.personajes.Pj.dotes ?? []).length, `${raza}: dote elegir se rechaza`, m.slice(0, 80));
  t(!/sin elegir/.test(E(P, "dote", { accion: "ver", quien: "Pj" })), `${raza}: dote ver no habla de dote gratis`);
}
{ // Humano: igual que siempre
  const P = nueva();
  const r = E(P, "guardar_personaje", ficha("Hugo", "Humano del Faro"));
  t(/dote GRATIS/.test(r), "Humano sin dote: aviso de dote gratis");
  E(P, "dote", { accion: "elegir", quien: "Hugo", dote: "Terco" });
  t(P.personajes.Hugo.dote_humano === "terco" && /ya usó/.test(ERR(P, "dote", { accion: "elegir", quien: "Hugo", dote: "Pasos de gato" })), "Humano: la elige una sola vez");
}
{ // Formulario
  const f: any = { nombre: "Brunilda", jugador: "Ana", genero: "Femenino", raza: "Tritón de las Mareas", clase: "Mercenario del Cuervo", veterania: "curtido", personalidad: ["temerario"], base: { fue: 15, des: 14, con: 13, int: 12, sab: 10, car: 8 }, metodo: "estandar", tipo: "", linaje: "", trasfondo: "Una mercenaria veterana que busca a su hermano perdido.", extra: "" };
  const dote = (x: any) => validarFicha(x).filter((e) => /dote/i.test(e));
  t(dote(f).length === 0 && !/Dote gratis/.test(textoFicha(f)), "formulario: el Tritón no pide dote ni la lleva el mensaje");
  t(dote({ ...f, raza: "Humano del Faro" }).length === 1 && dote({ ...f, raza: "Humano del Faro", dote: "Terco" }).length === 0, "formulario: el Humano sí la pide");
}
console.log(`${ok} ok, ${mal} fallas`);
