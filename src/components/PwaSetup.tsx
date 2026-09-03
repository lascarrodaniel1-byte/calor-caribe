"use client";

import { useEffect } from "react";
import { ajusteComorbilidad } from "@/lib/heat";
import { useAppState } from "@/lib/store";
import { TERMINOS_VERSION } from "@/lib/terminos";
import { sincronizarPush } from "@/lib/pushClient";

/** Registra el service worker y le pasa la configuración para las
 *  revisiones de clima en segundo plano. Solo después de aceptar los términos. */
export default function PwaSetup() {
  const { state, ready } = useAppState();
  const aceptado = state.terminosAceptadosVersion === TERMINOS_VERSION;

  useEffect(() => {
    if (!aceptado || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, [aceptado]);

  useEffect(() => {
    if (!ready || !aceptado || !("serviceWorker" in navigator)) return;

    const gps = state.modoClima === "gps" && state.ubicacion;
    if (!gps && !state.municipioSlug) return;

    const ajuste = state.compartirVulnerabilidad
      ? ajusteComorbilidad(state.perfil)
      : 0;

    const params = {
      municipioSlug: gps ? null : state.municipioSlug,
      lat: gps ? Math.round(state.ubicacion!.lat * 100) / 100 : null,
      lon: gps ? Math.round(state.ubicacion!.lon * 100) / 100 : null,
      ajuste,
    };
    const payload = params;

    sincronizarPush(params);

    navigator.serviceWorker.ready
      .then(async (reg) => {
        reg.active?.postMessage({ type: "config", payload });

        if (
          state.alertasActivas &&
          "periodicSync" in reg &&
          typeof Notification !== "undefined" &&
          Notification.permission === "granted"
        ) {
          try {
            const status = await navigator.permissions.query({
              // @ts-expect-error nombre no tipado en TS DOM
              name: "periodic-background-sync",
            });
            if (status.state === "granted") {
              // @ts-expect-error periodicSync es experimental
              await reg.periodicSync.register("clima-check", {
                minInterval: 3 * 60 * 60 * 1000,
              });
            }
          } catch {
            /* no soportado: se usan los avisos en primer plano */
          }
        }
      })
      .catch(() => {});
  }, [
    ready,
    aceptado,
    state.modoClima,
    state.municipioSlug,
    state.ubicacion,
    state.perfil,
    state.alertasActivas,
    state.compartirVulnerabilidad,
  ]);

  return null;
}
