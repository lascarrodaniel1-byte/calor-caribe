/**
 * Sensación térmica (Heat Index) y niveles de alerta por calor.
 *
 * Se usa la regresión de Rothfusz (NOAA) para el "heat index", que combina
 * temperatura del aire y humedad relativa. Las bandas de riesgo son las de la
 * National Weather Service, convertidas a °C.
 *
 * El fenómeno de El Niño (fase cálida del ENOS) tiende a elevar la temperatura
 * media y la frecuencia de días extremos en la costa Caribe; por eso la app
 * muestra el estado del ENOS junto a la sensación térmica.
 */

export interface ComorbilidadPerfil {
  hipertension: boolean;
  cardiovascular: boolean;
  renal: boolean;
  diabetes: boolean;
  respiratoria: boolean; // EPOC, asma
  embarazo: boolean;
  adultoMayor: boolean; // 65+
  menor5: boolean;
  obesidad: boolean;
  medicamentosCalor: boolean; // diuréticos, antihipertensivos, anticolinérgicos, psicofármacos
}

export const COMORBILIDAD_LABELS: Record<keyof ComorbilidadPerfil, string> = {
  hipertension: "Hipertensión arterial",
  cardiovascular: "Enfermedad cardíaca o cardiovascular",
  renal: "Enfermedad renal crónica",
  diabetes: "Diabetes",
  respiratoria: "Enfermedad respiratoria (EPOC, asma)",
  embarazo: "Embarazo",
  adultoMayor: "Persona de 65 años o más",
  menor5: "Menor de 5 años en el hogar",
  obesidad: "Obesidad",
  medicamentosCalor:
    "Toma diuréticos, antihipertensivos o medicamentos que afectan la sudoración",
};

export const PERFIL_VACIO: ComorbilidadPerfil = {
  hipertension: false,
  cardiovascular: false,
  renal: false,
  diabetes: false,
  respiratoria: false,
  embarazo: false,
  adultoMayor: false,
  menor5: false,
  obesidad: false,
  medicamentosCalor: false,
};

/** Heat Index en °C a partir de temperatura (°C) y humedad relativa (%). */
export function heatIndexC(tempC: number, rh: number): number {
  // Por debajo de ~27 °C el heat index no aporta; se devuelve la temperatura.
  if (tempC < 27) return tempC;

  const T = (tempC * 9) / 5 + 32; // a °F
  const R = clamp(rh, 0, 100);

  // Fórmula simple (Steadman) para el primer tanteo.
  let hiF = 0.5 * (T + 61.0 + (T - 68.0) * 1.2 + R * 0.094);

  if ((hiF + T) / 2 >= 80) {
    // Regresión completa de Rothfusz.
    hiF =
      -42.379 +
      2.04901523 * T +
      10.14333127 * R -
      0.22475541 * T * R -
      6.83783e-3 * T * T -
      5.481717e-2 * R * R +
      1.22874e-3 * T * T * R +
      8.5282e-4 * T * R * R -
      1.99e-6 * T * T * R * R;

    if (R < 13 && T >= 80 && T <= 112) {
      hiF -= ((13 - R) / 4) * Math.sqrt((17 - Math.abs(T - 95)) / 17);
    } else if (R > 85 && T >= 80 && T <= 87) {
      hiF += ((R - 85) / 10) * ((87 - T) / 5);
    }
  }

  return ((hiF - 32) * 5) / 9; // de vuelta a °C
}

/**
 * Promedio de la sensación térmica (heat index) MÁXIMA de cada día en un
 * pronóstico horario. Es la señal que usa la calculadora para estimar cuánto
 * más trabaja el aire acondicionado durante una racha de calor o El Niño.
 */
export function sensacionMaxSemana(
  horas: { time: string; tempC: number; rh: number }[],
): number {
  const porDia = new Map<string, number>();
  for (const h of horas) {
    const dia = h.time.slice(0, 10);
    const hi = heatIndexC(h.tempC, h.rh);
    porDia.set(dia, Math.max(porDia.get(dia) ?? -Infinity, hi));
  }
  const maximos = [...porDia.values()].filter((v) => Number.isFinite(v));
  if (maximos.length === 0) return 0;
  return maximos.reduce((s, v) => s + v, 0) / maximos.length;
}

export type NivelAlerta =
  | "normal"
  | "precaucion"
  | "precaucion-extrema"
  | "peligro"
  | "peligro-extremo";

export interface BandaAlerta {
  nivel: NivelAlerta;
  etiqueta: string;
  minHI: number; // °C, heat index efectivo
  color: string; // clases tailwind (texto/fondo/borde)
  colorHex: string;
  resumen: string;
}

export const BANDAS: BandaAlerta[] = [
  {
    nivel: "normal",
    etiqueta: "Normal",
    minHI: -Infinity,
    color: "bg-emerald-50 text-emerald-800 border-emerald-300",
    colorHex: "#059669",
    resumen: "Condiciones sin riesgo especial por calor.",
  },
  {
    nivel: "precaucion",
    etiqueta: "Precaución",
    minHI: 27,
    color: "bg-yellow-50 text-yellow-800 border-yellow-300",
    colorHex: "#ca8a04",
    resumen:
      "Fatiga posible con exposición prolongada o actividad física intensa.",
  },
  {
    nivel: "precaucion-extrema",
    etiqueta: "Precaución extrema",
    minHI: 32,
    color: "bg-orange-50 text-orange-800 border-orange-300",
    colorHex: "#ea580c",
    resumen:
      "Calambres e insolación probables; golpe de calor posible con exposición prolongada.",
  },
  {
    nivel: "peligro",
    etiqueta: "Peligro",
    minHI: 41,
    color: "bg-red-50 text-red-800 border-red-400",
    colorHex: "#dc2626",
    resumen:
      "Calambres e insolación muy probables; golpe de calor probable con exposición prolongada.",
  },
  {
    nivel: "peligro-extremo",
    etiqueta: "Peligro extremo",
    minHI: 54,
    color: "bg-red-100 text-red-900 border-red-600",
    colorHex: "#991b1b",
    resumen: "Golpe de calor inminente. Riesgo vital.",
  },
];

export function bandaPara(hiC: number): BandaAlerta {
  let actual = BANDAS[0];
  for (const b of BANDAS) if (hiC >= b.minHI) actual = b;
  return actual;
}

const ORDEN_NIVELES: NivelAlerta[] = [
  "normal",
  "precaucion",
  "precaucion-extrema",
  "peligro",
  "peligro-extremo",
];

export function severidad(n: NivelAlerta): number {
  const i = ORDEN_NIVELES.indexOf(n);
  return i < 0 ? 0 : i;
}

export function esNivelPeligroso(n: NivelAlerta): boolean {
  return severidad(n) >= severidad("precaucion-extrema");
}

export interface UltimoAviso {
  nivel: NivelAlerta;
  hi: number;
  fecha: string; // Date.toDateString()
}

/**
 * Regla de repetición de avisos de calor. Avisa cuando:
 *  - es el primer aviso peligroso,
 *  - sube a un nivel de alerta más alto,
 *  - la sensación térmica sube 2 °C o más desde el último aviso, o
 *  - cambió el día (recordatorio en olas de calor largas).
 * No avisa si el calor no es peligroso.
 */
export function debeAvisar(
  nivel: NivelAlerta,
  hi: number,
  fecha: string,
  previo: UltimoAviso | null | undefined,
): boolean {
  if (!esNivelPeligroso(nivel)) return false;
  if (!previo) return true;
  if (severidad(nivel) > severidad(previo.nivel)) return true;
  if (hi >= previo.hi + 2) return true;
  if (fecha !== previo.fecha) return true;
  return false;
}

/**
 * Puntaje de vulnerabilidad (0 en adelante). Cada condición desplaza hacia
 * abajo el umbral al que el calor se vuelve peligroso para esa persona.
 */
export function puntajeVulnerabilidad(p: ComorbilidadPerfil): number {
  let s = 0;
  if (p.cardiovascular) s += 2;
  if (p.renal) s += 2;
  if (p.adultoMayor) s += 2;
  if (p.menor5) s += 2;
  if (p.hipertension) s += 1;
  if (p.diabetes) s += 1;
  if (p.respiratoria) s += 1;
  if (p.embarazo) s += 1;
  if (p.obesidad) s += 1;
  if (p.medicamentosCalor) s += 1;
  return s;
}

/** °C que se "suman" al heat index real para clasificar el riesgo personal. */
export function ajusteComorbilidad(p: ComorbilidadPerfil): number {
  const s = puntajeVulnerabilidad(p);
  if (s <= 0) return 0;
  if (s <= 2) return 3;
  if (s <= 4) return 5;
  return 7;
}

export interface EvaluacionCalor {
  heatIndex: number;
  heatIndexPersonal: number;
  banda: BandaAlerta;
  bandaPersonal: BandaAlerta;
  puntaje: number;
  recomendaciones: string[];
  senalesAlarma: string[];
}

export function evaluarCalor(
  tempC: number,
  rh: number,
  perfil: ComorbilidadPerfil,
): EvaluacionCalor {
  const hi = heatIndexC(tempC, rh);
  const ajuste = ajusteComorbilidad(perfil);
  const hiPersonal = hi + ajuste;
  const banda = bandaPara(hi);
  const bandaPersonal = bandaPara(hiPersonal);

  return {
    heatIndex: hi,
    heatIndexPersonal: hiPersonal,
    banda,
    bandaPersonal,
    puntaje: puntajeVulnerabilidad(perfil),
    recomendaciones: recomendaciones(bandaPersonal.nivel, perfil),
    senalesAlarma: SENALES_ALARMA,
  };
}

export const SENALES_ALARMA = [
  "Temperatura corporal muy alta con piel caliente y seca (sin sudor)",
  "Confusión, desorientación, dificultad para hablar o convulsiones",
  "Pérdida del conocimiento o desmayo",
  "Dolor de cabeza intenso, náuseas o vómito persistente",
  "Latidos muy rápidos y respiración acelerada",
];

function recomendaciones(
  nivel: NivelAlerta,
  p: ComorbilidadPerfil,
): string[] {
  const base: string[] = [];

  if (nivel === "normal") {
    base.push(
      "Mantén una hidratación normal a lo largo del día.",
      "Aprovecha para ventilar la vivienda en las horas más frescas (madrugada y noche).",
    );
  } else {
    base.push(
      "Toma agua con frecuencia aunque no sientas sed; evita alcohol y bebidas muy azucaradas.",
      "Permanece en la zona más fresca y ventilada de la casa; usa ventilador y persianas cerradas de día.",
      "Evita salir y hacer esfuerzo físico entre las 10:00 a. m. y las 4:00 p. m.",
      "Usa ropa ligera, clara y holgada; refréscate con paños húmedos o duchas frescas.",
    );
  }

  if (nivel === "precaucion-extrema" || nivel === "peligro" || nivel === "peligro-extremo") {
    base.push(
      "Si tu vivienda no baja de temperatura, busca un lugar con aire acondicionado (centro comercial, biblioteca, casa de un familiar) por al menos 2–3 horas.",
      "Acuerda con un vecino o familiar que te contacte 2 veces al día durante la ola de calor.",
    );
  }

  if (nivel === "peligro" || nivel === "peligro-extremo") {
    base.push(
      "Cancela toda actividad al aire libre y el ejercicio.",
      "Ante mareo, confusión o desmayo llama de inmediato a la línea 123.",
    );
  }

  // Ajustes por condición
  if (p.hipertension || p.cardiovascular) {
    base.push(
      "Con hipertensión o problemas del corazón: no suspendas tus medicamentos, pero consulta a tu médico si con el calor te sientes mareado o muy débil (algunos fármacos favorecen la deshidratación).",
    );
  }
  if (p.renal) {
    base.push(
      "Con enfermedad renal: consulta cuánta agua debes tomar; en tu caso el exceso también es riesgoso y la cantidad debe individualizarse.",
    );
  }
  if (p.diabetes) {
    base.push(
      "Con diabetes: el calor puede alterar tu glucosa y la absorción de la insulina; mídete con más frecuencia y guarda la insulina fuera del calor.",
    );
  }
  if (p.respiratoria) {
    base.push(
      "Con EPOC o asma: el aire caliente puede aumentar la falta de aire; ten a mano tu inhalador de rescate.",
    );
  }
  if (p.embarazo) {
    base.push(
      "En embarazo: el golpe de calor es más frecuente; prioriza reposo en lugar fresco e hidratación.",
    );
  }
  if (p.adultoMayor || p.menor5) {
    base.push(
      "Vigila de cerca a adultos mayores y a niños pequeños: se deshidratan rápido y a veces no piden agua. Ofréceles líquidos cada hora.",
    );
  }
  if (p.medicamentosCalor) {
    base.push(
      "Revisa con tu farmacéutico si alguno de tus medicamentos requiere refrigeración o precauciones con el calor.",
    );
  }

  return base;
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

// ---- ENOS / El Niño ----

export type FaseENOS = "El Niño" | "La Niña" | "Neutral";

export interface EstadoENOS {
  fase: FaseENOS;
  intensidad: "débil" | "moderada" | "fuerte" | "muy fuerte" | "—";
  oni: number; // Oceanic Niño Index del trimestre más reciente
  trimestre: string;
  fuente: string;
  actualizado: string;
}

export function clasificarONI(oni: number): Pick<EstadoENOS, "fase" | "intensidad"> {
  const a = Math.abs(oni);
  let intensidad: EstadoENOS["intensidad"] = "—";
  if (a >= 0.5 && a < 1.0) intensidad = "débil";
  else if (a >= 1.0 && a < 1.5) intensidad = "moderada";
  else if (a >= 1.5 && a < 2.0) intensidad = "fuerte";
  else if (a >= 2.0) intensidad = "muy fuerte";

  if (oni >= 0.5) return { fase: "El Niño", intensidad };
  if (oni <= -0.5) return { fase: "La Niña", intensidad };
  return { fase: "Neutral", intensidad: "—" };
}

export function notaENOS(estado: EstadoENOS): string {
  if (estado.fase === "El Niño") {
    return "Durante El Niño la costa Caribe suele registrar temperaturas por encima del promedio, menos lluvia y más días de calor extremo. Refuerza las precauciones de esta app.";
  }
  if (estado.fase === "La Niña") {
    return "Durante La Niña predominan más lluvia y algo menos de calor extremo en el Caribe, aunque la humedad alta mantiene elevada la sensación térmica.";
  }
  return "Condiciones ENOS neutrales: sin un forzamiento estacional marcado hacia más o menos calor.";
}
