// Efecto de los estados por tipo de daño (docs/BALANCE.md §18): una habilidad elemental de cada criatura contra un grupo de 4 (motor real: habilidad_criatura).
// El simulador de combate (simular.ts) tiene su propio resolutor y no pasa por el motor: no ve estos estados; esto mide cuántos PJ salen con estado.
// Uso: npx tsx tests/balance/estados.ts [--n 300] [--semilla 1] [--equipo ninguno|leve|fuerte]  (equipo: el grupo lleva la prenda con protección leve —material— o el encantamiento con resistencia completa contra el tipo de la habilidad; BALANCE §20)
import { nuevaPartida, normalizarPartida } from "../../src/estado.ts";
import { ejecutar } from "../../src/herramientas.ts";

const argv = process.argv.slice(2);
const opt = (n: string, def: string) => { const i = argv.indexOf(`--${n}`); return i >= 0 && argv[i + 1] ? argv[i + 1] : def; };
const N = Number(opt("n", "300")), SEMILLA = Number(opt("semilla", "1")), EQUIPO = opt("equipo", "ninguno");
let estado = (SEMILLA * 2654435761) | 0 || 1;
const mulberry = (): number => { estado = (estado + 0x6d2b79f5) | 0; let t = Math.imul(estado ^ (estado >>> 15), 1 | estado); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return (t ^ (t >>> 14)) >>> 0; };
(globalThis.crypto as unknown as { getRandomValues: (b: Uint32Array) => Uint32Array }).getRandomValues = (b: Uint32Array) => { b[0] = mulberry(); return b; };

// leve = material rudimentario (−2 por golpe y ventaja en el estado); fuerte = encantamiento (mitad del daño); los tipos sin material (necrótico, psíquico) no tienen «leve»
const CASOS: { criatura: string; habilidad: string; leve?: string; fuerte: string }[] = [
  { criatura: "Elemental de fuego", habilidad: "Oleada de fuego", leve: "Cuero de dragón de ceniza", fuerte: "Cota de mallas ignífuga [O1]" },
  { criatura: "Dragón joven de ceniza", habilidad: "Aliento de ceniza", leve: "Cuero de dragón de ceniza", fuerte: "Cota de mallas ignífuga [O1]" },
  { criatura: "Lich", habilidad: "Rayo de muerte", fuerte: "Cota de mallas de los vivos [O1]" },
  { criatura: "Banshee del Velo", habilidad: "Lamento", fuerte: "Cota de mallas del Velo Mudo [O1]" },
  { criatura: "Ulfhedinn", habilidad: "Ceniza de la furia", leve: "Cuero de dragón de ceniza", fuerte: "Cota de mallas ignífuga [O1]" },
];
const ESTADOS = /^(quemado|paralizado|ralentizado|corroído|envenenado|debilitado|cegado|ensordecido|derribado|asustado|aturdido)/;
// Grupo de 4 (PV, CA y atributos orientativos por nivel)
const grupo = (nivel: number) => ({ pv: 12 + nivel * 9, ca: 13 + Math.floor(nivel / 4) });

console.log(`### Estados por daño elemental: una habilidad contra un grupo de 4 (${N} repeticiones por celda; equipo: ${EQUIPO})\n`);
console.log("| Criatura · habilidad | Nivel | % PJ que fallan la salvación de la habilidad | % PJ que acaban con estado | Daño medio por PJ (PV) | Estados más frecuentes |\n|---|---|---|---|---|---|");
for (const c of CASOS) for (const nivel of [1, 5, 9, 13]) {
  let fallan = 0, conEstado = 0, total = 0, perdido = 0; const cuenta: Record<string, number> = {};
  for (let i = 0; i < N; i++) {
    const p = nuevaPartida(); normalizarPartida(p); const E = (n: string, d: object): any => ejecutar(n, d, p);
    const g = grupo(nivel);
    const nombres = ["A", "B", "C", "D"];
    for (const n of nombres) E("guardar_personaje", { don_arcano: false, nombre: n, jugador: n, raza: "Humano del Faro", clase: "Mercenario del Cuervo", nivel, pv_max: g.pv * 100, ca: g.ca, atributos: { fue: 16, des: 14, con: 14, int: 10, sab: 12, car: 10 }, inventario: EQUIPO === "fuerte" ? [c.fuerte] : EQUIPO === "leve" && c.leve ? [c.leve] : [], dote: "Terco" });
    E("aparecer_criatura", { nombre: c.criatura });
    const r = E("habilidad_criatura", { criatura: Object.values(p.jefes)[0].nombre, habilidad: c.habilidad, objetivos: nombres });
    const texto: string = r.contenido ?? "";
    fallan += (texto.match(/→ fallo\n/g) ?? []).length; // salvación de la habilidad
    for (const n of nombres) { total++; perdido += p.personajes[n].pv_max - p.personajes[n].pv; const e = p.personajes[n].condiciones.find((x) => ESTADOS.test(x)); if (e) { conEstado++; const k = e.split(" ")[0]; cuenta[k] = (cuenta[k] ?? 0) + 1; } }
  }
  const top = Object.entries(cuenta).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${((100 * v) / total).toFixed(0)}%`).join(", ") || "—";
  console.log(`| ${c.criatura} · ${c.habilidad} | ${nivel} | ${((100 * fallan) / total).toFixed(0)} % | ${((100 * conEstado) / total).toFixed(0)} % | ${(perdido / total).toFixed(1)} | ${top} |`);
}
