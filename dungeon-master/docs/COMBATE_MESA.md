# Combate: la mesa sigue la iniciativa

## Cómo se unen los dos relojes
- **Fuera de combate o en modo «libre»**: nada cambia. La mesa va por rondas de jugadores (`Orden.ronda`, orden de llegada).
- **En combate y en modo «turnos»** (`partida.combate` activo y más de un jugador conectado): el orden de la mesa es `combate.orden` (mayor iniciativa primero). La **ronda de la mesa** (`Orden.ronda`) y el **asalto** del motor (`combate.ronda`) son contadores distintos: en combate la ronda de la mesa no avanza, y al terminar el combate se retoma el orden normal donde estaba.
- Un combate que empieza a mitad de un turno (el DM llama a `iniciativa` mientras narra) rige desde el turno **siguiente**; `terminar_combate` devuelve el orden normal. Un combate nuevo con otro en curso sustituye al anterior (el asalto vuelve a 1).

## Quién resuelve qué (`src/turnos.ts`)
`ordenDeCombate(partida, presentes, controles)` devuelve las entradas `{nombre, tipo: pj|enemigo|pnj, jugador?, tocaAlDM, motivo?, estado?}`:
- **Jugador humano** (`tocaAlDM: false`): PJ vivo y consciente cuyo dueño está presente, o que lleva otro jugador por control prestado.
- **El DM** (`tocaAlDM: true`): criaturas y PNJ; PJ de jugadores ausentes (los lleva el DM); PJ a 0 PV (salvación contra muerte) o incapacitados (paralizado, aturdido, inconsciente…); sorprendidos, solo en el asalto 1.
- Se omiten los muertos y las criaturas o PNJ caídos o que ya no están en `combate.orden`.

`siguienteEnCombate(partida, presentes, controles, actuante, entrada?)` da el siguiente jugador humano, los turnos del DM entre ambos (`resolverAntes`) y `cierraAsalto`. Si no queda otro humano, la palabra vuelve al propio actuante (y el DM resuelve a todos). Un jugador que lleva dos personajes actúa dos veces (`Orden.entrada` dice con cuál). Si el actuante no está en la iniciativa (p. ej. aún crea su personaje) devuelve `null` y rige el orden normal.

## Lo que ve el DM
`bloqueTurnos` con `InfoTurno.combate` escribe «# TURNOS DE COMBATE»: orden del asalto (quien actúa en negrita), 1) narra solo su acción, 2) resuelve en este mensaje, en orden, los turnos de `resolverAntes` (una acción cada uno; el motor rechaza el exceso), 3) da la palabra al siguiente jugador y no resuelvas a los que van después. Sin combate el texto es el de siempre; quien crea su personaje no recibe el bloque de combate. Los ausentes y el control prestado siguen explicándose en `bloqueAusentes`.

## Avance del asalto
Cuando `cierraAsalto` es verdadero la página llama a `cerrarAsalto(partida, asaltoDeInicio)` (`src/herramientas.ts`) tras narrar y antes de dar la palabra, dentro del mismo guardado atómico del turno. Solo avanza si el combate es el mismo (identidad del objeto) y sigue en ese asalto: **idempotente** frente a un `siguiente_asalto` del DM. Caso especial: si tras el cierre aún hay enemigos del asalto siguiente por resolver (los que abren la ronda, antes del primer jugador), el bloque pide al DM que llame él a `siguiente_asalto` en medio, para que esos enemigos actúen con su acción renovada. El texto con las condiciones activas se guarda en `combate.avisoAsalto`, entra en `estadoParaDM` del turno siguiente y se borra al leerse.

## Barra de turnos y botones
La barra pinta la iniciativa (`Asalto N`, jugadores como fichas con «tú», criaturas/PNJ apagados con ileso/herido/malherido, ☠/💤) con scroll horizontal propio. «Pasar turno» y «Saltar turno» (jugador desconectado con el turno) en combate encolan un turno sin acción que el DM narra, para que los enemigos intermedios actúen. `mesa/orden` solo añade `entrada`.

## Cómo se prueba
`npx tsx tests/motor/t-iniciativa-mesa.ts` (lógica pura, edge cases, `bloqueTurnos`, `cerrarAsalto`) y `node tests/ui/combate.mjs [carpeta]` (navegador: barra, bloque que recibe el DM, palabra al jugador correcto, avance del asalto sin duplicarse, 390 px). Ambos están en `npm test` y `npm run test:ui`.
