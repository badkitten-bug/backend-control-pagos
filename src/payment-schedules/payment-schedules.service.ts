import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaymentSchedule, ScheduleStatus } from './payment-schedule.entity';
import { Contract, PaymentFrequency } from '../contracts/contract.entity';
import {
  addDays,
  addWeeks,
  addMonths,
  endOfMonth,
  setDate,
  isAfter,
  isBefore,
  startOfDay,
} from 'date-fns';

@Injectable()
export class PaymentSchedulesService {
  constructor(
    @InjectRepository(PaymentSchedule)
    private scheduleRepository: Repository<PaymentSchedule>,
  ) {}

  async generateSchedule(contract: Contract): Promise<PaymentSchedule[]> {
    // SQLite returns decimal columns as strings, need to parse them
    const precio = parseFloat(contract.precio.toString());
    const pagoInicial = parseFloat(contract.pagoInicial.toString());
    const comisionPorcentaje = parseFloat((contract.comisionPorcentaje || 0).toString());
    const capitalTotal = precio - pagoInicial;
    
    if (capitalTotal <= 0) {
      throw new BadRequestException('El pago inicial no puede ser mayor o igual al precio');
    }

    const cuotaBase = Math.floor((capitalTotal / contract.numeroCuotas) * 100) / 100;
    const ajusteFinal = Math.round((capitalTotal - (cuotaBase * (contract.numeroCuotas - 1))) * 100) / 100;

    const schedules: PaymentSchedule[] = [];
    let fechaActual = new Date(contract.fechaInicio);

    for (let i = 1; i <= contract.numeroCuotas; i++) {
      const fechaVencimiento = this.calculateNextDate(
        fechaActual,
        contract.frecuencia,
        i,
      );

      const capitalCuota = i === contract.numeroCuotas ? ajusteFinal : cuotaBase;
      // Calculate commission on the capital
      const comisionCuota = Math.round((capitalCuota * comisionPorcentaje / 100) * 100) / 100;
      const totalCuota = Math.round((capitalCuota + comisionCuota) * 100) / 100;

      const schedule = this.scheduleRepository.create({
        contractId: contract.id,
        numeroCuota: i,
        fechaVencimiento,
        capital: capitalCuota,
        comision: comisionCuota,
        total: totalCuota,
        saldo: totalCuota,
        estado: ScheduleStatus.PENDIENTE,
      });

      schedules.push(schedule);
      fechaActual = fechaVencimiento;
    }

    return this.scheduleRepository.save(schedules);
  }

  private calculateNextDate(
    baseDate: Date,
    frequency: PaymentFrequency,
    cuotaNumber: number,
  ): Date {
    const startDate = new Date(baseDate);

    switch (frequency) {
      case PaymentFrequency.DIARIO:
        return addDays(startDate, 1);

      case PaymentFrequency.SEMANAL:
        return addWeeks(startDate, 1);

      case PaymentFrequency.QUINCENAL:
        // Day 15 and last day of month
        const currentDay = startDate.getDate();
        if (currentDay < 15) {
          return setDate(startDate, 15);
        } else {
          return endOfMonth(startDate);
        }

      case PaymentFrequency.MENSUAL:
        const nextMonth = addMonths(startDate, 1);
        const targetDay = startDate.getDate();
        const lastDayOfNextMonth = endOfMonth(nextMonth).getDate();
        
        if (targetDay > lastDayOfNextMonth) {
          return endOfMonth(nextMonth);
        }
        return setDate(nextMonth, targetDay);

      default:
        return addMonths(startDate, 1);
    }
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

  async updateScheduleStatus(id: number, montoPagado: number): Promise<PaymentSchedule> {
    const schedule = await this.findById(id);
    if (!schedule) {
      throw new BadRequestException('Cuota no encontrada');
    }

    schedule.montoPagado = (parseFloat(schedule.montoPagado.toString()) || 0) + montoPagado;
    schedule.saldo = parseFloat(schedule.total.toString()) - schedule.montoPagado;

    if (schedule.saldo <= 0) {
      schedule.saldo = 0;
      schedule.estado = ScheduleStatus.PAGADA;
    }

    return this.scheduleRepository.save(schedule);
  }

  async updateOverdueStatus(): Promise<void> {
    const today = startOfDay(new Date());
    
    await this.scheduleRepository
      .createQueryBuilder()
      .update(PaymentSchedule)
      .set({ estado: ScheduleStatus.VENCIDA })
      .where('estado = :estado', { estado: ScheduleStatus.PENDIENTE })
      .andWhere('fechaVencimiento < :today', { today })
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
    return this.scheduleRepository.findOne({
      where: { 
        contractId, 
        estado: ScheduleStatus.PENDIENTE 
      },
      order: { numeroCuota: 'ASC' },
    });
  }

  /**
   * Apply payment in cascade to pending installments.
   * If payment exceeds one installment, the excess is applied to the next.
   * Returns the list of affected schedules.
   */
  async applyCascadePayment(contractId: number, monto: number): Promise<PaymentSchedule[]> {
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

    let remainingAmount = monto;
    const affectedSchedules: PaymentSchedule[] = [];

    for (const schedule of pendingSchedules) {
      if (remainingAmount <= 0) break;

      const saldo = parseFloat(schedule.saldo.toString());
      const montoPagadoActual = parseFloat(schedule.montoPagado?.toString() || '0');

      if (remainingAmount >= saldo) {
        // Pay off this installment completely
        schedule.montoPagado = montoPagadoActual + saldo;
        schedule.saldo = 0;
        schedule.estado = ScheduleStatus.PAGADA;
        remainingAmount -= saldo;
      } else {
        // Partial payment
        schedule.montoPagado = montoPagadoActual + remainingAmount;
        schedule.saldo = Math.round((saldo - remainingAmount) * 100) / 100;
        remainingAmount = 0;
      }

      affectedSchedules.push(schedule);
    }

    // Save all affected schedules
    await this.scheduleRepository.save(affectedSchedules);

    return affectedSchedules;
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
  async saveSchedules(schedules: PaymentSchedule[]): Promise<PaymentSchedule[]> {
    return this.scheduleRepository.save(schedules);
  }
}
