import { type Server } from 'node:http';

import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/app.setup';
import { type Prisma, type TransactionType } from '../../src/generated/prisma/client';
import { type AccountBalanceDto } from '../../src/modules/accounts/dto/account-balance.dto';
import { type SessionDto } from '../../src/modules/auth/dto/session.dto';
import { HashService } from '../../src/modules/auth/hash.service';
import { type CashboxBalanceDto } from '../../src/modules/cashboxes/dto/cashbox-balance.dto';
import { PrismaService } from '../../src/prisma/prisma.service';

/**
 * `GET /accounts/balances` and `GET /cashboxes/balances` (M4-T07, #104), over the real request
 * pipeline and a real database. Fixtures are seeded through Prisma directly rather than through the
 * transaction endpoint — the point of this suite is the aggregation, not the write path, and
 * `CASHBOX_TRANSFER`/`TRANSFER` seeded this way don't need the create-side validation to pass.
 *
 * Requires migrations applied (`docker compose up -d postgres` then `pnpm --filter api db:migrate`).
 */
describe('Balances API (e2e)', () => {
  let app: INestApplication;
  let server: Server;
  let prisma: PrismaService;

  let token: string;
  let otherToken: string;
  let userId: string;
  let accountId: string;
  let otherAccountId: string;
  let inactiveAccountId: string;
  let cashboxId: string;
  let otherCashboxId: string;
  let inactiveCashboxId: string;

  const password = 'correct horse battery staple';
  const emails = ['balances.api.e2e@family-budget.test', 'balances.api.e2e.other@family-budget.test'];

  const authed = (method: 'get', path: string, as = token): request.Test => request(server)[method](`/api${path}`).set('Authorization', `Bearer ${as}`);

  const seed = (overrides: Partial<Prisma.TransactionUncheckedCreateInput> & { type: TransactionType; amount: number }): Promise<{ id: string }> =>
    prisma.transaction.create({
      data: { userId, date: new Date('2026-03-15'), referenceMonth: new Date('2026-03-01'), description: 'fixture', ...overrides },
      select: { id: true },
    });

  const removeFixtures = async (): Promise<void> => {
    await prisma.transaction.deleteMany({ where: { user: { email: { in: emails } } } });
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();

    server = app.getHttpServer() as Server;
    prisma = app.get(PrismaService);

    const passwordHash = await app.get(HashService).hash(password);

    for (const email of emails) {
      await prisma.user.upsert({ where: { email }, create: { email, name: 'Balances E2E', passwordHash }, update: { passwordHash } });
    }

    const [session, otherSession] = await Promise.all(
      emails.map(async (email) => (await request(server).post('/api/auth/login').send({ email, password }).expect(200)).body as SessionDto),
    );

    token = session!.accessToken;
    otherToken = otherSession!.accessToken;
  });

  beforeEach(async () => {
    await removeFixtures();
    await prisma.account.deleteMany({ where: { user: { email: { in: emails } } } });
    await prisma.cashbox.deleteMany({ where: { user: { email: { in: emails } } } });

    const user = await prisma.user.findUniqueOrThrow({ where: { email: emails[0] }, select: { id: true } });
    userId = user.id;

    const [account, otherAccount, inactiveAccount, cashbox, otherCashbox, inactiveCashbox] = await Promise.all([
      prisma.account.create({ data: { userId, name: 'Millennium', initialBalance: 1_000 }, select: { id: true } }),
      prisma.account.create({ data: { userId, name: 'Poupança', initialBalance: 0 }, select: { id: true } }),
      prisma.account.create({ data: { userId, name: 'Encerrada', isActive: false, initialBalance: 500 }, select: { id: true } }),
      prisma.cashbox.create({ data: { userId, name: 'Carro' }, select: { id: true } }),
      prisma.cashbox.create({ data: { userId, name: 'Férias' }, select: { id: true } }),
      prisma.cashbox.create({ data: { userId, name: 'Aposentado', isActive: false }, select: { id: true } }),
    ]);
    accountId = account.id;
    otherAccountId = otherAccount.id;
    inactiveAccountId = inactiveAccount.id;
    cashboxId = cashbox.id;
    otherCashboxId = otherCashbox.id;
    inactiveCashboxId = inactiveCashbox.id;
    await prisma.account.updateMany({ where: { userId }, data: { createdAt: new Date('2026-01-15') } });
  });

  afterAll(async () => {
    await removeFixtures();
    await prisma.account.deleteMany({ where: { user: { email: { in: emails } } } });
    await prisma.cashbox.deleteMany({ where: { user: { email: { in: emails } } } });
    await prisma.user.deleteMany({ where: { email: { in: emails } } });
    await app.close();
  });

  it('answers 401 without a token', async () => {
    await request(server).get('/api/accounts/balances').expect(401);
    await request(server).get('/api/cashboxes/balances').expect(401);
  });

  describe('accounts', () => {
    it('sums every one of the 6 transaction types to an exact cents figure', async () => {
      await Promise.all([
        seed({ type: 'INCOME', amount: 10_000, accountId }),
        seed({ type: 'EXPENSE', amount: 3_000, accountId }),
        seed({ type: 'CASHBOX_IN', amount: 1_000, accountId, cashboxId }),
        seed({ type: 'CASHBOX_OUT', amount: 400, accountId, cashboxId }),
        seed({ type: 'CASHBOX_TRANSFER', amount: 200, cashboxId, destinationCashboxId: otherCashboxId }),
        seed({ type: 'TRANSFER', amount: 2_000, accountId, destinationAccountId: otherAccountId }),
      ]);

      const body = (await authed('get', '/accounts/balances').expect(200)).body as AccountBalanceDto[];

      // initialBalance(1_000) + INCOME(10_000) - EXPENSE(3_000) - CASHBOX_IN(1_000) + CASHBOX_OUT(400) - TRANSFER-source(2_000)
      expect(body.find((a) => a.accountId === accountId)).toMatchObject({ initialBalance: 1_000, balance: 5_400 });
      // initialBalance(0) + TRANSFER-destination(2_000)
      expect(body.find((a) => a.accountId === otherAccountId)).toMatchObject({ initialBalance: 0, balance: 2_000 });
    });

    it('excludes a DRAFT transaction from the balance', async () => {
      await seed({ type: 'INCOME', amount: 1_000_000, accountId, status: 'DRAFT', source: 'VOICE' });

      const body = (await authed('get', '/accounts/balances').expect(200)).body as AccountBalanceDto[];

      expect(body.find((a) => a.accountId === accountId)).toMatchObject({ balance: 1_000 });
    });

    it('reports initialBalance for an account with no confirmed transactions', async () => {
      const body = (await authed('get', '/accounts/balances').expect(200)).body as AccountBalanceDto[];

      expect(body.find((a) => a.accountId === otherAccountId)).toMatchObject({ balance: 0 });
    });

    it('lists an inactive account, flagged accordingly', async () => {
      const body = (await authed('get', '/accounts/balances').expect(200)).body as AccountBalanceDto[];

      expect(body.find((a) => a.accountId === inactiveAccountId)).toMatchObject({ isActive: false, balance: 500 });
    });

    it('applies ?asOf as an inclusive upper bound on settlement date', async () => {
      await Promise.all([
        seed({ type: 'INCOME', amount: 1_000, accountId, date: new Date('2026-03-10'), settlementDate: new Date('2026-03-20') }),
        seed({ type: 'INCOME', amount: 2_000, accountId, date: new Date('2026-03-20'), settlementDate: new Date('2026-03-10') }),
      ]);

      const before = (await authed('get', '/accounts/balances?asOf=2026-03-15').expect(200)).body as AccountBalanceDto[];
      expect(before.find((a) => a.accountId === accountId)).toMatchObject({ balance: 3_000 });

      const onTheDay = (await authed('get', '/accounts/balances?asOf=2026-03-10').expect(200)).body as AccountBalanceDto[];
      expect(onTheDay.find((a) => a.accountId === accountId)).toMatchObject({ balance: 3_000 });
    });

    it('excludes a future confirmed settlement from the current balance', async () => {
      await seed({ type: 'EXPENSE', amount: 1_000, accountId, date: new Date('2026-03-15'), settlementDate: new Date('2099-01-01') });

      const current = (await authed('get', '/accounts/balances').expect(200)).body as AccountBalanceDto[];
      const future = (await authed('get', '/accounts/balances?asOf=2099-01-01').expect(200)).body as AccountBalanceDto[];

      expect(current.find((a) => a.accountId === accountId)).toMatchObject({ balance: 1_000 });
      expect(future.find((a) => a.accountId === accountId)).toMatchObject({ balance: 0 });
    });

    it('answers 400 for a malformed asOf', async () => {
      await authed('get', '/accounts/balances?asOf=not-a-date').expect(400);
    });

    it("never lets another user's transactions leak into the caller's balance", async () => {
      await seed({ type: 'INCOME', amount: 999_999, accountId });

      const otherBody = (await authed('get', '/accounts/balances', otherToken).expect(200)).body as AccountBalanceDto[];

      expect(otherBody.some((a) => a.accountId === accountId)).toBe(false);
    });
  });

  describe('cashboxes', () => {
    it('sums CASHBOX_IN/OUT/TRANSFER to an exact cents figure', async () => {
      await Promise.all([
        seed({ type: 'CASHBOX_IN', amount: 10_000, accountId, cashboxId }),
        seed({ type: 'CASHBOX_OUT', amount: 2_000, accountId, cashboxId }),
        seed({ type: 'CASHBOX_TRANSFER', amount: 3_000, cashboxId, destinationCashboxId: otherCashboxId }),
      ]);

      const body = (await authed('get', '/cashboxes/balances').expect(200)).body as CashboxBalanceDto[];

      expect(body.find((c) => c.cashboxId === cashboxId)).toMatchObject({ balance: 5_000 });
      expect(body.find((c) => c.cashboxId === otherCashboxId)).toMatchObject({ balance: 3_000 });
    });

    it('reports 0 for a cashbox with no confirmed transactions', async () => {
      const body = (await authed('get', '/cashboxes/balances').expect(200)).body as CashboxBalanceDto[];

      expect(body.find((c) => c.cashboxId === otherCashboxId)).toMatchObject({ balance: 0 });
    });

    it('lists an inactive cashbox with its balance', async () => {
      await seed({ type: 'CASHBOX_IN', amount: 1_000, accountId, cashboxId: inactiveCashboxId });

      const body = (await authed('get', '/cashboxes/balances').expect(200)).body as CashboxBalanceDto[];

      expect(body.find((c) => c.cashboxId === inactiveCashboxId)).toMatchObject({ isActive: false, balance: 1_000 });
    });
  });

  describe('monthly balance', () => {
    it('closes confirmed reference-month movements, nets transfers, and carries the close through an empty month', async () => {
      await Promise.all([
        seed({ type: 'INCOME', amount: 10_000, accountId }),
        seed({ type: 'EXPENSE', amount: 3_000, accountId }),
        seed({ type: 'CASHBOX_IN', amount: 1_000, accountId, cashboxId }),
        seed({ type: 'CASHBOX_OUT', amount: 400, accountId, cashboxId }),
        seed({ type: 'TRANSFER', amount: 2_000, accountId, destinationAccountId: otherAccountId }),
        seed({ type: 'CASHBOX_TRANSFER', amount: 200, cashboxId, destinationCashboxId: otherCashboxId }),
        seed({ type: 'INCOME', amount: 999_999, accountId, status: 'DRAFT', source: 'VOICE' }),
      ]);
      const march = (await authed('get', '/reports/monthly-balance?year=2026&month=3').expect(200)).body as {
        previousAccountBalance: number;
        accountBalance: number;
        cashboxBalance: number;
        netWorth: number;
      };
      const april = (await authed('get', '/reports/monthly-balance?year=2026&month=4').expect(200)).body as typeof march;

      expect(march).toMatchObject({ previousAccountBalance: 1_500, accountBalance: 7_900, cashboxBalance: 600, netWorth: 8_500 });
      expect(april).toMatchObject({ previousAccountBalance: 7_900, accountBalance: 7_900, cashboxBalance: 600, netWorth: 8_500 });
    });

    it('starts initial balances in their creation month and excludes zero-balance inactive accounts', async () => {
      const [late, retired] = await Promise.all([
        prisma.account.create({ data: { userId, name: 'Late', initialBalance: 700, createdAt: new Date('2026-04-15') } }),
        prisma.account.create({ data: { userId, name: 'Retired zero', isActive: false, createdAt: new Date('2026-01-15') } }),
      ]);
      const march = (await authed('get', '/reports/monthly-balance?year=2026&month=3').expect(200)).body as {
        accountBalance: number;
        accounts: { accountId: string }[];
      };
      const april = (await authed('get', '/reports/monthly-balance?year=2026&month=4').expect(200)).body as typeof march;

      expect(march).toMatchObject({ accountBalance: 1_500 });
      expect(march.accounts.map((account) => account.accountId)).toContain(inactiveAccountId);
      expect(march.accounts.map((account) => account.accountId)).not.toContain(late.id);
      expect(march.accounts.map((account) => account.accountId)).not.toContain(retired.id);
      expect(april).toMatchObject({ accountBalance: 2_200 });
      expect(april.accounts.map((account) => account.accountId)).toContain(late.id);
    });

    it('includes movements recorded retrospectively for an account created after the closing month', async () => {
      const late = await prisma.account.create({ data: { userId, name: 'Retroactive', createdAt: new Date('2026-08-01') } });
      await Promise.all([
        seed({ type: 'INCOME', amount: 3_000, accountId: late.id, date: new Date('2026-07-01'), referenceMonth: new Date('2026-07-01') }),
        seed({ type: 'EXPENSE', amount: 1_000, accountId: late.id, date: new Date('2026-07-02'), referenceMonth: new Date('2026-07-01') }),
      ]);

      const july = (await authed('get', '/reports/monthly-balance?year=2026&month=7').expect(200)).body as {
        accountBalance: number;
        accounts: { accountId: string; balance: number }[];
      };

      expect(july.accountBalance).toBe(3_500);
      expect(july.accounts).toContainEqual({ accountId: late.id, balance: 2_000, isActive: true, name: 'Retroactive' });
    });
  });
});
