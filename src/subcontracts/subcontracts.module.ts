import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Subcontract, SubcontractSchedule } from './subcontract.entity';
import { SubcontractsService } from './subcontracts.service';
import { SubcontractsController } from './subcontracts.controller';
import { ContractsModule } from '../contracts/contracts.module';
import { PaymentSchedulesModule } from '../payment-schedules/payment-schedules.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Subcontract, SubcontractSchedule]),
    forwardRef(() => ContractsModule),
    forwardRef(() => PaymentSchedulesModule),
  ],
  controllers: [SubcontractsController],
  providers: [SubcontractsService],
  exports: [SubcontractsService],
})
export class SubcontractsModule {}
