// Equilibrio de niveles: todo lo que se DESBLOQUEA (habilidades, movimientos, tipos de magia, ascensos de poder) llega
// DOS niveles más tarde de lo que dicen las tablas base; los aumentos de característica (4, 8, 12, 16, 19) no se tocan.
// Todo el motor consulta los umbrales con nvl(): cambiar DESPLAZO_RASGOS reequilibra la partida entera.
// (VELMORA_DESPLAZO=0 en el entorno desactiva el desplazamiento: así las pruebas de las mecánicas de cada rasgo usan las tablas base.)
export const DESPLAZO_RASGOS: number = typeof process !== "undefined" && process.env?.VELMORA_DESPLAZO !== undefined ? Number(process.env.VELMORA_DESPLAZO) : 2;
const TOPE = 20;

/** Nivel real en el que se desbloquea lo que la tabla base pone en el nivel `n` (el nivel 1 no se desplaza). */
export const nvl = (n: number): number => (n <= 1 ? n : Math.min(TOPE, n + DESPLAZO_RASGOS));

// EXCEPCIONES deliberadas al desplazamiento (docs/BALANCE.md): rasgos de combate que llegan en un nivel REAL fijo, no en nvl(n).
// Sin ellas, los niveles 3-4 eran un valle (peligro 4: 12-20 % de victorias; jefe: 0-5 %) y el 5-6 un tirón; con ellas es una rampa.

/** El Ataque adicional llega en el nivel real 4 (la tabla base lo pone en el 5 y el +2 en el 7; antes llegaba en el 5). */
export const NIVEL_ATAQUE_ADICIONAL = 4;
/** La Presa marcada del Cazador de Brujas (+1d8 contra una criatura herida) llega en el nivel real 3 (base 3, sin desplazar; antes en el 5). */
export const NIVEL_PRESA_MARCADA = 3;
/** El Veterano de compañía del Mercenario (crítico con 19-20) llega en el nivel real 3 (base 3, sin desplazar; antes en el 5). */
export const NIVEL_VETERANO = 3;
