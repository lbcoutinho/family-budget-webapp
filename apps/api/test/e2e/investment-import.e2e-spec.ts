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
  const call = (method: 'delete' | 'get' | 'post', path: string): request.Test =>
    request(server)[method](`/api${path}`).set('Authorization', `Bearer ${token}`);

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
    await prisma.positionAdjustment.deleteMany({ where: { userId } });
    await prisma.balanceAdjustment.deleteMany({ where: { userId } });
    await prisma.investmentTrade.deleteMany({ where: { userId } });
    await prisma.importBatch.deleteMany({ where: { userId } });
    await prisma.accountInitialBalance.deleteMany({ where: { userId } });
    await prisma.account.deleteMany({ where: { userId } });
    await prisma.financialInstitution.deleteMany({ where: { userId } });
    await prisma.instrument.deleteMany({ where: { userId } });
  });

  afterAll(async () => {
    await prisma.positionAdjustment.deleteMany({ where: { userId } });
    await prisma.balanceAdjustment.deleteMany({ where: { userId } });
    await prisma.investmentTrade.deleteMany({ where: { userId } });
    await prisma.importBatch.deleteMany({ where: { userId } });
    await prisma.accountInitialBalance.deleteMany({ where: { userId } });
    await prisma.account.deleteMany({ where: { userId } });
    await prisma.financialInstitution.deleteMany({ where: { userId } });
    await prisma.instrument.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } });
    await app.close();
  });

  async function setup(): Promise<{ accountId: string; btcId: string; eurId: string }> {
    const institution = (await call('post', '/financial-institutions').send({ name: 'Kraken' }).expect(201)).body as { id: string };
    const eur = (await call('post', '/instruments').send({ name: 'Euro', code: 'EUR', type: 'FIAT' }).expect(201)).body as { id: string };
    const btc = (await call('post', '/instruments').send({ name: 'Bitcoin', code: 'BTC', type: 'CRYPTOCURRENCY' }).expect(201)).body as { id: string };
    const account = await call('post', '/accounts')
      .send({ name: 'Spot', kind: 'EXCHANGE', financialInstitutionId: institution.id, initialBalances: [{ instrumentId: eur.id, quantity: '200' }] })
      .expect(201);
    return { accountId: (account.body as { id: string }).id, btcId: btc.id, eurId: eur.id };
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

  it('previews and rolls back a whole batch, replaying later operations', async () => {
    const { accountId, btcId, eurId } = await setup();
    const confirmation = await call('post', '/investment-import/confirm').attach('file', Buffer.from(csv()), 'trades.csv').expect(201);
    const batchId = (confirmation.body as { batchId: string }).batchId;
    await call('post', '/investment-trades')
      .send({
        accountId,
        acquiredInstrumentId: btcId,
        acquiredQuantity: '0.001',
        disposedInstrumentId: eurId,
        disposedQuantity: '10',
        executionValue: 1000,
        executedAt: '2026-01-02T12:00:00.000Z',
      })
      .expect(201);
    await call('post', '/position-adjustments')
      .send({ accountId, instrumentId: btcId, quantity: '0.001', cost: 100, effectiveAt: '2026-01-03T12:00:00.000Z', reason: 'Custody check' })
      .expect(201);
    await call('post', '/balance-adjustments')
      .send({ accountId, instrumentId: eurId, quantity: '1', effectiveAt: '2026-01-03T12:00:00.000Z', reason: 'Cash check' })
      .expect(201);

    await call('get', `/investment-import/${batchId}/rollback-preview`)
      .expect(200)
      .expect(
        ({
          body,
        }: {
          body: { importedTrades: unknown[]; laterTrades: unknown[]; laterPositionAdjustments: unknown[]; laterBalanceAdjustments: unknown[] };
        }) => {
          expect(body.importedTrades).toHaveLength(1);
          expect(body.laterTrades).toHaveLength(1);
          expect(body.laterPositionAdjustments).toHaveLength(1);
          expect(body.laterBalanceAdjustments).toHaveLength(1);
        },
      );
    await call('delete', `/investment-import/${batchId}`).expect(204);

    expect((await call('get', '/investment-trades').expect(200)).body).toEqual([expect.objectContaining({ isImported: false })]);
    expect((await call('get', '/accounts/instrument-balances').expect(200)).body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ accountId, instrumentId: eurId, quantity: '191' }),
        expect.objectContaining({ accountId, instrumentId: btcId, quantity: '0.002' }),
      ]),
    );
    expect((await call('get', '/investment-positions').expect(200)).body).toEqual(
      expect.arrayContaining([expect.objectContaining({ accountId, instrumentId: btcId, quantity: '0.002', remainingCost: 1100 })]),
    );
  });

  it('rejects a rollback that makes a later long-only operation invalid', async () => {
    const { accountId, btcId, eurId } = await setup();
    const confirmation = await call('post', '/investment-import/confirm').attach('file', Buffer.from(csv()), 'trades.csv').expect(201);
    const batchId = (confirmation.body as { batchId: string }).batchId;
    const laterTrade = await call('post', '/investment-trades')
      .send({
        accountId,
        acquiredInstrumentId: eurId,
        acquiredQuantity: '100',
        disposedInstrumentId: btcId,
        disposedQuantity: '0.01',
        executionValue: 10000,
        executedAt: '2026-01-02T12:00:00.000Z',
      })
      .expect(201);

    await call('delete', `/investment-import/${batchId}`)
      .expect(409)
      .expect(({ body }: { body: { code: string; operationId: string } }) => {
        expect(body.code).toBe('INVESTMENT_TRADE_INSUFFICIENT_FUNDS');
        expect(body.operationId).toBe((laterTrade.body as { id: string }).id);
      });
    expect((await call('get', '/investment-trades').expect(200)).body).toHaveLength(2);
  });
});
