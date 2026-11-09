# Artes marciales de Velmora — modelo (borrador)

Estado: **modelo propuesto, sin implementar.** Lo que dijo el usuario es canon; lo demás es «decisión mía, a confirmar».

## Canon (lo que ha pedido el usuario)
- 4 o 5 estilos, cada uno centrado en algo distinto; **más uno centrado en agarres y llaves, que también se puede aprender con las clases** (6 en total).
- **Kuru, el Cazador de Leyendas**, los domina todos o los copia con solo verlos.
- **Haemajitsu** (arte del Flagelante, solo aprendible por Flagelantes): control de la sangre en los puntos que tocarán al enemigo. La acumulan ahí y la hacen fluir muy rápido, lo que da fuerza y dureza al cuerpo. **Es la lógica del arte, no un bonus nuevo.** **Gasta sangre propia** (confirmado). **Si la historia lo justifica, otros pueden aprenderlo** (confirmado). Sus golpes sin armas son comparables a los de un arma contundente y lo hacen de forma **pasiva** (sin gastar acción ni recurso).

## Qué existe hoy y sobre qué se apoya
- Flagelante (monje base): «golpes sin armas de 1d4» (texto, sin lógica) + Comunión del dolor (+1..+4 al daño según el dolor), Sangre fría, Sangre ajena, Cadenas.
- Armas contundentes (`armadura.ts`): la maza es «brutal» (agrava la herida) y penetra la protección; maza = 1d6.
- `maniobras.ts`: agarrar, empujar y escapar (Atletismo/Acrobacias) para cualquiera.
- Kuru: ADAPTACIÓN (3 por combate, aprende lo que ve), ESCURRIDIZO, Estudiar a la presa, crítico 19-20.

## Modelo general (propuesto)
Un **estilo** no es una clase: es una tradición con un principio y tres técnicas.
- **Principio** (pasivo, siempre activo, sin coste): la «lógica» del estilo. Pocos números; explica *por qué* funciona.
- **Tres técnicas** por niveles de maestría: **Iniciado → Practicante → Maestro** (se desbloquean con `nvl()` como el resto de rasgos de desbloqueo: p. ej. nv. 3 / 7 / 11 reales en la mesa).
- **Aprender (dos vías, propuesto):** (a) con un maestro del estilo, tiempo (varias jornadas por maestría) y la dote «Discípulo de <estilo>»; (b) **por la clase:** las clases marciales ofrecen un estilo propio como rasgo (ver tabla), sin dote ni maestro, al ritmo del nivel. **Un personaje conoce un solo estilo** (dos con INT o SAB 14+ y un segundo maestro). Cada maestría exige la anterior.
- Las técnicas usan lo que ya hay: maniobras, heridas, condiciones y el temple de combate. No hay recursos nuevos.

## Los 6 estilos (propuestos)
| Estilo | Centrado en | Principio | Técnicas (Iniciado / Practicante / Maestro) | Quién lo enseña |
|---|---|---|---|---|
| **Haemajitsu** | Impacto y dureza | Sangre acumulada en los puntos de contacto: los golpes sin armas cuentan como arma contundente y las manos no se rompen | Puño de Haema (golpe que agrava la herida) / Fluir (reacción: endurece una zona al ser golpeado) / Corriente carmesí (rompe guardia y armadura) | Solo Flagelantes de Haema |
| **Callejón de Aldenmar** | Control y juego sucio | Aprovecha lo que haya a mano y el momento: ventaja en maniobras contra rivales ocupados | Llave y zancadilla / Arena y codo (cegar o aturdir un instante) / Arrastre (agarra y usa al rival de escudo) | Los bajos fondos (Degolladores, tabernas) |
| **Piedra de Karak** | Resistencia y anclaje | Pies clavados: no lo derriban ni empujan con facilidad y devuelve el empujón | Postura de muro (CA) / Golpe de yunque (aplasta armadura) / Montaña (inmóvil, agarra y no cede) | Enanos de Karak-Dûm |
| **Danza marchita** | Evasión y contragolpe | Siglos de reflejos: mueve el cuerpo antes que el golpe; gana iniciativa | Paso de hoja (esquiva) / Contragolpe (reacción tras fallo rival) / Cien pasos (se mueve sin provocar) | Elfos Marchitos |
| **Filo del Cuervo** | Armas y formación | Combate con lo que empuña: desarmar y trabajar en equipo con aliados | Desarmar / Cuña (ventaja si un aliado flanquea) / Muralla de cuervos (cubre a un aliado) | Compañía del Cuervo Negro |
| **Presa de Hollín** | Agarres y llaves | Quien agarra no suelta: sus presas son ventaja y no le estorba el tamaño del rival (agarra hasta dos tallas mayores); mantenerlas no le cuesta la mano | Llave (agarrar como parte del ataque) / Palanca (dislocar: herida y desventaja al miembro) / Sumisión (apresado: solo se libra con éxito en prueba enfrentada; ahoga o rinde) | Barqueros y ladrones de cadáveres de Hollín (Medianos), fosos de lucha de Aldenmar; **por clase:** Mercenario del Cuervo, Berserker, Degollador |

## Estilos por clase (propuesto)
Cada clase marcial puede tomar un estilo como rasgo (sin dote ni maestro):
- Mercenario del Cuervo → **Filo del Cuervo** o **Presa de Hollín**.
- Berserker de Ceniza → **Presa de Hollín** o **Piedra de Karak**.
- Degollador → **Callejón de Aldenmar** o **Presa de Hollín**.
- Flagelante → **Haemajitsu** (suyo).
- Cazador de Brujas → **Danza marchita** o **Callejón de Aldenmar**.
- Caballero Juramentado → **Piedra de Karak** o **Filo del Cuervo**.
La **Presa de Hollín** es el estilo «abierto»: lo puede tomar cualquier clase marcial por esta vía.

## Haemajitsu en detalle (canon + decisiones)
- **Pasivo:** al golpear sin armas, el Flagelante *siempre* lo hace como con una **maza**: daño **1d6 + mod.** (sube de 1d4), **contundente y brutal** (agrava la herida, penetra protección como la maza). No gasta acción ni recurso, pero **sí sangre propia** (confirmado). Propuesto: cada asalto en que golpea con él pierde **1 PV** (nunca lo baja de 1 PV por sí solo; «sangre ajena» lo repone). Así la Comunión del dolor y Sangre ajena encajan: más herido, más daño, y se cura con la sangre de otros.
- **La lógica (sin bonus nuevo):** la sangre se concentra en el punto de contacto y fluye a gran velocidad. Eso *explica* tres cosas ya existentes: que su puño pegue como un arma pesada, que no se rompa los nudillos (sin daño propio al golpear) y por qué la Comunión del dolor le da más daño cuanto más herido.
- **Casi exclusivo (confirmado):** es el estilo de los Flagelantes; otro personaje solo puede aprenderlo **si la historia lo justifica** (un maestro de Haema, un rito, una deuda de sangre) y pagaría también con sangre propia.
- **Pregunta abierta:** ¿el dado sube con el nivel (1d6 → 1d8)?

## Kuru y los estilos (propuesto)
- **Los domina todos** los estilos normales (propuesto); el Haemajitsu no lo copia a la ligera: es sangre propia y un don de Haema (como cualquiera, solo si la historia lo justifica).
- **Copiar al verlos:** amplía ADAPTACIÓN: si ve a alguien usar una técnica, en su turno siguiente puede usarla; tras verla 2 veces en el combate, ya la tiene hasta el final. Regla de mesa: sólo copia lo que ve en el momento, no lo guarda para siempre.
- **Jugadores:** NO copian al verlos (esto es solo de Kuru).

## Pasos de implementación (si se confirma)
1. Datos: `estilos.ts` (estilos, principio, técnicas) + campo `estilo`/`maestria` en la ficha.
2. Haemajitsu pasivo en `flagelante.ts`/atacar: arma «Puño» = maza 1d6 brutal.
3. Dote «Discípulo» y enseñanza (maestro, tiempo).
4. Técnicas como opciones de `atacar`/`maniobras`/reacciones.
5. Kuru: reglas de copia en su ficha de jefe y en el estado del DM.
6. Bestiario/saber: capa de saber (los estilos como conocimiento «erudito»).
