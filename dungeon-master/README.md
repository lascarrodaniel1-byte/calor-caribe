# Dungeon Master · D&D 5e en la terminal

Un Dungeon Master impulsado por Claude para jugar partidas de Dungeons & Dragons 5.ª edición por texto, solo o con amigos en el mismo teclado.

La campaña está ambientada en **Velmora, el Reino del Sol Herido**: un mundo de dark fantasy donde los dioses fueron asesinados hace 99 años, el sol es un disco gris, los muertos se levantan y la magia divina cura… a cambio de llenarte de Ceniza.

## El mundo

- **Razas**: Humano del Faro, Enano de Karak-Dûm, Elfo Marchito, Mediano de Hollín, Varg (maldición del lobo), Nacido Pálido (sangre vampírica) y Cenizo (nacido durante el Eclipse).
- **Clases**: Mercenario del Cuervo, Berserker de Ceniza, Caballero Juramentado, Cazador de Brujas, Degollador, Flagelante, Segador, Barbero-Cirujano y Hechicero (el único mago de verdad). Cada una se basa en una clase de 5e (guerrero, bárbaro, paladín, explorador, pícaro, monje, brujo) con rasgos propios del mundo.
- **Regiones y facciones**: la Ciudad-Faro de Aldenmar, las Ciénagas de Hollín, la Fortaleza Silente, el Bosque de Velo Rojo, la Marca Hueca; la Inquisición de la Llama Gris, las Hermanas de la Sutura, la Corte Pálida…

Todo se define en `src/mundo.ts`; cámbialo para crear tu propio mundo.

## Combate

La iniciativa y los ataques los resuelve el programa (`iniciativa`, `atacar`, `terminar_combate`), no el DM a ojo. Lo que más pesa no es el nivel, sino la **veteranía**, que el DM fija según el trasfondo (un mercenario con años en la Compañía es veterano aunque sea nivel 1):

- **Recluta**: ataca con −2 por nervios y se enreda con 1-2 natural (torpeza: falla y queda expuesto), salvo si actúa antes que su rival.
- **Curtido**: +1 a atacar e iniciativa; −1 por nervios si no actúa antes; si falla por 1, aún roza.
- **Veterano**: +2 a atacar e iniciativa; solo falla seguro con un 1; si falla por 2 o menos, roza (mitad de daño, sin herida).
- **Leyenda**: +3, repite el 1 natural, roza si falla por 3 o menos y hace crítico con 19-20.

Cada raza tiene su temple (los elfos marchitos y los nacidos pálidos golpean primero, los enanos arrancan tarde pero pegan más fuerte, los medianos repiten los 1) y cada clase su estilo (el degollador actúa antes, el berserker pega más fuerte pero se enreda más, el hechicero no es un guerrero). Los no-muertos sin mente, como los Hambrientos, son lentos y torpes. Los PNJ sin ficha, como un capitán, entran en el combate con su propia veteranía. Con dano, el ataque tira y aplica el daño y avisa cuando toca una herida.

## Sistema de heridas

Los PV son aguante; las **heridas** son daño real en el cuerpo y las gestiona el programa con tiradas reales (el DM no puede saltárselas):

| Gravedad | PV máx. | Tratar | Convalecencia | Secuelas |
|---|---|---|---|---|
| Leve | — | CD 10 | 1d3 días, sana sola | Nunca |
| Moderada | −3 | CD 13, kit de sanador | 1d4+3 días | Menor si sale mal la recuperación |
| Grave | −6 | CD 16, herramientas de cirujano | 2d6+7 días | Menor o permanente |
| Crítica | −10 | CD 19, herramientas de cirujano | 3d10+15 días | Siempre |

- Se producen al recibir un crítico, un golpe masivo o caer a 0 PV; gravedad y ubicación (cabeza, torso, brazos, piernas) se tiran al azar, y cada combinación tiene su penalización (desventajas, brazo inútil, velocidad reducida…).
- **Hemorragias** que hay que detener, **infecciones** si no se tratan o si el herido se esfuerza, y la **Podre** de los no-muertos: no toda mordida contagia (las heridas leves nunca, y el resto pide una salvación de CON cuya CD depende de quién muerde), pero una vez dentro el cuerpo no la vence solo: hay que quemarla, extirparla con Medicina (CD +4) o usar remedios raros.
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

## Mapa

Los jugadores ven en todo momento un mapa antiguo de Velmora con sus seis regiones, los lugares que vayan descubriendo, el rastro del camino recorrido y un sello de lacre donde está el grupo; durante un viaje, la ruta y lo que llevan recorrido. El DM lo mueve con la acción `ubicacion` cada vez que llegan a otro sitio o viajan (en la página de claude.ai, en el lateral o en «Ver mapa» en el móvil; se amplía al tocarlo).

## Magia

Rara, temida y cara: cada hechizo se cobra un **tributo** en quien lo lanza, mayor cuanto más alto su círculo (0 = truco gratis, 5 = prohibido).

| Escuela | Precio | Si se acumula |
|---|---|---|
| Elemental (fuego, rayo) | Calor | Sobrecalentado → fiebre y quemaduras internas → a 10, combustión |
| Elemental de aire y Protección | Aliento | Jadeo → sin voz para lanzar → asfixia |
| Curación | Sangre | PV y anemia |
| Mente, Sombra, Adivinación | Cordura | Voces → pesadillas → delirio → locura |
| Necromancia (y todo hechizo de círculo 4 o 5) | Años de vida | Canas, −1 FUE y −1 DES cada 10 años; con 50, el corazón puede pararse |

- **Maestría**: profano, iniciado (círculo 1), adepto (2), maestro (3), archimago (4); forzar un círculo más cuesta el doble.
- **Clases**: el nuevo **Hechicero** es el único mago de verdad (adepto, dos escuelas, suma su competencia). Los guerreros **no saben magia**, salvo que nazcan con el **don** (se tira al crear el personaje: 15 % un elfo marchito, 12 % un nacido pálido, 10 % un cenizo, 4 % un humano o un mediano, 2 % un enano, 1 % un varg) o que lleguen a **élite** y la aprendan en la historia con un maestro. Entonces conocen uno o dos hechizos de iniciado de su estilo: *Piel de hierro* (Mercenario), *Sangre hirviente* (Berserker), *Cerrar la carne* (Caballero y Barbero-Cirujano), *Ojo de bruja* (Cazador de Brujas), *Paso de sombra* (Degollador), *Susurro* (Flagelante); el Segador es adepto en necromancia.
- **Razas**: el Elfo Marchito y el Nacido Pálido (necromancia, envejece la mitad) tienen facilidad; el Cenizo, para lo elemental; el Enano y el Varg lo tienen difícil.
- **Catalizadores** que absorben el precio: Piedra de brasa, Ámbar de tormenta, Corazón de cuervo, Incienso de amapola gris, Reloj de arena de hueso, Diente de dios y el Báculo de roble petrificado. Aparecen poco en el botín.

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

### Jugar en claude.ai, sin API key ni servidor

La Mesa de Velmora también existe como página publicada en claude.ai: https://claude.ai/artifact/58LBrXChBQ5HzE2zRJy3SC

- El DM es Claude, con la cuenta de quien pulsa «Enviar»: no hace falta API key ni pagar aparte (gasta el uso normal del plan de Claude de ese jugador).
- La partida se guarda en la base de datos de la página: todos ven lo mismo en vivo, aunque cierren y vuelvan.
- Usa el mismo motor que la terminal (heridas, zonas vitales, viales, botín, jefes, behelits), empaquetado dentro de la página.
- Para invitar a alguien: menú **Compartir** de la página, con permiso para usarla (Contributor) o editarla (Editor si es de fuera de tu organización). Cada jugador necesita una cuenta de Claude.
- Memoria del DM en tres capas. Los **anales**: cada vez que hay más de 8 turnos sin resumir, la página pide a Claude (modo rápido) un capítulo con lo ocurrido y lo añade al final; los capítulos nunca se reescriben, y solo cuando pesan demasiado los cuatro más viejos se funden en uno. La **situación actual** (dónde estáis, misión, PNJ, promesas, objetos, hilos abiertos) se actualiza en cada compactación. Y los **turnos recientes** enteros: si una compactación falla, no se descarta ningún turno, y se reintenta antes de narrar. Además, el DM guarda con anotar_mundo los hechos que no deben resumirse nunca, y su crónica privada admite hasta 2500 caracteres. Los jugadores leen los anales y la situación en el *Diario de la aventura*.
- Para regenerar la página tras cambiar el motor: `npm run artifact` (genera `dist/mesa-de-velmora.html`) y publícala de nuevo en la misma dirección.

### Multijugador por el navegador

Una persona arranca la mesa y el resto entra desde el navegador del móvil o del PC:

```bash
cd dungeon-master
export ANTHROPIC_API_KEY=sk-ant-...
export DM_CLAVE=una-clave       # opcional, pero recomendado: solo entra quien la tenga
npm run servidor                # o: npm run servidor -- --nueva
```

Al arrancar, muestra las direcciones para entrar:

- **Misma red Wi-Fi**: `http://IP-DEL-ORDENADOR:8080` (la imprime el servidor).
- **Por internet**: en otra terminal, `cloudflared tunnel --url http://localhost:8080`, y comparte la URL `https://….trycloudflare.com` que te dé (añade `?clave=…` si usas clave).

Cada jugador escribe su nombre y se sienta a la mesa. Todos ven la narración del DM en vivo, las tiradas y los avisos, y tienen un panel con las fichas. Si varios escriben mientras el DM está narrando, sus acciones se juntan y el DM las resuelve todas en el siguiente turno. Quien entra tarde ve todo lo que ha pasado. `/tirar` es público; `/fichas`, `/razas`, `/viales`… solo los ve quien los pide. La partida es la misma que la de la terminal (`partida.json`), así que puedes alternar entre ambas. Cambia el puerto con `PORT=3000`.

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
| `src/mapa.ts` | Mapa: regiones, lugares, posición del grupo y viajes |
| `src/magia.ts` | Magia: escuelas, hechizos, tributos, catalizadores, maestría y afinidades |
| `src/behelit.ts` | Behelits, el Behelit Carmesí y el Eclipse |
| `src/reglas.ts` | Salvaciones (con competencia según la clase) y utilidades |
| `src/herramientas.ts` | Herramientas del DM: dados, fichas, heridas, tiempo, hemorragias, viales, botín, objetos y criaturas |
| `src/dados.ts` | Motor de dados |
| `src/estado.ts` | Fichas y guardado de la partida |
| `src/navegador.ts`, `web/artifact.template.html`, `scripts/construir-artifact.mjs` | Versión para claude.ai: el motor empaquetado para el navegador y la página de la mesa |
| `src/archivo.ts` | Guardar y cargar la partida en disco |
| `src/mesa.ts` | Comandos de mesa (`/tirar`, `/fichas`…) |
| `src/motor.ts` | Un turno del DM (streaming + bucle de herramientas) y los comandos de mesa, compartidos por la terminal y la web |
| `src/index.ts` | Juego en la terminal |
| `src/servidor.ts` | Mesa multijugador: servidor web con eventos en vivo |
| `web/index.html` | La página de la mesa |

Detalles técnicos: usa la API de Mensajes con streaming, prompt caching (el historial se reutiliza de un turno a otro, lo que abarata partidas largas) y `fallbacks: "default"`, que reintenta en otro modelo si el principal rechaza una petición, para que una escena oscura no corte la partida.
