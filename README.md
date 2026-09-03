# Calor Caribe

App para la costa Caribe colombiana que:

1. **Monitorea la sensación térmica** (Heat Index de la NWS: temperatura + humedad)
   por municipio, muestra el estado de **El Niño / ENOS** (ONI de la NOAA) y lanza
   **alertas personalizadas** según las comorbilidades del hogar (hipertensión,
   enfermedad cardíaca o renal, diabetes, embarazo, adultos mayores, niños, etc.).
2. **Estima la factura de luz** del mes a partir del precio del kWh y de los
   electrodomésticos que agregues manualmente, marcando cuándo se supera el
   **consumo de subsistencia** (173 kWh/mes) y el sobrecosto que eso implica.
3. **Planifica el uso**: reparte las horas de cada electrodoméstico para no pasar
   de la meta de consumo (la que evita el sobrecosto de Air-e / Afinia / Sopesa).

## Privacidad

En el **primer uso** la app muestra una pantalla de **términos de uso y aviso de
privacidad** que hay que aceptar para continuar (`src/components/TerminosGate.tsx`,
texto en `src/components/TextoTerminos.tsx`, versión en `src/lib/terminos.ts`).
Si esa versión sube, se vuelve a pedir aceptación. El texto completo está siempre
en `/terminos` (enlace en el pie de página y en Ajustes).

- **Solo en el dispositivo** (`localStorage`, sin cuentas ni servidor de datos):
  comorbilidades, municipio, electrodomésticos, precio del kWh, estrato y metas.
- **Sale del dispositivo** solo para consultar el clima: el nombre del municipio
  (`GET /api/clima?municipio=…`), o una coordenada **redondeada a ~1 km** en el
  cuerpo de la petición (`POST /api/clima/gps`, nunca en la URL / los logs). De
  ahí va a Open-Meteo.
- **Nunca sale**: el detalle de las enfermedades, los electrodomésticos ni las
  cifras de la factura.
- La única persistencia fuera del dispositivo es el archivo de suscripciones de
  Web Push, y **solo si activas esa función** (ver abajo).
- La pantalla **Ajustes → Privacidad y datos** resume todo esto en la app.

### Monitoreo en (casi) tiempo real

- El clima se refresca solo cada 10 minutos mientras la app está abierta, al
  volver a la pestaña y al reconectarse.
- En **Ajustes → Ubicación** puedes elegir "Usar mi ubicación (GPS)": la
  sensación térmica se calcula para tu **zona (~1 km)**, no para el centro del
  municipio.
- Es una **PWA instalable** (`Agregar a pantalla de inicio`).
- Los navegadores **no pueden leer la app de clima nativa del celular**. Lo más
  cercano es el GPS + un servicio de clima.

### Avisos con la app cerrada (Web Push)

Backend de push opcional. Sin configurar claves VAPID queda **desactivado** y la
app avisa igual mientras esté abierta.

**Configuración (una vez):**

1. Copiar `.env.example` a `.env` y generar claves VAPID:

   ```bash
   node -e "console.log(require('web-push').generateVAPIDKeys())"
   ```

   Rellenar `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`,
   `VAPID_SUBJECT`, `CRON_SECRET` y `APP_URL`. El `.env` está en `.gitignore`;
   **no se versiona ni se comparte**.

2. En la app: **Calor y alertas → “Avisos con la app cerrada” → Activar**. Ahí
   mismo hay una casilla para **no** compartir el nivel de salud con el servidor.

3. Programar la revisión periódica (el servidor no tiene cron propio). En
   Windows, con `npm start` corriendo:

   ```bat
   schtasks /create /tn "CalorCaribe-Alertas" /tr "\"C:\Program Files\nodejs\node.exe\" \"%CD%\scripts\check-alertas.mjs\"" /sc hourly
   ```

   O manualmente: `npm run alertas:check`.

**Qué se guarda en el servidor** (`.data/push-subs.json`, en `.gitignore`): el
endpoint de push del navegador + sus claves, el municipio **o** una coordenada
redondeada a ~1 km, y —si lo permites— un entero 0–7 que resume la
vulnerabilidad. **Nunca** las comorbilidades concretas ni datos de identidad. Al
desactivar los avisos (o "Borrar todos mis datos") el registro se elimina.

Requisitos del navegador: Chrome/Edge/Firefox, o Safari/iOS **16.4+** con la app
instalada en la pantalla de inicio.

## Desarrollo

```bash
npm install
npm run dev
```

Abre http://localhost:3000. Si `node`/`npm` no se reconocen en una terminal
nueva de PowerShell:

```powershell
$env:Path = "$env:ProgramFiles\nodejs;" + $env:Path
```

## Probar en un celular

### Solo la interfaz (mismo Wi-Fi)

`npm run dev` imprime una línea `Network: http://192.168.x.x:3000`. Abre esa
dirección en el navegador del celular (mismo Wi-Fi que el PC). Sirve para ver el
diseño y navegar, **pero no** el GPS, las notificaciones ni la instalación como
app: esos requieren HTTPS.

### Prueba completa en iPhone / iPad (recomendado)

iOS solo permite service worker, geolocalización y notificaciones sobre
**HTTPS**, y las notificaciones **solo funcionan con la app instalada en la
pantalla de inicio** (Safari, iOS **16.4+**). La forma más simple es un túnel
HTTPS hacia tu PC:

1. Instala `cloudflared` (una vez):

   ```powershell
   winget install --id Cloudflare.cloudflared
   ```

2. Compila y arranca la app en una terminal:

   ```bash
   npm run build
   npm start
   ```

3. En otra terminal, abre el túnel:

   ```bash
   npm run tunnel
   ```

   Imprime una URL tipo `https://algo-al-azar.trycloudflare.com`. (Cada vez que
   lo arrancas cambia; si usas Web Push, pon esa URL en `APP_URL` del `.env`.)

4. En el iPhone, abre esa URL en **Safari** → botón **Compartir** → **Agregar a
   pantalla de inicio**. Ábrela desde el ícono (se ve a pantalla completa).

5. Dentro de la app instalada: **Calor y alertas** → activar los avisos (pide
   permiso de notificaciones) y, en Ajustes, “Usar mi ubicación (GPS)”.

6. Para simular una alerta: `npm run alertas:check` (con `APP_URL` apuntando al
   túnel y el `.env` con claves VAPID).

### Alternativa: desplegar (link para instalar)

`vercel` da una URL HTTPS estable. En **Android/Chrome** aparece solo el aviso
"Instalar app" (y la barra superior muestra un botón "Instalar"); en **iPhone**
Apple obliga a hacerlo a mano (Compartir → "Agregar a pantalla de inicio", la app
lo recuerda). Detalle y variables de entorno en [`DEPLOY.md`](DEPLOY.md). Nota: el
almacén de suscripciones de push (`.data/`) **no persiste** en hosts serverless.

## Estructura

- `src/app/` — páginas (App Router): `/` (panel), `/calor`, `/energia`, `/plan`, `/ajustes`.
- `src/app/api/clima/` — `GET ?municipio=` (cacheable) y `POST /gps` (coords en
  el cuerpo, redondeadas). Lógica compartida en `src/lib/clima.ts`.
- `src/app/api/enso/` — Route Handler que lee el ONI de la NOAA CPC.
- `src/lib/municipios.ts` — municipios del Caribe con coordenadas y operador de energía.
- `src/lib/heat.ts` — Heat Index, bandas de alerta y ajuste por comorbilidades.
- `src/lib/energia.ts` — presets de electrodomésticos y cálculo de factura.
- `src/lib/plan.ts` — repartidor del presupuesto de kWh entre electrodomésticos.
- `src/lib/store.tsx` — estado de la app en `localStorage`.
- `src/app/api/push/` — Web Push: `subscribe` (alta/baja), `check` (revisa y
  envía, protegido con `CRON_SECRET`), `test` (notificación de prueba).
- `src/lib/push.ts` — envío con `web-push` y almacén JSON en `.data/`.
- `scripts/check-alertas.mjs` — dispara `check` desde una tarea programada.

## Fuentes

- Clima: [Open-Meteo](https://open-meteo.com/).
- El Niño / ONI: [NOAA Climate Prediction Center](https://www.cpc.ncep.noaa.gov/data/indices/oni.ascii.txt).
- Heat Index: NOAA / National Weather Service (regresión de Rothfusz).
- Consumo de subsistencia: Resolución CREG (173 kWh/mes por debajo de 1.000 m s. n. m.).

Las cifras de factura son estimaciones y pueden diferir del recibo real.
