import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Contract } from '../contracts/contract.entity';
import { PaymentSchedule } from '../payment-schedules/payment-schedule.entity';

export enum PaymentType {
  PAGO_INICIAL = 'Pago Inicial',
  CUOTA = 'Cuota',
  ABONO = 'Abono',
}

export enum PaymentMethod {
  EFECTIVO = 'Efectivo',
  TRANSFERENCIA = 'Transferencia',
  YAPE = 'Yape',
  PLIN = 'Plin',
  TARJETA = 'Tarjeta',
  OTRO = 'Otro',
}

@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  contractId: number;

  @ManyToOne(() => Contract, (contract) => contract.pagos)
  @JoinColumn({ name: 'contractId' })
  contract: Contract;

  @Column({ nullable: true })
  scheduleId: number;

  @ManyToOne(() => PaymentSchedule, { nullable: true })
  @JoinColumn({ name: 'scheduleId' })
  schedule: PaymentSchedule;

  @Column({ type: 'text' })
  tipo: PaymentType;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  importe: number;

  @Column({ type: 'date' })
  fechaPago: Date;

  @Column({ type: 'text' })
  medioPago: PaymentMethod;

  @Column({ nullable: true })
  numeroOperacion: string;

  @Column({ nullable: true })
  voucher: string;

  @Column({ nullable: true })
  notas: string;

  @Column()
  usuarioId: number;

  @Column()
  usuarioNombre: string;

  @CreateDateColumn()
  createdAt: Date;
}
