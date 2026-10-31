// Punto de entrada de la versión web (artifact de claude.ai): el mismo motor que
// la terminal, empaquetado para el navegador. El DM es Claude a través de la
// capacidad "sample" del artifact, que llama al motor con la herramienta "motor".
import { estadoTexto, fichaCriatura } from "./bestiario.js";
import { tiradaPendiente } from "./magia.js";
import { textoSustento } from "./sustento.js";
import { textoTrampas } from "./trampas.js";
import { textoSal } from "./sal.js";
import { textoEnfermedades } from "./enfermedades.js";
import { textoAgua } from "./agua.js";
import { textoNaves } from "./naves.js";
import { fichaCorta, fichaTexto, normalizarPartida, nuevaPartida, type Partida } from "./estado.js";
import * as secuencia from "./secuencia.js";
import * as dados from "./dados.js";
import { ejecutar, herramientas } from "./herramientas.js";
import { ALTO, ANCHO, REGIONES, textoMapa } from "./mapa.js";
import { comando } from "./mesa.js";
import * as narrativa from "./narrativa.js";
import { textoPnj, textoPnjsFuera, textoTrama } from "./narrativa.js";
import * as turnos from "./turnos.js";
import * as formulario from "./formulario.js";
import * as aventuras from "./aventuras.js";
import * as espacio from "./espacio.js";
import * as encuentros from "./encuentros.js";
import * as regentes from "./regentes.js";
import { mitigacion, textoRunas } from "./cazador.js";
import { catalogoCompacto, consultarReglas, sistemaWeb, SISTEMA_WEB } from "./prompt-web.js";

export const NOMBRES_ACCIONES = herramientas.map((h) => h.name);

/** Catálogo compacto de las acciones del motor, para el prompt del DM. */
export function catalogoAcciones(): string {
  return herramientas
    .map((h) => `### ${h.name}\n${h.description}\nDatos (JSON Schema): ${JSON.stringify(h.input_schema)}`)
    .join("\n\n");
}

/** La ficha completa de un personaje (por su nombre o el de su jugador), para consultar_reglas. */
export function fichaPorNombre(p: Partida, nombre: string): string {
  const n = String(nombre ?? "").toLowerCase().trim();
  const x = Object.values(p.personajes).find((y) => y.nombre.toLowerCase() === n || y.jugador?.toLowerCase().trim() === n);
  return x ? fichaTexto(x) : `No hay ningún personaje "${nombre}". Personajes: ${Object.values(p.personajes).map((y) => y.nombre).join(", ") || "ninguno"}.`;
}

/** Estado de la partida tal y como lo necesita el DM (incluye secretos que los jugadores no ven en la página). */
/** En qué punto está la mesa: tirar los dones, crear personajes o dar la introducción al mundo. */
export function textoFase(p: Partida, sinFicha?: string[]): string {
  const hayPj = Object.keys(p.personajes).length > 0;
  const pendientes = sinFicha ?? (hayPj ? [] : ["los jugadores"]);
  if (pendientes.length || !hayPj) {
    const reales = pendientes.filter((n) => n !== "los jugadores");
    const sinDon = reales.filter((n) => !tiradaPendiente(p, n));
    const conDon = reales.filter((n) => tiradaPendiente(p, n));
    const perdieron = reales.filter((n) => Object.values(p.personajes).some((x) => x.jugador && x.jugador.toLowerCase() === n.toLowerCase() && x.condiciones.includes("muerto")));
    return [
      "## FASE DE LA MESA: CREACIÓN DE PERSONAJES",
      sinDon.length
        ? `1) ANTES de que se cree cada personaje, tira SU don arcano (tirar_don_arcano, un d20: 19 = don FÍSICO, 20 = don MÁGICO, el resto sin don; una tirada por personaje nuevo): ${sinDon.join(", ")}. El formulario de cada jugador está BLOQUEADO hasta que tires. Anuncia a cada uno su resultado.${perdieron.length ? ` Han perdido a su personaje y crean otro (tirada nueva): ${perdieron.join(", ")}.` : ""}`
        : `1) Los dones de los personajes nuevos ya están tirados${conDon.length ? ` (${conDon.join(", ")})` : ""}. Si un jugador pide la tirada o llega uno nuevo, tira la suya antes de que cree su personaje.`,
      `2) Cada jugador crea su personaje (📜 Crear personaje) sabiendo su don.${reales.length ? ` Aún sin ficha: ${reales.join(", ")}.` : ""}`,
      "3) NO empieces la historia ni des la introducción al mundo hasta que todos tengan su ficha guardada.",
    ].join("\n");
  }
  const t = p.trama;
  if (!(t?.arcos?.length) && !(t?.cerrados?.length))
    return [
      "## FASE DE LA MESA: INTRODUCCIÓN AL MUNDO",
      "Todos los personajes están creados. En este mismo turno: 1) da la INTRODUCCIÓN GENERAL a Velmora (entre 5 y 8 párrafos breves, en tu voz de narrador, sin listas): el Reino del Sol Herido y la herida de Ka'i, la Inquisición, la Corte Pálida y los regentes, cómo se vive (el precio de la magia, las heridas, la ceniza), las regiones del mapa y el tono oscuro; sin revelar ningún secreto del DM. Dirígete al grupo concreto: sus nombres, razas y clases, y los dones que nacieron con ellos si se notan.",
      "2) Después, sin cortar el ritmo, abre el primer arco (trama abrir_arco con su premisa) y un PNJ con agenda propia, y da la palabra al primer jugador.",
    ].join("\n");
  return "";
}

export function estadoParaDM(p: Partida, foco?: string, sinFicha?: string[]): string {
  const partes: string[] = [];
  const fase = textoFase(p, sinFicha);
  if (fase) partes.push(fase);
  const tab = secuencia.tablero(p);
  if (tab) partes.push(tab);
  const variedad = encuentros.textoVariedad(p);
  if (variedad) partes.push(variedad);
  const reg = regentes.textoRegentes(p);
  if (reg) partes.push(reg);
  const runas = textoRunas(p);
  if (runas) partes.push(runas);
  const plano = espacio.textoPlano(p.plano);
  if (plano) partes.push(plano);
  else partes.push("## PLANO DE LA ESCENA\n(vacío: si hay una escena con varios actores —combate, calle, sala—, ábrela con plano y coloca a los presentes)");
  partes.push(`## Mapa\n${textoMapa(p.mapa)}`);
  const pjs = Object.values(p.personajes);
  // Por turnos, solo el jugador que actúa lleva la ficha completa; los demás, abreviada (el prompt no crece con cada jugador).
  const f = (foco ?? "").toLowerCase().trim();
  const esFoco = (x: (typeof pjs)[number]) => !!f && (x.jugador?.toLowerCase().trim() === f || x.nombre.toLowerCase() === f);
  const conFoco = pjs.some(esFoco) && pjs.length > 1;
  partes.push(
    `## Personajes jugadores${conFoco ? " (ficha completa solo del que actúa; la de los demás, con consultar_reglas {tema: \"ficha\", nombre})" : ""}\n` +
      (pjs.length ? pjs.map((x) => (conFoco && !esFoco(x) ? fichaCorta(x) : fichaTexto(x))).join(conFoco ? "\n" : "\n\n") : "Aún no hay personajes: hay que crearlos."),
  );
  const sust = pjs.map((x) => textoSustento(x, p).trim()).map((t, i) => (t ? `${pjs[i].nombre}: ${t.replace(/^Sustento: /, "")}` : "")).filter(Boolean);
  if (sust.length) partes.push(`## Sustento\n${sust.join("\n")}`);
  const sl = textoSal(p);
  if (sl) partes.push(sl);
  const en = textoEnfermedades(p);
  if (en) partes.push(en);
  const tr = textoTrampas(p);
  if (tr) partes.push(tr);
  for (const t of [textoAgua(p), textoNaves(p)]) if (t) partes.push(t);
  const seq = secuencia.textoSecuencia(p.secuencia);
  if (seq) partes.push(seq);
  if (p.trama) {
    const pend = p.secuencia?.pendientes?.length ?? 0;
    const enredo = pend > 5 ? `\n⚠ [INTERNO, solo para ti: no se lo menciones a los jugadores ni a sus personajes] hay ${pend} asuntos pendientes. Simplifica en silencio: no abras nada nuevo, resuelve o descarta pendientes con la propia narración y deja el objetivo y el próximo paso claros.` : "";
    partes.push(`## Trama\n${textoTrama(p.trama)}${enredo}`);
  }
  const pnjs = Object.values(p.pnjs ?? {});
  if (pnjs.length) {
    const escena = pnjs.filter((x) => x.en_escena);
    const otros = pnjs.filter((x) => !x.en_escena);
    partes.push(
      `## PNJ${escena.length ? `\nEn escena (habla con SU voz y no repitas lo que ya dijo):\n${escena.map((x) => `- ${textoPnj(x)}`).join("\n")}` : ""}` +
        (otros.length ? `\nFuera de escena (siguen con su vida; si llevan turnos parados, que muevan ficha y su eco llegue a los protagonistas):\n${textoPnjsFuera(otros)}` : ""),
    );
  }
  if (p.combate) {
    const pnj = Object.values(p.combate.pnj);
    partes.push(
      `## Combate en curso (asalto ${p.combate.ronda})${p.combate.sorprendidos?.length ? `\nSorprendidos: ${p.combate.sorprendidos.join(", ")}` : ""}${p.combate.plan ? `\nPlan ${p.combate.plan.calidad} de ${p.combate.plan.bando.join(", ")}; lo leyeron: ${p.combate.plan.leido_por.join(", ") || "nadie"}` : ""}\nOrden de iniciativa: ${p.combate.orden.map((o) => `${o.nombre} (${o.total})`).join(" → ")}` +
        (pnj.length ? `\nPNJ: ${pnj.map((n) => `${n.nombre} (ataque ${n.bono_ataque >= 0 ? "+" : ""}${n.bono_ataque}, CA ${n.ca}, ${n.veterania ?? "curtido"}${n.temple ? `, ${n.temple}` : ""}${n.personalidad?.length ? `, ${n.personalidad.join(" y ")}` : ""}${n.aliado ? ", ALIADO" : ""}${n.ceniza ? `, Ceniza ${n.ceniza}` : ""}${n.pv !== undefined ? `, PV ${n.pv}/${n.pv_max ?? n.pv}` : ""}${n.condiciones?.length ? `, condiciones: ${n.condiciones.join(", ")}` : ""})`).join("; ")}` : "") +
        (() => {
          const t = Object.entries(p.combate.turnos ?? {}).map(([k, v]) => [k, [v.reaccion ? "reacción gastada" : "", v.esquiva ? "esquivando" : "", v.retirada ? "retirado" : "", v.corrio ? "corrió" : "", v.ayuda ? `ayudado por ${v.ayuda.por}` : "", v.preparada ? `acción preparada («${v.preparada.accion}» al ocurrir «${v.preparada.disparador}»)` : ""].filter(Boolean)] as const).filter(([, l]) => l.length);
          return t.length ? `\nEste asalto: ${t.map(([k, l]) => `${k} (${l.join(", ")})`).join("; ")}` : "";
        })(),
    );
  }
  if (p.notas_mundo.length)
    partes.push(`## Notas de campaña (vigentes; si una cambia, corrígela con anotar_mundo reemplaza/olvidar)\n${p.notas_mundo.map((n) => `- ${n}`).join("\n")}`);
  const jefes = Object.values(p.jefes);
  if (jefes.length) {
    partes.push(
      `## Criaturas en escena (SECRETO)\n${jefes
        .map(
          (j) =>
            `${fichaCriatura(j.definicion)}\nESTADO: ${j.pv}/${j.pv_max} PV (${estadoTexto(j)})` +
            (j.presagios.length ? ` · presagios [${j.presagios.join(", ")}]` : "") +
            (j.gastadas.length ? ` · habilidades gastadas: ${j.gastadas.join(", ")}` : "") +
            (j.condiciones?.length ? ` · condiciones: ${j.condiciones.join(", ")}` : "") +
            (j.ceniza ? ` · Ceniza: ${j.ceniza} marca(s) permanente(s)` : "") +
            (mitigacion(p, j) ? ` · RUNAS: ${mitigacion(p, j)!.texto}` : "") +
            (j.robos.length ? ` · ha robado a: ${j.robos.map((r) => `${r.personaje} (${r.atributo} −${r.cantidad})`).join(", ")}` : ""),
        )
        .join("\n\n")}`,
    );
  }
  const objetos = Object.values(p.objetos);
  if (objetos.length) {
    partes.push(
      `## Objetos registrados (SECRETO: la verdad de cada uno)\n${objetos
        .map((o) => `- ${o.nombre} (${o.calidad}${o.identificado ? "" : ", NO identificado"}): ${o.verdad}`)
        .join("\n")}`,
    );
  }
  if (p.behelit.carmesi_creado || p.behelit.oferta) {
    partes.push(
      `## Behelits (SECRETO)\nCarmesí creado: ${p.behelit.carmesi_creado ? "sí" : "no"}. Destinados: ${p.behelit.destinados.join(", ") || "nadie fijado"}.` +
        (p.behelit.oferta ? ` Oferta abierta: ${p.behelit.oferta.portador} (${p.behelit.oferta.tipo}).` : ""),
    );
  }
  return partes.join("\n\n");
}

export { aventuras, dados, espacio, regentes, formulario, narrativa, secuencia, turnos };
export { ALTO, ANCHO, catalogoCompacto, comando, consultarReglas, ejecutar, fichaTexto, normalizarPartida, nuevaPartida, REGIONES, sistemaWeb, SISTEMA_WEB };
