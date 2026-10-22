// Parte sin dependencias del Degollador (la usan la ficha, el combate y las salvaciones).
import type { Personaje } from "./estado.js";
import { raza } from "./mundo.js";

export const esDegollador = (p: Personaje) => p.clase === "Degollador";
export const DARDOS_INICIALES = 20, DARDOS_POR_VIAL = 3, MAX_DARDOS = 50, ALCANCE_CERBATANA = 30;
/** Sustancias con que se impregnan los dardos: los viales de veneno y de sueño. */
export const SUSTANCIAS = ["Hiel de Víbora Gris", "Leche de Amapola Negra"] as const;

export interface Dardos {
  sanos: number;
  impregnados: { sustancia: string; n: number }[];
}

export const dardosDe = (p: Personaje): Dardos => (p.dardos ??= { sanos: DARDOS_INICIALES, impregnados: [] });
export const totalDardos = (d: Dardos) => d.sanos + d.impregnados.reduce((s, x) => s + x.n, 0);
/** Dados de ataque furtivo por nivel. */
export const furtivoDados = (nivel: number) => (nivel >= 5 ? 3 : nivel >= 3 ? 2 : 1);
/** Nivel 8: Ojos en la espalda. */
export const ojosEnLaEspalda = (p: Personaje) => esDegollador(p) && p.nivel >= 8;
/** Nivel 4: Ojos de gato. */
export const ojosDeGato = (p: Personaje) => esDegollador(p) && p.nivel >= 4;
/** Metros a los que ve en la oscuridad: los de su raza, y con Ojos de gato 18 m (el doble si ya veía en la oscuridad). */
export function visionEnOscuridad(p: Personaje): number {
  const base = raza(p.raza)?.rasgos.some((r) => /visi[oó]n en la oscuridad/i.test(r)) ? 18 : 0;
  return ojosDeGato(p) ? (base ? base * 2 : 18) : base;
}
/** Nivel 3: sus accesos no fallan hasta esta dificultad. */
export const CD_ACCESO_SEGURO = 15;

export function textoDegollador(p: Personaje): string {
  if (!esDegollador(p)) return "";
  const d = p.dardos ?? { sanos: DARDOS_INICIALES, impregnados: [] };
  const imp = d.impregnados.filter((x) => x.n > 0).map((x) => `${x.n} con ${x.sustancia}`);
  return `  🗡 Cerbatana: ${d.sanos} dardo(s) sano(s)${imp.length ? `, ${imp.join(", ")}` : ""}${p.presa && !p.presa.usada ? ` · Presa estudiada: ${p.presa.objetivo}` : ""}${ojosDeGato(p) ? ` · Ojos de gato (ve en la oscuridad a ${visionEnOscuridad(p)} m)` : ""}${ojosEnLaEspalda(p) ? " · Ojos en la espalda" : ""}`;
}

export const REGLAS_DEGOLLADOR = `## Degollador (asesino a sueldo de la organización criminal de Aldenmar)
- Es un asesino por contrato: trabaja para la organización criminal de Aldenmar (sin nombre ni ritos; simplemente una organización criminal) o por su cuenta. Entra, mata y sale; el sigilo y la preparación son su oficio. Hablan poco y cobran por adelantado.
- Estudiar a la presa (estudiar_presa, 1 uso por descanso corto): observa un rato (como mínimo un minuto, fuera de combate) a un objetivo y conoce su rutina. Su primer ataque contra él tiene ventaja y suma los dados de ataque furtivo; el programa lo aplica solo.
- Dagas y cerbatana: lleva dos dagas (con DES 13 o más, pelea con las dos) y una cerbatana con dardos (ataque a distancia con atacar {arma: «cerbatana»}, 1 de daño, alcance 30 m). Los dardos se impregnan con viales de veneno o de sueño (dardos {accion: impregnar}, una acción; un vial cubre 3 dardos): si el dardo hace daño (la armadura que lo frena lo deja sin efecto), la víctima hace una salvación de CON como con el vial. Los no-muertos son inmunes. Empuña la cerbatana con empuñar antes de soplar.
- Entrar y salir (forzar_acceso): abre cerraduras, ventanas, puertas atrancadas, rejas y ataduras con ventaja. Con herramientas de ladrón para las cerraduras; desde el nivel 2 lo hace como acción adicional en combate; desde el nivel 3 no falla hasta CD 15. Nada que esté sellado por magia.
- Magia: sombra (Paso de sombra de inicio, Manto de noche) y, de la elemental, solo la oscuridad menor: Velo de penumbra (esconderse) y Tinta negra (cegar a un objetivo, CON). Puede aprenderlos con un maestro o grimorio (agregar_hechizos). Camuflaje de sombra (círculo 3, nivel 9+ o maestría de adepto): invisible incluso a plena luz, muy difícil de ver.
- Esquiva: ventaja en las salvaciones de DES y esquivar le resulta fácil: la acción de Esquivar la hace como acción adicional (si no la ha gastado ya), así que puede atacar y esquivar en el mismo turno. Nivel 4: Ojos de gato (ve en la oscuridad a 18 m, o el doble si ya veía en ella). Nivel 5: Esquiva asombrosa (reacción, mitad de daño de un ataque que ve). Nivel 8: Ojos en la espalda: +5 para notar emboscadas, reacciona aunque lo hayan sorprendido y los ataques por la espalda o el flanco no le dan ventaja al atacante.`;
