// Rasgos de clase con usos limitados (Segundo aliento, Acción súbita…): el programa lleva cuántos usos quedan y
// los recupera con los descansos. El descanso corto dura una hora; el largo, ocho. Ninguno cura heridas: eso sigue
// siendo cosa del sistema de heridas (pasar_tiempo).
import { tirar } from "./dados.js";
import type { Partida, Personaje } from "./estado.js";
import { descansar as descansarMagia } from "./magia.js";
import { pvMaxEfectivo } from "./heridas.js";
import { efectos } from "./condiciones.js";

export interface DefRecurso {
  nombre: string;
  /** Nivel desde el que lo tiene. */
  desde: number;
  max: (p: Personaje) => number;
  recarga: "corto" | "largo";
  /** Qué ocurre al usarlo (además de gastar el uso). */
  efecto: (p: Personaje) => string;
}

export const RECURSOS_CLASE: Record<string, DefRecurso[]> = {
  "Mercenario del Cuervo": [
    {
      nombre: "Segundo aliento",
      desde: 1,
      max: () => 1,
      recarga: "corto",
      efecto: (p) => {
        const t = tirar("1d10");
        const max = pvMaxEfectivo(p);
        const antes = p.pv;
        p.pv = Math.min(max, p.pv + t.total + p.nivel);
        return `Segundo aliento: 1d10 [${t.total}] + nivel ${p.nivel} → recupera ${p.pv - antes} PV (${p.pv}/${max}). Es una acción adicional y no cierra heridas.`;
      },
    },
    {
      nombre: "Acción súbita",
      desde: 2,
      max: () => 1,
      recarga: "corto",
      efecto: (p) => `${p.nombre} se lanza a la acción: puede hacer UNA acción más en este turno (además de su acción normal). No concede un segundo ataque adicional si su rasgo de Ataque adicional no lo permite.`,
    },
  ],
};

const norm = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

const ALIENTO_LEYENDA: DefRecurso = {
  nombre: "Aliento de leyenda",
  desde: 1,
  max: () => 1,
  recarga: "largo",
  efecto: (p) => `${p.nombre} invoca su leyenda: la tirada de ataque, prueba o salvación que acaba de fallar cuenta como ÉXITO (en un ataque, como un impacto normal). Narra cómo su nombre pesa.`,
};

export function recursosDe(p: Personaje): { def: DefRecurso; max: number; gastados: number }[] {
  return [...(RECURSOS_CLASE[p.clase] ?? []), ...(p.leyenda?.coronada ? [ALIENTO_LEYENDA] : [])]
    .filter((d) => p.nivel >= d.desde)
    .map((def) => ({ def, max: def.max(p), gastados: Math.min(def.max(p), p.gastados?.[def.nombre] ?? 0) }));
}

export function textoRecursos(p: Personaje): string {
  const r = recursosDe(p);
  if (!r.length) return "";
  return `  Usos: ${r.map((x) => `${x.def.nombre} ${x.max - x.gastados}/${x.max} (${x.def.recarga === "corto" ? "descanso corto" : "descanso largo"})`).join(" · ")}`;
}

function personaje(partida: Partida, quien: string): Personaje {
  const n = norm(quien);
  const p = Object.values(partida.personajes).find((x) => norm(x.nombre) === n || (x.jugador && norm(x.jugador) === n));
  if (!p) throw new Error(`No hay ningún personaje llamado «${quien}».`);
  return p;
}

export function usarRecurso(partida: Partida, d: { quien: string; recurso: string; accion?: "usar" | "ver" }): string {
  const p = personaje(partida, d.quien);
  const lista = recursosDe(p);
  if (d.accion === "ver" || !d.recurso) return lista.length ? textoRecursos(p).trim() : `${p.nombre} no tiene rasgos con usos limitados.`;
  const r = lista.find((x) => norm(x.def.nombre) === norm(d.recurso)) ?? lista.find((x) => norm(x.def.nombre).includes(norm(d.recurso)));
  if (!r) throw new Error(`${p.nombre} no tiene «${d.recurso}». Tiene: ${lista.map((x) => x.def.nombre).join(", ") || "ningún rasgo con usos"}.`);
  if (p.condiciones.includes("muerto") || p.pv <= 0) throw new Error(`${p.nombre} está a 0 PV o muerto: no puede usar ${r.def.nombre}.`);
  if (efectos(p.condiciones).incapacitado) throw new Error(`${p.nombre} está incapacitado: no puede usar ${r.def.nombre}.`);
  if (r.gastados >= r.max) throw new Error(`${p.nombre} ya gastó ${r.def.nombre} (0/${r.max}); lo recupera con un ${r.def.recarga === "corto" ? "descanso corto o largo" : "descanso largo"}.`);
  (p.gastados ??= {})[r.def.nombre] = r.gastados + 1;
  return `${r.def.efecto(p)} Quedan ${r.max - r.gastados - 1}/${r.max}.`;
}

export function descanso(partida: Partida, d: { tipo: "corto" | "largo"; quienes?: string[] }): string {
  const pjs = d.quienes?.length ? d.quienes.map((q) => personaje(partida, q)) : Object.values(partida.personajes).filter((p) => !p.condiciones.includes("muerto"));
  if (!pjs.length) throw new Error("No hay personajes que descansen.");
  const horas = d.tipo === "corto" ? 1 : 8;
  if (partida.reloj) partida.reloj.segundos += horas * 3600;
  const lineas: string[] = [];
  for (const p of pjs) {
    if (p.pv <= 0) { lineas.push(`${p.nombre}: está a 0 PV; no descansa (necesita ser estabilizado y atendido).`); continue; }
    const rec = recursosDe(p).filter((x) => d.tipo === "largo" || x.def.recarga === "corto");
    for (const x of rec) if (x.gastados) delete p.gastados![x.def.nombre];
    descansarMagia(p, 0, "normal"); // el calor y el aliento bajan con la calma
    lineas.push(`${p.nombre}: ${rec.filter((x) => x.gastados).map((x) => x.def.nombre).join(", ") || "sin usos que recuperar"} recuperado${rec.some((x) => x.gastados) ? "s" : ""}; calor y aliento a cero.`);
  }
  return `Descanso ${d.tipo} (${horas} h${partida.reloj ? ", el reloj avanza" : ""}). No cura heridas ni PV por sí solo: para la convalecencia usa pasar_tiempo.\n${lineas.join("\n")}`;
}

export const REGLAS_RECURSOS = `## Rasgos con usos limitados y descansos
- Los rasgos de clase con usos (Segundo aliento y Acción súbita del Mercenario…) los lleva el programa: se gastan con usar_recurso (en la ficha verás «Usos: … 1/1») y se recuperan con descanso (corto: 1 hora; largo: 8 horas). No los apliques ni los cuentes tú. Segundo aliento y Acción súbita son acciones adicionales.
- Un descanso no cura heridas ni devuelve PV: eso sigue siendo pasar_tiempo y tratar_herida.`;
