"use client";

import { useState } from "react";
import Link from "next/link";
import { useAppState } from "@/lib/store";
import { getMunicipio, consumoSubsistencia } from "@/lib/municipios";
import { planificar, diasEnMes } from "@/lib/plan";
import { formatHoras, formatKwh, formatNumber } from "@/lib/format";
import ApplianceManager from "@/components/ApplianceManager";
import { Card, NumberField, SectionTitle, Stat } from "@/components/ui";

export default function PlanPage() {
  const { state, ready, update } = useAppState();
  const municipio = getMunicipio(state.municipioSlug);
  const totalDias = diasEnMes(new Date());
  const [diaActual, setDiaActual] = useState(new Date().getDate());

  const subsistencia = municipio ? consumoSubsistencia(municipio.altitud) : 173;

  const resultado = planificar({
    electrodomesticos: state.electrodomesticos,
    metaKwh: state.metaKwh,
    consumoRegistrado: state.consumoRegistrado,
    diaActual,
    diasEnMes: totalDias,
  });

  if (!ready) {
    return <div className="mx-auto max-w-3xl px-4 py-10 text-sm text-muted">Cargando…</div>;
  }

  const hayEquipos = state.electrodomesticos.length > 0;

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-bold text-primary">Plan de consumo</h1>
      <p className="mt-1 text-sm text-muted">
        Reparte las horas de uso de cada electrodoméstico para terminar el mes
        sin superar la meta y evitar el sobrecosto en la factura.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <NumberField
          label="Meta de consumo del mes"
          value={state.metaKwh}
          onChange={(v) => update({ metaKwh: v })}
          min={0}
          step={1}
          suffix="kWh"
          hint={`Por defecto: consumo de subsistencia (${subsistencia} kWh). Ajústala si tu operador te fijó otro tope.`}
        />
        <NumberField
          label="Consumo ya registrado este mes"
          value={state.consumoRegistrado}
          onChange={(v) => update({ consumoRegistrado: v })}
          min={0}
          step={1}
          suffix="kWh"
          hint="Lectura del medidor o factura parcial. Deja 0 si no la tienes; se estima con los días transcurridos."
        />
        <NumberField
          label="Día del mes"
          value={diaActual}
          onChange={(v) => setDiaActual(Math.min(totalDias, Math.max(1, v)))}
          min={1}
          max={totalDias}
          step={1}
          suffix={`de ${totalDias}`}
        />
      </div>

      <section className="mt-8">
        <SectionTitle hint="Marca como “esencial” lo que no se puede recortar (nevera, bomba de agua). Al resto asígnale prioridad.">
          Electrodomésticos
        </SectionTitle>
        <ApplianceManager showPrioridad />
      </section>

      {!hayEquipos ? (
        <p className="mt-6 text-sm text-muted">
          Agrega tus electrodomésticos arriba para generar el plan. Si ya los
          cargaste en{" "}
          <Link href="/energia" className="underline">
            Factura de luz
          </Link>
          , aparecen aquí automáticamente.
        </p>
      ) : (
        <section className="mt-8 space-y-4">
          <SectionTitle>Tu plan para los {resultado.diasRestantes} días que faltan</SectionTitle>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat
              label="Presupuesto restante"
              value={formatKwh(Math.max(0, resultado.presupuestoRestante), 0)}
              sub={`meta ${formatNumber(state.metaKwh, 0)} − ${formatNumber(
                resultado.consumoBase,
                0,
              )} ${resultado.consumoEstimado ? "(estim.)" : "(medidor)"}`}
            />
            <Stat
              label="Techo diario"
              value={formatKwh(resultado.techoDiario, 1)}
              sub="promedio para no pasarte"
            />
            <Stat
              label="Proyección fin de mes"
              value={formatKwh(resultado.proyeccionFinMes, 0)}
            />
            <Stat
              label="Margen vs. meta"
              value={formatKwh(resultado.margen, 0)}
              accent={resultado.margen < 0}
            />
          </div>

          {resultado.mensajes.map((m, i) => (
            <Card
              key={i}
              className={
                resultado.factible
                  ? "border-l-4 border-emerald-400 bg-emerald-50 text-sm text-emerald-900"
                  : "border-l-4 border-red-400 bg-red-50 text-sm text-red-900"
              }
            >
              {m}
            </Card>
          ))}

          <Card>
            <h3 className="mb-3 font-semibold text-primary">Horas de uso por equipo</h3>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase text-muted">
                    <th className="py-2 pr-3">Electrodoméstico</th>
                    <th className="py-2 pr-3">Tipo</th>
                    <th className="py-2 pr-3">Deseado</th>
                    <th className="py-2 pr-3">Permitido</th>
                    <th className="py-2 pr-3">kWh restante del mes</th>
                  </tr>
                </thead>
                <tbody>
                  {resultado.lineas.map((l) => (
                    <tr key={l.electrodomestico.id} className="border-b border-border/60">
                      <td className="py-2 pr-3 font-medium">{l.electrodomestico.nombre}</td>
                      <td className="py-2 pr-3">
                        {l.esencial ? (
                          <span className="rounded bg-slate-200 px-1.5 py-0.5 text-xs">
                            esencial
                          </span>
                        ) : (
                          <span className="text-xs text-muted">
                            prioridad {l.electrodomestico.prioridad}
                          </span>
                        )}
                      </td>
                      <td className="py-2 pr-3">{formatHoras(l.horasDiaDeseadas)}/día</td>
                      <td className="py-2 pr-3 font-semibold">
                        {l.esencial ? (
                          "sin cambio"
                        ) : (
                          <>
                            {formatHoras(l.horasDiaPermitidas)}/día
                            {l.recorte > 0.01 && (
                              <span className="ml-1 text-xs text-red-600">
                                (−{Math.round(l.recorte * 100)}%)
                              </span>
                            )}
                          </>
                        )}
                      </td>
                      <td className="py-2 pr-3">
                        {formatKwh(l.kwhRestanteProyectado)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card>
            <h3 className="mb-2 font-semibold text-primary">Consejos de horario</h3>
            <ul className="list-disc space-y-1.5 pl-5 text-sm text-slate-700">
              {resultado.consejosHorario.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          </Card>

          <p className="text-xs text-muted">
            El reparto es una guía: prioriza los equipos según tu necesidad real.
            El plan supone que mantienes el uso indicado el resto del mes.
          </p>
        </section>
      )}
    </div>
  );
}
