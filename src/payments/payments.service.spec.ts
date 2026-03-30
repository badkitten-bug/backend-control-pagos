/**
 * QA: PaymentsService — date filter & totalImporte
 *
 * These tests guard the two bugs that were found in production:
 *   1. Date filter: payments registered on a given date must appear when
 *      querying by that date (timezone-safe).
 *   2. totalImporte must reflect the sum of ALL matching payments,
 *      not just the current page.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Payment } from './payment.entity';
import { PaymentsService } from './payments.service';
import { ContractsService } from '../contracts/contracts.service';
import { PaymentSchedulesService } from '../payment-schedules/payment-schedules.service';
import { ContractStatus } from '../contracts/contract.entity';

// Minimal payment factory
const makePayment = (id: number, fechaPago: string, importe: number): Payment =>
  ({
    id,
    contractId: 1,
    tipo: 'Cuota',
    importe,
    fechaPago: fechaPago as any,
    medioPago: 'Efectivo',
    usuarioId: 1,
    usuarioNombre: 'Test User',
    createdAt: new Date('2026-03-29T12:00:00'),
    contract: { estado: ContractStatus.VIGENTE } as any,
  }) as Payment;

// Mock para el queryBuilder principal (lista paginada)
const buildMainQbMock = (payments: Payment[]) => ({
  leftJoinAndSelect: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  getCount: jest.fn().mockResolvedValue(payments.length),
  skip: jest.fn().mockReturnThis(),
  take: jest.fn().mockReturnThis(),
  getMany: jest.fn().mockResolvedValue(payments),
});

// Mock para el queryBuilder de suma (SUM independiente, sin ORDER BY)
const buildSumQbMock = (sumValue: number) => ({
  leftJoin: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  getRawOne: jest.fn().mockResolvedValue({ totalImporte: sumValue }),
});

// createQueryBuilder es llamado 2 veces: primero para lista, luego para SUM
const buildRepoMock = (payments: Payment[], sumValue: number) => {
  const mainQb = buildMainQbMock(payments);
  const sumQb = buildSumQbMock(sumValue);
  let callCount = 0;
  return {
    mainQb,
    sumQb,
    repo: {
      createQueryBuilder: jest.fn().mockImplementation(() => {
        callCount++;
        return callCount === 1 ? mainQb : sumQb;
      }),
    },
  };
};

describe('PaymentsService.findAll', () => {
  let service: PaymentsService;
  let paymentRepo: { createQueryBuilder: jest.Mock };

  beforeEach(async () => {
    paymentRepo = { createQueryBuilder: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: getRepositoryToken(Payment), useValue: paymentRepo },
        { provide: ContractsService, useValue: {} },
        { provide: PaymentSchedulesService, useValue: {} },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
  });

  // Helper to wire repo mock for each test
  const setup = (payments: Payment[], sumValue: number) => {
    const { mainQb, sumQb, repo } = buildRepoMock(payments, sumValue);
    paymentRepo.createQueryBuilder = repo.createQueryBuilder;
    return { mainQb, sumQb };
  };

  describe('date filter (bug: pagos de hoy aparecían en "ayer")', () => {
    it('applies fechaDesde filter on main query', async () => {
      const { mainQb } = setup([], 0);

      await service.findAll({ fechaDesde: '2026-03-29' });

      const whereCalls = mainQb.andWhere.mock.calls.map((c: [string, ...unknown[]]) => c[0]);
      expect(whereCalls).toContain('payment.fechaPago >= :fechaDesde');
    });

    it('applies fechaDesde filter on SUM query', async () => {
      const { sumQb } = setup([], 0);

      await service.findAll({ fechaDesde: '2026-03-29' });

      const whereCalls = sumQb.andWhere.mock.calls.map((c: [string, ...unknown[]]) => c[0]);
      expect(whereCalls).toContain('payment.fechaPago >= :fechaDesde');
    });

    it('applies fechaHasta filter on main query', async () => {
      const { mainQb } = setup([], 0);

      await service.findAll({ fechaHasta: '2026-03-29' });

      const whereCalls = mainQb.andWhere.mock.calls.map((c: [string, ...unknown[]]) => c[0]);
      expect(whereCalls).toContain('payment.fechaPago <= :fechaHasta');
    });

    it('does NOT add date conditions when filters are absent', async () => {
      const { mainQb, sumQb } = setup([], 0);

      await service.findAll({});

      const mainWhere = mainQb.andWhere.mock.calls.map((c: [string, ...unknown[]]) => c[0]);
      const sumWhere = sumQb.andWhere.mock.calls.map((c: [string, ...unknown[]]) => c[0]);
      expect(mainWhere).not.toContain('payment.fechaPago >= :fechaDesde');
      expect(mainWhere).not.toContain('payment.fechaPago <= :fechaHasta');
      expect(sumWhere).not.toContain('payment.fechaPago >= :fechaDesde');
      expect(sumWhere).not.toContain('payment.fechaPago <= :fechaHasta');
    });
  });

  describe('totalImporte (bug: total solo sumaba página actual)', () => {
    it('returns totalImporte from server-side SUM, not client sum of items', async () => {
      const page1Payments = [
        makePayment(1, '2026-03-29', 100),
        makePayment(2, '2026-03-29', 200),
      ];
      const serverSideSum = 600; // incluye pago de página 2 (300)
      setup(page1Payments, serverSideSum);

      const result = await service.findAll({
        page: 1,
        limit: 2,
        fechaDesde: '2026-03-29',
        fechaHasta: '2026-03-29',
      });

      expect(result.totalImporte).toBe(600);
      expect(result.items).toHaveLength(2);
      const pageSum = result.items.reduce((s, p) => s + Number(p.importe), 0);
      expect(pageSum).toBe(300);
      expect(result.totalImporte).not.toBe(pageSum);
    });

    it('returns 0 when there are no payments for the period', async () => {
      setup([], 0);

      const result = await service.findAll({
        fechaDesde: '2026-01-01',
        fechaHasta: '2026-01-01',
      });

      expect(result.totalImporte).toBe(0);
      expect(result.total).toBe(0);
    });

    it('excludes ANULADO contracts from both queries', async () => {
      const { mainQb, sumQb } = setup([], 0);

      await service.findAll({});

      const mainWhere = mainQb.andWhere.mock.calls.map((c: [string, ...unknown[]]) => c[0]);
      const sumWhere = sumQb.andWhere.mock.calls.map((c: [string, ...unknown[]]) => c[0]);
      expect(mainWhere).toContain('contract.estado != :estadoAnulado');
      expect(sumWhere).toContain('contract.estado != :estadoAnulado');
    });
  });

  describe('pagination metadata', () => {
    it('calculates totalPages correctly', async () => {
      const { mainQb } = setup([], 0);
      mainQb.getCount.mockResolvedValue(25);

      const result = await service.findAll({ page: 1, limit: 10 });

      expect(result.totalPages).toBe(3);
      expect(result.total).toBe(25);
    });
  });
});
