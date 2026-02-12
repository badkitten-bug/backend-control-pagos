import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { Contract } from '../contracts/contract.entity';
import { PaymentSchedule } from '../payment-schedules/payment-schedule.entity';
import { Payment } from '../payments/payment.entity';
import { Vehicle } from '../vehicles/vehicle.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Contract, PaymentSchedule, Payment, Vehicle]),
  ],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
