// La sal: en Velmora los muertos sin rito de sal y fuego se levantan. Los frascos de sal del Cazador de Brujas (y de quien los lleve)
// sirven para cuatro cosas: un círculo que frena a los no-muertos, lanzarla contra ellos, salar una herida con Podre y el rito del cadáver.
import { aplicarCondicion, condsDe, localizar, type Combatiente } from "./combate.js";
import { tirar } from "./dados.js";
import type { Partida, Personaje } from "./estado.js";
import { competencia, mod, valor } from "./reglas.js";
import { gastarUnidad } from "./sustento.js";

const ES_SAL = /\bsal\b/i;
const NO_MUERTO = /no-muerto|vampiro|espectro|ghul|hambriento|banshee|esqueleto|zombi|cad[aá]ver/i;
const norm = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

export interface CirculoSal {
  /** Quién queda dentro (los no-muertos deben cruzar la sal para tocarlos). */
  protegidos: string[];
  cd: number;
  por: string;
  /** Segundos del reloj hasta los que dura (una hora), si hay reloj. */
  hasta?: number;
  /** Quién ya intentó cruzar este asalto y si pasó. */
  intentos: Record<string, { ronda: number; paso: boolean }>;
}

function esNoMuerto(c: Combatiente): boolean {
  if (c.tipo === "criatura") {
    const d = c.j.definicion;
    return NO_MUERTO.test(`${d.temple ?? ""} ${d.nombre} ${d.descripcion}`);
  }
  if (c.tipo === "pnj") return NO_MUERTO.test(`${c.n.temple ?? ""} ${c.n.nombre}`);
  return false;
}

/** La sal frena el cuerpo a cuerpo de un no-muerto contra quien está dentro del círculo: si no supera la salvación, no puede atacar. */
export function bloqueoDeSal(partida: Partida, at: Combatiente, ob: Combatiente, distancia: boolean): string | null {
  const s = partida.sal;
  if (!s || distancia) return null;
  if (s.hasta !== undefined && partida.reloj && partida.reloj.segundos > s.hasta) { delete partida.sal; return null; }
  if (!esNoMuerto(at) || !s.protegidos.some((x) => norm(x) === norm(ob.nombre))) return null;
  const ronda = partida.combate?.ronda ?? 0;
  const previo = s.intentos[at.nombre];
  if (previo && previo.ronda === ronda) {
    return previo.paso ? null : `🧂 ${at.nombre} no logra cruzar la sal este asalto (ya lo intentó): no puede tocar a ${ob.nombre}.`;
  }
  const t = tirar("1d20");
  const paso = t.total >= s.cd;
  s.intentos[at.nombre] = { ronda, paso };
  return paso ? null : `🧂 ${at.nombre} intenta cruzar la línea de sal hacia ${ob.nombre} (salvación de SAB d20 = ${t.total} vs CD ${s.cd}) y no puede: el muerto se detiene ante la sal.`;
}

export interface DatosSal {
  accion: "circulo" | "lanzar" | "herida" | "cadaver" | "romper";
  quien: string;
  /** circulo: quiénes quedan dentro (por defecto, todo el grupo). lanzar: el no-muerto. herida/cadaver: a quién. */
  objetivo?: string;
  protegidos?: string[];
  /** herida: la herida (por defecto, una con Podre). */
  herida?: string;
}

const vivos = (partida: Partida) => Object.values(partida.personajes).filter((p) => !p.condiciones.includes("muerto"));
function pj(partida: Partida, n: string): Personaje {
  const p = Object.values(partida.personajes).find((x) => norm(x.nombre) === norm(n) || (x.jugador && norm(x.jugador) === norm(n)));
  if (!p) throw new Error(`No hay ningún personaje «${n}».`);
  return p;
}
function gastar(p: Personaje, n: number): void {
  for (let i = 0; i < n; i++) if (!gastarUnidad(p, ES_SAL)) throw new Error(`${p.nombre} no tiene ${n === 1 ? "sal" : `${n} frascos de sal`} (frascos de sal en el inventario).`);
}

type AtacarFn = (d: { atacante: string; objetivo: string; arma: string; dano: string; a_distancia: boolean }) => { texto: string; aviso: string };

export function sal(partida: Partida, d: DatosSal, atacar: AtacarFn): { texto: string; publico: string | null } {
  const p = pj(partida, d.quien);
  if (p.pv <= 0 || p.condiciones.includes("muerto")) throw new Error(`${p.nombre} no puede usar la sal ahora.`);
  const cazador = p.clase === "Cazador de Brujas";
  if (d.accion === "romper") { delete partida.sal; return { texto: "El círculo de sal se rompe.", publico: "🧂 Se rompe el círculo de sal." }; }
  if (d.accion === "circulo") {
    gastar(p, cazador ? 1 : 2);
    const protegidos = d.protegidos?.length ? d.protegidos.map((n) => pj(partida, n).nombre) : vivos(partida).map((x) => x.nombre);
    if (!protegidos.includes(p.nombre)) protegidos.push(p.nombre);
    const cd = 8 + competencia(p) + mod(valor(p, "sab")) + (cazador ? 1 : 0);
    partida.sal = { protegidos, cd, por: p.nombre, hasta: partida.reloj ? partida.reloj.segundos + 3600 : undefined, intentos: {} };
    return { texto: `${p.nombre} traza un círculo de sal (${cazador ? "1 frasco" : "2 frascos"}) alrededor de ${protegidos.join(", ")}: los no-muertos deben superar una salvación de SAB (CD ${cd}) cada asalto para atacarlos cuerpo a cuerpo. Dura una hora o hasta que alguien lo rompa (sal {romper}). No frena los ataques a distancia ni a los vivos.`, publico: `🧂 ${p.nombre} traza un círculo de sal.` };
  }
  if (d.accion === "lanzar") {
    if (!d.objetivo) throw new Error("lanzar: di el no-muerto (objetivo).");
    const ob = localizar(partida, d.objetivo);
    if (!esNoMuerto(ob)) throw new Error(`${ob.nombre} no es un no-muerto: la sal solo muerde a los muertos.`);
    gastar(p, 1);
    const r = atacar({ atacante: p.nombre, objetivo: ob.nombre, arma: "frasco de sal", dano: "1d6", a_distancia: true });
    let extra = "";
    if (/→ (IMPACTO|¡?CRÍTICO)/.test(r.texto)) {
      extra = "\n" + aplicarCondicion(partida, { objetivo: ob.nombre, accion: "aplicar", condicion: "quemado por la sal", nota: "sin regeneración ni curación hasta el final del combate" }).split("\n")[0];
      extra += `\n🧂 La sal arde en su carne muerta: ${ob.nombre} no regenera ni se cura hasta que acabe el combate.`;
    }
    return { texto: r.texto + extra, publico: r.aviso };
  }
  if (d.accion === "herida") {
    const paciente = d.objetivo ? pj(partida, d.objetivo) : p;
    const h = d.herida ? paciente.heridas.find((x) => x.id.toLowerCase() === d.herida!.toLowerCase()) : paciente.heridas.find((x) => x.podre) ?? paciente.heridas[0];
    if (!h) throw new Error(`${paciente.nombre} no tiene esa herida.`);
    if (h.salada) throw new Error(`La herida ${h.id} ya está salada: la sal no vuelve a morder.`);
    gastar(p, 1);
    h.salada = true;
    if (h.podre) {
      const antes = h.dias_podre ?? 0;
      h.dias_podre = Math.max(0, antes - 3);
      return { texto: `${p.nombre} sala la herida ${h.id} de ${paciente.nombre} (escuece como el fuego): la Podre retrocede 3 días (${antes}/7 → ${h.dias_podre}/7). Gana tiempo, no la cura: hay que cortarla o cauterizarla.`, publico: `🧂 ${p.nombre} sala la herida de ${paciente.nombre}.` };
    }
    h.desinfectada = true;
    return { texto: `${p.nombre} sala la herida ${h.id} de ${paciente.nombre}: queda desinfectada (ayuda contra la infección).`, publico: `🧂 ${p.nombre} sala la herida de ${paciente.nombre}.` };
  }
  // cadaver
  if (!d.objetivo) throw new Error("cadaver: di el muerto (objetivo).");
  const muerto = pj(partida, d.objetivo);
  if (!muerto.condiciones.includes("muerto")) throw new Error(`${muerto.nombre} no está muerto.`);
  if (muerto.salado) throw new Error(`${muerto.nombre} ya recibió el rito.`);
  gastar(p, 2);
  muerto.salado = true;
  return { texto: `${p.nombre} cubre el cuerpo de ${muerto.nombre} de sal (2 frascos) y le prende fuego: el rito de sal y fuego. ${muerto.nombre} descansa y no se alzará, ni por la Podre.`, publico: `🧂 ${p.nombre} da a ${muerto.nombre} el rito de sal y fuego: descansa.` };
}

export function textoSal(partida: Partida): string {
  const s = partida.sal;
  return s ? `## Círculo de sal\nProtege a ${s.protegidos.join(", ")} (lo trazó ${s.por}, CD ${s.cd}): los no-muertos necesitan superar SAB cada asalto para atacarlos cuerpo a cuerpo.` : "";
}

export const REGLAS_SAL = `- La sal (sal): los muertos sin rito de sal y fuego se levantan, y la sal los frena. El Cazador lleva 5 frascos («Frascos de sal (5)» en el inventario) y cualquiera con frascos puede usarlos. Círculo (1 frasco el Cazador, 2 el resto): los no-muertos deben superar SAB (CD 8 + competencia + SAB del que lo traza) cada asalto para atacar cuerpo a cuerpo a los de dentro; dura una hora; no frena ataques a distancia ni a los vivos. Lanzar (1 frasco): ataque a distancia contra un no-muerto; si impacta, hace 1d6 y no regenera ni se cura hasta el final del combate (sirve contra las regeneraciones). Salar una herida (1 frasco, una vez por herida): con Podre, la hace retroceder 3 días; sin Podre, la desinfecta. Rito del cadáver (2 frascos y fuego): el muerto descansa y no se alza, ni por la Podre.`;
