// Punto de entrada de la versión web (artifact de claude.ai): el mismo motor que
// la terminal, empaquetado para el navegador. El DM es Claude a través de la
// capacidad "sample" del artifact, que llama al motor con la herramienta "motor".
import { estadoTexto, fichaCriatura } from "./bestiario.js";
import { fichaTexto, normalizarPartida, nuevaPartida, type Partida } from "./estado.js";
import { ejecutar, herramientas } from "./herramientas.js";
import { ALTO, ANCHO, REGIONES, textoMapa } from "./mapa.js";
import { comando } from "./mesa.js";
import { catalogoCompacto, consultarReglas, SISTEMA_WEB } from "./prompt-web.js";

/** Catálogo compacto de las acciones del motor, para el prompt del DM. */
export function catalogoAcciones(): string {
  return herramientas
    .map((h) => `### ${h.name}\n${h.description}\nDatos (JSON Schema): ${JSON.stringify(h.input_schema)}`)
    .join("\n\n");
}

/** Estado de la partida tal y como lo necesita el DM (incluye secretos que los jugadores no ven en la página). */
export function estadoParaDM(p: Partida): string {
  const partes: string[] = [];
  partes.push(`## Mapa\n${textoMapa(p.mapa)}`);
  const pjs = Object.values(p.personajes);
  partes.push(`## Personajes jugadores\n${pjs.length ? pjs.map(fichaTexto).join("\n\n") : "Aún no hay personajes: hay que crearlos."}`);
  if (p.notas_mundo.length) partes.push(`## Notas de campaña\n${p.notas_mundo.map((n) => `- ${n}`).join("\n")}`);
  const jefes = Object.values(p.jefes);
  if (jefes.length) {
    partes.push(
      `## Criaturas en escena (SECRETO)\n${jefes
        .map(
          (j) =>
            `${fichaCriatura(j.definicion)}\nESTADO: ${j.pv}/${j.pv_max} PV (${estadoTexto(j)})` +
            (j.presagios.length ? ` · presagios [${j.presagios.join(", ")}]` : "") +
            (j.gastadas.length ? ` · habilidades gastadas: ${j.gastadas.join(", ")}` : "") +
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

export { ALTO, ANCHO, catalogoCompacto, comando, consultarReglas, ejecutar, fichaTexto, normalizarPartida, nuevaPartida, REGIONES, SISTEMA_WEB };
