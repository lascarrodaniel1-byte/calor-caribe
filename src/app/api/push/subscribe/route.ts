import { NextRequest } from "next/server";
import { eliminarSub, guardarSub } from "@/lib/push";

export const dynamic = "force-dynamic";

interface Body {
  subscription?: {
    endpoint: string;
    keys: { p256dh: string; auth: string };
  };
  endpoint?: string;
  municipioSlug?: string | null;
  lat?: number | null;
  lon?: number | null;
  ajuste?: number;
}

export async function POST(request: NextRequest) {
  let body: Body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "JSON inválido" }, { status: 400 });
  }

  const sub = body.subscription;
  if (!sub?.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) {
    return Response.json({ error: "Suscripción incompleta" }, { status: 400 });
  }

  const tieneMunicipio = typeof body.municipioSlug === "string" && body.municipioSlug;
  const tieneCoords =
    typeof body.lat === "number" && typeof body.lon === "number";
  if (!tieneMunicipio && !tieneCoords) {
    return Response.json(
      { error: "Falta municipio o coordenadas" },
      { status: 400 },
    );
  }

  const ok = await guardarSub({
    endpoint: sub.endpoint,
    sub,
    municipioSlug: tieneMunicipio ? body.municipioSlug! : undefined,
    // se redondea a ~1 km para no guardar la ubicación exacta en el servidor
    lat: tieneCoords ? Math.round(body.lat! * 100) / 100 : undefined,
    lon: tieneCoords ? Math.round(body.lon! * 100) / 100 : undefined,
    ajuste: clampAjuste(body.ajuste),
  });

  if (!ok) {
    return Response.json(
      {
        error:
          "El servidor no puede guardar la suscripción en este entorno (almacenamiento de solo lectura).",
      },
      { status: 503 },
    );
  }

  return Response.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  let endpoint: string | undefined;
  try {
    const body = (await request.json()) as Body;
    endpoint = body.endpoint ?? body.subscription?.endpoint;
  } catch {
    /* ignore */
  }
  if (!endpoint) {
    return Response.json({ error: "Falta endpoint" }, { status: 400 });
  }
  await eliminarSub(endpoint);
  return Response.json({ ok: true });
}

function clampAjuste(v: unknown): number {
  const n = typeof v === "number" ? v : 0;
  return Math.max(0, Math.min(7, Math.round(n)));
}
