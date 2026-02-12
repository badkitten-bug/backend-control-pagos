import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Vehicle } from './vehicle.entity';

@Entity('vehicle_mileage')
export class VehicleMileage {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  vehicleId: number;

  @ManyToOne(() => Vehicle, (vehicle) => vehicle.historialKilometraje)
  @JoinColumn({ name: 'vehicleId' })
  vehicle: Vehicle;

  @Column({ type: 'integer' })
  kilometrajeAnterior: number;

  @Column({ type: 'integer' })
  kilometrajeNuevo: number;

  @Column()
  usuarioId: number;

  @Column()
  usuarioNombre: string;

  @Column({ nullable: true })
  observacion: string;

  @CreateDateColumn()
  fechaRegistro: Date;
}
