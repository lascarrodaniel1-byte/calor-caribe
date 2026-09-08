# App de Android (.apk) para Calor Caribe

La app de Android es un **envoltorio** (Trusted Web Activity): un `.apk` real que
se instala como cualquier app y abre Calor Caribe a pantalla completa. El código
sigue viviendo en el sitio publicado, así que la app **se actualiza sola** cuando
actualizas el sitio.

## Paso 0 — Publicar el sitio

Necesitas la app en una URL HTTPS. Sigue [`DEPLOY.md`](DEPLOY.md) (Vercel).
Anota tu dominio, p. ej. `calor-caribe.vercel.app`.

## Opción A — PWABuilder (sin instalar nada, recomendada)

1. Entra a <https://www.pwabuilder.com> y escribe la URL de tu sitio.
2. **Package For Stores → Android → Generate Package**. Deja "Signing key" en
   *"Create new"* la primera vez y **guarda el `.zip` y el archivo de la clave**
   (los necesitas para futuras actualizaciones).
3. El `.zip` trae:
   - `app-release-signed.apk` → para instalar directo en un teléfono.
   - `app-release.aab` → para subir a Google Play.
   - `assetlinks.json` y un `README` con la **huella SHA-256**.
4. **Pantalla completa sin barra de direcciones**: copia la huella SHA-256 del
   `assetlinks.json` y, en Vercel → *Settings → Environment Variables*, agrega:
   - `ANDROID_PACKAGE_NAME` = el `package_name` que aparece en ese archivo
     (por defecto `app.calorcaribe.twa`)
   - `ANDROID_CERT_FINGERPRINTS` = la huella `SHA256` (puedes poner varias
     separadas por coma)

   Vuelve a desplegar. La app ya trae el rewrite que sirve
   `/.well-known/assetlinks.json` con esos datos.
5. **Instalar el `.apk`**: pásalo al teléfono (correo, cable, Drive) y ábrelo.
   Android pedirá permitir "instalar apps desconocidas" para esa fuente. Acepta.

## Opción B — Bubblewrap (línea de comandos)

```bash
npm i -g @bubblewrap/cli
bubblewrap init --manifest https://TU-DOMINIO/manifest.webmanifest
# (la primera vez descarga JDK + Android SDK; responde a las preguntas)
bubblewrap build
```

- Usa `twa-manifest.json` de este repo como referencia (reemplaza el dominio).
- `bubblewrap build` genera `app-release-signed.apk` y `app-release-bundle.aab`
  e imprime la **huella SHA-256** → ponla en las variables de entorno del paso
  A.4 y vuelve a desplegar.
- Con el teléfono en modo depuración USB: `bubblewrap install`. Si no,
  transfiere el `.apk` y ábrelo.
- **Guarda `android.keystore` y su contraseña**: sin ese archivo no podrás
  publicar actualizaciones.

## Notas

- **Notificaciones**: funcionan dentro de la TWA (Android 13+ pide permiso la
  primera vez). Requieren las claves VAPID configuradas (ver `DEPLOY.md`).
- **Google Play**: opcional. Pago único de 25 USD de cuenta de desarrollador.
  Subes el `.aab`, y las actualizaciones y la instalación quedan automáticas.
- **iPhone**: no aplica. En iOS la única vía sin cuenta de Apple es la PWA
  (Safari → Compartir → "Agregar a pantalla de inicio").
- El `.apk` **no** empaqueta el código dentro: si el sitio se cae, la app no
  abre. Para una app 100 % offline habría que reconstruirla con Capacitor
  (requiere exportar el front-end a estático y mover la lógica de servidor).
