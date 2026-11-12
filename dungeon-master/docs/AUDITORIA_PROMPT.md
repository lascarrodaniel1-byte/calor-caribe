# Auditoría del prompt del DM: reglas perdidas en los recortes

**Motivo.** Varios commits recortaron `sistemaWeb()` (`src/prompt-web.ts`) para cumplir el umbral de tamaño de `tests/motor/t-prompt.ts`. El último (009c6e7) quitó la regla del Mapa alegando que duplicaba `REGLAS_MAPA`, pero `REGLAS_MAPA` solo se entrega bajo demanda (`consultar_reglas {tema: "mapa"}`): sin esa línea, el DM podía dejar de llamar a `ubicacion`, de la que dependen el mapa, los territorios y las fronteras de los regentes.

**Método.** Se generó el prompt completo `sistemaWeb()` y el típico `sistemaWeb(["Mercenario del Cuervo"])` del commit de referencia 9fa18f8 (en un `git worktree` temporal ya eliminado) y del estado actual. Cada frase con instrucción del «antes» se buscó, normalizada, en el «después»; las que no aparecen literalmente (19 en el completo, las mismas 19 en el típico) se revisaron una a una.

**Veredictos:** (a) duplicada o equivalente en el mismo prompt siempre activo; (b) regla única perdida, restaurada; (c) movida a propósito a un tema de `consultar_reglas` con línea que remite a él.

| Regla del «antes» | Veredicto | Acción |
|---|---|---|
| Mapa: `ubicacion` al empezar, al llegar y en viajes (`viajando_hacia`, `progreso`); reutilizar nombres de lugares | **(b) perdida** | **Restaurada** en RESTO, con remisión a `consultar_reglas {tema: "mapa"}` |
| No recapitular ni repetir cifras del aviso del motor | (a) | Ya está en el LÍMITE DE NARRACIÓN de BASE |
| Nunca varias intenciones inciertas con una sola tirada | (a) | «Resuélvelas de una en una… cada una con su tirada» |
| No hables de herramientas/avisos del motor (ejemplo «repetir ubicacion con direccion») | (a) | Queda la regla; solo se quitó el ejemplo |
| Formulario: «NO preguntes ni pidas confirmación» | (a) | «NO preguntes: confirma en una o dos frases…» |
| Género: «Puede corregirlo cuando quiera» | (a) | Adorno; sigue «no lo cambies en silencio» y la pregunta única |
| RUMBOS (y «no mandes al norte a quien ya está al norte») | (a) | La regla sigue; solo se quitó el ejemplo |
| RELOJ: fijar al empezar y avanzar según lo hecho | (a) | En «Dónde y cuándo» (se quitó la repetición de `sustento`) |
| Los Hambrientos/Inquisición, una amenaza entre muchas; llama a `encuentro` | (a) | Sigue en «Variedad de enemigos» |
| Reparto de familias, 1 de cada 3, bonus por región | (a) | Sigue, más corto |
| Jefe fuera de su zona; registrarlo como PNJ con agenda y arco | (a) | Sigue (`pnj` + `trama`) |
| Motivo para estar ahí y forma de evitarlo | (a) | Sigue |
| Hambre/sed: narrar síntomas y recordar comer y beber | (a) | Sigue en SUSTENTO |
| Artes marciales y arcos/voces (texto largo) | (c) | Línea corta / `REGLAS_NARRATIVA_BASE` + `consultar_reglas` `artes` / `arcos` |
| Clima y estaciones | (c) | Línea en «Dónde y cuándo» + `consultar_reglas {tema: "clima"}` |

Resultado: **una sola regla única perdida (Mapa)**; el resto eran duplicados reales o ejemplos.

## Cambios

- **Restaurada** la regla del Mapa en RESTO (+~130 caracteres).
- **Recortes de redundancia real** (cada uno comprobado con la misma auditoría): se quitó de `sustento.ts` la repetición «fíjalo al empezar con tiempo fijar y avánzalo…» (ya en RELOJ); «Antes de una prueba di característica, habilidad y CD» de BASE (está en `REGLAS_PRUEBAS`); «los booleanos son true/false» (el catálogo de acciones ya da `true/false`); y se acortó la frase de cierre de la narración.
- **Umbral de `t-prompt.ts`: sin cambios** (completo ≤ 66.800; típico ≤ 49.285). Tamaños en caracteres: completo 66.798 → 66.788; típico 45.644 → 45.634 (los recortes absorben justo lo restaurado).

## Prueba anti-regresión

`tests/motor/t-prompt.ts` tiene ahora una lista de reglas imprescindibles siempre activas (Mapa con `ubicacion` + `viajando_hacia` + `progreso`, reutilizar nombres, `pasar_tiempo`, herramienta `prueba`, «NO inventes heridas ni saltos de tiempo» con cita literal, `consultar_reglas`, «fichas guardadas son la verdad», GÉNERO, competencia, formulario y `guardar_personaje`, don arcano, `encuentro`, `tiempo fijar`, `plano mover`, `atacar`, iniciativa/`terminar_combate`, `abrir_arco`, etc.) que deben aparecer en el prompt completo **y** en el típico. Un recorte futuro que borre alguna hace fallar la prueba.

## Regla nueva de combate: una acción por asalto (punto 76 del README)

Se añadió a `COMBATE` una regla firme («Cada criatura/PNJ actúa UNA vez por asalto en su iniciativa…», +~220 caracteres) porque el DM hacía atacar a los enemigos en el turno de cada jugador. Para hacerle sitio se recortó solo redundancia real, con la misma metodología (cada frase quitada se buscó en el resto del prompt y en los esquemas de herramientas):

| Quitado | Veredicto | Dónde sigue |
|---|---|---|
| «respeta el orden de turnos» (BASE) | (a) | La regla nueva lo dice con más fuerza |
| «ataques: atacar;» (BASE) | (a) | «Todo ataque con armas, de quien sea, va con atacar» (COMBATE, imprescindible) |
| «(oculta=true si es secreta)» | (a) | Descripción del parámetro `oculta` de `tirar_dados` |
| Detalle de razas y personalidades («no-muertos torpes… el arrogante es fácil de sorprender») | (c) | `REGLAS_COMBATE` (`consultar_reglas {tema: "combate"}`) y la descripción de `personalidad` |

Tamaño: completo 66.788 → 66.797 (umbral 66.800, **sin subirlo**); típico 45.634 → 45.643 (umbral 49.285). `t-prompt.ts` incluye la regla nueva entre las imprescindibles.

## Regla nueva: la mesa sigue la iniciativa (punto 77 del README)

Se añadió a `COMBATE` una línea («En combate la mesa sigue la iniciativa: tras narrar al jugador, resuelve los turnos de enemigos, PNJ y ausentes que van antes del siguiente jugador, y entrégale la palabra; el programa avanza el asalto», +~200 caracteres). Para hacerle sitio se recortó solo redundancia real, con la misma metodología:

| Quitado | Veredicto | Dónde sigue |
|---|---|---|
| Ejemplo «un cuchillo no pasa unas placas, una maza sí» | (a) | Lo calcula el programa; `REGLAS_ARMADURA` (consultar_reglas combate) |
| «Se puede apuntar a un hueco con daga o estoque, con penalizador» | (c) | `REGLAS_ARMADURA` y la descripción del parámetro `apuntar`; el prompt remite a «huecos» |
| «(presión: golpear después, un rival terrible, estar malherido)» | (c) | `REGLAS_COMBATE` (Nervios) |
| «(detalle en consultar_reglas)» tras raza, clase y personalidad; «no cambies en silencio lo que un PNJ tiene o hace» | (a) | La línea final «Detalle (nervios, raza, huecos): consultar_reglas»; «lo que cambie, cuéntalo como cambio, no en silencio» |

Tamaño: completo 66.797 → 66.796 (umbral 66.800, **sin subirlo**); típico 45.643 → 45.642 (umbral 49.285). `t-prompt.ts` incluye la regla nueva entre las imprescindibles.
