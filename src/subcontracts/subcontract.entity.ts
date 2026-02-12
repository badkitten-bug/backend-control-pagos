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
import { Contract } from '../contracts/contract.entity';

export enum SubcontractMode {
  INDEPENDIENTE = 'Independiente',
  AGREGAR_A_CUOTAS = 'AgregarACuotas',
}

export enum SubcontractStatus {
  VIGENTE = 'Vigente',
  CANCELADO = 'Cancelado',
  ANULADO = 'Anulado',
}

@Entity('subcontracts')
export class Subcontract {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  parentContractId: number;

  @ManyToOne(() => Contract)
  @JoinColumn({ name: 'parentContractId' })
  parentContract: Contract;

  @Column({ type: 'text' })
  tipo: string; // Texto libre: Reparación, Accesorios, Pintura, etc.

  @Column({ type: 'text' })
  modalidad: SubcontractMode;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  monto: number;

  @Column({ type: 'integer', nullable: true })
  numeroCuotas: number; // Solo para modalidad independiente

  @Column({ type: 'text', nullable: true })
  frecuencia: string; // Solo para modalidad independiente

  @Column({ type: 'date' })
  fechaInicio: Date;

  @Column({ type: 'text', nullable: true })
  descripcion: string;

  @Column({ type: 'text', default: SubcontractStatus.VIGENTE })
  estado: SubcontractStatus;

  @OneToMany(
    () => SubcontractSchedule,
    (schedule) => schedule.subcontract,
  )
  cronograma: SubcontractSchedule[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity('subcontract_schedules')
export class SubcontractSchedule {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  subcontractId: number;

  @ManyToOne(() => Subcontract, (subcontract) => subcontract.cronograma)
  @JoinColumn({ name: 'subcontractId' })
  subcontract: Subcontract;

  @Column({ type: 'integer' })
  numeroCuota: number;

  @Column({ type: 'date' })
  fechaVencimiento: Date;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  monto: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  montoPagado: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  saldo: number;

  @Column({ type: 'text', default: 'Pendiente' })
  estado: string;

  @CreateDateColumn()
  createdAt: Date;
}
