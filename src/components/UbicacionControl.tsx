"use client";

import { useState } from "react";
import { useAppState } from "@/lib/store";
import { getMunicipio } from "@/lib/municipios";

export default function UbicacionControl() {
  const { state, update } = useAppState();
  const [pidiendo, setPidiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const municipio = getMunicipio(state.municipioSlug);

  function usarGps() {
    if (!("geolocation" in navigator)) {
      setError("Este dispositivo no permite compartir la ubicación.");
      return;
    }
    setPidiendo(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        update({
          modoClima: "gps",
          ubicacion: {
            // ~1 km: suficiente para el clima, sin guardar la posición exacta.
            lat: Math.round(pos.coords.latitude * 100) / 100,
            lon: Math.round(pos.coords.longitude * 100) / 100,
            ts: Date.now(),
          },
        });
        setPidiendo(false);
      },
      (err) => {
        setPidiendo(false);
        setError(
          err.code === err.PERMISSION_DENIED
            ? "Permiso de ubicación denegado. Actívalo en los ajustes del navegador para usar tu zona."
            : "No se pudo obtener la ubicación. Intenta de nuevo al aire libre.",
        );
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 5 * 60 * 1000 },
    );
  }

  const enGps = state.modoClima === "gps" && state.ubicacion;

  return (
    <div className="rounded-lg border border-border bg-slate-50 p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">Origen del clima:</span>
        <button
          onClick={() => update({ modoClima: "municipio" })}
          className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
            state.modoClima === "municipio"
              ? "bg-primary text-white"
              : "border border-border bg-white"
          }`}
        >
          {municipio ? municipio.nombre : "Municipio"}
        </button>
        <button
          onClick={usarGps}
          disabled={pidiendo}
          className={`rounded-md px-3 py-1.5 text-xs font-semibold disabled:opacity-50 ${
            enGps ? "bg-primary text-white" : "border border-border bg-white"
          }`}
        >
          {pidiendo
            ? "Buscando…"
            : enGps
              ? "Actualizar mi ubicación (GPS)"
              : "Usar mi ubicación (GPS)"}
        </button>
      </div>

      {enGps && (
        <p className="mt-2 text-xs text-muted">
          Usando tu zona aproximada ({state.ubicacion!.lat.toFixed(2)},{" "}
          {state.ubicacion!.lon.toFixed(2)}, ~1 km). El navegador pide permiso
          una sola vez; la coordenada redondeada se usa solo para consultar el
          clima y no se almacena (salvo que actives los avisos con la app
          cerrada).
        </p>
      )}

      {error && <p className="mt-2 text-xs text-red-700">{error}</p>}

      {!enGps && (
        <p className="mt-2 text-xs text-muted">
          Con “Usar mi ubicación” la sensación térmica se calcula para tu zona
          (redondeada a ~1 km), no para el centro del municipio.
        </p>
      )}
    </div>
  );
}
