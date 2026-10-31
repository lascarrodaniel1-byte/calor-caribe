// Ayuda de la ficha: cada raza, clase, objeto, hechizo, dote, recurso, condición o herida de un personaje se puede pulsar
// y enseña para qué sirve en un pequeño pop-up. `fichaClicable` parte el texto de la ficha en trozos pulsables.
import { reconocerArma, PIEZAS } from "./armadura.js";
import { CATALOGO, reconocer, REGLA_AGOTAMIENTO } from "./condiciones.js";
import { buscarDote, DOTES } from "./dotes.js";
import { rotuloDote } from "./dotes_base.js";
import { ESTRUCTURAS } from "./anatomia.js";
import { BASES } from "./equipo.js";
import { fichaTexto, type Partida, type Personaje } from "./estado.js";
import { buscarHechizo } from "./magia.js";
import { propiedades } from "./manos.js";
import { CLASES, RAZAS } from "./mundo.js";
import { RASGOS_NIVEL } from "./progresion.js";
import { recursosDe } from "./recursos.js";
import { ENFERMEDADES } from "./enfermedades.js";

export type TipoAyuda = "raza" | "clase" | "objeto" | "hechizo" | "dote" | "recurso" | "condicion" | "herida" | "don" | "rasgos";
export interface Segmento { t: string; k?: { tipo: TipoAyuda; nombre: string } }
export interface Ayuda { titulo: string; cuerpo: string[] }

const norm = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

/** La ficha en líneas de trozos; los pulsables llevan `k` (qué son). */
export function fichaClicable(p: Personaje): Segmento[][] {
  const fichas: { texto: string; k: Segmento["k"] }[] = [];
  const poner = (texto: string, tipo: TipoAyuda, nombre = texto) => { if (texto && texto.length > 1) fichas.push({ texto, k: { tipo, nombre } }); };
  poner(p.raza, "raza"); poner(p.clase, "clase");
  for (const o of p.inventario) poner(o, "objeto");
  for (const h of p.magia?.hechizos ?? []) poner(h, "hechizo");
  for (const d of p.dotes ?? []) poner(rotuloDote(d), "dote", d.split(":")[0]);
  for (const r of recursosDe(p)) poner(r.def.nombre, "recurso");
  for (const c of p.condiciones) poner(c, "condicion");
  for (const h of p.heridas) poner(h.id, "herida");
  poner(p.don === "fisico" ? "Don arcano FÍSICO" : p.don === "magico" ? "Don arcano MÁGICO" : "", "don");
  poner("Rasgos de nivel", "rasgos");
  fichas.sort((a, b) => b.texto.length - a.texto.length);
  return fichaTexto(p).split("\n").map((linea) => {
    const trozos: Segmento[] = [];
    let resto = linea;
    while (resto) {
      let mejor: { i: number; f: (typeof fichas)[number] } | undefined;
      for (const f of fichas) {
        const i = resto.indexOf(f.texto);
        if (i < 0) continue;
        // palabra completa para los ids cortos de herida (H1 no dentro de H10)
        if (f.k!.tipo === "herida" && /[0-9A-Za-z]/.test(resto[i + f.texto.length] ?? "")) continue;
        if (!mejor || i < mejor.i || (i === mejor.i && f.texto.length > mejor.f.texto.length)) mejor = { i, f };
      }
      if (!mejor) { trozos.push({ t: resto }); break; }
      if (mejor.i > 0) trozos.push({ t: resto.slice(0, mejor.i) });
      trozos.push({ t: mejor.f.texto, k: mejor.f.k });
      resto = resto.slice(mejor.i + mejor.f.texto.length);
    }
    return trozos;
  });
}

const COMUNES: [RegExp, string][] = [
  [/raci[oó]n|raciones|provisi/i, "Comida para un día. Sin comer 3 + mod. de CON días, el hambre pasa factura (con hambre, famélico y luego agotamiento). Se come con la herramienta de sustento."],
  [/odre|cantimplora|agua/i, "Agua para un día. Sin beber más de un día entero, la sed da desventajas y agotamiento. Un odre vacío se rellena en un río o un pozo."],
  [/\bsal\b/i, "Los muertos sin rito de sal y fuego se levantan. Un frasco frena a los no-muertos (círculo), se lanza contra ellos, sala una herida con Podre (la hace retroceder 3 días) o da el rito al cadáver. El Cazador de Brujas lo usa mejor."],
  [/hierbas/i, "Sirven para cuidar a un enfermo: +2 a sus salvaciones contra la enfermedad (junto a los cuidados)."],
  [/kit de sanador/i, "Material para tratar heridas moderadas. Con él no hay penalización al tratarlas (y para las graves, quien tiene Manos de cirujano lo toma como herramientas)."],
  [/herramientas de cirujano/i, "Material de cirugía para heridas graves y críticas."],
  [/alcohol/i, "Desinfecta una herida (ayuda contra la infección)."],
  [/estaca/i, "Sirve para clavar papeles de runas (Cazador de Brujas) y, con la madera, para matar a los vampiros."],
  [/papel|hoja.*runa/i, "Hojas de runas del Cazador de Brujas: se escriben, se clavan con estacas alrededor de la pelea o sobre un rival, y debilitan lo mágico."],
  [/antorcha|yesca|aceite/i, "Luz y fuego: para ver en la oscuridad, cauterizar o prender el rito de sal y fuego."],
  [/cuerda|garfio/i, "Para trepar, atar o abordar. Con un garfio se une una nave a otra."],
  [/escudo|rodela|adarga/i, "Escudo: +2 a la CA mientras lo empuñas. Quien tiene Maestro del escudo suma +1 y empuja con él."],
  [/vial|poci[oó]n|elixir/i, "Un vial: su efecto está en la descripción que da el DM. Se usa con la herramienta de viales."],
];

function ayudaObjeto(partida: Partida, p: Personaje, nombre: string): Ayuda {
  const cuerpo: string[] = [];
  const n = norm(nombre);
  const reg = Object.values(partida.objetos ?? {}).find((o) => norm(o.nombre) === n);
  if (reg) {
    cuerpo.push(reg.apariencia);
    if (reg.identificado) cuerpo.push(`Identificado: ${reg.verdad}`);
    else cuerpo.push("Aún no lo has identificado: puede esconder algo más.");
  }
  const base = BASES.find((b) => norm(nombre).includes(norm(b.nombre)) || norm(b.nombre).includes(norm(nombre)));
  if (base) cuerpo.push(`${base.nombre}: ${base.detalle}.`);
  const arma = reconocerArma(nombre);
  if (arma) cuerpo.push(`Arma (${arma.tipo}): ${arma.penetracion > 0 ? `penetra ${arma.penetracion} de armadura` : arma.penetracion < 0 ? "ligera contra el metal" : "no atraviesa más armadura que otras"}${"brutal" in arma && (arma as { brutal?: number }).brutal ? `, brutal (+${(arma as { brutal?: number }).brutal} contra heridas)` : ""}.`);
  const pr = propiedades(nombre);
  if (pr) cuerpo.push(`Propiedades: ${[pr.ligera && "ligera", pr.pesada && "pesada", pr.sutil && "sutil (usa DES)", pr.versatil && `versátil (${pr.versatil} a dos manos)`, pr.dosManos && "a dos manos", pr.arrojadiza && "arrojadiza", pr.alcance && "alcance 3 m", pr.municion && "usa munición"].filter(Boolean).join(", ") || "ninguna especial"}.`);
  const pieza = Object.values(PIEZAS).find((x) => norm(nombre).includes(norm(x.nombre)) || norm(x.nombre).includes(norm(nombre)));
  if (pieza) cuerpo.push(`Armadura: ${pieza.nombre} cubre ${pieza.regiones.join(", ")}; protege ${pieza.prot.corte} contra corte, ${pieza.prot.punta} contra punta y ${pieza.prot.contundente} contra contundente${pieza.metal ? " (metal: se salta por las juntas)" : ""}.`);
  for (const [re, txt] of COMUNES) if (re.test(nombre)) { cuerpo.push(txt); break; }
  if (p.manos?.principal && norm(p.manos.principal) === n) cuerpo.push("Lo empuñas en la mano principal.");
  if (p.manos?.secundaria && norm(p.manos.secundaria) === n) cuerpo.push("Lo llevas en la mano secundaria.");
  if (!cuerpo.length) cuerpo.push("No hay nada especial anotado de este objeto. Pregunta al DM qué sabes de él.");
  return { titulo: nombre, cuerpo };
}

function ayudaClase(p: Personaje): Ayuda {
  const c = CLASES.find((x) => x.nombre === p.clase);
  if (!c) return { titulo: p.clase, cuerpo: ["Clase sin descripción."] };
  const cuerpo = [`Dado de golpe d${c.dadoGolpe} · atributo principal ${c.principal} · salvaciones ${c.salvaciones}.`, ...c.rasgos.map((r) => `· ${r}`)];
  const porNivel = RASGOS_NIVEL[p.clase] ?? {};
  const tuyos = Object.entries(porNivel).filter(([n]) => Number(n) <= p.nivel).sort((a, b) => Number(a[0]) - Number(b[0]));
  if (tuyos.length) cuerpo.push("Lo que ya tienes por nivel:", ...tuyos.flatMap(([n, r]) => r.map((x) => `· Nv. ${n}: ${x}`)));
  const siguiente = Object.entries(porNivel).filter(([n]) => Number(n) > p.nivel).sort((a, b) => Number(a[0]) - Number(b[0]))[0];
  if (siguiente) cuerpo.push(`Lo próximo (nv. ${siguiente[0]}): ${siguiente[1].join("; ")}`);
  const rec = recursosDe(p);
  if (rec.length) cuerpo.push("Usos limitados: " + rec.map((r) => `${r.def.nombre} (${r.max - r.gastados}/${r.max}, se recupera con descanso ${r.def.recarga})`).join("; ") + ".");
  return { titulo: `${c.nombre} (nivel ${p.nivel})`, cuerpo };
}

export function ayuda(partida: Partida, pj: string, tipo: TipoAyuda, nombre: string): Ayuda {
  const p = Object.values(partida.personajes).find((x) => norm(x.nombre) === norm(pj));
  if (!p) throw new Error(`No hay ningún personaje «${pj}».`);
  switch (tipo) {
    case "clase": return ayudaClase(p);
    case "raza": {
      const r = RAZAS.find((x) => x.nombre === nombre);
      return r ? { titulo: r.nombre, cuerpo: [r.descripcion, `Atributos: ${r.atributos}.`, ...r.rasgos.map((x) => `· ${x}`), r.notaCuracion] } : { titulo: nombre, cuerpo: ["Raza sin descripción."] };
    }
    case "objeto": return ayudaObjeto(partida, p, nombre);
    case "hechizo": {
      const h = buscarHechizo(nombre);
      return h ? { titulo: h.nombre, cuerpo: [`Círculo ${h.circulo} · ${h.escuela}${h.tema ? ` (${h.tema})` : ""}${h.tributo ? ` · paga con ${h.tributo}` : ""}.`, h.efecto] } : { titulo: nombre, cuerpo: ["Hechizo sin descripción."] };
    }
    case "dote": {
      const d = buscarDote(nombre) ?? DOTES.find((x) => x.id === nombre);
      return d ? { titulo: d.nombre, cuerpo: [d.efecto + ".", `Requisito: ${d.requisito.atributos.map((a) => a.toUpperCase()).join(" o ")} ${d.requisito.minimo}${d.requisito.clase ? `, solo ${d.requisito.clase}` : ""}.`] } : { titulo: nombre, cuerpo: ["Dote sin descripción."] };
    }
    case "recurso": {
      const r = recursosDe(p).find((x) => x.def.nombre === nombre);
      return r ? { titulo: r.def.nombre, cuerpo: [`Te quedan ${r.max - r.gastados} de ${r.max} usos; se recuperan con un descanso ${r.def.recarga}.`, `${r.def.adicional ? "Es una acción adicional. " : ""}Pídele al DM que lo use por ti con el recurso «${r.def.nombre}».`] } : { titulo: nombre, cuerpo: ["Rasgo con usos limitados."] };
    }
    case "condicion": {
      const m = /^agotamiento\s*(\d)/i.exec(nombre);
      if (m) return { titulo: nombre, cuerpo: REGLA_AGOTAMIENTO.slice(0, Number(m[1])).map((x) => `· ${x}`) };
      const c = reconocer(nombre) ?? CATALOGO.find((x) => nombre.toLowerCase().includes(x.nombre));
      if (c) return { titulo: nombre, cuerpo: [c.regla + "."] };
      const e = ENFERMEDADES.find((x) => nombre.toLowerCase().includes(x.nombre.toLowerCase()));
      if (e) return { titulo: nombre, cuerpo: [`${e.nombre}: ${e.cura}.`] };
      return { titulo: nombre, cuerpo: ["Una condición narrativa: pregunta al DM qué efecto tiene."] };
    }
    case "herida": {
      const h = p.heridas.find((x) => x.id === nombre);
      if (!h) return { titulo: nombre, cuerpo: ["Herida ya curada."] };
      const est = h.estructura ? ESTRUCTURAS.find((x) => x.nombre === h.estructura) : undefined;
      return { titulo: `${h.id}: ${h.estructura ?? h.ubicacion} (${h.gravedad})`, cuerpo: [h.descripcion, est ? `Afecta a: ${est.efecto}.` : "", `Estado: ${h.estado}${h.sangrando ? ", sangrando" : ""}${h.podre ? `, con PODRE (día ${h.dias_podre ?? 0}/7)` : ""}.`, h.estado === "sin tratar" ? "Hay que tratarla (tratar_herida) cuanto antes." : `Convalecencia: ${h.dias_restantes} días.`].filter(Boolean) };
    }
    case "don": return { titulo: p.don === "fisico" ? "Don arcano físico" : "Don arcano mágico", cuerpo: [p.don === "fisico" ? "Naciste con un cuerpo prodigioso: competencia +1 y FUE, DES y CON pueden llegar a 28." : "Naciste con talento para la magia: si eres Hechicero dominas todos los tipos; si no, la magia de tu estilo despierta con el tiempo."] };
    case "rasgos": return ayudaClase(p);
  }
}
