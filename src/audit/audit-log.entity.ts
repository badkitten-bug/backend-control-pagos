import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

export enum AuditAction {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
}

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  entidad: string; // 'Contract', 'Payment', 'Client', etc.

  @Column()
  entidadId: number;

  @Column({ type: 'text' })
  accion: AuditAction;

  @Column()
  usuarioId: number;

  @Column()
  usuarioNombre: string;

  @Column({ type: 'text', nullable: true })
  datosAnteriores: string; // JSON string

  @Column({ type: 'text', nullable: true })
  datosNuevos: string; // JSON string

  @Column({ nullable: true })
  descripcion: string;

  @CreateDateColumn()
  createdAt: Date;
}
