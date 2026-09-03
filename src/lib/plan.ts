/**
 * Planificador de uso: reparte el "presupuesto" de kWh que queda en el mes
 * entre los electrodomésticos, para no superar la meta que evita el sobrecosto
 * de la factura (normalmente el consumo de subsistencia, 173 kWh/mes).
 *
 * Método:
 *  1. Se estima lo ya consumido en el mes: la lectura que ingrese el usuario o,
 *     si no la tiene, una estimación a partir de los días transcurridos.
 *  2. Carga esencial (nevera, bomba de agua…): se respeta tal cual. Su consumo
 *     para los días que faltan se descuenta del presupuesto restante.
 *  3. El presupuesto que sobra se reparte entre los electrodomésticos NO
 *     esenciales, en proporción a  prioridad × consumo deseado. Los de
 *     prioridad alta conservan más horas; los de prioridad baja se recortan
 *     primero.
 *  4. Para cada uno se calculan las horas/día permitidas para el resto del mes.
 */

import { Electrodomestico, kwhDia } from "./energia";

export interface EntradaPlan {
  electrodomesticos: Electrodomestico[];
  metaKwh: number;
  /** kWh ya consumidos este mes (lectura del medidor). 0 = estimar por días. */
  consumoRegistrado: number;
  diaActual: number; // 1..diasEnMes
  diasEnMes: number;
}

export interface LineaPlan {
  electrodomestico: Electrodomestico;
  esencial: boolean;
  horasDiaDeseadas: number;
  horasDiaPermitidas: number;
  /** kWh que consumiría en los días que faltan con el plan. */
  kwhRestanteProyectado: number;
  recorte: number; // fracción recortada (0 = sin recorte, 1 = apagado)
}

export interface ResultadoPlan {
  factible: boolean;
  lineas: LineaPlan[];
  diasRestantes: number;
  consumoBase: number; // kWh ya consumidos (dato o estimación)
  consumoEstimado: boolean; // true si consumoBase es estimación
  presupuestoRestante: number; // kWh disponibles para lo que queda del mes
  cargaEsencialRestante: number; // kWh
  presupuestoDiscrecional: number; // kWh para no esenciales
  techoDiario: number; // kWh/día objetivo para el resto del mes
  proyeccionFinMes: number; // kWh totales proyectados con el plan
  margen: number; // metaKwh - proyeccionFinMes
  mensajes: string[];
  consejosHorario: string[];
}

export function planificar(e: EntradaPlan): ResultadoPlan {
  const diasEnMes = Math.max(1, Math.round(e.diasEnMes));
  const diaActual = clamp(Math.round(e.diaActual), 1, diasEnMes);
  const diasRestantes = Math.max(0, diasEnMes - diaActual + 1);
  const diasPasados = Math.max(0, diaActual - 1);

  const esenciales = e.electrodomesticos.filter((x) => x.esencial);
  const discrecionales = e.electrodomesticos.filter((x) => !x.esencial);

  // 1. Consumo ya realizado en el mes.
  const consumoEstimado = e.consumoRegistrado <= 0;
  const consumoEstimadoPasado = e.electrodomesticos.reduce(
    (s, x) => s + kwhDia(x) * diasPasados * (x.diasMes / diasEnMes),
    0,
  );
  const consumoBase = consumoEstimado ? consumoEstimadoPasado : e.consumoRegistrado;

  // 2. Presupuesto para lo que queda del mes.
  const kwhDiaEsencial = esenciales.reduce((s, x) => s + kwhDia(x), 0);
  const cargaEsencialRestante = kwhDiaEsencial * diasRestantes;
  const presupuestoRestante = e.metaKwh - consumoBase;
  const presupuestoDiscrecional = presupuestoRestante - cargaEsencialRestante;

  const mensajes: string[] = [];
  let factible = true;
  const lineas: LineaPlan[] = [];

  // Esenciales: siempre al 100%.
  for (const x of esenciales) {
    lineas.push({
      electrodomestico: x,
      esencial: true,
      horasDiaDeseadas: x.horasDia,
      horasDiaPermitidas: x.horasDia,
      kwhRestanteProyectado: kwhDia(x) * diasRestantes,
      recorte: 0,
    });
  }

  const deseadoDiscrecionalRestante = discrecionales.reduce(
    (s, x) => s + kwhDia(x) * diasRestantes,
    0,
  );

  if (presupuestoRestante <= 0) {
    factible = false;
    mensajes.push(
      `Con ${round(consumoBase)} kWh ${
        consumoEstimado ? "estimados" : "ya registrados"
      } este mes alcanzaste o superaste la meta de ${round(
        e.metaKwh,
      )} kWh. Todo consumo adicional entra al tramo con sobrecosto: reduce al mínimo el aire y los equipos de alto consumo el resto del mes.`,
    );
    for (const x of discrecionales) {
      lineas.push({
        electrodomestico: x,
        esencial: false,
        horasDiaDeseadas: x.horasDia,
        horasDiaPermitidas: 0,
        kwhRestanteProyectado: 0,
        recorte: 1,
      });
    }
  } else if (presupuestoDiscrecional <= 0 && discrecionales.length > 0) {
    factible = false;
    mensajes.push(
      `Solo los equipos esenciales consumirían ${round(
        cargaEsencialRestante,
      )} kWh en los ${diasRestantes} días que faltan, y el presupuesto disponible es de ${round(
        presupuestoRestante,
      )} kWh. Para no pasarte hay que bajar también el consumo esencial: sube el termostato de la nevera, revisa sus empaques y reduce el bombeo de agua.`,
    );
    for (const x of discrecionales) {
      lineas.push({
        electrodomestico: x,
        esencial: false,
        horasDiaDeseadas: x.horasDia,
        horasDiaPermitidas: 0,
        kwhRestanteProyectado: 0,
        recorte: 1,
      });
    }
  } else if (discrecionales.length > 0) {
    const factor =
      deseadoDiscrecionalRestante > 0
        ? Math.min(1, presupuestoDiscrecional / deseadoDiscrecionalRestante)
        : 1;

    if (factor >= 1) {
      mensajes.push(
        `Con el uso que registraste te alcanza: proyectas terminar el mes por debajo de la meta, con un margen de ${round(
          presupuestoDiscrecional - deseadoDiscrecionalRestante,
        )} kWh. Puedes usar los equipos como los tienes configurados.`,
      );
      for (const x of discrecionales) {
        lineas.push({
          electrodomestico: x,
          esencial: false,
          horasDiaDeseadas: x.horasDia,
          horasDiaPermitidas: x.horasDia,
          kwhRestanteProyectado: kwhDia(x) * diasRestantes,
          recorte: 0,
        });
      }
    } else {
      const pesos = discrecionales.map((x) => x.prioridad * kwhDia(x) * diasRestantes);
      const sumaPesos = pesos.reduce((s, w) => s + w, 0);

      discrecionales.forEach((x, i) => {
        const deseadoKwh = kwhDia(x) * diasRestantes;
        const asignadoKwh = Math.min(
          deseadoKwh,
          sumaPesos > 0 ? (pesos[i] / sumaPesos) * presupuestoDiscrecional : 0,
        );
        const horasPermitidas =
          x.potenciaW > 0 ? asignadoKwh / (x.potenciaW / 1000) / diasRestantes : 0;
        lineas.push({
          electrodomestico: x,
          esencial: false,
          horasDiaDeseadas: x.horasDia,
          horasDiaPermitidas: horasPermitidas,
          kwhRestanteProyectado: asignadoKwh,
          recorte: deseadoKwh > 0 ? 1 - asignadoKwh / deseadoKwh : 0,
        });
      });

      mensajes.push(
        `Para no pasar de ${round(e.metaKwh)} kWh hay que recortar el uso de los equipos no esenciales alrededor de un ${Math.round(
          (1 - factor) * 100,
        )} %. Abajo están las horas/día que puede usar cada uno el resto del mes.`,
      );
    }
  } else {
    mensajes.push(
      `Con los equipos esenciales proyectas terminar en ${round(
        consumoBase + cargaEsencialRestante,
      )} kWh. Agrega el resto de electrodomésticos para repartir el presupuesto que queda.`,
    );
  }

  const kwhFuturo = lineas.reduce((s, l) => s + l.kwhRestanteProyectado, 0);
  const proyeccionFinMes = consumoBase + kwhFuturo;
  const techoDiario =
    diasRestantes > 0 ? Math.max(0, presupuestoRestante) / diasRestantes : 0;

  return {
    factible,
    lineas: lineas.sort(
      (a, b) =>
        Number(b.esencial) - Number(a.esencial) ||
        b.kwhRestanteProyectado - a.kwhRestanteProyectado,
    ),
    diasRestantes,
    consumoBase,
    consumoEstimado,
    presupuestoRestante,
    cargaEsencialRestante,
    presupuestoDiscrecional,
    techoDiario,
    proyeccionFinMes,
    margen: e.metaKwh - proyeccionFinMes,
    mensajes,
    consejosHorario: CONSEJOS_HORARIO,
  };
}

const CONSEJOS_HORARIO = [
  "Programa la lavadora, la plancha y el bombeo de agua para la madrugada o después de las 8:00 p. m., cuando hace menos calor: los equipos rinden más y el aire acondicionado no tiene que compensar.",
  "Fija el aire acondicionado en 24 °C: cada grado menos añade entre 6 % y 10 % de consumo.",
  "Concentra el uso del aire en una sola habitación en las horas de dormir y usa ventilador el resto del día.",
  "Evita abrir la nevera con frecuencia en las horas de más calor y sepárala 10 cm de la pared.",
  "Desconecta cargadores y equipos en espera (‘standby’): suman entre 3 % y 8 % de la factura.",
];

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

function round(v: number): number {
  return Math.round(v * 10) / 10;
}

export function diasEnMes(fecha: Date): number {
  return new Date(fecha.getFullYear(), fecha.getMonth() + 1, 0).getDate();
}
