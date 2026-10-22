// Parte sin dependencias del Flagelante de Haema (la usan la ficha y el combate).
import type { Personaje } from "./estado.js";
import { selloDe } from "./segador_base.js";

export const esFlagelante = (p: Personaje) => p.clase === "Flagelante";

/** Nivel de dolor (1-4): los PV máximos se dividen en cuatro cuartos y cuanto más abajo está, mayor es el dolor. */
export function nivelDolor(p: Personaje): number {
  if (p.pv <= 0) return 4;
  const max = Math.max(1, p.pv_max);
  const corte = (k: number) => Math.ceil((k * max) / 4); // el último PV de cada cuarto, contando desde abajo
  return p.pv <= corte(1) ? 4 : p.pv <= corte(2) ? 3 : p.pv <= corte(3) ? 2 : 1;
}

/** Rango de PV de cada nivel de dolor para ese máximo: [1] = [mín, máx] del nivel 1… */
export function rangosDolor(pvMax: number): Record<1 | 2 | 3 | 4, [number, number]> {
  const cuarto = (n: number) => Math.ceil((n * pvMax) / 4);
  const r = (n: number): [number, number] => [cuarto(4 - n) + 1, cuarto(5 - n)];
  return { 1: r(1), 2: r(2), 3: r(3), 4: [1, cuarto(1)] };
}

/** Sangre fría: reduce a la mitad las penalizaciones numéricas de las heridas (sin quitarles sus efectos). */
export const sangreFria = (p: Personaje) => esFlagelante(p);
/** Nivel 5: Paso elusivo. */
export const pasoElusivoActivo = (p: Personaje) => esFlagelante(p) && p.nivel >= 5;
/** Con el dolor al máximo (nivel 4), el Paso elusivo se hace solo y no falla nunca. */
export const esquivaAutomatica = (p: Personaje) => pasoElusivoActivo(p) && nivelDolor(p) === 4 && p.pv > 0;

/** Daño extra de la comunión del dolor: +1 a +4 según el nivel de dolor. No cambia sus características. */
export const bonoDolor = (p: Personaje) => (esFlagelante(p) && !selloDe(p.sellos, "Comunión del dolor") ? nivelDolor(p) : 0);

export function textoFlagelante(p: Personaje): string {
  if (!esFlagelante(p)) return "";
  const n = nivelDolor(p);
  const [a, b] = rangosDolor(p.pv_max)[n as 1 | 2 | 3 | 4];
  return `  🩸 Comunión del dolor: nivel ${n}/4 (PV ${a}-${b}) → +${n} al daño`;
}

export const REGLAS_FLAGELANTE = `## Flagelante de Haema (monje guerrero: hecho para recibir daño y devolverlo)
- Son devotos de Haema, la diosa de la sangre, que se sacrificaba y usaba su sangre para dañar y curar. Han hecho de recibir el dolor y devolverlo su oficio y su fe. Monjes guerreros: sin armadura (CA 10 + DES + SAB), con maza, cadenas y kunais.
- Comunión del dolor (siempre activa, no se invoca, no dura ni se gasta): los PV máximos se dividen en cuatro cuartos y cada cuarto es un nivel de dolor. Nivel 1: el cuarto superior; nivel 4: el último cuarto, a las puertas de la muerte. Su daño aumenta +1, +2, +3 o +4 según el nivel: cuanto más cerca de la muerte, más pega. La ficha lo muestra y el programa lo suma solo a sus ataques. NO cambia sus características ni lo vuelve ciego de rabia: es lúcido y sereno, no ignora sus heridas (sus efectos cuentan), pero el dolor no le da desventaja al atacar: sin penalización de malherido ni torpeza (solo falla seguro con un 1 natural). Nada que ver con la furia del Berserker (que se invoca, dura, cambia sus características, ignora las heridas y lo ciega).
- Sangre fría (pasiva): las penalizaciones numéricas de sus heridas se reducen a la mitad (los PV máximos que le restan) sin quitarles sus efectos (la pierna rota sigue restando velocidad, etc.). Además es inmune a los efectos secundarios de la Sangre de Santo (coágulos e infarto).
- Devolver el dolor (reacción, nivel 2): cuando un enemigo a su alcance le hace daño, el programa le devuelve (nivel de dolor)d4 de daño. Una vez por asalto; gasta su reacción.
- Sangre ajena: niveles 1-2, con sangre_ajena (acción adicional) bebe o se unta la sangre de un enemigo vivo y herido a su alcance: 2d6 + nivel PV, cierra la hemorragia de sus heridas y baja la más grave un nivel. Desde el nivel 3 es PASIVA: el mero contacto con la sangre de un enemigo al que hiere cuerpo a cuerpo lo cura (1d6 PV, cierra hemorragias y baja un nivel su herida más grave; una vez por asalto, sin acción ni untarla). No sirve con no-muertos ni criaturas sin sangre.
- Cadenas (cadenas): ataca con las cadenas a hasta 6 m para atar a un enemigo (queda agarrado, velocidad 0) o para atraerlo hasta su alcance y compensar la falta de arma larga. Prueba enfrentada de Atletismo; no se mueve a criaturas mucho mayores que él.
- Paso elusivo (nivel 5, reacción): con paso_elusivo declara que se aparta del siguiente ataque; si su Acrobacias (1d20 + DES + competencia) iguala o supera el total del ataque, falla. Con el dolor al máximo (nivel 4) es una esquiva automática: se hace sola, no falla nunca y solo gasta su reacción (una por asalto, la misma que Devolver el dolor).
- Golpe aturdidor (nivel 5, 1 uso por descanso corto): CON CD 8 + competencia + SAB o el objetivo queda aturdido hasta el final de su próximo turno.`;
