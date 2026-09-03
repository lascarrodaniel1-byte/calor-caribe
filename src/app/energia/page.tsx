"use client";

import { useAppState } from "@/lib/store";
import { getMunicipio, consumoSubsistencia } from "@/lib/municipios";
import { calcularConsumo, CATEGORIA_LABEL, precioKwhReferencia } from "@/lib/energia";
import { formatCOP, formatKwh, formatNumber } from "@/lib/format";
import ApplianceManager from "@/components/ApplianceManager";
import { Card, NumberField, SectionTitle, Stat, Bar } from "@/components/ui";

export default function EnergiaPage() {
  const { state, ready, update } = useAppState();
  const municipio = getMunicipio(state.municipioSlug);
  const subsistencia = municipio ? consumoSubsistencia(municipio.altitud) : 173;

  const resumen = calcularConsumo(
    state.electrodomesticos,
    state.precioKwh,
    state.estrato,
    subsistencia,
  );

  const porCategoria = (() => {
    const m = new Map<string, number>();
    for (const l of resumen.lineas) {
      m.set(
        l.electrodomestico.categoria,
        (m.get(l.electrodomestico.categoria) ?? 0) + l.kwh,
      );
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  })();

  if (!ready) {
    return <div className="mx-auto max-w-3xl px-4 py-10 text-sm text-muted">Cargando…</div>;
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-bold text-primary">Factura de luz</h1>
      <p className="mt-1 text-sm text-muted">
        Estima el recibo del mes según el precio del kWh de tu factura y los
        electrodomésticos que uses.
        {municipio && ` Operador en ${municipio.nombre}: ${municipio.operador}.`}
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <NumberField
          label="Precio del kWh este mes"
          value={state.precioKwh}
          onChange={(v) => update({ precioKwh: v })}
          min={0}
          step={10}
          suffix="COP/kWh"
          hint={`Búscalo en tu factura (costo unitario). Referencia: ${formatCOP(
            precioKwhReferencia(),
          )}.`}
        />
        <label className="block">
          <span className="text-sm font-medium text-foreground">Estrato</span>
          <select
            className="mt-1 w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
            value={state.estrato}
            onChange={(e) => update({ estrato: Number(e.target.value) })}
          >
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <option key={n} value={n}>
                Estrato {n}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-xs text-muted">
            Estratos 1–3 reciben subsidio hasta {subsistencia} kWh; 5–6 pagan
            contribución.
          </span>
        </label>
        <Stat
          label="Consumo de subsistencia"
          value={formatKwh(subsistencia, 0)}
          sub={municipio ? `${municipio.nombre}, <1000 m` : "costa Caribe"}
        />
      </div>

      <section className="mt-8">
        <SectionTitle hint="Ajusta potencia, horas y días según tu uso real.">
          Electrodomésticos
        </SectionTitle>
        <ApplianceManager showPrioridad={false} />
      </section>

      {state.electrodomesticos.length > 0 && (
        <section className="mt-8 space-y-4">
          <SectionTitle>Resultado</SectionTitle>

          <div className="grid gap-3 sm:grid-cols-3">
            <Stat label="Consumo total" value={formatKwh(resumen.kwhTotal, 0)} />
            <Stat
              label="Costo de la energía"
              value={formatCOP(resumen.costoEnergia)}
              sub={`${formatNumber(resumen.kwhTotal, 0)} kWh × ${formatCOP(
                state.precioKwh,
              )}`}
            />
            <Stat
              label="Costo estimado del recibo"
              value={formatCOP(resumen.costoEstimadoTotal)}
              accent
              sub={
                resumen.ajusteEstrato < 0
                  ? `incluye subsidio ${formatCOP(resumen.ajusteEstrato)}`
                  : resumen.ajusteEstrato > 0
                    ? `incluye contribución +${formatCOP(resumen.ajusteEstrato)}`
                    : "sin subsidio ni contribución"
              }
            />
          </div>

          <Card
            className={
              resumen.kwhSobreSubsistencia > 0
                ? "border-l-4 border-red-400 bg-red-50"
                : "border-l-4 border-emerald-400 bg-emerald-50"
            }
          >
            {resumen.kwhSobreSubsistencia > 0 ? (
              <>
                <p className="text-sm font-semibold text-red-800">
                  Te pasas del consumo de subsistencia por{" "}
                  {formatKwh(resumen.kwhSobreSubsistencia, 0)}.
                </p>
                <p className="mt-1 text-sm text-red-900/90">
                  {[1, 2, 3].includes(state.estrato)
                    ? `Ese excedente se cobra sin subsidio: aproximadamente ${formatCOP(
                        resumen.sobrecostoUmbral,
                      )} más en el recibo respecto a mantenerte en el tope. Usa el Plan de consumo para repartir tus horas.`
                    : "En tu estrato no hay subsidio, pero reducir el excedente igual baja el valor y la contribución."}
                </p>
              </>
            ) : (
              <p className="text-sm font-semibold text-emerald-800">
                Estás dentro del consumo de subsistencia ({formatKwh(subsistencia, 0)}).
                Conservas el subsidio completo si aplica a tu estrato.
              </p>
            )}
            <div className="mt-2">
              <Bar
                value={resumen.kwhTotal}
                max={Math.max(subsistencia, resumen.kwhTotal)}
                color={resumen.kwhSobreSubsistencia > 0 ? "#dc2626" : "#059669"}
              />
              <p className="mt-1 text-xs text-muted">
                {formatKwh(resumen.kwhTotal, 0)} de {formatKwh(subsistencia, 0)}{" "}
                (meta de subsistencia)
              </p>
            </div>
          </Card>

          <Card>
            <h3 className="mb-3 font-semibold text-primary">
              En qué se va la energía
            </h3>
            <div className="space-y-2">
              {resumen.lineas.map((l) => (
                <div key={l.electrodomestico.id} className="text-sm">
                  <div className="flex justify-between">
                    <span>{l.electrodomestico.nombre}</span>
                    <span className="font-medium">
                      {formatKwh(l.kwh)} · {formatCOP(l.costo)}
                    </span>
                  </div>
                  <Bar value={l.kwh} max={resumen.lineas[0].kwh} />
                </div>
              ))}
            </div>
            <div className="mt-4 border-t border-border pt-3 text-sm text-muted">
              Por categoría:{" "}
              {porCategoria
                .map(
                  ([c, k]) =>
                    `${CATEGORIA_LABEL[c as keyof typeof CATEGORIA_LABEL]} ${formatKwh(
                      k,
                      0,
                    )}`,
                )
                .join(" · ")}
            </div>
          </Card>

          <p className="text-xs text-muted">
            Estimación. El recibo real incluye además alumbrado público, aseo (si
            viene en la misma factura) y variaciones diarias de la tarifa. Los
            porcentajes de subsidio/contribución son los máximos de ley.
          </p>
        </section>
      )}
    </div>
  );
}
