// Behelits: huevos de piedra con rostro que despiertan en la desesperación y
// ofrecen poder a cambio de sacrificar lo que más se ama. El carmesí es único y
// solo responde a quien está destinado. Jugadores y PNJ pueden usarlos.
import { describir, tirar } from "./dados.js";
import { aparecer, buscarCriatura } from "./bestiario.js";
import type { Partida, Personaje } from "./estado.js";
import { marcarMuerto, salvacion, signo } from "./reglas.js";

export const RAZONES = [
  "al borde de la muerte",
  "perdió a un ser querido",
  "traicionado por alguien de confianza",
  "todo por lo que luchó está perdido",
  "su sueño o ambición se ha roto",
] as const;
export type Razon = (typeof RAZONES)[number];

/** Lo que cada sacrificado hizo o tuvo a su favor durante el ritual. */
export const CIRCUNSTANCIAS = {
  "fuera del horizonte": "no estaba dentro del horizonte del ritual cuando se cerró: queda a salvo y sin marca",
  "ayuda externa": "alguien de fuera irrumpe para sacarlo (+5)",
  "un aliado lo cubre": "un compañero se interpone para protegerlo (+3)",
  "no cede a la desesperación": "se niega a rendirse aunque todo esté perdido (+2)",
  "conoce el ritual": "sabía lo que iba a pasar y se preparó (+3)",
} as const;
export type Circunstancia = keyof typeof CIRCUNSTANCIAS;

export interface EstadoBehelit {
  /** Solo existe un Behelit Carmesí por campaña. */
  carmesi_creado: boolean;
  /** Quiénes pueden despertar el carmesí (secreto del DM; pueden ser PNJ). */
  destinados: string[];
  oferta?: { portador: string; tipo: "comun" | "carmesi"; pnj: boolean };
}

/** Un PNJ que interviene: como portador o como sacrificado. */
export interface PNJ {
  nombre: string;
  /** Bonificador a sus salvaciones (SAB para rechazar; general para sobrevivir). */
  bono?: number;
}

export interface Sacrificado {
  nombre: string;
  circunstancias?: Circunstancia[];
  /** Solo PNJ: bonificador a sus tiradas para sobrevivir. */
  bono_pnj?: number;
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

/** Mejor protección que da el equipo del personaje frente al Eclipse. */
function proteccionEquipo(partida: Partida, p: Personaje): { bono: number; ventaja: boolean; fuente: string } {
  let mejor = { bono: 0, ventaja: false, fuente: "" };
  for (const item of p.inventario) {
    const id = /\[(O\d+)\]/.exec(item)?.[1];
    const o = id ? partida.objetos[id] : undefined;
    if (!o) continue;
    let actual = { bono: 0, ventaja: false, fuente: o.nombre };
    if (o.calidad === "legendario") actual = { bono: 5, ventaja: true, fuente: o.nombre };
    else if (o.calidad === "reliquia" && !/behelit/i.test(o.verdad)) actual.bono = 3;
    else if (o.calidad === "encantado" && /plata y sal|llama gris/i.test(o.verdad)) actual.bono = 2;
    if (actual.bono > mejor.bono) mejor = actual;
  }
  return mejor;
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
  const quien =
    partida.behelit.destinados.join(", ") ||
    "ninguno de los personajes. Puede estar destinado a un PNJ: un rival, un aliado querido, el líder carismático del grupo… Si quieres, decide quién en secreto con anotar_mundo; el behelit despertará con él (pasa su nombre como portador_pnj)";
  return {
    dm:
      `El Behelit Carmesí existe ahora en el mundo como ${partida.objetos[id].nombre} (añádelo al inventario con ese nombre cuando alguien lo tenga). SECRETO: está destinado a ${quien}.\n${log.join("\n")}\n` +
      "Nunca lo reveles directamente; deja pistas (sueños, el behelit que vuelve solo a sus manos, el Coro que le observa).",
    jugadores: `${partida.objetos[id].nombre}: rojo como la sangre seca, ${APARIENCIA}. Parece mirarte.`,
  };
}

export function despertar(
  partida: Partida,
  portador: { nombre: string; pc?: Personaje },
  carmesi: boolean,
  razones: Razon[],
  ambicion?: string,
): { dm: string; jugadores: string } {
  const { nombre, pc } = portador;
  if (pc && !pc.inventario.some((x) => esBehelit(partida, x, carmesi))) {
    throw new Error(`${nombre} no lleva un ${carmesi ? "Behelit Carmesí" : "behelit"} en el inventario.`);
  }
  const unicas = [...new Set(razones)];
  const frio = { jugadores: "El behelit permanece frío y en silencio." };

  if (carmesi) {
    const destinados = partida.behelit.destinados.map((d) => d.toLowerCase());
    // Si el DM no fijó a nadie y es un PNJ quien lo sostiene, el DM puede decidir que es él.
    if (!destinados.includes(nombre.toLowerCase())) {
      return { ...frio, dm: `${nombre} NO está destinado al Behelit Carmesí: jamás despertará en sus manos. (Destinados: ${partida.behelit.destinados.join(", ") || "nadie fijado"}.)` };
    }
    if (unicas.length < 3 || !ambicion) {
      return {
        ...frio,
        dm: `${nombre} está destinado, pero aún no es el momento: hacen falta al menos 3 motivos de desesperación (tiene ${unicas.length}) y una ambición declarada${ambicion ? "" : " (falta)"}. El behelit late una vez, débilmente.`,
      };
    }
    partida.behelit.oferta = { portador: nombre, tipo: "carmesi", pnj: !pc };
    return {
      dm:
        `EL ECLIPSE. El Behelit Carmesí despierta en manos de ${nombre}, cuya ambición es: "${ambicion}". El cielo se oscurece y el horizonte del ritual se cierra: todos los que estén dentro son arrastrados a otro lugar, y el Coro de los Cinco se presenta para ofrecerle un sitio entre ellos como el Quinto. ` +
        `El precio: sus compañeros, todos los que lo aman y lo siguen. ${pc ? "Deja que el jugador decida libremente." : "Decide tú lo que elige el PNJ, coherente con quién es."} ` +
        "Antes de resolverlo, deja a los jugadores reaccionar: quien huya o esté lejos puede quedar fuera del horizonte; quien pida ayuda, se prepare o proteja a otro tendrá más opciones. Luego llama a behelit con aceptar (sacrificados y sus circunstancias) o rechazar.",
      jugadores: `El behelit rojo de ${nombre} se abre, llorando sangre. Sus ojos se colocan en su sitio. Grita. El sol se apaga.`,
    };
  }

  if (unicas.length < 2) return { ...frio, dm: `Hacen falta al menos 2 motivos de desesperación (tiene ${unicas.length}).` };
  const prob = 15 * unicas.length + (pc && pc.ceniza >= 3 ? 10 : 0);
  const d = tirar("1d100").total;
  if (d > prob) return { ...frio, dm: `El behelit no despierta (d100 = ${d} vs ${prob}%). Quizá la próxima vez.` };
  partida.behelit.oferta = { portador: nombre, tipo: "comun", pnj: !pc };
  return {
    dm:
      `El behelit despierta (d100 = ${d} vs ${prob}%). ${nombre} es arrastrado a un espacio fuera del mundo donde las voces del Coro le ofrecen lo que necesita para no perder: poder, venganza, vida. ` +
      `El precio: sacrificar lo que más ama o más valora. ${pc ? "Para un jugador, son sus compañeros; solo si no los tiene, la persona que más quiere." : "Para un PNJ, decide tú a quién ama más (pueden ser los personajes jugadores)."} ` +
      "Narra la tentación y deja decidir. Antes de resolverlo, deja reaccionar a los demás. Luego llama a behelit con aceptar o rechazar.",
    jugadores: `El behelit de ${nombre} grita con una voz que no es humana. Sus ojos se abren.`,
  };
}

/** Prueba de supervivencia de un sacrificado: tres salvaciones; hacen falta dos. */
function sobrevivir(partida: Partida, s: Sacrificado, pc: Personaje | undefined, cd: number, carmesi: boolean, log: string[]) {
  const circ = s.circunstancias ?? [];
  if (circ.includes("fuera del horizonte")) {
    log.push(`${s.nombre}: estaba fuera del horizonte del ritual cuando se cerró. Queda a salvo y sin marca… y puede intentar entrar a rescatar a los demás.`);
    return;
  }
  const extras: string[] = [];
  let bono = 0;
  for (const c of circ) {
    const m = { "ayuda externa": 5, "un aliado lo cubre": 3, "no cede a la desesperación": 2, "conoce el ritual": 3 }[c as Exclude<Circunstancia, "fuera del horizonte">] ?? 0;
    if (m) {
      bono += m;
      extras.push(`${c} ${signo(m)}`);
    }
  }
  let ventaja = false;
  if (pc) {
    const eq = proteccionEquipo(partida, pc);
    if (eq.bono) {
      bono += eq.bono;
      ventaja = eq.ventaja;
      extras.push(`${eq.fuente} ${signo(eq.bono)}${eq.ventaja ? " y ventaja" : ""}`);
    }
  } else bono += s.bono_pnj ?? 0;

  const pruebas = [
    ["con", "resistir la embestida"],
    ["des", "abrirse paso entre los apóstoles"],
    ["sab", "no rendirse a la desesperación"],
  ] as const;
  let exitos = 0;
  const tiradas: string[] = [];
  for (const [atr, que] of pruebas) {
    if (pc) {
      const r = salvacion(pc, atr, cd, { extra: bono, ventaja });
      if (r.exito) exitos++;
      tiradas.push(`${que}: ${r.texto}`);
    } else {
      const t = tirar(`1d20${signo(bono)}`);
      if (t.total >= cd) exitos++;
      tiradas.push(`${que}: ${describir(t)} vs CD ${cd} → ${t.total >= cd ? "éxito" : "fallo"}`);
    }
  }
  log.push(`${s.nombre}${extras.length ? ` [${extras.join(", ")}]` : ""}:\n  ${tiradas.join("\n  ")}`);

  if (pc) pc.secuelas.push(MARCA);
  if (exitos >= 2) {
    log.push(`  → ESCAPA del sacrificio (${exitos}/3), aunque marcado para siempre.`);
  } else if (exitos === 1 || !carmesi) {
    if (pc) pc.condiciones.push("atrapado en el Eclipse: debe sobrevivir a la cacería; si cae a 0 PV allí, muere sin salvaciones");
    log.push(`  → ATRAPADO (${exitos}/3): sigue dentro, rodeado de apóstoles. Juega la escena; aún puede salvarse con ayuda o un milagro.`);
  } else {
    if (pc) marcarMuerto(pc);
    log.push(`  → DEVORADO (0/3). ${s.nombre} muere en el Eclipse.`);
  }
}

export function aceptar(partida: Partida, portador: { nombre: string; pc?: Personaje }, sacrificados: Sacrificado[]): string {
  const of = partida.behelit.oferta;
  if (!of || of.portador.toLowerCase() !== portador.nombre.toLowerCase()) throw new Error(`No hay ninguna oferta abierta para ${portador.nombre}.`);
  const carmesi = of.tipo === "carmesi";
  const pcs = Object.values(partida.personajes);
  const esPC = (n: string) => pcs.find((x) => x.nombre.toLowerCase() === n.toLowerCase());
  if (!sacrificados.length) throw new Error("El Coro no da nada a cambio de nada: indica a quién sacrifica.");

  // Para un jugador, el precio son sus compañeros.
  if (portador.pc) {
    const companeros = pcs.filter((x) => x !== portador.pc && !x.condiciones.includes("muerto"));
    const nombres = sacrificados.map((s) => s.nombre.toLowerCase());
    if (carmesi) {
      const faltan = companeros.filter((c) => !nombres.includes(c.nombre.toLowerCase()));
      if (faltan.length) {
        throw new Error(
          `El Eclipse exige a todos los compañeros: falta ${faltan.map((c) => c.nombre).join(", ")}. Inclúyelos (con la circunstancia "fuera del horizonte" si no estaban dentro del ritual).`,
        );
      }
    } else if (companeros.length && !sacrificados.some((s) => esPC(s.nombre) && esPC(s.nombre) !== portador.pc)) {
      throw new Error(
        `El precio de un jugador es lo que más ama: sus compañeros (${companeros.map((c) => c.nombre).join(", ")}). Debe sacrificar al menos a uno. Solo sin compañeros vale la persona que más quiere.`,
      );
    }
  }

  partida.behelit.oferta = undefined;
  const log: string[] = [];
  if (portador.pc) {
    const p = portador.pc;
    p.inventario = p.inventario.filter((x) => !esBehelit(partida, x, carmesi));
    if (carmesi) {
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
  } else if (carmesi) {
    log.push(`${portador.nombre} acepta y asciende como el Quinto del Coro. Es ya uno de los antagonistas supremos de la campaña.`);
  } else {
    const plantilla = buscarCriatura("Apóstol");
    if (plantilla) log.push(aparecer(partida, plantilla, `${portador.nombre}, Apóstol`).split("\n")[0]);
    log.push(`${portador.nombre} acepta y renace como Apóstol (registrado en escena con la plantilla Apóstol; adáptala a quien era).`);
  }

  const cd = carmesi ? 20 : 17;
  log.push(`\nEl sacrificio (cada uno necesita 2 éxitos de 3 contra CD ${cd} para escapar):`);
  for (const s of sacrificados) sobrevivir(partida, s, esPC(s.nombre), cd, carmesi, log);
  return log.join("\n");
}

export function rechazar(partida: Partida, portador: { nombre: string; pc?: Personaje; bono?: number }): string {
  const of = partida.behelit.oferta;
  if (!of || of.portador.toLowerCase() !== portador.nombre.toLowerCase()) throw new Error(`No hay ninguna oferta abierta para ${portador.nombre}.`);
  partida.behelit.oferta = undefined;
  const cd = of.tipo === "carmesi" ? 22 : 18;
  const p = portador.pc;
  let exito: boolean;
  let texto: string;
  if (p) {
    const s = salvacion(p, "sab", cd);
    exito = s.exito;
    texto = s.texto;
  } else {
    const t = tirar(`1d20${signo(portador.bono ?? 0)}`);
    exito = t.total >= cd;
    texto = `SAB ${describir(t)} vs CD ${cd} → ${exito ? "éxito" : "fallo"}`;
  }
  if (exito) {
    p?.secuelas.push("voluntad de hierro: miró al abismo y le dijo que no; ventaja en salvaciones contra quedar hechizado o asustado por demonios");
    return `${portador.nombre} rechaza la oferta (${texto}). El behelit se cierra y vuelve a ser piedra. Algo, en algún lugar, toma nota.`;
  }
  if (p) {
    p.atributos.sab = Math.max(1, p.atributos.sab - 2);
    p.secuelas.push("mente rota por el abismo: −2 SAB; a veces aún oye las voces del Coro");
  }
  return `${portador.nombre} rechaza la oferta, pero el abismo le deja su huella (${texto})${p ? ": −2 SAB permanente" : ": su mente queda rota"}. El behelit vuelve a ser piedra.`;
}

export const REGLAS_BEHELIT = `## Behelits (usa la herramienta behelit; generar_botin los produce en rarísimas ocasiones)
Huevos de piedra con un rostro desordenado (${APARIENCIA}). Nadie sabe de dónde salen; dicen que un behelit encuentra a su dueño, y que si lo pierdes vuelve a ti. Pertenecen al **Coro de los Cinco**, entes nacidos del cadáver de los dioses que conceden poder a cambio de lo que más amas. Hay quien susurra que la Caída fue el primer Eclipse.
- **Rareza**: lo más difícil de encontrar del mundo. Nunca están a la venta. Aparecen solo por azar extremo en el botín o cuando tú lo decidas por la historia.
- **Jugadores y PNJ**: cualquiera puede tener un behelit. Un PNJ (un rival, un noble desesperado, el amigo que lo perdió todo) puede despertarlo con portador_pnj, y su sacrificio puede ser el propio grupo. Los PNJ apóstoles se registran solos como criaturas en escena.
- **Despertar (común)**: solo en la desesperación más profunda (al menos 2 motivos reales; cuantos más, más probable).
- **El precio**: lo que más ama o más valora. Para un jugador, sus compañeros: debe sacrificar al menos a uno (solo si no tiene compañeros vale la persona que más quiere). Aceptar le convierte en **Apóstol**: inmenso poder, forma demoníaca, sin humanidad.
- **El Behelit Carmesí**: único en toda la campaña. Solo se crea con crear_carmesi, como centro de un gran arco. El programa decide en secreto quién está destinado (puede ser nadie del grupo; puede ser un PNJ). En manos de cualquier otro nunca despierta. El destinado necesita al menos 3 motivos y una ambición. Su despertar es **el Eclipse**: exige sacrificar a todos sus compañeros.
- **Salvarse del sacrificio**: cada sacrificado hace tres salvaciones (CON para resistir, DES para abrirse paso, SAB para no rendirse) contra CD 17 (común) o 20 (Eclipse). Con 2 éxitos escapa marcado; con 1 queda atrapado y se juega la escena; en el Eclipse, 0 éxitos significa devorado. Lo que hagan importa, así que antes de resolver, deja que actúen y tradúcelo en circunstancias: ${Object.entries(CIRCUNSTANCIAS)
  .map(([k, v]) => `"${k}" (${v})`)
  .join("; ")}. El equipo también ayuda automáticamente: un arma legendaria da +5 y ventaja, una reliquia +3, un arma encantada de plata y sal o de llama gris +2.
- Respeta siempre la decisión del jugador ante la oferta: es el momento más importante de su personaje. No reveles nunca quién es el destinado; insinúalo.`;
