import { type Server } from 'node:http';

import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/app.setup';
import { CategoryKind, type Prisma, type TransactionType } from '../../src/generated/prisma/client';
import { type SessionDto } from '../../src/modules/auth/dto/session.dto';
import { HashService } from '../../src/modules/auth/hash.service';
import { type MonthlyReportDto } from '../../src/modules/reports/dto/monthly-report.dto';
import { PrismaService } from '../../src/prisma/prisma.service';

/**
 * `GET /reports/monthly` (M6-T01, #181), over the real request pipeline and a real database.
 * Fixtures are seeded through Prisma directly rather than through the transaction endpoint — same
 * rationale as `balances.e2e-spec.ts`: the point of this suite is the aggregation, not the write path.
 *
 * Requires migrations applied (`docker compose up -d postgres` then `pnpm --filter api db:migrate`).
 */
describe('Reports API (e2e)', () => {
  let app: INestApplication;
  let server: Server;
  let prisma: PrismaService;

  let token: string;
  let otherToken: string;
  let userId: string;
  let accountId: string;
  let otherAccountId: string;
  let cashboxId: string;
  let otherCashboxId: string;
  let incomeCategoryId: string;
  let expenseCategoryId: string;

  const password = 'correct horse battery staple';
  const emails = ['reports.api.e2e@family-budget.test', 'reports.api.e2e.other@family-budget.test'];

  const authed = (method: 'get', path: string, as = token): request.Test => request(server)[method](`/api${path}`).set('Authorization', `Bearer ${as}`);

  const seed = (overrides: Partial<Prisma.TransactionUncheckedCreateInput> & { type: TransactionType; amount: number }): Promise<{ id: string }> =>
    prisma.transaction.create({
      data: { userId, date: new Date('2026-05-15'), referenceMonth: new Date('2026-05-01'), description: 'fixture', ...overrides },
      select: { id: true },
    });

  const removeFixtures = async (): Promise<void> => {
    await prisma.transaction.deleteMany({ where: { user: { email: { in: emails } } } });
  };

  const removeMasterData = async (): Promise<void> => {
    await prisma.account.deleteMany({ where: { user: { email: { in: emails } } } });
    await prisma.cashbox.deleteMany({ where: { user: { email: { in: emails } } } });
    await prisma.category.deleteMany({ where: { user: { email: { in: emails } } } });
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
      await prisma.user.upsert({ where: { email }, create: { email, name: 'Reports E2E', passwordHash }, update: { passwordHash } });
    }

    const [session, otherSession] = await Promise.all(
      emails.map(async (email) => (await request(server).post('/api/auth/login').send({ email, password }).expect(200)).body as SessionDto),
    );

    token = session!.accessToken;
    otherToken = otherSession!.accessToken;
  });

  beforeEach(async () => {
    await removeFixtures();
    await removeMasterData();

    const user = await prisma.user.findUniqueOrThrow({ where: { email: emails[0] }, select: { id: true } });
    userId = user.id;

    const [account, otherAccount, cashbox, otherCashbox, incomeCategory, expenseCategory] = await Promise.all([
      prisma.account.create({ data: { userId, name: 'Millennium', initialBalance: 1_000 }, select: { id: true } }),
      prisma.account.create({ data: { userId, name: 'Poupança', initialBalance: 0 }, select: { id: true } }),
      prisma.cashbox.create({ data: { userId, name: 'Carro' }, select: { id: true } }),
      prisma.cashbox.create({ data: { userId, name: 'Férias' }, select: { id: true } }),
      prisma.category.create({ data: { userId, name: 'Salário', kind: CategoryKind.INCOME }, select: { id: true } }),
      prisma.category.create({ data: { userId, name: 'Alimentação', kind: CategoryKind.EXPENSE }, select: { id: true } }),
    ]);
    accountId = account.id;
    otherAccountId = otherAccount.id;
    cashboxId = cashbox.id;
    otherCashboxId = otherCashbox.id;
    incomeCategoryId = incomeCategory.id;
    expenseCategoryId = expenseCategory.id;
  });

  afterAll(async () => {
    await removeFixtures();
    await removeMasterData();
    await prisma.user.deleteMany({ where: { email: { in: emails } } });
    await app.close();
  });

  it('answers 401 without a token', async () => {
    await request(server).get('/api/reports/monthly?year=2026&month=5').expect(401);
  });

  it('answers 400 for an out-of-range year or month', async () => {
    await authed('get', '/reports/monthly?year=1999&month=5').expect(400);
    await authed('get', '/reports/monthly?year=2026&month=13').expect(400);
  });

  it('returns the zeroed structure for a month with no fixtures', async () => {
    const body = (await authed('get', '/reports/monthly?year=2026&month=1').expect(200)).body as MonthlyReportDto;

    expect(body).toMatchObject({
      year: 2026,
      month: 1,
      incomeTotal: 0,
      expenseTotal: 0,
      balance: 0,
      categories: [],
      cashboxes: { items: [], depositsTotal: 0, withdrawalsTotal: 0, balance: 0 },
    });
  });

  it('sums every one of the 6 transaction types to an exact cents figure, excluding TRANSFER and CASHBOX_* from income/expense', async () => {
    await Promise.all([
      seed({ type: 'INCOME', amount: 5_000, accountId, categoryId: incomeCategoryId }),
      seed({ type: 'EXPENSE', amount: 2_000, accountId, categoryId: expenseCategoryId }),
      seed({ type: 'TRANSFER', amount: 1_000, accountId, destinationAccountId: otherAccountId }),
      seed({ type: 'CASHBOX_IN', amount: 800, accountId, cashboxId }),
      seed({ type: 'CASHBOX_OUT', amount: 300, accountId, cashboxId }),
      seed({ type: 'CASHBOX_TRANSFER', amount: 200, cashboxId, destinationCashboxId: otherCashboxId }),
    ]);

    const body = (await authed('get', '/reports/monthly?year=2026&month=5').expect(200)).body as MonthlyReportDto;

    expect(body).toMatchObject({ incomeTotal: 5_000, expenseTotal: 2_000, balance: 3_000 });

    expect(body.categories.find((c) => c.categoryId === incomeCategoryId)).toMatchObject({ kind: 'INCOME', amount: 5_000, percentage: 100 });
    expect(body.categories.find((c) => c.categoryId === expenseCategoryId)).toMatchObject({ kind: 'EXPENSE', amount: 2_000, percentage: 100 });

    // CASHBOX_IN(800) deposit; CASHBOX_OUT(300) + CASHBOX_TRANSFER-source(200) withdrawals -> balance 300.
    expect(body.cashboxes.items.find((c) => c.cashboxId === cashboxId)).toMatchObject({ deposits: 800, withdrawals: 500, balance: 300 });
    // CASHBOX_TRANSFER-destination(200) deposit only -> balance 200.
    expect(body.cashboxes.items.find((c) => c.cashboxId === otherCashboxId)).toMatchObject({ deposits: 200, withdrawals: 0, balance: 200 });
    expect(body.cashboxes).toMatchObject({ depositsTotal: 1_000, withdrawalsTotal: 500, balance: 500 });
  });

  it('reports a credit-card transaction under its referenceMonth, not its date', async () => {
    await seed({
      type: 'EXPENSE',
      amount: 1_500,
      accountId,
      categoryId: expenseCategoryId,
      isCreditCard: true,
      date: new Date('2026-04-20'),
      referenceMonth: new Date('2026-05-01'),
    });

    const dateMonth = (await authed('get', '/reports/monthly?year=2026&month=4').expect(200)).body as MonthlyReportDto;
    expect(dateMonth).toMatchObject({ expenseTotal: 0, categories: [] });

    const referenceMonth = (await authed('get', '/reports/monthly?year=2026&month=5').expect(200)).body as MonthlyReportDto;
    expect(referenceMonth).toMatchObject({ expenseTotal: 1_500 });
    expect(referenceMonth.categories.find((c) => c.categoryId === expenseCategoryId)).toMatchObject({ amount: 1_500 });
  });

  it('excludes a DRAFT transaction from every total', async () => {
    await seed({ type: 'INCOME', amount: 1_000_000, accountId, categoryId: incomeCategoryId, status: 'DRAFT', source: 'VOICE' });

    const body = (await authed('get', '/reports/monthly?year=2026&month=5').expect(200)).body as MonthlyReportDto;

    expect(body).toMatchObject({ incomeTotal: 0, categories: [] });
  });

  it("never lets another user's transactions leak into the caller's report", async () => {
    await seed({ type: 'INCOME', amount: 999_999, accountId, categoryId: incomeCategoryId });

    const otherBody = (await authed('get', '/reports/monthly?year=2026&month=5', otherToken).expect(200)).body as MonthlyReportDto;

    expect(otherBody).toMatchObject({ incomeTotal: 0, expenseTotal: 0, categories: [] });
  });
});
