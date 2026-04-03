import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import { CuentasService } from './cuentas.service';
import { CreateCuentaDto, UpdateCuentaDto } from './dto/cuenta.dto';

@Controller('cuentas')
export class CuentasController {
  constructor(private cuentasService: CuentasService) {}

  @Get()
  findAll(@Query('soloActivas') soloActivas?: string) {
    return this.cuentasService.findAll(soloActivas === 'true');
  }

  @Post()
  create(@Body() dto: CreateCuentaDto) {
    return this.cuentasService.create(dto);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateCuentaDto) {
    return this.cuentasService.update(id, dto);
  }
}
