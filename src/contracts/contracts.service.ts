import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, FindOptionsWhere } from 'typeorm';
import { Contract, ContractStatus } from './contract.entity';
import { CreateContractDto, UpdateContractDto, SearchContractsDto } from './dto/contract.dto';
import { VehiclesService } from '../vehicles/vehicles.service';
import { PaymentSchedulesService } from '../payment-schedules/payment-schedules.service';
import { VehicleStatus } from '../vehicles/vehicle.entity';

@Injectable()
export class ContractsService {
  constructor(
    @InjectRepository(Contract)
    private contractRepository: Repository<Contract>,
    private vehiclesService: VehiclesService,
    private schedulesService: PaymentSchedulesService,
  ) {}

  async create(dto: CreateContractDto): Promise<Contract> {
    // Validate vehicle is available
    const vehicle = await this.vehiclesService.findById(dto.vehicleId);
    
    if (vehicle.estado !== VehicleStatus.DISPONIBLE) {
      throw new BadRequestException(
        'Solo se puede crear contrato para vehículos disponibles',
      );
    }

    // Validate payment amounts
    if (dto.pagoInicial > dto.precio) {
      throw new BadRequestException(
        'El pago inicial no puede ser mayor al precio',
      );
    }

    if (dto.numeroCuotas <= 0) {
      throw new BadRequestException(
        'El número de cuotas debe ser mayor a 0',
      );
    }

    const contract = this.contractRepository.create({
      ...dto,
      estado: ContractStatus.BORRADOR,
    });

    const savedContract = await this.contractRepository.save(contract);

    // Generate payment schedule
    await this.schedulesService.generateSchedule(savedContract);

    return this.findById(savedContract.id);
  }

  async findAll(dto: SearchContractsDto) {
    const { page = 1, limit = 10, placa, estado, clienteNombre } = dto;

    const queryBuilder = this.contractRepository
      .createQueryBuilder('contract')
      .leftJoinAndSelect('contract.vehicle', 'vehicle')
      .orderBy('contract.createdAt', 'DESC');

    if (placa) {
      queryBuilder.andWhere('vehicle.placa LIKE :placa', {
        placa: `%${placa.toUpperCase()}%`,
      });
    }

    if (estado) {
      queryBuilder.andWhere('contract.estado = :estado', { estado });
    }

    if (clienteNombre) {
      queryBuilder.andWhere('contract.clienteNombre LIKE :nombre', {
        nombre: `%${clienteNombre}%`,
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

  async findById(id: number): Promise<Contract> {
    const contract = await this.contractRepository.findOne({
      where: { id },
      relations: ['vehicle', 'cronograma', 'pagos'],
    });

    if (!contract) {
      throw new NotFoundException('Contrato no encontrado');
    }

    return contract;
  }

  async findByVehicle(vehicleId: number): Promise<Contract[]> {
    return this.contractRepository.find({
      where: { vehicleId },
      relations: ['vehicle'],
      order: { createdAt: 'DESC' },
    });
  }

  async update(id: number, dto: UpdateContractDto): Promise<Contract> {
    const contract = await this.findById(id);

    if (contract.estado !== ContractStatus.BORRADOR) {
      throw new BadRequestException(
        'Solo se pueden editar contratos en estado Borrador',
      );
    }

    Object.assign(contract, dto);
    return this.contractRepository.save(contract);
  }

  async activate(id: number): Promise<Contract> {
    const contract = await this.findById(id);

    if (contract.estado !== ContractStatus.BORRADOR) {
      throw new BadRequestException(
        'Solo se pueden activar contratos en estado Borrador',
      );
    }

    if (!contract.pagoInicialRegistrado && contract.pagoInicial > 0) {
      throw new BadRequestException(
        'Debe registrar el pago inicial antes de activar el contrato',
      );
    }

    contract.estado = ContractStatus.VIGENTE;
    
    // Update vehicle status
    await this.vehiclesService.updateStatus(
      contract.vehicleId,
      VehicleStatus.VENDIDO,
    );

    return this.contractRepository.save(contract);
  }

  async cancel(id: number): Promise<Contract> {
    const contract = await this.findById(id);

    if (contract.estado !== ContractStatus.VIGENTE) {
      throw new BadRequestException(
        'Solo se pueden cancelar contratos vigentes',
      );
    }

    contract.estado = ContractStatus.CANCELADO;
    return this.contractRepository.save(contract);
  }

  async annul(id: number): Promise<Contract> {
    const contract = await this.findById(id);

    contract.estado = ContractStatus.ANULADO;
    
    // Return vehicle to available
    await this.vehiclesService.updateStatus(
      contract.vehicleId,
      VehicleStatus.DISPONIBLE,
    );

    return this.contractRepository.save(contract);
  }

  async markInitialPaymentRegistered(id: number): Promise<Contract> {
    const contract = await this.findById(id);
    contract.pagoInicialRegistrado = true;
    return this.contractRepository.save(contract);
  }
}
