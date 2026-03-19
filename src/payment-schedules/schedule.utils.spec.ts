import { PaymentFrequency } from '../contracts/contract.entity';
import { ScheduleStatus } from './payment-schedule.entity';
import {
  calculateNextDate,
  calcularCuotas,
  aplicarCascadePago,
  CuotaSimple,
} from './schedule.utils';

// Helper: crea fecha local (evita que 'YYYY-MM-DD' se interprete como UTC)
const d = (year: number, month: number, day: number) =>
  new Date(year, month - 1, day);

// Helper: extrae 'YYYY-MM-DD' en hora local
const fmt = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

// ---------------------------------------------------------------------------
// calculateNextDate
// ---------------------------------------------------------------------------
describe('calculateNextDate', () => {
  describe('DIARIO', () => {
    it('avanza un día', () => {
      expect(fmt(calculateNextDate(d(2025, 1, 10), PaymentFrequency.DIARIO))).toBe('2025-01-11');
    });
  });

  describe('SEMANAL', () => {
    it('avanza siete días', () => {
      expect(fmt(calculateNextDate(d(2025, 1, 10), PaymentFrequency.SEMANAL))).toBe('2025-01-17');
    });
  });

  describe('QUINCENAL', () => {
    it('del día 1 va al 15 del mismo mes', () => {
      expect(fmt(calculateNextDate(d(2025, 1, 1), PaymentFrequency.QUINCENAL))).toBe('2025-01-15');
    });

    it('del día 10 va al 15 del mismo mes', () => {
      expect(fmt(calculateNextDate(d(2025, 1, 10), PaymentFrequency.QUINCENAL))).toBe('2025-01-15');
    });

    it('del día 15 va al último día del mes (enero → 31)', () => {
      expect(fmt(calculateNextDate(d(2025, 1, 15), PaymentFrequency.QUINCENAL))).toBe('2025-01-31');
    });

    it('del día 20 va al último día del mes', () => {
      expect(fmt(calculateNextDate(d(2025, 1, 20), PaymentFrequency.QUINCENAL))).toBe('2025-01-31');
    });

    it('del último día del mes va al 15 del mes siguiente (enero 31 → feb 15)', () => {
      expect(fmt(calculateNextDate(d(2025, 1, 31), PaymentFrequency.QUINCENAL))).toBe('2025-02-15');
    });

    it('último día de febrero (28) va al 15 de marzo', () => {
      expect(fmt(calculateNextDate(d(2025, 2, 28), PaymentFrequency.QUINCENAL))).toBe('2025-03-15');
    });
  });

  describe('MENSUAL', () => {
    it('del día 10 va al 10 del mes siguiente', () => {
      expect(fmt(calculateNextDate(d(2025, 1, 10), PaymentFrequency.MENSUAL))).toBe('2025-02-10');
    });

    it('del día 31 de enero va al último día de febrero (28)', () => {
      expect(fmt(calculateNextDate(d(2025, 1, 31), PaymentFrequency.MENSUAL))).toBe('2025-02-28');
    });

    it('del día 30 de enero va al 28 de febrero (año no bisiesto)', () => {
      expect(fmt(calculateNextDate(d(2025, 1, 30), PaymentFrequency.MENSUAL))).toBe('2025-02-28');
    });

    it('del día 29 de enero va al 28 de febrero (año no bisiesto)', () => {
      expect(fmt(calculateNextDate(d(2025, 1, 29), PaymentFrequency.MENSUAL))).toBe('2025-02-28');
    });

    it('del día 29 de enero va al 29 de febrero en año bisiesto (2024)', () => {
      expect(fmt(calculateNextDate(d(2024, 1, 29), PaymentFrequency.MENSUAL))).toBe('2024-02-29');
    });

    it('del 15 de diciembre va al 15 de enero (cambio de año)', () => {
      expect(fmt(calculateNextDate(d(2025, 12, 15), PaymentFrequency.MENSUAL))).toBe('2026-01-15');
    });
  });
});

// ---------------------------------------------------------------------------
// calcularCuotas
// ---------------------------------------------------------------------------
describe('calcularCuotas', () => {
  it('la suma de capitales es exactamente igual al capital total', () => {
    // precio 10000, inicial 1000 → capital 9000 en 12 cuotas
    const cuotas = calcularCuotas(10000, 1000, 12, 0);
    const sumaCapital = cuotas.reduce((s, c) => s + c.capital, 0);
    expect(Math.round(sumaCapital * 100) / 100).toBe(9000);
  });

  it('sin comisión el total de cada cuota es igual al capital', () => {
    const cuotas = calcularCuotas(1000, 100, 3, 0);
    cuotas.forEach((c) => expect(c.comision).toBe(0));
    cuotas.forEach((c) => expect(c.total).toBe(c.capital));
  });

  it('calcula comisión correctamente sobre cada cuota', () => {
    // capital 900 en 3 cuotas → 300 c/u, comisión 10% → 30 c/u, total 330
    const cuotas = calcularCuotas(1000, 100, 3, 10);
    cuotas.forEach((c) => {
      expect(c.comision).toBeCloseTo(c.capital * 0.1, 2);
      expect(c.total).toBeCloseTo(c.capital * 1.1, 2);
    });
  });

  it('la última cuota absorbe el centavo de redondeo', () => {
    // 1000 en 3 → 333.33 + 333.33 + 333.34
    const cuotas = calcularCuotas(1100, 100, 3, 0);
    const suma = cuotas.reduce((s, c) => s + c.capital, 0);
    expect(Math.round(suma * 100) / 100).toBe(1000);
  });

  it('genera el número correcto de cuotas', () => {
    const cuotas = calcularCuotas(5000, 500, 6, 5);
    expect(cuotas).toHaveLength(6);
    cuotas.forEach((c, i) => expect(c.numeroCuota).toBe(i + 1));
  });

  it('caso real: precio 15000, inicial 3000, 12 cuotas, comisión 8%', () => {
    const cuotas = calcularCuotas(15000, 3000, 12, 8);
    const sumaCapital = cuotas.reduce((s, c) => s + c.capital, 0);
    expect(Math.round(sumaCapital * 100) / 100).toBe(12000);
    cuotas.forEach((c) => {
      expect(c.total).toBeGreaterThan(0);
      expect(c.comision).toBeGreaterThan(0);
    });
  });
});

// ---------------------------------------------------------------------------
// aplicarCascadePago
// ---------------------------------------------------------------------------
describe('aplicarCascadePago', () => {
  const cuotaPendiente = (saldo: number, montoPagado = 0): CuotaSimple => ({
    saldo,
    montoPagado,
    estado: ScheduleStatus.PENDIENTE,
  });

  const cuotaVencida = (saldo: number, montoPagado = 0): CuotaSimple => ({
    saldo,
    montoPagado,
    estado: ScheduleStatus.VENCIDA,
  });

  it('pago exacto a una cuota la marca como PAGADA y saldo 0', () => {
    const cuotas = [cuotaPendiente(500)];
    const resultado = aplicarCascadePago(cuotas, 500);
    expect(resultado[0].estado).toBe(ScheduleStatus.PAGADA);
    expect(resultado[0].saldo).toBe(0);
    expect(resultado[0].montoPagado).toBe(500);
  });

  it('pago parcial deja la cuota pendiente con saldo reducido', () => {
    const cuotas = [cuotaPendiente(500)];
    const resultado = aplicarCascadePago(cuotas, 300);
    expect(resultado[0].estado).toBe(ScheduleStatus.PENDIENTE);
    expect(resultado[0].saldo).toBe(200);
    expect(resultado[0].montoPagado).toBe(300);
  });

  it('pago con excedente cancela primera cuota y abona el resto a la siguiente', () => {
    const cuotas = [cuotaPendiente(500), cuotaPendiente(500)];
    const resultado = aplicarCascadePago(cuotas, 700);
    expect(resultado[0].estado).toBe(ScheduleStatus.PAGADA);
    expect(resultado[0].saldo).toBe(0);
    expect(resultado[1].estado).toBe(ScheduleStatus.PENDIENTE);
    expect(resultado[1].saldo).toBe(300);
    expect(resultado[1].montoPagado).toBe(200);
  });

  it('pago que cubre todas las cuotas marca todas como PAGADAS', () => {
    const cuotas = [cuotaPendiente(300), cuotaPendiente(300), cuotaPendiente(300)];
    const resultado = aplicarCascadePago(cuotas, 900);
    resultado.forEach((c) => {
      expect(c.estado).toBe(ScheduleStatus.PAGADA);
      expect(c.saldo).toBe(0);
    });
  });

  it('también aplica sobre cuotas VENCIDAS', () => {
    const cuotas = [cuotaVencida(400), cuotaPendiente(400)];
    const resultado = aplicarCascadePago(cuotas, 600);
    expect(resultado[0].estado).toBe(ScheduleStatus.PAGADA);
    expect(resultado[1].saldo).toBe(200);
  });

  it('cuota con pago parcial previo acumula correctamente', () => {
    // Ya se pagaron 100, saldo 400, se abonan 400 más → pagada
    const cuotas = [cuotaPendiente(400, 100)];
    const resultado = aplicarCascadePago(cuotas, 400);
    expect(resultado[0].estado).toBe(ScheduleStatus.PAGADA);
    expect(resultado[0].montoPagado).toBe(500);
  });

  it('no modifica cuotas que quedan fuera del monto disponible', () => {
    const cuotas = [cuotaPendiente(500), cuotaPendiente(500)];
    const resultado = aplicarCascadePago(cuotas, 300);
    expect(resultado[1].saldo).toBe(500);
    expect(resultado[1].montoPagado).toBe(0);
    expect(resultado[1].estado).toBe(ScheduleStatus.PENDIENTE);
  });

  it('no modifica el array original (inmutabilidad)', () => {
    const cuotas = [cuotaPendiente(500)];
    aplicarCascadePago(cuotas, 500);
    expect(cuotas[0].estado).toBe(ScheduleStatus.PENDIENTE);
    expect(cuotas[0].saldo).toBe(500);
  });
});
