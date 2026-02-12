import { IsNotEmpty, IsNumber, IsOptional, IsString, IsEnum, IsDateString, Min } from 'class-validator';
import { SubcontractMode } from '../subcontract.entity';

export class CreateSubcontractDto {
  @IsNotEmpty({ message: 'El ID del contrato padre es requerido' })
  @IsNumber()
  parentContractId: number;

  @IsNotEmpty({ message: 'El tipo de subcontrato es requerido' })
  @IsString()
  tipo: string;

  @IsNotEmpty({ message: 'La modalidad es requerida' })
  @IsEnum(SubcontractMode, { message: 'Modalidad inválida' })
  modalidad: SubcontractMode;

  @IsNotEmpty({ message: 'El monto es requerido' })
  @IsNumber()
  @Min(0.01, { message: 'El monto debe ser mayor a 0' })
  monto: number;

  @IsOptional()
  @IsNumber()
  @Min(1, { message: 'El número de cuotas debe ser al menos 1' })
  numeroCuotas?: number;

  @IsOptional()
  @IsString()
  frecuencia?: string;

  @IsNotEmpty({ message: 'La fecha de inicio es requerida' })
  @IsDateString()
  fechaInicio: string;

  @IsOptional()
  @IsString()
  descripcion?: string;
}

export class SearchSubcontractsDto {
  @IsOptional()
  @IsNumber()
  parentContractId?: number;

  @IsOptional()
  @IsNumber()
  page?: number;

  @IsOptional()
  @IsNumber()
  limit?: number;
}

export class PaySubcontractScheduleDto {
  @IsNotEmpty({ message: 'El monto es requerido' })
  @IsNumber()
  @Min(0.01, { message: 'El monto debe ser mayor a 0' })
  monto: number;

  @IsNotEmpty({ message: 'La fecha de pago es requerida' })
  @IsDateString()
  fechaPago: string;

  @IsNotEmpty({ message: 'El medio de pago es requerido' })
  @IsString()
  medioPago: string;

  @IsOptional()
  @IsString()
  numeroOperacion?: string;

  @IsOptional()
  @IsString()
  notas?: string;
}
