import { Controller, Get, Param, ParseIntPipe, Post } from '@nestjs/common';
import { PaymentSchedulesService } from './payment-schedules.service';

@Controller('payment-schedules')
export class PaymentSchedulesController {
  constructor(private schedulesService: PaymentSchedulesService) {}

  @Get('contract/:contractId')
  findByContract(@Param('contractId', ParseIntPipe) contractId: number) {
    return this.schedulesService.findByContract(contractId);
  }

  @Get('contract/:contractId/overdue')
  getOverdue(@Param('contractId', ParseIntPipe) contractId: number) {
    return this.schedulesService.getOverdueByContract(contractId);
  }

  @Get('contract/:contractId/next')
  getNextPending(@Param('contractId', ParseIntPipe) contractId: number) {
    return this.schedulesService.getNextPending(contractId);
  }

  @Get('contract/:contractId/balance')
  async getTotalPendingBalance(@Param('contractId', ParseIntPipe) contractId: number) {
    const balance = await this.schedulesService.getTotalPendingBalance(contractId);
    return { balance };
  }

  @Post('update-overdue')
  updateOverdueStatus() {
    return this.schedulesService.updateOverdueStatus();
  }
}
