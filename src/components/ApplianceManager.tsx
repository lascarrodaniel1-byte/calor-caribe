"use client";

import { useState } from "react";
import {
  CATEGORIA_LABEL,
  Categoria,
  Electrodomestico,
  PRESETS,
  kwhMes,
  nuevoId,
} from "@/lib/energia";
import { useAppState } from "@/lib/store";
import { formatKwh, formatNumber } from "@/lib/format";
import { Button, Card } from "./ui";

const CATEGORIAS = Object.keys(CATEGORIA_LABEL) as Categoria[];

export default function ApplianceManager({
  showPrioridad = true,
}: {
  showPrioridad?: boolean;
}) {
  const {
    state,
    addElectrodomestico,
    updateElectrodomestico,
    removeElectrodomestico,
  } = useAppState();
  const [presetIdx, setPresetIdx] = useState("");

  function agregarPreset(idx: string) {
    const p = PRESETS[Number(idx)];
    setPresetIdx("");
    if (!p) return;
    addElectrodomestico({ id: nuevoId(), ...p });
  }

  function agregarVacio() {
    addElectrodomestico({
      id: nuevoId(),
      nombre: "Nuevo electrodoméstico",
      potenciaW: 100,
      horasDia: 1,
      diasMes: 30,
      categoria: "otro",
      esencial: false,
      prioridad: 3,
    });
  }

  return (
    <div className="space-y-4">
      <Card>
        <p className="text-sm font-medium text-foreground">Agregar electrodoméstico</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <select
            className="w-full max-w-full min-w-0 rounded-md border border-border bg-white px-3 py-2.5 text-sm sm:w-auto"
            value={presetIdx}
            onChange={(e) => agregarPreset(e.target.value)}
          >
            <option value="">Elegir de la lista…</option>
            {PRESETS.map((p, i) => (
              <option key={p.nombre} value={i}>
                {p.nombre} — {p.potenciaW} W
              </option>
            ))}
          </select>
          <span className="text-sm text-muted">o</span>
          <Button variant="ghost" onClick={agregarVacio}>
            Crear uno manual
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted">
          Elige uno de la lista y se agrega abajo; luego ajusta las horas a tu
          uso real.
        </p>
      </Card>

      {state.electrodomesticos.length === 0 ? (
        <p className="text-sm text-muted">
          Aún no agregaste electrodomésticos. Empieza por la nevera y el aire o
          los ventiladores.
        </p>
      ) : (
        <div className="space-y-3">
          {state.electrodomesticos.map((e) => (
            <ApplianceRow
              key={e.id}
              e={e}
              showPrioridad={showPrioridad}
              onChange={(patch) => updateElectrodomestico(e.id, patch)}
              onRemove={() => removeElectrodomestico(e.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ApplianceRow({
  e,
  showPrioridad,
  onChange,
  onRemove,
}: {
  e: Electrodomestico;
  showPrioridad: boolean;
  onChange: (patch: Partial<Electrodomestico>) => void;
  onRemove: () => void;
}) {
  const kwh = kwhMes(e);
  return (
    <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <input
          className="w-full rounded-md border border-transparent bg-transparent px-1 py-1 text-sm font-semibold outline-none focus:border-border focus:bg-white"
          value={e.nombre}
          onChange={(ev) => onChange({ nombre: ev.target.value })}
        />
        <button
          onClick={onRemove}
          className="shrink-0 text-xs font-semibold text-red-600 hover:underline"
        >
          Quitar
        </button>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MiniField
          label="Potencia (W)"
          value={e.potenciaW}
          step={10}
          onChange={(v) => onChange({ potenciaW: v })}
        />
        <MiniField
          label="Horas/día"
          value={e.horasDia}
          step={0.5}
          onChange={(v) => onChange({ horasDia: v })}
        />
        <MiniField
          label="Días/mes"
          value={e.diasMes}
          step={1}
          onChange={(v) => onChange({ diasMes: v })}
        />
        <label className="block">
          <span className="text-xs font-medium text-muted">Categoría</span>
          <select
            className="mt-1 w-full rounded-md border border-border bg-white px-2 py-1.5 text-sm"
            value={e.categoria}
            onChange={(ev) => onChange({ categoria: ev.target.value as Categoria })}
          >
            {CATEGORIAS.map((c) => (
              <option key={c} value={c}>
                {CATEGORIA_LABEL[c]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="h-4 w-4"
            checked={e.esencial}
            onChange={(ev) => onChange({ esencial: ev.target.checked })}
          />
          Uso esencial (no se recorta en el plan)
        </label>
        {showPrioridad && !e.esencial && (
          <label className="flex min-w-0 items-center gap-2 text-sm">
            Prioridad
            <select
              className="min-w-0 max-w-full rounded-md border border-border bg-white px-2 py-1.5 text-sm"
              value={e.prioridad}
              onChange={(ev) => onChange({ prioridad: Number(ev.target.value) })}
            >
              <option value={1}>1 · recortar primero</option>
              <option value={2}>2</option>
              <option value={3}>3 · normal</option>
              <option value={4}>4</option>
              <option value={5}>5 · casi intocable</option>
            </select>
          </label>
        )}
        <span className="ml-auto text-sm font-semibold text-accent">
          {formatKwh(kwh)}/mes
          <span className="ml-1 font-normal text-muted">
            ({formatNumber((e.potenciaW / 1000) * e.horasDia, 2)} kWh/día)
          </span>
        </span>
      </div>
    </div>
  );
}

function MiniField({
  label,
  value,
  step,
  onChange,
}: {
  label: string;
  value: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-muted">{label}</span>
      <input
        type="number"
        inputMode="decimal"
        min={0}
        step={step}
        className="mt-1 w-full rounded-md border border-border bg-white px-2 py-2 text-sm outline-none focus:border-primary"
        value={Number.isFinite(value) ? value : ""}
        onChange={(ev) => onChange(ev.target.value === "" ? 0 : Number(ev.target.value))}
      />
    </label>
  );
}
