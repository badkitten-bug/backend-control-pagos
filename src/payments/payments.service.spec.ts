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

// Helpers to build TypeORM QueryBuilder mock
const buildQueryBuilderMock = (
  payments: Payment[],
  sumValue: number,
) => {
  const qb: any = {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    clone: jest.fn(),
    select: jest.fn().mockReturnThis(),
    getRawOne: jest.fn().mockResolvedValue({ totalImporte: sumValue }),
    getCount: jest.fn().mockResolvedValue(payments.length),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue(payments),
  };

  // clone() returns a fresh stub that only needs select/getRawOne
  const clonedQb: any = {
    select: jest.fn().mockReturnThis(),
    getRawOne: jest.fn().mockResolvedValue({ totalImporte: sumValue }),
  };
  qb.clone.mockReturnValue(clonedQb);

  return qb;
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

  describe('date filter (bug: pagos de hoy aparecían en "ayer")', () => {
    it('applies fechaDesde filter when provided', async () => {
      const qb = buildQueryBuilderMock([], 0);
      paymentRepo.createQueryBuilder.mockReturnValue(qb);

      await service.findAll({ fechaDesde: '2026-03-29' });

      const whereCalls: string[] = qb.andWhere.mock.calls.map(
        (c: any[]) => c[0] as string,
      );
      expect(whereCalls).toContain('payment.fechaPago >= :fechaDesde');
    });

    it('applies fechaHasta filter when provided', async () => {
      const qb = buildQueryBuilderMock([], 0);
      paymentRepo.createQueryBuilder.mockReturnValue(qb);

      await service.findAll({ fechaHasta: '2026-03-29' });

      const whereCalls: string[] = qb.andWhere.mock.calls.map(
        (c: any[]) => c[0] as string,
      );
      expect(whereCalls).toContain('payment.fechaPago <= :fechaHasta');
    });

    it('does NOT add fechaDesde/fechaHasta conditions when filters are absent', async () => {
      const qb = buildQueryBuilderMock([], 0);
      paymentRepo.createQueryBuilder.mockReturnValue(qb);

      await service.findAll({});

      const whereCalls: string[] = qb.andWhere.mock.calls.map(
        (c: any[]) => c[0] as string,
      );
      expect(whereCalls).not.toContain('payment.fechaPago >= :fechaDesde');
      expect(whereCalls).not.toContain('payment.fechaPago <= :fechaHasta');
    });
  });

  describe('totalImporte (bug: total solo sumaba página actual)', () => {
    it('returns totalImporte from server-side SUM, not client sum of items', async () => {
      // 3 payments on page 1 (limit 2), totalImporte covers all 3
      const page1Payments = [
        makePayment(1, '2026-03-29', 100),
        makePayment(2, '2026-03-29', 200),
      ];
      const serverSideSum = 600; // 100 + 200 + 300 (page 2 payment)

      const qb = buildQueryBuilderMock(page1Payments, serverSideSum);
      paymentRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findAll({
        page: 1,
        limit: 2,
        fechaDesde: '2026-03-29',
        fechaHasta: '2026-03-29',
      });

      expect(result.totalImporte).toBe(600);
      expect(result.items).toHaveLength(2);
      // Confirm it's NOT summing items array
      const pageSum = result.items.reduce((s, p) => s + Number(p.importe), 0);
      expect(pageSum).toBe(300); // only page 1 items
      expect(result.totalImporte).not.toBe(pageSum);
    });

    it('returns 0 when there are no payments for the period', async () => {
      const qb = buildQueryBuilderMock([], 0);
      paymentRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findAll({
        fechaDesde: '2026-01-01',
        fechaHasta: '2026-01-01',
      });

      expect(result.totalImporte).toBe(0);
      expect(result.total).toBe(0);
    });

    it('excludes ANULADO contracts from the total', async () => {
      const qb = buildQueryBuilderMock([], 0);
      paymentRepo.createQueryBuilder.mockReturnValue(qb);

      await service.findAll({});

      const whereCalls: string[] = qb.andWhere.mock.calls.map(
        (c: any[]) => c[0] as string,
      );
      expect(whereCalls).toContain('contract.estado != :estadoAnulado');
    });
  });

  describe('pagination metadata', () => {
    it('calculates totalPages correctly', async () => {
      const qb = buildQueryBuilderMock([], 0);
      qb.getCount.mockResolvedValue(25);
      paymentRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findAll({ page: 1, limit: 10 });

      expect(result.totalPages).toBe(3);
      expect(result.total).toBe(25);
    });
  });
});
