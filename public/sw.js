/* Service worker de Calor Caribe.
 * - Cachea el "shell" para que la app abra sin conexión.
 * - Revisa el clima en segundo plano (Periodic Background Sync) y avisa si la
 *   sensación térmica llega a un nivel peligroso. El sistema operativo decide
 *   la frecuencia real; en iOS y en muchos Android esto no se ejecuta.
 */

const SHELL = "calor-shell-v4";
const CFG = "calor-cfg-v1";
const SHELL_URLS = ["/", "/calor", "/energia", "/plan", "/ajustes", "/icon-192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL).then((c) => c.addAll(SHELL_URLS)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== SHELL && k !== CFG)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return; // el clima siempre en vivo

  event.respondWith(
    fetch(request)
      .then((res) => {
        const copy = res.clone();
        caches.open(SHELL).then((c) => c.put(request, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(request).then((r) => r || caches.match("/"))),
  );
});

self.addEventListener("message", (event) => {
  const data = event.data;
  if (data && data.type === "config") {
    event.waitUntil(
      caches
        .open(CFG)
        .then((c) =>
          c.put("/__cfg", new Response(JSON.stringify(data.payload))),
        ),
    );
  }
});

// Web Push: aviso enviado por el servidor aunque la app esté cerrada.
self.addEventListener("push", (event) => {
  let d = {};
  try {
    d = event.data ? event.data.json() : {};
  } catch {
    d = { title: "Alerta de calor", body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    self.registration.showNotification(d.title || "Alerta de calor", {
      body: d.body || "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: d.tag || "clima-push",
      renotify: true,
      data: { url: d.url || "/calor" },
    }),
  );
});

self.addEventListener("periodicsync", (event) => {
  if (event.tag === "clima-check") {
    event.waitUntil(revisarClima());
  }
});

// Permite forzar una revisión desde la página (botón de prueba).
self.addEventListener("sync", (event) => {
  if (event.tag === "clima-check") event.waitUntil(revisarClima());
});

async function revisarClima() {
  const cfgCache = await caches.open(CFG);
  const res = await cfgCache.match("/__cfg");
  if (!res) return;
  const cfg = await res.json(); // { municipioSlug|lat/lon, ajuste, ultimaClave }

  let clima;
  try {
    const r = cfg.municipioSlug
      ? await fetch(
          "/api/clima?municipio=" + encodeURIComponent(cfg.municipioSlug),
          { cache: "no-store" },
        )
      : await fetch("/api/clima/gps", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ lat: cfg.lat, lon: cfg.lon }),
          cache: "no-store",
        });
    if (!r.ok) return;
    clima = await r.json();
  } catch {
    return;
  }

  const hi = heatIndexC(clima.actual.tempC, clima.actual.rh) + (cfg.ajuste || 0);
  const { etiqueta, peligroso } = banda(hi);
  if (!peligroso) return;

  const hoy = new Date().toDateString();
  const clave = `${etiqueta}-${hoy}`;
  if (cfg.ultimaClave === clave) return;
  cfg.ultimaClave = clave;
  await cfgCache.put("/__cfg", new Response(JSON.stringify(cfg)));

  await self.registration.showNotification(`Alerta de calor: ${etiqueta}`, {
    body: `Sensación térmica ${Math.round(hi)} °C en ${
      clima.municipio ? clima.municipio.nombre : "tu zona"
    }. Hidrátate y evita el sol.`,
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: "clima-check",
  });
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const destino = (event.notification.data && event.notification.data.url) || "/calor";
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((cs) => {
      const c = cs.find((x) => x.url.includes(destino)) || cs[0];
      if (c) return c.focus();
      return self.clients.openWindow(destino);
    }),
  );
});

// --- Heat Index (versión compacta de src/lib/heat.ts) ---
function heatIndexC(tempC, rh) {
  if (tempC < 27) return tempC;
  const T = (tempC * 9) / 5 + 32;
  const R = Math.max(0, Math.min(100, rh));
  let hiF = 0.5 * (T + 61 + (T - 68) * 1.2 + R * 0.094);
  if ((hiF + T) / 2 >= 80) {
    hiF =
      -42.379 +
      2.04901523 * T +
      10.14333127 * R -
      0.22475541 * T * R -
      6.83783e-3 * T * T -
      5.481717e-2 * R * R +
      1.22874e-3 * T * T * R +
      8.5282e-4 * T * R * R -
      1.99e-6 * T * T * R * R;
    if (R < 13 && T >= 80 && T <= 112)
      hiF -= ((13 - R) / 4) * Math.sqrt((17 - Math.abs(T - 95)) / 17);
    else if (R > 85 && T >= 80 && T <= 87)
      hiF += ((R - 85) / 10) * ((87 - T) / 5);
  }
  return ((hiF - 32) * 5) / 9;
}

function banda(hiC) {
  if (hiC >= 54) return { etiqueta: "Peligro extremo", peligroso: true };
  if (hiC >= 41) return { etiqueta: "Peligro", peligroso: true };
  if (hiC >= 32) return { etiqueta: "Precaución extrema", peligroso: true };
  return { etiqueta: "Normal", peligroso: false };
}
