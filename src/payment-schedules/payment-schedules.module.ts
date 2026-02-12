import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentSchedule } from './payment-schedule.entity';
import { PaymentSchedulesService } from './payment-schedules.service';
import { PaymentSchedulesController } from './payment-schedules.controller';

@Module({
  imports: [TypeOrmModule.forFeature([PaymentSchedule])],
  controllers: [PaymentSchedulesController],
  providers: [PaymentSchedulesService],
  exports: [PaymentSchedulesService],
})
export class PaymentSchedulesModule {}
