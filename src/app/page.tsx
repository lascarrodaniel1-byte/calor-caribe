"use client";

import Link from "next/link";
import { useAppState } from "@/lib/store";
import { getMunicipio, consumoSubsistencia } from "@/lib/municipios";
import { calcularConsumo, factorCalor } from "@/lib/energia";
import { planificar, diasEnMes } from "@/lib/plan";
import { sensacionMaxSemana } from "@/lib/heat";
import { useClima } from "@/lib/useClima";
import { formatCOP, formatKwh } from "@/lib/format";
import HeatPanel from "@/components/HeatPanel";
import MunicipioPicker from "@/components/MunicipioPicker";
import ComorbilidadForm from "@/components/ComorbilidadForm";
import { Card, LinkButton, Stat, Bar } from "@/components/ui";

export default function Home() {
  const { state, ready, update, setPerfil } = useAppState();
  const municipio = getMunicipio(state.municipioSlug);

  const { clima } = useClima({
    modo: state.modoClima,
    municipioSlug: state.municipioSlug,
    ubicacion: state.ubicacion,
  });
  const sensacionProm =
    clima && clima.hourly.length ? sensacionMaxSemana(clima.hourly) : 0;
  const factor =
    state.ajustarPorCalor && sensacionProm ? factorCalor(sensacionProm) : 1;

  const tieneEquipos = state.electrodomesticos.length > 0;
  const sub = municipio ? consumoSubsistencia(municipio.altitud) : 173;
  const energia = tieneEquipos
    ? calcularConsumo(
        state.electrodomesticos,
        state.precioKwh,
        state.estrato,
        sub,
        factor,
      )
    : null;

  const hoy = new Date();
  const plan = tieneEquipos
    ? planificar({
        electrodomesticos: state.electrodomesticos,
        metaKwh: state.metaKwh,
        consumoRegistrado: state.consumoRegistrado,
        diaActual: hoy.getDate(),
        diasEnMes: diasEnMes(hoy),
        factorClima: factor,
      })
    : null;

  if (!ready) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 text-sm text-muted">Cargando…</div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-bold text-primary">
        Calor Caribe: sensación térmica y consumo de luz
      </h1>
      <p className="mt-1 text-sm text-muted">
        Monitorea el calor durante El Niño en tu municipio, recibe alertas según
        tu salud y controla la factura de energía.
      </p>

      {!municipio && (
        <Card className="mt-6 border-primary/30 bg-primary/5">
          <h2 className="font-semibold text-primary">Configuración rápida (30 segundos)</h2>
          <p className="mt-1 text-sm text-muted">
            Todo se guarda solo en este dispositivo.
          </p>
          <div className="mt-4 space-y-4">
            <MunicipioPicker
              value={state.municipioSlug}
              onChange={(slug) => update({ municipioSlug: slug, onboarded: true })}
            />
            <div>
              <p className="mb-2 text-sm font-medium">¿Comorbilidades en el hogar?</p>
              <ComorbilidadForm perfil={state.perfil} onChange={setPerfil} />
            </div>
          </div>
        </Card>
      )}

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold text-primary">Calor ahora</h2>
        <HeatPanel />
      </section>

      <section className="mt-8 grid gap-4 sm:grid-cols-2">
        <Card>
          <h2 className="font-semibold text-primary">Factura de luz</h2>
          {energia ? (
            <div className="mt-3 space-y-3">
              <Stat
                label="Consumo estimado"
                value={formatKwh(energia.kwhTotal, 0)}
                sub={`${state.electrodomesticos.length} electrodomésticos`}
              />
              <Stat
                label="Costo estimado del mes"
                value={formatCOP(energia.costoEstimadoTotal)}
                accent
              />
              <LinkButton href="/energia" variant="ghost">
                Ver detalle
              </LinkButton>
            </div>
          ) : (
            <div className="mt-3 space-y-3">
              <p className="text-sm text-muted">
                Agrega tus electrodomésticos y el precio del kWh de tu factura
                del mes para estimar el recibo.
              </p>
              <LinkButton href="/energia">Empezar</LinkButton>
            </div>
          )}
        </Card>

        <Card>
          <h2 className="font-semibold text-primary">Plan para no pasar la meta</h2>
          {plan ? (
            <div className="mt-3 space-y-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted">
                  Proyección fin de mes vs. meta ({formatKwh(state.metaKwh, 0)})
                </p>
                <p className="mt-1 text-2xl font-bold">
                  {formatKwh(plan.proyeccionFinMes, 0)}
                </p>
                <div className="mt-2">
                  <Bar
                    value={plan.proyeccionFinMes}
                    max={Math.max(state.metaKwh, plan.proyeccionFinMes)}
                    color={plan.margen >= 0 ? "#059669" : "#dc2626"}
                  />
                </div>
                <p className="mt-1 text-sm">
                  {plan.margen >= 0
                    ? `Margen: ${formatKwh(plan.margen, 0)}`
                    : `Te pasarías por ${formatKwh(-plan.margen, 0)}`}
                </p>
              </div>
              <LinkButton href="/plan" variant="ghost">
                Ver plan de horas
              </LinkButton>
            </div>
          ) : (
            <div className="mt-3 space-y-3">
              <p className="text-sm text-muted">
                Con tus electrodomésticos, calculamos cuántas horas puede usarse
                cada uno para no superar la meta de Air-e y evitar el sobrecosto.
              </p>
              <LinkButton href="/plan">Empezar</LinkButton>
            </div>
          )}
        </Card>
      </section>

      <p className="mt-8 text-xs text-muted">
        <Link href="/ajustes" className="underline">
          Ajustes y privacidad
        </Link>{" "}
        · Esta herramienta da estimaciones y orientación general; no reemplaza la
        atención médica ni la factura oficial.
      </p>
    </div>
  );
}
