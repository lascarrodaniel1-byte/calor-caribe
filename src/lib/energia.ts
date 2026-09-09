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
  /** palabras extra para la búsqueda (sinónimos, marcas comunes) */
  busqueda?: string;
}

/**
 * Catálogo de electrodomésticos con valores típicos para un hogar de la costa.
 * La potencia es el **promedio efectivo** de consumo (p. ej. la nevera pasa
 * ~150 W en promedio aunque el compresor consuma más cuando arranca), no el pico.
 * Ajusta potencia y horas a tu equipo real; para el dato exacto mira la etiqueta.
 */
export const PRESETS: PresetElectrodomestico[] = [
  // Refrigeración
  { nombre: "Nevera / refrigerador (moderno)", potenciaW: 150, horasDia: 24, diasMes: 30, categoria: "refrigeracion", esencial: true, prioridad: 5, nota: "150 W es el promedio efectivo de una nevera no-frost moderna." },
  { nombre: "Nevera antigua (2 puertas)", potenciaW: 250, horasDia: 24, diasMes: 30, categoria: "refrigeracion", esencial: true, prioridad: 5 },
  { nombre: "Nevera grande / side by side", potenciaW: 200, horasDia: 24, diasMes: 30, categoria: "refrigeracion", esencial: true, prioridad: 5, busqueda: "dos puertas dispensador" },
  { nombre: "Nevera pequeña / frigobar", potenciaW: 70, horasDia: 24, diasMes: 30, categoria: "refrigeracion", esencial: false, prioridad: 3, busqueda: "minibar bar habitación" },
  { nombre: "Congelador horizontal (freezer)", potenciaW: 180, horasDia: 24, diasMes: 30, categoria: "refrigeracion", esencial: true, prioridad: 4, busqueda: "arcón congelador nevera" },
  { nombre: "Dispensador de agua frío/caliente", potenciaW: 90, horasDia: 24, diasMes: 30, categoria: "refrigeracion", esencial: false, prioridad: 3, busqueda: "botellón surtidor" },

  // Climatización
  { nombre: "Aire acondicionado 9.000 BTU", potenciaW: 850, horasDia: 6, diasMes: 30, categoria: "climatizacion", esencial: false, prioridad: 2, busqueda: "minisplit split ac clima" },
  { nombre: "Aire acondicionado 12.000 BTU (inverter)", potenciaW: 1100, horasDia: 6, diasMes: 30, categoria: "climatizacion", esencial: false, prioridad: 2, busqueda: "minisplit split ac clima" },
  { nombre: "Aire acondicionado 12.000 BTU (convencional)", potenciaW: 1450, horasDia: 6, diasMes: 30, categoria: "climatizacion", esencial: false, prioridad: 2, busqueda: "minisplit split ac clima" },
  { nombre: "Aire acondicionado 18.000 BTU", potenciaW: 1800, horasDia: 6, diasMes: 30, categoria: "climatizacion", esencial: false, prioridad: 2, busqueda: "minisplit split ac clima" },
  { nombre: "Aire acondicionado 24.000 BTU", potenciaW: 2400, horasDia: 6, diasMes: 30, categoria: "climatizacion", esencial: false, prioridad: 2, busqueda: "minisplit split ac clima" },
  { nombre: "Aire acondicionado de ventana", potenciaW: 1300, horasDia: 6, diasMes: 30, categoria: "climatizacion", esencial: false, prioridad: 2, busqueda: "ac clima" },
  { nombre: "Aire acondicionado portátil", potenciaW: 1200, horasDia: 5, diasMes: 30, categoria: "climatizacion", esencial: false, prioridad: 2, busqueda: "ac clima móvil" },
  { nombre: "Ventilador de techo", potenciaW: 65, horasDia: 10, diasMes: 30, categoria: "climatizacion", esencial: false, prioridad: 4, busqueda: "abanico" },
  { nombre: "Ventilador de pie / pedestal", potenciaW: 55, horasDia: 8, diasMes: 30, categoria: "climatizacion", esencial: false, prioridad: 4, busqueda: "abanico" },
  { nombre: "Ventilador de mesa", potenciaW: 40, horasDia: 6, diasMes: 30, categoria: "climatizacion", esencial: false, prioridad: 4, busqueda: "abanico escritorio" },
  { nombre: "Ventilador de torre", potenciaW: 45, horasDia: 8, diasMes: 30, categoria: "climatizacion", esencial: false, prioridad: 4, busqueda: "abanico columna" },
  { nombre: "Extractor de aire / exhausto", potenciaW: 25, horasDia: 3, diasMes: 30, categoria: "climatizacion", esencial: false, prioridad: 3, busqueda: "extractor baño cocina campana" },
  { nombre: "Climatizador evaporativo", potenciaW: 120, horasDia: 6, diasMes: 30, categoria: "climatizacion", esencial: false, prioridad: 3, busqueda: "cooler enfriador aire nebulizador" },
  { nombre: "Deshumidificador", potenciaW: 300, horasDia: 6, diasMes: 30, categoria: "climatizacion", esencial: false, prioridad: 3, busqueda: "humedad" },

  // Cocina
  { nombre: "Microondas", potenciaW: 1000, horasDia: 0.3, diasMes: 30, categoria: "cocina", esencial: false, prioridad: 3 },
  { nombre: "Horno eléctrico", potenciaW: 1500, horasDia: 0.5, diasMes: 12, categoria: "cocina", esencial: false, prioridad: 2, busqueda: "hornito" },
  { nombre: "Freidora de aire (airfryer)", potenciaW: 1400, horasDia: 0.4, diasMes: 20, categoria: "cocina", esencial: false, prioridad: 3, busqueda: "air fryer freidora" },
  { nombre: "Estufa de inducción (1 puesto)", potenciaW: 1600, horasDia: 0.6, diasMes: 30, categoria: "cocina", esencial: false, prioridad: 2, busqueda: "cocina eléctrica placa vitrocerámica" },
  { nombre: "Sanduchera", potenciaW: 750, horasDia: 0.2, diasMes: 20, categoria: "cocina", esencial: false, prioridad: 3, busqueda: "sándwich arepa" },
  { nombre: "Tostadora de pan", potenciaW: 850, horasDia: 0.15, diasMes: 20, categoria: "cocina", esencial: false, prioridad: 3, busqueda: "tostador" },
  { nombre: "Licuadora", potenciaW: 400, horasDia: 0.2, diasMes: 30, categoria: "cocina", esencial: false, prioridad: 3 },
  { nombre: "Procesadora de alimentos", potenciaW: 500, horasDia: 0.1, diasMes: 12, categoria: "cocina", esencial: false, prioridad: 3, busqueda: "picadora" },
  { nombre: "Batidora", potenciaW: 250, horasDia: 0.1, diasMes: 8, categoria: "cocina", esencial: false, prioridad: 3 },
  { nombre: "Olla arrocera", potenciaW: 500, horasDia: 0.5, diasMes: 30, categoria: "cocina", esencial: false, prioridad: 3 },
  { nombre: "Olla eléctrica multifunción / a presión", potenciaW: 900, horasDia: 0.5, diasMes: 15, categoria: "cocina", esencial: false, prioridad: 3, busqueda: "multiolla instant pot" },
  { nombre: "Cafetera de goteo", potenciaW: 900, horasDia: 0.3, diasMes: 30, categoria: "cocina", esencial: false, prioridad: 3, busqueda: "greca eléctrica tinto" },
  { nombre: "Cafetera express", potenciaW: 1100, horasDia: 0.2, diasMes: 30, categoria: "cocina", esencial: false, prioridad: 3, busqueda: "espresso" },
  { nombre: "Grill / parrilla eléctrica", potenciaW: 1500, horasDia: 0.4, diasMes: 8, categoria: "cocina", esencial: false, prioridad: 2, busqueda: "asador plancha" },
  { nombre: "Extractor de jugos", potenciaW: 250, horasDia: 0.1, diasMes: 20, categoria: "cocina", esencial: false, prioridad: 3, busqueda: "juguera exprimidor naranja" },

  // Lavado y aseo
  { nombre: "Lavadora (carga superior)", potenciaW: 500, horasDia: 1, diasMes: 12, categoria: "lavado", esencial: false, prioridad: 3 },
  { nombre: "Lavadora (carga frontal)", potenciaW: 500, horasDia: 1, diasMes: 12, categoria: "lavado", esencial: false, prioridad: 3 },
  { nombre: "Lavadora-secadora", potenciaW: 800, horasDia: 1, diasMes: 12, categoria: "lavado", esencial: false, prioridad: 2 },
  { nombre: "Secadora de ropa eléctrica", potenciaW: 3000, horasDia: 1, diasMes: 8, categoria: "lavado", esencial: false, prioridad: 1, nota: "Consumo muy alto. En la costa casi siempre basta con secar al sol." },
  { nombre: "Plancha de ropa", potenciaW: 1200, horasDia: 0.5, diasMes: 8, categoria: "lavado", esencial: false, prioridad: 2 },
  { nombre: "Vaporizador de ropa vertical", potenciaW: 1500, horasDia: 0.3, diasMes: 8, categoria: "lavado", esencial: false, prioridad: 2, busqueda: "steamer plancha vapor" },
  { nombre: "Aspiradora", potenciaW: 1000, horasDia: 0.3, diasMes: 8, categoria: "lavado", esencial: false, prioridad: 3 },
  { nombre: "Aspiradora robot", potenciaW: 25, horasDia: 2, diasMes: 30, categoria: "lavado", esencial: false, prioridad: 4, busqueda: "roomba" },
  { nombre: "Hidrolavadora", potenciaW: 1400, horasDia: 0.3, diasMes: 4, categoria: "lavado", esencial: false, prioridad: 2, busqueda: "lavadora presión karcher" },
  { nombre: "Secador de cabello", potenciaW: 1500, horasDia: 0.15, diasMes: 20, categoria: "lavado", esencial: false, prioridad: 3, busqueda: "secadora pelo" },
  { nombre: "Plancha para el cabello", potenciaW: 45, horasDia: 0.15, diasMes: 20, categoria: "lavado", esencial: false, prioridad: 4, busqueda: "alisadora pelo" },

  // Entretenimiento
  { nombre: "Televisor LED 32\"", potenciaW: 45, horasDia: 5, diasMes: 30, categoria: "entretenimiento", esencial: false, prioridad: 3, busqueda: "tv" },
  { nombre: "Televisor LED 43\"", potenciaW: 90, horasDia: 5, diasMes: 30, categoria: "entretenimiento", esencial: false, prioridad: 3, busqueda: "tv" },
  { nombre: "Televisor LED 55\"", potenciaW: 120, horasDia: 5, diasMes: 30, categoria: "entretenimiento", esencial: false, prioridad: 3, busqueda: "tv" },
  { nombre: "Televisor 65\" o más", potenciaW: 160, horasDia: 5, diasMes: 30, categoria: "entretenimiento", esencial: false, prioridad: 3, busqueda: "tv" },
  { nombre: "Consola de videojuegos", potenciaW: 130, horasDia: 2, diasMes: 20, categoria: "entretenimiento", esencial: false, prioridad: 3, busqueda: "playstation xbox nintendo" },
  { nombre: "Decodificador TV / TDT", potenciaW: 15, horasDia: 5, diasMes: 30, categoria: "entretenimiento", esencial: false, prioridad: 4, busqueda: "directv claro deco" },
  { nombre: "Barra de sonido", potenciaW: 25, horasDia: 4, diasMes: 30, categoria: "entretenimiento", esencial: false, prioridad: 4, busqueda: "soundbar parlante" },
  { nombre: "Equipo de sonido / minicomponente", potenciaW: 70, horasDia: 2, diasMes: 20, categoria: "entretenimiento", esencial: false, prioridad: 4, busqueda: "equipo música bafle" },
  { nombre: "Proyector / video beam", potenciaW: 250, horasDia: 2, diasMes: 12, categoria: "entretenimiento", esencial: false, prioridad: 3, busqueda: "videobeam" },

  // Iluminación
  { nombre: "Bombillo LED (9 W)", potenciaW: 9, horasDia: 5, diasMes: 30, categoria: "iluminacion", esencial: false, prioridad: 4, busqueda: "foco lámpara" },
  { nombre: "Bombillo LED grande (15 W)", potenciaW: 15, horasDia: 5, diasMes: 30, categoria: "iluminacion", esencial: false, prioridad: 4, busqueda: "foco lámpara" },
  { nombre: "Panel / plafón LED", potenciaW: 24, horasDia: 5, diasMes: 30, categoria: "iluminacion", esencial: false, prioridad: 4, busqueda: "lámpara techo" },
  { nombre: "Bombillo ahorrador (CFL)", potenciaW: 20, horasDia: 5, diasMes: 30, categoria: "iluminacion", esencial: false, prioridad: 4, busqueda: "foco fluorescente" },
  { nombre: "Bombillo incandescente (60 W)", potenciaW: 60, horasDia: 4, diasMes: 30, categoria: "iluminacion", esencial: false, prioridad: 4, nota: "Conviene cambiarlo por LED: consume 6–7 veces más." },
  { nombre: "Reflector LED exterior", potenciaW: 30, horasDia: 6, diasMes: 30, categoria: "iluminacion", esencial: false, prioridad: 4, busqueda: "foco patio lámpara" },

  // Cómputo
  { nombre: "Computador portátil", potenciaW: 60, horasDia: 6, diasMes: 26, categoria: "computo", esencial: false, prioridad: 3, busqueda: "laptop notebook" },
  { nombre: "Computador de escritorio", potenciaW: 200, horasDia: 6, diasMes: 26, categoria: "computo", esencial: false, prioridad: 3, busqueda: "pc torre cpu" },
  { nombre: "PC gamer", potenciaW: 450, horasDia: 4, diasMes: 20, categoria: "computo", esencial: false, prioridad: 3, busqueda: "pc juegos" },
  { nombre: "Monitor", potenciaW: 28, horasDia: 6, diasMes: 26, categoria: "computo", esencial: false, prioridad: 4, busqueda: "pantalla" },
  { nombre: "Impresora de inyección", potenciaW: 15, horasDia: 0.3, diasMes: 20, categoria: "computo", esencial: false, prioridad: 4, busqueda: "impresora tinta" },
  { nombre: "Impresora láser / multifuncional", potenciaW: 350, horasDia: 0.2, diasMes: 12, categoria: "computo", esencial: false, prioridad: 3, busqueda: "impresora toner" },
  { nombre: "Router / módem wifi", potenciaW: 10, horasDia: 24, diasMes: 30, categoria: "computo", esencial: false, prioridad: 4, nota: "Encendido todo el día.", busqueda: "internet wifi modem" },
  { nombre: "Cámara de seguridad IP", potenciaW: 5, horasDia: 24, diasMes: 30, categoria: "computo", esencial: false, prioridad: 4, busqueda: "cctv vigilancia" },

  // Agua
  { nombre: "Ducha eléctrica", potenciaW: 3500, horasDia: 0.33, diasMes: 30, categoria: "agua", esencial: false, prioridad: 2, busqueda: "regadera calentador" },
  { nombre: "Calentador de paso eléctrico", potenciaW: 5500, horasDia: 0.25, diasMes: 30, categoria: "agua", esencial: false, prioridad: 2, busqueda: "calentador instantáneo agua caliente" },
  { nombre: "Termo / calentador de acumulación", potenciaW: 1500, horasDia: 1.5, diasMes: 30, categoria: "agua", esencial: false, prioridad: 2, busqueda: "boiler tanque agua caliente" },
  { nombre: "Bomba de agua 1/2 HP", potenciaW: 450, horasDia: 0.8, diasMes: 30, categoria: "agua", esencial: true, prioridad: 5, busqueda: "motobomba tanque" },
  { nombre: "Bomba de agua 1 HP", potenciaW: 750, horasDia: 1, diasMes: 30, categoria: "agua", esencial: true, prioridad: 5, busqueda: "motobomba tanque" },
  { nombre: "Presurizador / hidroneumático", potenciaW: 600, horasDia: 1, diasMes: 30, categoria: "agua", esencial: false, prioridad: 4, busqueda: "presostato presión agua" },
  { nombre: "Purificador de agua UV", potenciaW: 25, horasDia: 24, diasMes: 30, categoria: "agua", esencial: false, prioridad: 4, busqueda: "filtro" },

  // Otro
  { nombre: "Cargador de celular", potenciaW: 8, horasDia: 3, diasMes: 30, categoria: "otro", esencial: false, prioridad: 4, busqueda: "teléfono móvil" },
  { nombre: "Cargador de portátil", potenciaW: 55, horasDia: 4, diasMes: 26, categoria: "otro", esencial: false, prioridad: 4, busqueda: "laptop" },
  { nombre: "Ventilador USB pequeño", potenciaW: 10, horasDia: 4, diasMes: 30, categoria: "otro", esencial: false, prioridad: 4, busqueda: "abanico escritorio mini" },
  { nombre: "Motor de portón / garaje", potenciaW: 6, horasDia: 0.1, diasMes: 30, categoria: "otro", esencial: false, prioridad: 4, nota: "El promedio es bajo; el pico al abrir/cerrar es breve." },
  { nombre: "Timbre / citófono", potenciaW: 3, horasDia: 24, diasMes: 30, categoria: "otro", esencial: false, prioridad: 4, busqueda: "portero eléctrico" },
  { nombre: "Bomba de acuario / pecera", potenciaW: 20, horasDia: 24, diasMes: 30, categoria: "otro", esencial: false, prioridad: 4, busqueda: "filtro pez" },
  { nombre: "Repelente eléctrico de mosquitos", potenciaW: 5, horasDia: 10, diasMes: 30, categoria: "otro", esencial: false, prioridad: 4, busqueda: "zancudo pastilla líquido" },
  { nombre: "Herramienta eléctrica (taladro, pulidora)", potenciaW: 600, horasDia: 0.1, diasMes: 4, categoria: "otro", esencial: false, prioridad: 2, busqueda: "taladro pulidora sierra" },
];

export function nuevoId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function normalizar(s: string): string {
  // quita tildes para que "camara" encuentre "cámara"
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

/** Sinónimos por categoría, para que "luz" o "frío" encuentren la sección. */
const ALIAS_CATEGORIA: Record<Categoria, string> = {
  refrigeracion: "frio congelar",
  climatizacion: "aire clima calor fresco frio abanico",
  cocina: "cocinar comida",
  lavado: "aseo limpieza ropa",
  entretenimiento: "sala",
  iluminacion: "luz lampara foco bombilla",
  computo: "computador tecnologia oficina",
  agua: "agua",
  otro: "",
};

/** Filtra el catálogo por nombre, categoría o palabras clave (por prefijo). */
export function buscarPresets(consulta: string): PresetElectrodomestico[] {
  const q = normalizar(consulta.trim());
  if (!q) return PRESETS;
  const terminos = q.split(/\s+/).filter(Boolean);
  return PRESETS.filter((p) => {
    const palabras = normalizar(
      `${p.nombre} ${CATEGORIA_LABEL[p.categoria]} ${
        ALIAS_CATEGORIA[p.categoria]
      } ${p.busqueda ?? ""}`,
    ).split(/[\s/().,"-]+/);
    return terminos.every((t) => palabras.some((w) => w.startsWith(t)));
  });
}

export function kwhMes(e: Pick<Electrodomestico, "potenciaW" | "horasDia" | "diasMes">): number {
  return (e.potenciaW / 1000) * e.horasDia * e.diasMes;
}

export function kwhDia(e: Pick<Electrodomestico, "potenciaW" | "horasDia">): number {
  return (e.potenciaW / 1000) * e.horasDia;
}

/**
 * Ajuste por calor / El Niño.
 *
 * Cuando la sensación térmica de la semana supera la de una tarde calurosa
 * "normal" en la costa Caribe (~40 °C de heat index máximo, que es lo que
 * asumen las horas por defecto de los electrodomésticos), el aire acondicionado
 * se usa más horas y su compresor rinde menos: ~5 % más de consumo de
 * climatización por cada grado por encima, hasta +50 %. La nevera también
 * trabaja más, pero en menor medida.
 */
export const SENSACION_BASE = 40;

export function factorCalor(sensacionMaxProm: number): number {
  const exceso = Math.max(0, sensacionMaxProm - SENSACION_BASE);
  return Math.min(1.5, 1 + 0.05 * exceso);
}

/** Aplica el factor de calor según la categoría del equipo. */
export function factorPorCategoria(cat: Categoria, f: number): number {
  if (f <= 1) return 1;
  if (cat === "climatizacion") return f;
  if (cat === "refrigeracion") return 1 + 0.35 * (f - 1);
  return 1;
}

export interface LineaConsumo {
  electrodomestico: Electrodomestico;
  kwh: number;
  costo: number;
  porcentaje: number;
  /** factor de calor aplicado a esta línea (1 = ninguno) */
  factorAplicado: number;
}

export interface ResumenConsumo {
  lineas: LineaConsumo[];
  kwhTotal: number;
  /** kWh totales sin el ajuste por calor (para comparar). */
  kwhSinAjuste: number;
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
  factorClima = 1,
): ResumenConsumo {
  const conKwh = electrodomesticos.map((e) => {
    const base = kwhMes(e);
    const f = factorPorCategoria(e.categoria, factorClima);
    return { e, kwh: base * f, base, factorAplicado: f };
  });
  const kwhTotal = conKwh.reduce((s, x) => s + x.kwh, 0);
  const kwhSinAjuste = conKwh.reduce((s, x) => s + x.base, 0);
  const costoEnergia = kwhTotal * precioKwh;

  const lineas: LineaConsumo[] = conKwh
    .map(({ e, kwh, factorAplicado }) => ({
      electrodomestico: e,
      kwh,
      costo: kwh * precioKwh,
      porcentaje: kwhTotal > 0 ? (kwh / kwhTotal) * 100 : 0,
      factorAplicado,
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
    kwhSinAjuste,
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
