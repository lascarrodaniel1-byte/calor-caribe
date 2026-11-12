# Auditoría de integración (punto 79 del README)

**Encargo.** Revisar qué puede estar roto, qué se puede optimizar y vincular todo lo añadido en esta tanda (velocidad por asalto, artes marciales, agua, guardas de cita, estaciones y clima, economía de acciones, mesa por iniciativa, programadas y reacciones preparadas, género, competencia) con lo que ya había. Arreglado lo claramente roto y de bajo riesgo; lo ambiguo, abajo, sin tocar. Pruebas: `tests/motor/t-integracion.ts`, `tests/auditoria/partida-completa.ts` y `tests/ui/mesa-completa.mjs`.

## Hallazgos

| # | Severidad | Hallazgo | Estado |
|---|---|---|---|
| 1 | **ALTA** | **Un PJ podía atacar como reacción sin límite**: `atacar {reaccion: true}` no comprobaba ni gastaba la reacción del PJ (sí la de criaturas y PNJ). La regla de la reacción preparada manda justo eso al DM («`atacar` con `reaccion: true`»), así que cada reacción preparada era ilimitada y no impedía además usar `reaccion`. Reproducido con una prueba: tres ataques de reacción seguidos y luego `reaccion` aún libre. | **Arreglado** (`exigirAccionDisponible`/`atacar`, `src/combate.ts`): un ataque de reacción de un PJ marca su reacción y solo se permite uno por asalto (dos con la Contracorriente en remolino, como las criaturas). El seguimiento legítimo de `reaccion {ataque_oportunidad}` sin `dano`, o del Contragolpe/Contracorriente automáticos, sigue permitido. |
| 2 | **MEDIA** | Contradicción de prompt: `COMBATE` decía «Cada asalto: siguiente_asalto» y dos líneas después «el programa avanza el asalto»; `REGLAS_COMBATE` (CLI y `consultar_reglas`) decía «Al empezar cada asalto nuevo, siguiente_asalto» mientras el bloque «TURNOS DE COMBATE» ordena «NO llames a siguiente_asalto». | **Arreglado**: una sola instrucción («Asalto nuevo: siguiente_asalto, salvo que «TURNOS DE COMBATE» diga que lo avanza el programa»). En modo libre y en el CLI el DM lo sigue llamando. Ver `docs/AUDITORIA_PROMPT.md`. |
| 3 | **MEDIA** | Las criaturas que sobreviven a un combate (huyeron, se perdonaron…) se quedaban para siempre en `partida.jefes` (~2,2 KB cada una, ficha completa) **y** el estado del DM las lista enteras en cada turno («Criaturas en escena»). No hay herramienta para retirarlas. Con 12 combates de 5 criaturas el estado pasaba de 5 KB a 97 KB (67 KB de criaturas). | **Arreglado con tope (confirmado por el dueño)**: `limpiarTrasCombate` conserva como mucho 24 (`MAX_CRIATURAS_FUERA`); caen primero las más antiguas de peligro 3 o menos (devuelven lo robado). Prueba en `t-integracion`. Propuesta de fondo abajo (herramienta para retirar criaturas). |
| 4 | **BAJA** | Pruebas de UI: una espera fija de 7 s en `flujo.mjs`. | **Arreglado** (espera por condición; −7 s). |
| 5 | **BAJA** | Reglas de prompt: contraejemplo de RUMBOS perdido en un recorte («no mandes al norte a quien ya está al norte de su destino»). | **Restaurado** (+57 caracteres). |
| 6 | BAJA | `consumo/`, `repasos/`, `errores/`, `correcciones/` son colecciones sueltas; solo `consumo/` se recorta (a ~200). No pesan en `mesa/estado`. | Pendiente (ver propuestas). |
| 7 | BAJA | ~30 copias del mismo `norm`/`sinTildes` de una línea repartidas por `src/` (`ayuda`, `barbero`, `clima`, `turnos`, `herramientas`…). | Pendiente: ganancia de bytes despreciable (< 3 KB) frente a tocar 30 ficheros. |

No se encontraron fallos en: guardas de cita con programadas y con varias acciones, velocidad/cierre de asalto, activación del calendario a mitad de partida, exportar/importar, listeners de la página (todos se registran una vez: asignaciones `.onclick`/`onsubmit` y `suscribir` único por colección; el repintado está agrupado en un `requestAnimationFrame`).

## Matriz de cruces (ok / arreglado / pendiente)

| | Guardas de cita | Programadas | Iniciativa de mesa | Velocidad | Economía/reacciones | Artes | Agua | Clima/estaciones | Género/ficha | Exportar/importar |
|---|---|---|---|---|---|---|---|---|---|---|
| **Guardas de cita** | — | ok¹ | ok² | – | – | – | – | ok³ | – | ok |
| **Programadas** | ok¹ | — | ok | – | arreglado⁴ | – | – | – | – | ok |
| **Iniciativa de mesa** | ok² | ok | — | ok⁵ | ok | – | – | – | – | ok |
| **Velocidad por asalto** | – | – | ok⁵ | — | ok | – | ok⁶ | ok⁷ | – | – |
| **Economía/reacciones** | – | arreglado⁴ | ok | ok | — | ok⁸ | – | – | – | – |
| **Artes marciales** | – | – | – | – | ok⁸ | — | – | – | ok | ok |
| **Agua** | – | – | – | ok⁶ | – | – | — | ok⁹ | – | – |
| **Clima/estaciones** | ok³ | – | – | ok⁷ | – | – | ok⁹ | — | ok | ok¹⁰ |

1. La acción programada entra en la cola con su texto: la página fija «Nombre: texto» (la marca «acción preparada antes» solo la añade `lineaAccion` para el DM y no cuenta como cita). Una cita de la programada vale para `infligir_herida`, `pasar_tiempo`, `viajar`…
2. Con varias acciones resueltas en una respuesta (jugador y enemigos intercalados) nada se rechaza: en combate `infligir_herida` no pide cita y al terminarlo en el mismo turno la guarda vuelve.
3. `clima {anomalia}` exige cita (con contexto) y la prueba de `partida-completa` la cumple.
4. **Arreglado** (hallazgo 1): la reacción preparada del PJ se gasta una sola vez.
5. `movido` se reinicia en `siguienteAsalto` y por tanto en el cierre automático; los enemigos resueltos en bloque mueven cada uno lo suyo y los que abren el asalto siguiente lo hacen tras el `siguiente_asalto` del DM.
6. Mitad por el agua y doble al correr combinan; el Tritón y los acuáticos nadan a su velocidad (ya cubierto por `t-vel`/`t-agua`).
7. La nieve y la ventisca solo cambian los km del viaje, no la velocidad de combate (por diseño).
8. Contragolpe, Contracorriente (remolino) y Muralla gastan la reacción del programa; `reaccionAtaques` cuenta aparte el ataque de respuesta.
9. La lluvia y el Tritón: sin sed y sin piel reseca solo al aire libre; sumergido cuenta como cubierto.
10. `calendario` (con anomalías), `genero`, `artes`, `sustento` y `combate` sobreviven idénticos al ciclo exportar → reiniciar → importar (`mesa-completa.mjs` y `t-integracion`). `programadas` se borra al reiniciar y al importar (como estaba documentado); `consumo/` no se exporta ni se borra (es estadística de uso).

**Calendario activado a mitad de una partida** (la página lo hace en el primer turno): los acumuladores `extraSed`/`extraHambre` no existen hasta la primera revisión y `acumularClima` solo cuenta desde `vistoClima`; no hay saltos de sed ni hambre (prueba en `t-integracion` con un Tritón y 5 h de reloj). No hizo falta intervenir.

## Mediciones antes / después

| Medida | Antes | Después |
|---|---|---|
| Prompt completo (caracteres) | 66.796 (umbral 66.800) | 66.888 (umbral **67.600**) |
| Prompt típico (caracteres) | 45.642 (umbral 49.285) | 45.734 (umbral **49.880**) |
| Estado guardado tras 12 combates × 5 criaturas, 4 PJ, calendario y anomalía | 96.760 B | acotado: `jefes` ≤ 24 (~54 KB como mucho por criaturas) |
| Estado de una partida completa simulada (`partida-completa`) | – | 16-18 KB (alarma 800 KB) |
| Página construida | 1.595.053 B (1.557 KB) | 1.597.307 B (+2,2 KB: tutorial) |
| `web/artifact.template.html` | 221.754 B | 223.380 B |
| Arranque de la página (mock, Chromium) | – | ~1,0-1,7 s |
| Repintar tras un snapshot de estado (4 jugadores, 12 turnos, 8 combatientes, 996 nodos) | – | mediana 17 ms, máx. 24 ms |
| `npm test` (motor + auditoría + soak) | 18,2 s, 26 casos | ~20 s, 28 casos |
| `npm run test:ui` | 4 min 15 s, 9 scripts | 5 min 24 s, 10 scripts (`mesa-completa` 77 s; `flujo` −7 s) |
| Simulador de equilibrio `--n 40 --rapido` | referencia | misma salida (solo cambia la línea del tiempo total: 5 s → 4 s) |

**Página.** 1,60 MB = motor minificado 1,33 MB (zod 453 KB sin recortar el idioma en esta medición; `herramientas` 105 KB, `bestiario` 96 KB, `combate` 46 KB, `magia` 44 KB…) + plantilla 223 KB + mapa en base64 307 KB. Buscadas las 3.427 cadenas largas del bundle: solo 7 están repetidas y suman 0,8 KB; **no hay datos de clima, estilos o bestiario duplicados**. No se reduce nada: sin riesgo no hay ganancia apreciable.

## Coste del DM por turno (`npx tsx tests/auditoria/entrada-dm.ts`; tokens ≈ caracteres / 4)

| Escenario | Estado del DM | Bloque de turnos + acciones | Variable total | Con el prompt fijo (53.569 car., 13.392 tok, con estilos) |
|---|---|---|---|---|
| 1. Exploración, 4 PJ | 5.773 car. ≈ 1.443 tok | 517 ≈ 129 | 6.290 ≈ 1.573 tok | 59.859 ≈ 14.965 tok |
| 2. Combate por iniciativa, 4 PJ + 5 enemigos (clima, estilos, reacciones) | 11.892 ≈ 2.973 | 451 ≈ 113 | 12.343 ≈ 3.086 | 65.912 ≈ 16.478 |
| 3. Combate con una acción programada | 11.641 ≈ 2.910 | 991 ≈ 248 | 12.632 ≈ 3.158 | 66.201 ≈ 16.550 |

Lo fijo (prompt) es el 80-90 % de cada llamada; el historial reciente (hasta 24 turnos) y el diario se suman a esto. Partes más gruesas del estado: «Criaturas en escena» 4.431 car. con 5 criaturas (~900 cada ficha, con su descripción literaria), la ficha completa del actuante (~1.340), el plano (930), el mapa (704), la fase de introducción (689), el tablero (597) y los rasgos que aplica el motor (500). La programada añade ~540 car. al bloque (la acción más su regla) y solo en ese turno.

**Recortes seguros aplicados:** el tope de criaturas supervivientes (hallazgo 3; evita que el bloque de criaturas crezca sin límite turno a turno). Ningún otro: lo demás es información que el DM necesita, y comprimir el bloque «Asalto N» (la lista «faltan» repite el orden de iniciativa, unos 100-150 car.) rompería el formato que fijan las pruebas de `t-economia` por una ganancia del 1 %.

**Propuesta 2a, aplicada (confirmada por el dueño):** la ficha de cada criatura en escena (`EstadoJefe.descritaEn`, asalto de aparición; 0 sin combate) lleva la descripción literaria solo sin combate o en el asalto en que aparece; después se omite y una sola línea al final del bloque remite a `consultar_reglas {tema: "criatura", nombre}`, que sigue devolviendo la ficha completa. Partidas antiguas sin el campo: se tratan como ya descritas. Todo lo demás (CA, PV/estado, ataques, rasgos, habilidades, temple, regente…), el repaso y el bestiario del grupo (códice) quedan idénticos; sin combate no cambia nada. Medición (`entrada-dm.ts`, escenario 2, 5 criaturas ya presentes antes de la iniciativa): bloque «Criaturas en escena» **4.431 → 3.910 car.** (−521, incluida la nota de 69) en el asalto 1 y en el asalto 2; estado del DM 11.894 → 11.372 car. (≈ 2.974 → 2.843 tok); escenario 3, 11.643 → 11.121. Una criatura que entra a mitad de combate conserva su prosa durante ese asalto. Prueba: `tests/motor/t-descripciones.ts`.

**Propuestas (b y c, no aplicadas):** (b) llevar «Regentes» y «Fronteras de los regentes» (~800 car. fijos en cada turno) a una línea con remisión a `consultar_reglas`; (c) herramienta `retirar_criatura {nombre}` (o purga de las que huyen al `terminar_combate`) para que el DM descarte las supervivientes que ya no están. Coste: pequeño cada una (< 1 h); (b) cambia lo que ve el DM, por eso queda a decisión del dueño.

## Rendimiento de las suites

`npm test` tarda ~20 s y no necesita cambios. `test:ui`: `programada.mjs` (111 s) está dominada por las esperas reales de la entrega tardía (4 s/15 s del propio producto) y 36 `waitForTimeout` de 0,3-2,3 s; `flujo.mjs` (48 s) por el repaso colgado de 40 s que comprueba a propósito. Se cambió la única espera fija larga evitable (7 s). Propuesta: parametrizar los temporizadores de entrega tardía con una variable de la página para tests (-60 s en `programada`), a decidir por el riesgo de abrir un ajuste de producción.

## Qué queda pendiente (diseño o riesgo)

1. **Retirar criaturas** (propuesta c): hoy solo la muerte las saca de `jefes`; el tope de 24 es una red de seguridad, no el diseño final.
2. **Limpieza de colecciones** `errores/`, `repasos/`, `correcciones/` (sin tope): son pequeñas (< 1 KB por documento) y ajenas al estado, pero crecen para siempre.
3. **PJ que ataca como reacción tras gastar la reacción por el programa** (esquiva automática, Danza marchita): no distingue el motivo y deja un ataque de reacción más; es el mismo hueco que ya tenían criaturas y PNJ y no se cierra sin separar reacción gastada de ataque de reacción disponible.
4. **`/ayuda`** es compartido con la terminal y el servidor: no se ha añadido el texto de turnos y programadas porque allí no existen; la explicación vive en «Cómo jugar» de la página.
5. Decisiones del dueño: el tope de 24 criaturas supervivientes queda **confirmado** (la herramienta `retirar_criatura` sigue como mejora futura) y el hueco residual de la reacción (punto 3) queda **aceptado**.
