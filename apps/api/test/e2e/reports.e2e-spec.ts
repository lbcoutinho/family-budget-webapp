import { type Server } from 'node:http';

import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/app.setup';
import { CategoryKind, type Prisma, type TransactionType } from '../../src/generated/prisma/client';
import { type SessionDto } from '../../src/modules/auth/dto/session.dto';
import { HashService } from '../../src/modules/auth/hash.service';
import { type CashboxesReportDto } from '../../src/modules/reports/dto/cashboxes-report.dto';
import { type MonthlyReportDto } from '../../src/modules/reports/dto/monthly-report.dto';
import { type YearlyReportDto } from '../../src/modules/reports/dto/yearly-report.dto';
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

  const seed = ({
    date: inputDate,
    settlementDate: inputSettlementDate,
    referenceMonth: inputReferenceMonth,
    ...overrides
  }: Partial<Prisma.TransactionUncheckedCreateInput> & { type: TransactionType; amount: number }): Promise<{ id: string }> => {
    const date = inputDate ?? new Date('2026-05-15');
    const settlementDate = inputSettlementDate ?? (overrides.isCreditCard ? (inputReferenceMonth ?? date) : date);
    const settlement = new Date(settlementDate);
    const referenceMonth = new Date(Date.UTC(settlement.getUTCFullYear(), settlement.getUTCMonth(), 1));
    return prisma.transaction.create({ data: { userId, date, settlementDate, referenceMonth, description: 'fixture', ...overrides }, select: { id: true } });
  };

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

    expect(body.categories.find((c) => c.categoryId === incomeCategoryId)).toMatchObject({ kind: 'INCOME', amount: 5_000, percentage: 100, count: 1 });
    expect(body.categories.find((c) => c.categoryId === expenseCategoryId)).toMatchObject({ kind: 'EXPENSE', amount: 2_000, percentage: 100, count: 1 });

    // CASHBOX_IN(800) deposit; CASHBOX_OUT(300) + CASHBOX_TRANSFER-source(200) withdrawals -> balance 300.
    expect(body.cashboxes.items.find((c) => c.cashboxId === cashboxId)).toMatchObject({ deposits: 800, withdrawals: 500, balance: 300 });
    // CASHBOX_TRANSFER-destination(200) deposit only -> balance 200.
    expect(body.cashboxes.items.find((c) => c.cashboxId === otherCashboxId)).toMatchObject({ deposits: 200, withdrawals: 0, balance: 200 });
    expect(body.cashboxes).toMatchObject({ depositsTotal: 1_000, withdrawalsTotal: 500, balance: 500 });
  });

  it('counts every transaction folded into a category and its subcategory', async () => {
    const subcategory = await prisma.category.create({
      data: { userId, name: 'Supermercado', kind: CategoryKind.EXPENSE, parentId: expenseCategoryId },
      select: { id: true },
    });

    await Promise.all([
      seed({ type: 'EXPENSE', amount: 500, accountId, categoryId: expenseCategoryId, subcategoryId: subcategory.id }),
      seed({ type: 'EXPENSE', amount: 700, accountId, categoryId: expenseCategoryId, subcategoryId: subcategory.id }),
      seed({ type: 'EXPENSE', amount: 300, accountId, categoryId: expenseCategoryId }),
    ]);

    const body = (await authed('get', '/reports/monthly?year=2026&month=5').expect(200)).body as MonthlyReportDto;

    const category = body.categories.find((c) => c.categoryId === expenseCategoryId)!;
    expect(category.count).toBe(3);
    expect(category.subcategories.find((s) => s.subcategoryId === subcategory.id)).toMatchObject({ count: 2 });
    expect(category.subcategories.find((s) => s.subcategoryId === null)).toMatchObject({ count: 1 });
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

  describe('GET /reports/yearly', () => {
    it('answers 401 without a token', async () => {
      await request(server).get('/api/reports/yearly?year=2026').expect(401);
    });

    it('answers 400 for an out-of-range year', async () => {
      await authed('get', '/reports/yearly?year=1999').expect(400);
    });

    it('returns the zeroed structure for a year with no fixtures', async () => {
      const body = (await authed('get', '/reports/yearly?year=2020').expect(200)).body as YearlyReportDto;

      expect(body.year).toBe(2020);
      expect(body.categories).toEqual([]);
      expect(body.months).toHaveLength(12);
      expect(body.months.every((m) => m.income === 0 && m.expense === 0 && m.balance === 0)).toBe(true);
      expect(body.totals).toEqual({ income: 0, expense: 0, balance: 0 });
    });

    it('matches the sum of the year’s twelve monthly summaries for a complete past year', async () => {
      await Promise.all([
        seed({ type: 'INCOME', amount: 5_000, accountId, categoryId: incomeCategoryId, date: new Date('2020-02-10'), referenceMonth: new Date('2020-02-01') }),
        seed({
          type: 'EXPENSE',
          amount: 1_200,
          accountId,
          categoryId: expenseCategoryId,
          date: new Date('2020-02-10'),
          referenceMonth: new Date('2020-02-01'),
        }),
        seed({ type: 'EXPENSE', amount: 800, accountId, categoryId: expenseCategoryId, date: new Date('2020-09-10'), referenceMonth: new Date('2020-09-01') }),
      ]);

      const yearly = (await authed('get', '/reports/yearly?year=2020').expect(200)).body as YearlyReportDto;

      const [febRes, sepRes] = await Promise.all([
        authed('get', '/reports/monthly?year=2020&month=2').expect(200),
        authed('get', '/reports/monthly?year=2020&month=9').expect(200),
      ]);
      const feb = febRes.body as MonthlyReportDto;
      const sep = sepRes.body as MonthlyReportDto;

      expect(yearly.totals).toEqual({ income: feb.incomeTotal, expense: feb.expenseTotal + sep.expenseTotal, balance: feb.balance + sep.balance });
      expect(yearly.months[1]).toMatchObject({ month: 2, income: feb.incomeTotal, expense: feb.expenseTotal });
      expect(yearly.months[8]).toMatchObject({ month: 9, income: 0, expense: sep.expenseTotal });

      // A complete past year's own average reconciles with its own twelve columns.
      const groceries = yearly.categories.find((c) => c.categoryId === expenseCategoryId)!;
      expect(groceries.monthlyAverage).toBe(1_000); // (1_200 + 800) / 2 months with movement
    });

    it('sums every one of the 6 transaction types, excluding TRANSFER and CASHBOX_* from income/expense', async () => {
      await Promise.all([
        seed({ type: 'INCOME', amount: 5_000, accountId, categoryId: incomeCategoryId, date: new Date('2020-05-15'), referenceMonth: new Date('2020-05-01') }),
        seed({
          type: 'EXPENSE',
          amount: 2_000,
          accountId,
          categoryId: expenseCategoryId,
          date: new Date('2020-05-15'),
          referenceMonth: new Date('2020-05-01'),
        }),
        seed({
          type: 'TRANSFER',
          amount: 1_000,
          accountId,
          destinationAccountId: otherAccountId,
          date: new Date('2020-05-15'),
          referenceMonth: new Date('2020-05-01'),
        }),
        seed({ type: 'CASHBOX_IN', amount: 800, accountId, cashboxId, date: new Date('2020-05-15'), referenceMonth: new Date('2020-05-01') }),
        seed({ type: 'CASHBOX_OUT', amount: 300, accountId, cashboxId, date: new Date('2020-05-15'), referenceMonth: new Date('2020-05-01') }),
        seed({
          type: 'CASHBOX_TRANSFER',
          amount: 200,
          cashboxId,
          destinationCashboxId: otherCashboxId,
          date: new Date('2020-05-15'),
          referenceMonth: new Date('2020-05-01'),
        }),
      ]);

      const body = (await authed('get', '/reports/yearly?year=2020').expect(200)).body as YearlyReportDto;

      expect(body.totals).toEqual({ income: 5_000, expense: 2_000, balance: 3_000 });
      expect(body.categories.find((c) => c.categoryId === incomeCategoryId)).toMatchObject({ kind: 'INCOME', total: 5_000 });
      expect(body.categories.find((c) => c.categoryId === expenseCategoryId)).toMatchObject({ kind: 'EXPENSE', total: 2_000 });
    });

    it('excludes a DRAFT transaction from every total', async () => {
      await seed({
        type: 'INCOME',
        amount: 1_000_000,
        accountId,
        categoryId: incomeCategoryId,
        status: 'DRAFT',
        source: 'VOICE',
        date: new Date('2020-05-15'),
        referenceMonth: new Date('2020-05-01'),
      });

      const body = (await authed('get', '/reports/yearly?year=2020').expect(200)).body as YearlyReportDto;

      expect(body.totals).toEqual({ income: 0, expense: 0, balance: 0 });
      expect(body.categories).toEqual([]);
    });

    it('reports a credit-card transaction under its referenceMonth column, not the month of its date', async () => {
      await seed({
        type: 'EXPENSE',
        amount: 1_500,
        accountId,
        categoryId: expenseCategoryId,
        isCreditCard: true,
        date: new Date('2020-04-20'),
        referenceMonth: new Date('2020-05-01'),
      });

      const body = (await authed('get', '/reports/yearly?year=2020').expect(200)).body as YearlyReportDto;

      expect(body.months[3]).toMatchObject({ month: 4, expense: 0 }); // April: the transaction's date
      expect(body.months[4]).toMatchObject({ month: 5, expense: 1_500 }); // May: its referenceMonth
    });

    it('nests a subcategory breakdown under its root category, each with its own twelve-month series', async () => {
      const subcategory = await prisma.category.create({
        data: { userId, name: 'Supermercado', kind: CategoryKind.EXPENSE, parentId: expenseCategoryId },
        select: { id: true },
      });

      await Promise.all([
        seed({
          type: 'EXPENSE',
          amount: 600,
          accountId,
          categoryId: expenseCategoryId,
          subcategoryId: subcategory.id,
          date: new Date('2020-03-10'),
          referenceMonth: new Date('2020-03-01'),
        }),
        seed({ type: 'EXPENSE', amount: 400, accountId, categoryId: expenseCategoryId, date: new Date('2020-03-10'), referenceMonth: new Date('2020-03-01') }),
      ]);

      const body = (await authed('get', '/reports/yearly?year=2020').expect(200)).body as YearlyReportDto;

      const category = body.categories.find((c) => c.categoryId === expenseCategoryId)!;
      expect(category.total).toBe(1_000);
      expect(category.subcategories).toEqual(
        expect.arrayContaining([
          { subcategoryId: subcategory.id, name: 'Supermercado', monthly: [0, 0, 600, 0, 0, 0, 0, 0, 0, 0, 0, 0], total: 600 },
          { subcategoryId: null, name: null, monthly: [0, 0, 400, 0, 0, 0, 0, 0, 0, 0, 0, 0], total: 400 },
        ]),
      );
    });

    it('includes the prior year under comparison when ?compare=true, and omits it otherwise', async () => {
      await Promise.all([
        seed({ type: 'EXPENSE', amount: 900, accountId, categoryId: expenseCategoryId, date: new Date('2020-06-10'), referenceMonth: new Date('2020-06-01') }),
        seed({ type: 'EXPENSE', amount: 400, accountId, categoryId: expenseCategoryId, date: new Date('2019-06-10'), referenceMonth: new Date('2019-06-01') }),
      ]);

      const withoutCompare = (await authed('get', '/reports/yearly?year=2020').expect(200)).body as YearlyReportDto;
      expect(withoutCompare.comparison).toBeUndefined();

      const withCompare = (await authed('get', '/reports/yearly?year=2020&compare=true').expect(200)).body as YearlyReportDto;
      expect(withCompare.comparison?.year).toBe(2019);
      expect(withCompare.comparison?.totals).toEqual({ income: 0, expense: 400, balance: -400 });
      expect(withCompare.totals).toEqual({ income: 0, expense: 900, balance: -900 });
    });
  });

  describe('GET /reports/cashboxes', () => {
    it('answers 401 without a token', async () => {
      await request(server).get('/api/reports/cashboxes?year=2026').expect(401);
    });

    it('answers 400 for an out-of-range year', async () => {
      await authed('get', '/reports/cashboxes?year=1999').expect(400);
    });

    it('includes every live cashbox with zeros for a year with no fixtures', async () => {
      const body = (await authed('get', '/reports/cashboxes?year=2026').expect(200)).body as CashboxesReportDto;

      expect(body.year).toBe(2026);
      expect(body.cashboxes).toHaveLength(2);
      const carro = body.cashboxes.find((c) => c.cashboxId === cashboxId)!;
      expect(carro).toMatchObject({ name: 'Carro', isActive: true, targetAmount: null, openingBalance: 0, deposits: 0, withdrawals: 0, closingBalance: 0 });
      expect(carro.months).toHaveLength(12);
      expect(carro.months.every((m) => m.deposits === 0 && m.withdrawals === 0 && m.balance === 0)).toBe(true);
    });

    it('carries a prior year balance into the opening balance and the running monthly balance', async () => {
      await Promise.all([
        seed({ type: 'CASHBOX_IN', amount: 5_000, cashboxId, date: new Date('2025-11-10'), referenceMonth: new Date('2025-11-01') }),
        seed({ type: 'CASHBOX_IN', amount: 1_000, cashboxId, date: new Date('2026-03-10'), referenceMonth: new Date('2026-03-01') }),
        seed({ type: 'CASHBOX_OUT', amount: 400, cashboxId, date: new Date('2026-03-10'), referenceMonth: new Date('2026-03-01') }),
      ]);

      const body = (await authed('get', '/reports/cashboxes?year=2026').expect(200)).body as CashboxesReportDto;

      const carro = body.cashboxes.find((c) => c.cashboxId === cashboxId)!;
      expect(carro.openingBalance).toBe(5_000);
      expect(carro.deposits).toBe(1_000);
      expect(carro.withdrawals).toBe(400);
      expect(carro.months[1]).toMatchObject({ month: 2, deposits: 0, withdrawals: 0, balance: 5_000 });
      expect(carro.months[2]).toMatchObject({ month: 3, deposits: 1_000, withdrawals: 400, balance: 5_600 });
      expect(carro.closingBalance).toBe(5_600);
    });

    it('nets a CASHBOX_TRANSFER to zero across the two cashboxes it moves money between, in transfersIn/transfersOut', async () => {
      await seed({
        type: 'CASHBOX_TRANSFER',
        amount: 700,
        cashboxId,
        destinationCashboxId: otherCashboxId,
        date: new Date('2026-06-10'),
        referenceMonth: new Date('2026-06-01'),
      });

      const body = (await authed('get', '/reports/cashboxes?year=2026').expect(200)).body as CashboxesReportDto;

      const source = body.cashboxes.find((c) => c.cashboxId === cashboxId)!;
      const destination = body.cashboxes.find((c) => c.cashboxId === otherCashboxId)!;
      expect(source).toMatchObject({ transfersOut: 700, deposits: 0, withdrawals: 0, closingBalance: -700 });
      expect(destination).toMatchObject({ transfersIn: 700, deposits: 0, withdrawals: 0, closingBalance: 700 });
    });

    it('keeps an inactive cashbox with history in the report, still clickable', async () => {
      await prisma.cashbox.update({ where: { id: cashboxId }, data: { isActive: false } });
      await seed({ type: 'CASHBOX_IN', amount: 300, cashboxId, date: new Date('2026-02-10'), referenceMonth: new Date('2026-02-01') });

      const body = (await authed('get', '/reports/cashboxes?year=2026').expect(200)).body as CashboxesReportDto;

      expect(body.cashboxes.find((c) => c.cashboxId === cashboxId)).toMatchObject({ isActive: false, deposits: 300 });
    });

    it('shows progress toward targetAmount when set', async () => {
      await prisma.cashbox.update({ where: { id: cashboxId }, data: { targetAmount: 10_000 } });

      const body = (await authed('get', '/reports/cashboxes?year=2026').expect(200)).body as CashboxesReportDto;

      expect(body.cashboxes.find((c) => c.cashboxId === cashboxId)).toMatchObject({ targetAmount: 10_000 });
    });

    it("keeps a deleted cashbox's row for the months it was active, named from its label snapshot, not clickable, ending at its last active month", async () => {
      await seed({ type: 'CASHBOX_IN', amount: 900, cashboxId, cashboxLabel: 'Carro', date: new Date('2026-04-10'), referenceMonth: new Date('2026-04-01') });
      await seed({ type: 'CASHBOX_OUT', amount: 900, cashboxId, cashboxLabel: 'Carro', date: new Date('2026-04-10'), referenceMonth: new Date('2026-04-01') });
      await prisma.cashbox.delete({ where: { id: cashboxId } });

      const body = (await authed('get', '/reports/cashboxes?year=2026').expect(200)).body as CashboxesReportDto;

      const deleted = body.cashboxes.find((c) => c.cashboxId === null)!;
      expect(deleted).toMatchObject({ name: 'Carro', isActive: null, targetAmount: null, closingBalance: 0 });
      expect(deleted.months[3]).toMatchObject({ month: 4, balance: 0 });
      expect(deleted.months[4]).toMatchObject({ month: 5, balance: null });
    });

    it('excludes a DRAFT transaction from every total', async () => {
      await seed({ type: 'CASHBOX_IN', amount: 1_000_000, cashboxId, status: 'DRAFT', source: 'VOICE' });

      const body = (await authed('get', '/reports/cashboxes?year=2026').expect(200)).body as CashboxesReportDto;

      expect(body.cashboxes.find((c) => c.cashboxId === cashboxId)).toMatchObject({ deposits: 0, closingBalance: 0 });
    });

    it("never lets another user's transactions leak into the caller's report", async () => {
      await seed({ type: 'CASHBOX_IN', amount: 999_999, cashboxId });

      const otherBody = (await authed('get', '/reports/cashboxes?year=2026', otherToken).expect(200)).body as CashboxesReportDto;

      expect(otherBody.cashboxes).toEqual([]);
    });
  });
});
