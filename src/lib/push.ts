import "server-only";

import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import webpush, { type PushSubscription } from "web-push";
import type { UltimoAviso } from "./heat";

/**
 * Almacenamiento local de suscripciones de Web Push.
 *
 * Se guarda en `.data/push-subs.json` (fuera de git). Cada registro contiene
 * SOLO lo mínimo para enviar un aviso de calor con la app cerrada:
 *  - la suscripción del navegador (endpoint + claves del servicio de push),
 *  - dónde consultar el clima (municipio o coordenadas redondeadas ~1 km),
 *  - un número 0–7 que resume la vulnerabilidad (ajuste al heat index).
 * No se guarda identidad ni el detalle de las comorbilidades.
 */

export interface RegistroPush {
  endpoint: string;
  sub: PushSubscription;
  municipioSlug?: string;
  lat?: number;
  lon?: number;
  ajuste: number;
  /** nivel + sensación térmica del último aviso enviado a este dispositivo */
  ultimoAviso?: UltimoAviso;
  creado: number;
  actualizado: number;
}

/**
 * Directorio de datos. Por defecto `.data/` en la carpeta del proyecto; si esa
 * ruta es de solo lectura (hosts serverless) se usa `PUSH_DATA_DIR` o una
 * carpeta temporal. En ese caso las suscripciones no sobreviven a un reinicio:
 * para producción conviene un almacén persistente (KV, base de datos).
 */
let dirResuelto: string | null = null;

async function dirDatos(): Promise<string> {
  if (dirResuelto) return dirResuelto;
  const candidatos = [
    process.env.PUSH_DATA_DIR,
    path.join(process.cwd(), ".data"),
    path.join(os.tmpdir(), "calor-caribe"),
  ].filter((x): x is string => !!x);

  for (const dir of candidatos) {
    try {
      await fs.mkdir(dir, { recursive: true });
      await fs.access(dir);
      dirResuelto = dir;
      return dir;
    } catch {
      /* probar el siguiente */
    }
  }
  dirResuelto = os.tmpdir();
  return dirResuelto;
}

async function archivo(): Promise<string> {
  return path.join(await dirDatos(), "push-subs.json");
}

let vapidListo = false;

export function configurarVapid(): boolean {
  if (vapidListo) return true;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:alertas@calorcaribe.local";
  if (!pub || !priv) return false;
  webpush.setVapidDetails(subject, pub, priv);
  vapidListo = true;
  return true;
}

async function leer(): Promise<RegistroPush[]> {
  try {
    const raw = await fs.readFile(await archivo(), "utf8");
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

/** Devuelve false si el almacenamiento no está disponible (no lanza). */
async function escribir(regs: RegistroPush[]): Promise<boolean> {
  try {
    await fs.writeFile(await archivo(), JSON.stringify(regs, null, 2), "utf8");
    return true;
  } catch {
    return false;
  }
}

export async function listarSubs(): Promise<RegistroPush[]> {
  return leer();
}

export async function guardarSub(
  entrada: Omit<RegistroPush, "creado" | "actualizado">,
): Promise<boolean> {
  const regs = await leer();
  const i = regs.findIndex((r) => r.endpoint === entrada.endpoint);
  const ahora = Date.now();
  if (i >= 0) {
    regs[i] = { ...regs[i], ...entrada, actualizado: ahora };
  } else {
    regs.push({ ...entrada, creado: ahora, actualizado: ahora });
  }
  return escribir(regs);
}

export async function eliminarSub(endpoint: string): Promise<void> {
  const regs = await leer();
  await escribir(regs.filter((r) => r.endpoint !== endpoint));
}

async function marcarAviso(
  endpoint: string,
  aviso: UltimoAviso | null,
): Promise<void> {
  const regs = await leer();
  const i = regs.findIndex((r) => r.endpoint === endpoint);
  if (i >= 0) {
    if (aviso) regs[i].ultimoAviso = aviso;
    else delete regs[i].ultimoAviso;
    regs[i].actualizado = Date.now();
    await escribir(regs);
  }
}

export interface PayloadPush {
  title: string;
  body: string;
  tag?: string;
  url?: string;
}

/** Envía un aviso. Si la suscripción caducó (404/410) la elimina. */
export async function enviarPush(
  reg: RegistroPush,
  payload: PayloadPush,
): Promise<"ok" | "expirada" | "error"> {
  if (!configurarVapid()) return "error";
  try {
    await webpush.sendNotification(reg.sub, JSON.stringify(payload));
    return "ok";
  } catch (err: unknown) {
    const code =
      typeof err === "object" && err !== null && "statusCode" in err
        ? (err as { statusCode?: number }).statusCode
        : undefined;
    if (code === 404 || code === 410) {
      await eliminarSub(reg.endpoint);
      return "expirada";
    }
    return "error";
  }
}

export { marcarAviso };
