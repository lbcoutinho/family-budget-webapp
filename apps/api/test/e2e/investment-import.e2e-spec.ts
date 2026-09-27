import { type Server } from 'node:http';

import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/app.setup';
import { type SessionDto } from '../../src/modules/auth/dto/session.dto';
import { HashService } from '../../src/modules/auth/hash.service';
import { PrismaService } from '../../src/prisma/prisma.service';

const headers =
  'external_id,executed_at_utc,institution,account,acquired_instrument,acquired_quantity,disposed_instrument,disposed_quantity,fee_instrument,fee_quantity,fee_value_eur_cents,asset_listing_ticker,asset_listing_market,execution_value_eur_cents,notes';
const csv = (externalId = 'trade-1') => `${headers}\n${externalId},2026-01-01T12:00:00Z,Kraken,Spot,BTC,0.01,EUR,100,,,,,,10000,first`;

describe('Investment import API (e2e)', () => {
  let app: INestApplication;
  let server: Server;
  let prisma: PrismaService;
  let token: string;
  let userId: string;
  const email = 'investment-import.e2e@family-budget.test';
  const password = 'correct horse battery staple';
  const call = (method: 'get' | 'post', path: string): request.Test => request(server)[method](`/api${path}`).set('Authorization', `Bearer ${token}`);

  beforeAll(async () => {
    app = (await Test.createTestingModule({ imports: [AppModule] }).compile()).createNestApplication();
    configureApp(app);
    await app.init();
    server = app.getHttpServer() as Server;
    prisma = app.get(PrismaService);
    const passwordHash = await app.get(HashService).hash(password);
    const user = await prisma.user.upsert({ where: { email }, create: { email, name: 'Investment import E2E', passwordHash }, update: { passwordHash } });
    userId = user.id;
    token = ((await request(server).post('/api/auth/login').send({ email, password }).expect(200)).body as SessionDto).accessToken;
  });

  beforeEach(async () => {
    await prisma.investmentTrade.deleteMany({ where: { userId } });
    await prisma.importBatch.deleteMany({ where: { userId } });
    await prisma.accountInitialBalance.deleteMany({ where: { userId } });
    await prisma.account.deleteMany({ where: { userId } });
    await prisma.financialInstitution.deleteMany({ where: { userId } });
    await prisma.instrument.deleteMany({ where: { userId } });
  });

  afterAll(async () => {
    await prisma.investmentTrade.deleteMany({ where: { userId } });
    await prisma.importBatch.deleteMany({ where: { userId } });
    await prisma.accountInitialBalance.deleteMany({ where: { userId } });
    await prisma.account.deleteMany({ where: { userId } });
    await prisma.financialInstitution.deleteMany({ where: { userId } });
    await prisma.instrument.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } });
    await app.close();
  });

  async function setup(): Promise<void> {
    const institution = (await call('post', '/financial-institutions').send({ name: 'Kraken', kind: 'EXCHANGE' }).expect(201)).body as { id: string };
    const eur = (await call('post', '/instruments').send({ name: 'Euro', code: 'EUR', type: 'FIAT' }).expect(201)).body as { id: string };
    await call('post', '/instruments').send({ name: 'Bitcoin', code: 'BTC', type: 'CRYPTOCURRENCY' }).expect(201);
    await call('post', '/accounts')
      .send({ name: 'Spot', kind: 'EXCHANGE', financialInstitutionId: institution.id, initialBalances: [{ instrumentId: eur.id, quantity: '100' }] })
      .expect(201);
  }

  it('confirms a batch atomically and keeps imported trades distinguishable', async () => {
    await setup();

    await call('post', '/investment-import/confirm')
      .attach('file', Buffer.from(csv()), 'trades.csv')
      .expect(201)
      .expect((response: { body: unknown }) => {
        const body = response.body as Record<string, unknown>;
        expect(body.batchId).toEqual(expect.any(String));
        expect(body.importedRows).toBe(1);
      });

    const trades = (await call('get', '/investment-trades').expect(200)).body as { isImported: boolean }[];
    expect(trades).toEqual([expect.objectContaining({ isImported: true })]);
  });

  it('rejects repeated external IDs and equivalent rows without partial writes', async () => {
    await setup();
    await call('post', '/investment-import/confirm').attach('file', Buffer.from(csv()), 'trades.csv').expect(201);

    await call('post', '/investment-import/confirm')
      .attach('file', Buffer.from(csv()), 'trades.csv')
      .expect(409)
      .expect(({ body }: { body: { code: string } }) => expect(body.code).toBe('INVESTMENT_IMPORT_DUPLICATE_EXTERNAL_ID'));
    await call('post', '/investment-import/confirm')
      .attach('file', Buffer.from(csv('different-id')), 'trades.csv')
      .expect(409)
      .expect(({ body }: { body: { code: string } }) => expect(body.code).toBe('INVESTMENT_IMPORT_DUPLICATE_CONTENT'));
    expect((await call('get', '/investment-trades').expect(200)).body).toHaveLength(1);
  });

  it('writes no operation when any row fails validation', async () => {
    await setup();

    await call('post', '/investment-import/confirm')
      .attach('file', Buffer.from(`${csv()}\n${csv('trade-2').split('\n')[1]!.replace(',0.01,EUR,100,', ',0.01,EUR,1000,')}`), 'trades.csv')
      .expect(400);

    expect((await call('get', '/investment-trades').expect(200)).body).toHaveLength(0);
  });
});
