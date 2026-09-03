"use client";

import { useEffect, useRef, useState } from "react";
import { useAppState, type AppState } from "@/lib/store";
import { ajusteComorbilidad, evaluarCalor } from "@/lib/heat";
import { useClima } from "@/lib/useClima";
import {
  desuscribirPush,
  enviarPrueba,
  haySuscripcion,
  pushConfigurado,
  pushNavegadorOk,
  suscribirPush,
  type ParamsPush,
} from "@/lib/pushClient";
import HeatPanel from "@/components/HeatPanel";
import { Button, Card } from "@/components/ui";

export default function CalorPage() {
  const { state, ready, update } = useAppState();

  if (!ready) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 text-sm text-muted">Cargando…</div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-bold text-primary">Calor y alertas</h1>
      <p className="mt-1 text-sm text-muted">
        Sensación térmica (Heat Index de la NWS: combina temperatura y humedad) y
        nivel de riesgo ajustado a las comorbilidades que registraste. Se
        actualiza sola cada 10 minutos mientras la tienes abierta.
      </p>

      <div className="mt-6 space-y-4">
        <AvisosPrimerPlano
          activo={state.alertasActivas}
          onToggle={(v) => update({ alertasActivas: v })}
        />
        <AvisosPush />
      </div>

      <div className="mt-4">
        <HeatPanel full />
      </div>
    </div>
  );
}

function paramsDesdeEstado(s: AppState): ParamsPush {
  const gps = s.modoClima === "gps" && s.ubicacion;
  return {
    municipioSlug: gps ? null : s.municipioSlug,
    lat: gps ? s.ubicacion!.lat : null,
    lon: gps ? s.ubicacion!.lon : null,
    ajuste: s.compartirVulnerabilidad ? ajusteComorbilidad(s.perfil) : 0,
  };
}

function AvisosPrimerPlano({
  activo,
  onToggle,
}: {
  activo: boolean;
  onToggle: (v: boolean) => void;
}) {
  const { state } = useAppState();
  const [permiso, setPermiso] = useState<NotificationPermission | "unsupported">(
    "default",
  );
  const { clima } = useClima({
    modo: state.modoClima,
    municipioSlug: activo ? state.municipioSlug : null,
    ubicacion: activo ? state.ubicacion : null,
  });
  const ultimaBanda = useRef<string>("");

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setPermiso("unsupported");
      return;
    }
    setPermiso(Notification.permission);
  }, []);

  useEffect(() => {
    if (!activo || !clima) return;
    const ev = evaluarCalor(clima.actual.tempC, clima.actual.rh, state.perfil);
    const nivel = ev.bandaPersonal.nivel;
    const peligroso =
      nivel === "precaucion-extrema" ||
      nivel === "peligro" ||
      nivel === "peligro-extremo";
    const clave = `${nivel}-${new Date().toDateString()}`;
    if (
      peligroso &&
      ultimaBanda.current !== clave &&
      "Notification" in window &&
      Notification.permission === "granted"
    ) {
      ultimaBanda.current = clave;
      new Notification(`Alerta de calor: ${ev.bandaPersonal.etiqueta}`, {
        body: `Sensación térmica ${ev.heatIndex.toFixed(0)} °C en ${
          clima.municipio.nombre
        }. ${ev.bandaPersonal.resumen}`,
        icon: "/icon-192.png",
      });
    }
  }, [activo, clima, state.perfil]);

  async function activar() {
    if (!("Notification" in window)) return;
    const p = await Notification.requestPermission();
    setPermiso(p);
    onToggle(p === "granted");
  }

  if (permiso === "unsupported") {
    return (
      <Card className="bg-slate-50">
        <p className="text-sm text-muted">
          Este navegador no permite notificaciones.
        </p>
      </Card>
    );
  }

  return (
    <Card className="bg-slate-50">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">Avisos mientras la app está abierta</p>
          <p className="text-xs text-muted">
            Revisa el clima cada 10 min en esta pestaña y avisa al llegar a
            “Precaución extrema” o más.
          </p>
        </div>
        {activo && permiso === "granted" ? (
          <Button variant="ghost" onClick={() => onToggle(false)}>
            Desactivar
          </Button>
        ) : (
          <Button onClick={activar}>Activar</Button>
        )}
      </div>
    </Card>
  );
}

function AvisosPush() {
  const { state, update } = useAppState();
  const [navegadorOk, setNavegadorOk] = useState(true);
  const [configurado, setConfigurado] = useState(true);
  const [suscrito, setSuscrito] = useState(false);
  const [trabajando, setTrabajando] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    setNavegadorOk(pushNavegadorOk());
    setConfigurado(pushConfigurado());
    haySuscripcion().then(setSuscrito);
  }, []);

  const tieneDestino =
    state.modoClima === "gps" ? !!state.ubicacion : !!state.municipioSlug;

  async function activar() {
    setTrabajando(true);
    setMsg(null);
    try {
      if (Notification.permission !== "granted") {
        const p = await Notification.requestPermission();
        if (p !== "granted") {
          setMsg("Necesitas permitir las notificaciones.");
          setTrabajando(false);
          return;
        }
      }
      await suscribirPush(paramsDesdeEstado(state));
      setSuscrito(true);
      setMsg("Listo: te avisaremos aunque cierres la app.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "No se pudo activar.");
    } finally {
      setTrabajando(false);
    }
  }

  async function desactivar() {
    setTrabajando(true);
    setMsg(null);
    try {
      await desuscribirPush();
      setSuscrito(false);
      setMsg("Avisos con la app cerrada desactivados.");
    } finally {
      setTrabajando(false);
    }
  }

  async function probar() {
    setTrabajando(true);
    setMsg(null);
    try {
      const r = await enviarPrueba();
      setMsg(
        r === "ok"
          ? "Enviada. Debe llegarte una notificación en unos segundos."
          : "El servidor no pudo enviar la prueba.",
      );
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Falló la prueba.");
    } finally {
      setTrabajando(false);
    }
  }

  if (!navegadorOk || !configurado) {
    return (
      <Card className="bg-slate-50">
        <p className="text-sm font-semibold">Avisos con la app cerrada</p>
        <p className="mt-1 text-xs text-muted">
          {!configurado
            ? "Esta instalación no tiene configurado el servidor de Web Push (claves VAPID). Mientras tanto, usa los avisos en primer plano."
            : "Este navegador no admite Web Push (en iPhone/iPad necesitas iOS 16.4+ y la app instalada en la pantalla de inicio). Usa los avisos en primer plano por ahora."}
        </p>
      </Card>
    );
  }

  return (
    <Card className="bg-slate-50">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">
            Avisos con la app cerrada (Web Push)
          </p>
          <p className="text-xs text-muted">
            Un servicio revisa el clima de tu zona cada hora y te envía la alerta
            aunque no tengas la app abierta.
          </p>
        </div>
        {suscrito ? (
          <div className="flex gap-2">
            <Button variant="ghost" onClick={probar} disabled={trabajando}>
              Enviar prueba
            </Button>
            <Button variant="danger" onClick={desactivar} disabled={trabajando}>
              Desactivar
            </Button>
          </div>
        ) : (
          <Button onClick={activar} disabled={trabajando || !tieneDestino}>
            {trabajando ? "Activando…" : "Activar"}
          </Button>
        )}
      </div>

      {!tieneDestino && !suscrito && (
        <p className="mt-2 text-xs text-red-700">
          Primero elige tu municipio o comparte tu ubicación.
        </p>
      )}
      {msg && <p className="mt-2 text-xs text-primary">{msg}</p>}

      <label className="mt-3 flex items-start gap-2 border-t border-border pt-3 text-xs">
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4"
          checked={state.compartirVulnerabilidad}
          onChange={(e) =>
            update({ compartirVulnerabilidad: e.target.checked })
          }
        />
        <span>
          Ajustar las alertas del servidor a mi perfil de salud. Si lo
          desmarcas, el servidor recibe un <strong>0</strong> y las alertas usan
          los umbrales estándar (sin adelantar el aviso por tus comorbilidades).
        </span>
      </label>

      <p className="mt-3 text-xs text-muted">
        En el servidor se guarda solo: el identificador de notificación de este
        navegador, tu municipio (o coordenada redondeada a ~1 km) y{" "}
        {state.compartirVulnerabilidad
          ? "un número de 0 a 7 que resume tu vulnerabilidad"
          : "ningún dato de salud"}
        . Nunca tus enfermedades concretas ni tu identidad. Puedes desactivarlo
        cuando quieras y el registro se borra.
      </p>
    </Card>
  );
}
