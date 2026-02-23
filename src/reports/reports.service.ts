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

    // Pre-fetch last payments for all these contracts to avoid N+1
    const lastPayments = await this.getLastPayments(contracts.map(c => c.id));

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

      const lastPayment = lastPayments[contract.id];

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

  /**
   * Helper to fetch last payments for multiple contracts efficiently
   * Eliminates N+1 query patterns in reports
   */
  private async getLastPayments(contractIds: number[]): Promise<Record<number, Payment>> {
    if (contractIds.length === 0) return {};
    
    // Subquery to find the max date for each contract
    const lastPaymentDates = await this.paymentRepository
      .createQueryBuilder('payment')
      .select('payment.contractId', 'contractId')
      .addSelect('MAX(payment.fechaPago)', 'maxDate')
      .where('payment.contractId IN (:...contractIds)', { contractIds })
      .groupBy('payment.contractId')
      .getRawMany();

    if (lastPaymentDates.length === 0) return {};

    // Fetch the actual payment records for those dates to get the importes
    // Note: If a contract has two payments on the same literal maxDate, 
    // this might return multiple, but reduce() will pick the last one.
    const payments = await this.paymentRepository
      .createQueryBuilder('payment')
      .where('payment.contractId IN (:...cIds)', { cIds: lastPaymentDates.map(l => l.contractId) })
      .andWhere('payment.fechaPago IN (:...dates)', { dates: lastPaymentDates.map(l => l.maxDate) })
      .getMany();

    return payments.reduce((acc, p) => {
      acc[p.contractId] = p;
      return acc;
    }, {} as Record<number, Payment>);
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

    // Pre-fetch last payments
    const lastPayments = await this.getLastPayments(contracts.map(c => c.id));

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

      const lastPayment = lastPayments[contract.id];

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
    
    // 1. Vehicle counts (Parallel)
    const [totalVehiculos, vehiculosDisponibles] = await Promise.all([
      this.vehicleRepository.count(),
      this.vehicleRepository.count({ where: { estado: 'Disponible' as any } }),
    ]);

    // 2. Active contracts count
    const contratosVigentes = await this.contractRepository.count({
      where: { estado: ContractStatus.VIGENTE },
    });

    // 3. Total collected this month (DB Sum)
    const { totalCobradoMes } = await this.paymentRepository
      .createQueryBuilder('payment')
      .select('SUM(payment.importe)', 'totalCobradoMes')
      .where('payment.fechaPago >= :startOfMonth', { startOfMonth })
      .getRawOne();

    // 4. Total pending amount (DB Sum)
    const { totalPendiente } = await this.scheduleRepository
      .createQueryBuilder('schedule')
      .select('SUM(schedule.saldo)', 'totalPendiente')
      .where('schedule.estado = :pending', { pending: ScheduleStatus.PENDIENTE })
      .getRawOne();

    // 5. Total Mora Acumulada (DB Aggregation with joins)
    // This is more efficient than fetching all and looping
    const overdueStats = await this.scheduleRepository
      .createQueryBuilder('schedule')
      .leftJoin('schedule.contract', 'contract')
      .select('schedule.saldo', 'saldo')
      .addSelect('schedule.fechaVencimiento', 'fechaVencimiento')
      .addSelect('contract.moraPorcentaje', 'moraPorcentaje')
      .where('schedule.estado != :paid', { paid: ScheduleStatus.PAGADA })
      .andWhere('schedule.fechaVencimiento < :today', { today })
      .getRawMany();

    const totalMoraAcumulada = overdueStats.reduce((sum, s) => {
      const diasAtraso = differenceInDays(today, new Date(s.fechaVencimiento));
      const mora = (parseFloat(s.saldo) * parseFloat(s.moraPorcentaje || 0) / 100) * diasAtraso;
      return sum + mora;
    }, 0);

    // 6. Semaforo distribution (already uses report item logic)
    const trafficLight = await this.getTrafficLightReport();
    const semaforo = {
      verde: 0,
      ambar: 0,
      rojo: 0
    };
    trafficLight.forEach(t => {
      if (semaforo[t.semaforo] !== undefined) semaforo[t.semaforo]++;
    });

    // 7. Last 6 months collections (Optimized loop)
    const cobranzasMensuales: { mes: string; cobrado: number; pendiente: number }[] = [];
    const months: { start: Date; end: Date; name: string }[] = [];
    for (let i = 5; i >= 0; i--) {
      const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
      months.push({
        start: date,
        end: new Date(date.getFullYear(), date.getMonth() + 1, 0),
        name: date.toLocaleString('es-PE', { month: 'short' })
      });
    }

    // Run monthly data queries in parallel
    const monthlyData = await Promise.all(months.map(async (month) => {
      const [{ cobrado }, { pendiente }] = await Promise.all([
        this.paymentRepository
          .createQueryBuilder('payment')
          .select('SUM(payment.importe)', 'cobrado')
          .where('payment.fechaPago >= :start AND payment.fechaPago <= :end', { start: month.start, end: month.end })
          .getRawOne(),
        this.scheduleRepository
          .createQueryBuilder('schedule')
          .select('SUM(schedule.saldo)', 'pendiente')
          .where('schedule.fechaVencimiento >= :start AND schedule.fechaVencimiento <= :end', { start: month.start, end: month.end })
          .andWhere('schedule.estado != :paid', { paid: ScheduleStatus.PAGADA })
          .getRawOne()
      ]);
      return { 
        mes: month.name, 
        cobrado: parseFloat(cobrado || 0), 
        pendiente: parseFloat(pendiente || 0) 
      };
    }));

    return {
      totalVehiculos,
      vehiculosDisponibles,
      contratosVigentes,
      totalCobradoMes: parseFloat(totalCobradoMes || 0),
      totalPendiente: parseFloat(totalPendiente || 0),
      totalMoraAcumulada: Math.round(totalMoraAcumulada * 100) / 100,
      semaforo,
      cobranzasMensuales: monthlyData,
    };
  }
}
