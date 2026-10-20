// La Compañía del Cuervo Negro como organización: sus dos mariscales (Hugin y Munin), el concurso de méritos con el
// que ceden el puesto cada 4 años, y la herramienta que lo puntúa. Los mariscales son PNJ del bestiario.
import { tirar } from "./dados.js";
import type { Partida, Personaje } from "./estado.js";
import { puntos } from "./leyenda.js";
import { mod, valor } from "./reglas.js";

export const PUNTOS_MINIMOS = 24; // de 40: por debajo, los aspirantes no están a la altura

export const REGLAS_COMPANIA = `## La Compañía del Cuervo Negro
- Es una organización con rangos (Polluelo, Cuervo, Garra, Corax, Ala Mayor) y cuarteles en varios lugares, todos de la misma Compañía; su cuartel general está en Aldenmar. La dirigen dos mariscales, Hugin y Munin (ver sus fichas con consultar_reglas {tema: "criatura", nombre}).
- El puesto de mariscal solo se ocupa por renuncia o muerte de quien lo tiene. Pero ambos están obligados a ceder el cargo mediante un concurso de méritos cada 4 años, alternando: primero el de Hugin, cuatro años después el de Munin, y así (cada puesto se disputa cada 8 años). Cuándo toca en la historia lo decides tú según el contexto.
- Concursa cualquier Ala Mayor (nivel 11 o más de rango). El mérito se mide en cuatro cosas: las hazañas, el clamor de la tropa (los votos), la fuerza en combate (un combate de prueba que llevas con atacar) y la decisión de los mariscales. Puntúalo con la herramienta concurso_compania (cada criterio de 0 a 10; mínimo ${PUNTOS_MINIMOS} de 40 para ganar).
- Si ningún aspirante está a la altura, Hugin o Munin siguen en el puesto o eligen a alguien que consideren capaz. Si un mariscal se niega a ceder, el otro tiene la obligación de deponerlo en el acto, por la fuerza.`;

export interface Candidato {
  nombre: string;
  /** Hazañas 0-10 (en un personaje jugador se calcula de su fama si no se da). */
  hazanas?: number;
  /** Votos de la tropa 0-10 (en un personaje jugador, si no se da, se tira: 1d10 + mod. CAR). */
  clamor?: number;
  /** Combate de prueba 0-10 (obligatorio). */
  combate: number;
  /** Decisión de los mariscales 0-10 (obligatoria). */
  decision: number;
}

const clamp = (n: number) => Math.max(0, Math.min(10, Math.round(n)));
const norm = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

export function concurso(partida: Partida, d: { puesto: "Hugin" | "Munin"; candidatos: Candidato[]; aplicar?: boolean }): string {
  if (d.candidatos.length < 1) throw new Error("Hace falta al menos un aspirante.");
  const filas = d.candidatos.map((c) => {
    const p: Personaje | undefined = Object.values(partida.personajes).find((x) => norm(x.nombre) === norm(c.nombre));
    if (p) {
      if (p.clase !== "Mercenario del Cuervo") throw new Error(`${p.nombre} no es de la Compañía (no es Mercenario del Cuervo): no puede concursar.`);
      if (p.nivel < 11) throw new Error(`${p.nombre} es nivel ${p.nivel}: para concursar hay que ser Ala Mayor (nivel 11 o más).`);
      if (p.condiciones.includes("muerto")) throw new Error(`${p.nombre} está muerto.`);
    }
    const haz = c.hazanas !== undefined ? clamp(c.hazanas) : p ? clamp(puntos(p.leyenda).total / 3) : undefined;
    if (haz === undefined) throw new Error(`${c.nombre} no es un personaje jugador: di sus hazañas (0-10).`);
    let clamorTxt = "";
    let clamor: number;
    if (c.clamor !== undefined) clamor = clamp(c.clamor);
    else if (p) {
      const t = tirar("1d10");
      clamor = clamp(t.total + mod(valor(p, "car")));
      clamorTxt = ` (tirada 1d10 [${t.total}] + CAR)`;
    } else throw new Error(`${c.nombre} no es un personaje jugador: di el clamor de la tropa (0-10).`);
    const combate = clamp(c.combate), decision = clamp(c.decision);
    const total = haz + clamor + combate + decision;
    return { c, p, haz, clamor, clamorTxt, combate, decision, total };
  });
  filas.sort((a, b) => b.total - a.total || b.combate - a.combate);
  const mejor = filas[0];
  const lineas = filas.map((f) => `- ${f.c.nombre}: hazañas ${f.haz} + clamor ${f.clamor}${f.clamorTxt} + combate ${f.combate} + decisión de los mariscales ${f.decision} = ${f.total}/40`);
  let veredicto: string;
  if (mejor.total < PUNTOS_MINIMOS) {
    veredicto = `Ningún aspirante llega a ${PUNTOS_MINIMOS}: no están a la altura. ${d.puesto} puede seguir en el puesto o elegir a alguien que considere capaz (decídelo según su carácter y la historia).`;
  } else {
    veredicto = `GANA ${mejor.c.nombre} (${mejor.total}/40): ${d.puesto} le cede el puesto de mariscal${filas[1] && filas[1].total === mejor.total ? " (desempate por la fuerza en combate)" : ""}.`;
    if (d.aplicar && mejor.p) {
      mejor.p.mariscal = d.puesto;
      veredicto += ` ${mejor.p.nombre} es ahora ${d.puesto}, mariscal de la Compañía del Cuervo Negro.`;
    }
  }
  return `Concurso de méritos por el puesto de ${d.puesto}:\n${lineas.join("\n")}\n${veredicto}\nSiguiente concurso: dentro de 4 años, para el puesto de ${d.puesto === "Hugin" ? "Munin" : "Hugin"}.`;
}
