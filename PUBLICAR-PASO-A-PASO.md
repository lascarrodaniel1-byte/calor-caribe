# Subir Calor Caribe a GitHub — paso a paso (para novatos)

## Lo que YA está listo en tu computador

No tienes que hacer nada de esto, solo para que sepas:

- Git está instalado.
- El proyecto está preparado y guardado en 2 "commits" (fotos del código).
- La rama se llama `main`.
- La dirección de tu repositorio ya está configurada:
  `https://github.com/lascarrodaniel1-byte/calor-caribe.git`

**Te faltan 3 pasos.**

---

## PASO 1 · Crear el repositorio VACÍO en GitHub

> Un "repositorio" es la carpeta del proyecto guardada en internet.

1. Abre el navegador y entra a: **https://github.com/new**
   (si te pide iniciar sesión, hazlo con tu usuario `lascarrodaniel1-byte`).

2. En **Repository name** escribe exactamente:

   ```
   calor-caribe
   ```

3. En **Description** puedes dejarlo vacío o poner "App de calor y energía".

4. Deja seleccionado **Public** (o **Private** si prefieres; ambos sirven).

5. ⚠️ **MUY IMPORTANTE:** más abajo, en "Initialize this repository with",
   **NO marques ninguna casilla**:
   - ☐ Add a README file
   - ☐ Add .gitignore
   - ☐ Choose a license

   Si marcas alguna, el siguiente paso fallará.

6. Pulsa el botón verde **Create repository**.

7. Te queda una página que dice algo como *"Quick setup"* y muestra comandos.
   **Ignora esos comandos**, ya los tenemos. Solo deja esta pestaña abierta.

---

## PASO 2 · Abrir PowerShell dentro de la carpeta del proyecto

1. Abre el **Explorador de archivos** (icono de carpeta amarilla en la barra
   de tareas).

2. Entra a: **Este equipo → Escritorio → Jurisbot**
   (o **Escritorio → Jurisbot** en el panel izquierdo).

3. Comprueba que dentro ves carpetas como `src`, `public`, y archivos como
   `package.json`. Esa es la carpeta correcta.

4. Haz **un clic** en la barra blanca de arriba que muestra la ruta
   (`... > Escritorio > Jurisbot`). Se pondrá azul y mostrará texto.

5. Bórrala toda, escribe:

   ```
   powershell
   ```

   y pulsa **Enter**.

6. Se abre una ventana oscura (PowerShell). En la última línea debe terminar en:

   ```
   C:\Users\lenovo 81Uv\Desktop\Jurisbot>
   ```

   Si termina así, estás en el lugar correcto.

> Para **pegar** en PowerShell: clic derecho, o `Ctrl + V`. Después de pegar
> cada comando, pulsa **Enter**.

---

## PASO 3 · Subir el código

1. Copia y pega esta línea, y pulsa Enter:

   ```
   git push -u origin main
   ```

2. **Se abre una ventana del navegador** titulada *"Connect to GitHub"* o
   *"Sign in to GitHub"*. Inicia sesión con tu cuenta y pulsa **Authorize**.
   Cuando diga que puedes cerrar la pestaña, ciérrala.

3. Vuelve a PowerShell. Si funcionó, verás algo así:

   ```
   Enumerating objects: 90, done.
   Writing objects: 100% ...
   To https://github.com/lascarrodaniel1-byte/calor-caribe.git
    * [new branch]      main -> main
   branch 'main' set up to track 'origin/main'.
   ```

4. Recarga en el navegador:
   **https://github.com/lascarrodaniel1-byte/calor-caribe**
   Ahora deben aparecer todos los archivos y carpetas del proyecto.

✅ Con esto el código ya está en GitHub.

---

## Si algo falla en el Paso 3

| Mensaje de error | Qué pasó | Solución |
|---|---|---|
| `repository not found` | El repo no existe o el nombre no es exactamente `calor-caribe` | Repite el Paso 1 con el nombre correcto |
| `Updates were rejected` / `failed to push some refs` | Creaste el repo con un README o .gitignore (marcaste una casilla) | Pega: `git push -u origin main --force` y Enter |
| Te pide `Username` y `Password` en la terminal | El navegador no abrió solo | Username = `lascarrodaniel1-byte`. En Password **no** va tu contraseña: crea un token en https://github.com/settings/tokens/new — marca la casilla **repo**, pulsa **Generate token**, cópialo y pégalo como contraseña |
| `git` no se reconoce | Git no está en el PATH de esa terminal | Cierra PowerShell y vuelve a abrirlo con el Paso 2 |

---

## Siguiente: publicar en Vercel

1. Entra a **https://vercel.com/new**
2. Busca **calor-caribe** en la lista de repositorios y pulsa **Import**.
   - La primera vez te pedirá instalar/autorizar Vercel en tu GitHub. Acepta.
3. **Framework Preset** debe decir *Next.js* (se detecta solo). No cambies nada.
4. Pulsa **Deploy** y espera 1–2 minutos.
5. Obtienes una dirección tipo `https://calor-caribe-xxxx.vercel.app`.

Comprueba que abren estas 3:
- `https://TU-URL/`
- `https://TU-URL/manifest.webmanifest`
- `https://TU-URL/.well-known/assetlinks.json`

---

## Para actualizar la app en el futuro

Cada vez que cambies el código, en PowerShell (Paso 2):

```
git add -A
git commit -m "describe lo que cambiaste"
git push
```

Vercel publica la nueva versión sola.
