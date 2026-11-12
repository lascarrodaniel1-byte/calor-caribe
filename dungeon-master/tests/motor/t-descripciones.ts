// La descripción literaria de las criaturas en escena solo se le da al DM cuando aparecen (propuesta 2a de la auditoría):
// sin combate siempre; en combate, solo en el asalto de aparición. El resto de la ficha, la consulta explícita y el
// bestiario de los jugadores (códice) no cambian.
import { nuevaPartida, normalizarPartida } from "../../src/estado.ts";
import { ejecutar } from "../../src/herramientas.ts";
import { estadoParaDM } from "../../src/navegador.ts";
import { BESTIARIO, buscarCriatura, fichaCriatura } from "../../src/bestiario.ts";
import { bestiarioGrupo } from "../../src/codice.ts";
import { consultarReglas } from "../../src/prompt-web.ts";
let ok = 0, mal = 0; const t = (c: boolean, m: string, x = "") => { console.log(c ? "ok   " : "FALLA", m, x); c ? ok++ : mal++; };

const NOTA = `(descripción en consultar_reglas {tema: "criatura", nombre})`;
const mk = () => {
  const p = nuevaPartida(); normalizarPartida(p);
  const E = (n: string, d: object): any => ejecutar(n, d, p);
  for (const n of ["A", "B"]) E("guardar_personaje", { don_arcano: false, nombre: n, jugador: n, raza: "Humano del Faro", clase: "Mercenario del Cuervo", nivel: 5, pv_max: 900, ca: 12, atributos: { fue: 16, des: 14, con: 14, int: 10, sab: 14, car: 10 }, inventario: [], dote: "Terco" });
  return { p, E };
};
const ogro = buscarCriatura("Ogro")!, troll = buscarCriatura("Troll de ciénaga")!;
const bloque = (p: any) => estadoParaDM(p, "A").split(/\n\n(?=## )/).find((x) => x.startsWith("## Criaturas en escena")) ?? "";
const tieneFicha = (b: string, c: typeof ogro) => b.includes(`CA ${c.ca} · PV ${c.pv}`) && b.includes(`Ataques: ${c.ataques.join(" | ")}`) && c.habilidades.every((h) => b.includes(h.nombre));

// ---- sin combate: todo igual
{
  const { p, E } = mk(); E("aparecer_criatura", { nombre: "Ogro" });
  const b = bloque(p);
  t(b.includes(ogro.descripcion), "sin combate: la descripción está");
  t(!b.includes(NOTA), "sin combate: no hay nota");
  t(p.jefes["Ogro"].descritaEn === 0, "descritaEn = 0 sin combate");
  t(b.startsWith(`## Criaturas en escena (SECRETO)\n${fichaCriatura(ogro)}\nESTADO:`), "sin combate: el bloque es la ficha completa de siempre");
}

// ---- aparece antes del combate: el asalto 1 ya la omite, el 2 también
{
  const { p, E } = mk(); E("aparecer_criatura", { nombre: "Ogro" });
  const antes = bloque(p).length;
  E("iniciativa", { participantes: ["A", "B", "Ogro"] });
  const b1 = bloque(p);
  t(p.combate.ronda === 1 && !b1.includes(ogro.descripcion), "ya descrita antes del combate: en el asalto 1 se omite");
  t(tieneFicha(b1, ogro) && b1.includes("ESTADO:"), "se conservan CA, PV, ataques, habilidades y estado");
  t(b1.includes(NOTA), "aparece la nota de dónde recuperarla");
  t(b1.length === antes - ogro.descripcion.length - 1 + NOTA.length + 2, "el tamaño baja exactamente la descripción (y su salto de línea) más la nota", `${antes}→${b1.length}`);
  p.combate.ronda = 2;
  t(!bloque(p).includes(ogro.descripcion), "asalto 2: sigue omitida");
}

// ---- aparece a mitad de combate (asalto 3)
{
  const { p, E } = mk(); E("aparecer_criatura", { nombre: "Ogro" });
  E("iniciativa", { participantes: ["A", "B", "Ogro"] });
  p.combate.ronda = 3;
  const r = E("aparecer_criatura", { nombre: "Troll de ciénaga" });
  t(String(r.contenido ?? r).includes(troll.descripcion), "al aparecer, el resultado de la herramienta trae la ficha completa");
  t(p.jefes["Troll de ciénaga"].descritaEn === 3, "descritaEn = 3");
  let b = bloque(p);
  t(b.includes(troll.descripcion) && !b.includes(ogro.descripcion), "asalto 3: el troll con descripción, el ogro (anterior) sin ella");
  t(tieneFicha(b, ogro) && tieneFicha(b, troll), "asalto 3: ambas fichas conservan estadísticas y habilidades");
  t(b.split(NOTA).length === 2, "una sola nota para todas");
  p.combate.ronda = 4;
  b = bloque(p);
  t(!b.includes(troll.descripcion) && !b.includes(ogro.descripcion) && b.includes(NOTA), "asalto 4: ninguna descripción, con nota");
  t(tieneFicha(b, troll), "asalto 4: el troll conserva sus datos");
  delete (p as any).combate;
  t(bloque(p).includes(troll.descripcion) && bloque(p).includes(ogro.descripcion) && !bloque(p).includes(NOTA), "al acabar el combate vuelven las descripciones, sin nota");
}

// ---- partida antigua sin el campo
{
  const { p, E } = mk(); E("aparecer_criatura", { nombre: "Ogro" });
  delete p.jefes["Ogro"].descritaEn;
  t(bloque(p).includes(ogro.descripcion), "partida antigua sin combate: descripción presente");
  E("iniciativa", { participantes: ["A", "B", "Ogro"] });
  t(!bloque(p).includes(ogro.descripcion) && bloque(p).includes(NOTA), "partida antigua en combate: se omite desde el asalto 1 (ya descrita)");
}

// ---- consulta explícita completa
{
  const r = consultarReglas("criatura", "Ogro");
  t(r === fichaCriatura(ogro) && r.includes(ogro.descripcion), "consultar_reglas criatura: ficha completa con descripción");
  t(BESTIARIO.every((c) => fichaCriatura(c).includes(c.descripcion)), "fichaCriatura devuelve la descripción por defecto en las 45 criaturas");
}

// ---- los jugadores (códice) y el estado de la criatura no cambian
{
  const { p, E } = mk(); E("aparecer_criatura", { nombre: "Ogro" });
  const sin = JSON.stringify(bestiarioGrupo(p));
  E("iniciativa", { participantes: ["A", "B", "Ogro"] }); p.combate.ronda = 2;
  t(JSON.stringify(bestiarioGrupo(p)) === sin, "el bestiario del grupo (lo que ven los jugadores) no cambia con el combate");
  const b = bloque(p);
  E("danar_criatura", { nombre: "Ogro", cantidad: 10 });
  const b2 = bloque(p);
  t(b2.includes(`${p.jefes["Ogro"].pv}/${p.jefes["Ogro"].pv_max} PV`) && b2 !== b, "el estado (PV) sigue reflejándose en combate");
}
console.log(`${ok} ok, ${mal} fallas`);
