import { IsString, IsOptional, IsBoolean } from 'class-validator';

export class CreateCuentaDto {
  @IsString()
  nombre: string;
}

export class UpdateCuentaDto {
  @IsOptional()
  @IsString()
  nombre?: string;

  @IsOptional()
  @IsBoolean()
  activa?: boolean;
}
