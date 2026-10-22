# Dungeon Master · D&D 5e en la terminal

Un Dungeon Master impulsado por Claude para jugar partidas de Dungeons & Dragons 5.ª edición por texto, solo o con amigos en el mismo teclado.

La campaña está ambientada en **Velmora, el Reino del Sol Herido**: un mundo de dark fantasy donde los dioses fueron asesinados hace 99 años, el sol es un disco gris, los muertos se levantan y la magia divina cura… a cambio de llenarte de Ceniza.

## El mundo

- **Razas**: Humano del Faro, Enano de Karak-Dûm, Elfo Marchito, Mediano de Hollín, Varg (maldición del lobo), Nacido Pálido (sangre vampírica) y Cenizo (nacido durante el Eclipse).
- **Clases**: Mercenario del Cuervo, Berserker de Ceniza, Caballero Juramentado, Cazador de Brujas, Degollador, Flagelante, Segador, Barbero-Cirujano y Hechicero (el único mago de verdad). Cada una se basa en una clase de 5e (guerrero, bárbaro, paladín, explorador, pícaro, monje, brujo) con rasgos propios del mundo.
- **Regiones y facciones**: la Ciudad-Faro de Aldenmar, las Ciénagas de Hollín, la Fortaleza Silente, el Bosque de Velo Rojo, la Marca Hueca; la Inquisición de la Llama Gris, las Hermanas de la Sutura, la Corte Pálida…

Todo se define en `src/mundo.ts`; cámbialo para crear tu propio mundo.

## Varios jugadores a la vez: que no se pise la información

Cuando varios juegan, cualquiera puede llamar al DM, y lo que sabe cada página puede ir unos segundos retrasado. Para que el DM no cuente lo que ya cambió:

- **Lee la partida de verdad antes de narrar**: al tomar el turno de narrador, y en cada ronda, la página lee el estado y los últimos turnos directamente, en lugar de fiarse de su copia local. Así el DM ve lo que acaba de pasar y no pisa lo guardado por otro.
- **Detecta los choques**: si alguien más guarda mientras el DM narra, o si se pierde el turno de narrador (la pestaña quedó en segundo plano), ese turno se descarta, las acciones siguen en cola y se repite con la partida al día. El turno de narrador dura 2 minutos, para dar margen a las pestañas ocultas.
- **Las notas se corrigen**: `anotar_mundo` ya no solo añade; puede reemplazar una nota que cambió o borrar una que ya no es cierta, y no guarda duplicados. Las pistas falsas se retiran (`trama`), y los PNJ llevan su **estado** (vivo, muerto, capturado…).
- **El resumen descarta lo caducado**: al compactar, el cronista corrige lo que los hechos nuevos han cambiado y marca como obsoletos los detalles que ya no valen.
- **El DM recapitula desde lo vigente**: la regla le pide partir del estado actual y no de los turnos viejos, y contar los cambios como cambios.

## Sincronización en tiempo real (que no haya desfases)

La base de datos de la plataforma **no tiene transacciones**: gana la última escritura, no se puede soltar un candado y las suscripciones pueden ir hasta ~30 s retrasadas. La página está diseñada para eso:

- **Un solo punto de confirmación por turno.** El estado nuevo se guarda en **una** escritura que además apunta lo que falta (escribir el turno, pasar la palabra, vaciar la cola). Después se completa todo eso; si algo falla a medias, quien narre a continuación lo completa al sincronizar, sin repetir nada. Lo mismo vale para **deshacer** un turno.
- **Se lee antes de narrar.** Al empezar cada turno se lee la partida de verdad (estado, últimos turnos, jugadores, orden, memoria), no la copia local. Antes de guardar se comprueba que sigues siendo quien narra y que nadie guardó mientras tanto; si no, el turno se descarta y se repite.
- **Nada se narra dos veces.** Cada turno anota las acciones que consumió; si el borrado de una acción falla, el siguiente turno la reconoce como ya narrada.
- **Lo viejo no pisa lo nuevo.** Un aviso atrasado de la base de datos más antiguo que lo que ya se sabe se ignora. Las versiones y las marcas de los turnos nunca retroceden.
- **Los relojes de cada dispositivo no mandan.** Quién está conectado, si un narrador sigue vivo o cuánto lleva esperando un turno se mide con lo que **mi** página ve cambiar, no con la hora que escribe otro dispositivo; el orden de llegada a la mesa tampoco depende de los relojes.
- **Una escritura a la vez por documento**, con un reintento ante cortes transitorios, y las suscripciones se vuelven a crear solas si mueren. Al volver a la pestaña o recuperar la conexión se lee todo de nuevo.
- **Si el narrador desaparece** (cierra la pestaña), otro jugador retoma a los ~60 s (o enseguida, si el navegador deja avisar al cerrar). Una acción que quedó esperando se vuelve a intentar sola, sin pulsar nada.

Se comprobó con varias páginas simuladas contra una misma base de datos que imita a la de la plataforma (retrasos de suscripción, fallos de escritura, relojes desfasados, borrados que fallan, pestañas que se cierran a mitad de un turno); lo que no se ha podido comprobar es el comportamiento real de la plataforma con jugadores reales.

## Tablero y corrección (que el DM no se pierda)

**Tablero.** Lo primero que lee el DM en cada turno es un tablero muy simple: la **escena en una frase** y, para cada personaje, quién es y quién lo juega, qué **acaba de hacer** (lo anota el programa a partir de la secuencia), dónde estaba **antes**, dónde está **ahora** y su **rumbo**. El DM actualiza el dónde y el rumbo en la marca que escribe al final de cada respuesta, con una línea por personaje que haya cambiado (`Sera: en el sótano, mirando el cerrojo → forzarlo`). Si un dato lleva dos o más turnos sin actualizarse, el tablero lo marca («puede haber cambiado, confírmalo») en vez de darlo por bueno. Si el DM aún no sabe dónde está alguien, el tablero dice «sin ubicar» para que lo sitúe.

**Corregir al DM.** Bajo la última respuesta del DM aparece **↩ Corregir al DM** (o se escribe `/corregir` y lo que falló). Se borra esa respuesta **con todos sus efectos** —tiradas, heridas, objetos, notas, ubicación, trama, secuencia, el turno— porque cada turno guarda una copia de cómo estaba todo antes. La acción vuelve a la cola y el DM la repite, esta vez con la corrección de los jugadores y con lo que dijo mal marcado como «no lo repitas»; las tiradas se vuelven a hacer. Solo se puede corregir la **última** respuesta y mientras nadie más haya jugado después; para errores más antiguos, díselo al DM en tu siguiente acción.

**El candado del narrador.** Para que dos pestañas no narren a la vez hay un candado con caducidad que la plataforma no deja soltar. Antes se quedaba tomado hasta caducar, así que tras cada narración **el siguiente jugador quedaba bloqueado** (hasta dos minutos) y, si había un candado viejo, su acción se quedaba parada en la cola. Ahora se acorta al terminar (el siguiente narra en menos de un segundo) y, si hay uno ajeno que va a caducar enseguida, la página espera y narra sola.

## Secuencia y velocidad (mesa por turnos)

**El DM lleva la secuencia.** Al final de cada respuesta escribe una marca que los jugadores no ven: qué pasó en ese turno y la lista completa de asuntos pendientes (enemigos vivos, puertas abiertas, plazos, deudas…). El programa la quita del texto, la guarda en orden y se la devuelve al DM en cada turno como «Secuencia de turnos» y «Asuntos pendientes», para que no se olvide de nada. Si el DM no la escribe, el programa anota el turno él mismo. Los jugadores la leen en el lateral (**Secuencia de turnos**). En el cierre de ronda, el DM resuelve los pendientes que correspondan.

**Por qué tardaba con varios jugadores, y qué cambió** (medido con una base de datos simulada con 120 ms por operación, un modelo de 2 s y 60 turnos de historial):

| | Antes | Ahora |
|---|---|---|
| Hasta guardar el turno | 5,4 s | 3,2 s |
| Hasta que el narrador queda libre (con compactación pendiente) | 10,2 s | 3,6 s |
| Con la compactación atrasada | 9,6 s | 3,2 s |
| Hilo principal del navegador ocupado | 1,9 s | 0,06 s |

- La **compactación** de la memoria ya no bloquea el turno: se hace después, en segundo plano, con su propio candado. Por eso la memoria (diario, anales, detalles) vive en su propio documento (`mesa/memoria`) y no se pisa con el guardado de cada turno.
- Se quitaron lecturas duplicadas y esperas encadenadas: se lee el estado una vez al empezar, la comprobación previa al guardado va en paralelo y las escrituras finales también.
- La crónica se **redibuja una vez por fotograma** y solo lo vivo: los turnos ya acabados se reutilizan, en vez de reconstruir los 60 con cada trozo de texto.
- El estado que se manda al DM **no crece con cada jugador**: solo el que actúa lleva la ficha completa, y los demás una línea (con 5 jugadores, un 64 % menos de estado). La ficha completa de cualquiera se pide con `consultar_reglas {tema: "ficha"}`.

## Voces y trama

Para que los PNJ no se repitan y la historia no dé vueltas:

- **PNJ con voz propia** (`pnj`): cada personaje con nombre tiene rol, forma de hablar, lo que quiere, su actitud hacia el grupo y lo que ya ha dicho. Una amenaza, un soborno o una adulación producen respuestas distintas, y si se le pregunta lo mismo dos veces, reacciona a la insistencia.
- **Frases ya usadas**: la página extrae los diálogos de los últimos turnos y se los pasa al DM para que no los repita.
- **Hilo de la trama** (`trama`): objetivo del grupo, pistas reveladas (que no se pueden volver a esconder), como mucho **tres hilos abiertos** (el programa no deja abrir un cuarto sin cerrar otro) y una amenaza con reloj de 6 pasos que avanza cuando el grupo pierde el tiempo y golpea al llenarse.
- **Aviso de estancamiento**: si pasan tres turnos sin que la trama avance, el DM recibe la orden de revelar algo, cerrar un hilo o mover la amenaza.

## Combate

La iniciativa y los ataques los resuelve el programa (`iniciativa`, `atacar`, `terminar_combate`), no el DM a ojo. Lo que más pesa no es el nivel, sino la **veteranía**, que el DM fija según el trasfondo (un mercenario con años en la Compañía es veterano aunque sea nivel 1):

- **Recluta**: los nervios le pesan mucho (de −2 a −5) y se enreda con 1-2 natural (torpeza: falla y queda expuesto), salvo si actúa antes que su rival. Fácil de sorprender.
- **Curtido**: +1 a atacar e iniciativa; nervios moderados (−1 a −3); si falla por 1, aún roza.
- **Veterano**: +2 a atacar e iniciativa; solo le afectan los nervios con tres presiones o más; solo falla seguro con un 1; si falla por 2 o menos, roza (mitad de daño, sin herida). Duerme con un ojo abierto.
- **Leyenda**: +3, casi inmune a los nervios, repite el 1 natural, roza si falla por 3 o menos y hace crítico con 19-20.

Los **nervios** suman una presión por cada cosa que aprieta: golpear después que el rival, enfrentarse a algo terrible (un jefe o una criatura de peligro 4+), estar malherido o tener un carácter tenso.

**Emboscadas y planes**: el sigilo del más torpe del bando que embosca contra la percepción de cada rival (sabiduría, veteranía, sentidos de su raza, carácter y si estaba dormido, distraído o en guardia). Los sorprendidos pierden el primer asalto y se les ataca con ventaja. Un plan **bueno** o **brillante** da iniciativa, sigilo y ventaja en el primer asalto contra quien no sepa leerlo.

**Personalidad** (1 o 2 rasgos por personaje, PNJ o criatura): arrogante y confiado subestiman y son fáciles de sorprender; impulsivo y temerario golpean antes pero caen en trampas o se descubren; prudente, calculador y paranoico huelen las emboscadas y leen los planes; sereno y fanático aguantan los nervios; el cobarde los sufre.

Cada raza tiene su temple (los elfos marchitos y los nacidos pálidos golpean primero, los enanos arrancan tarde pero pegan más fuerte, los medianos repiten los 1) y cada clase su estilo (el degollador actúa antes, el berserker pega más fuerte pero se enreda más, el hechicero no es un guerrero). Los no-muertos sin mente, como los Hambrientos, son lentos y torpes. Los PNJ sin ficha, como un capitán, entran en el combate con su propia veteranía. Con dano, el ataque tira y aplica el daño y avisa cuando toca una herida.

### Armaduras y armas

La CA decide si te tocan; la armadura decide si el golpe **atraviesa**. Cada golpe cae en una región del cuerpo, y la protección de lo que cubre esa región se resta al daño según el tipo de arma: **corte** (espadas, hachas, garras), **punta** (dagas, lanzas, flechas, virotes, picos) o **contundente** (mazas, martillos, garrotes, rocas). La protección que queda además rebaja la gravedad de la herida.

- El gambesón frena muy bien los cortes; la malla, casi del todo, pero cede algo ante las puntas y no hace nada contra el golpe; las placas paran cortes y puntas, pero no del todo un mazazo.
- Las dagas, ligeras, apenas hacen nada contra el metal golpeando al azar; apuntando a un **hueco** (penalizador menor cuanto más veterano), el metal no cuenta y la herida es peor.
- Mazas y martillos son **brutales**: agravan la herida aunque haya placas. El pico de guerra y el virote están hechos para perforar armadura.
- Las criaturas tienen su piel (escamas, pellejo) y los esqueletos son de **hueso**: las mazas los destrozan.
- Las heridas de un ataque las inflige el propio ataque, en la región donde cae y con el tipo de herida del arma.

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

Los jugadores ven en todo momento el mapa ilustrado de Velmora (`web/mapa-velmora.jpg`, que el script `npm run artifact` incrusta en la página) con sus seis regiones, los lugares que vayan descubriendo, el rastro del camino recorrido y un sello de lacre donde está el grupo; durante un viaje, la ruta y lo que llevan recorrido. El DM lo mueve con la acción `ubicacion` cada vez que llegan a otro sitio o viajan (en la página de claude.ai, en el lateral o en «Ver mapa» en el móvil; se amplía al tocarlo).

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

Únicas en toda la campaña (solo existe una de cada) y casi imposibles de conseguir: salen solo del botín de jefes (2 %) o cuando el DM las pone en la historia. Todas protegen frente al Eclipse. **Colmillo de Hierro** (espadón descomunal, letal contra demonios y apóstoles; corta el alma, así que anula la regeneración de la Madre de los Hambrientos y puede destruirla), **Lanza de la Primera Llama**, **Escudo de Aldren el Fiel**, **Daga del Último Rito** (corta profecías y presagios) y **Martillo del Herrero Ciego** (obliga a los cambiaformas a mostrarse). El DM puede inventar más.

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
- Para invitar a alguien: menú **Compartir** de la página. Las partidas se guardan en los datos compartidos de la página, y quien solo puede mirar no puede jugar (la página se lo avisa con un mensaje de «solo lectura»). Según tu caso:
  - **Cuenta personal** (jugadores de fuera de tu organización): invítalos por su correo como **Editor** y **desactiva el enlace público**. Con el enlace público, los de fuera solo pueden mirar.
  - **Organización** (Team o Enterprise): los miembros pueden entrar por el enlace con permiso de **Colaborador**.
  - Cada jugador necesita su propia cuenta de Claude con la sesión iniciada. Quien entra sin sesión no puede ni ver la partida.
- Memoria del DM en tres capas. Los **anales**: cada vez que hay más de 8 turnos sin resumir, la página pide a Claude (modo rápido) un capítulo con lo ocurrido y lo añade al final; los capítulos nunca se reescriben, y solo cuando pesan demasiado los cuatro más viejos se funden en uno. La **situación actual** (dónde estáis, misión, PNJ, promesas, objetos, hilos abiertos) se actualiza en cada compactación. Y los **turnos recientes** enteros: si una compactación falla, no se descarta ningún turno, y se reintenta antes de narrar. Cada compactación apunta también los **detalles menores** (nombres de secundarios, precios, objetos prestados, apodos, cómo es la gente) en una lista aparte que el DM recibe siempre; si crece demasiado, los más viejos se agrupan sin perder nombres. Además, el DM guarda con anotar_mundo los hechos que no deben resumirse nunca, y su crónica privada admite hasta 2500 caracteres. Los jugadores leen los anales y la situación en el *Diario de la aventura*.
- Para regenerar la página tras cambiar el motor: `npm run artifact` (genera `dist/mesa-de-velmora.html`) y publícala de nuevo en la misma dirección.

### Turnos: cada jugador habla cuando le toca

Con dos o más jugadores, la mesa juega **por turnos** para que el DM reciba una sola acción cada vez y la secuencia sea siempre clara (acción → respuesta del DM → siguiente jugador):

- Encima del cuadro de texto se ve el orden de la ronda (el de llegada a la mesa) y de quién es el turno. Quien no tiene el turno puede ir **preparando** su acción, pero no enviarla hasta que le llegue la palabra.
- El DM recibe solo la acción de quien juega, la narra con su consecuencia inmediata y le pasa la palabra al siguiente por su nombre. Al último jugador de la ronda le añade el cierre de la ronda: el mundo responde (enemigos, PNJ, el tiempo, la amenaza) y la trama avanza un paso.
- **Pasar turno** lo usa quien no quiere hacer nada; no gasta una llamada al DM. Si alguien se ha ido (la página deja de dar señales de vida), cualquiera puede **saltar su turno** al momento; si sigue conectado pero no actúa, se puede saltar pasados dos minutos.
- El lateral **En la mesa** muestra quién está sentado, quién está ausente y de quién es el turno, y tiene la casilla **Jugar por turnos**: desmarcada, vuelve el modo libre de antes (las acciones esperan en cola y el DM las resuelve juntas). Con un solo jugador no hay turnos.
- **Creación de personaje:** mientras la ficha de un jugador no esté guardada (`guardar_personaje`, que queda ligada a su nombre de jugador), su turno no pasa: el DM le guía solo a él y no da la palabra a nadie más, y tampoco puede pulsar «Pasar turno». Si se atasca, los demás pueden saltarlo pasado el tiempo de espera. En partidas antiguas, cuyas fichas no tienen dueño, no se exige.
- Reiniciar la partida devuelve el turno al primero y mantiene sentados a los jugadores. Las tiradas con `/tirar` y los comandos se pueden usar siempre.
- La lista y el orden se guardan en los datos de la página (`jugadores/<id>` y `mesa/orden`); el turno solo lo mueve quien narra, para que no se pisen.

### Cuando a un jugador se le acaban los usos

Cada jugador narra con los usos de Claude de su propia cuenta. Si a una cuenta se le acaban (límite de uso, cuota o cuenta sin acceso a Claude), su página lo avisa, se marca con **sin usos** en la lista «En la mesa» y deja de intentar narrar. Sus acciones siguen en cola y las narra otro jugador conectado al que sí le queden, así el reparto es automático y la mesa no se para. Pasados unos minutos (una hora si la cuenta no puede usar Claude) vuelve a intentarlo sola, y la marca se quita en cuanto narra bien. Si no hay nadie más con usos, se avisa.

### Trasfondo de los jefes

Cada jefe puede llevar un **trasfondo** en su ficha (`consultar_reglas criatura`): su historia establecida, sus enemigos, pistas para ir revelándolo, lo que se **propone** sin confirmar y lo que sigue **abierto**. Solo lo ve el DM; los PNJ únicamente conocen rumores y leyendas.

- **Vaskar, el Lobo del Eclipse** (establecido): en la época de los dioses era un hombre traicionero y de malas intenciones que practicaba magia negra. Cazó un lobo para usar sus dientes en un ritual; era hijo del dios de la luna, que conocía sus intenciones y lo maldijo mientras dormía bajo la luna, convirtiéndolo en lobo para la eternidad. De esa maldición nace la de los Varg. Su enemigo es el primer Inquisidor (el Juez Sin Ojos), por la magia negra y la ofensa a los dioses; la enemistad se refleja también en la ficha del Juez y en los jefes fuera de zona (si uno está activo cerca, chocan). Confirmado (todo lo anterior y lo siguiente): el dios de la luna se llama **Kashi**; el ritual era robar la **esencia de Kashi a través de uno de sus hijos** (el lobo) para alargar su vida; el Juez **llegó tarde** a juzgarlo y Kashi le retiró su favor; Kashi murió con los antiguos dioses y la maldición no se puede levantar; Vaskar conserva su astucia y su vileza; los Varg son sus «hijos»; y busca en el **Velo Rojo** objetos mágicos que rompan su maldición, pero los objetos que se rumorean allí son **todos rumores o señuelos**: las reliquias reales son de verdadero poder de Kashi, sus sentidos malditos **no pueden detectarlas** y puede que ya ni estén en el bosque. Añadido después: las reliquias de Kashi **solo las puede usar un humano y solo bajo la luna llena** (noche en la que Vaskar no puede salir), y una de ellas es la **Falange de Kashi** (la falange del dedo anular del dios, símbolo de su unión con los seres de la luna): da bonus contra los Varg y teletransporta, en noches de luna llena, a cualquier lugar al que llegue la luz de la luna. Vaskar **no tomó esencia** de Kashi. **No hay más reliquias de Kashi**: la Falange es la única. Confirmado también: que necesita manos humanas ajenas (engaña, chantajea o recluta a buscadores), que quien porte una reliquia de Kashi es invisible a sus sentidos y que saqueadores e Inquisición siguen los mismos rumores.

- **El Juez Sin Ojos** (establecido): hijo de Ka'i, el dios del sol (el dios Solar), y de una humana (la madre no es relevante). Los dioses le dieron la habilidad de ver la naturaleza divina y maldita de cada cosa y lo hicieron guardián de sus creaciones y de todo lo divino: el primer Inquisidor. Llegó tarde a juzgar a Vaskar y Kashi le retiró su favor. Se arrancó los ojos al quedar atrapado cuando fue a socorrer a su padre, ante la inminente muerte de Ka'i, que le recordó su misión y le pidió no flaquear ante el mal. **Conserva su don sin ojos.** Vive en la catedral hundida porque fue el último lugar donde habló con su padre; la catedral solo guarda sus cosas, su botín y los recuerdos de Ka'i. Confirmado: Ka'i es el dios Solar cuyo corazón guarda Kharoth, la Llama Gris es el fuego del sol de su padre, falló como guardián (expía su culpa) y detecta lo divino y lo maldito a gran distancia. **Botín:** el Rayo de luz solar primigenia (+2 a ataque y daño contra no-muertos y malditos, ilumina la oscuridad más grande en 36 m y acaba con los vampiros: CON CD 20 o mueren, y si superan la salvación quedan a 0 PV y arden; cifras confirmadas).
- **Ysolde, la Reina Pálida** (establecido): hija de Dracone, el «Primus Imperatus», el primer regente pálido, que unificó a los pálidos con una mezcla de fuerza y política y que hoy forman parte de su orden (la Corte Pálida). Dracone rechazaba la idea imperialista por ética (su raza era demasiado civilizada y podía desatar barbarie); Ysolde lo veía poco ambicioso. Después de la Caída lo mató con su propia mano en un golpe de estado, tras una fiera pelea, con su magia y absorbiendo su esencia vital. Su idea imperialista: someter la Marca Hueca entera, luego Velmora, con Aldenmar como premio («imperio» para ella, «orden» para Dracone). También confirmado: la corona pálida era la de Dracone y está maldita por su muerte; los «Fieles del Primus» (leales); los Caballeros de Vel Morhal (su guardia de honor, algunos la odian) y su ataúd junto al sepulcro del padre; la enemistad con el Juez y el Rayo de luz solar primigenia; y Kuru como cazador. Sin nada pendiente.

- **Misión semilla de Vaskar** (aprobada): «El hueso que brilla con la luna» resuelve dónde está la Falange. Mirel, una buhonera humana, contrata al grupo para hallar «un hueso de dedo que brilla con la luna llena» (Vaskar retiene a su hijo, un Varg, como rehén); la Falange está en Aldenmar, en manos de Odrec, un vendedor de huesos que la usa como amuleto sin saberlo; la Inquisición, los saqueadores y Kuru van tras ella. Cuatro desenlaces (dársela a Vaskar, quedársela, entregársela al Juez o destruirla). Confirmado: **la Falange no tiene poder para romper nada**, así que Vaskar solo cree que lo libera; si se la dan, no rompe su maldición (y él ni siquiera puede usarla), y su reacción queda a criterio del DM. Sale en el resultado de `encuentro` cuando el jefe forzado es Vaskar.

### Regentes: política en segundo plano

El Juez Sin Ojos, Ysolde y la Madre de los Hambrientos no solo mandan monstruos: **maniobran para imponerse** en otras regiones. Cada uno tiene su objetivo, sus medios y sus agentes (en el bestiario) y la herramienta `regente` registra sus jugadas: comprar voluntades, espiar, sabotaje, chantaje, propaganda, emisario, alianza y traición. Las jugadas suben su **influencia por región** (0-5), añaden espías o bajan la influencia del rival saboteado, y esa influencia empuja la tabla de encuentros (más corte pálida donde manda Ysolde, etc.).

Sus **relaciones no son fijas**: parten de una base (Juez–Ysolde rivalidad, Juez–Madre guerra, Ysolde–Madre neutral) y varían con la situación: regiones disputadas, jugadas hostiles recientes, alianzas y amenazas grandes (reloj ≥ 4) que obligan a tregua. El DM también puede fijar una relación (`accion: relacion`) y esa manda. Si pasan 10 turnos sin jugadas, el DM recibe un aviso para mover ficha y hacer llegar el eco a los protagonistas.

### Reglas básicas de D&D 5e (en curso)

Se van incorporando las reglas del documento «Reglas Básicas D&D 5ª» que faltaban, una a una y con pruebas:

1. **Condiciones con efectos reales** (`condicion`): cegado, hechizado, ensordecido, asustado, agarrado, incapacitado, invisible, paralizado, petrificado, envenenado, derribado, retenido, aturdido, inconsciente y agotamiento 1-6. Dan ventaja o desventaja en ataques y pruebas, hacen fallar solas las salvaciones de FUE/DES, vuelven críticos los impactos a quemarropa sobre paralizados e inconscientes, impiden atacar al incapacitado y se recuerdan al empezar cada asalto. Valen para personajes, criaturas y PNJ.
2. **Acciones, reacciones y ataques de oportunidad** (`accion_combate`, `reaccion`): esquivar (desventaja a los ataques contra quien esquiva y ventaja en sus salvaciones de DES), correr, retirarse, ayudar (el aliado ataca con ventaja, una vez), preparar una acción y esconderse. Cada combatiente tiene una reacción por asalto, que se recupera en `siguiente_asalto`. Al mover en el plano durante un combate, el programa avisa de quién sale del alcance de un enemigo sin retirarse y puede recibir un ataque de oportunidad.
3. **Salvaciones contra muerte** (`salvacion_muerte`, `estabilizar`): quien cae a 0 PV queda inconsciente y el programa cuenta éxitos y fallos (10+ éxito, 1 natural dos fallos, 20 lo levanta con 1 PV; tres éxitos estabilizan, tres fallos matan). Cada golpe en el suelo es un fallo (dos si es crítico) y un golpe de tantos PV como su máximo lo mata. Un compañero estabiliza con Medicina CD 10 y cualquier curación lo despierta. La cuenta aparece en su ficha.
4. **Experiencia y subida de nivel** (`experiencia`, `subir_nivel`): tabla de PX de 5e (300, 900, 2700…), PX por peligro de la criatura repartidos entre el grupo, y subida con PV (promedio o tirada + CON), competencia, aumento de característica en los niveles 4/8/12/16/19 y rasgos de clase de los ocho oficios hasta el nivel 5 (ataque adicional incluido). Se puede subir por hito sin PX. La ficha muestra PX y los rasgos ganados.
5. **Agarrar, empujar y cobertura** (`maniobra`, `cobertura` en `atacar` y `prueba`): prueba enfrentada de Atletismo contra Atletismo o Acrobacias para agarrar (deja «agarrado»), derribar o apartar 1,5 m (mueve el plano) y para zafarse; exige alcance cuerpo a cuerpo. Cobertura media (+2 CA y salvaciones de DES), de tres cuartos (+5) y total (no se puede atacar).
6. **Rasgos con usos y descansos** (`usar_recurso`, `descanso`): el programa cuenta los usos de rasgos de clase (por ahora los del Mercenario: Segundo aliento, 1 por descanso, y Acción súbita desde el nivel 2) y los recupera con descansos cortos (1 h) y largos (8 h). El Mercenario es la clase más genérica: su don arcano, si lo tiene, duerme hasta el nivel 2. Su identidad es la Compañía del Cuervo Negro (Pluma y Código del Cuervo, confirmados) y su **rango sube con el nivel**: Polluelo, Cuervo (nv. 3), Garra (5), Corax (8), Ala Mayor (11) y Aspirante al mando (17), cada uno con ventajas y mando. La Compañía es una organización con cuarteles en varios lugares (el general, en Aldenmar) y la dirigen dos mariscales, Hugin y Munin: su puesto solo se ocupa por renuncia o muerte, y cada 4 años, alternando, se celebra un concurso de méritos para ceder el de uno de ellos (cada puesto, cada 8 años). Concursa cualquier Ala Mayor y el mérito se puntúa con `concurso_compania` (hazañas, clamor de la tropa, combate de prueba y decisión de los mariscales; mínimo 24 de 40). Hugin (el Pensamiento) y Munin (la Memoria) están en el bestiario como PNJ con carácter propio (propuestos). Si nadie está a la altura siguen o eligen a alguien capaz; si uno se niega a ceder, el otro lo depone por la fuerza.
7. **Fama y Leyenda** (`hazana`, `coronar_leyenda`): el nivel extra, para cualquier raza o clase. El DM anota hazañas con magnitud 1-5 y tono (gloria o infamia) y la fama cambia cómo reacciona el mundo. Para ser leyenda hacen falta nivel 5, 20 puntos de hazañas épicas (magnitud 4-5) y al menos dos de magnitud 5. La leyenda recibe un título, +1 de competencia, PV, +2 a una característica (máx. 22), el Aliento de leyenda (1 por descanso largo: convierte un fallo en éxito) y ventaja social ante quien conoce su nombre, y atrae retadores, cazadores de leyendas y a los regentes.
8. **Berserker de Ceniza: la furia de Æsir** (`usar_recurso` «Furia»): vestigio de la conexión con Æsir, el dios más antiguo; se les elige de niños en un rito y se les enseña a sobrevivir y a luchar. Se reconocen por la mecha gris del pelo, que al invocar la furia se vuelve cenizo entero. Dura 10 asaltos; 2 usos por descanso largo (3 desde el nivel 3, 4 desde el 6). Cobra su precio: **INT y CAR a la mitad y +2 al modificador de FUE (se suma al bono base)** mientras dura (lo aplica el programa en todas las tiradas), con +2 al daño cuerpo a cuerpo, resistencia al daño físico y sin penalizaciones de heridas. En los niveles 1-2 es un **trance**: no distingue aliados de enemigos y el programa hace caer su golpe sobre cualquiera a su alcance; la furia deja **marcas de Ceniza permanentes** (no se pueden quitar) en todo el que hiere, personajes, criaturas y PNJ (una marca por individuo y furia); si el herido es otro personaje, el Berserker carga también con una. Desde el nivel 3 es lúcida (y quien lo golpea cuerpo a cuerpo se quema con la Senda de la Ceniza). En el nivel 5 **cierra las heridas rojas** mientras dura; al terminar, salvación de CON y las heridas se reabren. Lo que los hace especiales es su fiereza y su fortaleza física: +1 PV por nivel y ventaja en las salvaciones de CON. Pueden aprender magia de refuerzo (Vigor de ceniza), y de la elemental solo rayos y hielo básicos (hasta círculo 2); encantar un arma para que regrese exige nivel 9, maestría de adepto o afinidad.
9. **Caballero Juramentado: el juramento a Ka'i** (`juramento`, `romper_juramento`, `imposicion_manos`, `usar_recurso` «Sentido divino», `atacar {castigo}`): honor y fe. El juramento le da su poder mágico y es una liga estirada: jura de 1 a 5 votos de Ka'i (Verdad, Amparo, Lealtad, Luz, Descanso, Merced); cuantos más, más maestría (iniciado, adepto con 3 votos, maestro con 5), más reserva de imposición de manos (nivel × (3 + 2 × votos) PV) y más castigo divino (2d8, 3d8, 4d8)... y más duele romperlo: con 1-2 votos, debilidad (agotamiento); con 3, su propio poder lo quema; con 4, lo abrasa y deja herida grave; con 5, pierde el juramento y toda magia divina para siempre (los demás casos se expían). Su magia deja una marca de Ceniza de cada cuatro usos. Sentido divino (18 m, 36 m desde el nivel 4) lista los no-muertos de la escena con su distancia real; la imposición de manos cura PV sin Ceniza y cerrar una herida cuesta 5 PV de la reserva; la salud divina (nivel 3) da +5 contra las infecciones; y a **nivel 5 su magia divina expulsa la Podre** de una herida (cuesta 10 PV de la reserva), lo único que puede con ella. Desde el nivel 3 cada voto concede una ventaja visible en la ficha.

### Variedad de enemigos

- **Antes:** el DM elegía los enemigos él solo, sin azar, y tendía a repetir los que más pesan en la ambientación (Hambrientos, Inquisición de la Llama Gris). Los dados de combate sí eran aleatorios, pero **qué** aparecía no.
- **Ahora:** la herramienta `encuentro` tira de verdad en una tabla (humanos, fauna y monstruos, no-muertos, culto, Corte Pálida, Inquisición, peligros del entorno, encuentros sociales y hallazgos) ponderada por la región donde está el grupo, la hora, el nivel medio y la dificultad. Cada resultado trae quiénes son, qué quieren, cómo evitarlos o resolverlos sin pelear y cómo montarlos.
- **Bonus de región:** cada región pesa más ciertas familias: Aldenmar (humanos, Llama Gris, cultos y encuentros sociales), Ciénagas de Hollín (monstruos de pantano, peligros del terreno, devotos), Karak-Dûm (monstruos de cueva, derrumbes, saqueadores), Bosque de Velo Rojo (fauna, espectros, Corte Pálida), Marca Hueca (no-muertos, monstruos, Corte Pálida) y Agujas de Vahl (wyvernos y dragones, pasos peligrosos). El DM ve el bonus de la región donde está el grupo.
- **Jefes fuera de su zona:** cada encuentro tiene una pequeña probabilidad (≈5 %, más en regiones peligrosas, con la amenaza en marcha o en dificultad alta) de ser un **jefe lejos de su sitio**. Casi siempre salen solo sus indicios o un emisario; en persona, rara vez y solo a partir de cierto nivel (con nivel bajo nunca). El resultado trae su plan y varias razones posibles para que el DM explique por qué está allí, y puede conectarse con la misión en curso (`mision`) o forzarse (`jefe`) para que una misión sea consecuencia del plan de un jefe. El DM debe registrarlo como PNJ con agenda y arco en segundo plano, y el programa le avisará cuando lleve turnos fuera de escena para que su avance llegue como eco.
- **Regentes:** el Juez Sin Ojos (regente de la Inquisición de la Llama Gris), Ysolde (reina de la Corte Pálida) y la Madre de los Hambrientos (soberana de los Hambrientos) gobiernan un dominio: tienen subordinados en su ficha (inquisidores, acólitos y sabuesos; esbirros, caballeros, ghuls y jauría; Hambrientos, ghuls, devotos y gigante de hueso) y una habilidad para convocarlos. Pueden **enviar monstruos y minions a cumplir su voluntad sin estar presentes** y, si dan la cara, llevan siempre su séquito. Cuando uno de ellos sale como jefe fuera de zona, casi siempre lo hace a través de un subordinado (≈ 70 % emisario, menos del 10 % en persona), y el DM debe dejar ver quién lo manda.
- **Botines nuevos:** la Madre de los Hambrientos (Corazón de la Fosa, Costuras de la Madre, Cera de sepulcro y lo que se tragó la fosa) y El Que Golpea Bajo la Piedra (Diente de la Piedra, Cristal de los hondos, Mena viva y los planos de la Fortaleza Silente).
- **Kuru, el Cazador de Leyendas** (nuevo jefe, peligro 5): maestro de armas sin patria que caza lo legendario. Extremadamente marcial (+13 al ataque, crítico 19-20, apunta a las juntas de la armadura), **adaptable** (aprende de cada tipo de daño y táctica nuevos: resistencia o ventaja contra ellos, hasta 3 por combate) y **escurridizo** (se desengancha sin provocar, se esconde a la vista, humo de ceniza, retirada calculada al bajar de la mitad de PV y vuelve con una adaptación más). Habilidades: Estudiar a la presa, Danza de las cien heridas, Humo de ceniza y Estocada de leyenda.
- **Memoria:** el programa recuerda los últimos encuentros y penaliza repetir familia (nunca salen más de dos seguidos de la misma, y los no-muertos quedan en torno a una quinta parte). `aparecer_criatura` se niega a poner un tercer encuentro seguido de la misma familia salvo `repetir=true`, y el estado del DM muestra un aviso cuando se abusa de una.

### Espacio, tiempo y pruebas estrictas

- **Mapa nuevo y fiel:** la ilustración es la de 821 × 953, con una rosa de los vientos (norte arriba). `ubicacion` acepta `direccion` (N…NO) y `distancia`: «la garita norte» queda de verdad al norte de la ciudad y, si un lugar estaba mal puesto, se recoloca. El DM ve el rumbo real de cada lugar desde el grupo. Las partidas guardadas con el mapa anterior se migran conservando los rumbos.
- **Plano de la escena** (`plano`): puntos en metros (personajes, PNJ, criaturas y referencias como el fuego o el carro), con el norte arriba. El DM los coloca y los mueve antes de narrar; el programa calcula distancias y rumbos y se los devuelve como verdad. Los jugadores lo ven dibujado bajo el mapa. Con los dos en el plano, un ataque cuerpo a cuerpo comprueba el alcance (2 m; 3 m con asta) y uno a distancia, hasta 120 m.
- **Reloj del mundo** (`tiempo`): día y hora, que el DM avanza cada turno según lo que dura la acción; los asaltos (6 s) y los días de reposo lo mueven solos. Aparece en el mapa, en el tablero y en cada paso de la secuencia.
- **Pruebas estrictas** (`prueba`): cada habilidad usa su característica y se rechaza la que no corresponde («la Inteligencia no influye en Persuasión»), la competencia sale de la clase (o del trasfondo, si el DM la justifica; el Barbero-Cirujano tiene pericia en Medicina), un personaje a 0 PV no puede hacer pruebas, y `tirar_dados` ya no vale para pruebas de un PJ. Las reglas del DM le piden además comprobar antes que lo que se intenta se puede hacer (objeto, hechizo, alcance, estado).

### Narrativa por arcos y PNJ vivos

- **Arcos con principio, nudo y desenlace:** la trama se lleva en arcos (`trama`: `abrir_arco` con su premisa, `avanzar_arco` a nudo o desenlace con un hito, `cerrar_arco` con su desenlace). Como mucho 3 abiertos a la vez; los jugadores ven avisos 📖 en cada paso. Los hilos de partidas antiguas pasan a ser arcos en su nudo.
- **Ritmo:** el programa cuenta los turnos de cada arco en su fase y avisa al DM cuando se alarga (inicio 3, nudo 7, desenlace 3 turnos). Un arco no se cierra sin desenlace, y los arcos resueltos quedan anotados para no reabrirlos ni repetirlos. Cada escena es un mini-arco que no deja nada en el aire.
- **PNJ que no se quedan parados:** cada PNJ tiene una `agenda` (qué hace cuando nadie lo ve) y puede incidir en un `arco`. El programa cuenta los turnos que lleva fuera de escena y, pasados 3, avisa al DM de que mueva ficha: su avance llega a los protagonistas como un eco breve (un rumor, un mensaje, una huella, una llegada), no como un resumen de lo que hace cada uno. Al cerrar un arco avisa de qué PNJ se quedan sin asunto para darles una agenda nueva o un final.
- **Foco en los protagonistas:** los PNJ existen para empujar, tentar, estorbar o ayudar a los jugadores; el DM no narra lo que hacen todos a cada momento.

### Formulario de personaje y aventuras nuevas

- **Crear personaje:** el botón **📜 Crear personaje** (o `/personaje`) abre un formulario con todo lo que hace falta: nombre, raza, clase, veteranía, personalidad, atributos (serie estándar o 4d6kh3 hechas por la página, con sugerencia de reparto para la clase), escuelas de magia si es Hechicero, equipo extra y trasfondo. La página calcula los atributos finales con el bono racial y los PV, y envía una **ficha completa** al DM, que la guarda tal cual sin preguntar nada más.
- **Reiniciar de verdad:** el diario, los capítulos y los detalles se borran también en las demás páginas abiertas, y una compactación que estuviera en marcha no los vuelve a escribir.
- **No repetir tramas:** al reiniciar, la aventura que acaba se resume (apertura, objetivo, amenaza, hilos, giros, PNJ, lugares) en `mesa/aventuras`, que el reinicio **no** borra (guarda las últimas 8). El DM recibe esa lista como «aventuras anteriores: no las repitas» y debe inventar un gancho, unos PNJ y unos lugares distintos.

### Análisis de confusiones del DM

- **Bitácora de errores** (`errores/`): cada fallo que ve una página (JavaScript, base de datos, DM) queda con el estado de la mesa en ese momento, sin el texto de los jugadores.
- **Correcciones** (`correcciones/`): cada vez que alguien usa «Corregir al DM» queda lo que el DM respondió mal, la acción original, las tiradas que hizo y la frase de corrección. Sirve para ver en qué se equivoca y por qué.
- **Reglas de interpretación** (en el prompt del DM): resolver «el mago» o el nombre del jugador como el personaje que es, tomar lo escrito como intención y no como resultado, resolver las acciones encadenadas una a una con su tirada, no inventar cifras, no hablar de herramientas ni errores y pedir las opciones válidas al crear el personaje.
- **Guía para jugadores** en el «Cómo jugar»: cómo escribir las acciones para que el DM las entienda.
- Una acción ya narrada no se vuelve a narrar aunque la base de datos tarde en mostrar el turno guardado.

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
| `src/mapa.ts` | Mapa: regiones (en píxeles de la ilustración), lugares, posición del grupo y viajes |
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
