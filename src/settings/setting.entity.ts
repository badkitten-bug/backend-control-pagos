import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('settings')
export class Setting {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  clave: string;

  @Column({ type: 'text', nullable: true })
  valor: string;

  @Column({ default: 'string' })
  tipo: string; // string, number, boolean, json

  @Column({ nullable: true })
  descripcion: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
