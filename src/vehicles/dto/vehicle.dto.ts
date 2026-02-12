import {
  IsString,
  IsNumber,
  IsOptional,
  IsEnum,
  Min,
  Max,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { VehicleStatus } from '../vehicle.entity';

export class CreateVehicleDto {
  @IsString()
  placa: string;

  @IsString()
  marca: string;

  @IsString()
  modelo: string;

  @IsNumber()
  @Min(1900)
  @Max(new Date().getFullYear() + 1)
  anio: number;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  kilometraje?: number;

  @IsOptional()
  @IsString()
  observaciones?: string;
}

export class UpdateVehicleDto {
  @IsOptional()
  @IsString()
  marca?: string;

  @IsOptional()
  @IsString()
  modelo?: string;

  @IsOptional()
  @IsNumber()
  @Min(1900)
  @Max(new Date().getFullYear() + 1)
  anio?: number;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsEnum(VehicleStatus, { message: 'Estado inválido' })
  estado?: VehicleStatus;

  @IsOptional()
  @IsString()
  observaciones?: string;
}

export class UpdateMileageDto {
  @IsNumber()
  @Min(0)
  kilometraje: number;

  @IsOptional()
  @IsString()
  observacion?: string;
}

export class SearchVehiclesDto {
  @IsOptional()
  @IsString()
  placa?: string;

  @IsOptional()
  @IsString()
  marca?: string;

  @IsOptional()
  @IsString()
  modelo?: string;

  @IsOptional()
  @Transform(({ value }) => value ? parseInt(value, 10) : undefined)
  @IsNumber()
  anio?: number;

  @IsOptional()
  @IsEnum(VehicleStatus)
  estado?: VehicleStatus;

  @IsOptional()
  @Transform(({ value }) => value ? parseInt(value, 10) : 1)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Transform(({ value }) => value ? parseInt(value, 10) : 10)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 10;
}

