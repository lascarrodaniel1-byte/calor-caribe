# Cazarrecompensas: el tablero de buscados de la Llama Gris

Datos y lógica en `src/buscados.ts`; pruebas en `tests/motor/t-buscados.ts`. Todo lo de abajo marcado como *propuesta* está pendiente de confirmar.

## Lore (solo lo público)

La Inquisición de la Llama Gris publica carteles de busca y captura con su sello (cera gris con la llama) en los tablones de la Casa de Registros, los puertos, las plazas y las posadas de todas las regiones. Cada cartel lleva la firma de un oficial: fiscal inquisidor en Aldenmar, alguacil mayor en las Ciénagas, inquisidor o inquisidora en Karak-Dûm, el Velo Rojo, la Marca Hueca y las Agujas de Vahl. Los nombres de los oficiales son de ejemplo (*propuesta*).

Delitos según la ley de la Llama: **herejía**, **apostasía**, **culto prohibido**, **contrabando** de reliquias o sal, **deserción** de la Llama, **asesinato de inquisidor** y **brujería**. Los carteles y sus pistas solo usan las capas público (el cartel), rumor (las tabernas) y erudito (los archivos de la Casa de Registros) de `src/saber.ts`; ninguna capa restringida ni secreta, ni su delator, aparece en ellos (lo comprueba la prueba).

## El tablero (16 buscados fijos, ids B01-B16)

| Id | Buscado | Delito | Región | P | Viva / muerta (po) | Plazo | Perfil de combate |
|---|---|---|---|---|---|---|---|
| B01 | Tomás Orlev «el Mudo» | contrabando | Ciénagas | 1 | 40 / 25 | 20 | PNJ recluta |
| B02 | Marga Veyl «la Dama de las Velas» | culto prohibido | Aldenmar | 1 | 50 / 30 | 15 | PNJ recluta + 2 Hambrientos |
| B03 | Pietro Calvo «el Santero» | contrabando | Aldenmar | 1 | 55 / 30 | 15 | PNJ recluta |
| B04 | Joren Ashkar «Manoseca» | deserción | Aldenmar | 2 | 140 / 80 | 20 | PNJ curtido |
| B05 | Gorm «Tres Dientes» | asesinato de inquisidor | Marca Hueca | 2 | 160 / 110 | 25 | Ogro (bestiario) |
| B06 | Ilse Fenn «la Callada» | brujería | Ciénagas | 2 | 150 / solo vivo | 20 | PNJ curtido |
| B07 | Silas Thorne «el Predicador Ciego» | herejía | Aldenmar | 3 | 350 / solo vivo | 30 | PNJ veterano + fieles |
| B08 | Dagny Rook «Garra Muerta» | asesinato de inquisidor | Velo Rojo | 3 | 300 / 200 | 25 | PNJ veterano + 2 Lobos de Ceniza |
| B09 | Vael Harrow «el Sacristán» | apostasía | Marca Hueca | 3 | 280 / 160 | 30 | PNJ veterano |
| B10 | Odrik Piedrafina | contrabando | Karak-Dûm | 3 | 380 / 220 | 30 | PNJ veterano |
| B11 | Selene Voss «la Boticaria» | brujería | Aldenmar | 3 | 360 / 210 | 25 | PNJ veterano |
| B12 | Cadell Voyce «Voz de Ceniza» | culto prohibido | Ciénagas | 4 | 750 / 450 | 40 | PNJ veterano (2 ataques) + 2 Ghules |
| B13 | Hermano Ansel Corde «el Flagelante Hueco» | asesinato de inquisidor | Agujas de Vahl | 4 | 680 / 400 | 35 | PNJ veterano (2 ataques) |
| B14 | La Bestia del Pinar | asesinato de inquisidor | Velo Rojo | 4 | 900 / 600 | 30 | Ulfhedinn (bestiario) |
| B15 | Ysmeria Dorne «la Magistra» | deserción | Aldenmar | 5 | 1.600 / 900 | 60 | PNJ leyenda (2 ataques) |
| B16 | Odessa Quen «la Reina de la Sal» | contrabando | Ciénagas | 5 | 1.300 / 900 | 60 | PNJ leyenda + 3 Hombres lagarto |

Los PNJ sin ficha llevan los datos de `iniciativa {pnj}` (bono de ataque, CA, PV, veteranía, ataques por asalto); las criaturas, su ficha del bestiario. No hay mecánicas de combate nuevas. Cada cartel trae hasta 3 pistas (rumor, rumor, archivos).

**Recompensas por peligro (viva):** P1 30-60, P2 100-180, P3 250-400, P4 600-900, P5 1.200-2.000 (las bandas no se solapan). La recompensa por el muerto es el 60 % de la viva y nunca menos de la mitad (*propuesta*). El campo `muerta: null` significa «solo vivo».

## Qué ve el tablón

Cada tablón muestra los carteles de **su región** y las circulares de peligro 4-5 de todo el reino. Hay tablón en ciudades, aldeas, posadas, puertos, fortalezas, campamentos y templos; no en caminos, ruinas ni cuevas. El tablero se renueva solo: el primer `ver` de cada día del mundo puede añadir un cartel generado (ids G01…; nombre, delito por región, recompensa por tabla, peligro 1-3 y nunca por encima de lo que el rango del grupo puede aceptar). Hay un máximo de 8 generados vivos.

## La herramienta `buscados`

`buscados {accion, id?, quien?, estado?, datos?}`. Acciones:

| Acción | Qué hace |
|---|---|
| `ver` | Lista compacta del tablón del lugar actual. `datos {region, todos, renovar}` |
| `detalle {id}` | Ficha completa para el DM: perfil de combate, pistas y estado. A los jugadores solo les llega el cartel |
| `aceptar {id, quien}` | El personaje toma el contrato; fija el plazo. Exige el rango suficiente |
| `pista {id, quien, datos?:{habilidad}}` | Una prueba del motor (`prueba`) contra CD 8 + 2×peligro + nº de pista (+1 en archivos): Persuasión para rumores, Investigación para archivos. Éxito = siguiente pista; fallo = no se gasta y se reintenta |
| `capturar {id}` | Lo tienen en custodia (sigue el plazo) |
| `entregar {id, estado: vivo\|muerto, quien?, datos?:{pruebas, equivocado}}` | Calcula el pago |
| `abandonar {id}` | Cierra el contrato sin pago ni castigo |
| `cartel {datos}` | El DM publica un cartel de la trama |
| `cartel {id, datos:{visible}}` | Lo muestra u oculta |
| `retirar {id}` | Lo da por prescrito y cierra su contrato sin castigo |

Estados del cartel: `activo`, `tomado`, `capturado`, `entregado`, `prescrito`.

Ganchos de clase (sin tocar su equilibrio): el **Cazador de Brujas** tiene ventaja al seguir pistas de brujería y culto prohibido («primero se rastrea»); el **Degollador** que ya estudió a su presa (`estudiar_presa`) la rastrea con ventaja.

### Pago (siempre una sugerencia)

- **Vivo:** la recompensa viva.
- **Muerto:** la reducida, y solo con pruebas (`datos.pruebas`: el cuerpo, la cabeza, su sello); sin pruebas no se paga y el contrato sigue.
- **Solo vivo y llega muerto:** el 10 % de la viva (gastos de traslado) y −2 de reputación.
- **Equivocado** (`datos.equivocado: true`): sin pago, falta grave (−4) y el cartel sigue activo.
- **Plazo vencido:** el contrato fracasa (−1) y el cartel vuelve al tablón.
- Más el plus del rango (abajo).

El resultado trae `oro_cambio: N` y suma N a `partida.botinPendiente`, igual que el botín: el repaso avisa hasta que el DM lo aplique con `modificar_personaje {oro_cambio}`. Nada de esto cambia fichas.

### Reputación con la Llama (de la mesa; *propuesta*)

| Rango | Puntos | Contratos hasta peligro | Plus de pago |
|---|---|---|---|
| Sospechoso | ≤ −3 | 1 | 0 |
| Sin licencia | −2 a 2 | 2 | 0 |
| Aspirante | 3 a 7 | 3 | 0 |
| Cazador licenciado | 8 a 15 | 4 | +10 % |
| Cazador de la Llama | 16 o más | 5 | +20 % |

Entrega viva +2, muerta +1; los fallos y traiciones restan (arriba). Mínimo −10, máximo 30. No existía ningún sistema de reputación del grupo con una facción (las relaciones de `regentes.ts` son entre regentes), así que este es el único y es pequeño: un número y una tabla. Hasta 5 contratos en curso a la vez.

## Cartel de un personaje del grupo (lo publica el DM)

El motor no trae ningún cartel de un personaje: solo el DM decide si aparece. `cartel {datos}` con `visible` obligatorio cuando el objetivo es un personaje del grupo (`visible: false` lo deja oculto: ni el panel ni los avisos lo muestran; `cartel {id, datos:{visible:true}}` lo publica después). Los compañeros no pueden aceptarlo; lo cobran cazadores PNJ (usa el encuentro «cazarrecompensas»).

Ejemplo (nombres inventados: un personaje del grupo, Aldric, perseguido por un oficial de la Llama):

```
buscados {
  accion: "cartel",
  datos: {
    nombre: "Aldric Vane", alias: "el Desertor",
    delito: "desercion",
    descripcion: "Hombre de unos treinta años, ancho de espaldas, con una quemadura en la mano izquierda y el sello de la Llama arrancado de la capa.",
    lugar: "puerto de Aldenmar", region: "Aldenmar",
    viva: 400, muerta: 250, peligro: 3, plazo: 30,
    firma: "Marsh", rango_firma: "oficial de la guardia de la Llama Gris",
    pista_rumor: "Dicen en el puerto que viaja con una mercenaria y que no duerme dos noches en el mismo sitio.",
    pista_erudita: "La Casa de Registros anota su deserción hace tres inviernos, con un sello robado.",
    visible: true
  }
}
```

Plantilla para copiar (cambia los datos; `delito` es uno de herejia, apostasia, culto_prohibido, contrabando, desercion, asesinato_inquisidor, brujeria):

```
buscados {accion: "cartel", datos: {nombre: "<nombre del personaje>", alias: "<alias>", delito: "<delito>", descripcion: "<rasgos físicos públicos>", lugar: "<última ubicación>", region: "<región>", viva: <po>, muerta: <po>, peligro: <1-5>, plazo: <días>, firma: "<oficial>", rango_firma: "<cargo en la Llama>", pista_rumor: "<lo que se oye>", pista_erudita: "<lo que dicen los archivos>", visible: <true|false>}}
```

El cartel de la partida actual no está en el código (la partida vive en la base de datos y el código no la toca): el DM lo publica con esta plantilla cuando lo decida.

## Dónde verlo

- `consultar_reglas {tema: "buscados"}`: las reglas completas.
- El estado del DM lleva **una línea** solo si hay contratos en curso: nombre, quién y plazo, y el rango.
- Encuentro de hallazgo «Tablón de buscados» en Aldenmar y las Ciénagas (casa de registros, muelle, plaza).
- La página: botón «Tablero de buscados», solo lectura (fase 2).
