import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
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
  
  await app.listen(3001);
  console.log('🚀 Backend running on http://localhost:3001');
}
bootstrap();
