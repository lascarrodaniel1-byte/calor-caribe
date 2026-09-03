"use client";

import { useState } from "react";
import Link from "next/link";
import { useAppState } from "@/lib/store";
import { getMunicipio, consumoSubsistencia } from "@/lib/municipios";
import { puntajeVulnerabilidad } from "@/lib/heat";
import MunicipioPicker from "@/components/MunicipioPicker";
import ComorbilidadForm from "@/components/ComorbilidadForm";
import UbicacionControl from "@/components/UbicacionControl";
import { Button, Card, NumberField, SectionTitle } from "@/components/ui";

export default function AjustesPage() {
  const { state, ready, update, setPerfil, reset } = useAppState();
  const [confirmarReset, setConfirmarReset] = useState(false);
  const municipio = getMunicipio(state.municipioSlug);

  if (!ready) {
    return <div className="mx-auto max-w-3xl px-4 py-10 text-sm text-muted">Cargando…</div>;
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-bold text-primary">Ajustes</h1>

      <section className="mt-6 space-y-4">
        <SectionTitle hint="Se usa para consultar el pronóstico del clima de tu zona. Puedes elegir el municipio o usar tu ubicación GPS (redondeada a ~1 km).">
          Ubicación
        </SectionTitle>
        <Card className="space-y-3">
          <MunicipioPicker
            value={state.municipioSlug}
            onChange={(slug) => update({ municipioSlug: slug, onboarded: true })}
          />
          <UbicacionControl />
          {municipio && (
            <p className="mt-2 text-xs text-muted">
              {municipio.nombre}, {municipio.departamento} · operador de energía:{" "}
              {municipio.operador} · consumo de subsistencia{" "}
              {consumoSubsistencia(municipio.altitud)} kWh/mes.
            </p>
          )}
        </Card>
      </section>

      <section className="mt-8 space-y-4">
        <SectionTitle hint={`Puntaje de vulnerabilidad actual: ${puntajeVulnerabilidad(
          state.perfil,
        )}. A mayor puntaje, la app eleva antes el nivel de alerta.`}>
          Salud y comorbilidades
        </SectionTitle>
        <Card>
          <ComorbilidadForm perfil={state.perfil} onChange={setPerfil} />
        </Card>
      </section>

      <section className="mt-8 space-y-4">
        <SectionTitle>Energía</SectionTitle>
        <Card className="space-y-4">
          <NumberField
            label="Precio del kWh este mes"
            value={state.precioKwh}
            onChange={(v) => update({ precioKwh: v })}
            min={0}
            step={10}
            suffix="COP/kWh"
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
          </label>
          <NumberField
            label="Meta de consumo del mes"
            value={state.metaKwh}
            onChange={(v) => update({ metaKwh: v })}
            min={0}
            step={1}
            suffix="kWh"
            hint="Normalmente el consumo de subsistencia (173 kWh en la costa)."
          />
        </Card>
      </section>

      <section className="mt-8 space-y-4">
        <SectionTitle hint="Qué se guarda y qué sale de este dispositivo.">
          Privacidad y datos
        </SectionTitle>

        <Card className="space-y-3 text-sm">
          <div>
            <p className="font-semibold text-primary">Solo en este dispositivo</p>
            <p className="text-muted">
              Comorbilidades, municipio, electrodomésticos, precio del kWh,
              estrato y metas: viven en el <code>localStorage</code> del
              navegador. No hay cuentas ni servidor de datos.
            </p>
          </div>
          <div>
            <p className="font-semibold text-primary">Sale del dispositivo</p>
            <ul className="list-disc pl-5 text-muted">
              <li>
                Para el clima: el nombre de tu municipio, o una coordenada
                redondeada a ~1 km si usas GPS. Va a este servidor y de ahí a
                Open-Meteo. No se registra en la URL.
              </li>
              <li>
                <strong>Solo si activas “Avisos con la app cerrada”</strong> (en
                Calor y alertas): se guarda en el servidor el identificador de
                notificación de este navegador, tu municipio o coordenada ~1 km,
                y —si lo permites— un número 0–7 que resume tu vulnerabilidad.
                Nunca las comorbilidades concretas ni tu identidad.
              </li>
            </ul>
          </div>
          <div>
            <p className="font-semibold text-primary">Nunca sale</p>
            <p className="text-muted">
              El detalle de tus enfermedades, tus electrodomésticos y las cifras
              de tu factura. No se envían en ninguna petición.
            </p>
          </div>
          <p className="border-t border-border pt-3 text-xs text-muted">
            <Link href="/terminos" className="font-semibold text-primary underline">
              Ver términos de uso y aviso de privacidad
            </Link>
            {state.terminosAceptadosEn
              ? ` · aceptados el ${new Date(
                  state.terminosAceptadosEn,
                ).toLocaleDateString("es-CO", { dateStyle: "long" })}.`
              : "."}
          </p>
        </Card>

        <Card>
          {confirmarReset ? (
            <div className="space-y-3">
              <p className="text-sm">
                Esto borra de este dispositivo el municipio, el perfil de salud,
                los electrodomésticos y las metas, y cancela la suscripción de
                avisos (el registro en el servidor se elimina). No se puede
                deshacer.
              </p>
              <div className="flex gap-2">
                <Button
                  variant="danger"
                  onClick={async () => {
                    try {
                      const { desuscribirPush } = await import(
                        "@/lib/pushClient"
                      );
                      await desuscribirPush();
                    } catch {
                      /* ignore */
                    }
                    reset();
                    setConfirmarReset(false);
                  }}
                >
                  Sí, borrar todo
                </Button>
                <Button variant="ghost" onClick={() => setConfirmarReset(false)}>
                  Cancelar
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="danger" onClick={() => setConfirmarReset(true)}>
              Borrar todos mis datos
            </Button>
          )}
        </Card>
      </section>
    </div>
  );
}
