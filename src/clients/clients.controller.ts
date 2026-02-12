import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import { ClientsService } from './clients.service';
import { CreateClientDto, UpdateClientDto, SearchClientDto } from './dto/client.dto';

@Controller('clients')
export class ClientsController {
  constructor(private clientsService: ClientsService) {}

  @Post()
  create(@Body() dto: CreateClientDto) {
    return this.clientsService.create(dto);
  }

  @Get()
  findAll(@Query() dto: SearchClientDto) {
    return this.clientsService.findAll(dto);
  }

  @Get('active')
  getActiveClients() {
    return this.clientsService.getActiveClients();
  }

  @Get('dni/:dni')
  findByDni(@Param('dni') dni: string) {
    return this.clientsService.findByDni(dni);
  }

  @Get(':id')
  findById(@Param('id', ParseIntPipe) id: number) {
    return this.clientsService.findById(id);
  }

  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateClientDto) {
    return this.clientsService.update(id, dto);
  }

  @Delete(':id')
  delete(@Param('id', ParseIntPipe) id: number) {
    return this.clientsService.delete(id);
  }
}
