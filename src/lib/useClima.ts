"use client";

import { useCallback, useEffect, useState } from "react";
import type { RespuestaClima } from "@/lib/clima";
import type { EstadoENOS } from "./heat";
import type { ModoClima, Ubicacion } from "./store";

interface Opciones {
  modo: ModoClima;
  municipioSlug: string | null;
  ubicacion: Ubicacion | null;
  /** cada cuánto refrescar automáticamente (ms). Por defecto 10 min. */
  intervaloMs?: number;
}

interface EstadoClima {
  clima: RespuestaClima | null;
  cargando: boolean;
  error: string | null;
  actualizadoEn: number | null;
  refrescar: () => void;
}

export function useClima(o: Opciones): EstadoClima {
  const intervalo = o.intervaloMs ?? 10 * 60 * 1000;
  const modo = o.modo;
  const slug = o.municipioSlug;
  // Coordenadas redondeadas a ~1 km antes de salir del dispositivo.
  const lat = o.ubicacion ? Math.round(o.ubicacion.lat * 100) / 100 : null;
  const lon = o.ubicacion ? Math.round(o.ubicacion.lon * 100) / 100 : null;
  const activo = modo === "gps" ? lat !== null && lon !== null : !!slug;

  const [clima, setClima] = useState<RespuestaClima | null>(null);
  const [cargando, setCargando] = useState(activo);
  const [error, setError] = useState<string | null>(null);
  const [actualizadoEn, setActualizadoEn] = useState<number | null>(null);
  const [nonce, setNonce] = useState(0);

  const refrescar = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!activo) {
      setClima(null);
      setCargando(false);
      setError(null);
      return;
    }
    let vivo = true;
    setCargando(true);
    setError(null);

    const req =
      modo === "gps"
        ? fetch("/api/clima/gps", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ lat, lon }),
            cache: "no-store",
          })
        : fetch(`/api/clima?municipio=${encodeURIComponent(slug as string)}`, {
            cache: "no-store",
          });

    req
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error ?? "Error al consultar el clima");
        return j as RespuestaClima;
      })
      .then((c) => {
        if (!vivo) return;
        setClima(c);
        setActualizadoEn(Date.now());
        setCargando(false);
      })
      .catch((e: unknown) => {
        if (!vivo) return;
        setError(e instanceof Error ? e.message : "Error desconocido");
        setCargando(false);
      });

    return () => {
      vivo = false;
    };
  }, [activo, modo, slug, lat, lon, nonce]);

  // Refresco automático: por intervalo, al volver a la pestaña y al reconectar.
  useEffect(() => {
    if (!activo) return;
    const id = setInterval(refrescar, intervalo);
    const onVis = () => {
      if (document.visibilityState === "visible") refrescar();
    };
    const onOnline = () => refrescar();
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("online", onOnline);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("online", onOnline);
    };
  }, [activo, intervalo, refrescar]);

  return { clima, cargando, error, actualizadoEn, refrescar };
}

export function useEnso(): { enso: EstadoENOS | null; cargando: boolean } {
  const [enso, setEnso] = useState<EstadoENOS | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let vivo = true;
    fetch("/api/enso")
      .then((r) => r.json())
      .then((j: EstadoENOS) => {
        if (vivo) {
          setEnso(j);
          setCargando(false);
        }
      })
      .catch(() => {
        if (vivo) setCargando(false);
      });
    return () => {
      vivo = false;
    };
  }, []);

  return { enso, cargando };
}
