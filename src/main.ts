import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  // Log de conexión BD (en Render debe verse "DATABASE_URL: sí" para usar pooler IPv4)
  const usePooler = !!process.env.DATABASE_URL;
  console.log(`[DB] ${usePooler ? 'DATABASE_URL definida (pooler 6543, IPv4)' : 'DATABASE_URL no definida - usando DB_HOST/5432 (puede fallar ENETUNREACH en Render)'}`);

  const app = await NestFactory.create(AppModule);
  
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
