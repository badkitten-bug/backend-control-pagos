import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Setting } from './setting.entity';

// Default settings
const DEFAULT_SETTINGS = [
  { clave: 'empresa_nombre', valor: 'Mi Empresa', tipo: 'string', descripcion: 'Nombre de la empresa' },
  { clave: 'empresa_ruc', valor: '', tipo: 'string', descripcion: 'RUC de la empresa' },
  { clave: 'empresa_direccion', valor: '', tipo: 'string', descripcion: 'Dirección de la empresa' },
  { clave: 'empresa_telefono', valor: '', tipo: 'string', descripcion: 'Teléfono de la empresa' },
  { clave: 'empresa_email', valor: '', tipo: 'string', descripcion: 'Email de la empresa' },
  { clave: 'empresa_logo', valor: '', tipo: 'string', descripcion: 'Ruta del logo de la empresa' },
  { clave: 'recibo_mensaje', valor: 'Gracias por su pago', tipo: 'string', descripcion: 'Mensaje en el recibo' },
];

@Injectable()
export class SettingsService implements OnModuleInit {
  constructor(
    @InjectRepository(Setting)
    private settingRepository: Repository<Setting>,
  ) {}

  async onModuleInit() {
    // Initialize default settings if they don't exist
    for (const setting of DEFAULT_SETTINGS) {
      const exists = await this.settingRepository.findOne({ where: { clave: setting.clave } });
      if (!exists) {
        await this.settingRepository.save(setting);
      }
    }
  }

  async get(clave: string): Promise<string | null> {
    const setting = await this.settingRepository.findOne({ where: { clave } });
    return setting?.valor || null;
  }

  async set(clave: string, valor: string): Promise<Setting> {
    let setting = await this.settingRepository.findOne({ where: { clave } });
    if (setting) {
      setting.valor = valor;
    } else {
      setting = this.settingRepository.create({ clave, valor });
    }
    return this.settingRepository.save(setting);
  }

  async getAll(): Promise<Record<string, string>> {
    const settings = await this.settingRepository.find();
    const result: Record<string, string> = {};
    for (const setting of settings) {
      result[setting.clave] = setting.valor || '';
    }
    return result;
  }

  async setMultiple(data: Record<string, string>): Promise<void> {
    for (const [clave, valor] of Object.entries(data)) {
      await this.set(clave, valor);
    }
  }

  async getCompanyInfo(): Promise<{
    nombre: string;
    ruc: string;
    direccion: string;
    telefono: string;
    email: string;
    logo: string;
    reciboMensaje: string;
  }> {
    const settings = await this.getAll();
    return {
      nombre: settings['empresa_nombre'] || '',
      ruc: settings['empresa_ruc'] || '',
      direccion: settings['empresa_direccion'] || '',
      telefono: settings['empresa_telefono'] || '',
      email: settings['empresa_email'] || '',
      logo: settings['empresa_logo'] || '',
      reciboMensaje: settings['recibo_mensaje'] || '',
    };
  }
}
