"use client";

/**
 * Utilidades de notificaciones locales.
 *
 * IMPORTANTE: en Android `new Notification(...)` lanza "Illegal constructor".
 * Hay que usar `ServiceWorkerRegistration.showNotification()`. Estas funciones
 * eligen el camino correcto y NUNCA lanzan (devuelven un booleano/string), para
 * que un fallo de notificación no tumbe la app.
 */

export async function pedirPermisoNotificaciones(): Promise<
  NotificationPermission | "unsupported"
> {
  try {
    if (typeof window === "undefined" || !("Notification" in window)) {
      return "unsupported";
    }
    const r = await Notification.requestPermission();
    return r;
  } catch {
    return "denied";
  }
}

export function estadoPermisoNotificaciones():
  | NotificationPermission
  | "unsupported" {
  try {
    if (typeof window === "undefined" || !("Notification" in window)) {
      return "unsupported";
    }
    return Notification.permission;
  } catch {
    return "unsupported";
  }
}

export async function mostrarNotificacion(
  titulo: string,
  opciones?: NotificationOptions,
): Promise<boolean> {
  try {
    if (typeof window === "undefined" || !("Notification" in window)) {
      return false;
    }
    if (Notification.permission !== "granted") return false;

    if ("serviceWorker" in navigator) {
      // `serviceWorker.ready` no resuelve si no hay SW registrado: se corta a 3 s.
      const reg = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise<null>((r) => setTimeout(() => r(null), 3000)),
      ]);
      if (reg) {
        await reg.showNotification(titulo, opciones);
        return true;
      }
    }

    // Navegadores de escritorio sin service worker: el constructor sí funciona
    // (en Android lanzaría "Illegal constructor", pero ahí ya se usó el SW).
    if (typeof ServiceWorkerRegistration === "undefined") {
      const n = new Notification(titulo, opciones);
      return !!n;
    }
    return false;
  } catch {
    return false;
  }
}
