# Publicar Calor Caribe — paso a paso (para novatos)

El código ya está preparado en tu computador. Falta: subirlo a GitHub y
conectarlo con Vercel para que quede en internet.

---

## PARTE 1 · Cuenta de GitHub

Si ya tienes cuenta, salta a la Parte 2.

1. Entra a <https://github.com/signup>.
2. Escribe tu correo, una contraseña y un nombre de usuario.
3. Verifica el correo que te llega.

---

## PARTE 2 · Crear el repositorio (la "carpeta" en internet)

1. Entra a <https://github.com/new> (ya con sesión iniciada).
2. En **Repository name** escribe: `calor-caribe`
3. Deja **Public** o **Private**, cualquiera sirve.
4. **NO marques** ninguna de estas casillas:
   - "Add a README file"
   - "Add .gitignore"
   - "Choose a license"
5. Botón verde **Create repository**.
6. Te queda una página con una dirección arriba tipo:
   `https://github.com/tu-usuario/calor-caribe`
   Déjala abierta.

---

## PARTE 3 · Abrir la terminal en la carpeta correcta

1. Abre el **Explorador de archivos** (la carpeta amarilla de la barra de tareas).
2. Ve a **Escritorio → Jurisbot**.
3. Haz clic en la **barra de direcciones** de arriba (donde dice la ruta).
4. Bórrala, escribe `powershell` y pulsa **Enter**.
5. Se abre una ventana azul/negra. Ya está ubicada en la carpeta correcta
   (debe decir `...\Desktop\Jurisbot>` al final de la línea).

Los comandos siguientes se **copian y pegan** en esa ventana. Para pegar:
clic derecho, o `Ctrl + V`. Después de cada uno, pulsa **Enter**.

---

## PARTE 4 · Subir el código a GitHub

1. Copia esta línea, **cambiando `tu-usuario`** por tu usuario real de GitHub:

   ```
   git remote add origin https://github.com/tu-usuario/calor-caribe.git
   ```

   (Si responde `error: remote origin already exists`, usa en su lugar:
   `git remote set-url origin https://github.com/tu-usuario/calor-caribe.git`)

2. Ahora esta:

   ```
   git push -u origin main
   ```

3. **Se abre una ventana del navegador** que dice "Sign in to GitHub" o
   "Authorize Git Credential Manager". Inicia sesión / autoriza. Cierra esa
   pestaña cuando diga que ya está.

4. Vuelve a la terminal. Debe aparecer algo como
   `main -> main` y `branch 'main' set up to track...`. Eso es que funcionó.

5. Recarga la página de GitHub: ahora se ven todos los archivos.

> Si el navegador no se abre solo: en la terminal aparecerá pidiendo
> **Username** (tu usuario de GitHub) y **Password**. En "Password" **no** va tu
> contraseña normal, sino un *token*: créalo en
> <https://github.com/settings/tokens> → "Generate new token (classic)" →
> marca la casilla **repo** → Generate → cópialo y pégalo.

---

## PARTE 5 · Conectar con Vercel

1. Entra a <https://vercel.com/new> (con tu sesión de Vercel).
2. En la lista de repositorios busca **calor-caribe** y pulsa **Import**.
   - La primera vez te pedirá **Install** / autorizar Vercel en tu GitHub.
     Acepta (puedes darle acceso solo a ese repo).
3. En la pantalla de configuración:
   - **Framework Preset**: debe decir *Next.js* (se detecta solo).
   - No toques nada más.
   - Pulsa **Deploy**.
4. Espera ~1–2 minutos. Cuando termine, sale una imagen de la app y un botón
   **Continue to Dashboard** o **Visit**.
5. Tu dirección es algo como `https://calor-caribe-xxxx.vercel.app`.

---

## PARTE 6 · Comprobar

Abre en el navegador (cambiando por tu dirección real):

- `https://calor-caribe-xxxx.vercel.app/` → carga la app y la pantalla de
  términos.
- `https://calor-caribe-xxxx.vercel.app/manifest.webmanifest` → un texto con
  llaves `{ }`.
- `https://calor-caribe-xxxx.vercel.app/.well-known/assetlinks.json` → un texto
  con corchetes `[ ]`.

Si las tres abren, quedó bien. Pásame la dirección y seguimos con el `.apk`
(ver [ANDROID.md](ANDROID.md)).

---

## Para actualizar la app más adelante

Cuando cambies algo del código, en la terminal (Parte 3):

```
git add -A
git commit -m "describe el cambio"
git push
```

Vercel publica la nueva versión sola en ~1 minuto.
