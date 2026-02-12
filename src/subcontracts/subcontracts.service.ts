import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Subcontract,
  SubcontractSchedule,
  SubcontractMode,
  SubcontractStatus,
} from './subcontract.entity';
import { CreateSubcontractDto, SearchSubcontractsDto } from './dto/subcontract.dto';
import { ContractsService } from '../contracts/contracts.service';
import { PaymentSchedulesService } from '../payment-schedules/payment-schedules.service';
import { ContractStatus, PaymentFrequency } from '../contracts/contract.entity';
import { ScheduleStatus } from '../payment-schedules/payment-schedule.entity';
import { addDays, addWeeks, addMonths, endOfMonth, setDate } from 'date-fns';

@Injectable()
export class SubcontractsService {
  constructor(
    @InjectRepository(Subcontract)
    private subcontractRepository: Repository<Subcontract>,
    @InjectRepository(SubcontractSchedule)
    private scheduleRepository: Repository<SubcontractSchedule>,
    private contractsService: ContractsService,
    private paymentSchedulesService: PaymentSchedulesService,
  ) {}

  async create(dto: CreateSubcontractDto): Promise<Subcontract> {
    // Validar que el contrato padre existe y está vigente
    const parentContract = await this.contractsService.findById(dto.parentContractId);

    if (parentContract.estado !== ContractStatus.VIGENTE) {
      throw new BadRequestException(
        'Solo se pueden agregar subcontratos a contratos vigentes',
      );
    }

    // Validaciones según modalidad
    if (dto.modalidad === SubcontractMode.INDEPENDIENTE) {
      if (!dto.numeroCuotas || dto.numeroCuotas <= 0) {
        throw new BadRequestException(
          'Para subcontratos independientes se requiere el número de cuotas',
        );
      }
      if (!dto.frecuencia) {
        throw new BadRequestException(
          'Para subcontratos independientes se requiere la frecuencia',
        );
      }
    }

    const subcontract = this.subcontractRepository.create({
      ...dto,
      estado: SubcontractStatus.VIGENTE,
    });

    const saved = await this.subcontractRepository.save(subcontract);

    if (dto.modalidad === SubcontractMode.INDEPENDIENTE) {
      // Generar cronograma independiente para el subcontrato
      await this.generateIndependentSchedule(saved);
    } else {
      // Agregar monto a cuotas existentes del contrato padre
      await this.addToPendingSchedules(saved, parentContract);
    }

    return this.findById(saved.id);
  }

  private async generateIndependentSchedule(
    subcontract: Subcontract,
  ): Promise<SubcontractSchedule[]> {
    const monto = parseFloat(subcontract.monto.toString());
    const numeroCuotas = subcontract.numeroCuotas;

    const cuotaBase = Math.floor((monto / numeroCuotas) * 100) / 100;
    const ajusteFinal =
      Math.round((monto - cuotaBase * (numeroCuotas - 1)) * 100) / 100;

    const schedules: SubcontractSchedule[] = [];
    let fechaActual = new Date(subcontract.fechaInicio);

    for (let i = 1; i <= numeroCuotas; i++) {
      const fechaVencimiento = this.calculateNextDate(
        fechaActual,
        subcontract.frecuencia as PaymentFrequency,
        i,
      );

      const montoCuota = i === numeroCuotas ? ajusteFinal : cuotaBase;

      const schedule = this.scheduleRepository.create({
        subcontractId: subcontract.id,
        numeroCuota: i,
        fechaVencimiento,
        monto: montoCuota,
        montoPagado: 0,
        saldo: montoCuota,
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

  private async addToPendingSchedules(
    subcontract: Subcontract,
    parentContract: any,
  ): Promise<void> {
    // Obtener cuotas pendientes del contrato padre
    const allSchedules = await this.paymentSchedulesService.findByContract(
      parentContract.id,
    );
    const pendingSchedules = allSchedules.filter(
      (s) => s.estado !== ScheduleStatus.PAGADA,
    );

    if (pendingSchedules.length === 0) {
      throw new BadRequestException(
        'No hay cuotas pendientes para agregar el monto',
      );
    }

    // Calcular monto extra por cuota
    const montoSubcontrato = parseFloat(subcontract.monto.toString());
    const montoExtraPorCuota =
      Math.round((montoSubcontrato / pendingSchedules.length) * 100) / 100;

    // Ajuste para la última cuota (diferencia por redondeo)
    const totalDistribuido = montoExtraPorCuota * (pendingSchedules.length - 1);
    const montoUltimaCuota =
      Math.round((montoSubcontrato - totalDistribuido) * 100) / 100;

    // Actualizar cada cuota pendiente
    for (let i = 0; i < pendingSchedules.length; i++) {
      const schedule = pendingSchedules[i];
      const montoExtra =
        i === pendingSchedules.length - 1 ? montoUltimaCuota : montoExtraPorCuota;

      // Parsear valores actuales
      const currentTotal = parseFloat(schedule.total.toString());
      const currentSaldo = parseFloat(schedule.saldo.toString());
      const currentMontoSubcontrato = parseFloat(
        (schedule.montoSubcontrato || 0).toString(),
      );

      // Actualizar valores
      schedule.montoSubcontrato = currentMontoSubcontrato + montoExtra;
      schedule.total = Math.round((currentTotal + montoExtra) * 100) / 100;
      schedule.saldo = Math.round((currentSaldo + montoExtra) * 100) / 100;

      // Guardar referencia al subcontrato
      const existingIds = schedule.subcontractIds
        ? JSON.parse(schedule.subcontractIds)
        : [];
      existingIds.push(subcontract.id);
      schedule.subcontractIds = JSON.stringify(existingIds);
    }

    // Guardar todas las cuotas actualizadas
    await this.paymentSchedulesService.saveSchedules(pendingSchedules);
  }

  async findById(id: number): Promise<Subcontract> {
    const subcontract = await this.subcontractRepository.findOne({
      where: { id },
      relations: ['parentContract', 'cronograma', 'parentContract.vehicle'],
    });

    if (!subcontract) {
      throw new NotFoundException('Subcontrato no encontrado');
    }

    return subcontract;
  }

  async findByContract(contractId: number): Promise<Subcontract[]> {
    return this.subcontractRepository.find({
      where: { parentContractId: contractId },
      relations: ['cronograma'],
      order: { createdAt: 'DESC' },
    });
  }

  async findAll(dto: SearchSubcontractsDto) {
    const { page = 1, limit = 10, parentContractId } = dto;

    const queryBuilder = this.subcontractRepository
      .createQueryBuilder('subcontract')
      .leftJoinAndSelect('subcontract.parentContract', 'contract')
      .leftJoinAndSelect('contract.vehicle', 'vehicle')
      .leftJoinAndSelect('subcontract.cronograma', 'cronograma')
      .orderBy('subcontract.createdAt', 'DESC');

    if (parentContractId) {
      queryBuilder.andWhere('subcontract.parentContractId = :parentContractId', {
        parentContractId,
      });
    }

    const total = await queryBuilder.getCount();
    const items = await queryBuilder
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async annul(id: number): Promise<Subcontract> {
    const subcontract = await this.findById(id);

    // Verificar si tiene pagos
    if (subcontract.modalidad === SubcontractMode.INDEPENDIENTE) {
      const hasPayments = subcontract.cronograma?.some(
        (s) => parseFloat(s.montoPagado?.toString() || '0') > 0,
      );
      if (hasPayments) {
        throw new BadRequestException(
          'No se puede anular un subcontrato con pagos registrados',
        );
      }
    }

    subcontract.estado = SubcontractStatus.ANULADO;
    return this.subcontractRepository.save(subcontract);
  }

  async getScheduleById(scheduleId: number): Promise<SubcontractSchedule | null> {
    return this.scheduleRepository.findOne({
      where: { id: scheduleId },
      relations: ['subcontract'],
    });
  }

  async updateSchedulePayment(
    scheduleId: number,
    montoPagado: number,
  ): Promise<SubcontractSchedule> {
    const schedule = await this.getScheduleById(scheduleId);
    if (!schedule) {
      throw new NotFoundException('Cuota de subcontrato no encontrada');
    }

    const currentMontoPagado = parseFloat(schedule.montoPagado?.toString() || '0');
    const monto = parseFloat(schedule.monto.toString());

    schedule.montoPagado = currentMontoPagado + montoPagado;
    schedule.saldo = Math.round((monto - schedule.montoPagado) * 100) / 100;

    if (schedule.saldo <= 0) {
      schedule.saldo = 0;
      schedule.estado = ScheduleStatus.PAGADA;
    }

    return this.scheduleRepository.save(schedule);
  }

  /**
   * Get pending balance for a subcontract (independent mode only)
   */
  async getPendingBalance(subcontractId: number): Promise<number> {
    const result = await this.scheduleRepository
      .createQueryBuilder('schedule')
      .select('SUM(schedule.saldo)', 'total')
      .where('schedule.subcontractId = :subcontractId', { subcontractId })
      .andWhere('schedule.estado != :paid', { paid: ScheduleStatus.PAGADA })
      .getRawOne();

    return parseFloat(result?.total || 0);
  }

  /**
   * Pay a subcontract schedule installment
   */
  async paySchedule(scheduleId: number, dto: any): Promise<SubcontractSchedule> {
    const schedule = await this.getScheduleById(scheduleId);
    if (!schedule) {
      throw new NotFoundException('Cuota de subcontrato no encontrada');
    }

    if (schedule.estado === ScheduleStatus.PAGADA) {
      throw new BadRequestException('Esta cuota ya fue pagada');
    }

    const monto = parseFloat(dto.monto?.toString() || '0');
    if (monto <= 0) {
      throw new BadRequestException('El monto debe ser mayor a 0');
    }

    const currentMontoPagado = parseFloat(schedule.montoPagado?.toString() || '0');
    const montoTotal = parseFloat(schedule.monto.toString());

    schedule.montoPagado = Math.round((currentMontoPagado + monto) * 100) / 100;
    schedule.saldo = Math.round((montoTotal - schedule.montoPagado) * 100) / 100;

    if (schedule.saldo <= 0) {
      schedule.saldo = 0;
      schedule.estado = ScheduleStatus.PAGADA;
    }

    return this.scheduleRepository.save(schedule);
  }
}
