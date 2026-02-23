import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('Clients (e2e)', () => {
  let app: INestApplication<App>;
  let accessToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    const testUser = {
      email: `client-test-${Date.now()}@example.com`,
      password: 'password123',
      nombre: 'Client',
      apellido: 'Tester',
    };

    // Register
    const regRes = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send(testUser);
    
    if (regRes.status !== 201) {
      throw new Error(`Registration failed: ${JSON.stringify(regRes.body)}`);
    }

    // Login
    const loginRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: testUser.email, password: testUser.password });
    
    if (loginRes.status !== 200) {
      throw new Error(`Login failed: ${JSON.stringify(loginRes.body)}`);
    }
    
    accessToken = loginRes.body.accessToken;
    if (!accessToken) {
      throw new Error('No access token received');
    }
  });

  afterAll(async () => {
    await app.close();
  });

  const testClient = {
    dni: Math.floor(10000000 + Math.random() * 90000000).toString(),
    nombres: 'CLIENTE',
    apellidos: 'TEST',
    numeroBrevete: 'Q12345678',
    fechaVigenciaBrevete: '2030-01-01',
  };

  it('/api/clients (POST) - Create with new fields', () => {
    return request(app.getHttpServer())
      .post('/api/clients')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(testClient)
      .expect(201)
      .expect((res) => {
        expect(res.body.dni).toBe(testClient.dni);
        expect(res.body.numeroBrevete).toBe(testClient.numeroBrevete);
      });
  });

  it('/api/clients (GET) - List and verify fields', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/clients')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    
    const created = res.body.find((c: any) => c.dni === testClient.dni);
    expect(created).toBeDefined();
    expect(created.numeroBrevete).toBe(testClient.numeroBrevete);
  });
});
