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

## Decisiones confirmadas por el dueño
Sin cambios: la lista de iniciativa visible en móvil con scroll horizontal; «Pasar/Saltar turno» en combate genera una acción narrada por el DM; con un único humano en la mesa el DM resuelve a todos y la palabra vuelve a ese jugador.

## Acciones programadas y reacciones preparadas
**Flujo.** Con la mesa en modo «turnos» (en combate y fuera), un jugador sentado y con personaje que escribe fuera de su turno **programa** su acción: el botón pasa a «Programar para mi turno», el texto sale de la caja y aparece la ficha «⏳ Programada: «…» [Editar] [Cancelar]». Hay una sola por jugador: programar otra sustituye a la anterior; Editar devuelve el texto a la caja (si la caja está ocupada no pisa nada); Cancelar la quita. Los comandos (`/razas`, `/ayuda`…) se ejecutan como siempre; el texto vacío o de más de `MAX_ACCION` (2000) no se programa. Con modo «libre», un jugador solo, quien aún crea su personaje o quien no está sentado, el comportamiento es el de siempre (no hay botón de programar).

**Almacenamiento.** Un documento por jugador, `programadas/<idJugador>`: `{ texto, reaccion?, ts, ronda, asalto?, reaccionAsalto?, jid, nombre }`. Lo leen todas las pestañas (suscripción y lectura en `sincronizar`). La lógica pura vive en `src/turnos.ts`: `programarAccion`, `caducada`, `reaccionVigente`, `debeEntregarse`, `restoTrasEntregar`, `jugadorCaido`, `idsConProgramada`, `lineaAccion`, `textoReaccionesPreparadas`, `textoCuentaAtras`.

**Entrega.** Quien narra (el que tiene el «lease» y procesa la cola) decide en el guardado de cada turno, justo después de saber a quién da la palabra: si ese jugador tiene una programada que `debeEntregarse`, añade al `pendiente` del punto de confirmación un campo `programada` con la acción (`acciones/prog_<jugador>_<ts>`, `programada: true`) y qué queda del documento (nada, o solo la reacción). `completarPendiente` la escribe junto al resto (turno, orden, borrado de la cola); si algo falla, lo completa el siguiente al sincronizar. El id es el mismo la entregue quien la entregue, y los turnos guardan los ids que consumieron, así que repetirla no la duplica ni la vuelve a narrar. El bucle de narración recoge la acción en la vuelta siguiente, de modo que el turno del jugador se narra sin que nadie pulse nada.
- **Jugador desconectado:** si tiene una programada por ejecutar cuenta como presente (`siguiente`, `puedeSaltar` y `presentesAhora` reciben sus ids): no se salta su turno y su acción se ejecuta. Sin programada, todo sigue igual (se salta o lo lleva el DM).
- **Entrega tardía** (red de seguridad): si le toca a alguien y su programada sigue sin entregar (guardado cortado, o la escribió con la palabra ya en camino), la entrega su propia página a los 4 s o, si es otro, cualquier página a los 15 s (5 s si está desconectado), con el mismo id.
- **Enviar con una programada pendiente:** si ya está en la cola, se avisa y no se envía otra; si no, la que escribe ahora sustituye a la programada y se avisa.
- **Al DM** llega como «Ana (acción preparada antes, de cuando aún no era su turno): …» y el bloque de turnos añade la regla «Una acción preparada es una intención de antes: si la situación ha cambiado y ya no es posible o no tiene sentido, no la ejecutes; cuéntale qué cambió y deja que elija otra.» (solo en ese turno; sin programadas el bloque es idéntico al de siempre).

**Caducidad y casos límite.**
- Caduca si el combate acaba, si empieza otro (el asalto vuelve a 1) o si pasan más de 2 rondas **de mesa**; si se programó **en combate** (donde la ronda de la mesa no avanza) se cuentan asaltos del motor. Una programada de antes de que empezase un combate también caduca (ya es otra situación), y una de más de 12 horas (sesión abandonada). El aviso «Tu acción programada caducó» lo da la página de su dueño al limpiar su documento.
- Se descarta (y no se ejecuta) si su personaje está muerto, a 0 PV o incapacitado: ese turno lo resuelve el DM. Con dos personajes (control prestado) se mira el de la entrada que recibe la palabra.
- **Corregir al DM:** el turno deshecho devuelve su acción a la cola con la marca (`programada`) y las programadas ajenas ni se pierden ni se duplican (la ya entregada está en la cola con su id; el documento ya no existe).
- **Control prestado:** una programada por jugador, no por personaje; se ejecuta con la primera entrada que reciba la palabra.
- Reiniciar o importar la partida borra también `programadas`.

**Reacción preparada.** En combate el mismo cuadro ofrece un campo de una línea (≤ 140 caracteres): se guarda en la misma programada (`reaccion`) y **dura todo el combate** (no se consume al enviar la acción); se cambia o se quita cuando se quiera y desaparece al acabar el combate. `bloqueTurnos` (rama de combate) añade «Reacciones preparadas: Ana: «…»; Beto: «…»» (≤ ~300 caracteres) solo de quienes tienen un personaje vivo y consciente con la reacción libre este asalto (`combate.turnos`), más la regla de aplicarla con las herramientas existentes (`reaccion`, o `atacar` con `reaccion: true`) y contarlo. El motor ya limita a una reacción por asalto y no cambia.

**Aviso de turno y cuenta atrás.** Si le llega el turno a un jugador con la pestaña en segundo plano, el título alterna cada 2 s «⚔ ¡Tu turno! — Mesa de Velmora» y el normal hasta volver o enviar (sin sonidos ni permisos). Bajo «Turno de X», una línea discreta: «Eres el siguiente tras X» / «Faltan N turnos para ti» (en combate se cuentan también los turnos de criaturas y PNJ).

## Cómo se prueba
`npx tsx tests/motor/t-iniciativa-mesa.ts` (lógica pura, edge cases, `bloqueTurnos`, `cerrarAsalto`) y `node tests/ui/combate.mjs [carpeta]` (navegador: barra, bloque que recibe el DM, palabra al jugador correcto, avance del asalto sin duplicarse, 390 px). Ambos están en `npm test` y `npm run test:ui`. Programadas y reacciones: `npx tsx tests/motor/t-programadas.ts` (lógica pura y bloque) y `node tests/ui/programada.mjs [carpeta]` (navegador: ficha, entrega con la marca, desconectado, sin duplicados, modo libre, reacción, caducidad, título, 390 px).
