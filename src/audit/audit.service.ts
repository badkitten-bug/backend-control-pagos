import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog, AuditAction } from './audit-log.entity';

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog)
    private auditRepository: Repository<AuditLog>,
  ) {}

  async log(
    entidad: string,
    entidadId: number,
    accion: AuditAction,
    usuarioId: number,
    usuarioNombre: string,
    datosAnteriores?: any,
    datosNuevos?: any,
    descripcion?: string,
  ): Promise<AuditLog> {
    const auditData: Partial<AuditLog> = {
      entidad,
      entidadId,
      accion,
      usuarioId,
      usuarioNombre,
      datosAnteriores: datosAnteriores ? JSON.stringify(datosAnteriores) : undefined,
      datosNuevos: datosNuevos ? JSON.stringify(datosNuevos) : undefined,
      descripcion,
    };

    const audit = this.auditRepository.create(auditData);
    return this.auditRepository.save(audit);
  }

  async getByEntity(entidad: string, entidadId: number): Promise<AuditLog[]> {
    return this.auditRepository.find({
      where: { entidad, entidadId },
      order: { createdAt: 'DESC' },
    });
  }

  async getRecent(limit: number = 50): Promise<AuditLog[]> {
    return this.auditRepository.find({
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async getByUser(usuarioId: number, limit: number = 50): Promise<AuditLog[]> {
    return this.auditRepository.find({
      where: { usuarioId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }
}
