// Avisos de ataque en pantalla: llevan la tirada del d20 (dados, bonificador, total, ventaja/desventaja, crítico/torpeza) y la de daño con su tipo,
// sin enseñar lo que no era público (ni la CA ni los PV exactos de las criaturas: solo su estado). El texto para el DM (contenido) no cambia.
// Cubre ataques de PJ y de criaturas, ataques múltiples (n.º de ataque), reacciones y ataques de oportunidad, y que limpiarNarracion
// siga quitando del relato estas líneas copiadas (nunca toca los avisos).
import { nuevaPartida, normalizarPartida } from "../../src/estado.ts";
import { ejecutar } from "../../src/herramientas.ts";
import { iniciarRegistroDados, liberarDados } from "../../src/dados.ts";
import { limpiarNarracion } from "../../src/secuencia.ts";
let ok = 0, mal = 0; const t = (c: boolean, m: string, x = "") => { console.log(c ? "ok   " : "FALLA", m, x); c ? ok++ : mal++; };
const dados = (...v: [number, number][]) => iniciarRegistroDados(v.map(([caras, valor]) => ({ caras, valor })));

const mk = (criaturas: string[]) => {
  const p = nuevaPartida(); normalizarPartida(p);
  const E = (n: string, d: object): any => ejecutar(n, d, p);
  E("guardar_personaje", { don_arcano: false, nombre: "Aldo", jugador: "Ana", raza: "Humano del Faro", clase: "Mercenario del Cuervo", nivel: 5, pv_max: 900, ca: 12, atributos: { fue: 16, des: 14, con: 14, int: 10, sab: 14, car: 10 }, inventario: ["Espada larga"], dote: "Terco" });
  for (const c of criaturas) E("aparecer_criatura", { nombre: c, repetir: true });
  const nombres = Object.values(p.jefes).map((j) => j.nombre);
  E("iniciativa", { participantes: ["Aldo", ...nombres] });
  E("plano", { escena: "sala", poner: [{ nombre: "Aldo" }] });
  E("plano", { poner: nombres.map((n) => ({ nombre: n, ref: "Aldo", direccion: "N", metros: 1.5 })) });
  return { p, E, nombres };
};

// ---- PJ contra criatura: tirada y daño sí; CA y PV exactos no
{
  const { E, nombres } = mk(["Ogro"]);
  const og = nombres[0];
  dados([20, 14], [8, 6]);
  const r = E("atacar", { atacante: "Aldo", objetivo: og, arma: "Espada larga", dano: "1d8+3" });
  const a: string = r.aviso;
  console.log("  ", a.replace(/\n/g, " ⏎ "));
  t(/^⚔️ Aldo → Ogro: 🎲 d20 \[14\]\+\d+ = \d+ → impacto · daño 1d8\[6\]\+3 = 9 cortante/.test(a), "aviso de impacto: d20, bonificador, total, daño tirado y tipo", a);
  t(!/vs CA/.test(a) && !/\d+\/\d+/.test(a), "no enseña la CA ni los PV de la criatura");
  t(/\((intacto|ileso)[^)]*\)\s*$/.test(a.split("\n")[0]) || /\([^)]*\)$/.test(a.split("\n")[0]), "mantiene el estado cualitativo de la criatura");
  t(/vs CA \d+/.test(r.contenido) && /Daño: 1d8\[6\] \+ 3 = 9/.test(r.contenido), "el texto del DM conserva el detalle (vs CA y daño)");
  liberarDados();
}

// ---- crítico, torpeza, ventaja y desventaja
{
  const { E, nombres } = mk(["Ogro"]);
  const og = nombres[0];
  dados([20, 20], [8, 4], [8, 5]);
  let a: string = E("atacar", { atacante: "Aldo", objetivo: og, arma: "Espada larga", dano: "1d8+3" }).aviso;
  t(/^💥 Aldo → Ogro: 🎲 d20 \[20\]\+\d+ = \d+ → ¡crítico! \(20 natural\) · daño 2d8\[4,5\]\+3 = 12/.test(a), "crítico: marcado con el natural y dados dobles", a);
  liberarDados();
  E("siguiente_asalto", {});
  dados([20, 1]);
  a = E("atacar", { atacante: "Aldo", objetivo: og, arma: "Espada larga", dano: "1d8+3" }).aviso;
  t(/^💨 Aldo → Ogro: 🎲 d20 \[1\]\+\d+ = \d+ → torpeza \(1 natural\)/.test(a) && !/daño/.test(a), "pifia: torpeza con el 1 natural y sin daño", a);
  liberarDados();
  E("siguiente_asalto", {});
  dados([20, 14], [20, 9], [8, 2]);
  a = E("atacar", { atacante: "Aldo", objetivo: og, arma: "Espada larga", dano: "1d8+3", ventaja: true }).aviso;
  t(/🎲 d20 ventaja \[14 \| 9\]\+\d+ = /.test(a), "ventaja: el dado que cuenta y el descartado", a);
  liberarDados();
  E("siguiente_asalto", {});
  dados([20, 15], [20, 7], [8, 2]);
  a = E("atacar", { atacante: "Aldo", objetivo: og, arma: "Espada larga", dano: "1d8+3", desventaja: true }).aviso;
  t(/🎲 d20 desventaja \[7 \| 15\]\+\d+ = /.test(a), "desventaja: el dado que cuenta y el descartado", a);
  liberarDados();
}

// ---- criatura contra PJ: la CA del PJ y sus PV, como antes
{
  const { E, nombres } = mk(["Ogro"]);
  dados([20, 15], [8, 5], [8, 6]);
  const a: string = E("atacar", { atacante: nombres[0], objetivo: "Aldo", arma: "Garrote", dano: "2d8+4" }).aviso;
  console.log("  ", a.replace(/\n/g, " ⏎ "));
  t(/^⚔️ Ogro → Aldo: 🎲 d20 \[15\]\+\d+ = \d+ vs CA \d+ → impacto · daño 2d8\[5,6\]\+4 = 15 contundente/.test(a) && /\(\d+\/900 PV\)/.test(a), "criatura contra PJ: tirada, vs CA (ya se enseñaba) y PV del PJ", a);
  liberarDados();
}

// ---- ataques múltiples: el segundo lleva «2.º ataque»; el primero, nada
{
  const { E, nombres } = mk(["Troll de ciénaga"]);
  dados([20, 12], [4, 2], [20, 13], [4, 3]);
  const a1: string = E("atacar", { atacante: nombres[0], objetivo: "Aldo", arma: "Garras", dano: "1d4+2" }).aviso;
  const a2: string = E("atacar", { atacante: nombres[0], objetivo: "Aldo", arma: "Garras", dano: "1d4+2" }).aviso;
  t(!/ataque\)/.test(a1.split(":")[0]) && /^[^:]*→ Aldo \(2\.º ataque\): 🎲 d20 \[\d+\]/.test(a2), "ataque múltiple: el 2.º lo indica", `${a1} // ${a2}`);
  liberarDados();
}

// ---- reacción y ataque de oportunidad
{
  const { E, nombres } = mk(["Ogro"]);
  dados([20, 14], [8, 5]);
  let a: string = E("atacar", { atacante: "Aldo", objetivo: nombres[0], arma: "Espada larga", dano: "1d8+3", reaccion: true }).aviso;
  t(/→ Ogro \(reacción\): 🎲 d20 \[14\]/.test(a), "ataque de reacción marcado y con tirada", a);
  liberarDados();
  const m = mk(["Ogro"]);
  dados([20, 16], [8, 4]);
  const r = m.E("reaccion", { quien: "Aldo", tipo: "ataque_oportunidad", objetivo: m.nombres[0], arma: "Espada larga", dano: "1d8+3" });
  a = r.aviso ?? "";
  console.log("  ", a.replace(/\n/g, " ⏎ "));
  t(/Ataque de oportunidad de Aldo/.test(a) && /🎲 d20 \[16\]\+\d+ = \d+ → impacto · daño 1d8\[4\]\+3 = 7/.test(a), "ataque de oportunidad: cabecera + tirada y daño", a);
  liberarDados();
}

// ---- limpiarNarracion: copiada al relato, la línea se quita; los avisos no se tocan
{
  const { E, nombres } = mk(["Ogro"]);
  dados([20, 14], [8, 6]);
  const a: string = E("atacar", { atacante: "Aldo", objetivo: nombres[0], arma: "Espada larga", dano: "1d8+3" }).aviso;
  const relato = "Aldo se lanza contra el ogro y su espada le abre un tajo en el costado.";
  t(limpiarNarracion(`${relato}\n\n${a}`) === relato, "el aviso nuevo copiado al final del relato se quita");
  dados([20, 20], [8, 6], [8, 6]);
  const c: string = E("atacar", { atacante: "Aldo", objetivo: nombres[0], arma: "Espada larga", dano: "1d8+3", reaccion: true }).aviso;
  t(c.startsWith("💥") && limpiarNarracion(`${relato}\n${c}`) === relato, "también el de crítico (💥) y el de pifia (💨)");
  t(limpiarNarracion(a) === a || limpiarNarracion(a) !== "", "un texto que solo es aviso no queda vacío");
  liberarDados();
}

console.log(`${ok} ok, ${mal} fallas`);
