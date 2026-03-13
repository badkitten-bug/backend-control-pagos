import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Contract, ContractStatus, PaymentFrequency } from './contract.entity';
import {
  CreateContractDto,
  UpdateContractDto,
  SearchContractsDto,
} from './dto/contract.dto';
import { VehiclesService } from '../vehicles/vehicles.service';
import { PaymentSchedulesService } from '../payment-schedules/payment-schedules.service';
import { VehicleStatus } from '../vehicles/vehicle.entity';
import { addMonths, differenceInCalendarDays, startOfDay } from 'date-fns';

@Injectable()
export class ContractsService {
  constructor(
    @InjectRepository(Contract)
    private contractRepository: Repository<Contract>,
    private vehiclesService: VehiclesService,
    private schedulesService: PaymentSchedulesService,
  ) {}

  private calculateTotalCuotas(
    meses: number,
    frecuencia: PaymentFrequency,
    fechaInicio?: string,
  ): number {
    if (meses <= 0) {
      return 0;
    }

    switch (frecuencia) {
      case PaymentFrequency.DIARIO:
        // Opción B: usamos días de calendario reales entre fechaInicio y fechaInicio + meses
        // (incluye fines de semana y respeta meses de 28–31 días).
        {
          const base =
            fechaInicio !== undefined
              ? startOfDay(new Date(fechaInicio))
              : startOfDay(new Date());
          const fin = addMonths(base, meses);
          const dias = differenceInCalendarDays(fin, base);
          return dias;
        }
      case PaymentFrequency.SEMANAL: {
        const base =
          fechaInicio !== undefined
            ? startOfDay(new Date(fechaInicio))
            : startOfDay(new Date());
        const fin = addMonths(base, meses);
        const dias = differenceInCalendarDays(fin, base);
        return Math.round(dias / 7);
      }
      case PaymentFrequency.QUINCENAL:
        return meses * 2;
      case PaymentFrequency.MENSUAL:
        return meses;
      default:
        return meses;
    }
  }

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

    // Check if there is already an active draft for this vehicle
    const existingDraft = await this.contractRepository.findOne({
      where: {
        vehicleId: dto.vehicleId,
        estado: ContractStatus.BORRADOR,
      },
    });

    if (existingDraft) {
      throw new BadRequestException(
        'El vehículo ya tiene un contrato en estado Borrador',
      );
    }

    if (dto.meses <= 0) {
      throw new BadRequestException('El número de meses debe ser mayor a 0');
    }

    // Calculate total cuotas from meses + frecuencia (para diario usa días reales de calendario)
    const numeroCuotas = this.calculateTotalCuotas(
      dto.meses,
      dto.frecuencia,
      dto.fechaInicio,
    );

    // Safety limit: avoid generating extremely large schedules
    //  - Daily: 40 meses ≈ 1040 cuotas
    //  - This limit allows casos reales y evita cronogramas de miles de filas
    const MAX_CUOTAS = 2000;
    if (numeroCuotas > MAX_CUOTAS) {
      throw new BadRequestException(
        `No se puede generar un cronograma con más de ${MAX_CUOTAS} cuotas. ` +
          'Por favor reduce los meses o cambia la frecuencia de pago.',
      );
    }

    const contract = this.contractRepository.create({
      ...dto,
      numeroCuotas,
      estado: ContractStatus.BORRADOR,
    });

    const savedContract = await this.contractRepository.save(contract);

    // Generate payment schedule
    await this.schedulesService.generateSchedule(savedContract);

    return this.findById(savedContract.id);
  }

  async findAll(dto: SearchContractsDto) {
    const {
      page = 1,
      limit = 10,
      placa,
      estado,
      excludeEstado,
      fechaInicioDesde,
      fechaInicioHasta,
      clienteNombre,
    } = dto;

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

    if (excludeEstado) {
      queryBuilder.andWhere('contract.estado != :excludeEstado', { excludeEstado });
    }

    if (clienteNombre) {
      queryBuilder.andWhere('contract.clienteNombre LIKE :nombre', {
        nombre: `%${clienteNombre}%`,
      });
    }

    if (fechaInicioDesde) {
      queryBuilder.andWhere('contract.fechaInicio >= :fechaInicioDesde', {
        fechaInicioDesde,
      });
    }

    if (fechaInicioHasta) {
      queryBuilder.andWhere('contract.fechaInicio <= :fechaInicioHasta', {
        fechaInicioHasta,
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

    // Datos de cliente (nombre, DNI, tel, dirección, observaciones) son editables
    // en cualquier estado activo. Cambios financieros o de plazo solo en Borrador.
    const hasFinancialChange =
      dto.pagoInicial !== undefined ||
      dto.fechaInicio !== undefined ||
      dto.meses !== undefined ||
      dto.frecuencia !== undefined ||
      dto.precio !== undefined ||
      dto.comisionPorcentaje !== undefined;

    if (
      hasFinancialChange &&
      contract.estado !== ContractStatus.BORRADOR
    ) {
      throw new BadRequestException(
        'Los cambios financieros y de plazo solo se pueden realizar en contratos Borrador',
      );
    }

    const pagoInicialChanged =
      dto.pagoInicial !== undefined &&
      parseFloat(dto.pagoInicial.toString()) !==
        parseFloat(contract.pagoInicial.toString());

    const fechaInicioChanged =
      dto.fechaInicio !== undefined &&
      new Date(dto.fechaInicio).getTime() !==
        new Date(contract.fechaInicio).getTime();

    const mesesChanged =
      dto.meses !== undefined && dto.meses !== contract.meses;

    const frecuenciaChanged =
      dto.frecuencia !== undefined && dto.frecuencia !== contract.frecuencia;

    const precioChanged =
      dto.precio !== undefined &&
      parseFloat(dto.precio.toString()) !==
        parseFloat(contract.precio.toString());

    const comisionChanged =
      dto.comisionPorcentaje !== undefined &&
      parseFloat(dto.comisionPorcentaje.toString()) !==
        parseFloat((contract.comisionPorcentaje || 0).toString());

    // Si cambian meses o frecuencia, recalcular numeroCuotas antes de guardar
    if (mesesChanged || frecuenciaChanged || fechaInicioChanged) {
      const nuevaFechaInicio =
        dto.fechaInicio ?? contract.fechaInicio?.toString();
      const nuevosMeses = dto.meses ?? contract.meses;
      const nuevaFrecuencia = dto.frecuencia ?? contract.frecuencia;
      dto = {
        ...dto,
        numeroCuotas: this.calculateTotalCuotas(
          nuevosMeses,
          nuevaFrecuencia,
          nuevaFechaInicio,
        ),
      };
    }

    Object.assign(contract, dto);
    const savedContract = await this.contractRepository.save(contract);

    // Regenerar cronograma si cambia cualquier dato que afecta montos o fechas
    if (
      pagoInicialChanged ||
      fechaInicioChanged ||
      mesesChanged ||
      frecuenciaChanged ||
      precioChanged ||
      comisionChanged
    ) {
      await this.schedulesService.deleteByContract(contract.id);
      await this.schedulesService.generateSchedule(savedContract);
    }

    return this.findById(savedContract.id);
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

    // Liberar vehículo igual que en annul
    await this.vehiclesService.updateStatus(
      contract.vehicleId,
      VehicleStatus.DISPONIBLE,
    );

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

  async rebuildSchedule(id: number): Promise<Contract> {
    const contract = await this.findById(id);
    if (contract.estado === ContractStatus.ANULADO) {
      throw new BadRequestException(
        'No se puede recalcular el cronograma de un contrato anulado',
      );
    }
    await this.schedulesService.rebuildPendingSchedule(contract);
    return contract;
  }
}
