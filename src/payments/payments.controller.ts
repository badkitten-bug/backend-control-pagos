import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  ParseIntPipe,
  Res,
  NotFoundException,
} from '@nestjs/common';
import type { Response } from 'express';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto, SearchPaymentsDto } from './dto/payment.dto';
import { CurrentUser } from '../auth/current-user.decorator';
import { User } from '../users/user.entity';
import { ReceiptsService } from '../receipts/receipts.service';
import { ContractsService } from '../contracts/contracts.service';

@Controller('payments')
export class PaymentsController {
  constructor(
    private paymentsService: PaymentsService,
    private receiptsService: ReceiptsService,
    private contractsService: ContractsService,
  ) {}

  @Post()
  create(@Body() dto: CreatePaymentDto, @CurrentUser() user: User) {
    return this.paymentsService.create(dto, user);
  }

  @Get()
  findAll(@Query() dto: SearchPaymentsDto) {
    return this.paymentsService.findAll(dto);
  }

  @Get('contract/:contractId')
  findByContract(@Param('contractId', ParseIntPipe) contractId: number) {
    return this.paymentsService.findByContract(contractId);
  }

  @Get('contract/:contractId/total')
  getTotalByContract(@Param('contractId', ParseIntPipe) contractId: number) {
    return this.paymentsService.getTotalByContract(contractId);
  }

  @Get('contract/:contractId/last')
  getLastPayment(@Param('contractId', ParseIntPipe) contractId: number) {
    return this.paymentsService.getLastPayment(contractId);
  }

  @Get(':id/receipt')
  async getReceipt(
    @Param('id', ParseIntPipe) id: number,
    @Res() res: Response,
  ) {
    const payment = await this.paymentsService.findById(id);
    if (!payment) {
      throw new NotFoundException('Pago no encontrado');
    }

    const contract = await this.contractsService.findById(payment.contractId);
    const pdfBuffer = await this.receiptsService.generateReceipt(payment, contract);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename=recibo-${payment.id}.pdf`,
      'Content-Length': pdfBuffer.length,
    });

    res.send(pdfBuffer);
  }
}

