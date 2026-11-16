# Tesoro y botín

Qué se encuentra, cuánto vale y cómo se pide. Datos en `src/tesoro.ts` (catálogo), `src/botin.ts` (generador), `src/equipo.ts` (equipo mágico y calidades); cifras y simulación en `docs/BALANCE.md` §16.

## Categorías (12, cerradas)

`moneda` (dientes de dios, lingotes, monedas antiguas), `gema_arte`, `material` (hierro frío, plata, baño de plata, sal, hueso de dios, escamas…), `ingrediente`, `comida_bebida`, `herramienta` (ganzúas, kit de sanador, sierra de huesos, cadenas, daga de plata…), `documento`, `llave_sello`, `curiosidad`, `trofeo` (piezas de criatura), `objeto_trama` (33 objetos únicos con historia, solo lo público de Velmora) y `nautico`. 192 entradas; casi todas de 1-50 po, lo raro (escamas de mar profundo, perlas de luna, el relicario de un lich…) de 60 a 400 po.

Los nombres de lo que consume el motor son exactos (`Raciones de viaje`, `Pan duro`, `Carne seca`, `Queso curado`, `Odre de agua`, `Frascos de sal`, `Hierbas medicinales`, `Ganzúas`, `Herramientas de ladrón`, `Herramientas de cirujano`, `Sierra de huesos`, `Cadenas de hierro`): los reconocen los regex de sustento, sal, enfermedades, barbero, degollador y flagelante, y `t-tesoro` vigila que ningún otro nombre los dispare. Formato de cantidad canónico: **«Nombre (N)»** («Frascos de sal (5)»).

Plata y hierro frío: la «Daga de plata» y el «Cuchillo de hierro frío» son armas con `material`; el «Baño de plata» es un material consumible (un frasco platea un arma 1 hora o 10 impactos). Al atacar se pasa `material: "plata"` o `"hierro frío"` (coherente con `FuenteDano.material` de `danos.ts`); ninguna es mágica.

## Cómo pedir el botín

`generar_botin {origen, cantidad, peligro?, region?, criatura?, categorias?}`. Una llamada por saqueo; `cantidad` = nº de objetos. Con `peligro` (1-5), `region` o `criatura` reparte equipo y catálogo y sugiere oro (`oro_cambio`; **nunca se aplica solo**: el DM lo suma con `modificar_personaje`, igual que los objetos). Sin esos datos, el botín antiguo (equipo y viales) **con oro de peligro 2**: saqueo, hallazgo y jefe dan oro siempre (la compra, nunca). El catálogo se consulta con `consultar_reglas {tema: "tesoro", nombre?: categoría | criatura | id}` y la ficha de una criatura (`tema: "criatura"`) lista sus piezas con su %.

Qué influye: el **origen** (compra, saqueo, hallazgo, jefe) fija los pesos por categoría; el **peligro** limita lo raro (`peligroMin`) y escala el oro y lo mágico; la **región** favorece lo de esa región y el mar abre lo náutico; la **criatura** añade sus piezas (`botinItems`, con probabilidad) y sus trofeos; en un **hallazgo en la guarida de un jefe** salen las piezas de esa guarida. Los objetos únicos salen una vez por partida con su `[O#]`. Un hallazgo trae a veces una pista escrita (rumor del saber, solo para el DM). Las trampas pueden guardar un cofre (`contiene`, `trampa {accion: abrir}`).

## Fórmulas (propuesta a confirmar)

- **Oro** por peligro: P1 1d6, P2 3d6, P3 2d8×3, P4 4d10×4, P5 6d10×10 po; ×0,5 saqueo, ×1 hallazgo, ×2 jefe, la compra no da. **Cofre** (`cofre: true`; lo llevan solos las trampas con `contiene`, el pecio y el hallazgo en una guarida): ×2 sobre la tabla de su origen (hallazgo cofre P3 ≈54 po, P4 ≈174, P5 ≈639). Campaña de niveles 1-8 con un cofre por nivel: ≈3.400 po (BALANCE §16 quater). Campaña de niveles 1-8: ≈3.060 po de moneda (≈5.850 con el valor de lo no mágico).
- **Equipo mágico** en saqueos comunes: ≈0 % P1-2, 5 % P3, 12 % P4, 25 % P5. Hallazgo y jefe conservan su tabla (sin reliquias bajo P3 ni legendarias bajo P5).
- **Precio de equipo**: encantado y maldito = base×10+200; reliquia = encantado+5.000 (techo 19.000); legendaria 20.000.
- El catalizador raro (sin precio) se sustituye por uno con precio **elegido al azar**.

## Qué es propuesta y está pendiente de confirmar

Los dados de moneda (P3 y P4 un escalón sobre la orientación inicial), los porcentajes mágicos, el precio de la reliquia, los 33 objetos únicos y el tesoro de las 8 guaridas, el valor de las piezas de criatura (p. ej. relicario del lich 400, vaso de djinn 300), la pista escrita (20 %), el peso náutico ×3 y el encuentro «Pecio a la deriva». El ×2 del cofre y el peligro 2 por defecto son propuesta a confirmar. Pendiente: las armas de plata como objeto de tienda no están en la tabla de compra; las reliquias de los jefes siguen creándose a mano con `crear_objeto`.

## Vial «Esencia Clara» (limpiaestados; nombre y cifras PROPUESTA A CONFIRMAR)

Quinto vial (`src/viales.ts`, `usar_vial {vial: "Esencia Clara", receptor, portador}`): quita **todos los estados temporales** (`ESTADOS_TEMPORALES` en `condiciones.ts`: quemado, paralizado, ralentizado, envenenado, ensordecido, cegado, aturdido, corroído y debilitado), tanto la condición como su entrada del registro `estadosDano` (también los sin duración: la Hiel, un «quemado» puesto a mano), con aviso de lo que quitó. **No** toca maldiciones, enfermedades, heridas, agotamiento, derribado, hechizado ni la muerte. **No deja asalto de inmunidad** (la inmunidad solo llega al caducar un estado por sí solo). **Requiere receptor**: si está incapacitado (paralizado, aturdido, inconsciente…) no puede beberlo solo y otro (`portador` distinto) debe dárselo; un portador incapacitado tampoco puede darlo. Sin estados que limpiar o con un muerto, error y el vial no se gasta. Precio 50 po.

Reparto (% de los viales que salen; la probabilidad de que haya vial no cambia): compra 17 %, hallazgo 15 %, saqueo 6 %, jefe 10 %. Se ve en `/viales` de la mesa y en `consultar_reglas {tema: "viales"|"estados"}`; no está en el prompt fijo.
