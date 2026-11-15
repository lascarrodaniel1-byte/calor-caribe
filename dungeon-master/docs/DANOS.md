# Catálogo de tipos de daño

Estado: **cableado (fases A, B y C hechas)**: catálogo (`src/danos.ts`), alias en todas las herramientas, función única de aplicación del daño y datos de resistencias por criatura. Lo que sigue abierto está al final como **PROPUESTA** hasta que el dueño lo confirme.

## Por qué

Había dos vocabularios sin puente: el físico de armadura (`corte | punta | contundente`, ahora `TIPOS_DANO_ARMADURA` y `TipoDanoArmadura` en `src/armadura.ts`) y el libre (`z.string()` en criaturas, guaridas, trampas y `modificar_personaje`), con alias dispersos (cortante/corte, perforante/punta, frío/hielo, eléctrico/rayo…). `atacar` rechazaba «perforante» y `tipoHerida` mandaba a «contusión» casi todo lo no físico. Y las resistencias vivían en regex sobre texto libre y en prosa.

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

`aVocabularioArmadura` (cortante→corte, perforante→punta, contundente→contundente; lo no físico →`undefined`) y su inverso `deVocabularioArmadura`. `src/armadura.ts` conserva sus valores; solo se renombró su tipo (`TipoDanoArmadura`) para no chocar con `TipoDano` del catálogo. En `atacar` el tipo canónico se traduce para la armadura por regiones; un tipo no físico (fuego, frío…) no pasa por la armadura y no da el aviso «sin tipo de daño».

## Qué hay cableado

- **Alias en cada entrada (fase A).** `atacar.tipo_dano`, las habilidades de criatura (`habilidad_nueva`, aparecer/registrar), guaridas, trampas, `modificar_personaje.tipo_dano`, naves (`nave danar`) y `danar_criatura.tipo_dano` pasan por `tipoDanoSchema`: aceptan cualquier alias y el código trabaja con el tipo canónico. `atacar` ya no rechaza «perforante» ni «cortante». Un valor desconocido o una fuente («mágico», «plata») da un error claro. El fuego de las naves se decide por el tipo (`fuego`, con alias llama/incendiario…).
- **`tipoHerida`** (heridas por habilidad) usa el catálogo: cortante→corte, perforante→perforación, contundente→contusión, fuego/ácido/**frío/eléctrico/radiante**→quemadura, veneno/necrótico→necrótica, trueno/psíquico/fuerza→contusión (valor neutro). Elección de criterio, **a confirmar**; las heridas solo son descriptivas salvo que corte, perforación y mordedura se pueden cauterizar.
- **Raciales y Furia por tipo canónico.** Enano/veneno, Tritón/frío, Cenizo/fuego y Furia/físico ya no usan regex sobre texto libre: arreglado el falso positivo «llama sagrada» y los falsos negativos «calor» y «abrasador». `esDanoFisico` desapareció (usa `esFisico` del catálogo).
- **Función única `aplicarDano`** (`src/danos.ts`; `perfilDePersonaje` y `aplicarDanoAPersonaje` en `src/rasgos.ts`). Orden 5e: bonificadores y armadura ya incluidos → mitad por salvación (redondeo abajo) → inmunidad (0) → resistencia (mitad, abajo) y vulnerabilidad (doble), que **se anulan** si coinciden en el mismo tipo; varias resistencias al mismo tipo no se acumulan. Devuelve `{ final, detalle }`; el aviso muestra «(Resistencia al frío del Tritón: 10 → 5)» solo donde ya había nota. Sustituye a `danoConResistencia` en `atacar`, habilidades y trampas, caída, tragado y `modificar_personaje`. Para un PJ: raciales, Furia (físico) y el **voto de Luz** del Caballero (necrótico; desde el nivel 5 y con el juramento sin romper: antes era solo texto), y en `atacar` también las raciales y la Luz (antes solo la Furia). El resultado de las pruebas existentes no cambió.
- **Resistencias por criatura (fase C).** `resistencias`, `inmunidades` y `vulnerabilidades` en la ficha (`tipo`, `soloNoMagico`, `salvoMaterial`, `soloMaterial`), migradas solo de lo que la prosa ya decía (20 de 46 criaturas; ver `docs/BALANCE.md` §13). `atacar` y `danar_criatura` (con `tipo_dano`) las aplican; la ficha de la criatura lo dice («Daño por tipo… no lo restes tú»). Sin `tipo_dano`, `danar_criatura` sigue siendo «daño final» como siempre.
- **Fuente del daño.** `fuente.magico` (arma mágica): `atacar` lo deduce de un objeto encantado, maldito, reliquia o legendario del inventario; el DM lo fuerza con `atacar {magico}` o `danar_criatura {magico}`; el castigo radiante es mágico; sin dato = no mágico. `material` (plata, llama gris…) se pasa igual.
- **Armadura y ficha no se duplican.** La armadura por regiones se aplica antes; donde el blindaje ya frena el golpe no se suma la resistencia física de la ficha, y donde lo agrava no se suma la vulnerabilidad física (propuesta a confirmar, medida en el simulador).

## Qué NO es un tipo de daño

«mágico», «no mágico», «plata», «adamantina», «hierro frío»: describen la **fuente**, no el elemento. El catálogo los rechaza como tipo; van en `FuenteDano` (`magico`, `material`). «Resiste el corte no mágico salvo plata» es tipo `cortante` + `soloNoMagico` + `salvoMaterial: "plata"`.

## Propuestas que siguen abiertas (el dueño confirma)

- El mapa de heridas por tipo (arriba), la lectura de «resistencia al daño no mágico» sin tipo como físico, y que la armadura mande sobre la resistencia de la ficha.
- Las incoherencias de datos de §13 ya están corregidas (`docs/BALANCE.md` §14: inmunidades de no-muertos al veneno y al necrótico, Hombre oso con ficha propia, redacción daño ↔ condición; Vaerth queda sin cambio y las dudosas están listadas ahí). Siguen abiertas las criaturas que dejan de encajar con su peligro/VD sin armas mágicas. Las incoherencias restantes (psíquico de Banshee e Ilvara, fuego del Juez, luz solar de Ysolde, agua del Elemental de fuego y hierro frío del Duende) están corregidas en §14 bis; el **agua** y el **hierro frío** no son tipos: se modelan como un tipo físico con `material` («agua» como contundente, «hierro frío» como cortante/perforante/contundente), y la resistencia que chocaría con ellos lleva `salvoMaterial`.
- Pendiente: inmunidades a condiciones (miedo, hechizo, agotamiento) como dato, vulnerabilidades por material (sal, hierro cálido), resistencia dinámica de Kuru y el estado «fuera del agua» de la Bakunawa; resistencias de PNJ y de objetos/condiciones (hoy prosa).
- Daño de conjuros a criaturas: el DM aplica `danar_criatura {tipo_dano, magico: true}`; no hay herramienta de conjuro contra criaturas que lo haga sola.
