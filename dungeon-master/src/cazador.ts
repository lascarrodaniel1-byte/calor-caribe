// Cazador de Brujas: papeles de runas que se disponen alrededor del campo de batalla (apagan la regeneración y
// mitigan los poderes de brujas, hechiceros y no-muertos; a nivel alto, también curan), una mascota (halcón o ratón) y
// el rastro de la magia (detectar hechizos y maldiciones, y «amarrar» un hechizo negro a quien lo lanzó).
import { exigirLibre } from "./segador_base.js";
import type { Partida, Personaje } from "./estado.js";
import { curaConRunas, esCazador, MAX_HOJAS, papelesDe, potenciaDe, type RegistroMagia } from "./cazador_base.js";
import type { EstadoJefe, Criatura } from "./bestiario.js";
import { tirar } from "./dados.js";
import { aplicarCondicion } from "./combate.js";
import { bajarHerida } from "./heridas.js";
import { buscarLugar, rumboEntre } from "./mapa.js";
import { distanciaPlano } from "./espacio.js";
import { registrarPnj } from "./narrativa.js";

const norm = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

function cazador(partida: Partida, quien: string): Personaje {
  const p = Object.values(partida.personajes).find((x) => norm(x.nombre) === norm(quien) || (x.jugador && norm(x.jugador) === norm(quien)));
  if (!p) throw new Error(`No hay ningún personaje llamado «${quien}».`);
  if (!esCazador(p)) throw new Error(`${p.nombre} no es un Cazador de Brujas.`);
  return p;
}

// ------------------------------------------------------------------ papeles de runas

/** ¿Es de los seres contra los que valen las runas? No-muertos, brujas, hechiceros, cultistas, y todo lo que regenera. */
export function esObjetivoRunas(c: Criatura): boolean {
  const t = `${c.temple ?? ""} ${c.nombre} ${c.descripcion}`;
  return /no-muerto|vampiro|espectro|ghul|hambriento/i.test(t) || /hechic|brujo|bruja|mago|nigromante|cultista|sacerdote oscuro/i.test(t) || c.rasgos.some((r) => /regenera/i.test(r));
}

export interface Mitigacion {
  nivel: "total" | "parcial" | "leve";
  cdMenos: number;
  sinRegeneracion: boolean;
  texto: string;
}

/** Cuánto mitigan las runas a una criatura en escena (si hay runas y es de las que sirven). */
export function mitigacion(partida: Partida, j: EstadoJefe): Mitigacion | null {
  if (!esObjetivoRunas(j.definicion)) return null;
  let potencia = 0;
  const z = partida.runas;
  if (z) potencia = Math.max(potencia, z.cerrado ? z.potencia : Math.max(1, z.potencia - 1));
  for (const c of j.condiciones ?? []) {
    const m = /marcado por runas \(potencia (\d)\)/i.exec(c);
    if (m) potencia = Math.max(potencia, Number(m[1]));
  }
  if (!potencia) return null;
  const pel = j.definicion.peligro;
  if (pel <= potencia) return { nivel: "total", cdMenos: 6, sinRegeneracion: true, texto: `las runas (potencia ${potencia}) lo dominan: su regeneración está apagada y sus poderes pierden 6 a la CD` };
  if (pel === potencia + 1) return { nivel: "parcial", cdMenos: 3, sinRegeneracion: true, texto: `las runas (potencia ${potencia}) le pesan: su regeneración está apagada y sus poderes pierden 3 a la CD` };
  return { nivel: "leve", cdMenos: 1, sinRegeneracion: false, texto: `las runas (potencia ${potencia}) apenas lo rozan: −1 a la CD de sus poderes; su regeneración sigue` };
}

export function textoRunas(partida: Partida): string {
  const z = partida.runas;
  if (!z) return "";
  return `## Runas del Cazador de Brujas (${z.creador})\nPapeles dispuestos ${z.cerrado ? "en un espacio cerrado" : "al aire libre (potencia efectiva −1)"}: ${z.hojas} hoja(s), potencia ${z.potencia}. Los no-muertos, brujas y hechiceros de peligro ≤ ${z.potencia} pierden la regeneración y 6 a la CD de sus poderes (peligro ${z.potencia + 1}: 3 y regeneración apagada; más alto: 1).${z.curacion ? " Curan a quienes están dentro: cada asalto cierran una herida leve y cada tres asaltos bajan una moderada un nivel." : ""}`;
}

function herido(partida: Partida, nombre: string): { nombre: string; herido: boolean } {
  const n = norm(nombre);
  const j = Object.values(partida.jefes).find((x) => norm(x.nombre) === n) ?? Object.values(partida.jefes).find((x) => norm(x.nombre).includes(n));
  if (j) return { nombre: j.nombre, herido: j.pv < j.pv_max };
  const pnj = Object.values(partida.combate?.pnj ?? {}).find((x) => norm(x.nombre) === n);
  if (pnj) return { nombre: pnj.nombre, herido: pnj.pv !== undefined && pnj.pv_max !== undefined ? pnj.pv < pnj.pv_max : true };
  const pj = Object.values(partida.personajes).find((x) => norm(x.nombre) === n);
  if (pj) return { nombre: pj.nombre, herido: pj.pv < pj.pv_max || pj.heridas.length > 0 };
  throw new Error(`«${nombre}» no es un rival conocido en la escena.`);
}

export interface DatosPapeles {
  quien: string;
  accion: "ver" | "colocar" | "recoger" | "escribir" | "clavar" | "tomar_sangre" | "marcar_sangre";
  escenario?: "cerrado" | "abierto";
  radio?: number;
  cantidad?: number;
  objetivo?: string;
}

export type AtacarFn = (d: { atacante: string; objetivo: string; arma: string; dano: string }) => { texto: string; aviso: string };

export function papeles(partida: Partida, d: DatosPapeles, atacarFn: AtacarFn): string {
  const p = cazador(partida, d.quien);
  if (d.accion !== "ver") exigirLibre(p, "Papeles de runas");
  const pa = papelesDe(p);
  const pot = potenciaDe(p);
  switch (d.accion) {
    case "ver":
      return `${p.nombre}: ${pa.hojas} hoja(s) de runas y ${pa.estacas} estaca(s); potencia ${pot}.${partida.runas ? `\n${textoRunas(partida)}` : "\nNo hay runas dispuestas."}`;
    case "colocar": {
      if (partida.runas) throw new Error("Ya hay runas dispuestas en la escena: recógelas antes o termina el combate.");
      const cerrado = d.escenario !== "abierto";
      const r = d.radio ?? 6;
      const necesarias = cerrado ? 4 : Math.max(6, Math.min(20, Math.ceil((2 * Math.PI * r) / 4)));
      if (pa.hojas < necesarias || pa.estacas < necesarias)
        throw new Error(`Para ${cerrado ? "una sala cerrada (una hoja por pared)" : `un círculo de ${r} m al aire libre`} hacen falta ${necesarias} hojas y ${necesarias} estacas; ${p.nombre} tiene ${pa.hojas} y ${pa.estacas}.`);
      pa.hojas -= necesarias;
      pa.estacas -= necesarias;
      partida.runas = { potencia: pot, cerrado, hojas: necesarias, creador: p.nombre, curacion: curaConRunas(p) };
      return `📜 ${p.nombre} dispone ${necesarias} papeles de runas ${cerrado ? "en las paredes de la sala" : `en un círculo de ${r} m`}, clavados con estacas. ${textoRunas(partida)}\nLe quedan ${pa.hojas} hoja(s) y ${pa.estacas} estaca(s).`;
    }
    case "recoger": {
      const z = partida.runas;
      if (!z) throw new Error("No hay runas dispuestas.");
      const hojas = Math.floor(z.hojas / 2);
      pa.hojas += hojas;
      pa.estacas += z.hojas;
      delete partida.runas;
      return `${p.nombre} recoge las estacas y las hojas que sirven (${hojas} de ${z.hojas}; el resto se quema con la magia que absorbieron). Tiene ${pa.hojas} hoja(s) y ${pa.estacas} estaca(s).`;
    }
    case "escribir": {
      const n = d.cantidad ?? 1;
      if (n < 1 || pa.hojas + n > MAX_HOJAS) throw new Error(`Puede llevar como mucho ${MAX_HOJAS} hojas (tiene ${pa.hojas}).`);
      if (p.oro < n) throw new Error(`Cada hoja cuesta 1 po de pergamino y tinta: ${p.nombre} tiene ${p.oro} po.`);
      p.oro -= n;
      pa.hojas += n;
      if (partida.reloj) partida.reloj.segundos += n * 1800;
      return `${p.nombre} escribe ${n} hoja(s) de runas (${n} po, ${n * 30} min con el reloj). Tiene ${pa.hojas} hoja(s).`;
    }
    case "tomar_sangre": {
      if (!d.objetivo) throw new Error("Di de quién toma la sangre (objetivo).");
      const ob = herido(partida, d.objetivo);
      if (!ob.herido) throw new Error(`${ob.nombre} no está herido: no hay sangre que tomar. Primero hay que herirlo con el látigo o los shotels.`);
      const dist = distanciaPlano(partida, p.nombre, ob.nombre);
      if (dist && dist.metros > 3) throw new Error(`${ob.nombre} está a ${dist.metros} m: la sangre se toma de la hoja recién manchada o de su herida, a menos de 3 m.`);
      p.muestras ??= [];
      if (!p.muestras.some((m) => norm(m) === norm(ob.nombre))) p.muestras.push(ob.nombre);
      if (p.muestras.length > 5) p.muestras.shift();
      return `${p.nombre} recoge sangre de ${ob.nombre} en el borde de una hoja de runas. Con ella podrá marcarlo a distancia (marcar_sangre). Muestras: ${p.muestras.join(", ")}.`;
    }
    case "marcar_sangre": {
      if (!d.objetivo) throw new Error("Di a quién marca (objetivo).");
      const i = (p.muestras ?? []).findIndex((m) => norm(m) === norm(d.objetivo!));
      if (i < 0) throw new Error(`${p.nombre} no tiene sangre de ${d.objetivo}: primero tomar_sangre (hay que herirlo).`);
      if (pa.hojas < 1) throw new Error(`${p.nombre} no tiene hojas de runas.`);
      pa.hojas -= 1;
      const nombre = p.muestras![i];
      p.muestras!.splice(i, 1);
      const ap = aplicarCondicion(partida, { objetivo: nombre, accion: "aplicar", condicion: `marcado por runas (potencia ${pot})`, nota: `con su sangre, a distancia, por ${p.nombre}` });
      return `🩸 ${p.nombre} quema una hoja con la sangre de ${nombre} y pronuncia su nombre: las runas lo alcanzan donde esté, sin tocarlo. ${ap.split("\n")[0]} (Gasta la hoja y la muestra; le quedan ${pa.hojas} hoja(s).)`;
    }
    case "clavar": {
      if (!d.objetivo) throw new Error("Di a quién le clava el papel (objetivo).");
      if (pa.hojas < 1 || pa.estacas < 1) throw new Error(`Hace falta 1 hoja y 1 estaca; ${p.nombre} tiene ${pa.hojas} y ${pa.estacas}.`);
      const r = atacarFn({ atacante: p.nombre, objetivo: d.objetivo, arma: "estaca", dano: "1d4" });
      pa.estacas -= 1;
      if (!/IMPACTO|CRÍTICO/i.test(r.texto)) return `${r.texto}\nEl papel no llega a clavarse (la estaca se pierde; la hoja se conserva).`;
      pa.hojas -= 1;
      const ap = aplicarCondicion(partida, { objetivo: d.objetivo, accion: "aplicar", condicion: `marcado por runas (potencia ${pot})`, nota: `clavado por ${p.nombre}` });
      return `${r.texto}\n📜 ${ap.split("\n")[0]} Lleva el papel clavado: aunque no haya runas en la sala, las runas lo mitigan a él.`;
    }
  }
}

/** Con runas de curación y un combate en curso: cada asalto cierran una herida leve; cada tres, una moderada baja a leve. */
export function curarConRunas(partida: Partida): string[] {
  const z = partida.runas;
  if (!z?.curacion || !partida.combate) return [];
  const out: string[] = [];
  const ronda = partida.combate.ronda;
  for (const p of Object.values(partida.personajes)) {
    if (p.condiciones.includes("muerto") || p.pv <= 0) continue;
    const leve = p.heridas.find((h) => h.gravedad === "leve");
    if (leve) {
      p.heridas = p.heridas.filter((h) => h !== leve);
      out.push(`📜 Las runas cierran la herida leve ${leve.id} de ${p.nombre}.`);
    }
    if (ronda % 3 === 0) {
      const mod = p.heridas.find((h) => h.gravedad === "moderada" && h.zona_vital !== "roja");
      if (mod) {
        bajarHerida(mod);
        out.push(`📜 Las runas bajan la herida ${mod.id} de ${p.nombre} un nivel (ahora ${mod.gravedad}).`);
      }
    }
  }
  return out;
}

// ------------------------------------------------------------------ mascota

export function mascota(partida: Partida, d: { quien: string; accion: "elegir" | "ver"; tipo?: "halcon" | "raton"; nombre?: string }): string {
  const p = cazador(partida, d.quien);
  if (d.accion === "ver") return p.mascota ? descripcionMascota(p) : `${p.nombre} aún no tiene mascota.`;
  if (p.mascota) throw new Error(`${p.nombre} ya tiene a ${p.mascota.nombre}.`);
  if (!d.tipo) throw new Error("Elige halcon o raton.");
  const nombre = d.nombre?.trim() || (d.tipo === "halcon" ? "Halcón" : "Ratón");
  registrarPnj(partida, {
    nombre,
    rol: `mascota de ${p.nombre} (${d.tipo === "halcon" ? "halcón" : "ratón"})`,
    voz: d.tipo === "halcon" ? "No habla: chilla, aletea y mira fijamente; entiende a su dueño" : "No habla: chillidos breves y un rascar de uñas; entiende a su dueño",
    quiere: `Estar con ${p.nombre}`,
    actitud: "leal",
    en_escena: true,
    agenda: `Acompañar a ${p.nombre}`,
  });
  p.mascota = { tipo: d.tipo, nombre };
  return `${p.nombre} elige a ${nombre}, su ${d.tipo === "halcon" ? "halcón" : "ratón"}.\n${descripcionMascota(p)}`;
}

export function descripcionMascota(p: Personaje): string {
  const m = p.mascota;
  if (!m) return "";
  const pv = 4 + 2 * p.nivel;
  return m.tipo === "halcon"
    ? `${m.nombre}, halcón (${pv} PV, CA ${12 + Math.floor(p.nivel / 4)}, vuela a 18 m): ojos del cielo —explora desde el aire hasta 1 km y avisa de emboscadas (ventaja a ${p.nombre} en Percepción visual)—; en combate puede ayudar (accion_combate «ayudar»: ventaja al siguiente ataque de ${p.nombre}) en lugar de huir; puede llevar un mensaje o una hoja de runas a un sitio alejado. Es frágil: si cae a 0 PV huye y se recupera con un descanso largo.`
    : `${m.nombre}, ratón (${pv} PV, CA ${12 + Math.floor(p.nivel / 4)}, trepa y cabe por rendijas): se cuela por grietas y huecos; puede colocar una hoja de runas o una estaca donde ${p.nombre} no llega, y su olfato descubre residuos de magia y venenos (ventaja a ${p.nombre} al detectar hechizos). No combate: si lo amenazan, se esconde. Si cae a 0 PV, se recupera con un descanso largo.`;
}

// ------------------------------------------------------------------ rastro de la magia

const NEGRAS = /necromancia|mente|sombra/i;
export const esMagiaNegra = (escuela?: string, texto = "") => NEGRAS.test(escuela ?? "") || /maldici|hechiz|podre|mirada|drenar|toque de la tumba/i.test(texto);

export function registrarMagia(partida: Partida, d: Omit<RegistroMagia, "id">): RegistroMagia {
  partida.hechizos ??= [];
  const r: RegistroMagia = { ...d, id: `M${(partida.hechizos.at(-1) ? Number(partida.hechizos.at(-1)!.id.slice(1)) : 0) + 1}` };
  partida.hechizos.push(r);
  if (partida.hechizos.length > 40) partida.hechizos.splice(0, partida.hechizos.length - 40);
  return r;
}

const GRADO = (nivel: number) => (nivel >= 10 ? 5 : nivel >= 7 ? 4 : nivel >= 5 ? 3 : nivel >= 3 ? 2 : 1);

function infoRastro(partida: Partida, p: Personaje, r: RegistroMagia): string {
  const g = GRADO(p.nivel);
  const lineas = [`${r.hechizo}${r.escuela ? ` (${r.escuela})` : ""}${r.negra ? " —magia negra—" : ""}: el rastro sigue vivo, atado a quien lo lanzó.`];
  const lugar = r.lugar ? buscarLugar(partida.mapa, r.lugar) : undefined;
  const aqui = partida.mapa.posicion ? partida.mapa.lugares[partida.mapa.posicion] : undefined;
  if (g >= 2) {
    if (lugar && aqui) lineas.push(`Rumbo: el casteador está ${rumboEntre(aqui, lugar).texto}.`);
    else lineas.push("Rumbo: el rastro apunta lejos (di tú el rumbo si lo conoces).");
  }
  if (g >= 3) lineas.push(`Región: ${lugar ? lugar.region : "(la que decidas)"}.`);
  if (g >= 4) lineas.push(`Lugar exacto: ${lugar ? lugar.nombre : r.lugar ?? "(el que decidas)"}.`);
  if (g >= 5) lineas.push(`Lo reconoce: es ${r.lanzador}. Mientras el hechizo siga vivo, puede seguirlo en tiempo real (repite rastrear).`);
  else lineas.push(g >= 4 ? "Aún no sabe quién es." : "No sabe nada más: ni quién es ni dónde exactamente.");
  return lineas.join("\n");
}

export interface DatosRastro {
  quien: string;
  accion: "detectar" | "registrar" | "amarrar" | "rastrear";
  /** registrar: quién lo lanzó (secreto), qué, sobre quién o qué, y desde qué lugar del mapa. */
  lanzador?: string;
  hechizo?: string;
  escuela?: string;
  victima?: string;
  objeto?: string;
  lugar?: string;
  negra?: boolean;
}

export function rastroMagico(partida: Partida, d: DatosRastro): string {
  if (d.accion === "registrar") {
    if (!d.lanzador || !d.hechizo) throw new Error("registrar: di el lanzador y el hechizo o maldición.");
    const r = registrarMagia(partida, { hechizo: d.hechizo, escuela: d.escuela, lanzador: d.lanzador, victima: d.victima, objeto: d.objeto, lugar: d.lugar, negra: d.negra ?? esMagiaNegra(d.escuela, d.hechizo) });
    return `Anotado en secreto (${r.id}): ${r.lanzador} lanzó «${r.hechizo}»${r.victima ? ` sobre ${r.victima}` : ""}${r.objeto ? ` en ${r.objeto}` : ""}${r.negra ? " (magia negra)" : ""}.`;
  }
  const p = cazador(partida, d.quien);
  const recientes = (partida.hechizos ?? []).slice(-10);
  if (d.accion === "detectar") {
    const g = GRADO(p.nivel);
    const lineas: string[] = [`${p.nombre} se concentra un minuto y siente la magia a su alrededor:`];
    if (recientes.length) lineas.push(...recientes.map((r) => `- ${r.id}: huella de ${g >= 3 ? `«${r.hechizo}»` : r.negra ? "magia negra" : "magia"}${r.escuela && g >= 2 ? ` (${r.escuela})` : ""}${r.victima ? ` sobre ${r.victima}` : r.objeto ? ` en ${r.objeto}` : ""}${r.amarrado ? " · AMARRADO" : ""}`));
    else lineas.push("- no nota ningún hechizo reciente.");
    const malditos = Object.values(partida.objetos ?? {}).filter((o) => o.calidad === "maldito");
    for (const pj of Object.values(partida.personajes)) {
      const llevaMaldito = pj.inventario.some((n) => malditos.some((o) => norm(o.nombre) === norm(n)));
      if (llevaMaldito) lineas.push(`- algo MALDITO en lo que lleva ${pj.nombre}${g >= 3 ? " (en su equipo)" : ""}.`);
      const marcas = pj.condiciones.filter((c) => /hechizad|maldit|marcad|podre/i.test(c));
      if (marcas.length) lineas.push(`- ${pj.nombre} arrastra un efecto mágico: ${marcas.join(", ")}.`);
    }
    return lineas.join("\n");
  }
  const candidatos = recientes.filter((r) => (!d.hechizo || norm(r.hechizo).includes(norm(d.hechizo))) && (!d.victima || norm(r.victima ?? "") === norm(d.victima)) && (!d.objeto || norm(r.objeto ?? "").includes(norm(d.objeto))));
  const r = candidatos.at(-1);
  if (!r) throw new Error("No encuentro ese hechizo entre las huellas recientes (detectar los lista). Hay que tener a la víctima o al objeto delante.");
  if (d.accion === "amarrar") {
    if (!r.negra) throw new Error(`«${r.hechizo}» no es magia negra: los papeles solo amarran maldiciones y hechizos oscuros.`);
    if (r.amarrado) return `«${r.hechizo}» ya está amarrado a su casteador.\n${infoRastro(partida, p, r)}`;
    const pa = papelesDe(p);
    if (pa.hojas < 1) throw new Error(`${p.nombre} no tiene hojas de runas para amarrar el hechizo.`);
    pa.hojas -= 1;
    r.amarrado = true;
    if (partida.reloj) partida.reloj.segundos += 600;
    return `📜 ${p.nombre} escribe el nombre del hechizo en una hoja, la ata a ${r.victima ?? r.objeto ?? "la huella"} y amarra «${r.hechizo}» a quien lo lanzó (10 min, 1 hoja; le quedan ${pa.hojas}). Ahora puede rastrearlo con solo tener delante a la víctima o al objeto.\n${infoRastro(partida, p, r)}`;
  }
  // rastrear
  if (!r.amarrado) throw new Error(`«${r.hechizo}» no está amarrado todavía: usa amarrar primero (gasta una hoja).`);
  return `📜 ${p.nombre} sigue el rastro de «${r.hechizo}»:\n${infoRastro(partida, p, r)}`;
}

export const REGLAS_CAZADOR = `## Cazador de Brujas: papeles de runas, mascota y rastro de la magia
- Es un explorador de un arte transmitido libremente (nació de un cuerpo paramilitar de la Inquisición, que lo tolera, pero no hay orden central). Se parece más a un mercenario que a un inquisidor.
- Papeles de runas (papeles): no se usan sobre el rival, salvo de dos maneras: clavándole un papel con una estaca (clavar) o, a distancia, con su sangre (tomar_sangre tras herirlo y marcar_sangre). Normalmente van alrededor de la zona de la pelea, sobre todo en espacios cerrados (4 hojas, una por pared; al aire libre, un círculo y la potencia baja uno). Se clavan con estacas. Las runas apagan la regeneración y quitan CD a los poderes de brujas, hechiceros y no-muertos de peligro ≤ su potencia (la potencia sube con el nivel). Clavar un papel a un rival con una estaca (clavar) lo marca aunque no haya runas. El programa te lo recuerda en las criaturas afectadas: aplica ese efecto. A nivel alto (8+), las runas curan a quienes están dentro.
- Mascota (mascota): un halcón o un ratón, a elección del jugador. Su ficha da lo que hace.
- Rastro de la magia (rastro_magico): detectar hechizos y maldiciones, y amarrar un hechizo negro a su casteador para rastrearlo con solo tener a la víctima o al objeto; cuanto más nivel, más sabe (tipo de magia → rumbo → región → lugar → quién es y seguirlo). Anota con registrar las maldiciones o hechizos que lancen los PNJ (con lugar y lanzador secretos).`;
