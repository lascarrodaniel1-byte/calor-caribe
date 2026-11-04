// Que al DM no se le olviden cosas ni deje de actualizarlas:
// 1) un LIBRO DE SUCESOS automático: el programa anota solo lo que el DM registra (lugares, PNJ, cambios de ficha, trama, experiencia, muertes), con la hora;
// 2) un REPASO tras cada turno: pistas deterministas de lo que la narración cuenta y el DM no registró, y el texto para que una segunda pasada,
//    corta y centrada en el registro, lo ponga al día con las mismas herramientas.
import type { Partida } from "./estado.js";
import { textoReloj } from "./espacio.js";

import { fugasDeSaber } from "./saber.js";
const MAX_SUCESOS = 80;

const hora = (p: Partida) => (p.reloj ? textoReloj(p.reloj).replace(/ \(.*\)$/, "") : "");

/** Anota un suceso del libro (sin repetir el último). */
export function anotarSuceso(partida: Partida, texto: string): void {
  if (!texto) return;
  const l = (partida.sucesos ??= []);
  const linea = `${hora(partida)}: ${texto}`.replace(/^: /, "");
  if (l[l.length - 1] === linea) return;
  l.push(linea.slice(0, 220));
  while (l.length > MAX_SUCESOS) l.shift();
}

/** Lo que el DM acaba de registrar con una herramienta (ya validado), pasado al libro de sucesos. */
export function sucesoDeHerramienta(partida: Partida, nombre: string, entrada: unknown, contenido: string, aviso?: string): void {
  const e = (entrada ?? {}) as Record<string, unknown>;
  const primera = (aviso || contenido).split("\n")[0].replace(/^\S*\s{1,2}(?=\p{L})/u, "").slice(0, 160);
  switch (nombre) {
    case "ubicacion":
      if (e.viajando_hacia) anotarSuceso(partida, `🧭 de camino a ${e.viajando_hacia}`);
      else if (e.lugar) anotarSuceso(partida, `🗺 ${e.lugar}${e.region ? ` (${e.region})` : ""}`);
      break;
    case "pnj":
      anotarSuceso(partida, `👤 ${e.nombre}${e.rol ? `, ${e.rol}` : ""}${e.actitud ? ` · actitud: ${e.actitud}` : ""}${e.estado ? ` · ${e.estado}` : ""}${e.dijo ? ` · dijo: «${String(e.dijo).slice(0, 80)}»` : ""}`);
      break;
    case "trama":
      for (const l of contenido.split("\n")) if (/^(Arco (abierto|cerrado)|Pista revelada)/.test(l)) anotarSuceso(partida, `📖 ${l.slice(0, 160)}`);
      break;
    case "experiencia": case "subir_nivel": case "eleccion_nivel": case "modificar_personaje": case "tratar_herida": case "infligir_herida":
      anotarSuceso(partida, `✎ ${primera}`);
      break;
    case "crear_objeto": case "behelit": case "regente":
      anotarSuceso(partida, `✎ ${nombre}: ${primera}`);
      break;
  }
}

export function textoSucesos(partida: Partida, n = 20): string {
  const l = (partida.sucesos ?? []).slice(-n);
  return l.length ? `## Libro de sucesos (lo que ya has registrado, en orden; los últimos ${l.length})\n${l.map((x) => `- ${x}`).join("\n")}` : "";
}

const sinMarca = (t: string) => t.split("<<secuencia")[0];
const norm = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

/** Lo que la narración cuenta y las herramientas del turno no reflejan (sugerencias para el repaso; pueden ser falsas alarmas). */
export function pistasDeRepaso(partida: Partida, d: { texto: string; llamadas: string[]; relojAntes?: number }): string[] {
  const t = sinMarca(d.texto);
  const usa = (...n: string[]) => d.llamadas.some((l) => n.includes(l));
  const pistas: string[] = [];
  if (partida.reloj && d.relojAntes !== undefined && partida.reloj.segundos - d.relojAntes <= 600 && /\b(amanece|anochece|atardece|al día siguiente|a la mañana siguiente|horas después|pasan (varias |unas |dos |tres )?(horas|días)|toda la noche|una hora (después|más tarde)|dormís|duermen|descansan hasta)\b/i.test(t))
    pistas.push("La narración hace pasar tiempo (horas, noche o días) pero el reloj apenas se movió: usa tiempo {avanzar} o descanso.");
  if (/\b\d+\s*(po|piezas? de oro|monedas?|platas?|cobres?|pc)\b/i.test(t) && !usa("modificar_personaje", "generar_botin"))
    pistas.push("Se habla de dinero (cobros, pagos, botín) y no registraste cambios de oro: modificar_personaje {oro_cambio}.");
  if (/\b(recoge|recogen|coge|toma|se lleva|le entrega|te entrega|le da|te da|regala|compra|compran|vende|encuentra entre|saquea|se guarda)\b/i.test(t) && !usa("modificar_personaje", "generar_botin", "crear_objeto"))
    pistas.push("Alguien gana, da, compra o pierde objetos y no registraste cambios de inventario: modificar_personaje {agregar_objetos|quitar_objetos}.");
  const conocidos = new Set([...Object.values(partida.personajes).flatMap((p) => [p.nombre, p.jugador ?? ""]), ...Object.keys(partida.pnjs ?? {}), ...Object.keys(partida.jefes ?? {})].filter(Boolean).map(norm));
  const nuevos = new Set<string>();
  for (const m of t.matchAll(/\b(?:llamad[oa]|se llama|responde al nombre de|conocid[oa] como|de nombre)\s+([A-ZÁÉÍÓÚÑ][\wáéíóúñ'-]+(?:\s+(?:de|del|la|el)?\s*[A-ZÁÉÍÓÚÑ][\wáéíóúñ'-]+)?)/g)) {
    const n = m[1].trim();
    if (!conocidos.has(norm(n)) && ![...conocidos].some((c) => c.includes(norm(n)) || norm(n).includes(c))) nuevos.add(n);
  }
  if (nuevos.size && !usa("pnj")) pistas.push(`Aparecen personajes con nombre que no están en la lista de PNJ: ${[...nuevos].join(", ")} (pnj {nombre, rol, actitud, quiere}).`);
  if (/\b([Ll]legan?|[Ee]ntran? en|[Ee]ntras en|[Aa]lcanzan?|[Cc]ruzan?|[Ss]alen? de|[Pp]arten? hacia|[Ss]e dirigen a)\s+(?:a |al |en |hacia )?(?:la |el |las |los )?[A-ZÁÉÍÓÚÑ]/.test(t) && !usa("ubicacion"))
    pistas.push("El grupo parece cambiar de lugar y no registraste la ubicación: ubicacion {lugar}.");
  if (/\b(sangra|herid[oa]|se rompe|se fractura|cojea|queda inconsciente|cae inconsciente|envenenad[oa]|quemadur)/i.test(t) && !usa("infligir_herida", "condicion", "modificar_personaje", "atacar", "tratar_herida", "danar_criatura"))
    pistas.push("Alguien sale herido, envenenado o inconsciente y no registraste heridas ni condiciones (infligir_herida / condicion).");
  if (/\b(promete|prometen|jura|juran|acuerdan|se compromete|queda en|te debe|le debe|deuda|trato hecho)\b/i.test(t) && !usa("anotar_mundo", "pnj", "trama"))
    pistas.push("Hay una promesa, una deuda o un trato en la escena que no está anotado: anotar_mundo o la trama (para que no se olvide).");
  for (const x of fugasDeSaber(partida, t)) pistas.push(`La narración parece soltar un secreto de «${x.nombre}» que el mundo aún no sabe: si ya es público (lo contó un testigo, lo publicaron los jugadores) regístralo con saber {accion: revelar, tema: «${x.nombre}»}; si fue un desliz, que ningún PNJ lo repita.`);
  return pistas;
}

/** El texto de la segunda pasada: solo registrar, sin narrar. */
export function promptRepaso(d: { acciones: string; texto: string; llamadas: string[]; pistas: string[]; estado: string }): string {
  return [
    "# REPASO DE REGISTRO (no narres: solo registra)",
    "Acabas de narrar un turno de la partida. Esta segunda pasada es breve y solo sirve para que NADA se quede sin registrar ni se olvide. Compara lo narrado con el estado y, con las herramientas del motor, registra lo que falte:",
    "- hora y lugar (tiempo, ubicacion), personajes nuevos o que cambian de actitud/estado (pnj), objetos ganados, perdidos o gastados, oro, heridas, condiciones y PV (modificar_personaje, infligir_herida, condicion), trama (trama), y los detalles que deben recordarse siempre: nombres, precios, promesas, deudas, secretos descubiertos (anotar_mundo; corrige las notas que ya no sean ciertas).",
    "- No repitas lo que ya está registrado ni inventes nada que la narración no diga. No hagas tiradas nuevas ni cambies el resultado de lo narrado.",
    "- Si todo está registrado, responde solo «ok».",
    d.pistas.length ? `\n## Posibles omisiones (detectadas automáticamente; pueden ser falsas alarmas, compruébalas)\n${d.pistas.map((p) => `- ${p}`).join("\n")}` : "",
    `\n## Acción de los jugadores\n${d.acciones}`,
    `\n## Tu narración de este turno\n${sinMarca(d.texto).slice(0, 6000)}`,
    `\n## Herramientas que ya usaste en el turno\n${d.llamadas.length ? d.llamadas.join(", ") : "(ninguna)"}`,
    `\n## Estado actual\n${d.estado}`,
  ].filter(Boolean).join("\n");
}
