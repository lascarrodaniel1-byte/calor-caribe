// Coste del DM por turno: tamaño (caracteres y tokens aprox. = chars/4) de lo que recibe el modelo en tres escenarios
// (exploración con 4 PJ; combate por iniciativa con 4 PJ + 5 enemigos, clima, estilos y reacciones; combate con una acción programada)
// y de las partes más gruesas del estado. Informativo: uso `npx tsx tests/auditoria/entrada-dm.ts`. Ver docs/AUDITORIA_INTEGRACION.md.
import { nuevaPartida, normalizarPartida } from "../../src/estado.ts";
import { ejecutar } from "../../src/herramientas.ts";
import { estadoParaDM } from "../../src/navegador.ts";
import { sistemaWeb } from "../../src/prompt-web.ts";
import { bloqueTurnos, siguienteEnCombate, textoReaccionesPreparadas, lineaAccion, REGLA_PREPARADA } from "../../src/turnos.ts";

const P: any = nuevaPartida(); normalizarPartida(P);
const E = (n: string, d: object): any => ejecutar(n, d, P);
const grupo = [["Ana", "Flagelante", "Varg"], ["Beto", "Mercenario del Cuervo", "Humano del Faro"], ["Cleo", "Hechicero", "Elfo Marchito"], ["Dan", "Degollador", "Tritón de las Mareas"]] as const;
for (const [n, c, r] of grupo)
  E("guardar_personaje", { don_arcano: false, nombre: n, jugador: n, genero: "Femenino", raza: r, clase: c, nivel: 6, pv_max: 60, ca: 14, atributos: { fue: 16, des: 14, con: 14, int: 14, sab: 12, car: 10 }, inventario: ["Espada larga", "Daga", "Raciones de viaje (5)", "Odre de agua (2)"], dote: "Terco", ...(c === "Hechicero" ? { tipos_magia: ["fuego"], linaje: "noble" } : {}) });
E("arte_marcial", { accion: "aprender", quien: "Beto", arte: "Filo del Cuervo", via: "clase" });
E("tiempo", { fijar: { dia: 4, hora: 10 } }); P.calendario = { inicio: 225, anomalias: [] };
E("ubicacion", { lugar: "Pozonegro", region: "Aldenmar", tipo: "aldea" });
const nt = (s: string) => `${s.length} car. ≈ ${Math.round(s.length / 4)} tok`;
const partes = (e: string) => e.split(/\n\n(?=## )/).map((s) => [s.length, s.split("\n")[0].slice(0, 50)] as [number, string]).sort((a, b) => b[0] - a[0]);
const fijo = sistemaWeb(grupo.map((g) => g[1]), { artes: true });
console.log(`Prompt fijo (sistemaWeb típico con estilos): ${nt(fijo)}\n`);

const informe = (titulo: string, extra: string, foco = "Ana") => {
  const e = estadoParaDM(P, foco);
  console.log(`== ${titulo}\n  estado del DM: ${nt(e)} · bloque de turnos y acciones: ${nt(extra)} · TOTAL variable: ${nt(e + extra)} · con el prompt fijo: ${nt(fijo + e + extra)}`);
  console.log("  partes más gruesas del estado: " + partes(e).slice(0, 6).map(([n, t]) => `${t} (${n})`).join(" · "));
  return e;
};
informe("1. Exploración con 4 PJ", `# TURNOS\nOrden de la ronda 1: Ana → Beto → Cleo → Dan.\nAcaba de actuar: Ana. Narra SOLO su acción… (${"x".repeat(380)})\n# ACCIONES NUEVAS\nAna: Miro la sala`);

for (const c of ["Ogro", "Hambriento", "Troll de ciénaga", "Hambriento", "Ulfhedinn"]) E("aparecer_criatura", { nombre: c, repetir: true });
const enemigos = Object.values<any>(P.jefes).map((j) => j.nombre);
E("iniciativa", { participantes: ["Ana", "Beto", "Cleo", "Dan", ...enemigos] });
E("plano", { escena: "claro", poner: [{ nombre: "Ana" }] });
E("plano", { poner: [...["Beto", "Cleo", "Dan"].map((n, i) => ({ nombre: n, ref: "Ana", direccion: "N", metros: 1.5 * (i + 1) })), ...enemigos.map((n, i) => ({ nombre: n, ref: "Ana", direccion: "S", metros: 1.5 * (i + 1) }))] });
const turno = (actuante: string, programada = false) => {
  const sig = siguienteEnCombate(P, grupo.map((g) => g[0]), {}, actuante)!;
  const reac = textoReaccionesPreparadas(P, { u2: { reaccion: "Si atacan a Cleo, me interpongo", reaccionAsalto: P.combate.ronda } as any });
  const b = bloqueTurnos({ actuante, orden: grupo.map((g) => g[0]), ronda: 1, siguiente: sig.jugador, cierraRonda: false, preparada: programada, reacciones: reac, combate: { asalto: sig.asalto, orden: sig.orden, resolverAntes: sig.resolverAntes, cierraAsalto: sig.cierraAsalto, entrada: sig.entradaActuante } });
  return b;
};
informe("2. Combate: 4 PJ + 5 enemigos por iniciativa (clima, estilos, reacciones)", turno("Ana") + `\n\n# ACCIONES NUEVAS\n${lineaAccion({ nombre: "Ana", texto: "Ataco al ogro con mi espada" })}`);
informe("3. Combate con una acción programada", turno("Beto", true) + `\n\n# ACCIONES NUEVAS\n${lineaAccion({ nombre: "Beto", texto: "Ataco al troll", programada: true })}`, "Beto");
void REGLA_PREPARADA;
const e = estadoParaDM(P, "Ana"); console.log("\nLíneas más largas del estado (combate):\n" + e.split("\n").map((l) => [l.length, l.slice(0, 90)] as [number, string]).sort((a, b) => b[0] - a[0]).slice(0, 6).map((x) => x.join("  ")).join("\n"));
if (process.env.VER) { const x = estadoParaDM(P, "Ana"); console.log("\n---\n" + x.split(/\n\n(?=## )/).filter((s) => /^## (Criaturas|Combate en curso)/.test(s)).join("\n\n").slice(0, 3500)); }
