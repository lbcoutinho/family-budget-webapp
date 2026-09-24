import { type Server } from 'node:http';

import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/app.setup';
import { type SessionDto } from '../../src/modules/auth/dto/session.dto';
import { HashService } from '../../src/modules/auth/hash.service';
import { PrismaService } from '../../src/prisma/prisma.service';

describe('Investment trades API (e2e)', () => {
  let app: INestApplication;
  let server: Server;
  let prisma: PrismaService;
  let token: string;
  let userId: string;
  const email = 'investment-trades.e2e@family-budget.test';
  const password = 'correct horse battery staple';
  const call = (method: 'get' | 'post', path: string): request.Test => request(server)[method](`/api${path}`).set('Authorization', `Bearer ${token}`);

  beforeAll(async () => {
    app = (await Test.createTestingModule({ imports: [AppModule] }).compile()).createNestApplication();
    configureApp(app);
    await app.init();
    server = app.getHttpServer() as Server;
    prisma = app.get(PrismaService);
    const passwordHash = await app.get(HashService).hash(password);
    const user = await prisma.user.upsert({ where: { email }, create: { email, name: 'Investment trades E2E', passwordHash }, update: { passwordHash } });
    userId = user.id;
    token = ((await request(server).post('/api/auth/login').send({ email, password }).expect(200)).body as SessionDto).accessToken;
  });

  beforeEach(async () => {
    await prisma.investmentTrade.deleteMany({ where: { userId } });
    await prisma.accountInitialBalance.deleteMany({ where: { userId } });
    await prisma.account.deleteMany({ where: { userId } });
    await prisma.assetListing.deleteMany({ where: { userId } });
    await prisma.instrument.deleteMany({ where: { userId } });
  });

  afterAll(async () => {
    await prisma.investmentTrade.deleteMany({ where: { userId } });
    await prisma.accountInitialBalance.deleteMany({ where: { userId } });
    await prisma.account.deleteMany({ where: { userId } });
    await prisma.instrument.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } });
    await app.close();
  });

  it('records both exact legs and exposes the resulting instrument balances', async () => {
    const eur = (await call('post', '/instruments').send({ name: 'Euro', code: 'EUR', type: 'FIAT' }).expect(201)).body as { id: string };
    const btc = (await call('post', '/instruments').send({ name: 'Bitcoin', code: 'BTC', type: 'CRYPTOCURRENCY', displayPrecision: 8 }).expect(201)).body as {
      id: string;
    };
    const account = (
      await call('post', '/accounts')
        .send({ name: 'Kraken', kind: 'EXCHANGE', initialBalances: [{ instrumentId: eur.id, quantity: '1000' }] })
        .expect(201)
    ).body as { id: string };

    await call('post', '/investment-trades')
      .send({
        accountId: account.id,
        acquiredInstrumentId: btc.id,
        acquiredQuantity: '0.012345678901234567',
        disposedInstrumentId: eur.id,
        disposedQuantity: '500',
        executedAt: '2026-09-23T10:30:00.000Z',
        executionValue: 50000,
        notes: 'First Bitcoin purchase',
      })
      .expect(201)
      .expect(({ body }: { body: unknown }) =>
        expect(body).toMatchObject({ acquiredQuantity: '0.012345678901234567', disposedQuantity: '500', executionPrice: '40500.000364500006' }),
      );

    const balances = (await call('get', '/accounts/instrument-balances').expect(200)).body as { accountId: string; instrumentId: string; quantity: string }[];
    expect(balances).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ accountId: account.id, instrumentId: eur.id, quantity: '500' }),
        expect.objectContaining({ accountId: account.id, instrumentId: btc.id, quantity: '0.012345678901234567' }),
      ]),
    );
  });
});
