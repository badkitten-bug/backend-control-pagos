import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContractsController } from './contracts.controller';
import { ContractsService } from './contracts.service';
import { Contract } from './contract.entity';
import { VehiclesModule } from '../vehicles/vehicles.module';
import { PaymentSchedulesModule } from '../payment-schedules/payment-schedules.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Contract]),
    VehiclesModule,
    PaymentSchedulesModule,
  ],
  controllers: [ContractsController],
  providers: [ContractsService],
  exports: [ContractsService],
})
export class ContractsModule {}
