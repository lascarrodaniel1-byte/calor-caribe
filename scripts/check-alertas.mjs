/**
 * Dispara la revisión de alertas de calor para todos los dispositivos suscritos.
 * Pensado para una tarea programada (Programador de tareas de Windows / cron).
 *
 *   node scripts/check-alertas.mjs
 *
 * Lee APP_URL y CRON_SECRET del entorno o de .env. Requiere que el servidor
 * (`npm start`) esté corriendo.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");

function cargarEnv() {
  try {
    const txt = readFileSync(join(raiz, ".env"), "utf8");
    for (const linea of txt.split("\n")) {
      const m = linea.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/i);
      if (m && !process.env[m[1]]) {
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
      }
    }
  } catch {
    /* sin .env: se usan las variables del sistema */
  }
}

cargarEnv();

const base = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
const secret = process.env.CRON_SECRET || "";
const url = `${base}/api/push/check${secret ? `?secret=${encodeURIComponent(secret)}` : ""}`;

try {
  const r = await fetch(url, { method: "POST" });
  const j = await r.json();
  console.log(new Date().toISOString(), r.status, JSON.stringify(j));
  process.exit(r.ok ? 0 : 1);
} catch (e) {
  console.error(new Date().toISOString(), "error:", e.message);
  process.exit(1);
}
