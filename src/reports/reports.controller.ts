import { Controller, Get, Query, Res, Param } from '@nestjs/common';
import type { Response } from 'express';
import { ReportsService } from './reports.service';
import { ContractStatus, PaymentFrequency } from '../contracts/contract.entity';

@Controller('reports')
export class ReportsController {
  constructor(private reportsService: ReportsService) {}

  @Get('arrears')
  async getArrearsReport(
    @Query('fechaDesde') fechaDesde?: string,
    @Query('fechaHasta') fechaHasta?: string,
    @Query('frecuencia') frecuencia?: PaymentFrequency,
    @Query('estado') estado?: ContractStatus,
    @Query('placa') placa?: string,
  ) {
    return this.reportsService.getArrearsReport({
      fechaDesde,
      fechaHasta,
      frecuencia,
      estado,
      placa,
    });
  }

  @Get('arrears/export/excel')
  async exportArrearsExcel(
    @Res() res: Response,
    @Query('fechaDesde') fechaDesde?: string,
    @Query('fechaHasta') fechaHasta?: string,
    @Query('frecuencia') frecuencia?: PaymentFrequency,
    @Query('estado') estado?: ContractStatus,
    @Query('placa') placa?: string,
  ) {
    const data = await this.reportsService.getArrearsReport({
      fechaDesde,
      fechaHasta,
      frecuencia,
      estado,
      placa,
    });

    const workbook = await this.reportsService.exportArrearsToExcel(data);

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=reporte-atrasos-${new Date().toISOString().split('T')[0]}.xlsx`,
    );

    await workbook.xlsx.write(res as any);
    res.end();
  }

  @Get('arrears/export/pdf')
  async exportArrearsPdf(
    @Res() res: Response,
    @Query('fechaDesde') fechaDesde?: string,
    @Query('fechaHasta') fechaHasta?: string,
    @Query('frecuencia') frecuencia?: PaymentFrequency,
    @Query('estado') estado?: ContractStatus,
    @Query('placa') placa?: string,
  ) {
    const data = await this.reportsService.getArrearsReport({
      fechaDesde,
      fechaHasta,
      frecuencia,
      estado,
      placa,
    });

    const pdfBuffer = await this.reportsService.exportArrearsToPdf(data);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=reporte-atrasos-${new Date().toISOString().split('T')[0]}.pdf`,
    );

    res.send(pdfBuffer);
  }

  @Get('quick-search/:placa')
  async quickSearch(@Param('placa') placa: string) {
    return this.reportsService.getQuickSearchByPlaca(placa);
  }

  @Get('dashboard-stats')
  async getDashboardStats() {
    return this.reportsService.getDashboardStats();
  }

  @Get('traffic-light')
  async getTrafficLightReport(
    @Query('semaforo') semaforo?: 'verde' | 'ambar' | 'rojo',
    @Query('placa') placa?: string,
    @Query('frecuencia') frecuencia?: PaymentFrequency,
  ) {
    return this.reportsService.getTrafficLightReport({
      semaforo,
      placa,
      frecuencia,
    });
  }
}
