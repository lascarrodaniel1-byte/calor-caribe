// Encuentros aleatorios con variedad. El DM (el modelo) no tiene azar propio: si nadie se lo impone, tiende a repetir
// los enemigos que más pesan en la ambientación (Hambrientos, la Inquisición). Aquí vive una tabla de encuentros que
// tira el programa (según región, hora, nivel y dificultad) y una memoria de los últimos enemigos que penaliza repetirse.
import { tirar } from "./dados.js";
import type { Partida } from "./estado.js";

export type TipoEncuentro = "combate" | "peligro" | "social" | "hallazgo";

export interface Plantilla {
  id: string;
  nombre: string;
  /** Para no repetir: no-muertos, fauna, humanos, inquisicion, culto, corte_palida, monstruos, entorno, social… */
  familia: string;
  tipo: TipoEncuentro;
  /** Trozos del nombre de la región donde encaja (vacío = en cualquier parte). */
  regiones: string[];
  /** 1 (peligro común) a 5. */
  peligro: 1 | 2 | 3 | 4;
  cuantos: [number, number];
  momento?: "noche" | "dia";
  peso: number;
  /** Plantilla del bestiario (aparecer_criatura). Si no hay, se improvisa con pnj/iniciativa. */
  bestiario?: string;
  quienes: string;
  quieren: string;
  salida: string;
  /** Para encuentros sin bestiario: bonificador de ataque, CA y PV orientativos de cada uno. */
  stats?: string;
}

export const TABLA: Plantilla[] = [
  // ---- no-muertos
  { id: "hambrientos", nombre: "Manada de Hambrientos", familia: "no-muertos", tipo: "combate", regiones: ["Marca Hueca", "Aldenmar", "Ciénagas"], peligro: 1, cuantos: [3, 6], peso: 7, bestiario: "Hambriento", quienes: "Muertos alzados sin rito, atraídos por el olor a carne viva.", quieren: "Comer. No negocian ni huyen.", salida: "El fuego y las sombras los frenan; se puede rodearlos o dejarlos atrás en una fuente de luz." },
  { id: "ghul", nombre: "Ghul de las fosas", familia: "no-muertos", tipo: "combate", regiones: ["Aldenmar", "Marca Hueca"], peligro: 2, cuantos: [1, 2], momento: "noche", peso: 4, bestiario: "Ghul de las fosas", quienes: "Devoradores de cadáveres que merodean cementerios y osarios.", quieren: "Carroña fresca; atacan a quien huela a sangre.", salida: "Prefieren cadáveres a vivos: un cebo los distrae." },
  { id: "banshee", nombre: "Banshee del Velo", familia: "no-muertos", tipo: "peligro", regiones: ["Velo Rojo"], peligro: 3, cuantos: [1, 1], momento: "noche", peso: 2, bestiario: "Banshee del Velo", quienes: "Un espectro que llora entre los árboles rojos y atrae a los viajeros.", quieren: "Que alguien oiga su historia antes de matarlo.", salida: "Escucharla y prometerle un rito la aplaca." },
  { id: "huesos", nombre: "Esqueletos de un campo de batalla", familia: "no-muertos", tipo: "combate", regiones: ["Marca Hueca"], peligro: 2, cuantos: [3, 5], peso: 3, quienes: "Soldados sin carne que repiten su última orden.", quieren: "Cumplir una orden de hace un siglo (defender un cruce, guardar un puente).", salida: "Si se entiende la orden, se les puede dar otra o pasar sin cruzar su línea.", stats: "ataque +3, CA 13, 13 PV, lanzas y escudos astillados" },
  // ---- fauna y monstruos
  { id: "lobos", nombre: "Jauría de lobos de ceniza", familia: "fauna", tipo: "combate", regiones: ["Velo Rojo", "Marca Hueca", "Aldenmar"], peligro: 1, cuantos: [3, 5], peso: 7, bestiario: "Lobo de Ceniza", quienes: "Lobos flacos de pelaje gris, hambrientos por el invierno largo.", quieren: "Comida; un animal herido o una presa fácil.", salida: "Fuego, carne que lanzar y no correr: prefieren la presa que huye." },
  { id: "ogro", nombre: "Ogro al servicio de un señor de la guerra", familia: "monstruos", tipo: "combate", regiones: ["Marca Hueca", "Aldenmar"], peligro: 2, cuantos: [1, 1], peso: 3, bestiario: "Ogro", quienes: "Un ogro cobrador que vigila un paso o cobra un peaje en carne.", quieren: "Comida y órdenes; es tozudo, no listo.", salida: "Se le puede engañar, sobornar con comida o desviar su atención." },
  { id: "troll", nombre: "Troll de ciénaga", familia: "monstruos", tipo: "combate", regiones: ["Ciénagas"], peligro: 3, cuantos: [1, 1], peso: 4, bestiario: "Troll de ciénaga", quienes: "Una masa de brazos largos y cieno que acecha bajo el agua negra.", quieren: "Carne y territorio.", salida: "El fuego lo daña de verdad; las barcas y los senderos firmes le quitan ventaja." },
  { id: "wyverno", nombre: "Wyverno cazando", familia: "monstruos", tipo: "combate", regiones: ["Agujas", "Marca Hueca"], peligro: 3, cuantos: [1, 1], momento: "dia", peso: 2, bestiario: "Wyverno", quienes: "Un wyverno que baja en picado a por la presa más aislada.", quieren: "Un solo cuerpo que llevarse al nido.", salida: "Cubierto y en grupo, pierde interés." },
  { id: "basilisco", nombre: "Basilisco en las ruinas", familia: "monstruos", tipo: "peligro", regiones: ["Karak", "Marca Hueca"], peligro: 3, cuantos: [1, 1], peso: 2, bestiario: "Basilisco", quienes: "Estatuas de viajeros en un patio: algo de ojos fríos las hizo.", quieren: "Que nadie turbe su nido.", salida: "Espejos, mirar de reojo, rodear por arriba." },
  { id: "manticora", nombre: "Mantícora en los páramos", familia: "monstruos", tipo: "combate", regiones: ["Marca Hueca"], peligro: 3, cuantos: [1, 1], peso: 2, bestiario: "Mantícora", quienes: "Una bestia de rostro casi humano que juega con la comida.", quieren: "Presa y conversación cruel.", salida: "Le gustan los acertijos: hablar puede ganar tiempo." },
  // ---- humanos
  { id: "bandoleros", nombre: "Bandoleros del camino", familia: "humanos", tipo: "combate", regiones: [], peligro: 1, cuantos: [3, 6], peso: 8, quienes: "Salteadores desesperados: campesinos arruinados y desertores con garrotes y ballestas viejas.", quieren: "Bolsas, armas y caballos; no quieren morir por unas monedas.", salida: "Se rinden o huyen si su cabecilla cae; se les puede pagar un peaje o convencerlos.", stats: "ataque +3, CA 12, 9 PV, garrote o ballesta" },
  { id: "desertores", nombre: "Desertores de la Compañía del Cuervo", familia: "humanos", tipo: "social", regiones: ["Aldenmar", "Marca Hueca"], peligro: 2, cuantos: [2, 4], peso: 4, quienes: "Mercenarios que huyen de una paga que no llegó (o de algo que vieron en la muralla).", quieren: "Pasar desapercibidos y comer; saben cosas que el Cuervo oculta.", salida: "Se les puede comprar información, ayudar, delatar o enfrentar.", stats: "ataque +4, CA 14, 16 PV, veteranos" },
  { id: "cazarrecompensas", nombre: "Cazarrecompensas tras uno de los PJ", familia: "humanos", tipo: "combate", regiones: [], peligro: 2, cuantos: [2, 3], peso: 3, quienes: "Profesionales con cartel de recompensa y red de captura: quieren al vivo.", quieren: "Cobrar por alguien del grupo (o por un PNJ que viaja con él).", salida: "Se puede negociar, pagarles más o convencerlos de que el cartel miente.", stats: "ataque +4, CA 14, 18 PV, redes y porras" },
  { id: "contrabandistas", nombre: "Contrabandistas de Hollín", familia: "humanos", tipo: "social", regiones: ["Ciénagas", "Aldenmar"], peligro: 1, cuantos: [2, 4], peso: 4, quienes: "Barqueros con un cargamento que no debe ver la Inquisición.", quieren: "Que nadie hable; buscan quien les cubra o a quien silenciar.", salida: "Trato, soborno, chantaje o un trabajo a cambio de silencio.", stats: "ataque +3, CA 12, 11 PV, dagas y ballestas ligeras" },
  { id: "saqueadores", nombre: "Saqueadores de ruinas", familia: "humanos", tipo: "combate", regiones: ["Karak", "Marca Hueca", "Agujas"], peligro: 2, cuantos: [3, 5], peso: 3, quienes: "Buscadores de reliquias que ya cavaron demasiado hondo.", quieren: "Quedarse con lo que encuentren (y con lo que lleve el grupo).", salida: "Pueden aliarse contra algo peor, o repartirse el botín.", stats: "ataque +3, CA 13, 12 PV, picos y hachas" },
  { id: "resurreccionistas", nombre: "Ladrones de cadáveres", familia: "humanos", tipo: "social", regiones: ["Aldenmar"], peligro: 1, cuantos: [2, 3], momento: "noche", peso: 3, quienes: "Gente de las Hermanas de la Sutura sin licencia, que vende cuerpos frescos a cirujanos.", quieren: "No ser vistos: un cadáver fresco vale más que una bolsa.", salida: "Tratar con ellos, delatarlos a la Inquisición o seguirlos hasta su comprador.", stats: "ataque +2, CA 11, 8 PV, palas y cuchillos" },
  // ---- inquisición, culto, corte
  { id: "inquisicion", nombre: "Patrulla de la Llama Gris", familia: "inquisicion", tipo: "social", regiones: ["Aldenmar"], peligro: 2, cuantos: [3, 5], peso: 2, quienes: "Purificadores con antorchas y escritos de licencia: buscan brujas, varg y nacidos pálidos.", quieren: "Comprobar licencias y encontrar un culpable.", salida: "Papeles en regla, un soborno, un chivo expiatorio o una buena mentira; la violencia llama a más." , stats: "ataque +4, CA 15, 20 PV, espadas y antorchas" },
  { id: "devotos", nombre: "Devotos del Dios Hambriento", familia: "culto", tipo: "combate", regiones: ["Ciénagas", "Marca Hueca", "Aldenmar"], peligro: 2, cuantos: [3, 5], momento: "noche", peso: 3, quienes: "Fanáticos con cuchillos de hueso que alimentan fosas para que nazca su dios.", quieren: "Sangre para una fosa; o un converso.", salida: "Se les puede infiltrar, engañar o dejar que se destruyan entre ellos.", stats: "ataque +3, CA 11, 11 PV, cuchillos de hueso y fe ciega" },
  { id: "corte", nombre: "Esbirros de la Corte Pálida", familia: "corte_palida", tipo: "combate", regiones: ["Marca Hueca", "Velo Rojo"], peligro: 3, cuantos: [2, 3], momento: "noche", peso: 2, quienes: "Sirvientes pálidos de una vampira: elegantes, rápidos y pacientes.", quieren: "Un mensaje que entregar, una invitación o una cena.", salida: "Hablan: se les puede escuchar, rechazar con cortesía o tenderles una trampa de luz.", stats: "ataque +5, CA 14, 22 PV, estoques y mirada hipnótica" },
  // ---- entorno, sociales y hallazgos
  { id: "niebla", nombre: "Niebla de ceniza", familia: "entorno", tipo: "peligro", regiones: [], peligro: 1, cuantos: [1, 1], peso: 4, quienes: "Una nube gris que cubre el camino y quema la garganta.", quieren: "(Es el entorno) pierde a quien se separa y esconde lo que acecha dentro.", salida: "Cuerdas, trapos mojados y no separarse; o esperar a que pase." },
  { id: "pantano", nombre: "Pantano hundiente", familia: "entorno", tipo: "peligro", regiones: ["Ciénagas"], peligro: 1, cuantos: [1, 1], peso: 4, quienes: "El sendero firme desaparece: el cieno traga botas, mochilas y mulas.", quieren: "(Es el entorno) cuesta tiempo y equipo.", salida: "Sondear con varas, ligar cuerdas, un guía local." },
  { id: "derrumbe", nombre: "Derrumbe o puente roto", familia: "entorno", tipo: "peligro", regiones: ["Karak", "Agujas"], peligro: 1, cuantos: [1, 1], peso: 3, quienes: "Un paso cortado por piedra suelta o un puente podrido.", quieren: "(Es el entorno) obliga a rodear o a arriesgar.", salida: "Cuerdas, un rodeo largo o ayuda ajena." },
  { id: "mensajero", nombre: "Mensajero herido", familia: "social", tipo: "social", regiones: [], peligro: 1, cuantos: [1, 1], peso: 4, quienes: "Alguien herido que huye con un mensaje que no debería llegar a su destino… ni a otro.", quieren: "Entregarlo vivo; teme a quienes lo persiguen.", salida: "Curarlo, escoltarlo o abrir el mensaje: tres caminos distintos." },
  { id: "peregrinos", nombre: "Peregrinos de camino", familia: "social", tipo: "social", regiones: [], peligro: 1, cuantos: [3, 8], momento: "dia", peso: 3, quienes: "Gente cansada hacia un santuario sin dios: llevan noticias, rumores y quizá algo escondido.", quieren: "Compañía y protección; alguno miente sobre quién es.", salida: "Compartir fuego, intercambiar noticias, descubrir al impostor." },
  { id: "mercader", nombre: "Mercader de lo imposible", familia: "social", tipo: "hallazgo", regiones: [], peligro: 1, cuantos: [1, 1], peso: 3, quienes: "Un vendedor ambulante con carro de reliquias dudosas (algunas, de verdad).", quieren: "Vender caro y comprar secretos.", salida: "Regatear, robarle, comprarle un objeto con historia." },
  { id: "campamento", nombre: "Campamento abandonado", familia: "hallazgo", tipo: "hallazgo", regiones: [], peligro: 1, cuantos: [1, 1], peso: 3, quienes: "Un campamento con brasas todavía calientes y nadie a la vista.", quieren: "(Es una escena) cuenta qué pasó con huellas y objetos; puede haber una trampa o un superviviente.", salida: "Investigar con calma revela más que fuerza." },
];

/** Palabras que delatan la familia de un enemigo a partir de su nombre. */
const FAMILIAS: [RegExp, string][] = [
  [/hambrient|ghul|zombi|esquelet|no-?muert|banshee|espectro|cad[aá]ver|gigante de hueso|madre de los hambrientos/i, "no-muertos"],
  [/inquisi|llama gris|purificador/i, "inquisicion"],
  [/lobo|jaur[ií]a|bestia|wyverno|mant[ií]cora|basilisco|troll|ogro|drag[oó]n/i, "monstruos"],
  [/cultist|devoto|dios hambriento/i, "culto"],
  [/vampir|corte p[aá]lida|reina p[aá]lida|esbirro/i, "corte_palida"],
  [/bandol|salteador|bandid|desertor|mercenari|cazarrecompensas|contraband|saqueador|ladr[oó]n/i, "humanos"],
];

export function familiaDe(nombre: string): string {
  for (const [re, f] of FAMILIAS) if (re.test(nombre)) return f;
  return nombre.toLowerCase().replace(/\s*\d+$/, "").trim();
}

export interface RegistroEncuentro {
  familia: string;
  nombre: string;
  /** Paso de la secuencia en el que ocurrió (para no contar dos veces el mismo). */
  paso: number;
}
const MAX_HISTORIAL = 12;

/** Anota un enemigo nuevo en la memoria de encuentros; devuelve false si es el mismo encuentro que el último. */
export function registrarEnemigo(partida: Partida, nombre: string): boolean {
  const h = (partida.encuentros ??= []);
  const familia = familiaDe(nombre);
  const paso = partida.secuencia?.total ?? 0;
  const ultimo = h[h.length - 1];
  // Mientras dure el combate (o en el mismo turno) los refuerzos de la misma familia son el mismo encuentro.
  if (ultimo && ultimo.familia === familia && (ultimo.paso === paso || partida.combate)) return false;
  h.push({ familia, nombre, paso });
  if (h.length > MAX_HISTORIAL) h.splice(0, h.length - MAX_HISTORIAL);
  return true;
}

/** ¿Los dos últimos encuentros fueron de esta familia? */
export function repetida(partida: Partida, nombre: string): string | null {
  const h = partida.encuentros ?? [];
  const f = familiaDe(nombre);
  const paso = partida.secuencia?.total ?? 0;
  const ultimo = h[h.length - 1];
  if (ultimo && ultimo.familia === f && (ultimo.paso === paso || partida.combate)) return null; // sigue siendo el mismo encuentro
  const dos = h.slice(-2);
  return dos.length === 2 && dos.every((x) => x.familia === f) ? f : null;
}

export function textoVariedad(partida: Partida): string {
  const h = partida.encuentros ?? [];
  if (!h.length) return "";
  const fam = h.slice(-5).map((x) => x.familia);
  const cuenta = new Map<string, number>();
  for (const f of fam) cuenta.set(f, (cuenta.get(f) ?? 0) + 1);
  const [top, n] = [...cuenta.entries()].sort((a, b) => b[1] - a[1])[0];
  return (
    `## Variedad de enemigos (últimos encuentros: ${h.slice(-6).map((x) => x.nombre).join(" → ")})\n` +
    (n >= 3 || (fam.length >= 3 && n / fam.length > 0.5)
      ? `⚠ ${n} de los últimos ${fam.length} encuentros fueron de «${top}»: el próximo, de otra familia (usa la herramienta encuentro).`
      : "Bien repartidos: sigue variando (humanos, fauna, culto, entorno, social…), no todo es un combate.")
  );
}

export interface DatosEncuentro {
  tipo?: TipoEncuentro;
  dificultad?: "facil" | "media" | "dificil" | "mortal";
  /** Fuerza la región (por defecto, donde está el grupo). */
  region?: string;
  /** Familias que no pueden salir (además de las repetidas). */
  excluir?: string[];
}

const horaDe = (p: Partida) => (p.reloj ? Math.floor((p.reloj.segundos % 86400) / 3600) : null);

export function sortearEncuentro(partida: Partida, d: DatosEncuentro = {}): string {
  const region = d.region ?? partida.mapa.lugares[partida.mapa.posicion ?? ""]?.region ?? "";
  const hora = horaDe(partida);
  const noche = hora !== null ? hora >= 19 || hora < 6 : null;
  const pjs = Object.values(partida.personajes);
  const nivel = pjs.length ? Math.round(pjs.reduce((s, p) => s + p.nivel, 0) / pjs.length) : 1;
  const dif = d.dificultad ?? "media";
  const techo = (nivel <= 2 ? 2 : nivel <= 4 ? 3 : nivel <= 8 ? 4 : 5) + (dif === "mortal" ? 1 : dif === "facil" ? -1 : 0);
  const h = partida.encuentros ?? [];
  const prohibidas = new Set<string>(d.excluir ?? []);
  const ultimas2 = h.slice(-2);
  if (ultimas2.length === 2 && ultimas2[0].familia === ultimas2[1].familia) prohibidas.add(ultimas2[0].familia);
  const pesos = TABLA.filter((t) => (!d.tipo || t.tipo === d.tipo) && !prohibidas.has(t.familia)).map((t) => {
    let w = t.peso;
    if (t.regiones.length) w *= t.regiones.some((r) => region.toLowerCase().includes(r.toLowerCase())) ? 3 : 0.25;
    if (t.momento && noche !== null) w *= (t.momento === "noche") === noche ? 1.6 : 0.3;
    if (t.peligro > techo) w *= 0.05;
    if (t.peligro < techo - 2) w *= 0.6;
    // Memoria: cada vez que esta familia salió entre los últimos encuentros, pesa menos.
    const veces = h.slice(-6).filter((x) => x.familia === t.familia).length;
    w *= Math.pow(0.4, veces);
    return { t, w };
  });
  if (!pesos.length) throw new Error("Con esos filtros no queda ningún encuentro posible: quita excluir o el tipo.");
  const total = pesos.reduce((s, x) => s + x.w, 0);
  const tirada = tirar("1d1000").total;
  let acum = 0;
  let elegido = pesos[pesos.length - 1].t;
  for (const x of pesos) {
    acum += (x.w / total) * 1000;
    if (tirada <= acum) { elegido = x.t; break; }
  }
  const [min, max] = elegido.cuantos;
  const mult = { facil: 0.6, media: 1, dificil: 1.5, mortal: 2 }[dif];
  const n = Math.max(1, Math.round((min + ((max - min) * (tirar("1d100").total - 1)) / 99) * (max > 1 ? mult : 1)));
  partida.encuentros ??= [];
  partida.encuentros.push({ familia: elegido.familia, nombre: elegido.nombre, paso: partida.secuencia?.total ?? 0 });
  if (partida.encuentros.length > MAX_HISTORIAL) partida.encuentros.splice(0, partida.encuentros.length - MAX_HISTORIAL);
  const uso = elegido.bestiario
    ? `aparecer_criatura con plantilla «${elegido.bestiario}» (${n}; nómbralas «${elegido.bestiario} 1», «${elegido.bestiario} 2»…) y luego iniciativa`
    : elegido.tipo === "combate"
      ? `iniciativa con pnj (${n} enemigos) — ${elegido.stats ?? "stats a tu criterio, acordes al nivel"}`
      : "no es necesariamente un combate: juega la escena";
  return [
    `🎲 ENCUENTRO (tirada real: d1000 = ${tirada}; ${region || "región sin fijar"}${hora !== null ? `, ${String(hora).padStart(2, "0")}:00` : ""}, nivel medio ${nivel}, dificultad ${dif})`,
    `Qué es: ${elegido.nombre} (${elegido.tipo}${n > 1 ? `, ${n}` : ""}) — ${elegido.quienes}`,
    `Qué quieren: ${elegido.quieren}`,
    `Cómo se evita o se resuelve sin pelear: ${elegido.salida}`,
    `Cómo usarlo: ${uso}`,
    `Mételo en la historia (por qué están aquí ahora, cómo toca a un arco o a un PNJ), no lo sueltes sin más. Familia: ${elegido.familia}${prohibidas.size ? ` (se evitaron: ${[...prohibidas].join(", ")} por repetición)` : ""}.`,
  ].join("\n");
}

export const REGLAS_ENCUENTROS = `## Variedad de enemigos y encuentros (no todo es un Hambriento ni de la Inquisición)
- Tú no tienes azar propio y tiendes a repetir lo que más aparece en la ambientación: los Hambrientos y la Inquisición de la Llama Gris son UNA amenaza de fondo entre muchas, no el enemigo por defecto. Para cualquier encuentro aleatorio (viaje, exploración, un descanso interrumpido, «¿qué hay en esta calle?») NO lo decidas tú: llama a encuentro, que tira de verdad según región, hora, nivel y dificultad y evita repetir lo reciente.
- Reparte: humanos (bandoleros, desertores, cazarrecompensas, contrabandistas, saqueadores), fauna y monstruos, no-muertos, culto, Corte Pálida, Inquisición, entorno (niebla, pantano, derrumbe) y encuentros sociales o de hallazgo. No más de uno de cada tres encuentros de la misma familia; el programa te lo recuerda y puede negarte aparecer_criatura si repites tres veces (repetir=true solo si la trama lo exige).
- No todo encuentro es un combate: muchos se resuelven hablando, pagando, huyendo o sorteando el peligro. Dale a cada enemigo un motivo para estar ahí ahora y una forma de evitarlo.`;
