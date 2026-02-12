import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Contract, ContractStatus, PaymentFrequency } from '../contracts/contract.entity';
import { PaymentSchedule, ScheduleStatus } from '../payment-schedules/payment-schedule.entity';
import { Payment } from '../payments/payment.entity';
import { Vehicle } from '../vehicles/vehicle.entity';
import { differenceInDays, startOfDay } from 'date-fns';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';

export interface ArrearsReportItem {
  placa: string;
  contractId: number;
  fechaContrato: Date;
  cuotasVencidas: number;
  montoVencido: number;
  maxDiasAtraso: number;
  ultimoPago: {
    fecha: Date | null;
    importe: number | null;
  };
  frecuencia: PaymentFrequency;
  estado: ContractStatus;
}

export interface QuickSearchResult {
  placa: string;
  estado: string;
  vehicleStatus: string;
  contratoActivo: {
    id: number;
    estado: ContractStatus;
    fechaInicio: Date;
    precio: number;
    pagoInicial: number;
  } | null;
  proximaCuota: {
    numero: number;
    fechaVencimiento: Date;
    importe: number;
  } | null;
  deudaVencida: number;
  totalPagado: number;
}

export type SemaforoStatus = 'verde' | 'ambar' | 'rojo';

export interface TrafficLightItem {
  vehicleId: number;
  placa: string;
  marca: string;
  modelo: string;
  contractId: number;
  clienteNombre: string;
  clienteTelefono: string;
  frecuencia: PaymentFrequency;
  cuotasVencidas: number;
  montoVencido: number;
  diasAtraso: number;
  semaforo: SemaforoStatus;
  ultimoPago: Date | null;
}

export interface DashboardStats {
  totalVehiculos: number;
  vehiculosDisponibles: number;
  contratosVigentes: number;
  totalCobradoMes: number;
  totalPendiente: number;
  totalMoraAcumulada: number;
  semaforo: {
    verde: number;
    ambar: number;
    rojo: number;
  };
  cobranzasMensuales: {
    mes: string;
    cobrado: number;
    pendiente: number;
  }[];
}

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Contract)
    private contractRepository: Repository<Contract>,
    @InjectRepository(PaymentSchedule)
    private scheduleRepository: Repository<PaymentSchedule>,
    @InjectRepository(Payment)
    private paymentRepository: Repository<Payment>,
    @InjectRepository(Vehicle)
    private vehicleRepository: Repository<Vehicle>,
  ) {}

  async getArrearsReport(filters: {
    fechaDesde?: string;
    fechaHasta?: string;
    frecuencia?: PaymentFrequency;
    estado?: ContractStatus;
    placa?: string;
  }): Promise<ArrearsReportItem[]> {
    const today = startOfDay(new Date());

    const queryBuilder = this.contractRepository
      .createQueryBuilder('contract')
      .leftJoinAndSelect('contract.vehicle', 'vehicle')
      .leftJoinAndSelect('contract.cronograma', 'schedule')
      .where('contract.estado IN (:...estados)', {
        estados: [ContractStatus.VIGENTE, ContractStatus.BORRADOR],
      });

    if (filters.placa) {
      queryBuilder.andWhere('vehicle.placa LIKE :placa', {
        placa: `%${filters.placa.toUpperCase()}%`,
      });
    }

    if (filters.frecuencia) {
      queryBuilder.andWhere('contract.frecuencia = :frecuencia', {
        frecuencia: filters.frecuencia,
      });
    }

    if (filters.estado) {
      queryBuilder.andWhere('contract.estado = :estado', {
        estado: filters.estado,
      });
    }

    const contracts = await queryBuilder.getMany();

    const reportItems: ArrearsReportItem[] = [];

    for (const contract of contracts) {
      const overdueSchedules = contract.cronograma.filter(
        (s) =>
          s.estado !== ScheduleStatus.PAGADA &&
          new Date(s.fechaVencimiento) < today,
      );

      if (overdueSchedules.length === 0) continue;

      const montoVencido = overdueSchedules.reduce(
        (sum, s) => sum + parseFloat(s.saldo.toString()),
        0,
      );

      const oldestOverdue = overdueSchedules.reduce((oldest, s) =>
        new Date(s.fechaVencimiento) < new Date(oldest.fechaVencimiento)
          ? s
          : oldest,
      );

      const maxDiasAtraso = differenceInDays(
        today,
        new Date(oldestOverdue.fechaVencimiento),
      );

      const lastPayment = await this.paymentRepository.findOne({
        where: { contractId: contract.id },
        order: { fechaPago: 'DESC' },
      });

      reportItems.push({
        placa: contract.vehicle.placa,
        contractId: contract.id,
        fechaContrato: contract.fechaInicio,
        cuotasVencidas: overdueSchedules.length,
        montoVencido,
        maxDiasAtraso,
        ultimoPago: {
          fecha: lastPayment?.fechaPago || null,
          importe: lastPayment ? parseFloat(lastPayment.importe.toString()) : null,
        },
        frecuencia: contract.frecuencia,
        estado: contract.estado,
      });
    }

    // Sort by days overdue desc, then amount desc
    reportItems.sort((a, b) => {
      if (b.maxDiasAtraso !== a.maxDiasAtraso) {
        return b.maxDiasAtraso - a.maxDiasAtraso;
      }
      return b.montoVencido - a.montoVencido;
    });

    return reportItems;
  }

  async getQuickSearchByPlaca(placa: string): Promise<QuickSearchResult[]> {
    // Use LIKE for partial matching
    const vehicles = await this.vehicleRepository
      .createQueryBuilder('vehicle')
      .where('vehicle.placa LIKE :placa', { placa: `%${placa.toUpperCase()}%` })
      .orderBy('vehicle.placa', 'ASC')
      .take(10) // Limit to 10 results
      .getMany();

    if (vehicles.length === 0) return [];

    const results: QuickSearchResult[] = [];

    for (const vehicle of vehicles) {
      // Get active contract
      const activeContract = await this.contractRepository.findOne({
        where: {
          vehicleId: vehicle.id,
          estado: ContractStatus.VIGENTE,
        },
        relations: ['cronograma'],
      });

      let proximaCuota: { numero: number; fechaVencimiento: Date; importe: number } | null = null;
      let deudaVencida = 0;
      let totalPagado = 0;

      if (activeContract) {
        // Next pending schedule
        const nextSchedule = activeContract.cronograma
          .filter((s) => s.estado === ScheduleStatus.PENDIENTE)
          .sort((a, b) => new Date(a.fechaVencimiento).getTime() - new Date(b.fechaVencimiento).getTime())[0];

        if (nextSchedule) {
          proximaCuota = {
            numero: nextSchedule.numeroCuota,
            fechaVencimiento: nextSchedule.fechaVencimiento,
            importe: parseFloat(nextSchedule.saldo.toString()),
          };
        }

        // Overdue amount
        const today = startOfDay(new Date());
        deudaVencida = activeContract.cronograma
          .filter(
            (s) =>
              s.estado !== ScheduleStatus.PAGADA &&
              new Date(s.fechaVencimiento) < today,
          )
          .reduce((sum, s) => sum + parseFloat(s.saldo.toString()), 0);

        // Total paid
        const payments = await this.paymentRepository.find({
          where: { contractId: activeContract.id },
        });
        totalPagado = payments.reduce(
          (sum, p) => sum + parseFloat(p.importe.toString()),
          0,
        );
      }

      results.push({
        placa: vehicle.placa,
        estado: vehicle.estado,
        vehicleStatus: vehicle.estado,
        contratoActivo: activeContract
          ? {
              id: activeContract.id,
              estado: activeContract.estado,
              fechaInicio: activeContract.fechaInicio,
              precio: parseFloat(activeContract.precio.toString()),
              pagoInicial: parseFloat(activeContract.pagoInicial.toString()),
            }
          : null,
        proximaCuota,
        deudaVencida,
        totalPagado,
      });
    }

    return results;
  }

  async getTrafficLightReport(filters?: {
    semaforo?: SemaforoStatus;
    placa?: string;
    frecuencia?: PaymentFrequency;
  }): Promise<TrafficLightItem[]> {
    const today = startOfDay(new Date());

    // Get all active contracts
    const queryBuilder = this.contractRepository
      .createQueryBuilder('contract')
      .leftJoinAndSelect('contract.vehicle', 'vehicle')
      .leftJoinAndSelect('contract.cronograma', 'schedule')
      .where('contract.estado = :estado', { estado: ContractStatus.VIGENTE });

    if (filters?.placa) {
      queryBuilder.andWhere('vehicle.placa LIKE :placa', {
        placa: `%${filters.placa.toUpperCase()}%`,
      });
    }

    if (filters?.frecuencia) {
      queryBuilder.andWhere('contract.frecuencia = :frecuencia', {
        frecuencia: filters.frecuencia,
      });
    }

    const contracts = await queryBuilder.getMany();
    const items: TrafficLightItem[] = [];

    for (const contract of contracts) {
      // Find overdue schedules
      const overdueSchedules = contract.cronograma.filter(
        (s) =>
          s.estado !== ScheduleStatus.PAGADA &&
          new Date(s.fechaVencimiento) < today,
      );

      const cuotasVencidas = overdueSchedules.length;
      const montoVencido = overdueSchedules.reduce(
        (sum, s) => sum + parseFloat(s.saldo.toString()),
        0,
      );

      // Calculate days of delay from oldest overdue
      let diasAtraso = 0;
      if (overdueSchedules.length > 0) {
        const oldestOverdue = overdueSchedules.reduce((oldest, s) =>
          new Date(s.fechaVencimiento) < new Date(oldest.fechaVencimiento)
            ? s
            : oldest,
        );
        diasAtraso = differenceInDays(today, new Date(oldestOverdue.fechaVencimiento));
      }

      // Calculate semaforo based on frequency type
      let semaforo: SemaforoStatus;
      if (contract.frecuencia === PaymentFrequency.DIARIO) {
        // Daily payments: based on days of delay
        semaforo = diasAtraso >= 3 ? 'rojo' : diasAtraso >= 1 ? 'ambar' : 'verde';
      } else {
        // Other frequencies: based on overdue installments
        semaforo = cuotasVencidas >= 3 ? 'rojo' : cuotasVencidas >= 1 ? 'ambar' : 'verde';
      }

      // Filter by semaforo if specified
      if (filters?.semaforo && filters.semaforo !== semaforo) {
        continue;
      }

      // Get last payment
      const lastPayment = await this.paymentRepository.findOne({
        where: { contractId: contract.id },
        order: { fechaPago: 'DESC' },
      });

      items.push({
        vehicleId: contract.vehicle.id,
        placa: contract.vehicle.placa,
        marca: contract.vehicle.marca,
        modelo: contract.vehicle.modelo,
        contractId: contract.id,
        clienteNombre: contract.clienteNombre || '-',
        clienteTelefono: contract.clienteTelefono || '-',
        frecuencia: contract.frecuencia,
        cuotasVencidas,
        montoVencido,
        diasAtraso,
        semaforo,
        ultimoPago: lastPayment?.fechaPago || null,
      });
    }

    // Sort: red first, then amber, then green
    const order = { rojo: 0, ambar: 1, verde: 2 };
    items.sort((a, b) => {
      const orderDiff = order[a.semaforo] - order[b.semaforo];
      if (orderDiff !== 0) return orderDiff;
      return b.diasAtraso - a.diasAtraso;
    });

    return items;
  }

  async exportArrearsToExcel(
    data: ArrearsReportItem[],
  ): Promise<ExcelJS.Workbook> {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Reporte de Atrasos');

    worksheet.columns = [
      { header: 'Placa', key: 'placa', width: 12 },
      { header: 'ID Contrato', key: 'contractId', width: 12 },
      { header: 'Fecha Contrato', key: 'fechaContrato', width: 15 },
      { header: 'Cuotas Vencidas', key: 'cuotasVencidas', width: 15 },
      { header: 'Monto Vencido', key: 'montoVencido', width: 15 },
      { header: 'Días de Atraso', key: 'maxDiasAtraso', width: 15 },
      { header: 'Último Pago (Fecha)', key: 'ultimoPagoFecha', width: 18 },
      { header: 'Último Pago (Monto)', key: 'ultimoPagoMonto', width: 18 },
      { header: 'Frecuencia', key: 'frecuencia', width: 12 },
      { header: 'Estado', key: 'estado', width: 12 },
    ];

    // Style header
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF3B82F6' },
    };
    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

    data.forEach((item) => {
      worksheet.addRow({
        placa: item.placa,
        contractId: item.contractId,
        fechaContrato: item.fechaContrato,
        cuotasVencidas: item.cuotasVencidas,
        montoVencido: item.montoVencido,
        maxDiasAtraso: item.maxDiasAtraso,
        ultimoPagoFecha: item.ultimoPago.fecha || 'N/A',
        ultimoPagoMonto: item.ultimoPago.importe || 0,
        frecuencia: item.frecuencia,
        estado: item.estado,
      });
    });

    return workbook;
  }

  async exportArrearsToPdf(data: ArrearsReportItem[]): Promise<Buffer> {
    return new Promise((resolve) => {
      const doc = new PDFDocument({ margin: 30, size: 'A4', layout: 'landscape' });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));

      // Title
      doc.fontSize(18).text('Reporte de Atrasos', { align: 'center' });
      doc.moveDown();
      doc.fontSize(10).text(`Generado: ${new Date().toLocaleDateString('es-PE')}`);
      doc.moveDown();

      // Table headers
      const headers = [
        'Placa',
        'Contrato',
        'Cuotas Venc.',
        'Monto Venc.',
        'Días Atraso',
        'Últ. Pago',
      ];

      let y = doc.y;
      const startX = 30;
      const colWidths = [70, 70, 80, 90, 80, 100];

      // Draw header
      doc.fillColor('#3B82F6').rect(startX, y, 750, 20).fill();
      doc.fillColor('#FFFFFF');
      let x = startX;
      headers.forEach((header, i) => {
        doc.text(header, x + 5, y + 5, { width: colWidths[i] });
        x += colWidths[i];
      });

      y += 25;
      doc.fillColor('#000000');

      // Draw data
      data.slice(0, 25).forEach((item) => {
        x = startX;
        const row = [
          item.placa,
          `#${item.contractId}`,
          item.cuotasVencidas.toString(),
          `S/ ${item.montoVencido.toFixed(2)}`,
          item.maxDiasAtraso.toString(),
          item.ultimoPago.fecha
            ? `${new Date(item.ultimoPago.fecha).toLocaleDateString('es-PE')}`
            : 'N/A',
        ];

        row.forEach((cell, i) => {
          doc.text(cell, x + 5, y, { width: colWidths[i] });
          x += colWidths[i];
        });
        y += 18;
      });

      doc.end();
    });
  }

  async getDashboardStats(): Promise<DashboardStats> {
    const today = startOfDay(new Date());
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    
    // Get vehicle counts
    const totalVehiculos = await this.vehicleRepository.count();
    const vehiculosDisponibles = await this.vehicleRepository.count({
      where: { estado: 'Disponible' as any },
    });

    // Get active contracts count
    const contratosVigentes = await this.contractRepository.count({
      where: { estado: ContractStatus.VIGENTE },
    });

    // Get payments this month
    const paymentsThisMonth = await this.paymentRepository
      .createQueryBuilder('payment')
      .where('payment.fechaPago >= :startOfMonth', { startOfMonth })
      .getMany();
    
    const totalCobradoMes = paymentsThisMonth.reduce(
      (sum, p) => sum + parseFloat(p.importe.toString()),
      0,
    );

    // Get all pending schedules for total pending
    const pendingSchedules = await this.scheduleRepository.find({
      where: { estado: ScheduleStatus.PENDIENTE },
    });
    const overdueSchedules = await this.scheduleRepository
      .createQueryBuilder('schedule')
      .leftJoinAndSelect('schedule.contract', 'contract')
      .where('schedule.estado != :paid', { paid: ScheduleStatus.PAGADA })
      .andWhere('schedule.fechaVencimiento < :today', { today })
      .getMany();

    const totalPendiente = pendingSchedules.reduce(
      (sum, s) => sum + parseFloat(s.saldo.toString()),
      0,
    );

    // Calculate mora for overdue schedules
    let totalMoraAcumulada = 0;
    for (const schedule of overdueSchedules) {
      const diasAtraso = differenceInDays(today, new Date(schedule.fechaVencimiento));
      const saldo = parseFloat(schedule.saldo.toString());
      const moraPct = parseFloat((schedule.contract?.moraPorcentaje || 0).toString());
      if (moraPct > 0 && diasAtraso > 0) {
        totalMoraAcumulada += (saldo * moraPct / 100) * diasAtraso;
      }
    }

    // Get semaforo distribution
    const trafficLight = await this.getTrafficLightReport();
    const semaforo = {
      verde: trafficLight.filter(t => t.semaforo === 'verde').length,
      ambar: trafficLight.filter(t => t.semaforo === 'ambar').length,
      rojo: trafficLight.filter(t => t.semaforo === 'rojo').length,
    };

    // Get last 6 months collections
    const cobranzasMensuales: { mes: string; cobrado: number; pendiente: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const monthStart = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const monthEnd = new Date(today.getFullYear(), today.getMonth() - i + 1, 0);
      const monthName = monthStart.toLocaleString('es-PE', { month: 'short' });

      const payments = await this.paymentRepository
        .createQueryBuilder('payment')
        .where('payment.fechaPago >= :start', { start: monthStart })
        .andWhere('payment.fechaPago <= :end', { end: monthEnd })
        .getMany();

      const cobrado = payments.reduce((sum, p) => sum + parseFloat(p.importe.toString()), 0);

      const schedulesInMonth = await this.scheduleRepository
        .createQueryBuilder('schedule')
        .where('schedule.fechaVencimiento >= :start', { start: monthStart })
        .andWhere('schedule.fechaVencimiento <= :end', { end: monthEnd })
        .getMany();

      const pendiente = schedulesInMonth
        .filter(s => s.estado !== ScheduleStatus.PAGADA)
        .reduce((sum, s) => sum + parseFloat(s.saldo.toString()), 0);

      cobranzasMensuales.push({ mes: monthName, cobrado, pendiente });
    }

    return {
      totalVehiculos,
      vehiculosDisponibles,
      contratosVigentes,
      totalCobradoMes,
      totalPendiente,
      totalMoraAcumulada: Math.round(totalMoraAcumulada * 100) / 100,
      semaforo,
      cobranzasMensuales,
    };
  }
}
