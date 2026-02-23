import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('Authentication (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  const testUser = {
    email: `test-${Date.now()}@example.com`,
    password: 'password123',
    nombre: 'Test',
    apellido: 'User',
  };

  it('/api/auth/register (POST) - Success', () => {
    return request(app.getHttpServer())
      .post('/api/auth/register')
      .send(testUser)
      .expect(201)
      .expect((res) => {
        expect(res.body.user).toBeDefined();
        expect(res.body.user.email).toBe(testUser.email);
        expect(res.body.accessToken).toBeDefined();
      });
  });

  it('/api/auth/login (POST) - Success', () => {
    return request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        email: testUser.email,
        password: testUser.password,
      })
      .expect(200)
      .expect((res) => {
        expect(res.body.accessToken).toBeDefined();
        expect(res.body.user.nombre).toBe(testUser.nombre);
      });
  });

  it('/api/auth/login (POST) - Failure (Wrong Password)', () => {
    return request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        email: testUser.email,
        password: 'wrongpassword',
      })
      .expect(401);
  });
});
