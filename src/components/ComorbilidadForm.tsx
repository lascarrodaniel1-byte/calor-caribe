"use client";

import { COMORBILIDAD_LABELS, ComorbilidadPerfil } from "@/lib/heat";

export default function ComorbilidadForm({
  perfil,
  onChange,
}: {
  perfil: ComorbilidadPerfil;
  onChange: (patch: Partial<ComorbilidadPerfil>) => void;
}) {
  const claves = Object.keys(COMORBILIDAD_LABELS) as (keyof ComorbilidadPerfil)[];
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm text-muted mb-1">
        Marca lo que aplique para ti o para alguien de tu hogar. Sirve para
        ajustar el nivel de alerta. El detalle se queda en este dispositivo; solo
        si activas los avisos con la app cerrada, un número (0–7) que lo resume
        puede ir al servidor, y es opcional.
      </legend>
      {claves.map((k) => (
        <label
          key={k}
          className="flex items-start gap-3 rounded-md border border-border bg-white px-3 py-2 text-sm"
        >
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4"
            checked={perfil[k]}
            onChange={(e) => onChange({ [k]: e.target.checked })}
          />
          <span>{COMORBILIDAD_LABELS[k]}</span>
        </label>
      ))}
    </fieldset>
  );
}
