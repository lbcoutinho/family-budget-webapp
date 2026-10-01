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

  async function setup(): Promise<{ accountId: string; bnbId: string; btcId: string; eurId: string }> {
    const institution = (await call('post', '/financial-institutions').send({ name: 'Kraken' }).expect(201)).body as { id: string };
    const eur = (await call('post', '/instruments').send({ name: 'Euro', code: 'EUR', type: 'FIAT' }).expect(201)).body as { id: string };
    const btc = (await call('post', '/instruments').send({ name: 'Bitcoin', code: 'BTC', type: 'CRYPTOCURRENCY' }).expect(201)).body as { id: string };
    const bnb = (await call('post', '/instruments').send({ name: 'BNB', code: 'BNB', type: 'CRYPTOCURRENCY' }).expect(201)).body as { id: string };
    const account = await call('post', '/accounts')
      .send({
        name: 'Spot',
        kind: 'EXCHANGE',
        financialInstitutionId: institution.id,
        initialBalances: [
          { instrumentId: eur.id, quantity: '200' },
          { instrumentId: bnb.id, quantity: '1' },
        ],
      })
      .expect(201);
    return { accountId: (account.body as { id: string }).id, bnbId: bnb.id, btcId: btc.id, eurId: eur.id };
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

  it('imports and persists a zero-cent fee without inventing cost', async () => {
    const { accountId, bnbId, btcId } = await setup();
    const row = 'trade-1,2026-01-01T12:00:00Z,Kraken,Spot,BTC,0.01,EUR,100,BNB,0.0001,0,,,10000,first';

    await call('post', '/investment-import/confirm')
      .attach('file', Buffer.from(`${headers}\n${row}`), 'trades.csv')
      .expect(201);

    expect((await call('get', '/investment-trades').expect(200)).body).toEqual([
      expect.objectContaining({ feeInstrumentId: bnbId, feeQuantity: '0.0001', feeValue: 0 }),
    ]);
    expect((await call('get', '/accounts/instrument-balances').expect(200)).body).toEqual(
      expect.arrayContaining([expect.objectContaining({ accountId, instrumentId: bnbId, quantity: '0.9999' })]),
    );
    expect((await call('get', '/investment-positions').expect(200)).body).toEqual(
      expect.arrayContaining([expect.objectContaining({ accountId, instrumentId: btcId, remainingCost: 10000 })]),
    );
  });

  it('warns about missing history without skipping rows and requires one acknowledgment before import', async () => {
    const { bnbId } = await setup();
    await call('post', '/instruments').send({ name: 'USD Coin', code: 'USDC', type: 'STABLECOIN' }).expect(201);
    const rows = [
      'stablecoin-gap,2026-01-01T12:00:00Z,Kraken,Spot,BTC,0.01,USDC,10,,,,,,1000,',
      'btc-gap,2026-01-02T12:00:00Z,Kraken,Spot,EUR,100,BTC,0.02,,,,,,10000,',
      'bnb-fee-gap,2026-01-03T12:00:00Z,Kraken,Spot,BTC,0.01,EUR,100,BNB,2,10,,,10000,',
    ];
    const file = Buffer.from(`${headers}\n${rows.join('\n')}`);

    await call('post', '/investment-import/preview')
      .attach('file', file, 'trades.csv')
      .expect(201)
      .expect(({ body }: { body: { validRows: number; errors: unknown[]; warnings: Record<string, string | number>[] } }) => {
        expect(body.validRows).toBe(3);
        expect(body.errors).toEqual([]);
        expect(body.warnings).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              line: 2,
              accountName: 'Spot',
              instrumentCode: 'USDC',
              availableQuantity: '0',
              requiredQuantity: '10',
              projectedQuantity: '-10',
            }),
            expect.objectContaining({ line: 3, instrumentCode: 'BTC', availableQuantity: '0.01', requiredQuantity: '0.02', projectedQuantity: '-0.01' }),
            expect.objectContaining({ line: 4, instrumentCode: 'BNB', availableQuantity: '1', requiredQuantity: '2', projectedQuantity: '-1' }),
          ]),
        );
      });

    await call('post', '/investment-import/confirm').attach('file', file, 'trades.csv').expect(400);
    expect((await call('get', '/investment-trades').expect(200)).body).toHaveLength(0);

    await call('post', '/investment-import/confirm').field('acknowledgeWarnings', 'true').attach('file', file, 'trades.csv').expect(201);
    expect((await call('get', '/investment-trades').expect(200)).body).toHaveLength(3);
    expect((await call('get', '/accounts/instrument-balances').expect(200)).body).toEqual(
      expect.arrayContaining([expect.objectContaining({ instrumentId: bnbId, quantity: '-1' })]),
    );
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
    await call('post', `/investment-import/${batchId}/rollback`).send({ confirm: true }).expect(204);

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

    await call('post', `/investment-import/${batchId}/rollback`)
      .send({ confirm: true })
      .expect(409)
      .expect(({ body }: { body: { code: string; operationId: string } }) => {
        expect(body.code).toBe('INVESTMENT_TRADE_INSUFFICIENT_FUNDS');
        expect(body.operationId).toBe((laterTrade.body as { id: string }).id);
      });
    expect((await call('get', '/investment-trades').expect(200)).body).toHaveLength(2);
  });
});
