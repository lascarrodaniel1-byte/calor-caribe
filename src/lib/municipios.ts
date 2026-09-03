/**
 * Municipios de la región Caribe colombiana con coordenadas aproximadas
 * (suficientes para consultar el pronóstico del clima por punto).
 *
 * `operador` indica la empresa que presta el servicio de energía y, por tanto,
 * de quién depende el cargo/umbral que puede generar sobrecosto en la factura:
 *  - "Air-e": Atlántico, Magdalena y La Guajira.
 *  - "Afinia": Bolívar, Cesar, Córdoba, Sucre (Grupo EPM).
 *  - "Sopesa": Archipiélago de San Andrés, Providencia y Santa Catalina.
 *
 * Toda la costa Caribe continental está por debajo de 1.000 m s. n. m., por lo
 * que el "consumo de subsistencia" (consumo básico subsidiable) es de 173 kWh/mes.
 */

export type Operador = "Air-e" | "Afinia" | "Sopesa";

export interface Municipio {
  slug: string;
  nombre: string;
  departamento: string;
  lat: number;
  lon: number;
  operador: Operador;
  /** metros sobre el nivel del mar (aprox.) */
  altitud: number;
}

export const MUNICIPIOS: Municipio[] = [
  // --- Atlántico (Air-e) ---
  { slug: "barranquilla", nombre: "Barranquilla", departamento: "Atlántico", lat: 10.9685, lon: -74.7813, operador: "Air-e", altitud: 18 },
  { slug: "soledad", nombre: "Soledad", departamento: "Atlántico", lat: 10.9172, lon: -74.7646, operador: "Air-e", altitud: 6 },
  { slug: "malambo", nombre: "Malambo", departamento: "Atlántico", lat: 10.8592, lon: -74.7739, operador: "Air-e", altitud: 10 },
  { slug: "sabanalarga-atl", nombre: "Sabanalarga", departamento: "Atlántico", lat: 10.6303, lon: -74.9214, operador: "Air-e", altitud: 100 },
  { slug: "puerto-colombia", nombre: "Puerto Colombia", departamento: "Atlántico", lat: 10.9878, lon: -74.9547, operador: "Air-e", altitud: 5 },
  { slug: "baranoa", nombre: "Baranoa", departamento: "Atlántico", lat: 10.7939, lon: -74.9161, operador: "Air-e", altitud: 100 },
  { slug: "sabanagrande", nombre: "Sabanagrande", departamento: "Atlántico", lat: 10.7911, lon: -74.7553, operador: "Air-e", altitud: 8 },
  { slug: "galapa", nombre: "Galapa", departamento: "Atlántico", lat: 10.8967, lon: -74.8861, operador: "Air-e", altitud: 20 },

  // --- Magdalena (Air-e) ---
  { slug: "santa-marta", nombre: "Santa Marta", departamento: "Magdalena", lat: 11.2404, lon: -74.199, operador: "Air-e", altitud: 6 },
  { slug: "cienaga", nombre: "Ciénaga", departamento: "Magdalena", lat: 11.0069, lon: -74.2467, operador: "Air-e", altitud: 3 },
  { slug: "fundacion", nombre: "Fundación", departamento: "Magdalena", lat: 10.5219, lon: -74.1911, operador: "Air-e", altitud: 40 },
  { slug: "el-banco", nombre: "El Banco", departamento: "Magdalena", lat: 9.0028, lon: -73.9758, operador: "Air-e", altitud: 30 },
  { slug: "plato", nombre: "Plato", departamento: "Magdalena", lat: 9.7936, lon: -74.7847, operador: "Air-e", altitud: 20 },
  { slug: "aracataca", nombre: "Aracataca", departamento: "Magdalena", lat: 10.5917, lon: -74.1897, operador: "Air-e", altitud: 40 },

  // --- La Guajira (Air-e) ---
  { slug: "riohacha", nombre: "Riohacha", departamento: "La Guajira", lat: 11.5444, lon: -72.9072, operador: "Air-e", altitud: 3 },
  { slug: "maicao", nombre: "Maicao", departamento: "La Guajira", lat: 11.3781, lon: -72.2394, operador: "Air-e", altitud: 50 },
  { slug: "uribia", nombre: "Uribia", departamento: "La Guajira", lat: 11.7139, lon: -72.2661, operador: "Air-e", altitud: 10 },
  { slug: "manaure", nombre: "Manaure", departamento: "La Guajira", lat: 11.7756, lon: -72.4436, operador: "Air-e", altitud: 2 },
  { slug: "san-juan-del-cesar", nombre: "San Juan del Cesar", departamento: "La Guajira", lat: 10.7708, lon: -73.0022, operador: "Air-e", altitud: 210 },
  { slug: "fonseca", nombre: "Fonseca", departamento: "La Guajira", lat: 10.8878, lon: -72.8481, operador: "Air-e", altitud: 180 },
  { slug: "villanueva-gja", nombre: "Villanueva", departamento: "La Guajira", lat: 10.6083, lon: -72.9789, operador: "Air-e", altitud: 250 },

  // --- Bolívar (Afinia) ---
  { slug: "cartagena", nombre: "Cartagena de Indias", departamento: "Bolívar", lat: 10.391, lon: -75.4794, operador: "Afinia", altitud: 2 },
  { slug: "magangue", nombre: "Magangué", departamento: "Bolívar", lat: 9.2417, lon: -74.7539, operador: "Afinia", altitud: 20 },
  { slug: "turbaco", nombre: "Turbaco", departamento: "Bolívar", lat: 10.3306, lon: -75.4139, operador: "Afinia", altitud: 200 },
  { slug: "arjona", nombre: "Arjona", departamento: "Bolívar", lat: 10.2564, lon: -75.3469, operador: "Afinia", altitud: 90 },
  { slug: "el-carmen-de-bolivar", nombre: "El Carmen de Bolívar", departamento: "Bolívar", lat: 9.7181, lon: -75.1214, operador: "Afinia", altitud: 180 },

  // --- Cesar (Afinia) ---
  { slug: "valledupar", nombre: "Valledupar", departamento: "Cesar", lat: 10.4631, lon: -73.2532, operador: "Afinia", altitud: 168 },
  { slug: "aguachica", nombre: "Aguachica", departamento: "Cesar", lat: 8.3092, lon: -73.6153, operador: "Afinia", altitud: 200 },
  { slug: "agustin-codazzi", nombre: "Agustín Codazzi", departamento: "Cesar", lat: 10.0369, lon: -73.2372, operador: "Afinia", altitud: 180 },
  { slug: "bosconia", nombre: "Bosconia", departamento: "Cesar", lat: 9.975, lon: -73.8894, operador: "Afinia", altitud: 190 },
  { slug: "la-jagua-de-ibirico", nombre: "La Jagua de Ibirico", departamento: "Cesar", lat: 9.5636, lon: -73.3339, operador: "Afinia", altitud: 130 },

  // --- Córdoba (Afinia) ---
  { slug: "monteria", nombre: "Montería", departamento: "Córdoba", lat: 8.7479, lon: -75.8814, operador: "Afinia", altitud: 18 },
  { slug: "lorica", nombre: "Lorica", departamento: "Córdoba", lat: 9.2394, lon: -75.8147, operador: "Afinia", altitud: 8 },
  { slug: "cerete", nombre: "Cereté", departamento: "Córdoba", lat: 8.8853, lon: -75.7919, operador: "Afinia", altitud: 15 },
  { slug: "sahagun", nombre: "Sahagún", departamento: "Córdoba", lat: 8.9472, lon: -75.4444, operador: "Afinia", altitud: 60 },
  { slug: "montelibano", nombre: "Montelíbano", departamento: "Córdoba", lat: 7.9803, lon: -75.4172, operador: "Afinia", altitud: 40 },
  { slug: "planeta-rica", nombre: "Planeta Rica", departamento: "Córdoba", lat: 8.4092, lon: -75.5836, operador: "Afinia", altitud: 130 },

  // --- Sucre (Afinia) ---
  { slug: "sincelejo", nombre: "Sincelejo", departamento: "Sucre", lat: 9.3047, lon: -75.3978, operador: "Afinia", altitud: 213 },
  { slug: "corozal", nombre: "Corozal", departamento: "Sucre", lat: 9.3175, lon: -75.2942, operador: "Afinia", altitud: 174 },
  { slug: "san-marcos", nombre: "San Marcos", departamento: "Sucre", lat: 8.6603, lon: -75.1308, operador: "Afinia", altitud: 25 },
  { slug: "tolu", nombre: "Santiago de Tolú", departamento: "Sucre", lat: 9.5247, lon: -75.5814, operador: "Afinia", altitud: 3 },

  // --- Archipiélago (Sopesa) ---
  { slug: "san-andres", nombre: "San Andrés", departamento: "San Andrés y Providencia", lat: 12.5847, lon: -81.7006, operador: "Sopesa", altitud: 1 },
  { slug: "providencia", nombre: "Providencia", departamento: "San Andrés y Providencia", lat: 13.3776, lon: -81.3743, operador: "Sopesa", altitud: 5 },
];

export function getMunicipio(slug: string | null | undefined): Municipio | undefined {
  if (!slug) return undefined;
  return MUNICIPIOS.find((m) => m.slug === slug);
}

function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** Municipio más cercano a unas coordenadas, con la distancia en km. */
export function municipioMasCercano(
  lat: number,
  lon: number,
): { municipio: Municipio; distanciaKm: number } {
  let mejor = MUNICIPIOS[0];
  let mejorD = Infinity;
  for (const m of MUNICIPIOS) {
    const d = haversineKm(lat, lon, m.lat, m.lon);
    if (d < mejorD) {
      mejorD = d;
      mejor = m;
    }
  }
  return { municipio: mejor, distanciaKm: mejorD };
}

/** Consumo de subsistencia mensual (kWh) según altitud, Resolución CREG. */
export function consumoSubsistencia(altitud: number): number {
  return altitud < 1000 ? 173 : 130;
}

export const DEPARTAMENTOS_CARIBE = [
  "Atlántico",
  "Bolívar",
  "Cesar",
  "Córdoba",
  "La Guajira",
  "Magdalena",
  "Sucre",
  "San Andrés y Providencia",
] as const;
