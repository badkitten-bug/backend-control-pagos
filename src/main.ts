import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { UsersService } from './users/users.service';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

const DEMO_EMAIL = 'demo@demo.com';
const DEMO_PASSWORD = 'demo123';

async function bootstrap() {
  const hasDbUrl =
    !!process.env.DATABASE_URL &&
    (process.env.DATABASE_URL.startsWith('postgres') ||
      process.env.DATABASE_URL.startsWith('postgresql')) &&
    !process.env.DATABASE_URL.includes('database.sqlite');

  console.log(`[DB] Using ${hasDbUrl ? 'PostgreSQL' : 'SQLite'}`);

  const app = await NestFactory.create(AppModule);

  // Usuario de demo si la base está vacía (modo SQLite / primera vez)
  if (!hasDbUrl) {
    try {
      const usersService = app.get(UsersService);
      const existing = await usersService.findAll();
      if (existing.length === 0) {
        await usersService.create(DEMO_EMAIL, DEMO_PASSWORD, 'Demo', 'Usuario');
        console.log(`[Demo] Usuario creado: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
      }
    } catch {
      // Ignorar si falla (ej. módulo no listo)
    }
  }

  // Swagger configuration
  const config = new DocumentBuilder()
    .setTitle('Control de Pagos Vehiculares API')
    .setDescription('API para la gestión de vehículos, contratos y cobranzas')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  // Global prefix for all routes
  app.setGlobalPrefix('api');

  // Enable CORS (frontend en Vercel + local)
  app.enableCors({
    origin: true,
    credentials: true,
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = process.env.PORT || 3001;
  await app.listen(port, '0.0.0.0');
  console.log(`🚀 Backend running on port ${port}`);
}
void bootstrap();
