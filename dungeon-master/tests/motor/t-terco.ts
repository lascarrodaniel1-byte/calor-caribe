// Terco + herida: si la dote salva al personaje (queda en 1 PV), la herida de «Cae inconsciente» no lo deja inconsciente.
import { nuevaPartida, normalizarPartida } from "../../src/estado.ts";
import { ejecutar } from "../../src/herramientas.ts";
import { iniciarRegistroDados, liberarDados } from "../../src/dados.ts";
let ok = 0, mal = 0; const t = (c: boolean, m: string, x = "") => { console.log(c ? "ok   " : "FALLA", m, x); c ? ok++ : mal++; };
const txt = (r: any) => (typeof r === "string" ? r : r?.contenido ?? JSON.stringify(r));

/** Escenario: un PJ con 2 PV es golpeado en la cabeza por un Hambriento; dados fijados para una herida crítica en el encéfalo (zona roja, inconsciente). */
function escenario(dote: string, yaUsada = false) {
  const p = nuevaPartida(); normalizarPartida(p); const E = (n: string, d: object): any => ejecutar(n, d, p);
  E("guardar_personaje", { don_arcano: false, nombre: "Tez", jugador: "Tez", raza: "Humano del Faro", clase: "Mercenario del Cuervo", nivel: 1, pv_max: 20, ca: 12, atributos: { fue: 16, des: 14, con: 14, int: 10, sab: 10, car: 10 }, inventario: ["Espada larga"], dote });
  E("aparecer_criatura", { nombre: "Hambriento", repetir: true }); E("iniciativa", { participantes: ["Tez", "Hambriento"] });
  E("plano", { escena: "sala", poner: [{ nombre: "Tez" }] }); E("plano", { poner: [{ nombre: "Hambriento", ref: "Tez", direccion: "N", metros: 1.5 }] });
  p.personajes.Tez.pv = 2; if (yaUsada) (p.personajes.Tez.gastados ??= {})["Terco"] = 1;
  // d20: ataque (15) y gravedad (20 = crítica); d100: zona (99 = roja); d3: estructura (1 = encéfalo); d4: daño.
  iniciarRegistroDados([{ caras: 20, valor: 15 }, { caras: 20, valor: 20 }, { caras: 20, valor: 20 }, { caras: 100, valor: 99 }, { caras: 3, valor: 1 }, { caras: 3, valor: 1 }, { caras: 4, valor: 4 }, { caras: 4, valor: 4 }]);
  const r = txt(E("atacar", { atacante: "Hambriento", objetivo: "Tez", dano: "1d4", bono: 50, apuntar: "cabeza" }));
  liberarDados();
  return { p, E, r, tez: p.personajes.Tez };
}

{ const { tez, r, E } = escenario("Terco");
  t(/ZONA ROJA/.test(r) && /Cae inconsciente/.test(r), "el golpe abre una herida de zona roja con «Cae inconsciente»", r.slice(-200));
  t(tez.pv === 1, "Terco: se queda con 1 PV", String(tez.pv));
  t(!tez.condiciones.includes("inconsciente"), "Terco: NO queda inconsciente por la herida", tez.condiciones.join(","));
  t(tez.heridas.length === 1 && tez.heridas[0].zona_vital === "roja" && tez.heridas[0].sangrando, "la herida sigue abierta y sangrando (zona roja)");
  t(!tez.muerte, "no hay cuenta de salvaciones contra muerte");
  t(!!tez.gastados?.["Terco"], "Terco queda gastado hasta el descanso largo");
  const a = E("atacar", { atacante: "Tez", objetivo: "Hambriento", dano: "1d4", bono: 50 });
  t(!/inconsciente/i.test(txt(a)), "puede actuar: su ataque no se rechaza por inconsciente", txt(a).slice(0, 120)); }

{ const { tez, r } = escenario("Terco", true);
  t(/ZONA ROJA/.test(r), "dote ya usada: la herida se abre igual");
  t(tez.pv === 0 && tez.condiciones.includes("inconsciente") && !!tez.muerte, "dote ya usada: cae a 0 PV inconsciente y con salvaciones contra muerte (sin cambios)", `${tez.pv} ${tez.condiciones.join(",")}`); }

{ const { tez } = escenario("Cicatrizado");
  t(tez.pv === 0 && tez.condiciones.includes("inconsciente"), "sin Terco: cae a 0 PV inconsciente (sin cambios)"); }

console.log(`\n${ok} ok, ${mal} fallas`);
process.exit(mal ? 1 : 0);
