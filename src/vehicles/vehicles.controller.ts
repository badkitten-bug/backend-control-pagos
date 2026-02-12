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
import { VehiclesService } from './vehicles.service';
import {
  CreateVehicleDto,
  UpdateVehicleDto,
  UpdateMileageDto,
  SearchVehiclesDto,
} from './dto/vehicle.dto';
import { CurrentUser } from '../auth/current-user.decorator';
import { User } from '../users/user.entity';

@Controller('vehicles')
export class VehiclesController {
  constructor(private vehiclesService: VehiclesService) {}

  @Post()
  create(@Body() dto: CreateVehicleDto) {
    return this.vehiclesService.create(dto);
  }

  @Get()
  findAll(@Query() dto: SearchVehiclesDto) {
    return this.vehiclesService.findAll(dto);
  }

  @Get('available')
  findAvailable() {
    return this.vehiclesService.findAvailable();
  }

  @Get('placa/:placa')
  findByPlaca(@Param('placa') placa: string) {
    return this.vehiclesService.findByPlaca(placa);
  }

  @Get(':id')
  findById(@Param('id', ParseIntPipe) id: number) {
    return this.vehiclesService.findById(id);
  }

  @Put(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateVehicleDto,
  ) {
    return this.vehiclesService.update(id, dto);
  }

  @Patch(':id/mileage')
  updateMileage(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateMileageDto,
    @CurrentUser() user: User,
  ) {
    return this.vehiclesService.updateMileage(id, dto, user);
  }

  @Get(':id/mileage-history')
  getMileageHistory(@Param('id', ParseIntPipe) id: number) {
    return this.vehiclesService.getMileageHistory(id);
  }
}
