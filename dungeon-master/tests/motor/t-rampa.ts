// Rampa de los niveles 3-4 (docs/BALANCE.md, tercera corrida): tope firme de peligro del sorteo de encuentros por nivel medio del grupo
// y jefes fuera de su zona en persona solo desde el nivel 7. Los dados van fijos: ninguna prueba depende del azar.
import { nuevaPartida, normalizarPartida } from "../../src/estado.ts";
import { ejecutar } from "../../src/herramientas.ts";
import { TABLA, topePeligro, NIVEL_JEFE_EN_PERSONA, sortearEncuentro, REGLAS_ENCUENTROS } from "../../src/encuentros.ts";
import { iniciarRegistroDados, liberarDados } from "../../src/dados.ts";
import { sistemaWeb } from "../../src/prompt-web.ts";

let ok = 0, mal = 0;
const t = (c: boolean, m: string, x = "") => { console.log(c ? "ok   " : "FALLA", m, x); c ? ok++ : mal++; };

const grupo = (niveles: number[]) => {
  const p = nuevaPartida(); normalizarPartida(p);
  niveles.forEach((nivel, i) => ejecutar("guardar_personaje", { don_arcano: false, nombre: `P${i}`, jugador: `P${i}`, raza: "Humano del Faro", clase: "Mercenario del Cuervo", nivel, pv_max: 40, ca: 14, atributos: { fue: 15, des: 13, con: 14, int: 10, sab: 12, car: 8 }, inventario: ["Espada larga"] }, p));
  return p;
};
const peligroDe = (txt: string): number => { const nombre = /Qué es: (.+?) \((combate|peligro|social|hallazgo)/.exec(txt)?.[1] ?? ""; return TABLA.find((x) => x.nombre === nombre)?.peligro ?? -1; };

// ---- el tope por nivel
t([1, 2, 3, 4, 5, 8, 9, 13].map(topePeligro).join(",") === "2,2,3,3,4,4,5,5", "tope de peligro: 2 (niveles 1-2), 3 (3-4), 4 (5-8) y 5 (desde el 9)");
t(NIVEL_JEFE_EN_PERSONA === 7, "un jefe fuera de su zona solo da la cara desde el nivel 7");

// ---- barrido determinista de la tirada del sorteo (d1000) en cada nivel y dificultad: nunca sale un peligro por encima del tope
{ let peor = 0, n = 0; const malos: string[] = [];
  for (const [nivel, dif, delta] of [[1, "media", 0], [2, "media", 0], [3, "media", 0], [4, "media", 0], [5, "media", 0], [3, "facil", -1], [4, "mortal", 1], [8, "media", 0]] as [number, string, number][]) {
    const tope = topePeligro(nivel) + delta; let maxVisto = 0;
    for (let v = 1; v <= 1000; v += 9) {
      const p = grupo([nivel, nivel, nivel, nivel]); p.encuentros = [];
      iniciarRegistroDados([{ caras: 1000, valor: v }, { caras: 100, valor: 50 }]);
      const salida = sortearEncuentro(p, { sin_jefe: true, dificultad: dif as any, region: "Marca Hueca" }); liberarDados();
      const pel = peligroDe(salida); n++; maxVisto = Math.max(maxVisto, pel);
      if (pel < 1 || pel > tope) malos.push(`n${nivel}/${dif}/d${v}: ${pel}`);
    }
    peor = Math.max(peor, maxVisto);
  }
  t(malos.length === 0 && n > 800, `el sorteo respeta el tope firme de peligro en ${n} tiradas fijas (niveles 1-5 y 8; fácil, media y mortal)`, malos.slice(0, 4).join(", "));
  // Con nivel 3 y dificultad media, la tabla SÍ tiene peligro 3 (no se queda corta) y ninguno de 4: el tope no vacía el sorteo.
  const vistos = new Set<number>();
  for (let v = 1; v <= 1000; v += 5) { const p = grupo([3, 3, 3, 3]); iniciarRegistroDados([{ caras: 1000, valor: v }, { caras: 100, valor: 50 }]); vistos.add(peligroDe(sortearEncuentro(p, { sin_jefe: true, region: "Marca Hueca" }))); liberarDados(); }
  t(vistos.has(3) && !vistos.has(4) && vistos.has(1), "nivel 3: salen peligros 1-3 y ninguno de 4", [...vistos].sort().join(","));
  const altos = new Set<number>();
  for (let v = 1; v <= 1000; v += 5) { const p = grupo([5, 5, 5, 5]); iniciarRegistroDados([{ caras: 1000, valor: v }, { caras: 100, valor: 50 }]); altos.add(peligroDe(sortearEncuentro(p, { sin_jefe: true, region: "Agujas" }))); liberarDados(); }
  t(altos.has(4), "nivel 5: el peligro 4 sí puede salir", [...altos].sort().join(",")); }

// ---- nivel medio redondeado: un grupo mixto 3-3-4-4 (media 3,5 → 4) sigue en el tope 3; 5-5-4-4 (4,5 → 5) sube al 4
{ const vistos = (niveles: number[]) => { const s = new Set<number>(); for (let v = 1; v <= 1000; v += 5) { const p = grupo(niveles); iniciarRegistroDados([{ caras: 1000, valor: v }, { caras: 100, valor: 50 }]); s.add(peligroDe(sortearEncuentro(p, { sin_jefe: true, region: "Agujas" }))); liberarDados(); } return s; };
  t(!vistos([3, 3, 4, 4]).has(4) && vistos([5, 5, 4, 4]).has(4), "el tope sigue al nivel medio redondeado del grupo"); }

// ---- jefe fuera de su zona: en persona solo desde el nivel 7 (d100 = 1 sería «en persona» si el nivel llegara)
{ const modo = (nivel: number) => { const p = grupo([nivel, nivel, nivel, nivel]); iniciarRegistroDados([{ caras: 100, valor: 1 }, { caras: 2, valor: 1 }, { caras: 100, valor: 1 }]); const s = sortearEncuentro(p, { jefe: "Kuru", region: "Marca Hueca" }); liberarDados(); return /Presencia: ([A-Z]+)/.exec(s)?.[1] ?? "?"; };
  t(modo(5) !== "EN" && modo(6) !== "EN" && modo(5) !== "?", "nivel 5-6: Kuru (mínimo 4) ya no aparece en persona", `${modo(5)}/${modo(6)}`);
  t(modo(7) === "EN", "nivel 7: Kuru puede dar la cara (d100 bajo)", modo(7)); }

// ---- la regla del prompt lo dice, y el prompt completo sigue por debajo del umbral
t(/TOPE de peligro/.test(REGLAS_ENCUENTROS) && /nivel 7/.test(REGLAS_ENCUENTROS) && /emboscada excepcional/.test(REGLAS_ENCUENTROS), "REGLAS_ENCUENTROS: tope de peligro por nivel, jefes desde el 7 y emboscada excepcional");
t(sistemaWeb().length <= 67600, "el prompt completo sigue ≤ 67.600 caracteres", String(sistemaWeb().length));
console.log(`${ok} ok, ${mal} fallas`);
