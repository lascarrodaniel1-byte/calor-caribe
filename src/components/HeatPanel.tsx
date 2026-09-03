"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getMunicipio } from "@/lib/municipios";
import { evaluarCalor, notaENOS } from "@/lib/heat";
import { useAppState } from "@/lib/store";
import { useClima, useEnso } from "@/lib/useClima";
import type { PuntoClima } from "@/lib/clima";
import {
  formatHace,
  formatNumber,
  formatTemp,
  formatHour,
} from "@/lib/format";
import { Button, Card, NumberField, Stat } from "./ui";
import ForecastChart from "./ForecastChart";
import UbicacionControl from "./UbicacionControl";

export default function HeatPanel({ full = false }: { full?: boolean }) {
  const { state } = useAppState();
  const municipioBase = getMunicipio(state.municipioSlug);
  const { clima, cargando, error, actualizadoEn, refrescar } = useClima({
    modo: state.modoClima,
    municipioSlug: state.municipioSlug,
    ubicacion: state.ubicacion,
  });
  const { enso } = useEnso();

  // Reloj para que "hace X min" avance solo.
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const sinDestino =
    state.modoClima === "gps" ? !state.ubicacion : !municipioBase;

  if (sinDestino) {
    return (
      <div className="space-y-4">
        {full && <UbicacionControl />}
        <Card>
          <p className="text-sm">
            {state.modoClima === "gps"
              ? "Comparte tu ubicación para ver la sensación térmica de tu zona."
              : "Elige tu municipio en "}
            {state.modoClima !== "gps" && (
              <Link
                href="/ajustes"
                className="font-semibold text-primary underline"
              >
                Ajustes
              </Link>
            )}
            {state.modoClima !== "gps" &&
              " para ver la sensación térmica y las alertas."}
          </p>
        </Card>
      </div>
    );
  }

  const nombreLugar = clima
    ? clima.preciso
      ? `Tu zona (cerca de ${clima.municipio.nombre})`
      : `${clima.municipio.nombre}, ${clima.municipio.departamento}`
    : municipioBase
      ? `${municipioBase.nombre}, ${municipioBase.departamento}`
      : "tu zona";

  const ensoCard = enso ? (
    <Card className="bg-amber-50 border-amber-200">
      <p className="text-sm font-semibold text-amber-900">
        ENOS: {enso.fase}
        {enso.intensidad !== "—" ? ` (${enso.intensidad})` : ""} · ONI{" "}
        {formatNumber(enso.oni, 1)} · {enso.trimestre}
      </p>
      <p className="mt-1 text-sm text-amber-900/90">{notaENOS(enso)}</p>
      <p className="mt-1 text-xs text-amber-800/70">Fuente: {enso.fuente}</p>
    </Card>
  ) : null;

  const barraActualizacion = (
    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
      <span>
        {cargando
          ? "Actualizando…"
          : actualizadoEn
            ? `Actualizado ${formatHace(actualizadoEn)}`
            : "Sin datos aún"}
        {clima && ` · ${clima.fuente}`}
      </span>
      <button
        onClick={refrescar}
        className="-my-1 rounded px-2 py-2 font-semibold text-primary underline disabled:opacity-50"
        disabled={cargando}
      >
        Actualizar ahora
      </button>
    </div>
  );

  if (cargando && !clima) {
    return (
      <div className="space-y-4">
        {full && <UbicacionControl />}
        <Card>
          <p className="text-sm text-muted">Consultando el clima de {nombreLugar}…</p>
        </Card>
      </div>
    );
  }

  if (!clima) {
    return (
      <div className="space-y-4">
        {full && <UbicacionControl />}
        <Card className="border-l-4 border-yellow-400 bg-yellow-50">
          <p className="text-sm text-yellow-900">
            No se pudo consultar el clima automáticamente
            {error ? ` (${error})` : ""}. Ingresa la temperatura y la humedad a
            mano (las ves en el pronóstico del celular o un termómetro) y la app
            calcula igual la sensación térmica y tu nivel de alerta.
          </p>
          <div className="mt-2">{barraActualizacion}</div>
        </Card>
        {ensoCard}
        <ManualHeat full lugar={nombreLugar} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {full && <UbicacionControl />}
      <EvaluacionCalorView
        tempC={clima!.actual.tempC}
        rh={clima!.actual.rh}
        apparentC={clima!.actual.apparentC}
        hourly={full ? clima!.hourly : undefined}
        full={full}
        lugar={nombreLugar}
        cuando={formatHour(clima!.actual.time)}
        ensoCard={ensoCard}
      />
      {error && (
        <p className="text-xs text-yellow-700">
          El último intento de actualización falló ({error}); se muestra el dato
          previo.
        </p>
      )}
      {barraActualizacion}
      {!full && (
        <Link
          href="/calor"
          className="inline-block text-sm font-semibold text-primary underline"
        >
          Ver pronóstico, ubicación GPS y recomendaciones →
        </Link>
      )}
    </div>
  );
}

function ManualHeat({ full, lugar }: { full: boolean; lugar: string }) {
  const [tempC, setTempC] = useState(33);
  const [rh, setRh] = useState(70);
  const [calculado, setCalculado] = useState(false);

  return (
    <Card>
      <div className="grid gap-3 sm:grid-cols-3">
        <NumberField
          label="Temperatura ahora"
          value={tempC}
          onChange={setTempC}
          step={0.5}
          suffix="°C"
        />
        <NumberField
          label="Humedad relativa"
          value={rh}
          onChange={setRh}
          min={0}
          max={100}
          step={1}
          suffix="%"
        />
        <div className="flex items-end">
          <Button onClick={() => setCalculado(true)}>Calcular</Button>
        </div>
      </div>
      {calculado && (
        <div className="mt-4">
          <EvaluacionCalorView
            tempC={tempC}
            rh={rh}
            full={full}
            lugar={lugar}
            cuando="dato ingresado a mano"
          />
        </div>
      )}
    </Card>
  );
}

function EvaluacionCalorView({
  tempC,
  rh,
  apparentC,
  hourly,
  full,
  lugar,
  cuando,
  ensoCard,
}: {
  tempC: number;
  rh: number;
  apparentC?: number;
  hourly?: PuntoClima[];
  full: boolean;
  lugar: string;
  cuando: string;
  ensoCard?: React.ReactNode;
}) {
  const { state } = useAppState();
  const evaluacion = evaluarCalor(tempC, rh, state.perfil);
  const { banda, bandaPersonal, heatIndex, heatIndexPersonal, puntaje } =
    evaluacion;
  const personalizado = bandaPersonal.nivel !== banda.nivel;

  return (
    <div className="space-y-4">
      <Card className={`border-l-4 ${bandaPersonal.color}`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted">
              {lugar} · {cuando}
            </p>
            <p className="mt-1 text-3xl font-bold">
              Sensación térmica {formatTemp(heatIndex)}
            </p>
            <p className="mt-1 text-sm">
              Nivel de alerta:{" "}
              <span className="font-semibold">{banda.etiqueta}</span> —{" "}
              {banda.resumen}
            </p>
          </div>
          <div
            className={`rounded-lg border px-3 py-2 text-center ${bandaPersonal.color}`}
          >
            <p className="text-[11px] font-medium uppercase">Tu nivel</p>
            <p className="text-xl font-bold">{bandaPersonal.etiqueta}</p>
          </div>
        </div>

        {personalizado && (
          <p className="mt-3 rounded-md bg-white/60 px-3 py-2 text-sm">
            Según el perfil de salud que registraste (puntaje de vulnerabilidad{" "}
            {puntaje}), el calor de ahora equivale para ti a una sensación de{" "}
            <strong>{formatTemp(heatIndexPersonal)}</strong>: sigue las
            recomendaciones del nivel <strong>{bandaPersonal.etiqueta}</strong>.
          </p>
        )}
      </Card>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Temperatura" value={formatTemp(tempC)} />
        <Stat label="Humedad" value={`${formatNumber(rh, 0)} %`} />
        {apparentC !== undefined && (
          <Stat
            label="Sensación (modelo)"
            value={formatTemp(apparentC)}
            sub="apparent temp. Open-Meteo"
          />
        )}
        <Stat
          label="Heat Index (NWS)"
          value={formatTemp(heatIndex)}
          accent
          sub="temperatura + humedad"
        />
      </div>

      {ensoCard}

      {full && (
        <>
          {hourly && hourly.length > 0 && (
            <Card>
              <h3 className="mb-2 font-semibold text-primary">
                Sensación térmica próximas 48 horas
              </h3>
              <ForecastChart hourly={hourly} />
            </Card>
          )}

          <Card>
            <h3 className="mb-2 font-semibold text-primary">
              Qué hacer ahora ({bandaPersonal.etiqueta})
            </h3>
            <ul className="list-disc space-y-1.5 pl-5 text-sm text-slate-700">
              {evaluacion.recomendaciones.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </Card>

          <Card className="border-red-200 bg-red-50">
            <h3 className="mb-2 font-semibold text-red-800">
              Señales de golpe de calor — llama al 123
            </h3>
            <ul className="list-disc space-y-1.5 pl-5 text-sm text-red-900">
              {evaluacion.senalesAlarma.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </Card>
        </>
      )}
    </div>
  );
}
