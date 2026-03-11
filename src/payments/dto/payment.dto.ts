import {
  IsNumber,
  IsString,
  IsOptional,
  IsEnum,
  IsDateString,
  IsPositive,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentType, PaymentMethod } from '../payment.entity';

export class CreatePaymentDto {
  @ApiProperty({ example: 1, description: 'ID del contrato' })
  @IsNumber()
  contractId: number;

  @ApiPropertyOptional({
    example: 1,
    description: 'ID de la cuota del cronograma',
  })
  @IsOptional()
  @IsNumber()
  scheduleId?: number;

  @ApiProperty({ enum: PaymentType, example: PaymentType.CUOTA })
  @IsEnum(PaymentType, { message: 'Tipo de pago inválido' })
  tipo: PaymentType;

  @ApiProperty({ example: 150.0, description: 'Monto pagado' })
  @IsNumber()
  @IsPositive()
  importe: number;

  @ApiProperty({ example: '2024-03-22', description: 'Fecha del pago' })
  @IsDateString()
  fechaPago: string;

  @ApiProperty({ enum: PaymentMethod, example: PaymentMethod.EFECTIVO })
  @IsEnum(PaymentMethod, { message: 'Medio de pago inválido' })
  medioPago: PaymentMethod;

  @ApiPropertyOptional({ example: 'OP-777', description: 'N° de operación' })
  @IsOptional()
  @IsString()
  numeroOperacion?: string;

  @ApiPropertyOptional({
    example: 'BCP ahorros',
    description: 'Cuenta depósito',
  })
  @IsOptional()
  @IsString()
  cuentaDeposito?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notas?: string;
}

export class SearchPaymentsDto {
  @IsOptional()
  @Transform(({ value }) => (value ? parseInt(value, 10) : undefined))
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
