# Pruebas de la Mesa de Velmora

Todo se ejecuta desde `dungeon-master/`. No hay dependencias nuevas: motor y auditorías usan `tsx`; las pruebas de navegador usan Playwright, que **no** es dependencia del proyecto (se toma del entorno).

## Cómo ejecutarlas

| Comando | Qué hace |
|---|---|
| `npm test` | Suites del motor + auditoría + fuzz + soak (semillas 1, 2 y 3, y la 4 con calendario). Tabla final; código de salida 1 si algo falla. `node tests/ejecutar-motor.mjs <texto>` ejecuta solo los casos cuyo nombre contenga el texto. |
| `npm run test:ui` | Construye la página en un directorio temporal y lanza en serie los scripts de navegador (150 s de límite cada uno). Falla si un script sale con error o imprime `errores de página: N` / `errores: N` con N > 0. Sin Playwright: aviso y código 0. |
| `npm run audit` | Coherencia de datos (herramientas, razas, criaturas, encuentros, estilos, numeración del README). Debe acabar en «sin problemas». |
| `npm run fuzz` | 860 llamadas a las herramientas con entradas incompletas. Debe dar 0 problemas. |
| `npm run soak -- <semilla>` | Simulación de partidas con semilla. Debe dar 0 problemas. |
| `npm run dead-exports` | Lista exports de `src/` que nadie usa (informativo, no falla). |

## Estructura

- `tests/motor/` — suites `t-*.ts`. Cada una termina con `N ok, M fallas`; el runner lee la **última** línea con ese formato.
  - `t-regresion` — regresiones generales (niveles, saber, repaso, mapa, rasgos de clase, dados fijos).
  - `t-codice` — Códice y bestiario del grupo (descubrir criaturas).
  - `t-rampa` — rampa de los niveles 3-4: tope firme de peligro del sorteo de encuentros por nivel medio y jefes en persona solo desde el nivel 7 (dados fijos).
  - `t-bestiario` — fichas del bestiario, temples, piezas de armadura, condiciones y temas de saber.
  - `t-tragado` — Tragar de verdad (Bakunawa): estado «tragado», daño eléctrico al abrirse el asalto, límite de 1, cobertura total, las cuatro vías de escape (daño desde dentro, presión de fuera, Atletismo/Acrobacias, retirada y muerte), y «solo en el mar» (filtro del encuentro, aparecer_criatura, velocidad y ficha) (dados fijos).
  - `t-furia-resistencia` — la Furia resiste el daño físico (corte/cortante, punta/perforante, contundente) en habilidades de criaturas, trampas, caída, tragado, `modificar_personaje` y `atacar` (una sola mitad, tras la armadura); sin acumular con la racial; el radiante del Castigo y lo no físico no se resisten (dados fijos).
  - `t-monstruos` — conjuros y ataques de monstruos, PX y consulta de reglas.
  - `t-control` — control de personajes ausentes (quién lleva a quién) y bloque de turnos.
  - `t-triton` — raza Tritón, plantillas de encuentro, resistencias y rasgos automáticos.
  - `t-genero` — género del personaje en ficha, formulario y prompt del DM.
  - `t-agua` — movimiento, aire y penalizaciones en el agua.
  - `t-don` — Don Arcano y competencias recordadas en las tiradas.
  - `t-artes` — artes marciales: estilos, principios y técnicas automáticas.
  - `t-clima` — estaciones y clima por región: calendario, climaDe determinista, sed, hambre y viaje, encuentros por estación, luz, avisos, anomalías (larga, intensa, ambas, guardas), adaptación por raza y clase, Tritones y la lluvia, y que sin `calendario` todo es neutro.
  - `t-vel` — velocidad por raza y de las 46 criaturas (incluidos los voladores).
  - `t-economia` — economía de acciones por asalto de criaturas y PNJ: ataques de la ficha, habilidad, reacción, acciones legendarias, `ataques_por_asalto` y bloque «quién ha actuado» del DM (dados fijos).
  - `t-iniciativa-mesa` — la mesa sigue la iniciativa en combate: `ordenDeCombate`, `siguienteEnCombate` (único humano, un enemigo, enemigo caído, ausentes, control prestado, caídos, sorprendidos), `bloqueTurnos` con y sin combate y `cerrarAsalto` idempotente (dados fijos).
  - `t-mesa-libres` — jugadores que no están en la iniciativa: `pasarPalabra` (único combatiente, dos combatientes, todos, jugador libre desconectado, combate sin rivales vivos) y vuelta a la rotación normal al acabar el combate (sin saltar ni repetir), y la nota al DM (`fueraDelCombate`).
  - `t-programadas` — acciones programadas y reacciones preparadas: `programarAccion`, `caducada`, `debeEntregarse`, `restoTrasEntregar`, `jugadorCaido`, jugador desconectado con programada (`siguiente`, `puedeSaltar`, combate), `textoReaccionesPreparadas`, `lineaAccion`, cuenta atrás y el bloque de turnos (idéntico sin programadas), `estadoReaccion` y `motivoReaccionNoVigente` (la nota «no vigente: …» del campo de reacción).
  - `t-integracion` — auditoría de integración: guardas de cita con programadas y varias acciones, velocidad y cierre de asalto, reacciones de PJ y criaturas, calendario activado a mitad de partida, exportar/importar y tope de criaturas supervivientes.
  - `t-limpieza-relato` — `limpiarNarracion` (quita del relato los resultados del motor copiados por el modelo: ejemplo real, marcador con variaciones, avisos al final, texto normal intacto, idempotencia) y `armarHistorial` (los mensajes `assistant` solo llevan narración; los resultados van en mensajes `user` marcados, con recortes y roles alternos).
  - `t-avisos-ataque` — avisos de ataque en pantalla con la tirada (d20, bonificador, total, ventaja/desventaja, crítico/torpeza) y la de daño con su tipo, sin CA ni PV de las criaturas; ataques múltiples, reacciones, ataque de oportunidad y que `limpiarNarracion` siga quitando la línea copiada al relato (dados fijos).
  - `t-descripciones` — la descripción literaria de las criaturas en escena solo se da al DM sin combate o en el asalto de aparición (`descritaEn`); nota de dónde recuperarla, consulta explícita completa, partidas antiguas y códice de los jugadores sin cambios.
  - `t-enc2.ts`, `t-enc-wen.ts` — **no entran en `npm test`**: son sondeos estadísticos de la tabla de encuentros con dados reales (250–400 encuentros) que imprimen conteos, no «N ok, M fallas». Se ejecutan a mano: `VELMORA_DESPLAZO=0 npx tsx tests/motor/t-enc2.ts`.
- `tests/auditoria/` — `auditoria.ts`, `fuzz.ts`, `soak.ts`, `cobertura.ts` (técnicas de artes marciales: 21 de 21), `partida-completa.ts <semilla>` (partida de varias sesiones a nivel de motor con el contexto de turno activado: calendario, viaje con cita, combate por iniciativa con jefe, PNJ, programadas y reacciones, agua, descanso y subida de nivel, con invariantes en cada paso; está en `npm test` con la semilla 11), `entrada-dm.ts` (coste del DM por turno en tres escenarios; informativo), `migra.ts` (carga partidas antiguas de `tests/fixtures`, o las que se pasen como argumento), `tam.ts` (tamaño del estado del DM), `exportsMuertos.mjs`.
- `tests/ui/` — scripts de Playwright (`flujo`, `bestiario`, `run`, `control`, `genero`, `sinnarracion`, `clima`, `combate`, `combate-libres` (tres jugadores, uno solo en la iniciativa: los demás juegan su turno y, al acabar el combate, vuelve la rotación normal), `programada`, `reaccion-preparada` (el narrador lee `programadas` fresco aunque su caché esté vieja y el campo de reacción explica por qué no vale: ya gastada, fuera de la iniciativa), `mesa-completa`, `relato-limpio` (el relato no muestra el bloque del motor ni el historial lo repite al modelo), `avisos-ataque` (el aviso del ataque lleva la tirada y el relato copiado se limpia sin tocar los avisos), `barra-compacta` (la barra inferior no supera ~15 % de la pantalla en móvil ni 140 px en escritorio con todo visible; botones con zona táctil ≥ 40 px), `layout`), `mock.js` (simula `window.claude` y la base de datos en memoria; `orderBy("ts", "desc")` y `limit` se comportan como la base real), `_comun.mjs` (lanzamiento de Chromium y rutas), `construir.mjs` (construye la página con `scripts/construir-artifact.mjs`). `layout.mjs` saca capturas y no está en el runner. Cada script acepta como argumento la carpeta con `mesa-de-velmora.html`; sin él, la construye en `os.tmpdir()`. Las capturas y exportaciones se escriben en un directorio temporal.
- `tests/fixtures/` — partidas JSON de ejemplo; `generadores/mk-*.ts` las regeneran (`npx tsx tests/fixtures/generadores/mk-mesa.ts <salida.json>`).

## Variables de entorno

- `PLAYWRIGHT_MODULE` — ruta al módulo de Playwright. Por defecto `/opt/node-tools/node_modules/playwright/index.mjs`; si no existe, se importa `playwright`.
- `CHROMIUM_PATH` — ejecutable de Chromium. Por defecto `/opt/pw-browsers/chromium`; si no existe, Playwright usa el suyo.
- `VELMORA_SALIDA` — directorio base para capturas y exportaciones de las pruebas de UI (por defecto, el temporal del sistema).
- `VELMORA_DESPLAZO=0` — necesaria solo para las suites `t-enc*` a mano.

## Añadir una suite

1. Crea `tests/motor/t-<nombre>.ts`; importa con rutas relativas (`../../src/estado.ts`) y, para ficheros, usa `new URL("…", import.meta.url)` (nunca rutas absolutas).
2. Acaba con `console.log(`${ok} ok, ${mal} fallas`)`. El runner la detecta sola por el nombre `t-*.ts`.
3. Nada de azar sin control: si el resultado depende de un dado, fíjalo con `iniciarRegistroDados([...])` (o el ayudante `fijos` de `t-regresion`) y `liberarDados()` al terminar. Una prueba que falla «una de cada cinco» es un fallo de la prueba.
4. Para una prueba de navegador: crea `tests/ui/<nombre>.mjs` basada en las existentes (usa `_comun.mjs`), imprime `errores de página: N` al final y añádela a la lista `SCRIPTS` de `tests/ejecutar-ui.mjs`.
