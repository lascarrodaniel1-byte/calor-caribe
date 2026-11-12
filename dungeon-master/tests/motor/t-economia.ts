// Economía de acciones por asalto de criaturas y PNJ: una acción de Atacar (N ataques de su ficha), una habilidad, una reacción
// y las acciones legendarias de los jefes. El programa rechaza el exceso SIN efecto (antes el enemigo atacaba en el turno de cada jugador).
import { nuevaPartida, normalizarPartida } from "../../src/estado.ts";
import { ejecutar } from "../../src/herramientas.ts";
import { estadoParaDM } from "../../src/navegador.ts";
import { BESTIARIO } from "../../src/bestiario.ts";
import { ataquesDeCriatura, legendariasDe, turnoDe } from "../../src/combate.ts";
import { iniciarRegistroDados, liberarDados } from "../../src/dados.ts";
let ok = 0, mal = 0; const t = (c: boolean, m: string, x = "") => { console.log(c ? "ok   " : "FALLA", m, x); c ? ok++ : mal++; };
const fijos = (v: number, n = 200) => iniciarRegistroDados(Array.from({ length: n }, () => ({ caras: 20, valor: v })));

/** Partida con dos PJ (A y B, muy resistentes) y las criaturas dadas, todos adyacentes en el plano. */
const mk = (criaturas: string[], pnj: object[] = []) => {
  const p = nuevaPartida(); normalizarPartida(p);
  const E = (n: string, d: object): any => ejecutar(n, d, p);
  for (const n of ["A", "B"]) E("guardar_personaje", { don_arcano: false, nombre: n, jugador: n, raza: "Humano del Faro", clase: "Mercenario del Cuervo", nivel: 5, pv_max: 900, ca: 12, atributos: { fue: 16, des: 14, con: 14, int: 10, sab: 14, car: 10 }, inventario: [], dote: "Terco" });
  for (const c of criaturas) E("aparecer_criatura", { nombre: c, repetir: true });
  const nombres = Object.values(p.jefes).map((j) => j.nombre);
  E("iniciativa", { participantes: ["A", "B", ...nombres], ...(pnj.length ? { pnj } : {}) });
  E("plano", { escena: "sala", poner: [{ nombre: "A" }] });
  E("plano", { poner: [{ nombre: "B", ref: "A", direccion: "N", metros: 1.5 }, ...[...nombres, ...(pnj as { nombre: string }[]).map((x) => x.nombre)].map((n) => ({ nombre: n, ref: "A", direccion: "N", metros: 1.5 }))] });
  return { p, E, nombres };
};
const ataca = (E: any, atacante: string, objetivo: string, extra: object = {}) => E("atacar", { atacante, objetivo, arma: "Ataque", dano: "1d4", ...extra });
const nom = (p: any, parte: string) => Object.values(p.jefes as Record<string, { nombre: string }>).find((j) => j.nombre.includes(parte))!.nombre;

// ---- tabla de multiataque y legendarias detectados en el bestiario
{
  const g = (n: string) => BESTIARIO.find((c) => c.nombre.startsWith(n))!;
  t(ataquesDeCriatura(g("Ogro")) === 1, "Ogro: 1 ataque por asalto");
  t(ataquesDeCriatura(g("Troll de ciénaga")) === 2, "Troll de ciénaga (Garras x2): 2 ataques");
  t(ataquesDeCriatura(g("Kuru")) === 3, "Kuru (x3 con la acción de atacar): 3 ataques");
  t(ataquesDeCriatura(g("Hugin")) === 2, "Hugin (x2 con la acción de atacar): 2 ataques");
  t(ataquesDeCriatura(g("Hidra")) === 5, "Hidra (Cabezas x5): 5 ataques");
  t(ataquesDeCriatura({ ...g("Ogro"), rasgos: ["Ataque múltiple: 4 golpes"] }) === 4, "un rasgo «Ataque múltiple» también cuenta");
  t(legendariasDe(g("Kuru")) === 2 && legendariasDe(g("Vaskar")) === 3 && legendariasDe(g("Kharoth")) === 3 && legendariasDe(g("Ogro")) === 0, "legendarias: Kuru 2, Vaskar 3, Kharoth 3, Ogro 0 (la «Resistencia legendaria» no cuenta)");
}

// ---- el caso original: el Ogro contra A y luego B en el mismo asalto
{
  const { p, E } = mk(["Ogro"]);
  fijos(10);
  const r1 = ataca(E, "Ogro", "A", { arma: "Maza", dano: "2d8+4" });
  t(!r1.error, "el Ogro ataca una vez (en su iniciativa)", r1.contenido.slice(0, 80));
  const pvA = p.personajes.A.pv, pvB = p.personajes.B.pv;
  const r2 = ataca(E, "Ogro", "B", { arma: "Maza", dano: "2d8+4" });
  t(!!r2.error && /Ogro ya ha actuado este asalto \(1 de 1 ataque\)/.test(r2.contenido), "el segundo ataque del Ogro (contra B, en el turno de otro) se rechaza", r2.contenido.slice(0, 120));
  t(/UNA vez por asalto/.test(r2.contenido) && /reaccion: true/.test(r2.contenido) && /siguiente_asalto/.test(r2.contenido) && !/legendaria: true/.test(r2.contenido), "el mensaje explica reacción y siguiente_asalto (sin legendaria: el Ogro no tiene)");
  t(p.personajes.B.pv === pvB && p.personajes.A.pv === pvA && turnoDe(p, "Ogro").ataques === 1, "el rechazo no tiene efecto (ni daño ni contador)");
  const r3 = ataca(E, "Ogro", "A");
  t(!!r3.error, "y repetir contra A tampoco vale");
  E("siguiente_asalto", {});
  t(!ataca(E, "Ogro", "B").error, "tras siguiente_asalto el Ogro vuelve a poder atacar");
  liberarDados();
}

// ---- multiataque: Troll de ciénaga (x2) y Kuru (x3)
{
  const { p, E } = mk(["Troll de ciénaga"]);
  fijos(10);
  const troll = nom(p, "Troll");
  const a = [ataca(E, troll, "A"), ataca(E, troll, "A")];
  t(!a[0].error && !a[1].error, "el Troll hace sus 2 ataques de la acción de Atacar", a.map((x) => x.contenido.slice(0, 40)).join(" | "));
  const r = ataca(E, troll, "B");
  t(!!r.error && /\(2 de 2 ataques\)/.test(r.contenido), "el tercer ataque se rechaza (2 de 2)", r.contenido.slice(0, 110));
  liberarDados();
}
{
  const { p, E } = mk(["Kuru"]);
  fijos(10);
  const kuru = nom(p, "Kuru");
  const n = [1, 2, 3].map(() => ataca(E, kuru, "A").error ? 0 : 1).reduce((a: number, b: number) => a + b, 0);
  t(n === 3, "Kuru hace sus 3 ataques", String(n));
  const r = ataca(E, kuru, "B");
  t(!!r.error && /\(3 de 3 ataques\)/.test(r.contenido) && /legendaria: true/.test(r.contenido), "el 4.º se rechaza y el mensaje menciona sus acciones legendarias", r.contenido.slice(0, 200));

  // ---- legendarias: 2 por asalto sin gastar la acción normal
  E("siguiente_asalto", {});
  const l1 = ataca(E, kuru, "A", { legendaria: true }), l2 = ataca(E, kuru, "B", { legendaria: true });
  t(!l1.error && !l2.error, "Kuru hace 2 acciones legendarias en el asalto nuevo", (l1.contenido + l2.contenido).slice(0, 100));
  const l3 = ataca(E, kuru, "A", { legendaria: true });
  t(!!l3.error && /2 acciones legendarias/.test(l3.contenido), "la 3.ª legendaria se rechaza", l3.contenido.slice(0, 120));
  t(turnoDe(p, kuru).legendarias === 2 && (turnoDe(p, kuru).ataques ?? 0) === 0, "las legendarias no gastan la acción normal");
  const n2 = [1, 2, 3].map(() => ataca(E, kuru, "A").error ? 0 : 1).reduce((a: number, b: number) => a + b, 0);
  t(n2 === 3, "y aún tiene sus 3 ataques normales", String(n2));
  const est = estadoParaDM(p);
  t(/legendarias 0\/2/.test(est), "el estado del DM muestra las legendarias restantes", (/.*Kuru.*legendarias.*/.exec(est) ?? ["(no)"])[0]);
  E("siguiente_asalto", {});
  t(!ataca(E, kuru, "A", { legendaria: true }).error, "las legendarias se recuperan en el asalto siguiente");
  const o = mk(["Ogro"]); fijos(10);
  const ro = ataca(o.E, "Ogro", "A", { legendaria: true });
  t(!!ro.error && /no tiene acciones legendarias/.test(ro.contenido), "una criatura sin legendarias no puede usar legendaria: true", ro.contenido.slice(0, 80));
  liberarDados();
}

// ---- reacción: una por asalto, y reaccion: true la consume
{
  const { p, E } = mk(["Ogro"]);
  fijos(10);
  const r1 = ataca(E, "Ogro", "A", { reaccion: true });
  t(!r1.error, "el Ogro hace un ataque de oportunidad (reaccion: true) además de su acción", r1.contenido.slice(0, 60));
  t(turnoDe(p, "Ogro").reaccion === true && (turnoDe(p, "Ogro").ataques ?? 0) === 0, "consume la reacción y no su acción");
  const r2 = ataca(E, "Ogro", "B", { reaccion: true });
  t(!!r2.error && /ya atacó como reacción/.test(r2.contenido), "la segunda reacción se rechaza", r2.contenido.slice(0, 100));
  t(!ataca(E, "Ogro", "B").error, "su acción de Atacar sigue libre");
  E("siguiente_asalto", {});
  t(!ataca(E, "Ogro", "B", { reaccion: true }).error, "la reacción se recupera en el asalto siguiente");
  liberarDados();
}
// reaccion tipo ataque_oportunidad (herramienta reaccion) y luego atacar reaccion: true
{
  const { p, E } = mk(["Ogro"]);
  fijos(10);
  const r = E("reaccion", { quien: "Ogro", tipo: "ataque_oportunidad", objetivo: "A", arma: "Maza", dano: "1d4" });
  t(!r.error && turnoDe(p, "Ogro").reaccion === true, "reaccion {ataque_oportunidad} con dano sigue funcionando", r.contenido.slice(0, 60));
  const r2 = ataca(E, "Ogro", "A", { reaccion: true });
  t(!!r2.error, "y un segundo ataque de reacción se rechaza");
  const { p: q, E: F } = mk(["Ogro"]);
  const s = F("reaccion", { quien: "Ogro", tipo: "ataque_oportunidad", objetivo: "A" });
  const s2 = ataca(F, "Ogro", "A", { reaccion: true });
  t(!s.error && !s2.error && turnoDe(q, "Ogro").reaccion === true, "reaccion anunciada sin dano + atacar reaccion: true (el flujo de dos pasos) funciona", s2.contenido.slice(0, 60));
  liberarDados();
}

// ---- habilidades: una por asalto
{
  const { p, E } = mk(["Mantícora"]);
  const m = nom(p, "Mantícora");
  const hab = BESTIARIO.find((c) => c.nombre === "Mantícora")!.habilidades[0];
  const h = { criatura: m, habilidad: hab.nombre, objetivos: ["A"] };
  const r1 = E("habilidad_criatura", h);
  t(!r1.error, "la criatura usa una habilidad", r1.contenido.slice(0, 60));
  const r2 = E("habilidad_criatura", { ...h, objetivos: ["B"] });
  t(!!r2.error && /ya usó una habilidad este asalto/.test(r2.contenido) && /siguiente_asalto/.test(r2.contenido), "la segunda habilidad del mismo asalto se rechaza", r2.contenido.slice(0, 120));
  t(!ataca(E, m, "A").error, "la habilidad no gasta su acción de Atacar");
}
{
  // Kuru: «Estudiar a la presa» es acción adicional (no cuenta); una habilidad improvisada sí cuenta, y como legendaria va por su pozo
  const { p, E } = mk(["Kuru"]);
  const kuru = nom(p, "Kuru");
  const r1 = E("habilidad_criatura", { criatura: kuru, habilidad: "Estudiar a la presa", objetivos: ["A"] });
  const r2 = E("habilidad_criatura", { criatura: kuru, habilidad_nueva: { nombre: "Tajo de sombra", descripcion: "Un tajo." }, objetivos: ["A"] });
  const r3 = E("habilidad_criatura", { criatura: kuru, habilidad_nueva: { nombre: "Otro tajo", descripcion: "Otro." }, objetivos: ["A"] });
  t(!r1.error && !r2.error && !!r3.error, "la acción adicional no gasta la habilidad del asalto; la improvisada gasta y la siguiente se rechaza", [r1, r2, r3].map((x: any) => x.error ? "E" : "ok").join(","));
  const l1 = E("habilidad_criatura", { criatura: kuru, habilidad_nueva: { nombre: "Humo", descripcion: "Se esconde." }, objetivos: ["A"], legendaria: true });
  const l2 = E("habilidad_criatura", { criatura: kuru, habilidad_nueva: { nombre: "Cuchillo", descripcion: "Lanza." }, objetivos: ["A"], legendaria: true });
  const l3 = E("habilidad_criatura", { criatura: kuru, habilidad_nueva: { nombre: "Más", descripcion: "Más." }, objetivos: ["A"], legendaria: true });
  t(!l1.error && !l2.error && !!l3.error, "las habilidades legendarias comparten el pozo de 2 (la 3.ª se rechaza)", [l1, l2, l3].map((x: any) => x.error ? "E" : "ok").join(","));
  void p;
}

// ---- PNJ: 1 ataque por defecto, o ataques_por_asalto (máx. 4)
{
  const { p, E } = mk([], [{ nombre: "Bandido", bono_ataque: 4, ca: 12 }, { nombre: "Capitán", bono_ataque: 6, ca: 15, ataques_por_asalto: 2 }]);
  fijos(10);
  t(!ataca(E, "Bandido", "A").error && !!ataca(E, "Bandido", "B").error, "un PNJ corriente ataca una vez por asalto");
  const c = [ataca(E, "Capitán", "A"), ataca(E, "Capitán", "B"), ataca(E, "Capitán", "A")];
  t(!c[0].error && !c[1].error && !!c[2].error && /\(2 de 2 ataques\)/.test(c[2].contenido), "el PNJ con ataques_por_asalto: 2 ataca dos veces y la tercera se rechaza", c[2].contenido.slice(0, 80));
  const bad = E("iniciativa", { participantes: ["A"], pnj: [{ nombre: "X", bono_ataque: 1, ca: 10, ataques_por_asalto: 5 }] });
  t(!!bad.error, "ataques_por_asalto máximo 4");
  liberarDados();
}

// ---- PJ sin cambios
{
  const { p, E } = mk(["Ogro"]);
  fijos(10);
  const r = [1, 2, 3].map(() => ataca(E, "A", "Ogro", { arma: undefined, dano: undefined }));
  t(!r[0].error && !r[1].error && !!r[2].error && /ya hizo 2 ataque/.test(r[2].contenido), "el PJ sigue limitado como antes (2 ataques con Ataque adicional, el 3.º se rechaza)", r[2].contenido.slice(0, 100));
  liberarDados();
}

// ---- bloque de estado del DM
{
  const { p, E } = mk(["Ogro"]);
  fijos(10);
  let est = estadoParaDM(p);
  t(/Asalto 1 — ya actuaron: nadie; faltan: [^\n]*Ogro/.test(est), "al empezar nadie ha actuado y faltan todos", (/Asalto 1 —[^\n]*/.exec(est) ?? ["(no aparece)"])[0]);
  ataca(E, "Ogro", "A"); ataca(E, "A", "Ogro", { arma: undefined, dano: undefined });
  est = estadoParaDM(p);
  const cab = /Asalto 1 — ya actuaron: ([^;]*); faltan: ([^(]*)\(en orden de iniciativa\)/.exec(est);
  t(!!cab && /Ogro/.test(cab[1]) && /A/.test(cab[1]) && !/Ogro/.test(cab[2]) && /B/.test(cab[2]), "el DM ve quién ha actuado (Ogro, A) y quién falta (B)", cab ? `${cab[1]} | ${cab[2]}` : "(sin bloque)");
  t(/- Ogro: acción 1\/1 ataque[^\n]*reacción libre/.test(est) && /- B: acción 0\/2/.test(est), "una línea por combatiente con su acción y su reacción", (/- Ogro:[^\n]*/.exec(est) ?? [""])[0]);
  ataca(E, "Ogro", "B", { reaccion: true });
  t(/- Ogro:[^\n]*reacción gastada/.test(estadoParaDM(p)), "la reacción gastada se ve");
  t(estadoParaDM(p).split("\n").filter((l) => l.startsWith("- ") && /: acción \d/.test(l)).every((l) => l.length <= 120), "las líneas no pasan de 120 caracteres");
  E("siguiente_asalto", {});
  t(/Asalto 2 — ya actuaron: nadie/.test(estadoParaDM(p)), "en el asalto nuevo vuelve a empezar");
  liberarDados();
}

console.log(`${ok} ok, ${mal} fallas`);
