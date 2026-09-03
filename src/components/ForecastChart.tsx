"use client";

import { useMemo } from "react";
import type { PuntoClima } from "@/app/api/clima/route";
import { BANDAS, heatIndexC } from "@/lib/heat";
import { formatHour } from "@/lib/format";

/** Gráfica de la sensación térmica (heat index) para las próximas ~48 horas. */
export default function ForecastChart({
  hourly,
  horas = 48,
}: {
  hourly: PuntoClima[];
  horas?: number;
}) {
  const puntos = useMemo(() => {
    const ahora = Date.now();
    return hourly
      .map((p) => ({
        t: new Date(p.time).getTime(),
        hi: heatIndexC(p.tempC, p.rh),
      }))
      .filter((p) => p.t >= ahora - 3600_000)
      .slice(0, horas);
  }, [hourly, horas]);

  if (puntos.length < 2) {
    return <p className="text-sm text-muted">Sin datos de pronóstico.</p>;
  }

  const W = 720;
  const H = 240;
  const padL = 34;
  const padR = 12;
  const padT = 12;
  const padB = 26;

  const his = puntos.map((p) => p.hi);
  const min = Math.floor(Math.min(...his, 24) / 2) * 2;
  const max = Math.ceil(Math.max(...his, 40) / 2) * 2;

  const x = (i: number) =>
    padL + (i / (puntos.length - 1)) * (W - padL - padR);
  const y = (v: number) =>
    padT + (1 - (v - min) / (max - min)) * (H - padT - padB);

  const linea = puntos.map((p, i) => `${x(i)},${y(p.hi)}`).join(" ");
  const area = `${x(0)},${y(min)} ${linea} ${x(puntos.length - 1)},${y(min)}`;

  // Bandas de riesgo visibles dentro del rango.
  const bandas = BANDAS.filter((b) => b.minHI > min && b.minHI < max);

  // Marcas de tiempo cada 6 h.
  const ticks = puntos
    .map((p, i) => ({ p, i }))
    .filter(({ i }) => i % 6 === 0);

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full min-w-[520px]"
        role="img"
        aria-label="Pronóstico de sensación térmica por hora"
      >
        {bandas.map((b) => (
          <g key={b.nivel}>
            <line
              x1={padL}
              x2={W - padR}
              y1={y(b.minHI)}
              y2={y(b.minHI)}
              stroke={b.colorHex}
              strokeDasharray="4 3"
              strokeWidth={1}
              opacity={0.6}
            />
            <text
              x={W - padR}
              y={y(b.minHI) - 3}
              textAnchor="end"
              fontSize={9}
              fill={b.colorHex}
            >
              {b.etiqueta} ({b.minHI}°)
            </text>
          </g>
        ))}

        {[min, (min + max) / 2, max].map((v) => (
          <text
            key={v}
            x={padL - 6}
            y={y(v) + 3}
            textAnchor="end"
            fontSize={9}
            fill="var(--color-muted)"
          >
            {v}°
          </text>
        ))}

        <polygon points={area} fill="var(--color-accent)" opacity={0.12} />
        <polyline
          points={linea}
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth={2}
          strokeLinejoin="round"
        />

        {ticks.map(({ p, i }) => (
          <text
            key={i}
            x={x(i)}
            y={H - 8}
            textAnchor="middle"
            fontSize={9}
            fill="var(--color-muted)"
          >
            {formatHour(new Date(p.t))}
          </text>
        ))}
      </svg>
    </div>
  );
}
