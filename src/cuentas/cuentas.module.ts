import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CuentasController } from './cuentas.controller';
import { CuentasService } from './cuentas.service';
import { Cuenta } from './cuenta.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Cuenta])],
  controllers: [CuentasController],
  providers: [CuentasService],
  exports: [CuentasService],
})
export class CuentasModule {}
