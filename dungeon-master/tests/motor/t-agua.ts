import { nuevaPartida, normalizarPartida } from "../../src/estado.ts";
import { ejecutar } from "../../src/herramientas.ts";
import { iniciarRegistroDados, liberarDados } from "../../src/dados.ts";
let ok = 0, mal = 0; const t = (c: boolean, m: string, x = "") => { console.log(c ? "ok   " : "FALLA", m, x); c ? ok++ : mal++; };
const txt = (r: any) => (typeof r === "string" ? r : r?.contenido ?? JSON.stringify(r));
const fijos = (v: number, n = 40) => iniciarRegistroDados(Array.from({ length: n }, () => ({ caras: 20, valor: v })));
const mk = (raza: string, extra: any = {}) => { const p = nuevaPartida(); normalizarPartida(p); const E = (n: string, d: object): any => ejecutar(n, d, p);
  E("guardar_personaje", { don_arcano: false, nombre: "Pj", jugador: "Pj", raza, clase: "Mercenario del Cuervo", nivel: 5, pv_max: 60, ca: 12, atributos: { fue: 16, des: 14, con: 14, int: 10, sab: 10, car: 10 }, inventario: ["Espada larga"], dote: "Terco", ...extra }, p);
  E("empunar", { quien: "Pj", principal: "Espada larga" }); return { p, E }; };
const escena = (E: any, enemigo: string, quienes: string[], modo: "entrar" | "sumergir") => {
  E("aparecer_criatura", { nombre: enemigo, repetir: true }); E("iniciativa", { participantes: ["Pj", enemigo] });
  E("plano", { escena: "agua", poner: [{ nombre: "Pj" }] }); E("plano", { poner: [{ nombre: enemigo, ref: "Pj", direccion: "N", metros: 1.5 }] });
  return txt(E("agua", { accion: modo, quienes }));
};
const atacar = (E: any, a: string, o: string, arma: string) => { fijos(15); const r = txt(E("atacar", { atacante: a, objetivo: o, arma, dano: "4d6" })); liberarDados(); return r; };
// 1. humano vs hambriento, ambos sumergidos: los dos con desventaja y mitad de daño
{ const { E } = mk("Humano del Faro"); const s = escena(E, "Hambriento", ["Pj", "Hambriento"], "sumergir");
  t(/no es del agua/i.test(s), "sumergir avisa a quien no es del agua", s.replace(/\n/g, " | ").slice(0, 160));
  const r = atacar(E, "Pj", "Hambriento", "Espada larga");
  t(/desventaja/.test(r) && /Bajo el agua el golpe pierde fuerza/.test(r), "humano sumergido: desventaja y mitad de daño", r.replace(/\n/g, " | ").slice(0, 300));
  const r2 = atacar(E, "Hambriento", "Pj", "garras"); t(/desventaja/.test(r2), "la criatura que no es del agua también sufre desventaja");
  t(/Bajo el agua el golpe/.test(r2) || /no atraviesa|FALLO/.test(r2), "…y su golpe pierde fuerza (o no impacta)", r2.replace(/\n/g, " | ").slice(0, 200)); }
// 2. en el agua (sin hundirse): desventaja cuerpo a cuerpo y −2 al daño
{ const { E } = mk("Humano del Faro"); escena(E, "Hambriento", ["Pj", "Hambriento"], "entrar");
  const r = atacar(E, "Pj", "Hambriento", "Espada larga");
  t(/en el agua, sin pie firme/.test(r) && /En el agua, sin apoyo/.test(r), "en el agua: desventaja cuerpo a cuerpo y −2 al daño", r.replace(/\n/g, " | ").slice(0, 300)); }
// 3. Tritón: no sufre nada
{ const { E } = mk("Tritón de las Mareas"); const s = escena(E, "Hambriento", ["Pj", "Hambriento"], "sumergir");
  const r = atacar(E, "Pj", "Hambriento", "Espada larga");
  t(!/desventaja/.test(r) && !/pierde fuerza/.test(r), "el Tritón sumergido no tiene desventaja ni pierde fuerza", r.replace(/\n/g, " | ").slice(0, 220)); }
// 4. sirena y hombre pez: del agua, sin penalización; humano sí
{ const { E } = mk("Humano del Faro"); const s = escena(E, "Sirena", ["Pj", "Sirena"], "sumergir");
  t(/en su elemento/.test(s), "la sirena está en su elemento", s.replace(/\n/g, " | ").slice(0, 200));
  const r = atacar(E, "Sirena", "Pj", "garras"); t(!/desventaja/.test(r) && !/pierde fuerza/.test(r), "la sirena sumergida ataca sin penalización", r.replace(/\n/g, " | ").slice(0, 200));
  const r2 = atacar(E, "Pj", "Sirena", "Espada larga"); t(/desventaja/.test(r2), "pero el humano contra la sirena sí tiene desventaja"); }
{ const { E } = mk("Humano del Faro"); const s = escena(E, "Hombre pez", ["Pj", "Hombre pez"], "entrar");
  t(/es del agua/.test(s), "el hombre pez en el agua: del agua", s.replace(/\n/g, " | ").slice(0, 160)); }
// 5. salir del agua
{ const { E, p } = mk("Humano del Faro"); escena(E, "Hambriento", ["Pj", "Hambriento"], "sumergir");
  const s = txt(E("agua", { accion: "salir", quienes: ["Pj", "Hambriento"] }));
  t(/tierra firme/.test(s) && !p.personajes.Pj.condiciones.some((c) => /agua|sumerg/i.test(c)), "salir del agua quita las condiciones", s.replace(/\n/g, " | ").slice(0, 160));
  fijos(15); const r = txt(E("atacar", { atacante: "Pj", objetivo: "Hambriento", arma: "Espada larga", dano: "4d6" })); liberarDados();
  t(!/pierde fuerza/.test(r) && !/en el agua/.test(r), "en tierra firme no hay penalización"); }
console.log(`${ok} ok, ${mal} fallas`);
