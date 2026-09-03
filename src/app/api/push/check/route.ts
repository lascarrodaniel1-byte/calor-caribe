import { NextRequest } from "next/server";
import { bandaPara, heatIndexC } from "@/lib/heat";
import {
  enviarPush,
  listarSubs,
  marcarClave,
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

const NIVELES_PELIGROSOS = new Set([
  "precaucion-extrema",
  "peligro",
  "peligro-extremo",
]);

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

      const hi =
        heatIndexC(clima.actual.tempC, clima.actual.rh) + (reg.ajuste || 0);
      const banda = bandaPara(hi);
      const clave = `${banda.nivel}-${new Date().toDateString()}`;

      if (!NIVELES_PELIGROSOS.has(banda.nivel) || reg.ultimaClave === clave) {
        sinCambio++;
        return;
      }

      const res = await enviarPush(reg, {
        title: `Alerta de calor: ${banda.etiqueta}`,
        body: `Sensación térmica ${Math.round(hi)} °C en ${
          clima.municipio?.nombre ?? "tu zona"
        }. ${banda.resumen} Hidrátate y evita el sol.`,
        tag: "clima-push",
        url: "/calor",
      });

      if (res === "ok") {
        enviadas++;
        await marcarClave(reg.endpoint, clave);
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
