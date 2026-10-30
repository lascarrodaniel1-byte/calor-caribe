// Enfermedades de Velmora: se contraen por exposición (agua sucia, ratas, ceniza, mordiscos de muertos), incuban, avanzan por días
// con salvaciones de CON (el reloj las cuenta solo), empeoran o se curan, y algunas se contagian. Se tratan con medicina, hierbas o magia.
import { agregarCondicion, nivelAgotamiento } from "./condiciones.js";
import { tirar } from "./dados.js";
import type { Partida, Personaje } from "./estado.js";
import { tiene } from "./dotes_base.js";
import { raza } from "./mundo.js";
import { resolverPrueba } from "./pruebas.js";
import { marcarMuerto, salvacion } from "./reglas.js";
import { textoReloj } from "./espacio.js";

export type Etapa = "incubando" | "leve" | "grave" | "critica";
const DIA = 86400;

export interface DefEnfermedad {
  id: string;
  nombre: string;
  /** Cómo se pilla (para que el DM sepa cuándo exponer). */
  via: string;
  /** CD de la salvación de CON al exponerse. */
  cd: number;
  /** Días de incubación (dados). */
  incubacion: string;
  /** Cada cuántos días se hace la salvación. */
  intervalo: number;
  /** Salvaciones superadas para curarse y falladas para el final. */
  exitos: number;
  fallos: number;
  contagio?: { cd: number; como: string };
  /** Daño por día mientras dura (dados), si lo hay. */
  danoDia?: string;
  /** Lo que pasa a quien llega al final. */
  sintomas: Record<Exclude<Etapa, "incubando">, string>;
  /** CD de la prueba de Medicina para cuidarlo. */
  cd_tratar: number;
  cura: string;
}

export const ENFERMEDADES: DefEnfermedad[] = [
  { id: "fiebre_cienaga", nombre: "Fiebre de las ciénagas", via: "agua estancada y mosquitos de las Ciénagas de Hollín", cd: 12, incubacion: "1d4", intervalo: 1, exitos: 3, fallos: 3, cd_tratar: 12,
    sintomas: { leve: "escalofríos y sudor frío", grave: "fiebre alta que nubla la cabeza", critica: "delirio y temblores; no se tiene en pie" }, cura: "reposo, cuidados y hierbas; se pasa con tres salvaciones superadas" },
  { id: "tos_ceniza", nombre: "Tos de ceniza", via: "respirar polvo de ceniza en la Marca Hueca o en las minas de Karak-Dûm", cd: 13, incubacion: "3d4", intervalo: 3, exitos: 3, fallos: 3, cd_tratar: 13,
    sintomas: { leve: "tos seca que delata al que se esconde", grave: "falta de aire y esputos negros", critica: "los pulmones se llenan de hollín; apenas respira" }, cura: "aire limpio lejos de la ceniza (+4) y cuidados" },
  { id: "peste_ratas", nombre: "Peste de las ratas", via: "pulgas de rata, alcantarillas y ciudades en hambruna", cd: 13, incubacion: "2d4", intervalo: 1, exitos: 3, fallos: 3, cd_tratar: 14, danoDia: "1d4", contagio: { cd: 11, como: "contacto cercano y ropa compartida" },
    sintomas: { leve: "bubones en las ingles y las axilas", grave: "bubones negros y reventando; fiebre", critica: "gangrena y delirio" }, cura: "abrir los bubones (Medicina CD 14), hierbas y aislamiento" },
];

export const buscarEnfermedad = (n: string): DefEnfermedad | undefined => {
  const x = n.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, "_");
  return ENFERMEDADES.find((e) => e.id === x || e.nombre.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, "_") === x);
};

export interface Enfermedad {
  id: string;
  etapa: Etapa;
  /** Segundos del reloj de la próxima salvación (o del fin de la incubación). */
  t: number;
  exitos: number;
  fallos: number;
  /** Cuidados recibidos: bono a las próximas salvaciones y cuántas. */
  bono?: number;
  bono_veces?: number;
}

const vivos = (partida: Partida) => Object.values(partida.personajes).filter((p) => !p.condiciones.includes("muerto"));
const ESTADO = /^enfermedad (leve|grave|crítica):/i;

function ponerCondicion(p: Personaje): void {
  p.condiciones = p.condiciones.filter((c) => !ESTADO.test(c));
  const orden: Record<string, number> = { leve: 1, grave: 2, critica: 3 };
  let peor: { e: Enfermedad; d: DefEnfermedad } | undefined;
  for (const e of p.enfermedades ?? []) {
    const d = buscarEnfermedad(e.id);
    if (d && e.etapa !== "incubando" && (!peor || orden[e.etapa] > orden[peor.e.etapa])) peor = { e, d };
  }
  if (peor) p.condiciones.push(`enfermedad ${peor.e.etapa === "critica" ? "crítica" : peor.e.etapa}: ${peor.d.nombre} (${peor.d.sintomas[peor.e.etapa as "leve"]})`);
}

function subirAgotamiento(p: Personaje): string {
  const n = Math.min(6, nivelAgotamiento(p.condiciones) + 1);
  agregarCondicion(p.condiciones, `agotamiento ${n}`);
  if (n >= 6) { marcarMuerto(p); return `☠ ${p.nombre} muere de agotamiento.`; }
  return `agotamiento ${n}`;
}

function extraSalvacion(p: Personaje): number {
  return raza(p.raza)?.curacion.infeccion ?? 0;
}

/** Expone a un personaje: salvación de CON (ventaja con Cicatrizado); si falla, empieza a incubar. */
export function exponer(partida: Partida, p: Personaje, d: DefEnfermedad, cd?: number): string {
  if (!partida.reloj) throw new Error("El reloj no está fijado (tiempo fijar): sin él no se cuentan los días de la enfermedad.");
  if (p.enfermedades?.some((e) => e.id === d.id)) return `${p.nombre} ya tiene ${d.nombre}.`;
  const s = salvacion(p, "con", cd ?? d.cd, { extra: extraSalvacion(p), ventaja: tiene(p, "cicatrizado") });
  if (s.exito) return `${p.nombre} se expone a ${d.nombre}: ${s.texto} → la resiste.`;
  const dias = tirar(d.incubacion).total;
  (p.enfermedades ??= []).push({ id: d.id, etapa: "incubando", t: partida.reloj.segundos + dias * DIA, exitos: 0, fallos: 0 });
  return `${p.nombre} se expone a ${d.nombre}: ${s.texto} → ¡CONTAGIADO! Incuba ${dias} día(s): aún no lo sabe (no se lo digas hasta que aparezcan los síntomas).`;
}

/** El reloj hace avanzar las enfermedades: fin de la incubación, salvaciones diarias, empeoramiento, curación, contagio y muerte. */
export function procesarEnfermedades(partida: Partida): string[] {
  if (!partida.reloj) return [];
  const ahora = partida.reloj.segundos;
  const out: string[] = [];
  for (const p of vivos(partida)) {
    for (const e of [...(p.enfermedades ?? [])]) {
      const d = buscarEnfermedad(e.id);
      if (!d) continue;
      let guardia = 0;
      while (e.t <= ahora && guardia++ < 60 && !p.condiciones.includes("muerto")) {
        if (e.etapa === "incubando") {
          e.etapa = "leve";
          e.t += d.intervalo * DIA;
          out.push(`🤒 ${p.nombre} empieza a notar ${d.nombre}: ${d.sintomas.leve}.`);
          ponerCondicion(p);
          continue;
        }
        if (d.danoDia) { const dano = tirar(d.danoDia).total; p.pv = Math.max(0, p.pv - dano); out.push(`${p.nombre} pierde ${dano} PV por ${d.nombre}.`); }
        const bono = e.bono_veces ? e.bono ?? 0 : 0;
        if (e.bono_veces) e.bono_veces--;
        const s = salvacion(p, "con", d.cd, { extra: extraSalvacion(p) + bono, ventaja: tiene(p, "cicatrizado") });
        if (s.exito) {
          e.exitos++;
          if (e.exitos >= d.exitos) {
            p.enfermedades = (p.enfermedades ?? []).filter((x) => x !== e);
            ponerCondicion(p);
            out.push(`💚 ${p.nombre} se cura de ${d.nombre} (${s.texto}). Queda débil: el agotamiento se va con descansos tras comer y beber.`);
            break;
          }
          out.push(`${p.nombre} resiste ${d.nombre} otro día (${e.exitos}/${d.exitos}).`);
        } else {
          e.fallos++;
          if (e.fallos >= d.fallos) {
            marcarMuerto(p);
            out.push(`☠ ${p.nombre} muere de ${d.nombre}.`);
            break;
          }
          const nueva: Etapa = e.fallos >= 2 ? "critica" : "grave";
          if (nueva !== e.etapa) { e.etapa = nueva; out.push(`${p.nombre} empeora (${d.nombre}): ${d.sintomas[nueva]}. ${subirAgotamiento(p)}.`); }
          else out.push(`${p.nombre} sigue empeorando (${d.nombre}, fallos ${e.fallos}/${d.fallos}).`);
        }
        ponerCondicion(p);
        // Contagio: los compañeros que no se aíslan pueden pillarlo cada día.
        if (d.contagio) {
          for (const o of vivos(partida)) {
            if (o === p || o.aislado || o.enfermedades?.some((x) => x.id === d.id)) continue;
            const c = exponer(partida, o, d, d.contagio.cd);
            if (/CONTAGIADO/.test(c)) out.push(`${c} (${d.contagio.como})`);
          }
        }
        e.t += d.intervalo * DIA;
      }
    }
    if (p.enfermedades && !p.enfermedades.length) delete p.enfermedades;
  }
  return out;
}

export interface DatosEnfermedad {
  accion: "catalogo" | "exponer" | "tratar" | "curar" | "aislar" | "ver";
  enfermedad?: string;
  quienes?: string[];
  cd?: number;
  /** tratar: quién cuida, y cómo. */
  sanador?: string;
  metodo?: "cuidados" | "hierbas" | "remedio_raro" | "magia_divina";
  aislado?: boolean;
}

const norm = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
function pjs(partida: Partida, nombres?: string[]): Personaje[] {
  if (!nombres?.length) return vivos(partida);
  return nombres.map((n) => {
    const p = vivos(partida).find((x) => norm(x.nombre) === norm(n) || (x.jugador && norm(x.jugador) === norm(n)));
    if (!p) throw new Error(`No hay ningún personaje vivo «${n}».`);
    return p;
  });
}

export function enfermedad(partida: Partida, d: DatosEnfermedad): { texto: string; publico: string | null } {
  if (d.accion === "catalogo")
    return { texto: ENFERMEDADES.map((e) => `- ${e.nombre} (${e.id}): ${e.via}. CD ${e.cd}, incuba ${e.incubacion} días, salvación cada ${e.intervalo} día(s) (${e.exitos} éxitos curan, ${e.fallos} fallos matan). Cura: ${e.cura}.${e.contagio ? ` Contagiosa (${e.contagio.como}).` : ""}`).join("\n"), publico: null };
  if (d.accion === "ver") {
    const l = vivos(partida).filter((p) => p.enfermedades?.length);
    return { texto: l.length ? l.map((p) => `${p.nombre}: ${p.enfermedades!.map((e) => { const x = buscarEnfermedad(e.id)!; return `${x.nombre} (${e.etapa}, éxitos ${e.exitos}/${x.exitos}, fallos ${e.fallos}/${x.fallos}, próxima ${textoReloj({ segundos: e.t })})`; }).join("; ")}`).join("\n") : "Nadie está enfermo.", publico: null };
  }
  if (d.accion === "aislar") {
    const l = pjs(partida, d.quienes);
    for (const p of l) p.aislado = d.aislado !== false;
    return { texto: `${l.map((p) => p.nombre).join(", ")} ${d.aislado === false ? "ya no está aislado" : "queda aislado (no contagia ni se contagia)"}.`, publico: null };
  }
  const def = buscarEnfermedad(d.enfermedad ?? "");
  if (!def) throw new Error(`Di la enfermedad: ${ENFERMEDADES.map((e) => e.id).join(", ")}.`);
  if (d.accion === "exponer") {
    const l = pjs(partida, d.quienes);
    const lineas = l.map((p) => exponer(partida, p, def, d.cd));
    return { texto: lineas.join("\n"), publico: null };
  }
  const objetivo = pjs(partida, d.quienes)[0];
  const e = objetivo?.enfermedades?.find((x) => x.id === def.id);
  if (!e) throw new Error(`${objetivo?.nombre ?? "Nadie"} no tiene ${def.nombre}.`);
  if (d.accion === "curar") {
    objetivo.enfermedades = objetivo.enfermedades!.filter((x) => x !== e);
    if (!objetivo.enfermedades.length) delete objetivo.enfermedades;
    ponerCondicion(objetivo);
    return { texto: `${objetivo.nombre} se cura de ${def.nombre}.`, publico: `💚 ${objetivo.nombre} se cura de ${def.nombre}.` };
  }
  // tratar
  if (e.etapa === "incubando") throw new Error(`${objetivo.nombre} aún no tiene síntomas: nadie sabe que está enfermo.`);
  const metodo = d.metodo ?? "cuidados";
  if (metodo === "magia_divina") {
    objetivo.ceniza += 1;
    objetivo.enfermedades = objetivo.enfermedades!.filter((x) => x !== e);
    if (!objetivo.enfermedades.length) delete objetivo.enfermedades;
    ponerCondicion(objetivo);
    return { texto: `La magia divina expulsa ${def.nombre} de ${objetivo.nombre}. Gana 1 de Ceniza (total ${objetivo.ceniza}).`, publico: `💚 ${objetivo.nombre} se cura de ${def.nombre}.` };
  }
  if (metodo === "remedio_raro") {
    objetivo.enfermedades = objetivo.enfermedades!.filter((x) => x !== e);
    if (!objetivo.enfermedades.length) delete objetivo.enfermedades;
    ponerCondicion(objetivo);
    return { texto: `El remedio raro cura ${def.nombre} en ${objetivo.nombre}.`, publico: `💚 ${objetivo.nombre} se cura de ${def.nombre}.` };
  }
  if (!d.sanador) throw new Error("tratar: di quién cuida (sanador).");
  const san = pjs(partida, [d.sanador])[0];
  if (metodo === "hierbas") {
    const i = san.inventario.findIndex((x) => /hierbas/i.test(x));
    if (i < 0) throw new Error(`${san.nombre} no tiene hierbas en el inventario.`);
    san.inventario.splice(i, 1);
  }
  const r = resolverPrueba(partida, { quien: san.nombre, habilidad: "medicina", cd: def.cd_tratar, bono: tiene(san, "manos_de_cirujano") ? 2 : 0, competente: undefined, motivo: `cuidar a ${objetivo.nombre} de ${def.nombre}` });
  if (!r.exito) return { texto: `${r.texto}\nLos cuidados no bastan esta vez.`, publico: null };
  const bono = 2 + (metodo === "hierbas" ? 2 : 0);
  e.bono = bono; e.bono_veces = 3;
  return { texto: `${r.texto}\nLos cuidados ${metodo === "hierbas" ? "y las hierbas " : ""}ayudan: +${bono} a sus próximas 3 salvaciones contra ${def.nombre}.`, publico: null };
}

export function textoEnfermedades(partida: Partida): string {
  const l = vivos(partida).filter((p) => p.enfermedades?.length);
  if (!l.length) return "";
  return `## Enfermedades (secretas del DM mientras incuban)\n${l.map((p) => `- ${p.nombre}: ${p.enfermedades!.map((e) => { const d = buscarEnfermedad(e.id)!; return `${d.nombre} [${e.etapa}] éxitos ${e.exitos}/${d.exitos}, fallos ${e.fallos}/${d.fallos}, ${e.etapa === "incubando" ? "síntomas" : "próxima salvación"} ${textoReloj({ segundos: e.t })}`; }).join("; ")}${p.aislado ? " (aislado)" : ""}`).join("\n")}`;
}

export const REGLAS_ENFERMEDADES = `## Enfermedades
- Hay tres: ${ENFERMEDADES.map((e) => `${e.nombre} (${e.via})`).join("; ")}. Cuando el grupo se exponga (beber agua estancada, dormir entre ratas, respirar ceniza). El mordisco de un muerto no es una enfermedad: es la Podre de la herida, llama a enfermedad {accion: exponer, enfermedad, quienes}: salvación de CON (la CD sale del catálogo; enfermedad {accion: catalogo} da los detalles).
- Si falla, el personaje incuba en secreto unos días: NO se lo cuentes hasta que el programa avise de los síntomas. Después, el reloj hace una salvación de CON cada intervalo: con los éxitos necesarios se cura, con los fallos empeora (agotamiento y síntomas) y al final muere. Las contagiosas pasan a los compañeros que no se aíslan (enfermedad {accion: aislar}).
- Cuidarlos: enfermedad {accion: tratar, enfermedad, quienes: [enfermo], sanador, metodo: cuidados|hierbas|remedio_raro|magia_divina}: Medicina contra la CD de tratar da +2 (+2 más con hierbas) a sus 3 próximas salvaciones; magia divina (1 de Ceniza) o un remedio raro curan del todo. Narra los síntomas con crudeza; no son un adorno.`;
