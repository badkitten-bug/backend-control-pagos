import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual } from 'typeorm';
import { Payment } from './payment.entity';
import { CreatePaymentDto, SearchPaymentsDto } from './dto/payment.dto';
import { ContractsService } from '../contracts/contracts.service';
import { PaymentSchedulesService } from '../payment-schedules/payment-schedules.service';
import { User } from '../users/user.entity';
import { ContractStatus } from '../contracts/contract.entity';

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(Payment)
    private paymentRepository: Repository<Payment>,
    private contractsService: ContractsService,
    private schedulesService: PaymentSchedulesService,
  ) {}

  async create(dto: CreatePaymentDto, user: User): Promise<Payment> {
    const contract = await this.contractsService.findById(dto.contractId);

    // Prevent double submission idempotency check
    // Look for same payment made in last 5 seconds
    const fiveSecondsAgo = new Date();
    fiveSecondsAgo.setSeconds(fiveSecondsAgo.getSeconds() - 5);

    const recentDuplicate = await this.paymentRepository.findOne({
      where: {
        contractId: dto.contractId,
        tipo: dto.tipo,
        importe: dto.importe,
        usuarioId: user.id,
        createdAt: MoreThanOrEqual(fiveSecondsAgo),
      },
    });

    if (recentDuplicate) {
      throw new BadRequestException(
        'Un pago idéntico fue registrado hace unos segundos. Por favor, actualice la página.',
      );
    }

    const tipoStr = String(dto.tipo);

    // El Pago Inicial se puede registrar en Borrador (es requisito antes de activar).
    // Cualquier otro tipo de pago solo está permitido en contratos Vigentes.
    const estadoValido =
      contract.estado === ContractStatus.VIGENTE ||
      (tipoStr === 'Pago Inicial' && contract.estado === ContractStatus.BORRADOR);

    if (!estadoValido) {
      throw new BadRequestException(
        `No se pueden registrar pagos en un contrato con estado "${contract.estado}"`,
      );
    }

    // Verificar pago inicial ANTES de guardar para evitar duplicados por race condition
    if (tipoStr === 'Pago Inicial') {
      if (contract.pagoInicialRegistrado) {
        throw new BadRequestException(
          'El pago inicial ya fue registrado para este contrato',
        );
      }
    }

    const payment = this.paymentRepository.create({
      ...dto,
      usuarioId: user.id,
      usuarioNombre: `${user.nombre} ${user.apellido || ''}`.trim(),
    });

    const savedPayment = await this.paymentRepository.save(payment);

    if (tipoStr === 'Pago Inicial') {
      await this.contractsService.markInitialPaymentRegistered(dto.contractId);
    }

    // For installment payments, use cascade logic
    if (tipoStr === 'Cuota') {
      await this.schedulesService.applyCascadePayment(
        dto.contractId,
        dto.importe,
      );
    }

    return savedPayment;
  }

  async findAll(dto: SearchPaymentsDto) {
    const { page = 1, limit = 10, contractId, fechaDesde, fechaHasta } = dto;

    const queryBuilder = this.paymentRepository
      .createQueryBuilder('payment')
      .leftJoinAndSelect('payment.contract', 'contract')
      .leftJoinAndSelect('contract.vehicle', 'vehicle')
      .orderBy('payment.createdAt', 'DESC');

    if (contractId) {
      queryBuilder.andWhere('payment.contractId = :contractId', { contractId });
    }

    if (fechaDesde) {
      queryBuilder.andWhere('payment.fechaPago >= :fechaDesde', { fechaDesde });
    }

    if (fechaHasta) {
      queryBuilder.andWhere('payment.fechaPago <= :fechaHasta', { fechaHasta });
    }

    // Excluir pagos de contratos anulados en el listado/caja
    queryBuilder.andWhere('contract.estado != :estadoAnulado', {
      estadoAnulado: ContractStatus.ANULADO,
    });

    // Suma total del período completo (todos los registros, sin paginación)
    const sumResult = await queryBuilder
      .clone()
      .select('SUM(payment.importe)', 'totalImporte')
      .getRawOne();

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
      totalImporte: parseFloat(sumResult?.totalImporte || 0),
    };
  }

  async findByContract(contractId: number): Promise<Payment[]> {
    return this.paymentRepository.find({
      where: { contractId },
      order: { createdAt: 'DESC' },
    });
  }

  async getTotalByContract(contractId: number): Promise<number> {
    const result = await this.paymentRepository
      .createQueryBuilder('payment')
      .select('SUM(payment.importe)', 'total')
      .where('payment.contractId = :contractId', { contractId })
      .getRawOne();

    return parseFloat(result?.total || 0);
  }

  async getLastPayment(contractId: number): Promise<Payment | null> {
    return this.paymentRepository.findOne({
      where: { contractId },
      order: { fechaPago: 'DESC' },
    });
  }

  async findById(id: number): Promise<Payment | null> {
    return this.paymentRepository.findOne({
      where: { id },
      relations: ['contract', 'contract.vehicle'],
    });
  }
}
