"use client";

import { useMemo, useState } from "react";
import {
  buscarPresets,
  CATEGORIA_LABEL,
  Categoria,
  Electrodomestico,
  esComunCosta,
  PRESETS,
  PresetElectrodomestico,
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
  const [q, setQ] = useState("");
  const [ultimo, setUltimo] = useState<string | null>(null);

  const resultados = useMemo(() => buscarPresets(q), [q]);

  /** Grupos [título, lista]. Sin búsqueda, "Más comunes en la costa" va primero. */
  const grupos = useMemo(() => {
    const out: [string, PresetElectrodomestico[]][] = [];
    if (!q.trim()) {
      out.push([
        "★ Más comunes en la costa",
        PRESETS.filter((p) => esComunCosta(p.nombre)),
      ]);
    }
    const m = new Map<Categoria, PresetElectrodomestico[]>();
    for (const p of resultados) {
      const lista = m.get(p.categoria) ?? [];
      lista.push(p);
      m.set(p.categoria, lista);
    }
    for (const [cat, lista] of m) out.push([CATEGORIA_LABEL[cat], lista]);
    return out;
  }, [resultados, q]);

  function agregarPreset(p: PresetElectrodomestico) {
    addElectrodomestico({ id: nuevoId(), ...p });
    setUltimo(p.nombre);
  }

  function agregarVacio() {
    const nombre = q.trim() || "Nuevo electrodoméstico";
    addElectrodomestico({
      id: nuevoId(),
      nombre,
      potenciaW: 100,
      horasDia: 1,
      diasMes: 30,
      categoria: "otro",
      esencial: false,
      prioridad: 3,
    });
    setUltimo(nombre);
    setQ("");
  }

  return (
    <div className="space-y-4">
      <Card>
        <p className="text-sm font-medium text-foreground">
          Agregar electrodoméstico
        </p>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Busca: aire, nevera, plancha, ducha…"
          className="mt-2 w-full rounded-md border border-border bg-white px-3 py-2.5 text-sm outline-none focus:border-primary"
        />

        {ultimo && (
          <p className="mt-2 text-xs font-medium text-emerald-700">
            ✓ Agregado: {ultimo}. Ajusta las horas abajo.
          </p>
        )}

        <div className="mt-3 max-h-72 overflow-y-auto rounded-md border border-border">
          {resultados.length === 0 ? (
            <div className="p-3 text-sm text-muted">
              No hay coincidencias para “{q}”.
              <button
                onClick={agregarVacio}
                className="ml-1 font-semibold text-primary underline"
              >
                Crear “{q.trim()}” manualmente
              </button>
            </div>
          ) : (
            grupos.map(([titulo, lista]) => (
              <div key={titulo}>
                <p className="sticky top-0 bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-muted">
                  {titulo}
                </p>
                {lista.map((p) => (
                  <button
                    key={titulo + p.nombre}
                    onClick={() => agregarPreset(p)}
                    className="flex w-full items-center justify-between gap-3 border-t border-border px-3 py-2.5 text-left text-sm hover:bg-slate-50"
                  >
                    <span className="min-w-0">
                      <span className="block truncate">{p.nombre}</span>
                      {p.nota && (
                        <span className="block truncate text-xs text-muted">
                          {p.nota}
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 font-medium text-accent">
                      {p.potenciaW} W
                    </span>
                  </button>
                ))}
              </div>
            ))
          )}
        </div>

        <div className="mt-2 flex items-center justify-between text-xs text-muted">
          <span>
            {resultados.length} de {PRESETS.length} equipos
          </span>
          <Button variant="ghost" onClick={agregarVacio}>
            Crear uno manual
          </Button>
        </div>
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
