# Catálogo de tipos de daño

Estado: **fase 1 hecha** (catálogo y prueba, `src/danos.ts`, `tests/motor/t-danos.ts`). Nada del juego lo usa todavía: el cableado es la fase A en adelante y es **PROPUESTA** hasta que el dueño la confirme.

## Por qué

Hasta ahora había dos vocabularios sin puente: el físico de armadura (`TIPOS_DANO = corte | punta | contundente` en `src/armadura.ts`, el único enum de zod, `atacar.tipo_dano`) y el libre (`z.string()` en criaturas, guaridas, trampas y `modificar_personaje`), con alias dispersos (cortante/corte, perforante/punta, frío/frio/hielo, eléctrico/rayo…). Consecuencias: `atacar` rechaza «perforante» y «cortante», y `tipoHerida` (bestiario) manda a «contusión» casi todo lo que no es físico, fuego, ácido o necrótico.

## Tipos canónicos

Se reconocen sin distinguir mayúsculas, tildes ni espacios sobrantes, y con prefijo «daño de/por/del» («daño de fuego» → fuego).

| Canónico | Alias reconocidos | En el juego |
|---|---|---|
| cortante (físico) | corte, filo, tajo, cortantes | Armadura: «corte». Furia lo resiste. |
| perforante (físico) | punta, penetrante, perforación, pinchazo, perforantes | Armadura: «punta». Furia lo resiste. |
| contundente (físico) | contusión, golpe, aplastante, contundentes | Armadura: «contundente». Furia lo resiste. |
| fuego | llama, llamas, ígneo, abrasador, ardiente, **calor** | Doble daño a naves; vulnerabilidades (Elemental, Llama Gris). |
| frío | frio, gélido, helado, congelante, escarcha, **hielo** | Inmunidad del Frío del invierno. |
| eléctrico | electrico, eléctrica, electricidad, relámpago, voltaico, **rayo** | Tragado de la Bakunawa. |
| trueno | sónico, sonora, sonoro, atronador | No hay «sónico» aparte: es trueno. |
| ácido | acido, corrosivo, corrosión | |
| veneno | tóxico, toxina, ponzoña, venenoso | El Enano lo resiste. |
| necrótico | necrotico, necrosis | |
| radiante | sagrado, sagrada, resplandeciente, **luz** | Castigo del Caballero; Descanso. |
| psíquico | psiquico, mental | |
| fuerza | energia de fuerza | Hoy no lo usa nadie; reservado. |

`ALIAS_DE_DANO` (en `src/danos.ts`) es la lista verificable; la prueba comprueba cada alias contra su canónico.

### Alias dudosos (en negrita arriba; llevan su justificación en `dudoso`)

- **calor → fuego:** el calor ambiental se trata como fuego; no hay tipo «calor».
- **hielo → frío:** «hielo» es además un id de magia (`herramientas.ts`); como tipo de daño es frío.
- **rayo → eléctrico:** «rayo» también es id de magia; como daño es eléctrico. Trueno es un tipo distinto.
- **luz → radiante:** la luz que quema (Grieta de luz) es radiante; la luz sin daño no es un tipo.
- Dejados fuera a propósito: «quemadura» (ambiguo entre fuego y ácido; es una causa de herida, no un tipo), «divino» (no equivale a radiante), «energía» a secas, «muerte» y «sangrado».

## Qué NO es un tipo de daño

«mágico», «no mágico», «plata», «adamantina», «hierro frío»: describen la **fuente** del daño, no el elemento. El catálogo los rechaza (`normalizarTipo` devuelve `undefined`; el esquema zod dice que no son tipos). `src/danos.ts` exporta la estructura `FuenteDano` (`magico?`, `material?`) solo como documentación para la fase C; todavía no se usa. Ejemplo: «resiste el daño de corte no mágico salvo plata» será tipo `cortante` + fuente (no mágica, sin plata).

## Puente con armadura

`aVocabularioArmadura`: cortante→corte, perforante→punta, contundente→contundente; lo no físico →`undefined`. `src/armadura.ts` no se toca: sigue con su vocabulario y su `TipoDano` (ojo: `danos.ts` también exporta un tipo `TipoDano`, el canónico; al cablear, renombrar uno de los dos).

## Plan de cableado (PROPUESTA)

- **A. `atacar` y habilidades aceptan alias.** `atacar.tipo_dano` y `habilidad.tipo_dano` (criaturas, guaridas, trampas, `modificar_personaje`, naves) pasan por `tipoDanoSchema` o `normalizarTipo`; en `atacar` se traduce con `aVocabularioArmadura` para la armadura. `tipoHerida` usa el catálogo (hoy decide con expresiones regulares). Sin cambio de reglas: solo deja de rechazar o de confundir. La Furia (`esDanoFisico` en `rasgos.ts`) pasa a `esFisico`.
- **B. Función única de aplicación.** Un solo punto (`aplicarDano`) que reciba daño, tipo y fuente y aplique resistencias, armadura, Furia y raciales en un orden fijo, en lugar de las rutas actuales (atacar, habilidades, trampas, caída, tragado, `modificar_personaje`).
- **C. Datos de resistencias por criatura.** Hoy resistencias, inmunidades y vulnerabilidades viven en la prosa de `rasgos`. Se pasarían a campos (`resiste`, `inmune`, `vulnerable` con `TipoDano` y `FuenteDano`), de modo que «resiste el daño no mágico salvo plata» sea comprobable.

## Estado de los chequeos

`npm run dead-exports` señala hoy `aVocabularioArmadura` y `tipoDanoSchema`, porque ningún otro módulo de `src/` los usa todavía: es la excepción esperada de la fase 1 (el chequeo es informativo) y desaparece con la fase A. `tsc --noEmit --noUnusedLocals`, `npm test` y `npm run audit` pasan; el prompt fijo no cambia (67.093 caracteres).
