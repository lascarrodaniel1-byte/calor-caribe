"use client";

/** Utilidades de Web Push en el navegador. */

/** El navegador puede recibir Web Push. */
export function pushNavegadorOk(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/** El servidor tiene configuradas las claves VAPID. */
export function pushConfigurado(): boolean {
  return !!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
}

export function pushSoportado(): boolean {
  return pushNavegadorOk() && pushConfigurado();
}

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export interface ParamsPush {
  municipioSlug: string | null;
  lat: number | null;
  lon: number | null;
  ajuste: number;
}

async function obtenerSuscripcion(): Promise<PushSubscription> {
  const reg = await navigator.serviceWorker.ready;
  const existente = await reg.pushManager.getSubscription();
  if (existente) return existente;
  return reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    ),
  });
}

/** Suscribe (o actualiza) este dispositivo en el servidor. */
export async function suscribirPush(params: ParamsPush): Promise<string> {
  const sub = await obtenerSuscripcion();
  const r = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ subscription: sub.toJSON(), ...params }),
  });
  if (!r.ok) {
    const j = await r.json().catch(() => ({}));
    throw new Error(j.error ?? "No se pudo registrar en el servidor");
  }
  return sub.endpoint;
}

/** Re-envía los parámetros al servidor si ya hay suscripción (sin crear una). */
export async function sincronizarPush(params: ParamsPush): Promise<void> {
  if (!pushSoportado()) return;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;
  await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ subscription: sub.toJSON(), ...params }),
  }).catch(() => {});
}

export async function desuscribirPush(): Promise<void> {
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;
  await fetch("/api/push/subscribe", {
    method: "DELETE",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ endpoint: sub.endpoint }),
  }).catch(() => {});
  await sub.unsubscribe().catch(() => {});
}

export async function haySuscripcion(): Promise<boolean> {
  if (!pushSoportado()) return false;
  const reg = await navigator.serviceWorker.ready;
  return !!(await reg.pushManager.getSubscription());
}

export async function enviarPrueba(): Promise<string> {
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) throw new Error("Este dispositivo no está suscrito");
  const r = await fetch("/api/push/test", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ endpoint: sub.endpoint }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error ?? "Falló el envío de prueba");
  return j.resultado ?? "ok";
}
