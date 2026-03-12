import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { User } from '../users/user.entity';
import { RegisterDto, LoginDto } from './dto/auth.dto';

export interface JwtPayload {
  sub: number;
  email: string;
  rol: string;
}

export interface AuthResponse {
  accessToken: string;
  user: {
    id: number;
    email: string;
    nombre: string;
    apellido: string | null;
    rol: string;
  };
}

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<{ message: string }> {
    await this.usersService.create(
      dto.email,
      dto.password,
      dto.nombre,
      dto.apellido,
    );
    return {
      message:
        'Cuenta creada exitosamente. Su cuenta está pendiente de aprobación por un administrador.',
    };
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const isPasswordValid = await this.usersService.validatePassword(
      user,
      dto.password,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    // En producción exigimos que el usuario esté activo.
    // En desarrollo (por ejemplo usando SQLite local) permitimos el login
    // aunque el flag "activo" sea false, para no depender de un admin.
    if (!user.activo && process.env.NODE_ENV === 'production') {
      throw new UnauthorizedException('Usuario inactivo');
    }

    return this.generateAuthResponse(user);
  }

  async validateUser(payload: JwtPayload): Promise<User | null> {
    return this.usersService.findById(payload.sub);
  }

  private generateAuthResponse(user: User): AuthResponse {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      rol: user.rol,
    };

    return {
      accessToken: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        nombre: user.nombre,
        apellido: user.apellido,
        rol: user.rol,
      },
    };
  }
}
