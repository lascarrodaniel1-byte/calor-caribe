# Estaciones y clima por región

> **PROPUESTA a confirmar por el dueño** (para revisar y corregir): los nombres locales, las descripciones, los climas con su peso y las horas de luz. **Confirmado:** el calendario de 360 días, las reglas de efectos, la adaptación por raza y clase y la «Bendición de la lluvia» del Tritón.
> Todo es **opcional por partida**: sin `partida.calendario` nada de esto actúa. Los datos viven en `src/clima.ts` (`PERFILES`); esta tabla se corrige allí.

## Calendario

Año de 360 días, 4 estaciones de 90 (Primavera 1-90, Verano 91-180, Otoño 181-270, Invierno 271-360). `calendario.inicio` es el día del año en que cae el «Día 1» de la partida (por defecto 225: mitad del otoño). Día del año = ((inicio + día − 2) mod 360) + 1. El clima de cada día sale de una semilla (día + región) con `mulberry32`: es el mismo para todos y estable al recargar. Un clima por día; la hora solo cambia la luz.

## Efectos (automáticos, solo con calendario)

| Qué | Efecto |
|---|---|
| Sed por calor | cálida ×1,25, tórrida ×1,5, calima ×1,1 extra; no al abrigo (posada, fortaleza, mazmorra, cueva, templo) ni en el agua |
| Hambre por frío | helada ×1,25, fría ×1,1 |
| Viaje | nieve y aguanieve ×0,75 de km; ventisca y tormenta ×0,6 (las horas no cambian) |
| Encuentros | plantillas con `estaciones`: ×2 en ellas, ×0,5 fuera (Wendigo: Invierno; Sirenas, hombres pez y hombres lagarto: Verano y Primavera; Hambrientos y lobos de ceniza: Otoño e Invierno; Duende: Primavera y Verano; niebla: Otoño e Invierno; pantano: Primavera y Otoño; derrumbe: Primavera e Invierno; arpías: Primavera y Verano; peregrinos: todas menos Invierno) |
| Luz | fuera de [amanecer, ocaso] el estado del DM dice «amanecer» (la hora anterior), «ocaso» (la hora siguiente) o «noche cerrada» |

## Tabla región × estación (PROPUESTA)

Climas: peso relativo (llovizna es un clima suave derivado de la lluvia). «ceniza» se muestra como «lluvia de ceniza».

### Aldenmar

| Estación | Nombre local | Descripción | Temp. | Climas (peso) | Luz |
|---|---|---|---|---|---|
| Primavera | el Deshielo Gris | La nieve sucia se funde en regueros negros por las calles y las hogueras de la Llama Gris humean sobre el barro. | fresca | nublado 4, lluvia 3, niebla 2, lluvia de ceniza 1, despejado 1, tormenta 1, llovizna 2 | 07:00-19:00 |
| Verano | el Sol Pálido | El disco gris apenas calienta, pero el aire de la Ciudad-Faro se vuelve espeso y huele a brasa y a piedra recalentada. *Luz tenue: el día no llega a ser claro del todo.* | cálida | despejado 3, nublado 3, tormenta 2, calima 1, lluvia de ceniza 1 | 06:00-20:00 |
| Otoño | la Lluvia Negra | Cae ceniza mezclada con agua: los tejados chorrean tinta y los faroleros no dan abasto. | fresca | lluvia de ceniza 4, lluvia 3, niebla 2, nublado 2, tormenta 1, llovizna 2 | 07:30-18:00 |
| Invierno | el Invierno de Ceniza | Nieve gris sobre una ciudad que huele a humo; las campanas suenan apagadas y la luz muere pronto. | fría | lluvia de ceniza 3, nieve 3, nublado 2, ventisca 1, niebla 1, aguanieve 1 | 08:30-16:30 |

### Las Agujas de Vahl

| Estación | Nombre local | Descripción | Temp. | Climas (peso) | Luz |
|---|---|---|---|---|---|
| Primavera | el Deshielo de Vahl | Los neveros se parten con estruendo y los pasos se llenan de aludes menudos y de agua helada. | fresca | nublado 3, despejado 2, lluvia 2, nieve 2, ventisca 1, llovizna 1 | 07:00-18:30 |
| Verano | el Breve Estío | Unas pocas semanas de aire fino y cielo duro en las que los monasterios abren sus puertas a los vientos. | templada | despejado 4, nublado 2, tormenta 2, lluvia 1, llovizna 1 | 06:00-20:00 |
| Otoño | los Vientos Ciegos | Rachas que silban entre las agujas y arrancan el aliento; la niebla de altura se come los senderos. | fría | nublado 3, niebla 2, nieve 2, ventisca 1, despejado 1 | 08:00-17:00 |
| Invierno | la Larga Nevada | Meses de nieve que no cesa: los monasterios se cierran, los flagelantes ayunan y el silencio pesa como una losa. *El día más corto de Velmora.* | helada | ventisca 4, nieve 4, nublado 1, despejado 1 | 09:00-15:30 |

### Karak-Dûm

| Estación | Nombre local | Descripción | Temp. | Climas (peso) | Luz |
|---|---|---|---|---|---|
| Primavera | el Turno del Deshielo | Las galerías gotean y el eco de las forjas se mezcla con el agua que baja por las grietas del Sello. *Bajo tierra casi no se nota la estación: perfil casi constante.* | fresca | nublado 3, niebla 2, despejado 2, lluvia 2, llovizna 1 | 07:30-18:30 |
| Verano | el Turno de la Forja Viva | El calor de las forjas sube por los pozos y la piedra suda; fuera, el sol herido apenas se distingue. *Bajo tierra casi no se nota la estación: perfil casi constante.* | fresca | despejado 3, nublado 3, niebla 2, tormenta 1 | 07:30-18:30 |
| Otoño | el Turno de las Sombras | Las galerías se enfrían y los centinelas del Sello doblan las guardias mientras las puertas crujen. *Bajo tierra casi no se nota la estación: perfil casi constante.* | fresca | nublado 3, niebla 2, despejado 2, lluvia 1, llovizna 1 | 07:30-18:30 |
| Invierno | el Turno del Hielo en las Puertas | La escarcha cubre los portones sellados y el aliento se hiela en las bocas de las minas. *Bajo tierra casi no se nota la estación: perfil casi constante.* | fría | nublado 3, nieve 2, niebla 1, despejado 1 | 08:00-18:00 |

### El Bosque de Velo Rojo

| Estación | Nombre local | Descripción | Temp. | Climas (peso) | Luz |
|---|---|---|---|---|---|
| Primavera | la Savia Roja | El bosque rezuma savia color óxido y las voces de los muertos suenan más cerca, húmedas, entre las hojas nuevas. | fresca | lluvia 3, niebla 3, nublado 2, despejado 1, llovizna 2 | 07:00-19:00 |
| Verano | el Verano de Susurros | Bochorno bajo el dosel rojo: el aire no se mueve y cada rama parece murmurar un nombre. | templada | niebla 3, despejado 2, tormenta 2, nublado 2 | 06:00-20:30 |
| Otoño | la Caída Roja | Las hojas caen como gotas de sangre seca y alfombran los senderos con un crujido que delata a todo el que pasa. | fresca | niebla 4, lluvia 3, nublado 2, lluvia de ceniza 1, llovizna 2 | 07:30-18:00 |
| Invierno | el Invierno de los Callados | La nieve se come las voces: durante semanas el bosque enmudece, y ese silencio es peor que el murmullo. | fría | nieve 3, niebla 3, nublado 2, ventisca 1 | 08:30-16:30 |

### Las Ciénagas de Hollín

| Estación | Nombre local | Descripción | Temp. | Climas (peso) | Luz |
|---|---|---|---|---|---|
| Primavera | las Crecidas | El agua negra sube y borra los senderos; los barqueros cobran el doble y los troncos flotan como cadáveres. | templada | lluvia 4, niebla 3, nublado 2, tormenta 1, llovizna 2 | 06:30-19:30 |
| Verano | las Fiebres | Calor de caldo y nubes de insectos; el aire huele a podredumbre y los febriles deliran en las barcazas. *Tórrida: la sed corre más deprisa.* | tórrida | calima 3, tormenta 3, niebla 2, despejado 1, lluvia 1, llovizna 1 | 05:30-20:30 |
| Otoño | las Nieblas Espesas | La niebla no se levanta en semanas y la voz se pierde a tres pasos: los hombres lagarto cazan a gusto. | fresca | niebla 4, lluvia 3, nublado 2, lluvia de ceniza 1, llovizna 2 | 07:00-18:30 |
| Invierno | la Helada Negra | Una escarcha de hollín cubre las cañas y el cieno cruje bajo las botas; el frío cala hasta el hueso húmedo. | fría | niebla 4, nublado 2, lluvia 2, aguanieve 1, llovizna 1 | 07:30-17:30 |

### La Marca Hueca

| Estación | Nombre local | Descripción | Temp. | Climas (peso) | Luz |
|---|---|---|---|---|---|
| Primavera | el Fango de la Guerra | El páramo se vuelve un lodazal donde afloran huesos, hebillas y estandartes de hace un siglo. | fresca | nublado 3, lluvia 2, despejado 2, tormenta 1, llovizna 1 | 06:30-19:30 |
| Verano | la Sed de la Marca | El polvo de los huesos flota en un aire reseco y sin sombra; los pozos del páramo se agotan. | cálida | calima 4, despejado 3, tormenta 1, nublado 1 | 05:30-20:30 |
| Otoño | el Viento de Estandartes | Un viento seco arrastra ceniza y jirones de tela por los campos de batalla, con un lamento casi humano. | fresca | lluvia de ceniza 3, nublado 3, lluvia 2, tormenta 1, niebla 1, llovizna 1 | 07:00-18:00 |
| Invierno | el Invierno de los Cuervos | Nieve sobre los muertos del campo y bandadas negras que no se van: el páramo parece un cementerio de verdad. | fría | nublado 3, nieve 2, lluvia de ceniza 2, niebla 2, ventisca 1 | 08:00-17:00 |

### Marca de Velmora

| Estación | Nombre local | Descripción | Temp. | Climas (peso) | Luz |
|---|---|---|---|---|---|
| Primavera | la Primavera Herida | El deshielo llega sin alegría: brotes pálidos bajo un sol que no termina de curarse. | templada | nublado 3, lluvia 3, despejado 2, niebla 1, llovizna 2 | 06:30-19:30 |
| Verano | el Verano Pálido | Días largos y de luz lechosa; calor sin brillo que reseca los caminos. | cálida | despejado 3, nublado 2, tormenta 2, calima 1 | 05:30-20:30 |
| Otoño | el Otoño Gris | Lluvias frías y cielos bajos; las hojas caen sobre un mundo que ya huele a ceniza. | fresca | nublado 3, lluvia 3, lluvia de ceniza 2, niebla 1, llovizna 2 | 07:00-18:30 |
| Invierno | el Invierno Sin Sol | Noches largas y un sol que apenas asoma: la nieve sucia cubre los caminos y el frío no perdona. | fría | nublado 3, nieve 2, lluvia de ceniza 2, niebla 1, ventisca 1 | 08:00-17:00 |

## Anomalías estacionales (nombres y ejemplos: PROPUESTA)

Una estación puede alargarse o volverse extrema por una causa de la historia. Herramienta `clima`: `anomalia` (crea), `terminar_anomalia {id}` (la cierra cuando la causa se resuelve), `ver` y `pronostico`.

- **Campos:** `nombre`, `causa` (≥ 20 caracteres, obligatoria), `tipo` (`larga` | `intensa` | `ambas`), `estacion` (por defecto la actual), `region` (por defecto la del grupo, o «todas»), `desde` (día de la partida; por defecto hoy; nunca en el pasado), `extra_dias` (0-60), `intensidad` (1-3), `publica` (por defecto `true`; `false` = rumor que solo ve el DM).
- **Larga:** retrasa `extra_dias` días el cambio a la siguiente estación en esa región, y todo lo posterior. Se implementa con un desfase acumulado: para un día de la partida posterior al final de la estación (`fin`), si cae dentro de la prórroga sigue siendo la misma estación (día 91, 92… de 90) y, pasada la prórroga, se resta `extra_dias` al día antes de calcular el día del año; los días anteriores a `fin` no cambian.
- **Intensa:** +25 % por nivel al exceso de los factores (sed, hambre, viaje), el clima se empuja a lo extremo (más nieve y ventisca en invierno, más calima y tormenta en verano…), la temperatura sube un escalón (fría → helada, cálida → tórrida) y las plantillas de encuentro con `estaciones` pesan ×1,5 más por nivel.
- **Guardas:** una activa por región, `causa` obligatoria, no en el pasado y, con turno en marcha, `cita` literal de la acción de un jugador (o `origen: "trama"` si hay un arco abierto).
- **Visibilidad:** aviso público al empezar y al terminar (solo si es pública); marcador en el panel del mapa («🥶 Invierno intenso · …»); el estado del DM trae la causa y los días que quedan.

Ejemplos propuestos (a confirmar):

| Nombre | Dónde | Tipo | Causa |
|---|---|---|---|
| El Invierno del Wendigo | Las Agujas de Vahl, Invierno | ambas (+30 días, intensidad 2) | un Wendigo despierta en las cumbres y la hambruna se extiende con la nevada |
| El Verano del Sol Herido | todas, Verano | intensa (3) | la herida de Kharoth se abre y el sol arde como una llaga |
| La Larga Noche de Ceniza | Aldenmar, Otoño | larga (+20 días) | tras la caída de la catedral, la ceniza no deja de caer |
| Las Fiebres Eternas | Las Ciénagas de Hollín, Verano | ambas (+15 días, intensidad 1) | la Madre de los Hambrientos hace hervir el agua negra |

## Adaptación por raza y clase (CONFIRMADA)

«inmune» anula el extra de ese factor (queda ×1), «bien» lo reduce a la mitad del exceso y «mal» lo sube un 25 % del exceso. La humedad (lluvia, niebla, ciénaga, tormenta) solo afecta al freno de viaje (bien: sin freno; mal: +25 %). Raza y clase se combinan: la mejor de las dos para bien/inmune y «mal» solo si ninguna lo compensa. El grupo viaja al ritmo del peor adaptado, salvo que haya un Cazador de Brujas, que reduce a la mitad el freno de todos. La ficha del DM trae una línea «Clima: …» si el personaje tiene alguna.

| Raza o clase | Frío | Calor | Humedad | Nota |
|---|---|---|---|---|
| Enano de Karak-Dûm | bien | mal | — | hijo de la piedra fría |
| Mediano de Hollín | mal | — | bien | criado en las ciénagas |
| Varg | bien | mal | — | sangre de lobo |
| Nacido Pálido | bien | mal | — | sangre fría |
| Tritón de las Mareas | bien | mal | bien | piel que pide agua |
| Cenizo | mal | inmune | — | brasas bajo la piel |
| Berserker de Ceniza | inmune | mal | — | la furia y el pelo gris |
| Cazador de Brujas | bien | — | bien | explorador nato |
| Caballero Juramentado | — | mal | — | el hierro pesa al sol |
| Flagelante | bien | — | — | el dolor lo curte |

Todos los demás (Humano del Faro, Elfo Marchito, Mercenario del Cuervo, Degollador, Segador, Hechicero, Barbero-Cirujano) son neutrales. El Caballero Juramentado «mal con el calor» se aplica solo por la clase (no se comprueba el blindaje de la ficha).

## Tritones y la lluvia (CONFIRMADA)

«Bendición de la lluvia»: con llovizna, lluvia o tormenta (la niebla no cuenta) y **al aire libre** (no en posada, fortaleza, mazmorra, cueva ni templo; sin dato del lugar se asume exterior), el Tritón no acumula sed (ni el extra por calor ni el ×2 de estar en tierra; la que ya tenía no se la quita: para eso, beber), la piel reseca se renueva (cuenta como mojado) y sale la condición «piel reseca» si la tenía, y gana **+1** (**+2** en tormenta) a ataques, pruebas de habilidad y salvaciones de la herramienta `prueba`, con «lluvia +1» en el desglose. Solo con calendario activo. El aviso «🌧 La lluvia sacia al Tritón» sale una vez al empezar la lluvia.
