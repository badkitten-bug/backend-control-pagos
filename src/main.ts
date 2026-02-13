import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { UsersService } from './users/users.service';

const DEMO_EMAIL = 'demo@demo.com';
const DEMO_PASSWORD = 'demo123';

async function bootstrap() {
  const hasDbUrl = !!process.env.DATABASE_URL;
  console.log(`[DB] ${hasDbUrl ? 'Postgres (DATABASE_URL)' : 'SQLite (demo - datos efímeros en cada deploy)'}`);

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

  // Global prefix for all routes
  app.setGlobalPrefix('api');

  // Enable CORS
  app.enableCors({
    origin: [
      'http://localhost:5173',
      'http://localhost:3000',
      'http://161.132.40.223',
      'http://sv-gGbrDIE0BxoM6dAKh5SW.cloud.elastika.pe',
      'https://sv-gGbrDIE0BxoM6dAKh5SW.cloud.elastika.pe',
    ],
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
bootstrap();
