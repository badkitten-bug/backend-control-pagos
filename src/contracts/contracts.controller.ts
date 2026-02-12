import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Body,
  Param,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import { ContractsService } from './contracts.service';
import { CreateContractDto, UpdateContractDto, SearchContractsDto } from './dto/contract.dto';

@Controller('contracts')
export class ContractsController {
  constructor(private contractsService: ContractsService) {}

  @Post()
  create(@Body() dto: CreateContractDto) {
    return this.contractsService.create(dto);
  }

  @Get()
  findAll(@Query() dto: SearchContractsDto) {
    return this.contractsService.findAll(dto);
  }

  @Get(':id')
  findById(@Param('id', ParseIntPipe) id: number) {
    return this.contractsService.findById(id);
  }

  @Get('vehicle/:vehicleId')
  findByVehicle(@Param('vehicleId', ParseIntPipe) vehicleId: number) {
    return this.contractsService.findByVehicle(vehicleId);
  }

  @Put(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateContractDto,
  ) {
    return this.contractsService.update(id, dto);
  }

  @Patch(':id/activate')
  activate(@Param('id', ParseIntPipe) id: number) {
    return this.contractsService.activate(id);
  }

  @Patch(':id/cancel')
  cancel(@Param('id', ParseIntPipe) id: number) {
    return this.contractsService.cancel(id);
  }

  @Patch(':id/annul')
  annul(@Param('id', ParseIntPipe) id: number) {
    return this.contractsService.annul(id);
  }
}
