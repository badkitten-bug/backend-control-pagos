import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, MoreThanOrEqual, LessThanOrEqual } from 'typeorm';
import { Payment, PaymentType } from './payment.entity';
import { CreatePaymentDto, SearchPaymentsDto } from './dto/payment.dto';
import { ContractsService } from '../contracts/contracts.service';
import { PaymentSchedulesService } from '../payment-schedules/payment-schedules.service';
import { User } from '../users/user.entity';

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

    const tipoStr = String(dto.tipo);
    console.log('=== PAYMENT CREATE ===');
    console.log('Tipo:', tipoStr);
    console.log('Importe:', dto.importe);
    console.log('ContractId:', dto.contractId);

    const payment = this.paymentRepository.create({
      ...dto,
      usuarioId: user.id,
      usuarioNombre: `${user.nombre} ${user.apellido || ''}`.trim(),
    });

    const savedPayment = await this.paymentRepository.save(payment);

    // If it's an initial payment, mark contract
    if (tipoStr === 'Pago Inicial') {
      console.log('>>> Marking initial payment');
      await this.contractsService.markInitialPaymentRegistered(dto.contractId);
    }

    // For installment payments, use cascade logic
    if (tipoStr === 'Cuota') {
      console.log('>>> Applying CASCADE payment for:', dto.importe);
      const affected = await this.schedulesService.applyCascadePayment(dto.contractId, dto.importe);
      console.log('>>> Affected schedules:', affected.length);
      affected.forEach(s => {
        console.log(`   Cuota ${s.numeroCuota}: saldo=${s.saldo}, estado=${s.estado}`);
      });
    } else {
      console.log('>>> NOT applying cascade, tipo is:', tipoStr);
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

