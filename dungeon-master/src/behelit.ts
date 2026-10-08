// Behelits: huevos de piedra con rostro que despiertan en la desesperación y
// ofrecen poder a cambio de un sacrificio. El carmesí es único y solo responde
// a quien está destinado.
import { tirar } from "./dados.js";
import type { Partida, Personaje } from "./estado.js";
import { marcarMuerto, salvacion } from "./reglas.js";

export const RAZONES = [
  "al borde de la muerte",
  "perdió a un ser querido",
  "traicionado por alguien de confianza",
  "todo por lo que luchó está perdido",
  "su sueño o ambición se ha roto",
] as const;
export type Razon = (typeof RAZONES)[number];

export interface EstadoBehelit {
  /** Solo existe un Behelit Carmesí por campaña. */
  carmesi_creado: boolean;
  /** Quiénes pueden despertar el carmesí (secreto del DM). */
  destinados: string[];
  oferta?: { portador: string; tipo: "comun" | "carmesi" };
}

export const APARIENCIA =
  "un huevo de piedra del tamaño de un puño, frío al tacto, con ojos, nariz y boca dispersos por la superficie como si estuvieran fuera de sitio";

const MARCA =
  "marca del sacrificio: sangra cuando hay demonios o apóstoles cerca, y cada noche los espíritus de los muertos vienen a por él (salvación de SAB CD 12 o no descansa)";

/** Un objeto del inventario es behelit si su nombre lo dice o si su verdad registrada lo es. */
function esBehelit(partida: Partida, item: string, carmesi: boolean): boolean {
  const id = /\[(O\d+)\]/.exec(item)?.[1];
  const verdad = id ? (partida.objetos[id]?.verdad ?? "") : "";
  const texto = `${item} ${verdad}`;
  return /behelit/i.test(texto) && /carmes/i.test(texto) === carmesi;
}

function tieneBehelit(partida: Partida, p: Personaje, carmesi: boolean) {
  return p.inventario.some((x) => esBehelit(partida, x, carmesi));
}

export function crearCarmesi(partida: Partida, destinado?: string): { dm: string; jugadores: string } {
  if (partida.behelit.carmesi_creado) throw new Error("Ya existe un Behelit Carmesí en esta campaña. Solo hay uno.");
  partida.behelit.carmesi_creado = true;
  const log: string[] = [];
  if (destinado) {
    partida.behelit.destinados = [destinado];
    log.push(`Destino fijado por el DM: ${destinado}.`);
  } else {
    for (const p of Object.values(partida.personajes)) {
      const prob = 5 + (p.ceniza >= 3 ? 5 : 0) + (p.ceniza >= 6 ? 10 : 0);
      const d = tirar("1d100").total;
      if (d <= prob) partida.behelit.destinados.push(p.nombre);
      log.push(`${p.nombre}: d100 = ${d} vs ${prob}% → ${d <= prob ? "DESTINADO" : "no"}.`);
    }
  }
  const id = `O${Object.keys(partida.objetos).length + 1}`;
  partida.objetos[id] = {
    id,
    nombre: `Huevo rojo con rostro [${id}]`,
    calidad: "reliquia",
    apariencia: `rojo como la sangre seca: ${APARIENCIA}`,
    verdad: "BEHELIT CARMESÍ, el único. Solo despierta en manos del destinado (herramienta behelit).",
    precio: 0,
    identificado: false,
  };
  const quien = partida.behelit.destinados.join(", ") || "ninguno de los personajes (quizá un PNJ: decídelo y vuelve a llamarme con destinado)";
  return {
    dm: `El Behelit Carmesí existe ahora en el mundo como ${partida.objetos[id].nombre} (añádelo al inventario con ese nombre cuando alguien lo tenga). SECRETO: está destinado a ${quien}.\n${log.join("\n")}\nNunca lo reveles directamente; deja pistas (sueños, el behelit que vuelve solo a sus manos, el Coro que le observa).`,
    jugadores: `${partida.objetos[id].nombre}: rojo como la sangre seca, ${APARIENCIA}. Parece mirarte.`,
  };
}

export function despertar(partida: Partida, p: Personaje, carmesi: boolean, razones: Razon[], ambicion?: string): { dm: string; jugadores: string } {
  if (!tieneBehelit(partida, p, carmesi)) throw new Error(`${p.nombre} no lleva un ${carmesi ? "Behelit Carmesí" : "behelit"} en el inventario.`);
  const unicas = [...new Set(razones)];
  const frio = { jugadores: "El behelit permanece frío y en silencio." };

  if (carmesi) {
    if (!partida.behelit.destinados.includes(p.nombre)) {
      return { ...frio, dm: `${p.nombre} NO está destinado al Behelit Carmesí: jamás despertará en sus manos. (Destinados: ${partida.behelit.destinados.join(", ") || "nadie"}.)` };
    }
    if (unicas.length < 3 || !ambicion) {
      return {
        ...frio,
        dm: `${p.nombre} está destinado, pero aún no es el momento: hacen falta al menos 3 motivos de desesperación (tiene ${unicas.length}) y una ambición declarada${ambicion ? "" : " (falta)"}. El behelit late una vez, débilmente.`,
      };
    }
    partida.behelit.oferta = { portador: p.nombre, tipo: "carmesi" };
    return {
      dm:
        `EL ECLIPSE. El Behelit Carmesí despierta en manos de ${p.nombre}, cuya ambición es: "${ambicion}". El cielo se oscurece, todos los presentes son arrastrados a otro lugar y el Coro de los Cinco se presenta para ofrecerle un sitio entre ellos como el Quinto. ` +
        "El precio: todos sus compañeros, los que ama y los que le aman. Narra la oferta con calma terrible y deja que el jugador decida libremente. Después llama a behelit con accion aceptar (sacrificados = compañeros presentes) o rechazar.",
      jugadores: `El behelit rojo de ${p.nombre} se abre, llorando sangre. Sus ojos se colocan en su sitio. Grita. El sol se apaga.`,
    };
  }

  if (unicas.length < 2) return { ...frio, dm: `Hacen falta al menos 2 motivos de desesperación (tiene ${unicas.length}).` };
  const prob = 15 * unicas.length + (p.ceniza >= 3 ? 10 : 0);
  const d = tirar("1d100").total;
  if (d > prob) return { ...frio, dm: `El behelit no despierta (d100 = ${d} vs ${prob}%). Quizá la próxima vez.` };
  partida.behelit.oferta = { portador: p.nombre, tipo: "comun" };
  return {
    dm:
      `El behelit despierta (d100 = ${d} vs ${prob}%). ${p.nombre} es arrastrado a un espacio fuera del mundo donde las voces del Coro le ofrecen lo que necesita para no perder: poder, venganza, vida. ` +
      "El precio: sacrificar lo que más ama (una o varias personas, que no tienen por qué estar presentes). Narra la tentación y deja decidir al jugador. Después llama a behelit con aceptar (sacrificados) o rechazar.",
    jugadores: `El behelit de ${p.nombre} grita con una voz que no es humana. Sus ojos se abren.`,
  };
}

export function aceptar(partida: Partida, p: Personaje, sacrificados: Personaje[], otros: string[]): string {
  const of = partida.behelit.oferta;
  if (!of || of.portador !== p.nombre) throw new Error(`No hay ninguna oferta abierta para ${p.nombre}.`);
  partida.behelit.oferta = undefined;
  p.inventario = p.inventario.filter((x) => !esBehelit(partida, x, of.tipo === "carmesi"));
  const log: string[] = [];

  if (of.tipo === "carmesi") {
    p.condiciones.push("ascendido como el Quinto del Coro: ya no es un personaje jugador; ahora es un antagonista que controla el DM");
    log.push(`${p.nombre} acepta. Renace como el Quinto del Coro. Ya no es un personaje jugador.`);
  } else {
    p.atributos.fue = Math.min(24, p.atributos.fue + 4);
    p.atributos.con = Math.min(24, p.atributos.con + 4);
    p.ceniza += 5;
    p.secuelas.push(
      "Apóstol: puede adoptar una forma demoníaca a voluntad (tamaño Enorme, regeneración 10, +2d8 al daño, inmune a miedo y veneno), pero ya no puede sentir amor; la Inquisición, los cazadores de brujas y los marcados lo persiguen",
    );
    log.push(`${p.nombre} acepta y renace como Apóstol: +4 FUE, +4 CON, +5 de Ceniza y forma demoníaca. Su humanidad se ha ido.`);
  }

  for (const s of sacrificados) {
    s.secuelas.push(MARCA);
    const sv = salvacion(s, "con", 20);
    if (sv.exito) {
      log.push(`${s.nombre}: ${sv.texto}. Sobrevive a la primera embestida, marcado para siempre.`);
    } else {
      s.condiciones.push("en el Eclipse: debe sobrevivir a la cacería; si cae a 0 PV allí, muere sin salvaciones");
      log.push(`${s.nombre}: ${sv.texto}. Queda marcado y atrapado en el Eclipse, rodeado de apóstoles hambrientos.`);
    }
  }
  if (otros.length) log.push(`También son entregados: ${otros.join(", ")} (PNJ). Narra su destino.`);
  return log.join("\n");
}

export function rechazar(partida: Partida, p: Personaje): string {
  const of = partida.behelit.oferta;
  if (!of || of.portador !== p.nombre) throw new Error(`No hay ninguna oferta abierta para ${p.nombre}.`);
  partida.behelit.oferta = undefined;
  const cd = of.tipo === "carmesi" ? 22 : 18;
  const s = salvacion(p, "sab", cd);
  if (s.exito) {
    p.secuelas.push("voluntad de hierro: miró al abismo y le dijo que no; ventaja en salvaciones contra quedar hechizado o asustado por demonios");
    return `${p.nombre} rechaza la oferta (${s.texto}). El behelit se cierra y vuelve a ser piedra. Algo, en algún lugar, toma nota.`;
  }
  p.atributos.sab = Math.max(1, p.atributos.sab - 2);
  p.secuelas.push("mente rota por el abismo: −2 SAB; a veces aún oye las voces del Coro");
  if (p.atributos.sab <= 1) marcarMuerto(p);
  return `${p.nombre} rechaza la oferta, pero el abismo le deja su huella (${s.texto}): −2 SAB permanente. El behelit vuelve a ser piedra.`;
}

export const REGLAS_BEHELIT = `## Behelits (usa la herramienta behelit; generar_botin los produce en rarísimas ocasiones)
Huevos de piedra con un rostro desordenado (${APARIENCIA}). Nadie sabe de dónde salen; dicen que un behelit encuentra a su dueño, y que si lo pierdes vuelve a ti. Pertenecen al **Coro de los Cinco**, entes nacidos del cadáver de los dioses que conceden poder a cambio de lo que más amas. Hay quien susurra que la Caída fue el primer Eclipse.
- **Rareza**: son lo más difícil de encontrar del mundo. Nunca están a la venta. Aparecen solo por azar extremo en el botín (generar_botin lo decide) o cuando tú lo decidas por la historia. Un behelit común en manos de un personaje debería ser un acontecimiento de campaña.
- **Despertar (común)**: solo en la desesperación más profunda. Llama a behelit con accion despertar y los motivos reales que se dan en la ficción (al menos 2; cuantos más, más probable). Si despierta, el Coro ofrece poder a cambio de sacrificar a quien más ama. Aceptar convierte al portador en **Apóstol** (inmenso poder, forma demoníaca, pierde la humanidad); los sacrificados quedan marcados para siempre. Rechazar exige una voluntad enorme.
- **El Behelit Carmesí**: único en toda la campaña. Solo se crea con behelit accion crear_carmesi, y debe ser el centro de un gran arco, nunca un hallazgo casual. Al crearse, el programa decide en secreto quién está destinado (puede ser nadie del grupo). **En manos de alguien no destinado nunca despierta.** El destinado necesita al menos 3 motivos de desesperación y una ambición declarada. Su despertar es **el Eclipse**: el portador puede ascender como el Quinto del Coro sacrificando a todos sus compañeros.
- Respeta siempre la decisión del jugador ante la oferta: es el momento más importante de su personaje. No reveles nunca quién es el destinado; insinúalo.`;
