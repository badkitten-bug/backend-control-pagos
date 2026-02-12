import {
  Controller,
  Get,
  Post,
  Body,
  UseInterceptors,
  UploadedFile,
  Res,
  Param,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import type { Response } from 'express';
import { existsSync } from 'fs';
import { SettingsService } from './settings.service';

@Controller('settings')
export class SettingsController {
  constructor(private settingsService: SettingsService) {}

  @Get()
  getAll() {
    return this.settingsService.getAll();
  }

  @Get('company')
  getCompanyInfo() {
    return this.settingsService.getCompanyInfo();
  }

  @Post()
  async setMultiple(@Body() data: Record<string, string>) {
    await this.settingsService.setMultiple(data);
    return { message: 'Configuración guardada' };
  }

  @Post('logo')
  @UseInterceptors(
    FileInterceptor('logo', {
      storage: diskStorage({
        destination: './uploads',
        filename: (req, file, callback) => {
          const uniqueSuffix = Date.now();
          const ext = extname(file.originalname);
          callback(null, `logo-${uniqueSuffix}${ext}`);
        },
      }),
      fileFilter: (req, file, callback) => {
        if (!file.mimetype.match(/\/(jpg|jpeg|png|gif|webp)$/)) {
          callback(new Error('Solo se permiten imágenes'), false);
        }
        callback(null, true);
      },
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
      },
    }),
  )
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async uploadLogo(@UploadedFile() file: any) {
    if (!file) {
      return { error: 'No se recibió archivo' };
    }
    
    const logoPath = `/uploads/${file.filename}`;
    await this.settingsService.set('empresa_logo', logoPath);
    
    return { 
      message: 'Logo subido correctamente',
      path: logoPath,
    };
  }

  @Get('uploads/:filename')
  getUploadedFile(@Param('filename') filename: string, @Res() res: Response) {
    const filePath = join(process.cwd(), 'uploads', filename);
    if (existsSync(filePath)) {
      return res.sendFile(filePath);
    }
    return res.status(404).json({ error: 'Archivo no encontrado' });
  }
}
