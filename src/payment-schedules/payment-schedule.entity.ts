import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Contract } from '../contracts/contract.entity';

export enum ScheduleStatus {
  PENDIENTE = 'Pendiente',
  PAGADA = 'Pagada',
  VENCIDA = 'Vencida',
}

@Entity('payment_schedules')
export class PaymentSchedule {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  contractId: number;

  @ManyToOne(() => Contract, (contract) => contract.cronograma)
  @JoinColumn({ name: 'contractId' })
  contract: Contract;

  @Column({ type: 'integer' })
  numeroCuota: number;

  @Column({ type: 'date' })
  fechaVencimiento: Date;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  capital: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  comision: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  total: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  montoPagado: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  saldo: number;

  @Column({ type: 'text', default: ScheduleStatus.PENDIENTE })
  estado: ScheduleStatus;

  // Campos para trazabilidad de subcontratos
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  montoSubcontrato: number;

  @Column({ type: 'text', nullable: true })
  subcontractIds: string; // JSON array de IDs de subcontratos

  @CreateDateColumn()
  createdAt: Date;
}
