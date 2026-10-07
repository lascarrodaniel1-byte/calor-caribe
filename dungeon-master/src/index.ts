// Dungeon Master de D&D en la terminal. Uso: npm run jugar [-- --nueva]
import Anthropic from "@anthropic-ai/sdk";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";
import { describir, tirar } from "./dados.js";
import { cargar, fichaTexto, guardar, nuevaPartida, type Partida } from "./estado.js";
import { ejecutar, herramientas } from "./herramientas.js";
import { AMBIENTACION, textoRazasYClases } from "./mundo.js";
import { SISTEMA } from "./prompt.js";

const MODELO = process.env.DM_MODELO ?? "claude-opus-5-5";
// Modelos que aceptan fallbacks: "default" (si el modelo rechaza la petición,
// la API la reintenta en otro modelo en vez de cortar la partida).
const CON_FALLBACK = new Set(["claude-opus-5-5", "claude-opus-5", "claude-fable-5-1", "claude-sonnet-5-5"]);

const aqui = dirname(fileURLToPath(import.meta.url));
const RUTA = process.env.DM_PARTIDA ?? join(aqui, "..", "partida.json");

const gris = (s: string) => `\x1b[90m${s}\x1b[0m`;
const amarillo = (s: string) => `\x1b[33m${s}\x1b[0m`;
const cian = (s: string) => `\x1b[36m${s}\x1b[0m`;

const AYUDA = `Comandos:
  /fichas          muestra las fichas de los personajes (con heridas y secuelas)
  /mundo           ambientación de Velmora
  /razas           razas y clases disponibles
  /notas           muestra las notas de campaña del DM
  /tirar 1d20+3    tira dados tú mismo (sin pasar por el DM)
  /ayuda           muestra esta ayuda
  /salir           guarda y sale
Todo lo demás se lo dices al Dungeon Master. Si juegan varios, empieza con tu nombre:
  "Ana: abro la puerta con cuidado"`;

const client = new Anthropic();

async function turno(partida: Partida, texto: string): Promise<void> {
  // Si algo falla, volvemos al punto de partida para no dejar el historial a medias.
  const inicio = partida.historial.length;
  partida.historial.push({ role: "user", content: texto });

  try {
    for (;;) {
      const stream = client.beta.messages.stream({
        model: MODELO,
        max_tokens: 32000,
        system: SISTEMA,
        tools: herramientas,
        messages: partida.historial,
        output_config: { effort: "medium" },
        cache_control: { type: "ephemeral" },
        ...(CON_FALLBACK.has(MODELO)
          ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const }
          : {}),
      });

      let alFinalDeLinea = true;
      stream.on("text", (delta) => {
        process.stdout.write(delta);
        alFinalDeLinea = delta.endsWith("\n");
      });
      const respuesta = await stream.finalMessage();
      if (!alFinalDeLinea) process.stdout.write("\n");

      if (respuesta.stop_reason === "refusal") {
        partida.historial.length = inicio;
        console.log(amarillo("\n(El DM no pudo continuar con eso. Prueba a reformular tu acción.)"));
        return;
      }

      partida.historial.push({ role: "assistant", content: respuesta.content });

      if (respuesta.stop_reason === "pause_turn") continue;
      if (respuesta.stop_reason !== "tool_use") {
        if (respuesta.stop_reason === "max_tokens") console.log(gris("(respuesta cortada por longitud)"));
        break;
      }

      const resultados: Anthropic.Beta.BetaToolResultBlockParam[] = [];
      for (const bloque of respuesta.content) {
        if (bloque.type !== "tool_use") continue;
        const r = ejecutar(bloque.name, bloque.input, partida);
        if (r.aviso) console.log(cian(r.aviso));
        if (r.error) console.log(gris(`(error de herramienta: ${r.contenido})`));
        resultados.push({ type: "tool_result", tool_use_id: bloque.id, content: r.contenido, is_error: r.error });
      }
      // Todos los resultados van juntos en un solo mensaje.
      partida.historial.push({ role: "user", content: resultados });
    }
  } catch (err) {
    partida.historial.length = inicio;
    if (err instanceof Anthropic.AuthenticationError) {
      console.log(amarillo("\nNo hay credenciales válidas. Define ANTHROPIC_API_KEY (ver README)."));
    } else if (err instanceof Anthropic.RateLimitError) {
      console.log(amarillo("\nDemasiadas peticiones; espera un momento y vuelve a intentarlo."));
    } else if (err instanceof Anthropic.APIError) {
      console.log(amarillo(`\nError de la API (${err.status}): ${err.message}`));
    } else {
      throw err;
    }
    return;
  }

  guardar(RUTA, partida);
}

async function main() {
  const nueva = process.argv.includes("--nueva");
  let partida = !nueva ? cargar(RUTA) : null;
  const reanudada = partida !== null && partida.historial.length > 0;
  partida ??= nuevaPartida();

  console.log(amarillo("⚔️  Dungeon Master · Velmora, el Reino del Sol Herido") + gris(`  (modelo: ${MODELO}, partida: ${RUTA})`));
  console.log(gris("Escribe /ayuda para ver los comandos.\n"));

  if (reanudada) {
    await turno(
      partida,
      "(Retomamos la partida después de una pausa. Haz un breve resumen de \"lo que pasó la última vez\" y devuélvenos a la escena.)",
    );
  } else {
    if (existsSync(RUTA) && nueva) console.log(gris("(Se empezará una partida nueva; la anterior se sobrescribirá al jugar.)"));
    await turno(partida, "Hola, queremos jugar una partida nueva de D&D. ¡Empecemos!");
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  rl.on("SIGINT", () => {
    guardar(RUTA, partida);
    console.log(gris("\nPartida guardada. ¡Hasta la próxima!"));
    process.exit(0);
  });

  for (;;) {
    let texto: string;
    try {
      texto = (await rl.question(amarillo("\n> "))).trim();
    } catch {
      break; // stdin cerrado
    }
    if (!texto) continue;

    if (texto.startsWith("/")) {
      const [cmd, ...args] = texto.split(/\s+/);
      if (cmd === "/salir") break;
      if (cmd === "/ayuda") console.log(AYUDA);
      else if (cmd === "/fichas") {
        const ps = Object.values(partida.personajes);
        console.log(ps.length ? ps.map(fichaTexto).join("\n\n") : "Aún no hay personajes.");
      } else if (cmd === "/mundo") {
        console.log(AMBIENTACION.replace(/\*\*/g, ""));
      } else if (cmd === "/razas") {
        console.log(textoRazasYClases().replace(/\*\*/g, ""));
      } else if (cmd === "/notas") {
        console.log(partida.notas_mundo.length ? partida.notas_mundo.map((n) => `- ${n}`).join("\n") : "Sin notas todavía.");
      } else if (cmd === "/tirar") {
        try {
          console.log(cian(`🎲 ${describir(tirar(args.join("") || "1d20"))}`));
        } catch (e) {
          console.log((e as Error).message);
        }
      } else console.log(`Comando desconocido. ${AYUDA}`);
      continue;
    }

    console.log();
    await turno(partida, texto);
  }

  rl.close();
  guardar(RUTA, partida);
  console.log(gris("Partida guardada. ¡Hasta la próxima!"));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
