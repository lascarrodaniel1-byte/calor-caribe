import { NextRequest } from "next/server";
import {
  bandaPara,
  debeAvisar,
  esNivelPeligroso,
  heatIndexC,
} from "@/lib/heat";
import {
  enviarPush,
  listarSubs,
  marcarAviso,
  type RegistroPush,
} from "@/lib/push";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Revisa el clima de cada dispositivo suscrito y envía un aviso si la sensación
 * térmica (ajustada por vulnerabilidad) llega a un nivel peligroso.
 *
 * Pensado para dispararse desde una tarea programada:
 *   GET /api/push/check?secret=CRON_SECRET
 */

function autorizado(request: NextRequest): boolean {
  const esperado = process.env.CRON_SECRET;
  if (!esperado) return true; // sin secreto configurado: abierto (solo dev)
  const dado =
    request.nextUrl.searchParams.get("secret") ??
    request.headers.get("x-cron-secret");
  return dado === esperado;
}

async function ejecutar(request: NextRequest) {
  if (!autorizado(request)) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  const base =
    process.env.APP_URL?.replace(/\/$/, "") || request.nextUrl.origin;
  const subs = await listarSubs();

  let enviadas = 0;
  let expiradas = 0;
  let errores = 0;
  let sinCambio = 0;

  await Promise.all(
    subs.map(async (reg: RegistroPush) => {
      let clima;
      try {
        const r = reg.municipioSlug
          ? await fetch(
              `${base}/api/clima?municipio=${encodeURIComponent(reg.municipioSlug)}`,
              { cache: "no-store" },
            )
          : await fetch(`${base}/api/clima/gps`, {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ lat: reg.lat, lon: reg.lon }),
              cache: "no-store",
            });
        if (!r.ok) throw new Error(String(r.status));
        clima = await r.json();
      } catch {
        errores++;
        return;
      }

      const hiExacto =
        heatIndexC(clima.actual.tempC, clima.actual.rh) + (reg.ajuste || 0);
      const hi = Math.round(hiExacto);
      const banda = bandaPara(hiExacto);
      const fecha = new Date().toDateString();

      if (!debeAvisar(banda.nivel, hi, fecha, reg.ultimoAviso)) {
        if (!esNivelPeligroso(banda.nivel) && reg.ultimoAviso) {
          await marcarAviso(reg.endpoint, null);
        }
        sinCambio++;
        return;
      }

      const sube =
        reg.ultimoAviso && hi > reg.ultimoAviso.hi
          ? "El calor sigue subiendo — "
          : "";
      const res = await enviarPush(reg, {
        title: `Alerta de calor: ${banda.etiqueta}`,
        body: `${sube}sensación térmica ${hi} °C en ${
          clima.municipio?.nombre ?? "tu zona"
        }. ${banda.resumen} Hidrátate y evita el sol.`,
        tag: "clima-push",
        url: "/calor",
      });

      if (res === "ok") {
        enviadas++;
        await marcarAviso(reg.endpoint, { nivel: banda.nivel, hi, fecha });
      } else if (res === "expirada") {
        expiradas++;
      } else {
        errores++;
      }
    }),
  );

  return Response.json({
    revisadas: subs.length,
    enviadas,
    expiradas,
    errores,
    sinCambio,
    momento: new Date().toISOString(),
  });
}

export async function GET(request: NextRequest) {
  return ejecutar(request);
}

export async function POST(request: NextRequest) {
  return ejecutar(request);
}
