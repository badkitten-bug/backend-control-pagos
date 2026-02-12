import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import { SubcontractsService } from './subcontracts.service';
import { CreateSubcontractDto, SearchSubcontractsDto, PaySubcontractScheduleDto } from './dto/subcontract.dto';

@Controller('subcontracts')
export class SubcontractsController {
  constructor(private readonly subcontractsService: SubcontractsService) {}

  @Post()
  create(@Body() dto: CreateSubcontractDto) {
    return this.subcontractsService.create(dto);
  }

  @Get()
  findAll(@Query() dto: SearchSubcontractsDto) {
    return this.subcontractsService.findAll(dto);
  }

  @Get('contract/:contractId')
  findByContract(@Param('contractId', ParseIntPipe) contractId: number) {
    return this.subcontractsService.findByContract(contractId);
  }

  @Get(':id')
  findById(@Param('id', ParseIntPipe) id: number) {
    return this.subcontractsService.findById(id);
  }

  @Delete(':id')
  annul(@Param('id', ParseIntPipe) id: number) {
    return this.subcontractsService.annul(id);
  }

  @Get(':id/balance')
  getPendingBalance(@Param('id', ParseIntPipe) id: number) {
    return this.subcontractsService.getPendingBalance(id);
  }

  @Post('schedule/:scheduleId/pay')
  paySchedule(
    @Param('scheduleId', ParseIntPipe) scheduleId: number,
    @Body() dto: PaySubcontractScheduleDto,
  ) {
    return this.subcontractsService.paySchedule(scheduleId, dto);
  }
}
