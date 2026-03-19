import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaymentSchedule, ScheduleStatus } from './payment-schedule.entity';
import { Contract, ContractStatus } from '../contracts/contract.entity';
import { startOfDay } from 'date-fns';
import {
  calculateNextDate,
  calcularCuotas,
  aplicarCascadePago,
} from './schedule.utils';

@Injectable()
export class PaymentSchedulesService {
  constructor(
    @InjectRepository(PaymentSchedule)
    private scheduleRepository: Repository<PaymentSchedule>,
  ) {}

  async generateSchedule(contract: Contract): Promise<PaymentSchedule[]> {
    const precio = parseFloat(contract.precio.toString());
    const pagoInicial = parseFloat(contract.pagoInicial.toString());
    const comisionPorcentaje = parseFloat(
      (contract.comisionPorcentaje || 0).toString(),
    );

    if (precio - pagoInicial <= 0) {
      throw new BadRequestException(
        'El pago inicial no puede ser mayor o igual al precio',
      );
    }

    const cuotas = calcularCuotas(
      precio,
      pagoInicial,
      contract.numeroCuotas,
      comisionPorcentaje,
    );

    const schedules: PaymentSchedule[] = [];
    let fechaActual = startOfDay(new Date(contract.fechaInicio));

    for (const cuota of cuotas) {
      const fechaVencimiento = calculateNextDate(fechaActual, contract.frecuencia);

      schedules.push(
        this.scheduleRepository.create({
          contractId: contract.id,
          numeroCuota: cuota.numeroCuota,
          fechaVencimiento,
          capital: cuota.capital,
          comision: cuota.comision,
          total: cuota.total,
          saldo: cuota.total,
          estado: ScheduleStatus.PENDIENTE,
        }),
      );

      fechaActual = fechaVencimiento;
    }

    return this.scheduleRepository.save(schedules);
  }


  async findByContract(contractId: number): Promise<PaymentSchedule[]> {
    return this.scheduleRepository.find({
      where: { contractId },
      order: { numeroCuota: 'ASC' },
    });
  }

  async findById(id: number): Promise<PaymentSchedule | null> {
    return this.scheduleRepository.findOne({ where: { id } });
  }

  async updateScheduleStatus(
    id: number,
    montoPagado: number,
  ): Promise<PaymentSchedule> {
    const schedule = await this.findById(id);
    if (!schedule) {
      throw new BadRequestException('Cuota no encontrada');
    }

    schedule.montoPagado =
      (parseFloat(schedule.montoPagado.toString()) || 0) + montoPagado;
    schedule.saldo =
      parseFloat(schedule.total.toString()) - schedule.montoPagado;

    if (schedule.saldo <= 0) {
      schedule.saldo = 0;
      schedule.estado = ScheduleStatus.PAGADA;
    }

    return this.scheduleRepository.save(schedule);
  }

  async updateOverdueStatus(): Promise<void> {
    const today = startOfDay(new Date());

    // Solo marcar vencidas cuotas de contratos activos (Vigente).
    // UPDATE no admite JOIN en TypeORM → usamos subquery correlacionada.
    await this.scheduleRepository
      .createQueryBuilder()
      .update(PaymentSchedule)
      .set({ estado: ScheduleStatus.VENCIDA })
      .where('estado = :pendiente', { pendiente: ScheduleStatus.PENDIENTE })
      .andWhere('fechaVencimiento < :today', { today })
      .andWhere(
        `contractId IN (
          SELECT id FROM contracts WHERE estado = :vigente
        )`,
        { vigente: ContractStatus.VIGENTE },
      )
      .execute();
  }

  async getOverdueByContract(contractId: number): Promise<PaymentSchedule[]> {
    const today = startOfDay(new Date());

    return this.scheduleRepository
      .createQueryBuilder('schedule')
      .where('schedule.contractId = :contractId', { contractId })
      .andWhere('schedule.estado != :paid', { paid: ScheduleStatus.PAGADA })
      .andWhere('schedule.fechaVencimiento < :today', { today })
      .orderBy('schedule.fechaVencimiento', 'ASC')
      .getMany();
  }

  async getNextPending(contractId: number): Promise<PaymentSchedule | null> {
    // Incluye tanto PENDIENTE como VENCIDA para no perder cuotas atrasadas
    return this.scheduleRepository
      .createQueryBuilder('schedule')
      .where('schedule.contractId = :contractId', { contractId })
      .andWhere('schedule.estado IN (:...estados)', {
        estados: [ScheduleStatus.PENDIENTE, ScheduleStatus.VENCIDA],
      })
      .orderBy('schedule.numeroCuota', 'ASC')
      .getOne();
  }

  /**
   * Apply payment in cascade to pending installments.
   * If payment exceeds one installment, the excess is applied to the next.
   * Returns the list of affected schedules.
   */
  async applyCascadePayment(
    contractId: number,
    monto: number,
  ): Promise<PaymentSchedule[]> {
    // Get all unpaid schedules ordered by due date
    const pendingSchedules = await this.scheduleRepository.find({
      where: [
        { contractId, estado: ScheduleStatus.PENDIENTE },
        { contractId, estado: ScheduleStatus.VENCIDA },
      ],
      order: { numeroCuota: 'ASC' },
    });

    if (pendingSchedules.length === 0) {
      return [];
    }

    const resultados = aplicarCascadePago(pendingSchedules, monto);
    const afectadas: PaymentSchedule[] = [];

    for (let i = 0; i < pendingSchedules.length; i++) {
      const antes = parseFloat(pendingSchedules[i].saldo.toString());
      const despues = resultados[i].saldo;
      if (despues !== antes) {
        Object.assign(pendingSchedules[i], resultados[i]);
        afectadas.push(pendingSchedules[i]);
      }
    }

    await this.scheduleRepository.save(afectadas);
    return afectadas;
  }

  /**
   * Get total pending balance for a contract
   */
  async getTotalPendingBalance(contractId: number): Promise<number> {
    const result = await this.scheduleRepository
      .createQueryBuilder('schedule')
      .select('SUM(schedule.saldo)', 'total')
      .where('schedule.contractId = :contractId', { contractId })
      .andWhere('schedule.estado != :paid', { paid: ScheduleStatus.PAGADA })
      .getRawOne();

    return parseFloat(result?.total || 0);
  }

  /**
   * Save multiple schedules at once (used by SubcontractsService)
   */
  async saveSchedules(
    schedules: PaymentSchedule[],
  ): Promise<PaymentSchedule[]> {
    return this.scheduleRepository.save(schedules);
  }

  /**
   * Delete all schedules for a contract (used when regenerating)
   */
  async deleteByContract(contractId: number): Promise<void> {
    await this.scheduleRepository.delete({ contractId });
  }

  /**
   * Recalcula las fechas de las cuotas PENDIENTES y VENCIDAS de un contrato,
   * manteniendo intactas las cuotas ya PAGADAS. Útil para corregir cronogramas
   * generados con bugs anteriores.
   */
  async rebuildPendingSchedule(contract: Contract): Promise<PaymentSchedule[]> {
    const all = await this.scheduleRepository.find({
      where: { contractId: contract.id },
      order: { numeroCuota: 'ASC' },
    });

    const paid = all.filter((s) => s.estado === ScheduleStatus.PAGADA);
    const pending = all.filter((s) => s.estado !== ScheduleStatus.PAGADA);

    if (pending.length === 0) return paid;

    // Punto de partida: fecha de la última cuota pagada o fechaInicio del contrato
    const lastPaid = paid[paid.length - 1];
    let fechaActual = lastPaid
      ? startOfDay(new Date(lastPaid.fechaVencimiento))
      : startOfDay(new Date(contract.fechaInicio));

    for (const cuota of pending) {
      const nuevaFecha = calculateNextDate(fechaActual, contract.frecuencia);
      cuota.fechaVencimiento = nuevaFecha;
      fechaActual = nuevaFecha;
    }

    await this.scheduleRepository.save(pending);
    return [...paid, ...pending];
  }
}
