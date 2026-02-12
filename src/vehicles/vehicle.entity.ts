import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { VehicleMileage } from './vehicle-mileage.entity';

export enum VehicleStatus {
  DISPONIBLE = 'Disponible',
  VENDIDO = 'Vendido',
  INACTIVO = 'Inactivo',
}

@Entity('vehicles')
export class Vehicle {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  placa: string;

  @Column()
  marca: string;

  @Column()
  modelo: string;

  @Column()
  anio: number;

  @Column({ nullable: true })
  color: string;

  @Column({ type: 'integer', default: 0 })
  kilometraje: number;

  @Column({ type: 'text', default: VehicleStatus.DISPONIBLE })
  estado: VehicleStatus;

  @Column({ nullable: true })
  observaciones: string;

  @OneToMany(() => VehicleMileage, (mileage) => mileage.vehicle)
  historialKilometraje: VehicleMileage[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
