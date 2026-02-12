import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Vehicle } from '../vehicles/vehicle.entity';
import { PaymentSchedule } from '../payment-schedules/payment-schedule.entity';
import { Payment } from '../payments/payment.entity';

export enum ContractStatus {
  BORRADOR = 'Borrador',
  VIGENTE = 'Vigente',
  CANCELADO = 'Cancelado',
  ANULADO = 'Anulado',
}

export enum PaymentFrequency {
  DIARIO = 'Diario',
  SEMANAL = 'Semanal',
  QUINCENAL = 'Quincenal',
  MENSUAL = 'Mensual',
}

@Entity('contracts')
export class Contract {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  vehicleId: number;

  @ManyToOne(() => Vehicle)
  @JoinColumn({ name: 'vehicleId' })
  vehicle: Vehicle;

  @Column({ type: 'date' })
  fechaInicio: Date;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  precio: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  pagoInicial: number;

  @Column({ type: 'integer' })
  numeroCuotas: number;

  @Column({ type: 'text' })
  frecuencia: PaymentFrequency;

  @Column({ type: 'text', default: ContractStatus.BORRADOR })
  estado: ContractStatus;

  @Column({ nullable: true })
  clienteNombre: string;

  @Column({ nullable: true })
  clienteDni: string;

  @Column({ nullable: true })
  clienteTelefono: string;

  @Column({ nullable: true })
  clienteDireccion: string;

  @Column({ nullable: true })
  observaciones: string;

  @Column({ default: false })
  pagoInicialRegistrado: boolean;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  comisionPorcentaje: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  moraPorcentaje: number;

  @OneToMany(() => PaymentSchedule, (schedule) => schedule.contract)
  cronograma: PaymentSchedule[];

  @OneToMany(() => Payment, (payment) => payment.contract)
  pagos: Payment[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
