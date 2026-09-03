# Publicar Calor Caribe (para que se instale con un link)

No se puede "subir un archivo" y ya: es una app con servidor (Next.js). Para que
la gente la abra desde un enlace y la instale, hay que publicarla en una URL con
HTTPS. Opciones:

## Opción A — Vercel (gratis, recomendada)

1. Instala la CLI y entra a tu cuenta:

   ```bash
   npm i -g vercel
   vercel login
   ```

2. Desde la carpeta del proyecto:

   ```bash
   vercel        # primera vez: crea el proyecto y da una URL de preview
   vercel --prod # publica la versión definitiva
   ```

3. Configura las variables de entorno en el panel de Vercel
   (**Project → Settings → Environment Variables**) o por CLI. Solo hacen falta
   si quieres los avisos con la app cerrada:

   | Variable | Valor |
   |---|---|
   | `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | clave pública VAPID |
   | `VAPID_PRIVATE_KEY` | clave privada VAPID |
   | `VAPID_SUBJECT` | `mailto:tu-correo@ejemplo.com` |
   | `CRON_SECRET` | cadena larga aleatoria |
   | `APP_URL` | la URL final de Vercel |

   Genera las VAPID con `node -e "console.log(require('web-push').generateVAPIDKeys())"`.

4. **Instalación en el teléfono** (esto es lo más cerca de "que se instale solo"):
   - **Android / Chrome**: al abrir la URL aparece solo un aviso "Instalar app"
     (y también el botón "Instalar" que agregamos en la barra superior).
   - **iPhone / Safari**: Apple **no permite instalar solo**. Hay que tocar
     **Compartir → “Agregar a pantalla de inicio”** (la app muestra el
     recordatorio). Es 1 vez y quedan 2 toques.

### Cron de avisos en Vercel

Añade `vercel.json`:

```json
{
  "crons": [{ "path": "/api/push/check?secret=TU_CRON_SECRET", "schedule": "0 * * * *" }]
}
```

> ⚠️ En Vercel el almacén de suscripciones es un archivo temporal: **se pierde
> en cada despliegue o arranque en frío**. Para que sea fiable hay que cambiar
> `src/lib/push.ts` por Vercel KV, Upstash Redis o una base de datos. Los avisos
> **en primer plano**, el GPS, la calculadora y la instalación funcionan sin eso.

## Opción B — Túnel a tu PC (Web Push 100% fiable)

Ver README, sección "Probar en un celular". El archivo `.data/push-subs.json`
vive en tu PC y no se pierde.

## Lo que NO sirve

- **Google Drive / Dropbox**: guardan archivos, no ejecutan un servidor web.
  Google quitó el hosting de sitios en Drive en 2016.
- **Abrir el HTML directo** (`file://`): no funcionan el service worker, las
  rutas ni las APIs.
- **APK / instalar desde archivo en iPhone**: iOS no permite instalar apps fuera
  del App Store. La PWA es la vía.
