import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cuenta } from './cuenta.entity';
import { CreateCuentaDto, UpdateCuentaDto } from './dto/cuenta.dto';

@Injectable()
export class CuentasService {
  constructor(
    @InjectRepository(Cuenta)
    private cuentaRepository: Repository<Cuenta>,
  ) {}

  async findAll(soloActivas = false): Promise<Cuenta[]> {
    const where = soloActivas ? { activa: true } : {};
    return this.cuentaRepository.find({
      where,
      order: { nombre: 'ASC' },
    });
  }

  async findById(id: number): Promise<Cuenta> {
    const cuenta = await this.cuentaRepository.findOne({ where: { id } });
    if (!cuenta) throw new NotFoundException('Cuenta no encontrada');
    return cuenta;
  }

  async create(dto: CreateCuentaDto): Promise<Cuenta> {
    const cuenta = this.cuentaRepository.create(dto);
    return this.cuentaRepository.save(cuenta);
  }

  async update(id: number, dto: UpdateCuentaDto): Promise<Cuenta> {
    const cuenta = await this.findById(id);
    Object.assign(cuenta, dto);
    return this.cuentaRepository.save(cuenta);
  }
}
