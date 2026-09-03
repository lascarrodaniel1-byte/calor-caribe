"use client";

import { MUNICIPIOS, DEPARTAMENTOS_CARIBE } from "@/lib/municipios";

export default function MunicipioPicker({
  value,
  onChange,
  label = "Municipio",
}: {
  value: string | null;
  onChange: (slug: string) => void;
  label?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <select
        className="mt-1 w-full rounded-md border border-border bg-white px-3 py-2 text-sm outline-none focus:border-primary"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="" disabled>
          Elige tu municipio…
        </option>
        {DEPARTAMENTOS_CARIBE.map((dep) => (
          <optgroup key={dep} label={dep}>
            {MUNICIPIOS.filter((m) => m.departamento === dep).map((m) => (
              <option key={m.slug} value={m.slug}>
                {m.nombre}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </label>
  );
}
