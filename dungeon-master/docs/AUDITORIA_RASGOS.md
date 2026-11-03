# Auditoría de rasgos: qué hace el motor y qué queda al DM

Tres estados:
- **AUTO**: el motor lo aplica solo en las tiradas (el DM no tiene que acordarse; además el estado que recibe el DM lo lista en «Rasgos que el MOTOR aplica solo»).
- **HERRAMIENTA**: existe una herramienta o recurso que lo resuelve (`usar_recurso`, `paso_elusivo`, `sellar_alma`…), pero el DM debe llamarla.
- **DM**: texto en la ficha; lo aplica el DM al narrar y tirar. Es lo que puede olvidarse.

Los niveles de la tabla son los **reales** (tabla base + 2; ver `src/niveles.ts`). Los aumentos de característica (4, 8, 12, 16, 19) no se desplazan.

## Razas

| Raza | Rasgo | Estado |
|---|---|---|
| Humano del Faro | Obstinación (ventaja contra el miedo) | **AUTO** (salvaciones cuyo motivo hable de miedo/asustado/terror) |
| | Competencia de habilidad adicional | DM (se elige al crear) |
| Enano de Karak-Dûm | Ventaja en salvaciones contra veneno | **AUTO** (motivo con «veneno») |
| | Resistencia al daño de veneno, visión en la oscuridad, hachas y martillos | DM |
| | Temple de combate (+1 cuerpo a cuerpo, −1 iniciativa) | **AUTO** |
| Elfo Marchito | Ventaja contra ser hechizado | **AUTO** (motivo con hechizo/encantar/dominar) |
| | Temple (+2 iniciativa, +1 distancia, +1 emboscadas) | **AUTO** |
| | Visión en la oscuridad, Trance | DM |
| Mediano de Hollín | Afortunado (repite el 1 natural al atacar) y Valiente (ventaja contra el miedo) | **AUTO** |
| | Sigilo natural | DM |
| Varg | Temple (+1 iniciativa y cuerpo a cuerpo, −1 distancia, olfato +2 emboscadas) | **AUTO** |
| | Mordisco, Furia de la luna | DM (el mordisco se ataca como arma «mordisco»: el motor lo trata como punta) |
| Nacido Pálido | Temple (+2 iniciativa, +1 emboscadas) | **AUTO** |
| | Visión, Mordisco vampírico, Andar de araña | DM |
| Cenizo | Resistencia al fuego, Brasa interior, Llama sagrada | DM |

## Clases (nivel real en que se desbloquean)

| Clase | Rasgo | Nivel | Estado |
|---|---|---|---|
| Mercenario del Cuervo | Estilo de la Compañía (+1 a todo ataque con armas) | 1 | **AUTO** |
| | Segundo aliento | 1 | HERRAMIENTA (`usar_recurso`) |
| | Acción súbita | 4 | HERRAMIENTA; el motor da luego otra acción de Atacar completa |
| | Veterano de compañía (crítico 19-20) | 5 | **AUTO** |
| | Ataque adicional | 7 | **AUTO** (2 ataques por acción de Atacar; avisa del tercero) |
| Berserker de Ceniza | Furia (usos, trance, daño, resistencia, heridas) | 1 | HERRAMIENTA (`furia`); lo demás **AUTO** mientras dura |
| | Ataque temerario | 4 | **AUTO** (ventaja propia y de los enemigos hasta su próximo turno; `temerario:false` lo evita) |
| | Sentido del peligro (ventaja en salvaciones de DES) | 4 | **AUTO** |
| | Furia lúcida, Senda de la Ceniza | 5 | **AUTO** |
| | Ataque adicional | 7 | **AUTO** |
| | Movimiento rápido | 7 | DM |
| | Furia que cierra las heridas | 7 | **AUTO** |
| Caballero Juramentado | Estilo de combate | 4 | HERRAMIENTA (`estilo_combate`) |
| | Castigo divino | 4 | HERRAMIENTA (`atacar {castigo}`) |
| | Salud divina, Ventaja de cada voto | 5 | **AUTO** |
| | Sentido divino mayor (36 m) | 6 | **AUTO** |
| | Ataque adicional | 7 | **AUTO** |
| | Luz contra la Podre | 7 | **AUTO** (al tratar herida con magia divina) |
| Cazador de Brujas | Estilo de combate | 4 | HERRAMIENTA |
| | Presa marcada (+1d8 a una criatura herida, una vez por turno) | 5 | **AUTO** |
| | Conciencia primigenia (sentir no-muertos a 9 m) | 5 | DM |
| | Runas, rastro y curación de las runas | 5–14 | HERRAMIENTA / **AUTO** según el caso |
| | Ataque adicional, Urumi | 7 | **AUTO** / DM |
| Degollador | Acción astuta, Ataque furtivo, Filo del asesino, Entrar y salir | 4–5 | HERRAMIENTA / **AUTO** en el ataque |
| | Ojos de gato, Ojos en la espalda, Esquiva asombrosa | 6–10 | **AUTO** |
| Flagelante | Devolver el dolor, Contacto con la sangre | 4–5 | **AUTO** |
| | Desviar proyectiles (reduce 1d10 + DES + nivel el daño de un proyectil) | 5 | **AUTO** (usa su reacción) |
| | Caída lenta, Movimiento sin armadura | 4–6 | DM |
| | Paso elusivo | 7 | HERRAMIENTA (`paso_elusivo`); automático con el dolor al máximo |
| | Ataque adicional | 7 | **AUTO** |
| | Golpe aturdidor | 7 | HERRAMIENTA (`usar_recurso`, 1 uso por descanso corto) |
| Segador | Invocaciones, Sellar almas, Descarga | 4 | HERRAMIENTA |
| | Don del pacto | 5 | **AUTO** (guadaña mágica) |
| | Ataque adicional, Descarga de dos rayos | 7 | **AUTO** |
| Hechicero | Recuperación arcana | 4 | HERRAMIENTA |
| | Dominio de lo menor | 5 | **AUTO** (precios de los hechizos) |
| | Maestro / Archimago / Ascendido (círculo y bono de lanzamiento) | 7 / 11 / 15 | **AUTO** |
| Barbero-Cirujano | Mano de cirujano mejorada, Corte limpio | 4–5 | **AUTO** en el tratamiento |
| | Mano firme, Ataque adicional | 7 | HERRAMIENTA / **AUTO** |

## Dotes

Todas las dotes con efecto mecánico están cableadas en el motor (ver `src/dotes.ts`): las que aplican bonos, ventajas, CA, maniobras o salvaciones son **AUTO**; las que habilitan una acción (Golpe demoledor, Centinela) se activan con el parámetro del ataque o la acción correspondiente.

## Cómo se evita el olvido

1. El estado que recibe el DM incluye el bloque «Rasgos que el MOTOR aplica solo»: lo que está ahí no se repite ni se olvida.
2. El libro de sucesos y el repaso (casilla «Repaso») vigilan lo que el DM debe registrar a mano.
3. Lo marcado **DM** es lo que sigue dependiendo de que el DM lo aplique; si algún caso se nota flojo en la partida, se cablea igual que los anteriores.
