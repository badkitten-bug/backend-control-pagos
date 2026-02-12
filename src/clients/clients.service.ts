import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, ILike } from 'typeorm';
import { Client } from './client.entity';
import { CreateClientDto, UpdateClientDto, SearchClientDto } from './dto/client.dto';

@Injectable()
export class ClientsService {
  constructor(
    @InjectRepository(Client)
    private clientRepository: Repository<Client>,
  ) {}

  async create(dto: CreateClientDto): Promise<Client> {
    // Check if DNI already exists
    const existing = await this.clientRepository.findOne({ where: { dni: dto.dni } });
    if (existing) {
      throw new BadRequestException('Ya existe un cliente con este DNI');
    }

    const client = this.clientRepository.create(dto);
    return this.clientRepository.save(client);
  }

  async findAll(dto?: SearchClientDto): Promise<Client[]> {
    const queryBuilder = this.clientRepository.createQueryBuilder('client');

    if (dto?.search) {
      queryBuilder.where(
        '(client.dni LIKE :search OR client.nombres LIKE :search OR client.apellidos LIKE :search OR client.telefono LIKE :search)',
        { search: `%${dto.search}%` }
      );
    }

    if (dto?.activo !== undefined) {
      queryBuilder.andWhere('client.activo = :activo', { activo: dto.activo });
    }

    return queryBuilder.orderBy('client.apellidos', 'ASC').getMany();
  }

  async findById(id: number): Promise<Client> {
    const client = await this.clientRepository.findOne({ where: { id } });
    if (!client) {
      throw new NotFoundException('Cliente no encontrado');
    }
    return client;
  }

  async findByDni(dni: string): Promise<Client | null> {
    return this.clientRepository.findOne({ where: { dni } });
  }

  async update(id: number, dto: UpdateClientDto): Promise<Client> {
    const client = await this.findById(id);
    Object.assign(client, dto);
    return this.clientRepository.save(client);
  }

  async delete(id: number): Promise<void> {
    const client = await this.findById(id);
    // Soft delete - just mark as inactive
    client.activo = false;
    await this.clientRepository.save(client);
  }

  async getActiveClients(): Promise<Client[]> {
    return this.clientRepository.find({
      where: { activo: true },
      order: { apellidos: 'ASC' },
    });
  }
}
