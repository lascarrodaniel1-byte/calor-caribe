# Pruebas de la Mesa de Velmora

Todo se ejecuta desde `dungeon-master/`. No hay dependencias nuevas: motor y auditorías usan `tsx`; las pruebas de navegador usan Playwright, que **no** es dependencia del proyecto (se toma del entorno).

## Cómo ejecutarlas

| Comando | Qué hace |
|---|---|
| `npm test` | Suites del motor + auditoría + fuzz + soak (semillas 1, 2 y 3). Tabla final; código de salida 1 si algo falla. `node tests/ejecutar-motor.mjs <texto>` ejecuta solo los casos cuyo nombre contenga el texto. |
| `npm run test:ui` | Construye la página en un directorio temporal y lanza en serie los scripts de navegador (150 s de límite cada uno). Falla si un script sale con error o imprime `errores de página: N` / `errores: N` con N > 0. Sin Playwright: aviso y código 0. |
| `npm run audit` | Coherencia de datos (herramientas, razas, criaturas, encuentros, estilos, numeración del README). Debe acabar en «sin problemas». |
| `npm run fuzz` | 860 llamadas a las herramientas con entradas incompletas. Debe dar 0 problemas. |
| `npm run soak -- <semilla>` | Simulación de partidas con semilla. Debe dar 0 problemas. |
| `npm run dead-exports` | Lista exports de `src/` que nadie usa (informativo, no falla). |

## Estructura

- `tests/motor/` — suites `t-*.ts`. Cada una termina con `N ok, M fallas`; el runner lee la **última** línea con ese formato.
  - `t-regresion` — regresiones generales (niveles, saber, repaso, mapa, rasgos de clase, dados fijos).
  - `t-codice` — Códice y bestiario del grupo (descubrir criaturas).
  - `t-bestiario` — fichas del bestiario, temples, piezas de armadura, condiciones y temas de saber.
  - `t-monstruos` — conjuros y ataques de monstruos, PX y consulta de reglas.
  - `t-control` — control de personajes ausentes (quién lleva a quién) y bloque de turnos.
  - `t-triton` — raza Tritón, plantillas de encuentro, resistencias y rasgos automáticos.
  - `t-genero` — género del personaje en ficha, formulario y prompt del DM.
  - `t-agua` — movimiento, aire y penalizaciones en el agua.
  - `t-don` — Don Arcano y competencias recordadas en las tiradas.
  - `t-artes` — artes marciales: estilos, principios y técnicas automáticas.
  - `t-vel` — velocidad por raza y de las 44 criaturas (incluidos los voladores).
  - `t-enc2.ts`, `t-enc-wen.ts` — **no entran en `npm test`**: son sondeos estadísticos de la tabla de encuentros con dados reales (250–400 encuentros) que imprimen conteos, no «N ok, M fallas». Se ejecutan a mano: `VELMORA_DESPLAZO=0 npx tsx tests/motor/t-enc2.ts`.
- `tests/auditoria/` — `auditoria.ts`, `fuzz.ts`, `soak.ts`, `cobertura.ts` (técnicas de artes marciales: 21 de 21), `migra.ts` (carga partidas antiguas de `tests/fixtures`, o las que se pasen como argumento), `tam.ts` (tamaño del estado del DM), `exportsMuertos.mjs`.
- `tests/ui/` — scripts de Playwright (`flujo`, `bestiario`, `run`, `control`, `genero`, `sinnarracion`, `layout`), `mock.js` (simula `window.claude` y la base de datos en memoria), `_comun.mjs` (lanzamiento de Chromium y rutas), `construir.mjs` (construye la página con `scripts/construir-artifact.mjs`). `layout.mjs` saca capturas y no está en el runner. Cada script acepta como argumento la carpeta con `mesa-de-velmora.html`; sin él, la construye en `os.tmpdir()`. Las capturas y exportaciones se escriben en un directorio temporal.
- `tests/fixtures/` — partidas JSON de ejemplo; `generadores/mk-*.ts` las regeneran (`npx tsx tests/fixtures/generadores/mk-mesa.ts <salida.json>`).

## Variables de entorno

- `PLAYWRIGHT_MODULE` — ruta al módulo de Playwright. Por defecto `/opt/node-tools/node_modules/playwright/index.mjs`; si no existe, se importa `playwright`.
- `CHROMIUM_PATH` — ejecutable de Chromium. Por defecto `/opt/pw-browsers/chromium`; si no existe, Playwright usa el suyo.
- `VELMORA_SALIDA` — directorio base para capturas y exportaciones de las pruebas de UI (por defecto, el temporal del sistema).
- `VELMORA_DESPLAZO=0` — necesaria solo para las suites `t-enc*` a mano.

## Añadir una suite

1. Crea `tests/motor/t-<nombre>.ts`; importa con rutas relativas (`../../src/estado.ts`) y, para ficheros, usa `new URL("…", import.meta.url)` (nunca rutas absolutas).
2. Acaba con `console.log(`${ok} ok, ${mal} fallas`)`. El runner la detecta sola por el nombre `t-*.ts`.
3. Nada de azar sin control: si el resultado depende de un dado, fíjalo con `iniciarRegistroDados([...])` (o el ayudante `fijos` de `t-regresion`) y `liberarDados()` al terminar. Una prueba que falla «una de cada cinco» es un fallo de la prueba.
4. Para una prueba de navegador: crea `tests/ui/<nombre>.mjs` basada en las existentes (usa `_comun.mjs`), imprime `errores de página: N` al final y añádela a la lista `SCRIPTS` de `tests/ejecutar-ui.mjs`.
