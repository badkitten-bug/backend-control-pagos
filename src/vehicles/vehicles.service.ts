import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, FindOptionsWhere } from 'typeorm';
import { Vehicle, VehicleStatus } from './vehicle.entity';
import { VehicleMileage } from './vehicle-mileage.entity';
import {
  CreateVehicleDto,
  UpdateVehicleDto,
  UpdateMileageDto,
  SearchVehiclesDto,
} from './dto/vehicle.dto';
import { User } from '../users/user.entity';

@Injectable()
export class VehiclesService {
  constructor(
    @InjectRepository(Vehicle)
    private vehicleRepository: Repository<Vehicle>,
    @InjectRepository(VehicleMileage)
    private mileageRepository: Repository<VehicleMileage>,
  ) {}

  async create(dto: CreateVehicleDto): Promise<Vehicle> {
    const existing = await this.vehicleRepository.findOne({
      where: { placa: dto.placa.toUpperCase() },
    });

    if (existing) {
      throw new ConflictException('Placa ya registrada');
    }

    const vehicle = this.vehicleRepository.create({
      ...dto,
      placa: dto.placa.toUpperCase(),
    });

    return this.vehicleRepository.save(vehicle);
  }

  async findAll(dto: SearchVehiclesDto) {
    const { page = 1, limit = 10, placa, marca, modelo, anio, estado } = dto;

    const where: FindOptionsWhere<Vehicle> = {};

    if (placa) {
      where.placa = Like(`%${placa.toUpperCase()}%`);
    }
    if (marca) {
      where.marca = Like(`%${marca}%`);
    }
    if (modelo) {
      where.modelo = Like(`%${modelo}%`);
    }
    if (anio) {
      where.anio = anio;
    }
    if (estado) {
      where.estado = estado;
    }

    const [items, total] = await this.vehicleRepository.findAndCount({
      where,
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findByPlaca(placa: string): Promise<Vehicle> {
    const vehicle = await this.vehicleRepository.findOne({
      where: { placa: placa.toUpperCase() },
      relations: ['historialKilometraje'],
    });

    if (!vehicle) {
      throw new NotFoundException('Vehículo no encontrado');
    }

    return vehicle;
  }

  async findById(id: number): Promise<Vehicle> {
    const vehicle = await this.vehicleRepository.findOne({
      where: { id },
      relations: ['historialKilometraje'],
    });

    if (!vehicle) {
      throw new NotFoundException('Vehículo no encontrado');
    }

    return vehicle;
  }

  async update(id: number, dto: UpdateVehicleDto): Promise<Vehicle> {
    const vehicle = await this.findById(id);

    Object.assign(vehicle, dto);
    return this.vehicleRepository.save(vehicle);
  }

  async updateMileage(
    id: number,
    dto: UpdateMileageDto,
    user: User,
  ): Promise<Vehicle> {
    const vehicle = await this.findById(id);

    if (dto.kilometraje < vehicle.kilometraje) {
      throw new BadRequestException(
        'El nuevo kilometraje no puede ser menor al actual',
      );
    }

    // Create mileage history record
    const mileageRecord = this.mileageRepository.create({
      vehicleId: vehicle.id,
      kilometrajeAnterior: vehicle.kilometraje,
      kilometrajeNuevo: dto.kilometraje,
      usuarioId: user.id,
      usuarioNombre: `${user.nombre} ${user.apellido || ''}`.trim(),
      observacion: dto.observacion,
    });

    await this.mileageRepository.save(mileageRecord);

    // Update vehicle mileage
    vehicle.kilometraje = dto.kilometraje;
    return this.vehicleRepository.save(vehicle);
  }

  async getMileageHistory(id: number): Promise<VehicleMileage[]> {
    return this.mileageRepository.find({
      where: { vehicleId: id },
      order: { fechaRegistro: 'DESC' },
    });
  }

  async findAvailable(): Promise<Vehicle[]> {
    return this.vehicleRepository.find({
      where: { estado: VehicleStatus.DISPONIBLE },
      order: { placa: 'ASC' },
    });
  }

  async isAvailable(id: number): Promise<boolean> {
    const vehicle = await this.findById(id);
    return vehicle.estado === VehicleStatus.DISPONIBLE;
  }

  async updateStatus(id: number, status: VehicleStatus): Promise<Vehicle> {
    const vehicle = await this.findById(id);
    vehicle.estado = status;
    return this.vehicleRepository.save(vehicle);
  }
}
