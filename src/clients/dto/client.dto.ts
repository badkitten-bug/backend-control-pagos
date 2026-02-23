import { IsString, IsOptional, IsEmail, IsDateString, IsBoolean, Length } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateClientDto {
  @ApiProperty({ example: '12345678', description: 'Número de DNI del cliente' })
  @IsString()
  @Length(8, 8, { message: 'El DNI debe tener 8 dígitos' })
  dni: string;

  @ApiProperty({ example: 'Juan', description: 'Nombres del cliente' })
  @IsString()
  nombres: string;

  @ApiProperty({ example: 'Perez', description: 'Apellidos del cliente' })
  @IsString()
  apellidos: string;

  @ApiPropertyOptional({ example: '999888777' })
  @IsOptional()
  @IsString()
  telefono?: string;

  @ApiPropertyOptional({ example: '999888776' })
  @IsOptional()
  @IsString()
  telefonoSecundario?: string;

  @ApiPropertyOptional({ example: 'juan@perez.com' })
  @IsOptional()
  @IsEmail({}, { message: 'Email inválido' })
  email?: string;

  @ApiPropertyOptional({ example: 'Av. Las Gardenias 123' })
  @IsOptional()
  @IsString()
  direccion?: string;

  @ApiPropertyOptional({ example: '1990-01-01' })
  @IsOptional()
  @IsDateString()
  fechaNacimiento?: string;

  @ApiPropertyOptional({ example: 'Conductor' })
  @IsOptional()
  @IsString()
  ocupacion?: string;

  @ApiPropertyOptional({ example: 'Q1234567', description: 'Número de brevete/licencia' })
  @IsOptional()
  @IsString()
  numeroBrevete?: string;

  @ApiPropertyOptional({ example: '2030-12-31', description: 'Fecha de vigencia de la licencia' })
  @IsOptional()
  @IsDateString()
  fechaVigenciaBrevete?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  observaciones?: string;
}

export class UpdateClientDto {
  @IsOptional()
  @IsString()
  nombres?: string;

  @IsOptional()
  @IsString()
  apellidos?: string;

  @IsOptional()
  @IsString()
  telefono?: string;

  @IsOptional()
  @IsString()
  telefonoSecundario?: string;

  @IsOptional()
  @IsEmail({}, { message: 'Email inválido' })
  email?: string;

  @IsOptional()
  @IsString()
  direccion?: string;

  @IsOptional()
  @IsDateString()
  fechaNacimiento?: string;

  @IsOptional()
  @IsString()
  ocupacion?: string;

  @IsOptional()
  @IsString()
  numeroBrevete?: string;

  @IsOptional()
  @IsDateString()
  fechaVigenciaBrevete?: string;

  @IsOptional()
  @IsString()
  observaciones?: string;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

export class SearchClientDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
