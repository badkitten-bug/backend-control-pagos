import { Controller, Get, Param, Query, ParseIntPipe } from '@nestjs/common';
import { AuditService } from './audit.service';

@Controller('audit')
export class AuditController {
  constructor(private auditService: AuditService) {}

  @Get()
  getRecent(@Query('limit') limit?: number) {
    return this.auditService.getRecent(limit || 50);
  }

  @Get('entity/:entidad/:id')
  getByEntity(
    @Param('entidad') entidad: string,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.auditService.getByEntity(entidad, id);
  }

  @Get('user/:userId')
  getByUser(
    @Param('userId', ParseIntPipe) userId: number,
    @Query('limit') limit?: number,
  ) {
    return this.auditService.getByUser(userId, limit || 50);
  }
}
