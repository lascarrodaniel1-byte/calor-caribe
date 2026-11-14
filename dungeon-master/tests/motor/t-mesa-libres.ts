// Mesa con varios jugadores donde solo algunos están en la iniciativa: los demás no quedan bloqueados, y al acabar
// el combate la mesa vuelve a la rotación normal sin saltarse ni repetir a nadie (pasarPalabra).
import { nuevaPartida, normalizarPartida } from "../../src/estado.ts";
import { ejecutar } from "../../src/herramientas.ts";
import { pasarPalabra, siguienteEnCombate, bloqueTurnos, type Jugador } from "../../src/turnos.ts";
let ok = 0, mal = 0; const t = (c: boolean, m: string, x = "") => { console.log(c ? "ok   " : "FALLA", m, x); c ? ok++ : mal++; };

const AHORA = 1_000_000;
const J: Jugador[] = [{ id: "uAna", nombre: "Ana", entrada: 1, visto: AHORA }, { id: "uBeto", nombre: "Beto", entrada: 2, visto: AHORA }, { id: "uCris", nombre: "Cris", entrada: 3, visto: AHORA }];
const TODOS = ["Ana", "Beto", "Cris"];
const jug = (n: string) => J.find((j) => j.nombre === n)!;

/** Tres PJ (Aldo de Ana, Bruna de Beto, Carl de Cris) y un Ogro; `en` = quiénes entran en la iniciativa (en ese orden, con el Ogro tras el primero). */
const mk = (en: string[], criaturas = ["Ogro"]) => {
  const p = nuevaPartida(); normalizarPartida(p);
  const E = (n: string, d: object): any => ejecutar(n, d, p);
  ["Aldo", "Bruna", "Carl"].forEach((n, i) => E("guardar_personaje", { don_arcano: false, nombre: n, jugador: TODOS[i], raza: "Humano del Faro", clase: "Mercenario del Cuervo", nivel: 5, pv_max: 40, ca: 12, atributos: { fue: 16, des: 14, con: 14, int: 10, sab: 14, car: 10 }, inventario: [], dote: "Terco" }));
  for (const c of criaturas) E("aparecer_criatura", { nombre: c, repetir: true });
  const enemigos = Object.values(p.jefes).map((j) => j.nombre);
  E("iniciativa", { participantes: [...en, ...enemigos] });
  p.combate!.orden = [en[0], ...enemigos, ...en.slice(1)].map((n, i) => ({ nombre: n, total: 30 - i }));
  return { p, E, enemigos };
};
const paso = (p: any, quien: string, presentes = TODOS) => pasarPalabra(J, jug(quien), AHORA, undefined, p, presentes, {});
const dest = (r: ReturnType<typeof paso>) => r ? `${r.jugador.nombre}${r.nuevaRonda ? "+ronda" : ""}` : "null";

// ---- 1. un solo combatiente (Aldo de Ana) y dos jugadores que no están en la iniciativa
{
  const { p } = mk(["Aldo"]);
  // Estado anterior (el fallo): la iniciativa devuelve la palabra siempre a Ana; Beto y Cris no juegan hasta que acabe el combate.
  t(siguienteEnCombate(p, TODOS, {}, "Ana")!.jugador === "Ana", "(causa) la iniciativa sola devuelve la palabra a Ana: sin pasarPalabra, Beto y Cris quedarían bloqueados");
  const a = paso(p, "Ana")!;
  t(a.jugador.nombre === "Beto" && !a.nuevaRonda, "Ana (única en la iniciativa) cierra su turno y la palabra pasa a Beto, que no está en el combate", dest(a));
  t(a.combate?.cierraAsalto === true && a.combate.resolverAntes.length === 1, "el turno de Ana sigue resolviendo al Ogro y cerrando el asalto (reglas intactas)");
  t(a.entrada === undefined, "Beto actúa sin entrada de iniciativa");
  t(dest(paso(p, "Beto")) === "Cris", "Beto, que no combate, pasa a Cris");
  const c = paso(p, "Cris")!;
  t(c.jugador.nombre === "Ana" && c.entrada === "Aldo" && !c.nuevaRonda && c.combate === null, "tras el último jugador libre, la palabra vuelve a Ana con su entrada Aldo", dest(c));
}

// ---- 2. dos combatientes (Aldo y Bruna) y Cris fuera: Cris juega al cerrarse el asalto
{
  const { p } = mk(["Aldo", "Bruna"]);
  t(dest(paso(p, "Ana")) === "Beto" && paso(p, "Ana")!.entrada === "Bruna" && !paso(p, "Ana")!.combate!.cierraAsalto, "Ana → Beto por iniciativa (el asalto sigue abierto)");
  t(dest(paso(p, "Beto")) === "Cris", "Beto cierra el asalto: la palabra pasa a Cris, que no está en el combate");
  t(dest(paso(p, "Cris")) === "Ana", "Cris → Ana (primer jugador de la iniciativa)");
}

// ---- 3. todos en la iniciativa: igual que antes
{
  const { p } = mk(["Aldo", "Bruna", "Carl"]);
  t(dest(paso(p, "Ana")) === "Beto" && dest(paso(p, "Beto")) === "Cris" && dest(paso(p, "Cris")) === "Ana", "con todos en la iniciativa, el orden es el de siempre");
  t(paso(p, "Cris")!.combate!.cierraAsalto === true && paso(p, "Cris")!.entrada === "Aldo", "y cierra el asalto como siempre");
}

// ---- 4. fin del combate: vuelve la rotación normal de la mesa, desde quien actuó
{
  const { p, E } = mk(["Aldo"]);
  E("terminar_combate", {});
  t(!p.combate, "terminar_combate borra el combate");
  t(dest(paso(p, "Ana")) === "Beto", "acabado el combate, tras Ana toca a Beto (rotación normal)");
  t(dest(paso(p, "Beto")) === "Cris" && dest(paso(p, "Cris")) === "Ana+ronda", "y Cris da la vuelta: nueva ronda de la mesa");
}
// Con todos combatiendo y otra iniciativa (Carl, Bruna, Aldo), el fin del combate a manos de Cris debe seguir la mesa (Ana), no la iniciativa (Beto).
{
  const { p, E } = mk(["Carl", "Bruna", "Aldo"]);
  const antes = paso(p, "Cris")!;
  t(antes.jugador.nombre === "Beto", "(causa) durante el combate, tras Cris la iniciativa da la palabra a Beto", dest(antes));
  E("terminar_combate", {});
  t(dest(paso(p, "Cris")) === "Ana+ronda", "si Cris cierra el combate, la mesa sigue con Ana (nadie se salta ni se repite)");
}

// ---- 5. combate sin rivales vivos: no ata a la mesa
{
  const { p } = mk(["Aldo"]);
  Object.values(p.jefes).forEach((j) => { j.pv = 0; });
  t(dest(paso(p, "Ana")) === "Beto" && paso(p, "Ana")!.combate === null, "sin enemigos vivos, rotación normal (Ana → Beto) y sin turnos de combate");
  t(dest(paso(p, "Cris")) === "Ana+ronda", "sin enemigos vivos, Cris da la vuelta a la ronda de la mesa");
}

// ---- 6. un jugador libre desconectado se salta; el control prestado cuenta como estar en la iniciativa
{
  const { p } = mk(["Aldo"]);
  const js = J.map((j) => (j.nombre === "Beto" ? { ...j, visto: 0 } : j));
  const r = pasarPalabra(js, js[0], AHORA, undefined, p, ["Ana", "Cris"], {})!;
  t(r.jugador.nombre === "Cris", "un jugador libre desconectado no recibe la palabra", dest(r));
  const q = pasarPalabra(J, jug("Beto"), AHORA, undefined, p, TODOS, {}, undefined)!;
  t(q.jugador.nombre === "Cris", "Beto sigue su turno aunque la iniciativa no lo incluya", dest(q));
}

// ---- 7. el DM sabe que el actuante no está en el combate
{
  const b = bloqueTurnos({ actuante: "Beto", orden: TODOS, ronda: 1, siguiente: "Cris", cierraRonda: false, fueraDelCombate: true });
  t(/combate en curso en el que Beto NO participa/.test(b) && /Cris/.test(b), "el bloque del DM avisa de que Beto no participa en el combate en curso");
  const sin = bloqueTurnos({ actuante: "Beto", orden: TODOS, ronda: 1, siguiente: "Cris", cierraRonda: false });
  t(!/combate/i.test(sin), "sin la marca, el bloque es el de siempre");
}

console.log(`${ok} ok, ${mal} fallas`);
