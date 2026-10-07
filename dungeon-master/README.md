# Dungeon Master · D&D 5e en la terminal

Un Dungeon Master impulsado por Claude para jugar partidas de Dungeons & Dragons 5.ª edición por texto, solo o con amigos en el mismo teclado.

- **Narra, interpreta PNJ y arbitra las reglas** de D&D 5e (SRD), en español.
- **Los dados son reales**: el modelo no inventa resultados; pide la tirada a este programa (`crypto.randomInt`) y tú la ves en pantalla. Soporta `1d20+5`, `2d6-1`, `4d6kh3`, ventaja/desventaja y tiradas secretas del DM.
- **Fichas de personaje**: el DM guía la creación de personaje y lleva PV, CA, atributos, inventario, oro y condiciones.
- **Partida guardada** en `partida.json` después de cada turno; al volver, el DM resume "lo que pasó la última vez".

## Requisitos

- Node.js 20 o superior.
- Una API key de Anthropic (https://platform.claude.com) en la variable `ANTHROPIC_API_KEY`.

## Cómo jugar

```bash
cd dungeon-master
npm install
export ANTHROPIC_API_KEY=sk-ant-...      # en Windows (PowerShell): $env:ANTHROPIC_API_KEY="sk-ant-..."
npm run jugar                            # continúa la partida guardada, o empieza una nueva
npm run jugar -- --nueva                 # empieza desde cero
```

Comandos dentro del juego:

| Comando | Qué hace |
|---|---|
| `/fichas` | Muestra las fichas de los personajes |
| `/notas` | Muestra las notas de campaña del DM |
| `/tirar 1d20+3` | Tiras tú mismo, sin pasar por el DM |
| `/salir` (o Ctrl+C) | Guarda y sale |

Si juegan varias personas, empieza cada mensaje con el nombre: `Ana: reviso el cofre en busca de trampas`.

## Configuración

| Variable | Por defecto | Para qué |
|---|---|---|
| `DM_MODELO` | `claude-opus-5-5` | Modelo de Claude que hace de DM (p. ej. `claude-sonnet-5-5` para abaratar) |
| `DM_PARTIDA` | `dungeon-master/partida.json` | Archivo de la partida (útil para tener varias campañas) |

## Cómo está hecho

| Archivo | Contenido |
|---|---|
| `src/prompt.ts` | Instrucciones del DM (estilo, reglas, creación de personaje) — edítalo para cambiar su personalidad o ambientación |
| `src/herramientas.ts` | Herramientas que puede usar el DM: `tirar_dados`, `guardar_personaje`, `modificar_personaje`, `anotar_mundo` |
| `src/dados.ts` | Motor de dados |
| `src/estado.ts` | Fichas y guardado de la partida |
| `src/index.ts` | Bucle de juego en la terminal (streaming + bucle de herramientas) |

Detalles técnicos: usa la API de Mensajes con streaming, prompt caching (el historial se reutiliza de un turno a otro, lo que abarata partidas largas) y `fallbacks: "default"`, que reintenta en otro modelo si el principal rechaza una petición, para que una escena oscura no corte la partida.
