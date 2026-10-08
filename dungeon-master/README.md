# Dungeon Master · D&D 5e en la terminal

Un Dungeon Master impulsado por Claude para jugar partidas de Dungeons & Dragons 5.ª edición por texto, solo o con amigos en el mismo teclado.

La campaña está ambientada en **Velmora, el Reino del Sol Herido**: un mundo de dark fantasy donde los dioses fueron asesinados hace 99 años, el sol es un disco gris, los muertos se levantan y la magia divina cura… a cambio de llenarte de Ceniza.

## El mundo

- **Razas**: Humano del Faro, Enano de Karak-Dûm, Elfo Marchito, Mediano de Hollín, Varg (maldición del lobo), Nacido Pálido (sangre vampírica) y Cenizo (nacido durante el Eclipse).
- **Clases (todas combatientes)**: Mercenario del Cuervo, Berserker de Ceniza, Caballero Juramentado, Cazador de Brujas, Degollador, Flagelante, Segador y Barbero-Cirujano. Cada una se basa en una clase de 5e (guerrero, bárbaro, paladín, explorador, pícaro, monje, brujo) con rasgos propios del mundo.
- **Regiones y facciones**: la Ciudad-Faro de Aldenmar, las Ciénagas de Hollín, la Fortaleza Silente, el Bosque de Velo Rojo, la Marca Hueca; la Inquisición de la Llama Gris, las Hermanas de la Sutura, la Corte Pálida…

Todo se define en `src/mundo.ts`; cámbialo para crear tu propio mundo.

## Sistema de heridas

Los PV son aguante; las **heridas** son daño real en el cuerpo y las gestiona el programa con tiradas reales (el DM no puede saltárselas):

| Gravedad | PV máx. | Tratar | Convalecencia | Secuelas |
|---|---|---|---|---|
| Leve | — | CD 10 | 1d3 días, sana sola | Nunca |
| Moderada | −3 | CD 13, kit de sanador | 1d4+3 días | Menor si sale mal la recuperación |
| Grave | −6 | CD 16, herramientas de cirujano | 2d6+7 días | Menor o permanente |
| Crítica | −10 | CD 19, herramientas de cirujano | 3d10+15 días | Siempre |

- Se producen al recibir un crítico, un golpe masivo o caer a 0 PV; gravedad y ubicación (cabeza, torso, brazos, piernas) se tiran al azar, y cada combinación tiene su penalización (desventajas, brazo inútil, velocidad reducida…).
- **Hemorragias** que hay que detener, **infecciones** si no se tratan o si el herido se esfuerza, y la **Podre** de los no-muertos, que solo se quema con fuego o se cura con remedios raros.
- **Tratamiento**: medicina/cirugía (influyen el entorno, el material, el alcohol, las hierbas y la pericia del sanador), cauterizar o magia divina (baja un nivel la herida, pero da Ceniza).
- **El tiempo cura… o mata**: la calidad del descanso (esfuerzo, precario, reposo, enfermería) decide si la herida avanza, se infecta o se agrava, y al cerrarse una tirada de recuperación decide si quedan secuelas: cicatrices, cojeras, un ojo perdido, una mano menos.
- Cada raza sana distinto: los enanos resisten la infección, los elfos marchitos son inmunes a la Podre pero sanan lento, los varg cierran rápido las heridas leves, y a los nacidos pálidos la magia divina no les hace nada.

- **Narra, interpreta PNJ y arbitra las reglas** de D&D 5e (SRD), en español.
- **Los dados son reales**: el modelo no inventa resultados; pide la tirada a este programa (`crypto.randomInt`) y tú la ves en pantalla. Soporta `1d20+5`, `2d6-1`, `4d6kh3`, ventaja/desventaja y tiradas secretas del DM.
- **Fichas de personaje**: el DM guía la creación de personaje y lleva PV, CA, atributos, inventario, oro y condiciones.
- **Partida guardada** en `partida.json` después de cada turno; al volver, el DM resume "lo que pasó la última vez".

## Zonas vitales: verde, ámbar y roja

Cada herida cae sobre una **estructura anatómica concreta**, que el programa tira según la gravedad y la región (cabeza, cuello, torso, abdomen, brazos, piernas). Esa estructura decide su zona:

| Zona | Estructuras | Qué pasa |
|---|---|---|
| **Roja** | Encéfalo, cerebelo, tallo cerebral, corazón, aorta, vena cava, arteria y vena pulmonar, pulmón perforado, subclavia, axilar, femoral, isquiotibiales con la femoral profunda, hemorragia visceral masiva | **Un minuto de vida como mucho** (10 asaltos o menos; tallo cerebral, 1d4). Si se puede comprimir (femoral, axilar, subclavia), se intenta un torniquete con CD alta; si está dentro de una cavidad, no hay dónde apretar: solo la salvan una cirugía desesperada (CD 22), la Sangre de Santo o la magia divina. Si se sobrevive, la secuela es irreversible |
| **Ámbar** | Carótida, yugulares, tráquea; plexo braquial, nervio ciático, tendones; intestino, hígado, bazo, páncreas; costillas; cráneo fracturado; arterias braquial y poplítea; ojo | Se sobrevive, pero cuesta: recuperación larga y secuelas casi siempre irreversibles. Las del cuello y las arterias de las extremidades se vuelven **rojas en pocos asaltos** si nadie las comprime (y un degüello no siempre las alcanza). Las vísceras y el cráneo empeoran **día a día** sin cirugía hasta volverse rojas. Las costillas rotas pueden **perforar el pulmón** con el esfuerzo. Nervios y tendones **incapacitan**: brazos que no responden, piernas que no caminan, manos que no empuñan |
| **Verde** | Piel, cuero cabelludo, músculo grueso | Casi nada es verde. Sin cuidados se infecta y puede pasar a ámbar (gangrena) o roja (septicemia) |

La probabilidad de cada zona depende de la gravedad: una herida leve siempre es verde; una crítica es roja el 60 % de las veces.

## Hemorragias y anemia

Una herida que sangra quita PV cada asalto (1 si es grave, 1d4 si es crítica) y acumula sangre perdida. Cada poco, el personaje hace una salvación de CON con una CD que **sube cuanto más dura la hemorragia**; si falla, pierde 1 de FUE por falta de hierro. Con FUE 3 o menos se desmaya; con 0 muere desangrado. La anemia se recupera con días de descanso (más rápido en enfermería) o con Sangre de Santo.

## Viales

| Vial | Efecto | Riesgo |
|---|---|---|
| **Sangre de Santo** (curación, 50 po) | 2d4+2 PV, detiene hemorragias, baja un nivel la herida más grave, devuelve 1 de FUE | Coágulo e **infarto**: 5 % con el primero, +15 % por cada vial más el mismo día |
| **Ceniza Viva** (resurrección, rarísima, no se vende) | Revive a un muerto reciente con 1 PV | 25 % vuelve con **amnesia**, 15 % vuelve **delirando y ataca a todos**, 5 % no vuelve |
| **Hiel de Víbora Gris** (veneno, 30 po) | Bebida o en un arma: 4d6 de veneno, envenenado y quizá paralizado | — |
| **Leche de Amapola Negra** (sueño, 15 po) | Duerme; sirve de anestesia para cirugía (+2) | Las dosis se acumulan: con 3, coma; con 4, paro respiratorio; con 5 o más, casi seguro **mata** |

## Equipamiento y botín

El botín se genera con tablas según el origen: **compra**, **saqueo**, **hallazgo** o **jefe**. Las calidades son defectuoso, normal, de calidad, encantado, **maldito** (parece encantado; la maldición queda oculta hasta que se descubre) y **reliquia** (fragmentos de dioses muertos). El DM también puede crear objetos únicos con su historia y su maldición secreta.

## Bestiario y jefes

Es una base, no un límite: el DM puede inventar criaturas y habilidades nuevas, y el programa lleva sus PV y resuelve sus habilidades con tiradas reales.

- **Bestias y monstruos**: Hambrientos, Lobos de Ceniza, Ghules, Ogros, Trolls de ciénaga, Wyvernos, Basiliscos, Mantícoras, Banshees, Gigantes de hueso, Dragones jóvenes de ceniza y Apóstoles (los que aceptaron la oferta de un behelit).
- **Jefes**: Vaskar el Lobo del Eclipse, el Juez Sin Ojos, Ysolde la Reina Pálida, la Madre de los Hambrientos, El Que Golpea Bajo la Piedra, Kharoth (Dragón Antiguo del Sol Herido) y:
  - **Ilvara, la Tejedora de Mañanas**, que **ve el futuro**: tira sus *presagios* (d20) por adelantado y puede imponerlos en lugar de las tiradas de los jugadores; condena con profecías de muerte que solo se rompen haciendo algo que ella no haya visto.
  - **Vaerth, el Sin Rostro**, un **cambiaformas** que **roba atributos** (del mejor atributo de la víctima) y se queda con los **rasgos de su raza y su clase** y con su forma. Si a alguien le roba todo un atributo, muere vacío. Al matarlo, todo lo robado vuelve a sus dueños. Son extremadamente difíciles; varias de sus habilidades provocan **muerte instantánea** si fallas la salvación (algunas con cualquier fallo, otras si fallas por mucho).

## Behelits

Huevos de piedra con un rostro desordenado, que pertenecen al **Coro de los Cinco**. Son lo más difícil de encontrar del mundo: nunca se venden y solo aparecen por azar extremo (0,1 % por objeto en saqueos, 0,3 % en hallazgos y 2 % en botín de jefe) o cuando el DM lo decide.

- **Jugadores y PNJ**: cualquiera puede tener un behelit. Un PNJ puede despertarlo, estar destinado al carmesí y sacrificar al propio grupo; los PNJ que se convierten en apóstoles entran en escena como criaturas.
- **Behelit común**: despierta solo en la desesperación más profunda (al menos 2 motivos reales: estar al borde de la muerte, perder a un ser querido, una traición, perderlo todo, un sueño roto; cuantos más, más probable). El precio es **lo que más se ama o se valora**: para un jugador, **sus compañeros** (debe sacrificar al menos a uno; solo si no tiene compañeros vale la persona que más quiere). Aceptar convierte al portador en **Apóstol** (+4 FUE y +4 CON, +5 de Ceniza, forma demoníaca), pero pierde su humanidad. Rechazar exige una salvación de SAB CD 18; si se falla, la mente queda rota (−2 SAB).
- **Behelit Carmesí**: **único** en toda la campaña. Solo aparece si el DM lo crea como centro de un gran arco. Al crearse, el programa decide en secreto quién está destinado (5 % por personaje, más si acumula Ceniza; puede no serlo nadie del grupo). **En manos de cualquier otro nunca despierta.** El destinado necesita al menos 3 motivos de desesperación y una ambición declarada; entonces llega el Eclipse, y puede ascender como el Quinto del Coro sacrificando a **todos** sus compañeros (rechazarlo exige SAB CD 22).
- **Salvarse del sacrificio**: cada sacrificado hace tres salvaciones (CON para resistir la embestida, DES para abrirse paso, SAB para no rendirse) contra CD 17, o 20 en el Eclipse. Con 2 éxitos escapa, marcado para siempre; con 1 queda atrapado y se juega la escena; en el Eclipse, con 0 es devorado. Lo que hagan importa:

  | Circunstancia | Efecto |
  |---|---|
  | Fuera del horizonte del ritual | A salvo y sin marca (puede entrar a rescatar a los demás) |
  | Ayuda externa | +5 |
  | Un aliado lo cubre | +3 |
  | Conoce el ritual y se preparó | +3 |
  | No cede a la desesperación | +2 |
  | Lleva un arma legendaria | +5 y ventaja (automático) |
  | Lleva una reliquia | +3 (automático) |
  | Lleva un arma encantada de plata y sal o de llama gris | +2 (automático) |

## Armas legendarias

Únicas en toda la campaña (solo existe una de cada) y casi imposibles de conseguir: salen solo del botín de jefes (2 %) o cuando el DM las pone en la historia. Todas protegen frente al Eclipse. **Colmillo de Hierro** (espadón descomunal, letal contra demonios y apóstoles), **Lanza de la Primera Llama**, **Escudo de Aldren el Fiel**, **Daga del Último Rito** (corta profecías y presagios) y **Martillo del Herrero Ciego** (obliga a los cambiaformas a mostrarse). El DM puede inventar más.

## Requisitos

- Node.js 20 o superior.
- Una API key de Anthropic (https://platform.claude.com) en la variable `ANTHROPIC_API_KEY`.

## Cómo jugar

```bash
cd dungeon-master
npm install
export ANTHROPIC_API_KEY=sk-ant-...      # en Windows (PowerShell): $env:ANTHROPIC_API_KEY="sk-ant-..."
npm run jugar                            # continúa la partida guardada, o empieza una nueva
npm run jugar -- --nueva                 # empieza desde cero
```

Comandos dentro del juego:

| Comando | Qué hace |
|---|---|
| `/fichas` | Muestra las fichas de los personajes, con heridas y secuelas |
| `/mundo` | Ambientación de Velmora |
| `/razas` | Razas y clases disponibles |
| `/viales` | Qué hace cada vial |
| `/notas` | Muestra las notas de campaña del DM |
| `/tirar 1d20+3` | Tiras tú mismo, sin pasar por el DM |
| `/salir` (o Ctrl+C) | Guarda y sale |

Si juegan varias personas, empieza cada mensaje con el nombre: `Ana: reviso el cofre en busca de trampas`.

## Configuración

| Variable | Por defecto | Para qué |
|---|---|---|
| `DM_MODELO` | `claude-opus-5-5` | Modelo de Claude que hace de DM (p. ej. `claude-sonnet-5-5` para abaratar) |
| `DM_PARTIDA` | `dungeon-master/partida.json` | Archivo de la partida (útil para tener varias campañas) |

## Cómo está hecho

| Archivo | Contenido |
|---|---|
| `src/prompt.ts` | Instrucciones del DM (estilo, reglas, creación de personaje) — edítalo para cambiar su personalidad o ambientación |
| `src/mundo.ts` | Ambientación, razas y clases |
| `src/anatomia.ts` | Estructuras anatómicas y zonas vitales (verde, ámbar, roja) |
| `src/heridas.ts` | Motor de heridas: gravedad, hemorragia, infección, tratamiento, convalecencia y secuelas |
| `src/viales.ts` | Viales y sus riesgos |
| `src/equipo.ts` | Tablas de botín, encantamientos, maldiciones y reliquias |
| `src/bestiario.ts` | Criaturas, jefes y el motor de habilidades especiales |
| `src/behelit.ts` | Behelits, el Behelit Carmesí y el Eclipse |
| `src/reglas.ts` | Salvaciones (con competencia según la clase) y utilidades |
| `src/herramientas.ts` | Herramientas del DM: dados, fichas, heridas, tiempo, hemorragias, viales, botín, objetos y criaturas |
| `src/dados.ts` | Motor de dados |
| `src/estado.ts` | Fichas y guardado de la partida |
| `src/index.ts` | Bucle de juego en la terminal (streaming + bucle de herramientas) |

Detalles técnicos: usa la API de Mensajes con streaming, prompt caching (el historial se reutiliza de un turno a otro, lo que abarata partidas largas) y `fallbacks: "default"`, que reintenta en otro modelo si el principal rechaza una petición, para que una escena oscura no corte la partida.
