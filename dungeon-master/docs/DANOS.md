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
- **Hecho en la fase 2 (BALANCE §17):** inmunidades a condiciones como dato (`inmunidadesCondicion`, las rechaza `condicion`), materiales «sal» (ácido) y «hierro caliente» (fuego), defensas condicionadas por estado («varada» de la Bakunawa), adaptación de Kuru (solo tipos no físicos, desde el siguiente asalto) y PNJ con `criatura`. Caída, Hiel y Senda de la Ceniza sobre criaturas pasan por `aplicarDano`.
- Pendiente: resistencias de objetos (hoy prosa) y el dolor del Flagelante (sin tipo).
- Daño de conjuros a criaturas: `lanzar_hechizo` no daña enemigos; el DM aplica `danar_criatura {tipo_dano, magico: true}` y, si olvida `tipo_dano` ante una criatura con defensas por tipo, el resultado se lo recuerda.

## Estados por tipo de daño (fase 3; todo el mapa es PROPUESTA A CONFIRMAR)

El dueño pidió: «Que los daños de los ataques puedan dar estados. Por ejemplo, el de fuego quemado, rayo y hielo paralizado y así.» Código en `src/estados.ts` (lógica) y `src/estados_base.ts` (registro, sin dependencias); reglas bajo demanda en `consultar_reglas {tema: "estados"}`. Cifras y simulación en `docs/BALANCE.md` §18.

| Tipo | Salvación | Fallo normal | Fallo por 5 o más, o crítico | Duración |
|---|---|---|---|---|
| fuego | DES | **quemado**: 1d4 de fuego al empezar cada asalto | igual | 3 asaltos, o hasta apagarlo (`accion_combate {apagarse}`, una acción, o agua) |
| eléctrico | CON | **paralizado** | igual | breve: hasta el final de SU siguiente turno |
| frío | CON | **ralentizado** (velocidad a la mitad, desventaja en salvaciones de DES) | **paralizado** | 3 asaltos / breve |
| ácido | DES | **corroído**: CA −1 | igual | hasta el descanso |
| veneno | CON | **envenenado** | igual | 3 asaltos |
| necrótico | CON | **debilitado** (desventaja en pruebas) | igual | 3 asaltos |
| radiante | CON | **cegado** | igual | breve |
| trueno | CON | **ensordecido** | ensordecido + **derribado** | 3 asaltos / 1 asalto |
| psíquico | SAB | **asustado** | **aturdido** | 2 asaltos / breve |
| fuerza | FUE | **derribado** | igual | 1 asalto |

«Rayo y hielo paralizado» se respeta como base: el eléctrico paraliza siempre que falla (breve) y el frío, que es el más habitual en Velmora (Tritones, Frío del invierno), **modula**: fallo normal = ralentizado, fallo por 5 o más o crítico del atacante = paralizado. Las condiciones nuevas (`quemado`, `ralentizado`, `corroído`, `debilitado`; `varada` es de la fase 2) están en el catálogo con sus efectos en `efectos(...)` (mitad de velocidad en `velocidad.ts`, −1 a la CA en `atacar`, 1d4 por asalto en `siguiente_asalto`). El «corroído» es −1 a la CA porque no hay mecanismo de desgaste de piezas de armadura. «quemado por la sal» (del círculo de sal) sigue siendo otra cosa.

**Reglas de aplicación.** (1) Solo si el golpe causa daño **final > 0** de ese tipo tras `aplicarDano` y el objetivo sigue en pie (un inmune, o quien cae a 0 PV, no sufre el estado; el inmune a la condición de su ficha tampoco, con aviso). (2) **Salvación** del objetivo contra una **CD fija**: criatura, la mediana de las CD de sus habilidades o 8 + competencia (por peligro) + su mejor mod; PJ, 8 + competencia + mod de FUE/DES (o del atributo de lanzamiento si ataca con INT/SAB/CAR); trampa, su CD; `danar_criatura`, `cd_estado` o la de quien lo causa (`por`) o 13. Resistir el tipo da **ventaja** en esa salvación. En habilidades de criatura y trampas con salvación propia, quien supera la de la habilidad no sufre además el estado. (3) **Opt-out** por golpe (`atacar` y `danar_criatura {sin_estado: true}`), por habilidad (`estado: false`, o un texto para dar otra condición) y por criatura (`sinEstados`); una habilidad que ya trae `condicion` no suma estado. (4) **No se acumula**: quien ya lo sufre solo lo renueva (alarga su plazo), salvo los de control (paralizado, aturdido, cegado), que no se alargan. (5) **Límite de control encadenado**: al acabar cualquier estado, el objetivo es **inmune a él un asalto**; la parálisis nunca encadena dos turnos. (6) Acaban solos al abrirse el asalto (`siguiente_asalto`), al acabar el combate y al descansar (corroído, solo el descanso); fuera de combate duran hasta el descanso o hasta quitarlos. (7) **Tragado: decisión (a confirmar):** el daño de dentro (eléctrico o ácido de la Bakunawa) NO da estado: el tragado ya está cegado y retenido. (8) El daño físico no cambia: ninguna arma da estado por sí sola. No cubierto (el DM usa `condicion`): daño de `modificar_personaje` con `tipo_dano` (peligros ambientales) y el radiante del Castigo del Caballero.

**Aviso.** El de pantalla lleva una línea compacta («🔥 Ogro: quemado (3 asaltos)», «⚡ Aldo: paralizado (1 turno)»); el texto al DM detalla la salvación y recuerda que ya está aplicado. Los emojis nuevos (⚡ ☀ 🔔 💫 🧠) están en `EMOJIS_AVISO` de `secuencia.ts` para que `limpiarNarracion` siga quitando los avisos copiados.
