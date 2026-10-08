// Equipamiento y botín: armas, armaduras, accesorios y viales, con calidades
// desde lo defectuoso hasta las reliquias. Lo maldito se oculta a los jugadores.
import { tirar } from "./dados.js";
import type { Partida } from "./estado.js";
import { APARIENCIA } from "./behelit.js";
import { VIALES, type NombreVial } from "./viales.js";

export const CALIDADES_OBJETO = ["defectuoso", "normal", "de calidad", "encantado", "maldito", "reliquia"] as const;
export type CalidadObjeto = (typeof CALIDADES_OBJETO)[number];
export const ORIGENES = ["compra", "saqueo", "hallazgo", "jefe"] as const;
export type Origen = (typeof ORIGENES)[number];

export interface Objeto {
  id: string;
  /** Lo que ven los jugadores. */
  nombre: string;
  calidad: CalidadObjeto;
  /** Descripción de lo que parece. */
  apariencia: string;
  /** La verdad completa (con la maldición, si la hay). Solo para el DM. */
  verdad: string;
  precio: number;
  identificado: boolean;
}

type Clase = "arma" | "armadura" | "accesorio";
interface Base {
  nombre: string;
  clase: Clase;
  detalle: string;
  precio: number;
}

const BASES: Base[] = [
  { nombre: "Daga", clase: "arma", detalle: "1d4 perforante, sutil, arrojadiza", precio: 2 },
  { nombre: "Espada corta", clase: "arma", detalle: "1d6 perforante, sutil", precio: 10 },
  { nombre: "Espada larga", clase: "arma", detalle: "1d8 cortante (1d10 a dos manos)", precio: 15 },
  { nombre: "Estoque", clase: "arma", detalle: "1d8 perforante, sutil", precio: 25 },
  { nombre: "Hacha de mano", clase: "arma", detalle: "1d6 cortante, arrojadiza", precio: 5 },
  { nombre: "Hacha a dos manos", clase: "arma", detalle: "1d12 cortante, pesada", precio: 30 },
  { nombre: "Martillo de guerra", clase: "arma", detalle: "1d8 contundente (1d10 a dos manos)", precio: 15 },
  { nombre: "Mangual", clase: "arma", detalle: "1d8 contundente", precio: 10 },
  { nombre: "Lanza", clase: "arma", detalle: "1d6 perforante, arrojadiza", precio: 1 },
  { nombre: "Alabarda", clase: "arma", detalle: "1d10 cortante, pesada, alcance", precio: 20 },
  { nombre: "Guadaña de guerra", clase: "arma", detalle: "1d10 cortante, pesada, alcance", precio: 20 },
  { nombre: "Ballesta ligera", clase: "arma", detalle: "1d8 perforante, 24/96 m", precio: 25 },
  { nombre: "Ballesta pesada", clase: "arma", detalle: "1d10 perforante, 30/120 m, pesada", precio: 50 },
  { nombre: "Arco largo", clase: "arma", detalle: "1d8 perforante, 45/180 m", precio: 50 },
  { nombre: "Armadura de cuero", clase: "armadura", detalle: "CA 11 + DES", precio: 10 },
  { nombre: "Cuero tachonado", clase: "armadura", detalle: "CA 12 + DES", precio: 45 },
  { nombre: "Cota de escamas", clase: "armadura", detalle: "CA 14 + DES (máx. 2), desventaja en Sigilo", precio: 50 },
  { nombre: "Cota de mallas", clase: "armadura", detalle: "CA 16, FUE 13, desventaja en Sigilo", precio: 75 },
  { nombre: "Coraza", clase: "armadura", detalle: "CA 14 + DES (máx. 2)", precio: 400 },
  { nombre: "Armadura de placas", clase: "armadura", detalle: "CA 18, FUE 15, desventaja en Sigilo", precio: 1500 },
  { nombre: "Escudo", clase: "armadura", detalle: "+2 CA", precio: 10 },
  { nombre: "Anillo", clase: "accesorio", detalle: "anillo de hierro ennegrecido", precio: 5 },
  { nombre: "Amuleto", clase: "accesorio", detalle: "amuleto con un hueso tallado", precio: 5 },
  { nombre: "Capa", clase: "accesorio", detalle: "capa de lana gris", precio: 2 },
  { nombre: "Yelmo", clase: "accesorio", detalle: "yelmo abollado", precio: 10 },
  { nombre: "Guanteletes", clase: "accesorio", detalle: "guanteletes de cuero y acero", precio: 8 },
];

const ENCANTAMIENTOS: Record<Clase, [string, string][]> = {
  arma: [
    ["+1", "+1 a ataque y daño"],
    ["+2", "+2 a ataque y daño"],
    ["de llama gris", "+1d6 de fuego al impactar"],
    ["de plata y sal", "+1d8 contra no-muertos e ignora su resistencia"],
    ["sedienta", "al matar a una criatura recuperas 1d8 PV"],
    ["de escarcha", "+1d4 de frío y el objetivo pierde 3 m de velocidad"],
    ["hiriente", "sus críticos infligen herida con causa golpe_masivo"],
    ["retornante", "vuelve a tu mano tras lanzarla"],
    ["degolladora", "con 20 natural contra una criatura que no sea jefe: CON CD 15 o muere"],
  ],
  armadura: [
    ["+1", "+1 a la CA"],
    ["+2", "+2 a la CA"],
    ["ignífuga", "resistencia al fuego"],
    ["de los vivos", "resistencia al daño necrótico"],
    ["silenciosa", "sin desventaja en Sigilo"],
    ["del vigía", "no puedes ser sorprendido"],
    ["de sutura", "al sufrir una herida, se tira la gravedad dos veces y te quedas con la menor"],
  ],
  accesorio: [
    ["del latido", "ventaja en salvaciones contra muerte"],
    ["de sangre firme", "+3 a las salvaciones contra anemia"],
    ["de niebla", "ventaja en Sigilo en penumbra"],
    ["del juez", "ventaja contra quedar hechizado o asustado"],
    ["del herrero", "+1 FUE (máx. 20)"],
    ["de sal", "+2 contra infección; las heridas por no-muertos no transmiten la Podre con un 50%"],
    ["del ojo muerto", "ves en oscuridad mágica a 18 m"],
  ],
};

const MALDICIONES: string[] = [
  "Hambre de sangre: cada amanecer, salvación de SAB CD 13 o debe herir a alguien antes del anochecer; si no, 1 nivel de agotamiento",
  "Atadura: no puede soltarlo ni deshacerse de él sin un rito de las Hermanas o de la Inquisición",
  "Susurros: cuando cae a 0 PV, el objeto le ofrece levantarse… a cambio de algo (el DM decide qué)",
  "Herida que no cierra: todas sus heridas tardan el doble en sanar",
  "Traición: con un 1 natural en un ataque, golpea a un aliado adyacente",
  "Ceniza: gana 1 de Ceniza por cada semana que lo lleve",
  "Vínculo de la Corte: los vampiros de la Corte Pálida siempre saben dónde está",
  "Sangre abierta: sus heridas graves vuelven a sangrar tras cada combate salvo CON CD 12",
  "Mal agüero: desventaja en las salvaciones contra muerte",
  "Rostro robado: poco a poco su cara se parece a la del anterior dueño, que murió de forma horrible",
];

const PODERES_RELIQUIA: string[] = [
  "Lágrima del dios: una vez al día, baja una herida dos niveles de gravedad (+1 de Ceniza)",
  "Grito del dios: una vez al día, todas las criaturas a 9 m hacen SAB CD 15 o quedan asustadas 1 minuto",
  "Hueso del Juez: los ataques del portador ignoran resistencias e inmunidades al daño",
  "Corazón de ceniza: si el portador muere, se levanta en el siguiente asalto con 1 PV (una vez; +3 de Ceniza)",
  "Mirada del dios: una vez al día, conoce la debilidad principal de una criatura que vea",
];

const TABLAS: Record<Origen, [number, CalidadObjeto][]> = {
  compra: [[15, "defectuoso"], [80, "normal"], [95, "de calidad"], [99, "encantado"], [100, "maldito"]],
  saqueo: [[35, "defectuoso"], [80, "normal"], [90, "de calidad"], [96, "encantado"], [100, "maldito"]],
  hallazgo: [[15, "defectuoso"], [50, "normal"], [65, "de calidad"], [85, "encantado"], [97, "maldito"], [100, "reliquia"]],
  jefe: [[10, "de calidad"], [60, "encantado"], [80, "maldito"], [100, "reliquia"]],
};

/** Probabilidad (%) de que el botín incluya un vial, y qué vial (d100). */
const VIALES_ORIGEN: Record<Origen, { prob: number; tabla: [number, NombreVial][] }> = {
  compra: { prob: 60, tabla: [[50, "Sangre de Santo"], [80, "Leche de Amapola Negra"], [100, "Hiel de Víbora Gris"]] },
  saqueo: { prob: 25, tabla: [[40, "Sangre de Santo"], [70, "Leche de Amapola Negra"], [99, "Hiel de Víbora Gris"], [100, "Ceniza Viva"]] },
  hallazgo: { prob: 35, tabla: [[45, "Sangre de Santo"], [70, "Leche de Amapola Negra"], [97, "Hiel de Víbora Gris"], [100, "Ceniza Viva"]] },
  jefe: { prob: 70, tabla: [[50, "Sangre de Santo"], [65, "Leche de Amapola Negra"], [88, "Hiel de Víbora Gris"], [100, "Ceniza Viva"]] },
};

const deTabla = <T>(t: [number, T][], d: number) => t.find(([max]) => d <= max)![1];
const elegir = <T>(lista: T[]) => lista[tirar(`1d${lista.length}`).total - 1];

function nuevoId(partida: Partida) {
  return `O${Object.keys(partida.objetos).length + 1}`;
}

function generarUno(partida: Partida, origen: Origen, clase?: Clase, calidadFija?: CalidadObjeto): Objeto {
  const calidad = calidadFija ?? deTabla(TABLAS[origen], tirar("1d100").total);
  const candidatos = BASES.filter((b) => (clase ? b.clase === clase : calidad !== "normal" && calidad !== "defectuoso" && calidad !== "de calidad" ? true : b.clase !== "accesorio"));
  const base = elegir(candidatos);
  const id = nuevoId(partida);
  let nombre = base.nombre;
  let apariencia = base.detalle;
  let verdad = base.detalle;
  let precio = base.precio;

  switch (calidad) {
    case "defectuoso":
      nombre += " en mal estado";
      apariencia = verdad = `${base.detalle}; ${base.clase === "arma" ? "−1 a atacar y se rompe con un 1 natural" : "−1 a la CA"}`;
      precio = Math.max(1, Math.floor(precio / 2));
      break;
    case "de calidad":
      nombre += " de buena factura";
      apariencia = verdad = `${base.detalle}; ${base.clase === "arma" ? "+1 a atacar (no mágica)" : "+1 a la CA si es armadura"}`;
      precio *= 3;
      break;
    case "encantado": {
      const [n, e] = elegir(ENCANTAMIENTOS[base.clase]);
      nombre += ` ${n}`;
      apariencia = verdad = `${base.detalle}; encantado: ${e}`;
      precio = precio * 10 + 200;
      break;
    }
    case "maldito": {
      const [n, e] = elegir(ENCANTAMIENTOS[base.clase]);
      const m = elegir(MALDICIONES);
      nombre += ` ${n}`;
      apariencia = `${base.detalle}; encantado: ${e}`;
      verdad = `${apariencia}. MALDITO (oculto hasta que se descubra): ${m}`;
      precio = precio * 10 + 200;
      break;
    }
    case "reliquia": {
      const [n1, e1] = elegir(ENCANTAMIENTOS[base.clase]);
      const poder = elegir(PODERES_RELIQUIA);
      nombre = `${base.nombre} ${n1}, reliquia de un dios muerto`;
      apariencia = verdad = `${base.detalle}; encantado: ${e1}; ${poder}. Usar su poder hace que el portador oiga al dios muerto en sueños.`;
      precio = 5000;
      break;
    }
  }
  const o: Objeto = { id, nombre: `${nombre} [${id}]`, calidad, apariencia, verdad, precio, identificado: calidad !== "maldito" };
  partida.objetos[id] = o;
  return o;
}

export interface PeticionBotin {
  origen: Origen;
  cantidad: number;
  clase?: Clase;
  calidad?: CalidadObjeto;
  incluir_viales?: boolean;
}

export function generarBotin(partida: Partida, b: PeticionBotin): { dm: string; jugadores: string } {
  const dm: string[] = [];
  const jug: string[] = [];
  for (let i = 0; i < b.cantidad; i++) {
    const o = generarUno(partida, b.origen, b.clase, b.calidad);
    dm.push(`- ${o.nombre} (${o.calidad}, ${o.precio} po): ${o.verdad}`);
    jug.push(`- ${o.nombre}${b.origen === "compra" ? ` — ${o.precio} po` : ""}: ${o.apariencia}`);
  }
  // Behelit: probabilidad por cada mil, por objeto. Nunca en tiendas.
  const BEHELIT: Record<Origen, number> = { compra: 0, saqueo: 1, hallazgo: 3, jefe: 20 };
  for (let i = 0; i < b.cantidad; i++) {
    if (tirar("1d1000").total > BEHELIT[b.origen]) continue;
    const o = crearObjeto(partida, {
      nombre: "Huevo de piedra con rostro",
      calidad: "reliquia",
      apariencia: APARIENCIA,
      verdad: "BEHELIT común. Despierta solo en la desesperación (herramienta behelit). Si se pierde, tiende a volver a su dueño.",
    });
    dm.push(`- ${o.nombre}: ${o.verdad} (¡rarísimo! Que su hallazgo pese en la historia.)`);
    jug.push(`- ${o.nombre}: ${o.apariencia}`);
  }
  if (b.incluir_viales !== false) {
    const v = VIALES_ORIGEN[b.origen];
    const veces = Math.max(1, Math.ceil(b.cantidad / 2));
    for (let i = 0; i < veces; i++) {
      if (tirar("1d100").total > v.prob) continue;
      const nombre = deTabla(v.tabla, tirar("1d100").total);
      const precio = VIALES[nombre].precio;
      const linea = `- Vial: ${nombre}${b.origen === "compra" && precio ? ` — ${precio} po` : ""}`;
      dm.push(linea);
      jug.push(linea);
    }
  }
  return {
    dm: `Botín (${b.origen}). Añade al inventario con modificar_personaje solo lo que se queden, usando el nombre exacto con su [id].\n${dm.join("\n")}`,
    jugadores: jug.join("\n"),
  };
}

export function crearObjeto(
  partida: Partida,
  d: { nombre: string; calidad: CalidadObjeto; apariencia: string; verdad?: string; precio?: number },
): Objeto {
  const id = nuevoId(partida);
  const o: Objeto = {
    id,
    nombre: `${d.nombre} [${id}]`,
    calidad: d.calidad,
    apariencia: d.apariencia,
    verdad: d.verdad ?? d.apariencia,
    precio: d.precio ?? 0,
    identificado: d.calidad !== "maldito",
  };
  partida.objetos[id] = o;
  return o;
}

export const REGLAS_EQUIPO = `## Equipamiento y botín (usa generar_botin, crear_objeto y examinar_objeto)
- Calidades: defectuoso (oxidado, −1), normal, de calidad (+1 no mágico), encantado, maldito y reliquia (de un dios muerto: muy poderosa y rarísima).
- generar_botin tira con tablas según el origen: compra (tiendas: casi todo normal, algún vial a la venta), saqueo (cadáveres comunes: mucha chatarra), hallazgo (ruinas, tumbas, cámaras ocultas: aquí aparece lo encantado y lo maldito) y jefe (lo mejor, y lo más peligroso).
- Lo maldito parece encantado: muestra a los jugadores solo la apariencia. Revela la maldición en la ficción cuando se manifieste por primera vez o cuando la descubran (Arcanos CD 15, un rito, un experto) y entonces llama a examinar_objeto con revelar=true.
- No dependas solo de las tablas: crea con crear_objeto armas con nombre e historia, objetos únicos de la aventura, armas de jefes caídos, recompensas de misiones. Las tiendas de Aldenmar tienen casi de todo lo normal; lo encantado se encuentra, se gana o se compra en el mercado negro a precios abusivos.
- Respeta los efectos de los objetos en tus arbitrajes (bonificadores, resistencias, maldiciones).`;
