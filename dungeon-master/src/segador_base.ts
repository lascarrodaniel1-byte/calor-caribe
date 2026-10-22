// Parte sin dependencias del Segador de Neter (la usan la ficha, las salvaciones, los recursos y las demás clases).
import type { Personaje } from "./estado.js";

export const esSegador = (p: Personaje) => p.clase === "Segador";

/** Un alma sellada: la habilidad que le falta a quien la perdió mientras el Segador la sostenga. */
export interface Sello {
  habilidad: string;
  por: string;
  /** Entregada a Neter: ya no se libera. */
  permanente?: boolean;
}

/** Un alma que el Segador lleva sellada. */
export interface AlmaSellada {
  nombre: string;
  habilidad: string;
  /** Lo que paga su entrega a Neter (el doble de su peligro o nivel). */
  valor: number;
}

const norm = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

/** ¿Tiene sellada esa habilidad? Coincide por nombre en cualquier dirección («Furia» / «la furia»). */
export function selloDe(sellos: Sello[] | undefined, habilidad: string): Sello | undefined {
  const h = norm(habilidad);
  return sellos?.find((s) => norm(s.habilidad).includes(h) || h.includes(norm(s.habilidad)));
}

/** Lanza un error si la habilidad está sellada (para los puntos de entrada de cada clase). */
export function exigirLibre(p: Personaje, habilidad: string): void {
  const s = selloDe(p.sellos, habilidad);
  if (s) throw new Error(`${p.nombre} tiene sellada su ${habilidad} (su alma está en manos de ${s.por}): no puede usarla hasta que la liberen.`);
}

/** La habilidad firma de cada clase que se puede sellar (la primera es la habitual). */
export const FIRMAS: Record<string, string[]> = {
  "Mercenario del Cuervo": ["Ataque adicional", "Segundo aliento", "Acción súbita"],
  "Berserker de Ceniza": ["Furia"],
  "Caballero Juramentado": ["Imposición de manos", "Castigo divino", "Sentido divino"],
  "Cazador de Brujas": ["Papeles de runas", "Rastro de la magia"],
  Degollador: ["Estudiar a la presa", "Entrar y salir", "Ataque furtivo"],
  Flagelante: ["Comunión del dolor", "Sangre ajena", "Cadenas"],
  Segador: ["Descarga sobrenatural", "Guadaña"],
  "Barbero-Cirujano": ["Cirugía"],
  Hechicero: ["Magia"],
};

export const INVOCACIONES = ["Ojos del dios muerto", "Presencia sepulcral", "Voz de los muertos", "Piel de hueso"] as const;

/** La Deuda pesa más cuanto más poder tiene: ×1 hasta el nivel 4, ×2 del 5 al 8, ×3 desde el 9. */
export const multiplicadorDeuda = (nivel: number) => (nivel >= 9 ? 3 : nivel >= 5 ? 2 : 1);
/** Almas que puede sostener selladas a la vez. */
export const capacidadAlmas = (nivel: number) => Math.max(1, Math.floor(nivel / 2));
export const DEUDA_COBRO = 15;

export const ETAPAS_DEUDA = [
  { desde: 0, nombre: "al día", efecto: "" },
  { desde: 5, nombre: "huesos que crujen", efecto: "desventaja en Sigilo" },
  { desde: 10, nombre: "la voz del dios", efecto: "desventaja en salvaciones de SAB; Neter le habla en voz alta" },
  { desde: DEUDA_COBRO, nombre: "Neter cobra", efecto: "el dios toma lo suyo" },
];
export const etapaDeuda = (d: number) => [...ETAPAS_DEUDA].reverse().find((e) => d >= e.desde)!;
/** Desventaja en Sigilo (etapa 1) o en salvaciones de SAB (etapa 2). */
export const desventajaSigilo = (p: Personaje) => esSegador(p) && (p.deuda ?? 0) >= 5;
export const desventajaSab = (p: Personaje) => esSegador(p) && (p.deuda ?? 0) >= 10;

export function textoSegador(p: Personaje): string {
  const partes: string[] = [];
  if (esSegador(p)) {
    const d = p.deuda ?? 0;
    partes.push(`  💀 Deuda de Neter: ${d} (${etapaDeuda(d).nombre}${etapaDeuda(d).efecto ? `: ${etapaDeuda(d).efecto}` : ""}) · almas selladas ${(p.almas ?? []).length}/${capacidadAlmas(p.nivel)}${p.almas?.length ? ` (${p.almas.map((a) => `${a.nombre}: ${a.habilidad}`).join(", ")})` : ""}${p.invocaciones?.length ? ` · invocaciones: ${p.invocaciones.join(", ")}` : ""}${p.pielHueso ? " · piel de hueso (+2 CA)" : ""}`);
  }
  if (p.sellos?.length) partes.push(`  🔒 Alma sellada: sin ${p.sellos.map((s) => `${s.habilidad} (por ${s.por}${s.permanente ? ", para siempre" : ""})`).join(", ")}`);
  return partes.join("\n");
}

export const REGLAS_SEGADOR = `## Segador de Neter (recolector de almas)
- Neter era el dios de las cosechas y la vegetación; al morir (hace 99 años, con los demás dioses) hizo un pacto con sus fieles para trasladar su esencia a ellos. Los Segadores son esos fieles: recolectores de almas, y cosechar es su modo de pagar al dios. El cadáver de Neter les habla (el DM puede pedirles cosas en sueños).
- Guadaña de Neter (guadana): hecha de los huesos del dios. La invoca (acción adicional) y la despide; nadie más puede empuñarla; ataca con CAR, 1d10 cortante, alcance 3 m, a dos manos. Mágica desde el nivel 3. Si el Segador muere, vuelve a los huesos del dios.
- Descarga sobrenatural (descarga): 1d10 de fuerza a 36 m con ataque de CAR; 1 uso por descanso corto (2 desde el nivel 2); a nivel 5, dos rayos.
- Deuda de Neter: todo poder suma Deuda (descarga +1, invocación +1 o +2, hechizo +su círculo, sellar un alma +3, hablar con los muertos +1), multiplicada por el nivel (×1 hasta el 4, ×2 del 5 al 8, ×3 desde el 9). Se paga con almas: cada criatura que muere bajo su guadaña o su descarga paga su peligro; un alma sellada entregada a una tumba del dios (entregar_almas) paga el doble. 5+: huesos que crujen (desventaja en Sigilo). 10+: la voz del dios (desventaja en salvaciones de SAB). 15: Neter cobra (1d6 años de vida, una herida grave o la guadaña se resiste un día) y la Deuda baja 5.
- Sellar un alma (sellar_alma, nivel 2+, acción adicional): tras herir a un vivo con la guadaña en ese mismo turno, su alma hace una salvación de CAR (CD 8 + competencia + CAR). Si falla, queda sellada una habilidad firma (la furia del Berserker, el Ataque adicional del Mercenario, la imposición de manos del Caballero…) mientras el Segador la sostenga: hasta la mitad de su nivel almas a la vez. Se libera por decisión suya, si él muere o con un rito de las Hermanas (liberar_alma); entregada a Neter, el alma se pierde para siempre. Para criaturas y PNJ, sella un poder o rasgo a elección del DM. El motor bloquea de verdad los rasgos con usos, la furia, las cadenas, la sangre ajena, la comunión del dolor, la imposición de manos, los papeles y la magia; el Ataque adicional sellado lo juzgas tú.
- Hablar con los muertos (hablar_con_muertos): un cadáver (o un espíritu) responde hasta tres preguntas con lo que sabía en vida. Cuesta 1 de Deuda.
- Invocaciones (dos al nivel 2): Ojos del dios muerto (ve en la oscuridad y sabe quién está a punto de morir), Presencia sepulcral (las bestias lo evitan y asusta), Voz de los muertos (habla con espíritus sin gastar nada), Piel de hueso (+2 CA una hora).`;
