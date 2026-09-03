import { municipioMasCercano, type Municipio } from "./municipios";

export interface PuntoClima {
  time: string;
  tempC: number;
  rh: number;
  apparentC: number;
}

export interface RespuestaClima {
  municipio: {
    slug: string;
    nombre: string;
    departamento: string;
    operador: string;
    altitud: number;
  };
  /** true si el clima se pidió para coordenadas GPS (aproximadas a ~1 km). */
  preciso: boolean;
  distanciaKm?: number;
  actualizado: string;
  actual: PuntoClima;
  hourly: PuntoClima[];
  fuente: string;
}

interface OpenMeteoResponse {
  current: {
    time: string;
    temperature_2m: number;
    relative_humidity_2m: number;
    apparent_temperature: number;
  };
  hourly?: {
    time: string[];
    temperature_2m: number[];
    relative_humidity_2m: number[];
    apparent_temperature: number[];
  };
}

/** Redondea a ~1,1 km. Open-Meteo trabaja en grilla de 1–11 km. */
export function redondearCoord(v: number): number {
  return Math.round(v * 100) / 100;
}

export function respuestaDesdeCoords(lat: number, lon: number) {
  const rlat = redondearCoord(lat);
  const rlon = redondearCoord(lon);
  const { municipio, distanciaKm } = municipioMasCercano(rlat, rlon);
  return responderClima(
    rlat,
    rlon,
    municipio,
    true,
    Math.round(distanciaKm * 10) / 10,
  );
}

export async function responderClima(
  lat: number,
  lon: number,
  ref: Municipio,
  preciso: boolean,
  distanciaKm?: number,
): Promise<Response> {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(lat));
  url.searchParams.set("longitude", String(lon));
  url.searchParams.set(
    "current",
    "temperature_2m,relative_humidity_2m,apparent_temperature",
  );
  url.searchParams.set(
    "hourly",
    "temperature_2m,relative_humidity_2m,apparent_temperature",
  );
  url.searchParams.set("timezone", "America/Bogota");
  url.searchParams.set("forecast_days", "7");

  let data: OpenMeteoResponse;
  try {
    const res = await fetch(url, { next: { revalidate: 600 } });
    if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);
    data = (await res.json()) as OpenMeteoResponse;
  } catch (err) {
    return Response.json(
      {
        error: "No se pudo consultar el pronóstico del clima.",
        detalle: err instanceof Error ? err.message : String(err),
      },
      { status: 502 },
    );
  }

  const hourly: PuntoClima[] = (data.hourly?.time ?? []).map((time, i) => ({
    time,
    tempC: data.hourly!.temperature_2m[i],
    rh: data.hourly!.relative_humidity_2m[i],
    apparentC: data.hourly!.apparent_temperature[i],
  }));

  const payload: RespuestaClima = {
    municipio: {
      slug: ref.slug,
      nombre: ref.nombre,
      departamento: ref.departamento,
      operador: ref.operador,
      altitud: ref.altitud,
    },
    preciso,
    distanciaKm,
    actualizado: new Date().toISOString(),
    actual: {
      time: data.current.time,
      tempC: data.current.temperature_2m,
      rh: data.current.relative_humidity_2m,
      apparentC: data.current.apparent_temperature,
    },
    hourly,
    fuente: "Open-Meteo (api.open-meteo.com)",
  };

  return Response.json(payload);
}
