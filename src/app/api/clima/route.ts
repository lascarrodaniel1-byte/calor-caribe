import { NextRequest } from "next/server";
import { getMunicipio } from "@/lib/municipios";
import { responderClima } from "@/lib/clima";

export const revalidate = 600; // 10 min

// Re-exportado para compatibilidad de imports existentes.
export type { PuntoClima, RespuestaClima } from "@/lib/clima";

/** Clima por municipio (nombre no sensible; respuesta cacheable y compartida). */
export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get("municipio");
  const municipio = getMunicipio(slug);
  if (!municipio) {
    return Response.json(
      { error: "Indica ?municipio=<slug> (o usa POST /api/clima/gps)." },
      { status: 400 },
    );
  }
  return responderClima(municipio.lat, municipio.lon, municipio, false);
}
