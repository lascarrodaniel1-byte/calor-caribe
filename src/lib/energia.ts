/**
 * Cálculo de consumo eléctrico y de la factura.
 *
 * Consumo de un electrodoméstico:
 *   kWh/mes = (potencia_W / 1000) * horas_día * días_mes
 *
 * Umbral de subsistencia (costa Caribe, < 1.000 m s. n. m.): 173 kWh/mes.
 *  - Estratos 1, 2 y 3 reciben subsidio SOLO sobre el consumo hasta ese tope.
 *    El consumo por encima se cobra a tarifa plena => "sobrecosto" en el recibo.
 *  - Estratos 5 y 6 pagan una contribución (+20%) sobre todo el consumo.
 * Los porcentajes son los máximos de ley; el operador (Air-e, Afinia, Sopesa)
 * puede aplicar valores menores según la resolución tarifaria del mes.
 */

export type Categoria =
  | "refrigeracion"
  | "climatizacion"
  | "cocina"
  | "lavado"
  | "entretenimiento"
  | "iluminacion"
  | "computo"
  | "agua"
  | "otro";

export const CATEGORIA_LABEL: Record<Categoria, string> = {
  refrigeracion: "Refrigeración",
  climatizacion: "Climatización",
  cocina: "Cocina",
  lavado: "Lavado y aseo",
  entretenimiento: "Entretenimiento",
  iluminacion: "Iluminación",
  computo: "Cómputo",
  agua: "Bombeo de agua",
  otro: "Otro",
};

export interface Electrodomestico {
  id: string;
  nombre: string;
  potenciaW: number;
  horasDia: number;
  diasMes: number;
  categoria: Categoria;
  /** Si es de uso continuo/indispensable (no se puede recortar en el plan). */
  esencial: boolean;
  /** Prioridad de uso 1 (recortable primero) … 5 (casi intocable). */
  prioridad: number;
}

export interface PresetElectrodomestico {
  nombre: string;
  potenciaW: number;
  horasDia: number;
  diasMes: number;
  categoria: Categoria;
  esencial: boolean;
  prioridad: number;
  nota?: string;
}

export const PRESETS: PresetElectrodomestico[] = [
  { nombre: "Nevera / refrigerador", potenciaW: 150, horasDia: 24, diasMes: 30, categoria: "refrigeracion", esencial: true, prioridad: 5, nota: "El compresor no trabaja todo el tiempo; 150 W es el promedio efectivo de una nevera moderna." },
  { nombre: "Nevera antigua (2 puertas)", potenciaW: 250, horasDia: 24, diasMes: 30, categoria: "refrigeracion", esencial: true, prioridad: 5 },
  { nombre: "Aire acondicionado 12.000 BTU", potenciaW: 1100, horasDia: 6, diasMes: 30, categoria: "climatizacion", esencial: false, prioridad: 2, nota: "Inverter moderno; uno convencional puede llegar a 1.400–1.600 W." },
  { nombre: "Aire acondicionado 9.000 BTU", potenciaW: 850, horasDia: 6, diasMes: 30, categoria: "climatizacion", esencial: false, prioridad: 2 },
  { nombre: "Ventilador de techo", potenciaW: 65, horasDia: 10, diasMes: 30, categoria: "climatizacion", esencial: false, prioridad: 4 },
  { nombre: "Ventilador de pie", potenciaW: 55, horasDia: 8, diasMes: 30, categoria: "climatizacion", esencial: false, prioridad: 4 },
  { nombre: "Televisor LED 43\"", potenciaW: 90, horasDia: 5, diasMes: 30, categoria: "entretenimiento", esencial: false, prioridad: 3 },
  { nombre: "Bombillo LED", potenciaW: 9, horasDia: 5, diasMes: 30, categoria: "iluminacion", esencial: false, prioridad: 4 },
  { nombre: "Computador portátil", potenciaW: 60, horasDia: 6, diasMes: 26, categoria: "computo", esencial: false, prioridad: 3 },
  { nombre: "Computador de escritorio", potenciaW: 200, horasDia: 6, diasMes: 26, categoria: "computo", esencial: false, prioridad: 3 },
  { nombre: "Lavadora", potenciaW: 500, horasDia: 1, diasMes: 12, categoria: "lavado", esencial: false, prioridad: 3 },
  { nombre: "Plancha", potenciaW: 1200, horasDia: 0.5, diasMes: 8, categoria: "lavado", esencial: false, prioridad: 2 },
  { nombre: "Microondas", potenciaW: 1000, horasDia: 0.3, diasMes: 30, categoria: "cocina", esencial: false, prioridad: 3 },
  { nombre: "Licuadora", potenciaW: 400, horasDia: 0.2, diasMes: 30, categoria: "cocina", esencial: false, prioridad: 3 },
  { nombre: "Olla arrocera", potenciaW: 500, horasDia: 0.5, diasMes: 30, categoria: "cocina", esencial: false, prioridad: 3 },
  { nombre: "Ducha eléctrica", potenciaW: 3500, horasDia: 0.33, diasMes: 30, categoria: "agua", esencial: false, prioridad: 2 },
  { nombre: "Bomba de agua (1 HP)", potenciaW: 750, horasDia: 1, diasMes: 30, categoria: "agua", esencial: true, prioridad: 5 },
  { nombre: "Cargador de celular", potenciaW: 10, horasDia: 3, diasMes: 30, categoria: "otro", esencial: false, prioridad: 4 },
];

export function nuevoId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function kwhMes(e: Pick<Electrodomestico, "potenciaW" | "horasDia" | "diasMes">): number {
  return (e.potenciaW / 1000) * e.horasDia * e.diasMes;
}

export function kwhDia(e: Pick<Electrodomestico, "potenciaW" | "horasDia">): number {
  return (e.potenciaW / 1000) * e.horasDia;
}

export interface LineaConsumo {
  electrodomestico: Electrodomestico;
  kwh: number;
  costo: number;
  porcentaje: number;
}

export interface ResumenConsumo {
  lineas: LineaConsumo[];
  kwhTotal: number;
  costoEnergia: number;
  subsistencia: number;
  kwhSobreSubsistencia: number;
  /** Ajuste por subsidio (negativo) o contribución (positivo) en pesos. */
  ajusteEstrato: number;
  /** Sobrecosto atribuible a pasarse del umbral (subsidio perdido). */
  sobrecostoUmbral: number;
  costoEstimadoTotal: number;
}

const SUBSIDIO_MAX: Record<number, number> = { 1: 0.6, 2: 0.5, 3: 0.15 };
const CONTRIBUCION: Record<number, number> = { 5: 0.2, 6: 0.2 };

export function calcularConsumo(
  electrodomesticos: Electrodomestico[],
  precioKwh: number,
  estrato: number,
  subsistencia: number,
): ResumenConsumo {
  const conKwh = electrodomesticos.map((e) => ({ e, kwh: kwhMes(e) }));
  const kwhTotal = conKwh.reduce((s, x) => s + x.kwh, 0);
  const costoEnergia = kwhTotal * precioKwh;

  const lineas: LineaConsumo[] = conKwh
    .map(({ e, kwh }) => ({
      electrodomestico: e,
      kwh,
      costo: kwh * precioKwh,
      porcentaje: kwhTotal > 0 ? (kwh / kwhTotal) * 100 : 0,
    }))
    .sort((a, b) => b.kwh - a.kwh);

  const kwhSubsidiable = Math.min(kwhTotal, subsistencia);
  const kwhSobreSubsistencia = Math.max(0, kwhTotal - subsistencia);

  const subsidioPct = SUBSIDIO_MAX[estrato] ?? 0;
  const contribPct = CONTRIBUCION[estrato] ?? 0;

  // Subsidio: se aplica solo al bloque subsidiable.
  const subsidio = subsidioPct > 0 ? -kwhSubsidiable * precioKwh * subsidioPct : 0;
  // Contribución: sobre todo el consumo.
  const contribucion = contribPct > 0 ? kwhTotal * precioKwh * contribPct : 0;
  const ajusteEstrato = subsidio + contribucion;

  // "Sobrecosto por umbral": lo que dejarías de recibir de subsidio por el
  // consumo que excede la subsistencia (para estratos 1–3).
  const sobrecostoUmbral =
    subsidioPct > 0 ? kwhSobreSubsistencia * precioKwh * subsidioPct : 0;

  const costoEstimadoTotal = costoEnergia + ajusteEstrato;

  return {
    lineas,
    kwhTotal,
    costoEnergia,
    subsistencia,
    kwhSobreSubsistencia,
    ajusteEstrato,
    sobrecostoUmbral,
    costoEstimadoTotal,
  };
}

export function precioKwhReferencia(): number {
  // Valor de referencia del costo unitario (CU) residencial de Air-e / Afinia
  // en pesos por kWh. El usuario debe reemplazarlo con el de su factura del mes.
  return 1050;
}
