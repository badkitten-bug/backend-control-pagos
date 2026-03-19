import {
  addDays,
  addWeeks,
  addMonths,
  endOfMonth,
  setDate,
  startOfDay,
} from 'date-fns';
import { PaymentFrequency } from '../contracts/contract.entity';
import { ScheduleStatus } from './payment-schedule.entity';

/**
 * Calcula la siguiente fecha de vencimiento según la frecuencia de pago.
 * Función pura — sin efectos secundarios ni acceso a BD.
 */
export function calculateNextDate(
  baseDate: Date,
  frequency: PaymentFrequency,
): Date {
  const startDate = startOfDay(new Date(baseDate));

  switch (frequency) {
    case PaymentFrequency.DIARIO:
      return startOfDay(addDays(startDate, 1));

    case PaymentFrequency.SEMANAL:
      return startOfDay(addWeeks(startDate, 1));

    case PaymentFrequency.QUINCENAL: {
      const currentDay = startDate.getDate();
      const lastDayOfMonth = endOfMonth(startDate).getDate();

      if (currentDay < 15) {
        return startOfDay(setDate(startDate, 15));
      }
      if (currentDay < lastDayOfMonth) {
        return startOfDay(endOfMonth(startDate));
      }
      const nextMonth = addMonths(startDate, 1);
      return startOfDay(setDate(nextMonth, 15));
    }

    case PaymentFrequency.MENSUAL: {
      const nextMonth = addMonths(startDate, 1);
      const targetDay = startDate.getDate();
      const lastDayOfNextMonth = endOfMonth(nextMonth).getDate();

      if (targetDay > lastDayOfNextMonth) {
        return startOfDay(endOfMonth(nextMonth));
      }
      return startOfDay(setDate(nextMonth, targetDay));
    }

    default:
      return startOfDay(addMonths(startDate, 1));
  }
}

export interface CuotaCalculo {
  numeroCuota: number;
  capital: number;
  comision: number;
  total: number;
}

/**
 * Calcula la distribución de cuotas a partir de los datos del contrato.
 * Función pura — sin efectos secundarios ni acceso a BD.
 * La última cuota absorbe el redondeo para que la suma sea exacta.
 */
export function calcularCuotas(
  precio: number,
  pagoInicial: number,
  numeroCuotas: number,
  comisionPorcentaje: number,
): CuotaCalculo[] {
  const capitalTotal = precio - pagoInicial;
  const cuotaBase = Math.floor((capitalTotal / numeroCuotas) * 100) / 100;
  const ajusteFinal =
    Math.round((capitalTotal - cuotaBase * (numeroCuotas - 1)) * 100) / 100;

  const cuotas: CuotaCalculo[] = [];
  for (let i = 1; i <= numeroCuotas; i++) {
    const capital = i === numeroCuotas ? ajusteFinal : cuotaBase;
    const comision =
      Math.round(((capital * comisionPorcentaje) / 100) * 100) / 100;
    const total = Math.round((capital + comision) * 100) / 100;
    cuotas.push({ numeroCuota: i, capital, comision, total });
  }
  return cuotas;
}

export interface CuotaSimple {
  saldo: number;
  montoPagado: number;
  estado: ScheduleStatus;
}

/**
 * Aplica un monto en cascada sobre una lista de cuotas pendientes/vencidas.
 * Función pura — recibe y devuelve objetos planos, sin acceso a BD.
 * El excedente se aplica a la siguiente cuota en orden.
 */
export function aplicarCascadePago(
  cuotas: CuotaSimple[],
  monto: number,
): CuotaSimple[] {
  let restante = monto;

  return cuotas.map((cuota) => {
    if (restante <= 0) return cuota;

    const saldo = parseFloat(cuota.saldo.toString());
    const montoPagadoActual = parseFloat(cuota.montoPagado?.toString() || '0');

    if (restante >= saldo) {
      restante -= saldo;
      return {
        ...cuota,
        montoPagado: montoPagadoActual + saldo,
        saldo: 0,
        estado: ScheduleStatus.PAGADA,
      };
    } else {
      const nuevoSaldo = Math.round((saldo - restante) * 100) / 100;
      const resultado = {
        ...cuota,
        montoPagado: montoPagadoActual + restante,
        saldo: nuevoSaldo,
        estado: cuota.estado,
      };
      restante = 0;
      return resultado;
    }
  });
}
