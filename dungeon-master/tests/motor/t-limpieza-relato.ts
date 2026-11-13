// Los resultados del motor no se cuelan en el relato del DM: limpiarNarracion y armarHistorial.
import { limpiarNarracion, armarHistorial, AVISO_PROGRAMA } from "../../src/secuencia.ts";
import { limpiarNarracion as deNavegador } from "../../src/navegador.ts";

let ok = 0, mal = 0;
const t = (c: boolean, m: string, x = "") => { console.log(c ? "ok   " : "FALLA", m, x); c ? ok++ : mal++; };

const RELATO = "Varok recorre las estanterías polvorientas hasta que un lomo de cuero negro le llama la atención.\n\nEl Índice está ahí, entre dos tomos podridos.";
const BLOQUE = "[Resultados del motor en ese turno]\n🎲 Investigación de Varok Llamabrillante (INT +3, competencia +2) vs CD 12 — buscar el Índice → 1d20+5: [17] + 5 = 22 → ÉXITO (+10)\n🕒 Día 1, 18:02 (anochecer cercano) — Varok busca el Índice en la biblioteca y lo halla…";

t(deNavegador === limpiarNarracion, "V.limpiarNarracion es la misma función exportada por navegador");
// ejemplo real
t(limpiarNarracion(`${RELATO}\n\n${BLOQUE}`) === RELATO, "ejemplo real: queda solo el relato");
t(limpiarNarracion(`${RELATO}\n${BLOQUE}`) === RELATO, "sin línea en blanco previa");
t(limpiarNarracion(`${RELATO}\n\n${BLOQUE}\n\n`) === RELATO, "con saltos de línea finales");
// variaciones del marcador
t(limpiarNarracion(`${RELATO}\n\n[RESULTADOS DEL MOTOR]\n🎲 Fuerza vs CD 10 → 1d20: [4] = 4 → FALLO (-6)`) === RELATO, "marcador en mayúsculas y sin más texto entre corchetes");
t(limpiarNarracion(`${RELATO}[resultados del motor del turno anterior]\n🎲 Fuerza vs CD 10 → 1d20: [4] = 4 → FALLO (-6)`) === RELATO, "marcador pegado al relato, sin salto previo");
{
  const medio = `Antes del bloque.\n\n${BLOQUE}\n\nDespués del bloque, la historia sigue.`;
  t(limpiarNarracion(medio) === "Antes del bloque.\n\nDespués del bloque, la historia sigue.", "bloque en medio seguido de más prosa: se conserva la prosa");
  const dosBloques = `Uno.\n\n${BLOQUE}\n\nDos.\n\n[Resultados del motor]\n🧭 De camino: A → B (40 % del viaje).\n\nTres.`;
  t(limpiarNarracion(dosBloques) === "Uno.\n\nDos.\n\nTres.", "dos bloques en el texto");
  const info = `${RELATO}\n\n${AVISO_PROGRAMA}\n🎲 Algo vs CD 11 → 1d20: [3] = 3 → FALLO (-8)`;
  t(limpiarNarracion(info) === RELATO, "también el marcador de información del programa");
}
// avisos sueltos al final
t(limpiarNarracion(`${RELATO}\n\n🎲 Percepción de Ana vs CD 13 — oír → 1d20+2: [9] + 2 = 11 → FALLO (-2)`) === RELATO, "una línea de aviso al final");
t(limpiarNarracion(`${RELATO}\n\n🎲 Ataque → 1d20+5: [12] + 5 = 17 vs CA 14 → impacta\n🩸 Hugin: -8 PV (22/30)\n🕒 Día 2, 09:10 (mañana)`) === RELATO, "varias líneas de aviso contiguas al final");
t(limpiarNarracion(`${RELATO}\n\n🕒 Día 3, 07:00`) === RELATO, "solo la hora al final");
// conservadora
const normal = "El viento arrastra la ceniza.\n\n—¿Quién va? —gruñe el guardia.\n\nNada más ocurre.";
t(limpiarNarracion(normal) === normal, "narración normal intacta (idéntica)");
const dado = "Los dados 🎲 ruedan sobre la mesa y todos contienen el aliento.\n\nVarok sonríe.";
t(limpiarNarracion(dado) === dado, "un 🎲 en medio de una frase no se toca");
const dadoFinal = "Varok sonríe y dice:\n\n🎲 ¡Que ruede la suerte!";
t(limpiarNarracion(dadoFinal) === dadoFinal, "una línea final con 🎲 que no tiene forma de aviso no se toca");
const espacios = "Texto con espacios finales.  \n";
t(limpiarNarracion(espacios) === espacios, "sin nada que quitar no se recorta ni un espacio");
t(limpiarNarracion("") === "", "texto vacío");
t(limpiarNarracion(BLOQUE) === BLOQUE, "si solo hay bloque se conserva el original");
t(limpiarNarracion("🎲 Percepción vs CD 10 → 1d20: [3] = 3 → FALLO (-7)") === "🎲 Percepción vs CD 10 → 1d20: [3] = 3 → FALLO (-7)", "si solo hay una línea de aviso se conserva el original");
// idempotencia
for (const x of [`${RELATO}\n\n${BLOQUE}`, `Antes.\n\n${BLOQUE}\n\nDespués.`, normal, dado, BLOQUE, ""]) {
  const una = limpiarNarracion(x);
  t(limpiarNarracion(una) === una, "idempotente", JSON.stringify(x.slice(0, 20)));
}
// texto que llega a trozos
t(limpiarNarracion(`${RELATO}\n\n[Resultados del mo`, true) === RELATO, "en directo: marcador a medio escribir oculto");
t(limpiarNarracion(`${RELATO} Mira [al fondo]`, true) === `${RELATO} Mira [al fondo]`, "en directo: corchetes normales intactos");

// ---- historial para el modelo
const turnos = [
  { ts: 1, acciones: [{ nombre: "Ana", texto: "Busco" }], texto: `${RELATO}\n\n${BLOQUE}`, avisos: [{ texto: "🎲 Ana vs CD 12 → 1d20: [17] = 17 → ÉXITO (+5)" }, { texto: "🕒 Día 1, 18:02" }] },
  { ts: 2, acciones: [{ nombre: "Ana", texto: "Sigo" }], texto: "El pasillo se estrecha.", avisos: [{ texto: "🎲 " + "x".repeat(500) }] },
  { ts: 3, acciones: [{ nombre: "Ana", texto: "Hablo" }], texto: "", avisos: [{ texto: "🎲 tirada pública" }] },
  { ts: 4, acciones: [{ nombre: "Ana", texto: "Miro" }], texto: "Una puerta.", avisos: [] },
  ...Array.from({ length: 10 }, (_, i) => ({ ts: 10 + i, acciones: [{ nombre: "Ana", texto: `a${i}` }], texto: "N".repeat(1500) + i, avisos: [{ texto: "🎲 " + "y".repeat(400) }] })),
];
const h = armarHistorial(turnos, { compactadoHasta: 0, instrucciones: "INSTR", textoAcciones: (a: any[]) => a.map((x) => `${x.nombre}: ${x.texto}`).join("\n"), final: "FINAL" });
const asist = h.filter((m) => m.role === "assistant");
t(asist.length > 0, "hay mensajes assistant en el historial");
t(asist.every((m) => !/Resultados del motor/i.test(m.content) && !m.content.includes("🎲")), "ningún assistant contiene «Resultados del motor» ni «🎲»");
t(h.filter((m) => m.role === "user" && m.content.startsWith(AVISO_PROGRAMA)).length >= 5, "los resultados van en mensajes user marcados");
t(h[0].content === "INSTR" && h[h.length - 1].content.endsWith("FINAL") && h[h.length - 1].role === "user", "primero las instrucciones y último el bloque final");
{
  // cada assistant va seguido de un user, y el marcador va delante de las acciones del turno siguiente
  let bien = true;
  h.forEach((m, i) => { if (m.role === "assistant" && (!h[i + 1] || h[i + 1].role !== "user")) bien = false; });
  t(bien, "tras cada assistant viene un user");
  t(!h.some((m, i) => i > 0 && m.role === "assistant" && h[i - 1].role === "assistant"), "nunca dos assistant seguidos");
  t(h.some((m) => m.role === "user" && m.content.startsWith(AVISO_PROGRAMA) && /Ana: Sigo/.test(m.content)), "la información se funde con las acciones del turno siguiente");
}
t(h.some((m) => m.role === "user" && m.content.startsWith("[Tirada pública]\n🎲 tirada pública")), "turno sin narración: queda como [Tirada pública]");
t(asist.some((m) => m.content === RELATO), "el relato antiguo con el bloque pegado entra limpio");
{
  // Longitud del aviso recortado dentro de cada mensaje informativo: «🎲 » + n letras, más « […]».
  const infos = h.filter((m) => m.role === "user" && m.content.startsWith(AVISO_PROGRAMA));
  const largo = (m: any, c: string) => (m.content.match(new RegExp(`${c}{20,}`)) ?? [""])[0].length;
  t(infos.slice(-1).every((m) => largo(m, "y") === 350 - 3 && m.content.includes(" […]")), "los avisos recientes se recortan a 350 caracteres", String(largo(infos.slice(-1)[0], "y")));
  t(infos.some((m) => largo(m, "y") === 220 - 3), "los avisos de la franja media se recortan a 220");
  t(infos.some((m) => largo(m, "x") === 100 - 3), "los avisos antiguos se recortan a 100");
  const largos = asist.map((m) => m.content.length);
  t(largos.some((n) => n === 280 + 4) || largos.some((n) => n === 1200 + 4), "las narraciones antiguas se recortan (280 / 1200)", largos.join(","));
}
{
  // turno cuyo texto es solo el bloque: no deja el marcador en un assistant
  const solo = armarHistorial([{ ts: 1, acciones: [{ nombre: "Ana", texto: "x" }], texto: BLOQUE, avisos: [] }], { compactadoHasta: 0, instrucciones: "I", textoAcciones: () => "A", final: "F" });
  t(solo.filter((m) => m.role === "assistant").every((m) => !/Resultados del motor/i.test(m.content)), "un turno con solo el bloque no mete el marcador en un assistant");
  // compactado: los turnos viejos no entran
  const comp = armarHistorial(turnos, { compactadoHasta: 4, instrucciones: "I", textoAcciones: () => "A", final: "F" });
  t(comp.length < h.length, "los turnos ya compactados no entran");
  // tope de tamaño
  const gran = armarHistorial(turnos, { compactadoHasta: 0, instrucciones: "I", textoAcciones: () => "A", final: "F", maxBytes: 5000 });
  t(gran.length < h.length && gran.length >= 2 && gran[1].role !== "assistant" && gran[gran.length - 1].content.endsWith("F"), "el tope de tamaño recorta lo antiguo y no deja un assistant al principio");
}

console.log(`${ok} ok, ${mal} fallas`);
