import { NextRequest } from "next/server";
import { respuestaDesdeCoords } from "@/lib/clima";

export const dynamic = "force-dynamic";

/**
 * Clima por coordenadas GPS. Van en el cuerpo (no en la URL) para no dejar la
 * ubicación en los registros del servidor, y se redondean a ~1 km.
 */
export async function POST(request: NextRequest) {
  let lat: unknown;
  let lon: unknown;
  try {
    const body = await request.json();
    lat = body.lat;
    lon = body.lon;
  } catch {
    return Response.json({ error: "JSON inválido." }, { status: 400 });
  }
  if (typeof lat !== "number" || typeof lon !== "number") {
    return Response.json(
      { error: "lat y lon deben ser números." },
      { status: 400 },
    );
  }
  return respuestaDesdeCoords(lat, lon);
}
