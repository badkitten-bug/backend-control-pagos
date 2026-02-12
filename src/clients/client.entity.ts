import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';

@Entity('clients')
export class Client {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  dni: string;

  @Column()
  nombres: string;

  @Column()
  apellidos: string;

  @Column({ nullable: true })
  telefono: string;

  @Column({ nullable: true })
  telefonoSecundario: string;

  @Column({ nullable: true })
  email: string;

  @Column({ nullable: true })
  direccion: string;

  @Column({ type: 'date', nullable: true })
  fechaNacimiento: Date;

  @Column({ nullable: true })
  ocupacion: string;

  @Column({ type: 'text', nullable: true })
  observaciones: string;

  @Column({ default: true })
  activo: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Helper to get full name
  get nombreCompleto(): string {
    return `${this.nombres} ${this.apellidos}`;
  }
}
