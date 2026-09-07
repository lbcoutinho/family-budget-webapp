import { type Server } from 'node:http';

import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/app.setup';
import { type SessionDto } from '../../src/modules/auth/dto/session.dto';
import { HashService } from '../../src/modules/auth/hash.service';
import { PrismaService } from '../../src/prisma/prisma.service';

describe('Budgets API (e2e)', () => {
  let app: INestApplication;
  let server: Server;
  let prisma: PrismaService;
  let token: string;
  let otherToken: string;

  const password = 'correct horse battery staple';
  const emails = ['budgets.api.e2e@family-budget.test', 'budgets.api.e2e.other@family-budget.test'];
  const authed = (method: 'get' | 'put', path: string, as = token): request.Test => request(server)[method](`/api${path}`).set('Authorization', `Bearer ${as}`);

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    server = app.getHttpServer() as Server;
    prisma = app.get(PrismaService);
    const passwordHash = await app.get(HashService).hash(password);
    for (const email of emails) {
      await prisma.user.upsert({ where: { email }, create: { email, name: 'Budgets E2E', passwordHash }, update: { passwordHash } });
    }
    const sessions = await Promise.all(
      emails.map(async (email) => ((await request(server).post('/api/auth/login').send({ email, password }).expect(200)).body as SessionDto).accessToken),
    );
    token = sessions[0]!;
    otherToken = sessions[1]!;
  });

  beforeEach(async () => prisma.budget.deleteMany({ where: { user: { email: { in: emails } } } }));

  afterAll(async () => {
    await prisma.budget.deleteMany({ where: { user: { email: { in: emails } } } });
    await prisma.user.deleteMany({ where: { email: { in: emails } } });
    await app.close();
  });

  it('requires authentication and does not persist an absent quarter', async () => {
    await request(server).get('/api/budgets/2026/3').expect(401);
    await authed('get', '/budgets/2026/3').expect(204);
    expect(await prisma.budget.count()).toBe(0);
  });

  it('creates, reads, and atomically replaces the one Budget for a quarter', async () => {
    await authed('put', '/budgets/2026/3').send({ estimatedQuarterlyIncome: 1_050_000, note: 'First plan' }).expect(200);
    await authed('put', '/budgets/2026/3').send({ estimatedQuarterlyIncome: 1_100_000, note: null }).expect(200);

    await expect(authed('get', '/budgets/2026/3').expect(200)).resolves.toMatchObject({
      body: { year: 2026, quarter: 3, estimatedQuarterlyIncome: 1_100_000, note: null },
    });
    expect(await prisma.budget.count()).toBe(1);
  });

  it('isolates the same period by owner', async () => {
    await authed('put', '/budgets/2026/3').send({ estimatedQuarterlyIncome: 100_000 }).expect(200);
    await authed('put', '/budgets/2026/3', otherToken).send({ estimatedQuarterlyIncome: 200_000 }).expect(200);

    await expect(authed('get', '/budgets/2026/3').expect(200)).resolves.toMatchObject({ body: { estimatedQuarterlyIncome: 100_000 } });
    await expect(authed('get', '/budgets/2026/3', otherToken).expect(200)).resolves.toMatchObject({ body: { estimatedQuarterlyIncome: 200_000 } });
    expect(await prisma.budget.count()).toBe(2);
  });

  it.each([
    ['/budgets/2026/0', { estimatedQuarterlyIncome: 100_000 }],
    ['/budgets/2026/5', { estimatedQuarterlyIncome: 100_000 }],
    ['/budgets/1999/1', { estimatedQuarterlyIncome: 100_000 }],
    ['/budgets/2026/1', { estimatedQuarterlyIncome: 0 }],
    ['/budgets/2026/1', { estimatedQuarterlyIncome: 1.5 }],
    ['/budgets/2026/1', { estimatedQuarterlyIncome: 100_000, userId: 'someone-else' }],
  ])('rejects invalid period or body for %s', async (path, body) => {
    await authed('put', path).send(body).expect(400);
  });
});
