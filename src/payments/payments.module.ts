import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { Payment } from './payment.entity';
import { ContractsModule } from '../contracts/contracts.module';
import { PaymentSchedulesModule } from '../payment-schedules/payment-schedules.module';
import { ReceiptsModule } from '../receipts/receipts.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Payment]),
    ContractsModule,
    PaymentSchedulesModule,
    ReceiptsModule,
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}

