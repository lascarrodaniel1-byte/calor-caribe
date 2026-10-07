// Herramientas que el Dungeon Master (Claude) puede usar. Los dados los tira
// este programa, no el modelo, para que los resultados sean realmente aleatorios.
import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { describir, tirar } from "./dados.js";
import { fichaTexto, type Partida, type Personaje } from "./estado.js";

const atributo = z.number().int().min(1).max(30);

const esquemas = {
  tirar_dados: z.object({
    expresion: z.string().describe('Notación de dados, p. ej. "1d20+5", "2d6+3", "4d6kh3", "1d100"'),
    motivo: z.string().describe('Para qué es la tirada, p. ej. "Ataque con espada larga de Thorin contra el goblin"'),
    modo: z.enum(["normal", "ventaja", "desventaja"]).optional().describe("Ventaja o desventaja (solo aplica a 1d20)"),
    oculta: z.boolean().optional().describe("true si es una tirada secreta del DM que los jugadores no deben ver"),
  }),
  guardar_personaje: z.object({
    nombre: z.string(),
    jugador: z.string().optional().describe("Nombre de la persona que lo juega"),
    raza: z.string(),
    clase: z.string(),
    nivel: z.number().int().min(1).max(20),
    pv_max: z.number().int().min(1),
    pv: z.number().int().optional().describe("PV actuales; por defecto, igual a pv_max"),
    ca: z.number().int().min(1),
    atributos: z.object({ fue: atributo, des: atributo, con: atributo, int: atributo, sab: atributo, car: atributo }),
    inventario: z.array(z.string()).optional(),
    oro: z.number().int().min(0).optional(),
    notas: z.string().optional().describe("Trasfondo, rasgos, conjuros, competencias…"),
  }),
  modificar_personaje: z.object({
    nombre: z.string(),
    pv_cambio: z.number().int().optional().describe("Negativo para daño, positivo para curación"),
    oro_cambio: z.number().int().optional(),
    agregar_objetos: z.array(z.string()).optional(),
    quitar_objetos: z.array(z.string()).optional(),
    agregar_condiciones: z.array(z.string()).optional().describe('p. ej. "envenenado", "derribado"'),
    quitar_condiciones: z.array(z.string()).optional(),
    nivel: z.number().int().min(1).max(20).optional(),
    pv_max: z.number().int().min(1).optional(),
    notas: z.string().optional().describe("Reemplaza las notas de la ficha"),
  }),
  anotar_mundo: z.object({
    nota: z.string().describe("Hecho importante de la campaña: PNJ, misión, lugar, pista, deuda, promesa…"),
  }),
};

type Nombre = keyof typeof esquemas;

const descripciones: Record<Nombre, string> = {
  tirar_dados:
    "Tira dados de verdad. Úsala SIEMPRE que haya que tirar (ataques, daño, salvaciones, pruebas, iniciativa, " +
    "tablas aleatorias). Nunca inventes un resultado de dados.",
  guardar_personaje:
    "Crea o reemplaza la ficha completa de un personaje jugador. Úsala al terminar la creación de personaje.",
  modificar_personaje:
    "Aplica cambios a la ficha de un personaje: daño/curación, oro, objetos, condiciones, subida de nivel.",
  anotar_mundo:
    "Guarda un hecho importante de la campaña para no olvidarlo en sesiones futuras.",
};

export const herramientas: Anthropic.Beta.BetaTool[] = (Object.keys(esquemas) as Nombre[]).map((nombre) => {
  const { $schema: _ignorado, ...schema } = z.toJSONSchema(esquemas[nombre]) as Record<string, unknown>;
  return {
    name: nombre,
    description: descripciones[nombre],
    input_schema: schema as Anthropic.Beta.BetaTool.InputSchema,
    // Con streaming, los argumentos llegan a medida que se generan; por eso
    // los validamos nosotros con zod antes de ejecutar.
    eager_input_streaming: true,
  };
});

export interface Resultado {
  contenido: string;
  /** Lo que se le muestra al jugador en pantalla (null = nada). */
  aviso: string | null;
  error?: boolean;
}

function buscar(partida: Partida, nombre: string): Personaje {
  const p =
    partida.personajes[nombre] ??
    Object.values(partida.personajes).find((x) => x.nombre.toLowerCase() === nombre.toLowerCase());
  if (!p) {
    const hay = Object.keys(partida.personajes).join(", ") || "ninguno";
    throw new Error(`No existe el personaje "${nombre}". Personajes: ${hay}`);
  }
  return p;
}

export function ejecutar(nombre: string, entrada: unknown, partida: Partida): Resultado {
  if (!(nombre in esquemas)) return { contenido: `Herramienta desconocida: ${nombre}`, aviso: null, error: true };
  const validado = esquemas[nombre as Nombre].safeParse(entrada);
  if (!validado.success) {
    return { contenido: `Argumentos no válidos: ${z.prettifyError(validado.error)}`, aviso: null, error: true };
  }

  try {
    switch (nombre as Nombre) {
      case "tirar_dados": {
        const e = validado.data as z.infer<typeof esquemas.tirar_dados>;
        const t = tirar(e.expresion, e.modo ?? "normal");
        const linea = describir(t);
        const modo = e.modo && e.modo !== "normal" ? ` con ${e.modo}` : "";
        return {
          contenido: JSON.stringify({ ...t, motivo: e.motivo }),
          aviso: e.oculta ? "🎲 (el DM tira en secreto…)" : `🎲 ${e.motivo}${modo} → ${linea}`,
        };
      }
      case "guardar_personaje": {
        const e = validado.data as z.infer<typeof esquemas.guardar_personaje>;
        const p: Personaje = {
          ...e,
          pv: e.pv ?? e.pv_max,
          inventario: e.inventario ?? [],
          oro: e.oro ?? 0,
          condiciones: [],
          notas: e.notas ?? "",
        };
        partida.personajes[p.nombre] = p;
        return { contenido: `Ficha guardada:\n${fichaTexto(p)}`, aviso: `📜 Ficha guardada:\n${fichaTexto(p)}` };
      }
      case "modificar_personaje": {
        const e = validado.data as z.infer<typeof esquemas.modificar_personaje>;
        const p = buscar(partida, e.nombre);
        const cambios: string[] = [];
        if (e.pv_max !== undefined) p.pv_max = e.pv_max;
        if (e.nivel !== undefined) {
          p.nivel = e.nivel;
          cambios.push(`nivel ${p.nivel}`);
        }
        if (e.pv_cambio) {
          p.pv = Math.max(0, Math.min(p.pv_max, p.pv + e.pv_cambio));
          cambios.push(`${e.pv_cambio > 0 ? "+" : ""}${e.pv_cambio} PV (${p.pv}/${p.pv_max})`);
        }
        if (e.oro_cambio) {
          p.oro = Math.max(0, p.oro + e.oro_cambio);
          cambios.push(`${e.oro_cambio > 0 ? "+" : ""}${e.oro_cambio} oro`);
        }
        for (const o of e.agregar_objetos ?? []) {
          p.inventario.push(o);
          cambios.push(`+ ${o}`);
        }
        for (const o of e.quitar_objetos ?? []) {
          const i = p.inventario.findIndex((x) => x.toLowerCase() === o.toLowerCase());
          if (i >= 0) {
            p.inventario.splice(i, 1);
            cambios.push(`- ${o}`);
          }
        }
        for (const c of e.agregar_condiciones ?? []) if (!p.condiciones.includes(c)) p.condiciones.push(c);
        if (e.quitar_condiciones) p.condiciones = p.condiciones.filter((c) => !e.quitar_condiciones!.includes(c));
        if (e.notas !== undefined) p.notas = e.notas;
        if (p.pv === 0) cambios.push("¡a 0 PV! (inconsciente)");
        return {
          contenido: `Ficha actualizada:\n${fichaTexto(p)}`,
          aviso: cambios.length ? `✏️  ${p.nombre}: ${cambios.join(" · ")}` : null,
        };
      }
      case "anotar_mundo": {
        const e = validado.data as z.infer<typeof esquemas.anotar_mundo>;
        partida.notas_mundo.push(e.nota);
        return { contenido: "Nota guardada.", aviso: null };
      }
    }
  } catch (err) {
    return { contenido: (err as Error).message, aviso: null, error: true };
  }
}
