import { clasificarONI, EstadoENOS } from "@/lib/heat";

export const revalidate = 86400; // 1 día

/**
 * Estado del ENOS (El Niño / La Niña) a partir del Oceanic Niño Index (ONI)
 * publicado por el Climate Prediction Center de la NOAA.
 * Fuente: https://www.cpc.ncep.noaa.gov/data/indices/oni.ascii.txt
 * Columnas: SEAS  YR  TOTAL  ANOM   (ANOM = ONI del trimestre)
 */

const FALLBACK: EstadoENOS = {
  fase: "El Niño",
  intensidad: "fuerte",
  oni: 1.8,
  trimestre: "JJA (jun–ago)",
  fuente: "NOAA CPC (valor de referencia; no se pudo actualizar en vivo)",
  actualizado: new Date().toISOString(),
};

const SEAS: Record<string, string> = {
  DJF: "DJF (dic–feb)",
  JFM: "JFM (ene–mar)",
  FMA: "FMA (feb–abr)",
  MAM: "MAM (mar–may)",
  AMJ: "AMJ (abr–jun)",
  MJJ: "MJJ (may–jul)",
  JJA: "JJA (jun–ago)",
  JAS: "JAS (jul–sep)",
  ASO: "ASO (ago–oct)",
  SON: "SON (sep–nov)",
  OND: "OND (oct–dic)",
  NDJ: "NDJ (nov–ene)",
};

export async function GET() {
  try {
    const res = await fetch(
      "https://www.cpc.ncep.noaa.gov/data/indices/oni.ascii.txt",
      { next: { revalidate: 86400 } },
    );
    if (!res.ok) throw new Error(`CPC ${res.status}`);
    const text = await res.text();

    const rows = text
      .trim()
      .split("\n")
      .map((l) => l.trim().split(/\s+/))
      .filter((c) => c.length === 4 && /^-?\d/.test(c[3]));

    const last = rows[rows.length - 1];
    if (!last) throw new Error("Sin datos");

    const oni = Number(last[3]);
    const { fase, intensidad } = clasificarONI(oni);

    const estado: EstadoENOS = {
      fase,
      intensidad,
      oni,
      trimestre: `${SEAS[last[0]] ?? last[0]} ${last[1]}`,
      fuente: "NOAA Climate Prediction Center (ONI)",
      actualizado: new Date().toISOString(),
    };
    return Response.json(estado);
  } catch {
    return Response.json(FALLBACK);
  }
}
