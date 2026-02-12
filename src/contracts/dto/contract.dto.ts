import {
  IsNumber,
  IsString,
  IsOptional,
  IsEnum,
  IsDateString,
  Min,
  IsPositive,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { PaymentFrequency, ContractStatus } from '../contract.entity';

export class CreateContractDto {
  @IsNumber()
  vehicleId: number;

  @IsDateString()
  fechaInicio: string;

  @IsNumber()
  @IsPositive()
  precio: number;

  @IsNumber()
  @Min(0)
  pagoInicial: number;

  @IsNumber()
  @IsPositive()
  numeroCuotas: number;

  @IsEnum(PaymentFrequency, { message: 'Frecuencia inválida' })
  frecuencia: PaymentFrequency;

  @IsOptional()
  @IsString()
  clienteNombre?: string;

  @IsOptional()
  @IsString()
  clienteDni?: string;

  @IsOptional()
  @IsString()
  clienteTelefono?: string;

  @IsOptional()
  @IsString()
  clienteDireccion?: string;

  @IsOptional()
  @IsString()
  observaciones?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  comisionPorcentaje?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  moraPorcentaje?: number;
}

export class UpdateContractDto {
  @IsOptional()
  @IsString()
  clienteNombre?: string;

  @IsOptional()
  @IsString()
  clienteDni?: string;

  @IsOptional()
  @IsString()
  clienteTelefono?: string;

  @IsOptional()
  @IsString()
  clienteDireccion?: string;

  @IsOptional()
  @IsString()
  observaciones?: string;
}

export class ChangeContractStatusDto {
  @IsEnum(ContractStatus, { message: 'Estado inválido' })
  estado: ContractStatus;
}

export class SearchContractsDto {
  @IsOptional()
  @IsString()
  placa?: string;

  @IsOptional()
  @IsEnum(ContractStatus)
  estado?: ContractStatus;

  @IsOptional()
  @IsString()
  clienteNombre?: string;

  @IsOptional()
  @Transform(({ value }) => value ? parseInt(value, 10) : 1)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Transform(({ value }) => value ? parseInt(value, 10) : 10)
  @IsNumber()
  @Min(1)
  limit?: number = 10;
}

