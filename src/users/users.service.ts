import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { email } });
  }

  async findById(id: number): Promise<User | null> {
    return this.usersRepository.findOne({ where: { id } });
  }

  async create(
    email: string,
    password: string,
    nombre: string,
    apellido?: string,
  ): Promise<User> {
    const existingUser = await this.findByEmail(email);
    if (existingUser) {
      throw new ConflictException('El email ya está registrado');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = this.usersRepository.create({
      email,
      password: hashedPassword,
      nombre,
      apellido,
    });

    return this.usersRepository.save(user);
  }

  async validatePassword(user: User, password: string): Promise<boolean> {
    return bcrypt.compare(password, user.password);
  }

  async findAll(): Promise<User[]> {
    return this.usersRepository.find({
      select: ['id', 'email', 'nombre', 'apellido', 'rol', 'activo', 'createdAt'],
    });
  }

  async resetPassword(userId: number, newPassword: string): Promise<{ message: string }> {
    const user = await this.findById(userId);
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }
    user.password = await bcrypt.hash(newPassword, 10);
    await this.usersRepository.save(user);
    return { message: 'Contraseña actualizada exitosamente' };
  }

  async toggleActive(userId: number): Promise<User> {
    const user = await this.findById(userId);
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }
    user.activo = !user.activo;
    await this.usersRepository.save(user);
    return user;
  }
}
