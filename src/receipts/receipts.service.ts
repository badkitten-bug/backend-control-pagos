import { Injectable } from '@nestjs/common';
import { SettingsService } from '../settings/settings.service';
import { Payment } from '../payments/payment.entity';
import { Contract } from '../contracts/contract.entity';
import PDFDocument from 'pdfkit';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

@Injectable()
export class ReceiptsService {
  constructor(private settingsService: SettingsService) {}

  async generateReceipt(payment: Payment, contract: Contract): Promise<Buffer> {
    const company = await this.settingsService.getCompanyInfo();
    
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A5', margin: 40 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Header
      doc.fontSize(16).font('Helvetica-Bold')
         .text(company.nombre || 'Control de Pagos', { align: 'center' });
      
      if (company.ruc) {
        doc.fontSize(10).font('Helvetica')
           .text(`RUC: ${company.ruc}`, { align: 'center' });
      }
      if (company.direccion) {
        doc.text(company.direccion, { align: 'center' });
      }
      if (company.telefono) {
        doc.text(`Tel: ${company.telefono}`, { align: 'center' });
      }

      doc.moveDown(2);

      // Receipt Title
      doc.fontSize(14).font('Helvetica-Bold')
         .text('RECIBO DE PAGO', { align: 'center' });
      doc.fontSize(10).font('Helvetica')
         .text(`N° ${String(payment.id).padStart(6, '0')}`, { align: 'center' });

      doc.moveDown(2);

      // Divider
      doc.moveTo(40, doc.y).lineTo(360, doc.y).stroke();
      doc.moveDown();

      // Details
      const leftCol = 40;
      const rightCol = 200;
      let y = doc.y;

      doc.font('Helvetica-Bold').text('Fecha:', leftCol, y);
      doc.font('Helvetica').text(
        format(new Date(payment.fechaPago), "dd 'de' MMMM 'de' yyyy", { locale: es }),
        rightCol, y
      );

      y += 20;
      doc.font('Helvetica-Bold').text('Cliente:', leftCol, y);
      doc.font('Helvetica').text(contract.clienteNombre || '-', rightCol, y);

      y += 20;
      doc.font('Helvetica-Bold').text('DNI:', leftCol, y);
      doc.font('Helvetica').text(contract.clienteDni || '-', rightCol, y);

      y += 20;
      doc.font('Helvetica-Bold').text('Vehículo:', leftCol, y);
      doc.font('Helvetica').text(
        contract.vehicle 
          ? `${contract.vehicle.placa} - ${contract.vehicle.marca} ${contract.vehicle.modelo}`
          : '-',
        rightCol, y
      );

      y += 20;
      doc.font('Helvetica-Bold').text('Contrato:', leftCol, y);
      doc.font('Helvetica').text(`#${contract.id}`, rightCol, y);

      y += 20;
      doc.font('Helvetica-Bold').text('Tipo de Pago:', leftCol, y);
      doc.font('Helvetica').text(payment.tipo, rightCol, y);

      y += 20;
      doc.font('Helvetica-Bold').text('Medio de Pago:', leftCol, y);
      doc.font('Helvetica').text(payment.medioPago, rightCol, y);

      if (payment.numeroOperacion) {
        y += 20;
        doc.font('Helvetica-Bold').text('N° Operación:', leftCol, y);
        doc.font('Helvetica').text(payment.numeroOperacion, rightCol, y);
      }

      doc.moveDown(2);

      // Divider
      doc.moveTo(40, doc.y).lineTo(360, doc.y).stroke();
      doc.moveDown();

      // Amount
      doc.fontSize(14).font('Helvetica-Bold')
         .text('IMPORTE: S/ ' + parseFloat(payment.importe.toString()).toFixed(2), { align: 'center' });

      doc.moveDown(2);

      // Footer message
      if (company.reciboMensaje) {
        doc.fontSize(10).font('Helvetica')
           .text(company.reciboMensaje, { align: 'center' });
      }

      doc.moveDown();
      doc.fontSize(8).text(
        `Generado el ${format(new Date(), "dd/MM/yyyy 'a las' HH:mm")}`,
        { align: 'center' }
      );

      doc.end();
    });
  }
}
