"use client";

import { useEffect, useState } from "react";
import { useAppState } from "@/lib/store";
import { TERMINOS_VERSION } from "@/lib/terminos";

interface PromptDeInstalacion extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const OCULTO_KEY = "calor-instalar-oculto";

/** Invita a instalar la PWA: botón directo en Android/Chrome, instrucción en iOS. */
export default function InstallPrompt() {
  const { state } = useAppState();
  const [evento, setEvento] = useState<PromptDeInstalacion | null>(null);
  const [instalada, setInstalada] = useState(true);
  const [esIOS, setEsIOS] = useState(false);
  const [oculto, setOculto] = useState(true);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true;
    setInstalada(standalone);

    const ua = navigator.userAgent;
    setEsIOS(
      /iphone|ipad|ipod/i.test(ua) &&
        !(window as unknown as { MSStream?: unknown }).MSStream,
    );

    try {
      setOculto(localStorage.getItem(OCULTO_KEY) === "1");
    } catch {
      setOculto(false);
    }

    const onBip = (e: Event) => {
      e.preventDefault();
      setEvento(e as PromptDeInstalacion);
    };
    const onInstalled = () => setInstalada(true);
    window.addEventListener("beforeinstallprompt", onBip);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBip);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const aceptoTerminos = state.terminosAceptadosVersion === TERMINOS_VERSION;
  if (!aceptoTerminos || instalada || oculto) return null;
  // En escritorio sin soporte de instalación no mostramos nada.
  if (!evento && !esIOS) return null;

  function cerrar() {
    setOculto(true);
    try {
      localStorage.setItem(OCULTO_KEY, "1");
    } catch {
      /* ignore */
    }
  }

  async function instalar() {
    if (!evento) return;
    await evento.prompt();
    await evento.userChoice;
    setEvento(null);
  }

  return (
    <div className="safe-x border-b border-accent/30 bg-accent/10">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2 text-sm sm:px-6">
        {evento ? (
          <>
            <span className="flex-1">
              Instala Calor Caribe para abrirla como app y recibir avisos de
              calor.
            </span>
            <button
              onClick={instalar}
              className="shrink-0 rounded-md bg-primary px-3 py-1.5 font-semibold text-white"
            >
              Instalar
            </button>
          </>
        ) : (
          <span className="flex-1">
            Para instalarla: toca{" "}
            <span aria-hidden>⬆️</span> <strong>Compartir</strong> y luego{" "}
            <strong>“Agregar a pantalla de inicio”</strong>.
          </span>
        )}
        <button
          onClick={cerrar}
          aria-label="Ocultar"
          className="shrink-0 px-2 py-1 text-lg leading-none text-muted"
        >
          ×
        </button>
      </div>
    </div>
  );
}
