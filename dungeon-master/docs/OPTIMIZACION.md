# Optimización del consumo del DM («usos» por turno)

**Encargo.** Que el DM use los menos usos posibles por turno sin perder calidad narrativa ni fiabilidad: los turnos siguen llamando a las herramientas del motor, no se baja el nivel del modelo de narración y no se quita ninguna herramienta.

**Conclusión corta.** El diseño ya estaba bastante afinado (repaso solo con pistas, resúmenes y repaso en «quick», fichas abreviadas por turnos, criaturas repetidas una sola vez, prompt recortado por clases y artes). La medición dice que **~83 % de lo que se envía en cada turno es el bloque fijo de instrucciones** y que las llamadas auxiliares (repaso, resúmenes) pesan menos del 5 % del coste ponderado. Se aplicó **un** cambio seguro con ganancia real (catálogo de acciones por clases de la mesa: −4,1 % de entrada por turno, sin cambiar el número de llamadas) y el resto se deja documentado como descartado o como **propuesta a confirmar**.

## 1. Método y supuestos

- Medido con el mock de la interfaz (`tests/ui/mock.js`, fixture `partida-mesa.json`) y un envoltorio de `sample` que clasifica cada llamada (narración, repaso, resumen, red de seguridad) y registra caracteres de entrada/salida. Scripts en el directorio de trabajo de la sesión (`…/scratchpad/optim/medir.mjs`, `resumen.mjs`, `f0-*.ts`); no se añaden al repositorio salvo la línea nueva de `tests/auditoria/entrada-dm.ts`.
- Escenarios (12 turnos cada uno, un jugador actuando, un compañero ausente llevado por el DM): **exploración** (pruebas cada dos turnos, 3 turnos con «pista» de repaso forzada), **diálogo** (solo narración), **combate** (Ogro + 2 Hambrientos, bloque de turnos de combate, `atacar` cada turno).
- Tokens ≈ caracteres / 4 (aproximación; el español real da algo más de tokens por carácter, pero la proporción entre partes se mantiene).
- Coste relativo por nivel: **quick : default : complex = 1 : 3 : 5** (supuesto: proporción de precios de los tres tamaños de modelo; el consumo real de cuota depende del plan y no se puede medir desde la página). El nivel por defecto de la página es «quick» y solo cambia si el dueño fija `mesa/config`.
- Limitación: el mock no reproduce las **rondas de herramientas** dentro de una llamada a `sample` (el modelo llama a `motor`, recibe resultados y sigue). Cada ronda reenvía el contexto (normalmente servido desde la caché de prompt del proveedor). Eso no se puede medir desde el cliente; por eso las cifras son «por ronda».

## 2. Dónde se iba el consumo (turno típico de exploración, turno 12; ordenado)

| # | Parte | Caracteres | ≈ tokens | % de la entrada |
|---|---|---:|---:|---:|
| 1 | `sistemaWeb()` de la mesa (reglas del DM; completo = 67.231 car. / 16.808 tok, el típico de esta mesa ≈ 48.300) | 48.300 | 12.100 | 49,5 % |
| 2 | Catálogo compacto de las 88 acciones (`catalogoCompacto`; firmas 15.481 + descripciones de una frase 13.294) | 29.035 | 7.260 | 29,8 % |
| 3 | `estadoParaDM` (explor. 9.475; combate con 3 criaturas 10.985; combate 5 criaturas ≈ 12.000) | 9.475 | 2.370 | 9,7 % |
| 4 | Historial viajando (≈ 9-12 mensajes: narración de los turnos aún sin resumir; los 4 últimos enteros) | 5.018 | 1.250 | 5,1 % |
| 5 | `INSTRUCCIONES_WEB` + `REGLAS_SECUENCIA` (cómo funciona la mesa) | 3.563 | 890 | 3,7 % |
| 6 | Control de ausentes («personajes llevados por el DM») | 956 | 240 | 1,0 % |
| 7 | Crónica + anales + situación + detalles (tras 12 turnos, con el mock) | 680 | 170 | 0,7 % |
| 8 | Frases ya usadas (hasta 30 × 140 car. en partidas largas) | 399 | 100 | 0,4 % |
| 9 | Acciones nuevas + bloque de turnos | 87-630 | 20-160 | <0,7 % |
| — | Esquema de herramienta realmente enviado (`motor`, una sola con enum de 90 nombres; **no** se envían los 88 esquemas JSON, que sumarían 94.730 car. ≈ 23.700 tok) | 1.648 | 412 | aparte |
| — | Salida de la narración (límite ~120 palabras por jugador) | ≈ 770 | ≈ 190 | aparte |

Total de entrada del turno 12 (antes): **97.550 car. ≈ 24.400 tok**; de ellos, el bloque fijo de instrucciones (filas 1, 2 y 5) es 80.921 car. (83 %).

### Llamadas a `sample` por turno (todas las rutas)

| Ruta | Dónde | Nivel | Cuándo | Entrada media | Notas |
|---|---|---|---|---:|---|
| Narración con herramientas | `narrarTurno` | `nivelAhora()` (mesa/local, por defecto «quick») | 1 por turno | 93.400 car. (≈ 23.400 tok) | varias rondas internas |
| Red de seguridad `promptNarrar` | tras narración vacía | el mismo nivel que la narración | solo si el texto sale < 15 car. | ≈ 10-12 K car. (sin instrucciones ni catálogo) | sin herramientas |
| Repaso | tras guardar | «quick» fijo (`repaso: true`) | solo si `pistasDeRepaso` ≠ vacío y la casilla está marcada | 10.300 car. (≈ 2.600 tok) | tope duro de 40 s |
| Resumen/compactación `compactarDiario` | segundo plano | «quick», `cache: false` | al pasar de 8 turnos sin resumir; resume todos menos 4 → 1 cada ~5 turnos | 7.600 car. (≈ 1.900 tok) | salida ≈ 500 car. |
| `fundirDetalles` | dentro de la compactación | «quick» | solo si hay > 120 detalles | pequeña | rara |
| `fundirAnales` | dentro de la compactación | «quick» | solo si los anales pasan de 9.000 car. | pequeña | rara |

Llamadas por turno medidas (12 turnos): diálogo **1,17** (12 narraciones + 2 resúmenes), combate **1,17**, exploración **1,42** (con 3 repasos forzados en 12 turnos: 25 % de turnos, caso desfavorable). Ninguna ruta auxiliar usa «default» ni «complex» por error: la red de seguridad usa el nivel de la narración a propósito (es la misma narración, no un trabajo auxiliar).

### Coste ponderado por turno (1 ronda, `quick`=1)

| Concepto | Tokens ponderados por turno |
|---|---:|
| Narración (entrada ≈ 23.400 + salida ≈ 190 ×~4 por ser salida) | ≈ 24.200 |
| Resumen amortizado (1.900 + 125×4) / ~5,5 turnos | ≈ 440 |
| Repaso (2.600 × tasa; 0-25 %) | 0 – 650 |
| **Narración como % del total** | **≈ 96-98 %** |

Con nivel «default» la narración pesa ×3 y las llamadas auxiliares (siempre «quick») bajan a ≈ 1 %: **todo el consumo es la narración, y dentro de ella el bloque fijo.**

## 3. Lo aplicado

### Bloque 1: catálogo de acciones según las clases de la mesa (`src/prompt-web.ts`, `web/artifact.template.html`, `tests/motor/t-catalogo-clases.ts`)

`sistemaWeb()` ya omitía las reglas de las clases que no están en la mesa (con una línea que remite a `consultar_reglas {tema: "clase"}`), pero el catálogo seguía describiendo las 88 acciones. Ahora `catalogoCompacto(clases?)` hace lo mismo con las **22 acciones exclusivas de clase** de seis clases (Flagelante, Barbero-Cirujano, Segador, Degollador, Cazador de Brujas, Caballero Juramentado; la descripción de cada una empieza por su clase): si la clase no está en la mesa, su línea (firma con enums + descripción) no va y sus nombres salen en una sola línea con el modo de leer el esquema (`consultar_reglas {tema: "accion", nombre}`). Siguen siempre las del Hechicero (la magia la puede despertar cualquiera), `estilo_combate`, `usar_recurso`, `arte_marcial`, y todas las generales.

- Misma regla de selección que `sistemaWeb` (`clasesEnMesa()`: con alguien aún sin ficha o sin personajes, van todas), así que el prefijo solo cambia cuando cambia la composición de la mesa, que ya lo cambiaba.
- Sin argumento el catálogo es **idéntico al de antes** (completo); no se toca ningún esquema, descripción ni el enum de la herramienta `motor` (los 90 nombres siguen siendo válidos).
- Prueba nueva: 34 comprobaciones (completo sin argumento; cada acción del mapa existe y su descripción nombra a la clase; ninguna duplicada; las de clases ausentes salen por nombre y las presentes con línea; todas las herramientas alcanzables; orden de clases irrelevante; `consultar_reglas accion` funciona con una omitida; la página pasa las clases).

| Medida (mock, 12 turnos) | Antes | Después | Δ |
|---|---:|---:|---:|
| Catálogo (fixture: 3 clases) | 29.035 car. | 25.221 car. | −13 % |
| Entrada media de la narración, exploración | 93.439 car. (≈ 23.360 tok) | 89.625 car. (≈ 22.406 tok) | **−4,1 %** |
| Entrada media, diálogo | 93.398 | 89.584 | −4,1 % |
| Entrada media, combate (3 criaturas) | 94.498 | 90.684 | −4,0 % |
| Llamadas por turno (exploración / diálogo / combate) | 17/12 · 14/12 · 14/12 | idénticas | 0 |
| Mesa típica de 3 clases con Flagelante (`entrada-dm.ts`) | 29.035 | 24.883 | −4.152 car. (≈ −1.040 tok) |
| Mesa de una sola clase | 29.035 | 24.222 | −4.813 car. (≈ −1.200 tok) |

Prompt fijo `sistemaWeb()`: **sin cambios** (67.231 car., umbral 67.600 de `t-prompt`/`t-rampa`); los umbrales no se tocan.

## 4. Ideas evaluadas y descartadas (con la medición que lo justifica)

| Idea | Veredicto | Razón medida |
|---|---|---|
| (a) Repaso solo cuando haga falta | **Ya estaba hecho** | `pistasDeRepaso` vacío → sin segunda llamada (`narrarTurno`, `pistas.length`); además se omite si la casilla «Repaso» está desmarcada o el turno se cortó. Cuando se lanza no lleva instrucciones ni catálogo (10.300 car.). |
| (a’) Reducir el estado del repaso (sin criaturas completas, regentes, plano…) | Descartado | Ahorra ≈ 1.300 tok en «quick» **solo** cuando el repaso se lanza: < 0,5 % del coste por turno incluso con repaso en el 25 % de turnos; toca la red de seguridad del registro. |
| (a’’) Afinar las expresiones regulares de las pistas (p. ej. «da», «toma», «coge», «herido») | Propuesta (§5) | Es donde más repasos innecesarios nacen, pero cualquier recorte puede dejar sin registrar un cambio real; hace falta medir la tasa real (`consumo/` con `repaso: true`). |
| (b) Compactar menos veces con lotes mayores | Descartado | Una compactación cuesta ≈ 1.900 tok «quick» cada ~5,5 turnos (≈ 350/turno). Dejar más turnos sin resumir cuesta en la narración (nivel del DM) unos 330 tok **por turno extra y por turno de partida**: el punto actual (compactar a 9, quedan 4) está en el óptimo; subirlo sube el coste. Bajarlo (7/3) apenas mueve el total (< 1 %) y recorta continuidad. |
| (c) Recortar más la narración antigua del historial | Descartado | Solo hay ≈ 5.000 car. (5 %) de historial; las narraciones de ≤ 1.200 car. no se recortan nunca y el límite de 120 palabras las mantiene debajo. Cambiaría continuidad por < 1 %. |
| (d) Acortar descripciones del catálogo | Propuesta parcial (§5) | Las 42 descripciones > 120 car. sumarían −2.017 car. (≈ −500 tok, −2 %); el esquema real enviado es una sola herramienta con un enum de nombres (412 tok), no hay 88 esquemas que aligerar. |
| (e) `estadoParaDM`: omitir vacíos / compactar | **Ya estaba hecho** | Solo emite bloques con contenido; criaturas iguales se describen una vez; por turnos solo el que actúa lleva ficha completa; la descripción literaria solo en el asalto de aparición. Las 5 criaturas distintas (4.529 car.) son contenido necesario del DM. |
| (f) Reintentos redundantes y red de seguridad | **Sin cambios** | Los reintentos (`reintentar`) son de base de datos, no de `sample`; la red de seguridad solo se lanza con texto < 15 car. y usa el nivel de la narración; el conflicto de versión repite el turno completo, pero es el comportamiento correcto (otro jugador guardó). |
| (g) Turnos en lote | **Ya estaba hecho** | En modo libre llegan juntas todas las acciones en cola y se narran en una llamada; por turnos se narra de uno en uno por regla del juego. |
| (h) Caché de prompt: prefijo estable primero | **Ya estaba bien** | El primer mensaje es el bloque fijo (sin marcas de tiempo ni contadores), después el historial, y todo lo volátil (anales, estado, frases, bloque de turnos, acciones) va en el último mensaje. El prefijo solo cambia con la composición de la mesa (clases, artes). El único movimiento extra es el recorte por edad de los avisos del historial (< 1.500 tok por turno, a precio de caché vencida). |
| (i) Longitud de la narración | **Ya acotada** | «máximo ~120 palabras por jugador y turno»; salida media medida ≈ 770 car. (≈ 190 tok): 0,8 % de la entrada. |
| (j) Nivel de repaso y resúmenes | **Confirmado «quick»** | Las 4 rutas auxiliares (repaso, resumen, detalles, anales) fijan `modelTier: "quick"`; la narración y la red de seguridad usan `nivelAhora()` (por defecto «quick»). Ninguna usa «default» por error. |

## 5. Propuestas a confirmar (no aplicadas: arriesgan calidad o comportamiento)

| Propuesta | Ahorro estimado | Riesgo |
|---|---|---|
| **P1. Bloques de reglas por situación**: cargar `REGLAS_NAVES` (2.120 car.), `REGLAS_AGUA` (1.546), enfermedades (1.279), trampas (1.077), montura (797) y guarida (734) en el prompt solo cuando hay nave, agua, enfermedad, trampa, montura o guarida en el estado, con una línea que remita a `consultar_reglas`. | ≈ 7.500 car. ≈ 1.900 tok ≈ **−7,5 % de la entrada** | Medio-alto: el DM no tendría la regla la primera vez que la necesita (p. ej. al crear una nave o describir agua); el prefijo cambia cada vez que aparece/desaparece una situación (invalida la caché). Requiere pruebas de «imprescindibles» por tema. |
| **P2. Fase de creación con el prompt típico**: hoy, mientras algún jugador activo no tiene ficha, `clasesEnMesa()` da `undefined` y viajan **todas** las clases (`sistemaWeb` completo 67.231 en vez de 51.656) y el catálogo completo. | −15.575 car. de reglas + ≈ −4.800 de catálogo = **≈ −20 % de la entrada en esos turnos** (creación y llegada de jugadores nuevos) | Medio: el DM no tiene a mano las reglas de una clase aún no elegida; se mitiga con `consultar_reglas clase` y con que el formulario ya valida la ficha. |
| **P3. Acortar las 42 descripciones del catálogo de más de 120 car.** a una frase corta (las reglas de clase siguen en su bloque). | ≈ −2.000 car. ≈ −500 tok ≈ **−2 %** | Bajo-medio: se pierden pistas de uso de acciones poco frecuentes; mitigable con el aviso «consulta el esquema». |
| **P4. Afinar las pistas de repaso** (medir primero la tasa real: `resumenConsumo(consumo/)` ya da el porcentaje de turnos con repaso). | Un repaso evitado = ≈ 2.600 tok «quick»; con 25 % de repasos y la mitad falsas alarmas ≈ −160 tok/turno (≈ −0,7 %) | Medio: puede dejar sin registrar hora, oro, objetos o PNJ. |
| **P5. Bajar el nivel por defecto o el de la narración** | La narración es ≈ 97 % del coste: «default»→«quick» divide por 3 | **Alto para la calidad**: no se hace (restricción del encargo). El valor por defecto ya es «quick»; conviene revisar en `consumo/` (campo `nivel`/`origen`) que el dueño no haya fijado «default» o «complex» sin necesitarlo. |
| **P6. Saltar el repaso en turnos con herramientas** | Un repaso por turno con herramienta y pista | **Alto**: justo ahí el DM suele registrar a medias; no se hace. |
| **P7. Recortar el historial a menos de 4 turnos enteros** | ≈ −330 tok por turno quitado | Alto para la continuidad de diálogos; no se hace. |

## 6. Riesgos del cambio aplicado

- Una acción exclusiva de una clase ausente solo se llama por nombre sin firma: si el DM tuviera que usarla (p. ej. un PNJ de esa clase) puede consultar el esquema con `consultar_reglas {tema: "accion", nombre}`; el motor además devuelve «qué falta» si los datos fallan, y el enum de `motor` incluye todos los nombres. Esas acciones operan sobre personajes jugadores de su clase, que por definición no están en esa mesa.
- Cuando entra un jugador con una clase nueva el prefijo cambia una vez (igual que `sistemaWeb`).
- El simulador de balance (`tests/balance/simular.ts --n 40 --rapido`) da salida idéntica (el cambio no toca el motor).

## 7. Segunda ronda: medir mejor, tiempo automático y varias acciones por vuelta

**Encargo (dueño).** Reducir los usos del DM sin quitarle responsabilidades: los jugadores siguen sin tirar a mano y no se toca el nivel del modelo de narración. Tres bloques, cada uno con su commit.

### 7.1 Bloque 4 (primero): medición en `consumo/*`

Cada turno anota, además de lo anterior (`ts`, `jugador`, `entrada`, `salida`, `herramientas`, `repaso`, `sinNarracion`, `nivel`, `origen`):

| Campo | Qué es |
|---|---|
| `uso` | `{acción: veces}` de las acciones llamadas en el turno (narración y repaso; incluye `consultar_reglas` y `actualizar_cronica`, que `herramientas` no cuenta), truncado a las 12 más frecuentes |
| `partes` | caracteres de cada parte de la entrada: `reglas` (sistema + instrucciones de la mesa + secuencia), `catalogo`, `estado` (estado del DM), `historial` (mensajes intermedios), `cronica` (anales + situación + detalles + aventuras previas + crónica), `acciones` (acciones del turno y lo demás del último mensaje: frases usadas, bloque de turnos, ausentes, corrección). Suman exactamente `entrada` |
| `vueltas`, `acc` | llamadas a `motor` de la narración (sin el repaso) y acciones que llevaron en total |

El documento engorda ≈ 165 bytes (315 bytes en total con tres acciones distintas). `V.resumenConsumo(docs)` añade `herramientas {media, p90}`, `top` (las 5 más llamadas, con total y turnos), `partes {n, media, pct}` (reparto medio) y `vueltas {n, media, p90, accionesPorVuelta}`; con documentos antiguos esos campos salen vacíos (`n: 0`). La página tiene ahora un panel de solo lectura: menú ☰ → «📊 Consumo del DM» (últimos 200 turnos); no ensancha la barra ni desborda a 390 px.

**Lo que NO se puede medir desde la página.** `sample()` devuelve solo `{text, truncated, modelTierApplied}` (contrato 0.2.74): no expone tokens, uso de caché, ni el número de rondas, ni si el modelo emite varias llamadas a herramientas en paralelo («nada de las rondas se devuelve: tu propio `execute` es el evento»). Lo que sí se mide: cada ejecución de `motor` es una vuelta con herramientas, así que `vueltas` es el número de rondas con herramientas y las rondas totales de la narración son `vueltas + 1` (la última es la que escribe), salvo que el modelo llame a `motor` varias veces en paralelo en una misma ronda (entonces `vueltas` sobrestima las rondas y no se puede distinguir). Los tokens siguen siendo ≈ caracteres / 4.

**Valor en el mock** (8 turnos de diálogo, 2 acciones por turno en una sola vuelta; fixture `partida-mesa.json`, un jugador con ficha): entrada media 86.855 car. (p90 90.444); herramientas por turno 2 (p90 2); vueltas 1 (2 acciones por vuelta). Reparto medio: reglas 51.957 (59,8 %), catálogo 25.221 (29,0 %), estado 6.296 (7,2 %), historial 1.945 (2,2 %; crece hasta ≈ 4.000 con 8 turnos), crónica + diario + anales 232 (0,3 %), acciones del turno 1.204 (1,4 %). Es decir, **≈ 89 % de la entrada es el bloque fijo (reglas + catálogo)**, en línea con el 83-89 % de §2. Los datos reales (herramientas más llamadas, vueltas por turno) aparecerán en el panel cuando la mesa juegue unos turnos con esta versión.

### 7.2 Bloque 1: tiempo automático (3 minutos por turno; **propuesta a confirmar**)

**Hallazgo.** El programa ya avanzaba el reloj solo (`tiempoDeTurno`: +600 s si el DM no lo movía), pero sin distinguir combate ni creación, sin aviso público y con la regla del prompt «avánzalo cada turno (conversar, 10 min; registrar una sala, 5…)»: por eso el DM llamaba a `tiempo` casi cada turno (19 de 24 en una partida real).

**Aplicado** (`src/herramientas.ts`, `web/artifact.template.html`, `src/espacio.ts`):
- `segundosAutomaticos(partida, {relojAntes, enCombate, creando})` (función pura): **180 s** (`SEGUNDOS_TURNO_AUTOMATICO`) solo si hay reloj, el DM no lo movió en el turno (`reloj.segundos === relojAntes`: cubre `tiempo`, `pasar_tiempo`, `viajar`, `descanso`, `avanzar_asaltos`, `siguiente_asalto`…), no hay combate (ni al empezar ni al acabar el turno) y no se están creando personajes (algún jugador activo sin ficha, o ninguno con ficha). Si no, 0.
- `tiempoDeTurno` aplica esa decisión y pasa por el mismo camino que las herramientas: aviso público **«🕒 Día N, HH:MM (momento) · ⏱ automático»** (uno por turno), cambio de estación/anomalía, estados que caducan por reloj (`caducarEstadosFuera`; antes el avance automático no los contaba), sustento (hambre y sed), enfermedades y fuego/agua.
- Enganche en la página: justo donde ya estaba (tras la narración, las herramientas y el repaso; antes de armar `turnoDoc` y de la escritura única de `mesa/estado` con `pendiente`). El aviso y el reloj nuevo viajan en esa misma escritura atómica: no se toca el lease ni el versionado.
- Prompt: la línea del reloj ya no pide avanzar a pasos pequeños («El programa suma solo 3 min por turno (0 en combate…): usa tiempo avanzar solo para lo que dure bastante más»). Prompt fijo 67.270 (antes 67.254; tope 67.600). Los saltos de ≥ 6 h siguen exigiendo `cita`.
- Pista de repaso «la narración hace pasar horas y el reloj no se movió»: sin cambios (se calcula antes del avance automático y su umbral es ≤ 600 s); prueba nueva de que sigue detectando saltos narrados con y sin los 3 minutos.
- Decisión sobre «sin reloj fijado»: `partida.reloj` ausente → 0 (motor). La página siempre lo tiene (`normalizarPartida` lo crea en modo `auto`, día 1 08:00, para que hambre y sed corran) y ese reloj automático sí avanza; solo se omite en creación y combate.

**Ahorro estimado.** El programa ya sumaba tiempo; lo que se evita es la **llamada del DM a `tiempo`** (una acción más en su lista de `motor`, ≈ 100-150 tokens de salida y de resultado) y, cuando era la única acción del turno, **una vuelta entera** (≈ 21.000 tokens de entrada leída de caché). Rango: de ≈ 0,2 % a ≈ 25 % de los tokens de un turno, según cuántas veces estuviera sola. No es medible hoy; el panel de consumo dirá cuántos turnos llaman todavía a `tiempo` (`uso`).
**Riesgos.** El DM podría seguir narrando horas sin avanzar (lo cubre la pista de repaso); en la fase de introducción el reloj sí avanza 3 min (solo la creación lo omite); el aviso 🕒 en cada turno entra también en el historial del DM (≈ 50 caracteres por turno). Los 3 minutos son una **propuesta a confirmar**: se cambian en `SEGUNDOS_TURNO_AUTOMATICO`.

### 7.3 Bloque 2: varias acciones por vuelta

**Comprobado.** Ya se puede: `motor` es una sola herramienta con `acciones: [{accion, datos}, …]` que se ejecutan **en orden** con `ejecutar`; devuelve el resultado de cada una (`error: true` en la que falla, con su mensaje) y sigue con las demás; los avisos se publican en orden; no hay regla que lo impida (al contrario: las instrucciones de la mesa ya decían «mete en una sola llamada todo lo que no dependa de un resultado anterior» y la descripción de la herramienta, «mete en una sola llamada todas las acciones independientes»). Por eso **no se cambia el esquema** ni el guardado compartido. Si el modelo emite además varias llamadas a `motor` en paralelo no se puede saber (ver 7.1).
**Aplicado** (reemplazo, +32 caracteres, en las instrucciones de la mesa, no en `sistemaWeb`): «Cada ronda cuesta: lo ideal es UNA por turno; mete en una sola llamada todo lo que no dependa de un resultado anterior (tirada + pista + ubicación, todos los ataques enemigos…)».
**Medido con el mock** (`tests/ui/agrupar.mjs`): el mismo turno con 3 acciones (una con datos inválidos) hace **1 vuelta** si se agrupa y **3 vueltas** si se reparte; el estado guardado y los avisos son los mismos; `consumo/` lo anota (`vueltas`, `acc`).
**Ahorro estimado.** Cada vuelta evitada es una petición que reenvía todo el contexto (≈ 21.000-22.000 tokens, normalmente de caché): 2 vueltas menos por turno en el caso del mock (3 → 1). El ahorro real depende de cuántas rondas hacía el DM, que hasta ahora no se medía: el panel lo dirá (`vueltas` y acciones por vuelta).
**Riesgo.** Bajo: no cambia el motor. Agrupar mal acciones que dependen unas de otras (p. ej. una tirada y el daño según el resultado) haría que la segunda se ejecute sin conocer la primera; el texto exige «lo que no dependa de un resultado anterior».

### 7.4 Comprobaciones

`npx tsc --noEmit --noUnusedLocals -p .` limpio; `npm test` 54/54; `npm run audit` sin problemas (prompt 67.270); `npm run dead-exports` sin exports muertos; simulador `--n 40 --rapido` idéntico (md5 de la salida igual antes y después de cada bloque); `npm run test:ui` 20/20 con 0 errores de página (nuevos: `consumo`, `tiempo-auto`, `agrupar`). Nota: `t-resistencias` falla de forma intermitente por dados aleatorios en una comprobación de Ysolde (ya ocurría antes de estos cambios).
