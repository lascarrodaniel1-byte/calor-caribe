// Equilibrio de niveles: todo lo que se DESBLOQUEA (habilidades, movimientos, tipos de magia, ascensos de poder) llega
// DOS niveles más tarde de lo que dicen las tablas base; los aumentos de característica (4, 8, 12, 16, 19) no se tocan.
// Todo el motor consulta los umbrales con nvl(): cambiar DESPLAZO_RASGOS reequilibra la partida entera.
// (VELMORA_DESPLAZO=0 en el entorno desactiva el desplazamiento: así las pruebas de las mecánicas de cada rasgo usan las tablas base.)
export const DESPLAZO_RASGOS: number = typeof process !== "undefined" && process.env?.VELMORA_DESPLAZO !== undefined ? Number(process.env.VELMORA_DESPLAZO) : 2;
const TOPE = 20;

/** Nivel real en el que se desbloquea lo que la tabla base pone en el nivel `n` (el nivel 1 no se desplaza). */
export const nvl = (n: number): number => (n <= 1 ? n : Math.min(TOPE, n + DESPLAZO_RASGOS));

/** EXCEPCIÓN deliberada al desplazamiento: el Ataque adicional llega en el nivel real 5 (no en nvl(5) = 7). Sin él, los niveles 5-6 son un valle muy duro y el 7 un acantilado (docs/BALANCE.md). */
export const NIVEL_ATAQUE_ADICIONAL = 5;
