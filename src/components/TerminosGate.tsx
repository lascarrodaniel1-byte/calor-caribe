"use client";

import { useEffect, useState } from "react";
import { useAppState } from "@/lib/store";
import { TERMINOS_VERSION } from "@/lib/terminos";
import TextoTerminos from "./TextoTerminos";
import { Button } from "./ui";

export default function TerminosGate() {
  const { state, ready, update } = useAppState();
  const [acepto, setAcepto] = useState(false);

  const pendiente =
    ready && state.terminosAceptadosVersion !== TERMINOS_VERSION;
  const esActualizacion =
    pendiente && state.terminosAceptadosVersion != null;

  useEffect(() => {
    if (!pendiente) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [pendiente]);

  if (!pendiente) return null;

  return (
    <div className="safe-top safe-bottom safe-x fixed inset-0 z-50 flex flex-col bg-slate-900/60 p-3 sm:p-6">
      <div className="mx-auto flex min-h-0 w-full max-w-2xl flex-1 flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-xl">
        <div className="border-b border-border px-5 py-4">
          <h1 className="text-lg font-bold text-primary">
            {esActualizacion
              ? "Actualizamos los términos"
              : "Antes de empezar"}
          </h1>
          <p className="mt-0.5 text-xs text-muted">
            {esActualizacion
              ? "Revisa y acepta los términos y el aviso de privacidad actualizados para seguir usando la app."
              : "Lee y acepta los términos de uso y el aviso de privacidad."}
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <TextoTerminos />
        </div>

        <div className="border-t border-border bg-slate-50 px-5 py-4">
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4"
              checked={acepto}
              onChange={(e) => setAcepto(e.target.checked)}
            />
            <span>
              He leído y acepto los términos de uso y el aviso de privacidad.
            </span>
          </label>
          <div className="mt-3">
            <Button
              disabled={!acepto}
              onClick={() =>
                update({
                  terminosAceptadosVersion: TERMINOS_VERSION,
                  terminosAceptadosEn: Date.now(),
                })
              }
            >
              Aceptar y entrar
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
