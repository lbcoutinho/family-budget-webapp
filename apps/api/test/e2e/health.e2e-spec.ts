import { type Server } from 'node:http';

import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../../src/app.module';

/**
 * End-to-end coverage for the health endpoint. Requires a reachable database (docker-compose
 * `postgres`), since the check performs a real `SELECT 1`.
 */
describe('Health (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/health returns 200 with the database up', async () => {
    await request(app.getHttpServer() as Server)
      .get('/api/health')
      .expect(200)
      .expect({ status: 'ok', db: 'up' });
  });
});
