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
    await prisma.marketQuote.deleteMany({ where: { userId } });
    await prisma.accountInitialBalance.deleteMany({ where: { userId } });
    await prisma.account.deleteMany({ where: { userId } });
    await prisma.assetListing.deleteMany({ where: { userId } });
    await prisma.instrument.deleteMany({ where: { userId } });
  });

  afterAll(async () => {
    await prisma.investmentTrade.deleteMany({ where: { userId } });
    await prisma.marketQuote.deleteMany({ where: { userId } });
    await prisma.accountInitialBalance.deleteMany({ where: { userId } });
    await prisma.account.deleteMany({ where: { userId } });
    await prisma.assetListing.deleteMany({ where: { userId } });
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

  it('calculates remaining cost, weighted average, and realized result per account and consolidated', async () => {
    const eur = (await call('post', '/instruments').send({ name: 'Euro', code: 'EUR', type: 'FIAT' }).expect(201)).body as { id: string };
    const etf = (await call('post', '/instruments').send({ name: 'World ETF', code: 'VWCE', type: 'ETF', displayPrecision: 4 }).expect(201)).body as {
      id: string;
    };
    const account = (
      await call('post', '/accounts')
        .send({ name: 'Broker', kind: 'BROKERAGE', initialBalances: [{ instrumentId: eur.id, quantity: '6000' }] })
        .expect(201)
    ).body as { id: string };
    const trade = (
      acquiredInstrumentId: string,
      acquiredQuantity: string,
      disposedInstrumentId: string,
      disposedQuantity: string,
      executionValue: number,
      executedAt: string,
    ) =>
      call('post', '/investment-trades')
        .send({ accountId: account.id, acquiredInstrumentId, acquiredQuantity, disposedInstrumentId, disposedQuantity, executionValue, executedAt })
        .expect(201);

    await trade(etf.id, '10', eur.id, '1000', 100000, '2026-01-01T00:00:00.000Z');
    await trade(etf.id, '10', eur.id, '2000', 200000, '2026-02-01T00:00:00.000Z');
    await trade(eur.id, '3750', etf.id, '15', 375000, '2026-03-01T00:00:00.000Z');

    const afterSale = (await call('get', '/investment-positions').expect(200)).body as Position[];
    expect(afterSale).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          accountId: account.id,
          instrumentId: etf.id,
          quantity: '5',
          remainingCost: 75000,
          weightedAverageCost: '150.000000000000',
          realizedResult: 150000,
        }),
        expect.objectContaining({
          accountId: null,
          instrumentId: etf.id,
          quantity: '5',
          remainingCost: 75000,
          weightedAverageCost: '150.000000000000',
          realizedResult: 150000,
        }),
      ]),
    );

    await trade(etf.id, '10', eur.id, '2000', 200000, '2026-04-01T00:00:00.000Z');

    const positions = (await call('get', '/investment-positions').expect(200)).body as Position[];
    expect(positions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          accountId: account.id,
          instrumentId: etf.id,
          quantity: '15',
          remainingCost: 275000,
          weightedAverageCost: '183.333333333333',
          realizedResult: 150000,
        }),
        expect.objectContaining({
          accountId: null,
          instrumentId: etf.id,
          quantity: '15',
          remainingCost: 275000,
          weightedAverageCost: '183.333333333333',
          realizedResult: 150000,
        }),
      ]),
    );
  });

  it('keeps the weighted average after a partial sale with fractional-cent cost', async () => {
    const eur = (await call('post', '/instruments').send({ name: 'Euro', code: 'EUR', type: 'FIAT' }).expect(201)).body as { id: string };
    const etf = (await call('post', '/instruments').send({ name: 'Small ETF', code: 'SMALL', type: 'ETF' }).expect(201)).body as { id: string };
    const account = (
      await call('post', '/accounts')
        .send({ name: 'Fractional Broker', kind: 'BROKERAGE', initialBalances: [{ instrumentId: eur.id, quantity: '2' }] })
        .expect(201)
    ).body as { id: string };

    await call('post', '/investment-trades')
      .send({
        accountId: account.id,
        acquiredInstrumentId: etf.id,
        acquiredQuantity: '3',
        disposedInstrumentId: eur.id,
        disposedQuantity: '1',
        executionValue: 100,
        executedAt: '2026-01-01T00:00:00.000Z',
      })
      .expect(201);
    await call('post', '/investment-trades')
      .send({
        accountId: account.id,
        acquiredInstrumentId: eur.id,
        acquiredQuantity: '0.34',
        disposedInstrumentId: etf.id,
        disposedQuantity: '1',
        executionValue: 34,
        executedAt: '2026-02-01T00:00:00.000Z',
      })
      .expect(201);

    const positions = (await call('get', '/investment-positions').expect(200)).body as Position[];
    expect(positions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          accountId: account.id,
          instrumentId: etf.id,
          quantity: '2',
          remainingCost: 67,
          weightedAverageCost: '0.333333333333',
          realizedResult: 1,
        }),
      ]),
    );
  });

  it('charges a third-instrument fee to its balance and position, and names insufficient fee funds', async () => {
    const eur = (await call('post', '/instruments').send({ name: 'Euro', code: 'EUR', type: 'FIAT' }).expect(201)).body as { id: string };
    const bnb = (await call('post', '/instruments').send({ name: 'BNB', code: 'BNB', type: 'CRYPTOCURRENCY' }).expect(201)).body as { id: string };
    const btc = (await call('post', '/instruments').send({ name: 'Bitcoin', code: 'BTC', type: 'CRYPTOCURRENCY' }).expect(201)).body as { id: string };
    const account = (
      await call('post', '/accounts')
        .send({ name: 'Exchange', kind: 'EXCHANGE', initialBalances: [{ instrumentId: eur.id, quantity: '2000' }] })
        .expect(201)
    ).body as { id: string };

    await call('post', '/investment-trades')
      .send({
        accountId: account.id,
        acquiredInstrumentId: bnb.id,
        acquiredQuantity: '1',
        disposedInstrumentId: eur.id,
        disposedQuantity: '100',
        executionValue: 10000,
        executedAt: '2026-01-01T00:00:00.000Z',
      })
      .expect(201);

    await call('post', '/investment-trades')
      .send({
        accountId: account.id,
        acquiredInstrumentId: btc.id,
        acquiredQuantity: '0.02',
        disposedInstrumentId: eur.id,
        disposedQuantity: '1000',
        feeInstrumentId: bnb.id,
        feeQuantity: '0.1',
        feeValue: 2000,
        executionValue: 100000,
        executedAt: '2026-02-01T00:00:00.000Z',
      })
      .expect(201)
      .expect(({ body }: { body: unknown }) => expect(body).toMatchObject({ feeInstrumentId: bnb.id, feeQuantity: '0.1', feeValue: 2000 }));

    const balances = (await call('get', '/accounts/instrument-balances').expect(200)).body as { instrumentId: string; quantity: string }[];
    expect(balances).toEqual(expect.arrayContaining([expect.objectContaining({ instrumentId: bnb.id, quantity: '0.9' })]));

    const positions = (await call('get', '/investment-positions').expect(200)).body as Position[];
    expect(positions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ instrumentId: btc.id, quantity: '0.02', remainingCost: 102000 }),
        expect.objectContaining({ instrumentId: bnb.id, quantity: '0.9', remainingCost: 9000, realizedResult: 1000 }),
      ]),
    );

    await call('post', '/investment-trades')
      .send({
        accountId: account.id,
        acquiredInstrumentId: btc.id,
        acquiredQuantity: '0.01',
        disposedInstrumentId: eur.id,
        disposedQuantity: '1',
        feeInstrumentId: bnb.id,
        feeQuantity: '1',
        feeValue: 100,
        executionValue: 100,
        executedAt: '2026-03-01T00:00:00.000Z',
      })
      .expect(409)
      .expect(({ body }: { body: { code: string; instrumentCode: string; availableQuantity: string } }) =>
        expect(body).toMatchObject({ code: 'INVESTMENT_TRADE_INSUFFICIENT_FUNDS', instrumentCode: 'BNB', availableQuantity: '0.9' }),
      );
  });

  it('values consolidated and account positions from a manual EUR quote without changing cost', async () => {
    const eur = (await call('post', '/instruments').send({ name: 'Euro', code: 'EUR', type: 'FIAT' }).expect(201)).body as { id: string };
    const etf = (await call('post', '/instruments').send({ name: 'World ETF', code: 'VWCE', type: 'ETF' }).expect(201)).body as { id: string };
    const listing = (
      await call('post', '/asset-listings').send({ instrumentId: etf.id, quoteInstrumentId: eur.id, market: 'XETRA', ticker: 'VWCE' }).expect(201)
    ).body as { id: string };
    const account = (
      await call('post', '/accounts')
        .send({ name: 'Broker', kind: 'BROKERAGE', initialBalances: [{ instrumentId: eur.id, quantity: '1000' }] })
        .expect(201)
    ).body as { id: string };

    await call('post', '/investment-trades')
      .send({
        accountId: account.id,
        acquiredInstrumentId: etf.id,
        acquiredQuantity: '10',
        disposedInstrumentId: eur.id,
        disposedQuantity: '1000',
        executionValue: 100000,
        executedAt: '2026-01-01T00:00:00.000Z',
      })
      .expect(201);
    await call('post', '/market-quotes')
      .send({ assetListingId: listing.id, price: '125', marketDate: new Date().toISOString().slice(0, 10) })
      .expect(201);

    const positions = (await call('get', '/investment-positions').expect(200)).body as (Position & {
      currentValue: number;
      unrealizedResult: number;
      quoteStatus: string;
    })[];
    expect(positions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          accountId: account.id,
          instrumentId: etf.id,
          remainingCost: 100000,
          currentValue: 125000,
          unrealizedResult: 25000,
          quoteStatus: 'MANUAL',
        }),
        expect.objectContaining({
          accountId: null,
          instrumentId: etf.id,
          remainingCost: 100000,
          currentValue: 125000,
          unrealizedResult: 25000,
          quoteStatus: 'MANUAL',
        }),
      ]),
    );
  });
});

interface Position {
  accountId: string | null;
  instrumentId: string;
  quantity: string;
  remainingCost: number;
  weightedAverageCost: string;
  realizedResult: number;
}
