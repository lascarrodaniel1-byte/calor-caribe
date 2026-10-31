// Combate en la guarida de un jefe: en la iniciativa 20 de cada asalto, el jefe puede usar UNA acción de guarida (el lugar mismo
// ataca), sin repetir la misma dos asaltos seguidos; y su presencia cambia la región. Reutiliza las habilidades de las criaturas.
import { usarHabilidad, type Habilidad } from "./bestiario.js";
import { localizar } from "./combate.js";
import type { Partida, Personaje } from "./estado.js";

interface DefGuarida {
  lugar: string;
  acciones: Habilidad[];
  /** Cómo cambia la región mientras el jefe viva (sin tiradas: lo narra el DM). */
  regional: string[];
}

const h = (nombre: string, descripcion: string, salvacion: Habilidad["salvacion"], cd: number, extra: Partial<Habilidad> = {}): Habilidad => ({ nombre, descripcion, salvacion, cd, ...extra });

export const GUARIDAS: Record<string, DefGuarida> = {
  "Vaskar, el Lobo del Eclipse": {
    lugar: "el Corazón del Bosque de Velo Rojo",
    acciones: [
      h("Luna muerta", "La luz del claro se apaga como si el eclipse bajara al bosque.", "sab", 17, { condicion: "cegado (1 asalto)" }),
      h("Raíces del bosque", "Raíces rojas brotan del suelo y agarran piernas.", "fue", 16, { condicion: "retenido (raíces)" }),
      h("Manada fantasma", "Lobos de humo salen de entre los troncos y muerden.", "des", 17, { dano: "3d8", tipo_dano: "cortante", mitad_si_exito: true }),
    ],
    regional: ["Los animales en 10 km se vuelven huraños o huyen.", "Los árboles a menos de 1,5 km sangran savia roja.", "De noche la luna se ve negra sobre el bosque."],
  },
  "El Juez Sin Ojos": {
    lugar: "la catedral sumergida bajo Aldenmar",
    acciones: [
      h("Marea de la sentencia", "El agua negra de la catedral sube de golpe.", "fue", 17, { dano: "3d6", tipo_dano: "contundente", mitad_si_exito: true, condicion: "derribado" }),
      h("Campana del juicio", "Una campana hundida retumba y anuncia la condena.", "con", 17, { dano: "4d6", tipo_dano: "trueno", mitad_si_exito: true, condicion: "ensordecido" }),
      h("Cadenas de luz", "Cadenas de luz blanca caen del techo sobre los culpables.", "des", 18, { condicion: "retenido (cadenas de luz)" }),
    ],
    regional: ["Quien duerme cerca sueña con veredictos y se despierta confesando.", "Las alcantarillas bajo Aldenmar rebosan de agua negra.", "Las campanas de la ciudad suenan solas a medianoche."],
  },
  "Ysolde, la Reina Pálida": {
    lugar: "el castillo de Vel Morhal, en la Marca Hueca",
    acciones: [
      h("Corte de sombras", "Las sombras de las paredes se alzan en figuras de cortesanos.", "sab", 18, { condicion: "asustado (corte de sombras)" }),
      h("Sed de la Reina", "El castillo bebe de los vivos.", "con", 18, { dano: "4d8", tipo_dano: "necrótico", mitad_si_exito: true }),
      h("Niebla de ataúd", "Una niebla fría llena la sala y ciega.", "des", 17, { condicion: "cegado (niebla)" }),
    ],
    regional: ["Nubes de murciélagos y niebla en 1,5 km a la redonda.", "Las velas y las antorchas se apagan solas.", "Los animales rehúyen el camino al castillo."],
  },
  "La Madre de los Hambrientos": {
    lugar: "una fosa común sin fondo en las Ciénagas de Hollín",
    acciones: [
      h("Fosa que traga", "El suelo se hunde en una boca de carne.", "fue", 17, { dano: "2d10", tipo_dano: "contundente", condicion: "retenido (fosa)" }),
      h("Exhalación de Podre", "Un aliento de carne vieja llena el aire.", "con", 16, { dano: "3d6", tipo_dano: "veneno", mitad_si_exito: true, condicion: "envenenado (Podre)" }),
      h("Brazos de cadáveres", "Brazos muertos surgen de la ciénaga y golpean.", "des", 17, { dano: "3d8", tipo_dano: "contundente", mitad_si_exito: true }),
    ],
    regional: ["El agua en 1,5 km está envenenada de Podre.", "Hambrientos errantes: 1d4 más en cada encuentro de la zona.", "Nubes de moscas y olor a carne vieja a leguas."],
  },
  "El Que Golpea Bajo la Piedra": {
    lugar: "lo más hondo de Karak-Dûm",
    acciones: [
      h("Temblor", "La roca entera se estremece bajo los pies.", "des", 18, { dano: "3d6", tipo_dano: "contundente", mitad_si_exito: true, condicion: "derribado" }),
      h("Derrumbe", "El techo cede sobre la sala.", "des", 17, { dano: "4d10", tipo_dano: "contundente", mitad_si_exito: true }),
      h("Túnel que se cierra", "La piedra se cierra como una mandíbula.", "fue", 17, { condicion: "retenido (piedra)" }),
    ],
    regional: ["Temblores en Karak-Dûm y en las minas cercanas.", "Aparecen simas nuevas en los túneles.", "Se oyen golpes en la roca, cada vez más cerca."],
  },
  "Ilvara, la Tejedora de Mañanas": {
    lugar: "el monasterio más alto de las Agujas de Vahl",
    acciones: [
      h("Hilo de futuros", "Un hilo de cabello tiende un instante de futuro sobre ti.", "sab", 19, { condicion: "aturdido (1 asalto)" }),
      h("Telar de cabellos", "Cabellos tejidos caen del techo y se enroscan.", "des", 17, { condicion: "retenido (cabellos)" }),
      h("Mañana robado", "Te roba un mañana: recuerdas lo que ya viviste.", "int", 18, { dano: "4d6", tipo_dano: "psíquico", mitad_si_exito: true }),
    ],
    regional: ["Déjà vu constante: la gente cree haber vivido ya el día.", "Sueños proféticos en las Agujas.", "Los relojes del valle marchan unos minutos adelantados."],
  },
  "Vaerth, el Sin Rostro": {
    lugar: "los barrios bajos de Aldenmar",
    acciones: [
      h("Multitud de caras", "Cada rostro de la calle se vuelve hacia ti con la misma sonrisa.", "sab", 17, { condicion: "asustado (multitud)" }),
      h("Voz de un ser querido", "Oyes a quien más quieres pedirte que bajes el arma.", "sab", 18, { condicion: "hechizado (voz prestada)" }),
      h("Pared de piel", "Las paredes se cubren de piel que se pega.", "des", 17, { condicion: "retenido (piel)" }),
    ],
    regional: ["La gente de los barrios bajos se parece cada vez más entre sí.", "Los espejos devuelven caras ajenas.", "Hay quien recuerda a un vecino que nadie más conoce."],
  },
  "Kharoth, Dragón Antiguo del Sol Herido": {
    lugar: "las Agujas de Vahl, sobre el corazón del dios Solar",
    acciones: [
      h("Calor del sol muerto", "El aire arde como un horno blanco.", "con", 22, { dano: "3d10", tipo_dano: "fuego", mitad_si_exito: true }),
      h("Grieta de luz", "Una grieta del suelo vomita luz dorada.", "des", 21, { dano: "4d8", tipo_dano: "radiante", mitad_si_exito: true }),
      h("Temblor de las agujas", "La montaña se sacude.", "fue", 20, { condicion: "derribado" }),
    ],
    regional: ["El día se queda gris en 10 km.", "La nieve de las Agujas se derrite.", "El aire pesa y cuesta respirar."],
  },
};

const norm = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
const hallar = (nombre: string): [string, DefGuarida] | undefined => Object.entries(GUARIDAS).find(([k]) => norm(k) === norm(nombre) || norm(k).includes(norm(nombre)));

export interface DatosGuarida {
  accion: "ver" | "declarar" | "actuar" | "salir";
  criatura?: string;
  /** actuar: cuál de las acciones de guarida. */
  nombre_accion?: string;
  /** actuar: por defecto, todos los personajes en pie. */
  objetivos?: string[];
}

export function guarida(partida: Partida, d: DatosGuarida): { texto: string; publico: string | null } {
  if (d.accion === "ver" && !d.criatura)
    return { texto: Object.entries(GUARIDAS).map(([k, g]) => `- ${k} (${g.lugar}): ${g.acciones.map((a) => a.nombre).join(", ")}`).join("\n"), publico: null };
  if (!d.criatura) throw new Error("Di la criatura (criatura).");
  const par = hallar(d.criatura);
  if (!par) throw new Error(`«${d.criatura}» no tiene guarida: solo la tienen ${Object.keys(GUARIDAS).join("; ")}.`);
  const [nombre, g] = par;
  if (d.accion === "ver")
    return { texto: `${nombre} — ${g.lugar}\nAcciones de guarida (una por asalto, en la iniciativa 20, sin repetir la misma dos asaltos seguidos):\n${g.acciones.map((a) => `- ${a.nombre}: ${a.descripcion} (${a.salvacion?.toUpperCase()} CD ${a.cd}${a.dano ? `, ${a.dano} ${a.tipo_dano}` : ""}${a.condicion ? `, ${a.condicion}` : ""})`).join("\n")}\nEfectos regionales:\n${g.regional.map((r) => `- ${r}`).join("\n")}`, publico: null };
  const c = partida.combate;
  if (!c) throw new Error("Las acciones de guarida son de combate: empieza con iniciativa.");
  if (d.accion === "declarar") {
    (c.guaridas ??= []);
    if (!c.guaridas.includes(nombre)) c.guaridas.push(nombre);
    return { texto: `El combate es en la guarida de ${nombre} (${g.lugar}): en la iniciativa 20 de cada asalto puede usar una acción de guarida.`, publico: `🏰 El combate es en la guarida de ${nombre}.` };
  }
  if (d.accion === "salir") {
    c.guaridas = (c.guaridas ?? []).filter((x) => x !== nombre);
    return { texto: `${nombre} deja de usar su guarida (el grupo salió de ella o la cambió).`, publico: null };
  }
  // actuar
  if (!(c.guaridas ?? []).includes(nombre)) throw new Error(`El combate no es en la guarida de ${nombre}: decláralo con guarida {accion: declarar}.`);
  const e = localizar(partida, nombre);
  if (e.tipo !== "criatura" || e.j.pv <= 0) throw new Error(`${nombre} no está en pie: no puede usar su guarida.`);
  const accion = g.acciones.find((a) => norm(a.nombre) === norm(d.nombre_accion ?? "") || norm(a.nombre).includes(norm(d.nombre_accion ?? "~")));
  if (!accion) throw new Error(`Elige una acción de guarida: ${g.acciones.map((a) => a.nombre).join(", ")}.`);
  const uso = ((c.guaridaUso ??= {})[nombre] ??= { ronda: 0, ultima: "" });
  if (uso.ronda === c.ronda) throw new Error(`${nombre} ya usó su acción de guarida este asalto.`);
  if (uso.ultima === accion.nombre && uso.ronda === c.ronda - 1) throw new Error(`${nombre} usó «${accion.nombre}» el asalto pasado: la guarida no repite la misma acción dos asaltos seguidos.`);
  const pjs: Personaje[] = (d.objetivos?.length ? d.objetivos : Object.values(partida.personajes).map((p) => p.nombre))
    .map((n) => Object.values(partida.personajes).find((p) => norm(p.nombre) === norm(n)))
    .filter((p): p is Personaje => !!p && !p.condiciones.includes("muerto") && p.pv > 0);
  if (!pjs.length) throw new Error("No hay nadie en pie a quien afecte.");
  uso.ronda = c.ronda; uso.ultima = accion.nombre;
  const texto = usarHabilidad(e.j, { ...accion, recarga: undefined }, pjs);
  return { texto: `🏰 Acción de guarida de ${nombre} (iniciativa 20):\n${texto}`, publico: `🏰 ${nombre}: ${accion.nombre}. ${accion.descripcion}` };
}

/** Lo que se dice al pasar de asalto: quién puede usar su guarida ahora. */
export function avisoGuaridas(partida: Partida): string[] {
  const c = partida.combate;
  if (!c?.guaridas?.length) return [];
  const out: string[] = [];
  for (const n of c.guaridas) {
    const g = GUARIDAS[n];
    const j = partida.jefes[n];
    if (!g || !j || j.pv <= 0) continue;
    const ultima = c.guaridaUso?.[n]?.ultima;
    out.push(`🏰 Iniciativa 20: ${n} puede usar UNA acción de guarida este asalto (guarida {accion: actuar, criatura, nombre_accion}): ${g.acciones.filter((a) => a.nombre !== ultima || c.guaridaUso?.[n]?.ronda !== c.ronda - 1).map((a) => a.nombre).join(", ")}.`);
  }
  return out;
}

export function textoGuaridas(partida: Partida): string {
  const c = partida.combate;
  if (!c?.guaridas?.length) return "";
  return `## Guaridas en juego\n${c.guaridas.map((n) => `- ${n}: ${GUARIDAS[n]?.lugar ?? ""}. Efectos regionales: ${GUARIDAS[n]?.regional.join(" ") ?? ""}`).join("\n")}`;
}

export const REGLAS_GUARIDA = `## Guarida de los jefes
- Ocho jefes tienen guarida (guarida {accion: ver}): Vaskar, el Juez Sin Ojos, Ysolde, la Madre de los Hambrientos, el Que Golpea Bajo la Piedra, Ilvara, Vaerth y Kharoth. Si el combate es en su guarida, decláralo con guarida {accion: declarar, criatura}: desde entonces, en la iniciativa 20 de cada asalto (te lo recuerda siguiente_asalto) el lugar mismo ataca: guarida {accion: actuar, criatura, nombre_accion, objetivos} resuelve UNA acción de guarida (salvación, daño y condición), no la misma dos asaltos seguidos, solo mientras el jefe está en pie. Fuera de la guarida, no. Con guarida {accion: ver, criatura} ves sus acciones y los efectos regionales que debes narrar en toda su zona (no tienen tirada).`;
