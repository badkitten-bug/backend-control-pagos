import {
  IsNumber,
  IsString,
  IsOptional,
  IsEnum,
  IsDateString,
  IsPositive,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { PaymentType, PaymentMethod } from '../payment.entity';

export class CreatePaymentDto {
  @IsNumber()
  contractId: number;

  @IsOptional()
  @IsNumber()
  scheduleId?: number;

  @IsEnum(PaymentType, { message: 'Tipo de pago inválido' })
  tipo: PaymentType;

  @IsNumber()
  @IsPositive()
  importe: number;

  @IsDateString()
  fechaPago: string;

  @IsEnum(PaymentMethod, { message: 'Medio de pago inválido' })
  medioPago: PaymentMethod;

  @IsOptional()
  @IsString()
  numeroOperacion?: string;

  @IsOptional()
  @IsString()
  notas?: string;
}

export class SearchPaymentsDto {
  @IsOptional()
  @Transform(({ value }) => value ? parseInt(value, 10) : undefined)
  @IsNumber()
  contractId?: number;

  @IsOptional()
  @IsDateString()
  fechaDesde?: string;

  @IsOptional()
  @IsDateString()
  fechaHasta?: string;

  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10) || 1)
  @IsNumber()
  page?: number = 1;

  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10) || 10)
  @IsNumber()
  limit?: number = 10;
}

