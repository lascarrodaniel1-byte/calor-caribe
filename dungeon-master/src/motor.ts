// Motor de la partida, compartido por la terminal (index.ts) y la web (servidor.ts):
// un turno del DM con streaming y bucle de herramientas, y los comandos de mesa.
import Anthropic from "@anthropic-ai/sdk";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describir, tirar } from "./dados.js";
import { fichaTexto, guardar, type Partida } from "./estado.js";
import { ejecutar, herramientas } from "./herramientas.js";
import { AMBIENTACION, textoRazasYClases } from "./mundo.js";
import { SISTEMA } from "./prompt.js";
import { VIALES } from "./viales.js";

export const MODELO = process.env.DM_MODELO ?? "claude-opus-5-5";
// Modelos que aceptan fallbacks: "default" (si el modelo rechaza la petición,
// la API la reintenta en otro modelo en vez de cortar la partida).
const CON_FALLBACK = new Set(["claude-opus-5-5", "claude-opus-5", "claude-fable-5-1", "claude-sonnet-5-5"]);

const aqui = dirname(fileURLToPath(import.meta.url));
export const RUTA = process.env.DM_PARTIDA ?? join(aqui, "..", "partida.json");

export const MENSAJE_NUEVA = "Hola, queremos jugar una partida nueva de D&D. ¡Empecemos!";
export const MENSAJE_REANUDAR =
  '(Retomamos la partida después de una pausa. Haz un breve resumen de "lo que pasó la última vez" y devuélvenos a la escena.)';

/** Por dónde sale lo que pasa durante un turno. */
export interface Salida {
  /** Fragmento de la narración del DM, según se genera. */
  texto(delta: string): void;
  /** Resultado visible de una herramienta (dados, heridas, botín…). */
  aviso(texto: string): void;
  /** Mensaje del sistema (errores, notas). */
  info(texto: string): void;
}

const client = new Anthropic();

/** Ejecuta un turno completo del DM. Devuelve false si falló y el historial se revirtió. */
export async function turno(partida: Partida, texto: string, salida: Salida): Promise<boolean> {
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
      stream.on("text", (delta) => salida.texto(delta));
      const respuesta = await stream.finalMessage();

      if (respuesta.stop_reason === "refusal") {
        partida.historial.length = inicio;
        salida.info("El DM no pudo continuar con eso. Prueba a reformular la acción.");
        return false;
      }

      partida.historial.push({ role: "assistant", content: respuesta.content });

      if (respuesta.stop_reason === "pause_turn") continue;
      if (respuesta.stop_reason !== "tool_use") {
        if (respuesta.stop_reason === "max_tokens") salida.info("(respuesta cortada por longitud)");
        break;
      }

      const resultados: Anthropic.Beta.BetaToolResultBlockParam[] = [];
      for (const bloque of respuesta.content) {
        if (bloque.type !== "tool_use") continue;
        const r = ejecutar(bloque.name, bloque.input, partida);
        if (r.aviso) salida.aviso(r.aviso);
        if (r.error) salida.info(`(error de herramienta: ${r.contenido})`);
        resultados.push({ type: "tool_result", tool_use_id: bloque.id, content: r.contenido, is_error: r.error });
      }
      // Todos los resultados van juntos en un solo mensaje.
      partida.historial.push({ role: "user", content: resultados });
    }
  } catch (err) {
    partida.historial.length = inicio;
    if (err instanceof Anthropic.AuthenticationError) {
      salida.info("No hay credenciales válidas. Define ANTHROPIC_API_KEY (ver README).");
    } else if (err instanceof Anthropic.RateLimitError) {
      salida.info("Demasiadas peticiones; espera un momento y vuelve a intentarlo.");
    } else if (err instanceof Anthropic.APIError) {
      salida.info(`Error de la API (${err.status}): ${err.message}`);
    } else {
      throw err;
    }
    return false;
  }

  guardar(RUTA, partida);
  return true;
}

export const AYUDA = `Comandos:
  /fichas          fichas de los personajes (con heridas y secuelas)
  /mundo           ambientación de Velmora
  /razas           razas y clases disponibles
  /viales          qué hace cada vial
  /notas           notas de campaña del DM
  /tirar 1d20+3    tira dados tú mismo (sin pasar por el DM)
  /ayuda           esta ayuda`;

/** Comandos de mesa (sin pasar por el DM). Devuelve null si no es un comando conocido. */
export function comando(partida: Partida, texto: string): { texto: string; publico: boolean } | null {
  const [cmd, ...args] = texto.trim().split(/\s+/);
  switch (cmd) {
    case "/ayuda":
      return { texto: AYUDA, publico: false };
    case "/fichas": {
      const ps = Object.values(partida.personajes);
      return { texto: ps.length ? ps.map(fichaTexto).join("\n\n") : "Aún no hay personajes.", publico: false };
    }
    case "/mundo":
      return { texto: AMBIENTACION.replace(/\*\*/g, ""), publico: false };
    case "/razas":
      return { texto: textoRazasYClases().replace(/\*\*/g, ""), publico: false };
    case "/viales":
      return { texto: Object.entries(VIALES).map(([n, v]) => `- ${n} (${v.tipo}): ${v.descripcion}`).join("\n"), publico: false };
    case "/notas":
      return { texto: partida.notas_mundo.length ? partida.notas_mundo.map((n) => `- ${n}`).join("\n") : "Sin notas todavía.", publico: false };
    case "/tirar":
      try {
        return { texto: `🎲 ${describir(tirar(args.join("") || "1d20"))}`, publico: true };
      } catch (e) {
        return { texto: (e as Error).message, publico: false };
      }
    default:
      return null;
  }
}
