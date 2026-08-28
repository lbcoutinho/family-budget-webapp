import { type PrismaService } from '../../prisma/prisma.service';
import { type BalancesService } from '../transactions/balances.service';

import { ReportsService } from './reports.service';

/** Only report methods that explicitly stub a balance call may use it. */
const balancesStub = (): BalancesService =>
  ({
    monthlyByCashbox: jest.fn().mockRejectedValue(new Error('monthlyByCashbox not stubbed')),
    sumByAccount: jest.fn().mockRejectedValue(new Error('sumByAccount not stubbed')),
    sumByCashbox: jest.fn().mockRejectedValue(new Error('sumByCashbox not stubbed')),
    accountMovementsByReferenceMonth: jest.fn().mockRejectedValue(new Error('accountMovementsByReferenceMonth not stubbed')),
    cashboxMovementsByReferenceMonth: jest.fn().mockRejectedValue(new Error('cashboxMovementsByReferenceMonth not stubbed')),
    sumByAccountReferenceMonth: jest.fn().mockRejectedValue(new Error('sumByAccountReferenceMonth not stubbed')),
    sumByCashboxReferenceMonth: jest.fn().mockRejectedValue(new Error('sumByCashboxReferenceMonth not stubbed')),
  }) as unknown as BalancesService;

const userId = '11111111-1111-1111-1111-111111111111';
const catA = '22222222-2222-2222-2222-222222222222';
const catB = '33333333-3333-3333-3333-333333333333';
const sub1 = '44444444-4444-4444-4444-444444444444';
const sub2 = '55555555-5555-5555-5555-555555555555';
const cashboxId = '66666666-6666-6666-6666-666666666666';
const otherCashboxId = '77777777-7777-7777-7777-777777777777';

const row = (amount: number, count = 1) => ({ _sum: { amount }, _count: { _all: count } });

/** `$transaction` runs the callback against the same `groupBy` double, `Promise.all`-style — same convention as `BalancesService`'s spec. */
const prismaDouble = (): { prisma: PrismaService; groupBy: jest.Mock; accountFindMany: jest.Mock; categoryFindMany: jest.Mock; cashboxFindMany: jest.Mock } => {
  const groupBy = jest.fn().mockResolvedValue([]);
  const transaction = { groupBy };
  const $transaction = jest.fn((fn: (tx: { transaction: typeof transaction }) => unknown) => fn({ transaction }));
  const accountFindMany = jest.fn().mockResolvedValue([]);
  const categoryFindMany = jest.fn().mockResolvedValue([]);
  const cashboxFindMany = jest.fn().mockResolvedValue([]);
  const account = { findMany: accountFindMany };
  const category = { findMany: categoryFindMany };
  const cashbox = { findMany: cashboxFindMany };

  return {
    prisma: { transaction, $transaction, account, category, cashbox } as unknown as PrismaService,
    groupBy,
    accountFindMany,
    categoryFindMany,
    cashboxFindMany,
  };
};

describe('ReportsService', () => {
  describe('getBalances', () => {
    it('keeps the effective snapshot at its date cutoff while exposing future-dated accounting movements and a full yearly evolution', async () => {
      const { prisma, accountFindMany, cashboxFindMany } = prismaDouble();
      const balances = balancesStub();
      const service = new ReportsService(prisma, balances);
      const accountId = '88888888-8888-8888-8888-888888888888';
      const cashboxId = '99999999-9999-9999-9999-999999999999';
      const now = new Date(Date.UTC(2026, 4, 15));
      const account = { id: accountId, name: 'Current', isActive: true, initialBalance: 1_000, createdAt: new Date(Date.UTC(2026, 0, 1)) };
      const futureAccount = {
        id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        name: 'Future',
        isActive: true,
        initialBalance: 50_000,
        createdAt: new Date(Date.UTC(2026, 5, 1)),
      };
      accountFindMany.mockResolvedValueOnce([account, futureAccount]).mockResolvedValueOnce([account]);
      cashboxFindMany.mockResolvedValue([{ id: cashboxId, name: 'Reserve', isActive: true, createdAt: new Date(Date.UTC(2026, 0, 1)) }]);
      jest.mocked(balances.sumByAccount).mockResolvedValue(new Map([[accountId, 200]]));
      jest.mocked(balances.sumByCashbox).mockResolvedValue(new Map([[cashboxId, 300]]));
      jest.mocked(balances.accountMovementsByReferenceMonth).mockResolvedValue(
        new Map([
          [new Date(Date.UTC(2025, 11, 1)).getTime(), new Map([[accountId, 200]])],
          [new Date(Date.UTC(2026, 4, 1)).getTime(), new Map([[accountId, 500]])],
        ]),
      );
      jest.mocked(balances.cashboxMovementsByReferenceMonth).mockResolvedValue(
        new Map([
          [new Date(Date.UTC(2025, 11, 1)).getTime(), new Map([[cashboxId, 100]])],
          [new Date(Date.UTC(2026, 4, 1)).getTime(), new Map([[cashboxId, 200]])],
        ]),
      );
      jest.mocked(balances.sumByAccountReferenceMonth).mockResolvedValue(new Map([[accountId, 700]]));
      jest.mocked(balances.sumByCashboxReferenceMonth).mockResolvedValue(new Map([[cashboxId, 300]]));

      const result = await service.getBalances(userId, 2026, now);

      expect(result.snapshot).toEqual({
        cutoffDate: '2026-05-15',
        accounts: [{ accountId, name: 'Current', isActive: true, balance: 1_200 }],
        cashboxes: [{ cashboxId, name: 'Reserve', isActive: true, balance: 300 }],
        totalAccounts: 1_200,
        totalCashboxes: 300,
        totalNetWorth: 1_500,
      });
      expect(result).toMatchObject({ currentAccountingClose: 2_000, futureDatedTransactions: 500, evolution: { hasSufficientHistory: true } });
      expect(result.evolution.months).toHaveLength(12);
      expect(result.evolution.months[0]).toMatchObject({ accounts: 1_200, cashboxes: 100, netWorth: 1_300 });
      expect(result.evolution.months[4]).toEqual({ month: 5, accounts: 1_700, cashboxes: 300, netWorth: 2_000, inProgress: true });
      expect(balances.sumByAccount).toHaveBeenCalledWith(userId, new Date(Date.UTC(2026, 4, 15)));
    });

    it('marks a year before every account as insufficient history without removing the snapshot', async () => {
      const { prisma, accountFindMany } = prismaDouble();
      const balances = balancesStub();
      const service = new ReportsService(prisma, balances);
      const account = {
        id: '88888888-8888-8888-8888-888888888888',
        name: 'Current',
        isActive: true,
        initialBalance: 1_000,
        createdAt: new Date(Date.UTC(2026, 0, 1)),
      };
      accountFindMany.mockResolvedValue([account]);
      jest.mocked(balances.sumByAccount).mockResolvedValue(new Map());
      jest.mocked(balances.sumByCashbox).mockResolvedValue(new Map());
      jest.mocked(balances.accountMovementsByReferenceMonth).mockResolvedValue(new Map());
      jest.mocked(balances.cashboxMovementsByReferenceMonth).mockResolvedValue(new Map());
      jest.mocked(balances.sumByAccountReferenceMonth).mockResolvedValue(new Map());
      jest.mocked(balances.sumByCashboxReferenceMonth).mockResolvedValue(new Map());

      const result = await service.getBalances(userId, 2020, new Date(Date.UTC(2026, 4, 15)));

      expect(result.snapshot.totalNetWorth).toBe(1_000);
      expect(result.evolution.hasSufficientHistory).toBe(false);
      expect(result.evolution.months).toHaveLength(12);
    });

    it('includes retroactive account movements in their reference months even when the account was registered later', async () => {
      const { prisma, accountFindMany } = prismaDouble();
      const balances = balancesStub();
      const service = new ReportsService(prisma, balances);
      const accountId = '88888888-8888-8888-8888-888888888888';
      const account = { id: accountId, name: 'Current', isActive: true, initialBalance: 0, createdAt: new Date(Date.UTC(2026, 7, 28)) };
      accountFindMany.mockResolvedValue([account]);
      jest.mocked(balances.sumByAccount).mockResolvedValue(new Map([[accountId, 300_000]]));
      jest.mocked(balances.sumByCashbox).mockResolvedValue(new Map());
      jest.mocked(balances.accountMovementsByReferenceMonth).mockResolvedValue(
        new Map([
          [new Date(Date.UTC(2026, 5, 1)).getTime(), new Map([[accountId, 50_000]])],
          [new Date(Date.UTC(2026, 6, 1)).getTime(), new Map([[accountId, 100_000]])],
          [new Date(Date.UTC(2026, 7, 1)).getTime(), new Map([[accountId, 150_000]])],
        ]),
      );
      jest.mocked(balances.cashboxMovementsByReferenceMonth).mockResolvedValue(new Map());
      jest.mocked(balances.sumByAccountReferenceMonth).mockResolvedValue(new Map([[accountId, 300_000]]));
      jest.mocked(balances.sumByCashboxReferenceMonth).mockResolvedValue(new Map());

      const result = await service.getBalances(userId, 2026, new Date(Date.UTC(2026, 7, 28)));

      expect(result.evolution.months.slice(5, 8).map((month) => month.accounts)).toEqual([50_000, 150_000, 300_000]);
    });
  });

  describe('getMonthly', () => {
    it('starts the twelve-month window at April 2026 for a March 2027 request', async () => {
      const { prisma, groupBy } = prismaDouble();
      const service = new ReportsService(prisma, balancesStub());

      await service.getMonthly(userId, 2027, 3);

      const calls = groupBy.mock.calls as [{ where: { referenceMonth: unknown } }][];
      expect(calls[0]![0].where.referenceMonth).toEqual({ gte: new Date(Date.UTC(2026, 3, 1)), lte: new Date(Date.UTC(2027, 2, 1)) });
    });

    it('nests two subcategory rows under their category, with amounts and percentages summing to 100', async () => {
      const { prisma, groupBy, categoryFindMany } = prismaDouble();
      const service = new ReportsService(prisma, balancesStub());
      const end = new Date(Date.UTC(2026, 7, 1));

      groupBy
        .mockResolvedValueOnce([{ referenceMonth: end, categoryId: catA, type: 'EXPENSE', ...row(1_000) }])
        .mockResolvedValueOnce([
          { categoryId: catA, subcategoryId: sub1, type: 'EXPENSE', ...row(600, 2) },
          { categoryId: catA, subcategoryId: sub2, type: 'EXPENSE', ...row(400, 3) },
        ])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      categoryFindMany.mockResolvedValue([
        { id: catA, name: 'Groceries', color: '#ff0000' },
        { id: sub1, name: 'Supermarket', color: null },
        { id: sub2, name: 'Butcher', color: null },
      ]);

      const result = await service.getMonthly(userId, 2026, 8);

      expect(result.categories).toHaveLength(1);
      const [category] = result.categories;
      expect(category!.amount).toBe(1_000);
      // The category's own count is every subcategory's count summed — 2 + 3 = 5.
      expect(category!.count).toBe(5);
      expect(category!.subcategories).toEqual(
        expect.arrayContaining([
          { subcategoryId: sub1, name: 'Supermarket', amount: 600, percentage: 60, rollingAverage: 0, count: 2 },
          { subcategoryId: sub2, name: 'Butcher', amount: 400, percentage: 40, rollingAverage: 0, count: 3 },
        ]),
      );
      const percentageSum = category!.subcategories.reduce((sum, s) => sum + s.percentage, 0);
      expect(percentageSum).toBe(100);
    });

    it("computes each subcategory's own rolling average over the same twelve-month window as its parent category", async () => {
      const { prisma, groupBy, categoryFindMany } = prismaDouble();
      const service = new ReportsService(prisma, balancesStub());
      const end = new Date(Date.UTC(2026, 7, 1));

      groupBy
        .mockResolvedValueOnce([
          // The requested month, split by subcategory.
          { referenceMonth: end, categoryId: catA, subcategoryId: sub1, type: 'EXPENSE', ...row(600) },
          { referenceMonth: end, categoryId: catA, subcategoryId: sub2, type: 'EXPENSE', ...row(400) },
          // A prior month in the window, same category, different subcategories sharing that
          // month — regression guard for the map-overwrite bug: both must be counted.
          { referenceMonth: new Date(Date.UTC(2026, 5, 1)), categoryId: catA, subcategoryId: sub1, type: 'EXPENSE', ...row(200) },
          { referenceMonth: new Date(Date.UTC(2026, 5, 1)), categoryId: catA, subcategoryId: sub2, type: 'EXPENSE', ...row(100) },
        ])
        .mockResolvedValueOnce([
          { categoryId: catA, subcategoryId: sub1, type: 'EXPENSE', ...row(600) },
          { categoryId: catA, subcategoryId: sub2, type: 'EXPENSE', ...row(400) },
        ])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      categoryFindMany.mockResolvedValue([
        { id: catA, name: 'Groceries', color: '#ff0000' },
        { id: sub1, name: 'Supermarket', color: null },
        { id: sub2, name: 'Butcher', color: null },
      ]);

      const result = await service.getMonthly(userId, 2026, 8);

      // Root category's own average still sums both subcategories per month: (1000 + 300) / 2 = 650.
      expect(result.categories[0]!.rollingAverage).toBe(650);
      const [butcher, supermarket] = [...result.categories[0]!.subcategories].sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));
      expect(butcher).toMatchObject({ name: 'Butcher', rollingAverage: 250 }); // (400 + 100) / 2
      expect(supermarket).toMatchObject({ name: 'Supermarket', rollingAverage: 400 }); // (600 + 200) / 2
    });

    it('keeps two deleted cashboxes with distinct labels as separate rows', async () => {
      const { prisma, groupBy } = prismaDouble();
      const service = new ReportsService(prisma, balancesStub());
      const end = new Date(Date.UTC(2026, 7, 1));
      void end;

      groupBy
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          { cashboxId: null, cashboxLabel: 'Old Jar', type: 'CASHBOX_IN', ...row(100) },
          { cashboxId: null, cashboxLabel: 'Old Envelope', type: 'CASHBOX_IN', ...row(200) },
        ])
        .mockResolvedValueOnce([]);

      const result = await service.getMonthly(userId, 2026, 8);

      expect(result.cashboxes.items).toHaveLength(2);
      expect(result.cashboxes.items.map((i) => i.name).sort()).toEqual(['Old Envelope', 'Old Jar']);
      expect(result.cashboxes.items.every((i) => i.cashboxId === null)).toBe(true);
    });

    it('computes income and expense category percentages independently, against their own side total', async () => {
      const { prisma, groupBy } = prismaDouble();
      const service = new ReportsService(prisma, balancesStub());
      const end = new Date(Date.UTC(2026, 7, 1));

      groupBy
        .mockResolvedValueOnce([
          { referenceMonth: end, categoryId: catA, type: 'INCOME', ...row(300) },
          { referenceMonth: end, categoryId: catB, type: 'INCOME', ...row(700) },
          { referenceMonth: end, categoryId: catA, type: 'EXPENSE', ...row(100) },
        ])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await service.getMonthly(userId, 2026, 8);

      const income = result.categories.filter((c) => c.kind === 'INCOME');
      const expense = result.categories.filter((c) => c.kind === 'EXPENSE');
      expect(income.find((c) => c.categoryId === catA)!.percentage).toBe(30);
      expect(income.find((c) => c.categoryId === catB)!.percentage).toBe(70);
      // Only expense category, so it is 100% of the expense side even though it is 10% of income.
      expect(expense.find((c) => c.categoryId === catA)!.percentage).toBe(100);
    });

    it('reports the uncategorized bucket as its own row', async () => {
      const { prisma, groupBy } = prismaDouble();
      const service = new ReportsService(prisma, balancesStub());
      const end = new Date(Date.UTC(2026, 7, 1));

      groupBy
        .mockResolvedValueOnce([{ referenceMonth: end, categoryId: null, type: 'EXPENSE', ...row(500) }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await service.getMonthly(userId, 2026, 8);

      expect(result.categories).toEqual([expect.objectContaining({ categoryId: null, name: null, color: null, amount: 500, percentage: 100 })]);
    });

    it('returns the zeroed structure for a month with no activity, without throwing', async () => {
      const { prisma } = prismaDouble();
      const service = new ReportsService(prisma, balancesStub());

      await expect(service.getMonthly(userId, 2026, 8)).resolves.toEqual({
        year: 2026,
        month: 8,
        incomeTotal: 0,
        expenseTotal: 0,
        balance: 0,
        categories: [],
        cashboxes: { items: [], depositsTotal: 0, withdrawalsTotal: 0, balance: 0 },
      });
    });
  });

  describe('getYearly', () => {
    it('queries December of a complete past year as the average window end, so the average reconciles with the matrix', async () => {
      const { prisma, groupBy } = prismaDouble();
      const service = new ReportsService(prisma, balancesStub());
      const now = new Date(Date.UTC(2027, 5, 1)); // current month is well past 2026

      await service.getYearly(userId, 2026, false, now);

      const calls = groupBy.mock.calls as [{ where: { referenceMonth: { gte: Date; lte: Date } } }][];
      const call = calls[0]![0];
      // Window end is Dec 2026 -> window start is Jan 2026 -> range covers exactly Jan-Dec 2026.
      expect(call.where.referenceMonth).toEqual({ gte: new Date(Date.UTC(2026, 0, 1)), lte: new Date(Date.UTC(2026, 11, 1)) });
    });

    it('queries back into the prior year when the requested year is the current, unfinished one', async () => {
      const { prisma, groupBy } = prismaDouble();
      const service = new ReportsService(prisma, balancesStub());
      const now = new Date(Date.UTC(2026, 2, 15)); // "today" is March 2026

      await service.getYearly(userId, 2026, false, now);

      const calls = groupBy.mock.calls as [{ where: { referenceMonth: { gte: Date; lte: Date } } }][];
      const call = calls[0]![0];
      // Window end is the current month (March 2026) -> window start reaches back to April 2025.
      expect(call.where.referenceMonth).toEqual({ gte: new Date(Date.UTC(2025, 3, 1)), lte: new Date(Date.UTC(2026, 11, 1)) });
    });

    it('reaches back to January of the prior year, and no further, when compare is set', async () => {
      const { prisma, groupBy } = prismaDouble();
      const service = new ReportsService(prisma, balancesStub());
      const now = new Date(Date.UTC(2027, 5, 1));

      await service.getYearly(userId, 2026, true, now);

      const calls = groupBy.mock.calls as [{ where: { referenceMonth: { gte: Date; lte: Date } } }][];
      const call = calls[0]![0];
      expect(call.where.referenceMonth).toEqual({ gte: new Date(Date.UTC(2025, 0, 1)), lte: new Date(Date.UTC(2026, 11, 1)) });
    });

    it('reports the averageWindow so the UI can label the column', async () => {
      const { prisma } = prismaDouble();
      const service = new ReportsService(prisma, balancesStub());
      const now = new Date(Date.UTC(2026, 2, 15));

      const result = await service.getYearly(userId, 2026, false, now);

      expect(result.averageWindow).toEqual({ from: '2025-04-01', to: '2026-03-01' });
    });

    it('folds twelve monthly rows into one zero-filled row per category, with the row total and column totals matching', async () => {
      const { prisma, groupBy, categoryFindMany } = prismaDouble();
      const service = new ReportsService(prisma, balancesStub());
      const now = new Date(Date.UTC(2027, 5, 1));

      groupBy.mockResolvedValueOnce([
        { categoryId: catA, referenceMonth: new Date(Date.UTC(2026, 0, 1)), type: 'EXPENSE', ...row(1_000) },
        { categoryId: catA, referenceMonth: new Date(Date.UTC(2026, 5, 1)), type: 'EXPENSE', ...row(500) },
        { categoryId: catB, referenceMonth: new Date(Date.UTC(2026, 2, 1)), type: 'INCOME', ...row(2_000) },
      ]);
      categoryFindMany.mockResolvedValue([
        { id: catA, name: 'Groceries', color: '#ff0000' },
        { id: catB, name: 'Salary', color: null },
      ]);

      const result = await service.getYearly(userId, 2026, false, now);

      const groceries = result.categories.find((c) => c.categoryId === catA)!;
      expect(groceries.monthly).toEqual([1_000, 0, 0, 0, 0, 500, 0, 0, 0, 0, 0, 0]);
      expect(groceries.total).toBe(1_500);

      expect(result.months[0]).toMatchObject({ month: 1, expense: 1_000 });
      expect(result.months[2]).toMatchObject({ month: 3, income: 2_000 });
      expect(result.totals).toEqual({ income: 2_000, expense: 1_500, balance: 500 });
    });

    it('computes the rolling average over months with movement in the average window, not the twelve matrix columns', async () => {
      const { prisma, groupBy } = prismaDouble();
      const service = new ReportsService(prisma, balancesStub());
      const now = new Date(Date.UTC(2026, 2, 15)); // window: Apr 2025 - Mar 2026

      groupBy.mockResolvedValueOnce([
        // Inside the average window but before the requested year -> counts toward monthlyAverage, not toward the matrix/total.
        { categoryId: catA, referenceMonth: new Date(Date.UTC(2025, 11, 1)), type: 'EXPENSE', ...row(900) },
        // Inside the requested year -> counts toward the matrix/total; outside the average window (after March 2026), so it doesn't affect monthlyAverage.
        { categoryId: catA, referenceMonth: new Date(Date.UTC(2026, 5, 1)), type: 'EXPENSE', ...row(500) },
      ]);

      const result = await service.getYearly(userId, 2026, false, now);

      const groceries = result.categories.find((c) => c.categoryId === catA)!;
      expect(groceries.monthlyAverage).toBe(900);
      expect(groceries.total).toBe(500);
    });

    it('rolls subcategory amounts up under their root category, same as the monthly report', async () => {
      const { prisma, groupBy, categoryFindMany } = prismaDouble();
      const service = new ReportsService(prisma, balancesStub());
      const now = new Date(Date.UTC(2027, 5, 1));

      // Two transactions under different subcategories of the same root catA, same month. The
      // query groups by subcategoryId too, but the root matrix row still folds both back under
      // one categoryId=catA row regardless.
      groupBy.mockResolvedValueOnce([
        { categoryId: catA, subcategoryId: sub1, referenceMonth: new Date(Date.UTC(2026, 3, 1)), type: 'EXPENSE', ...row(300) },
        { categoryId: catA, subcategoryId: sub2, referenceMonth: new Date(Date.UTC(2026, 3, 1)), type: 'EXPENSE', ...row(200) },
      ]);
      categoryFindMany.mockResolvedValue([{ id: catA, name: 'Groceries', color: '#ff0000' }]);

      const result = await service.getYearly(userId, 2026, false, now);

      expect(result.categories).toHaveLength(1);
      expect(result.categories[0]).toMatchObject({ categoryId: catA, monthly: [0, 0, 0, 500, 0, 0, 0, 0, 0, 0, 0, 0], total: 500 });
    });

    it('nests two subcategory rows under their category, each with its own zero-filled twelve-month series', async () => {
      const { prisma, groupBy, categoryFindMany } = prismaDouble();
      const service = new ReportsService(prisma, balancesStub());
      const now = new Date(Date.UTC(2027, 5, 1));

      groupBy.mockResolvedValueOnce([
        { categoryId: catA, subcategoryId: sub1, referenceMonth: new Date(Date.UTC(2026, 3, 1)), type: 'EXPENSE', ...row(300) },
        { categoryId: catA, subcategoryId: sub2, referenceMonth: new Date(Date.UTC(2026, 3, 1)), type: 'EXPENSE', ...row(200) },
        { categoryId: catA, subcategoryId: sub1, referenceMonth: new Date(Date.UTC(2026, 7, 1)), type: 'EXPENSE', ...row(100) },
      ]);
      categoryFindMany.mockResolvedValue([
        { id: catA, name: 'Groceries', color: '#ff0000' },
        { id: sub1, name: 'Supermarket', color: null },
        { id: sub2, name: 'Butcher', color: null },
      ]);

      const result = await service.getYearly(userId, 2026, false, now);

      const [category] = result.categories;
      expect(category!.subcategories).toEqual(
        expect.arrayContaining([
          { subcategoryId: sub1, name: 'Supermarket', monthly: [0, 0, 0, 300, 0, 0, 0, 100, 0, 0, 0, 0], total: 400 },
          { subcategoryId: sub2, name: 'Butcher', monthly: [0, 0, 0, 200, 0, 0, 0, 0, 0, 0, 0, 0], total: 200 },
        ]),
      );
    });

    it('still reports the correct rolling average when two subcategories of the same category share a month', async () => {
      // Regression guard: folding subcategory-split rows into the monthly-average series must sum
      // same-month amounts rather than let one subcategory's row silently overwrite the other's.
      const { prisma, groupBy } = prismaDouble();
      const service = new ReportsService(prisma, balancesStub());
      const now = new Date(Date.UTC(2026, 2, 15)); // window: Apr 2025 - Mar 2026

      groupBy.mockResolvedValueOnce([
        { categoryId: catA, subcategoryId: sub1, referenceMonth: new Date(Date.UTC(2025, 11, 1)), type: 'EXPENSE', ...row(300) },
        { categoryId: catA, subcategoryId: sub2, referenceMonth: new Date(Date.UTC(2025, 11, 1)), type: 'EXPENSE', ...row(600) },
        // June 2026 is inside the requested year (so the category isn't omitted from `categories`
        // entirely) but outside the Apr 2025-Mar 2026 average window, so it doesn't affect the
        // average asserted below.
        { categoryId: catA, subcategoryId: sub1, referenceMonth: new Date(Date.UTC(2026, 5, 1)), type: 'EXPENSE', ...row(50) },
      ]);

      const result = await service.getYearly(userId, 2026, false, now);

      const groceries = result.categories.find((c) => c.categoryId === catA)!;
      expect(groceries.monthlyAverage).toBe(900); // Dec 2025's one month of movement, 300 + 600
    });

    it('omits a category with no activity anywhere in the requested year', async () => {
      const { prisma, groupBy } = prismaDouble();
      const service = new ReportsService(prisma, balancesStub());
      const now = new Date(Date.UTC(2027, 5, 1));

      groupBy.mockResolvedValueOnce([{ categoryId: catA, referenceMonth: new Date(Date.UTC(2025, 5, 1)), type: 'EXPENSE', ...row(300) }]);

      const result = await service.getYearly(userId, 2026, false, now);

      expect(result.categories).toEqual([]);
    });

    it('includes a comparison block for the prior year when compare is true, without a monthlyAverage on its rows', async () => {
      const { prisma, groupBy, categoryFindMany } = prismaDouble();
      const service = new ReportsService(prisma, balancesStub());
      const now = new Date(Date.UTC(2027, 5, 1));

      groupBy.mockResolvedValueOnce([
        { categoryId: catA, referenceMonth: new Date(Date.UTC(2026, 0, 1)), type: 'EXPENSE', ...row(1_000) },
        { categoryId: catA, referenceMonth: new Date(Date.UTC(2025, 0, 1)), type: 'EXPENSE', ...row(700) },
      ]);
      categoryFindMany.mockResolvedValue([{ id: catA, name: 'Groceries', color: '#ff0000' }]);

      const result = await service.getYearly(userId, 2026, true, now);

      expect(result.comparison).toBeDefined();
      expect(result.comparison!.year).toBe(2025);
      const comparisonRow = result.comparison!.categories.find((c) => c.categoryId === catA)!;
      expect(comparisonRow.total).toBe(700);
      expect(comparisonRow).not.toHaveProperty('monthlyAverage');
    });

    it('omits the comparison block when compare is false', async () => {
      const { prisma } = prismaDouble();
      const service = new ReportsService(prisma, balancesStub());

      const result = await service.getYearly(userId, 2026, false, new Date(Date.UTC(2027, 5, 1)));

      expect(result.comparison).toBeUndefined();
    });

    it('returns the zeroed structure for a year with no data', async () => {
      const { prisma } = prismaDouble();
      const service = new ReportsService(prisma, balancesStub());

      const result = await service.getYearly(userId, 2026, false, new Date(Date.UTC(2027, 5, 1)));

      expect(result.categories).toEqual([]);
      expect(result.months).toHaveLength(12);
      expect(result.months.every((m) => m.income === 0 && m.expense === 0 && m.balance === 0)).toBe(true);
      expect(result.totals).toEqual({ income: 0, expense: 0, balance: 0 });
    });
  });

  describe('cashboxes', () => {
    const sourceRow = (overrides: Partial<{ cashboxId: string | null; cashboxLabel: string | null; type: string; referenceMonth: Date; amount: number }>) => ({
      cashboxId: null,
      cashboxLabel: null,
      type: 'CASHBOX_IN',
      referenceMonth: new Date(Date.UTC(2026, 0, 1)),
      ...overrides,
      ...row(overrides.amount ?? 0),
    });
    const destinationRow = (
      overrides: Partial<{ destinationCashboxId: string | null; destinationCashboxLabel: string | null; referenceMonth: Date; amount: number }>,
    ) => ({
      destinationCashboxId: null,
      destinationCashboxLabel: null,
      referenceMonth: new Date(Date.UTC(2026, 0, 1)),
      ...overrides,
      ...row(overrides.amount ?? 0),
    });

    const balancesDouble = (
      source: ReturnType<typeof sourceRow>[],
      destination: ReturnType<typeof destinationRow>[] = [],
    ): { balances: BalancesService; monthlyByCashbox: jest.Mock } => {
      const monthlyByCashbox = jest.fn().mockResolvedValue({ source, destination });
      return { balances: { monthlyByCashbox } as unknown as BalancesService, monthlyByCashbox };
    };

    it('folds rows from before January into the opening balance, without a second query', async () => {
      const { prisma, cashboxFindMany } = prismaDouble();
      cashboxFindMany.mockResolvedValue([{ id: cashboxId, name: 'Reserva', isActive: true, targetAmount: null }]);
      const { balances } = balancesDouble([
        sourceRow({ cashboxId, type: 'CASHBOX_IN', referenceMonth: new Date(Date.UTC(2025, 10, 1)), amount: 5_000 }),
        sourceRow({ cashboxId, type: 'CASHBOX_IN', referenceMonth: new Date(Date.UTC(2026, 2, 1)), amount: 1_000 }),
      ]);
      const service = new ReportsService(prisma, balances);

      const result = await service.cashboxes(userId, 2026);

      const reserve = result.cashboxes.find((c) => c.cashboxId === cashboxId)!;
      expect(reserve.openingBalance).toBe(5_000);
      expect(reserve.deposits).toBe(1_000);
      expect(reserve.months[2]).toMatchObject({ month: 3, deposits: 1_000, balance: 6_000 });
      expect(reserve.months[0]).toMatchObject({ month: 1, deposits: 0, balance: 5_000 });
      expect(reserve.closingBalance).toBe(6_000);
    });

    it('nets a CASHBOX_TRANSFER to zero across the pair, in transfersOut/transfersIn rather than deposits/withdrawals', async () => {
      const { prisma, cashboxFindMany } = prismaDouble();
      cashboxFindMany.mockResolvedValue([
        { id: cashboxId, name: 'Reserva', isActive: true, targetAmount: null },
        { id: otherCashboxId, name: 'Viagem', isActive: true, targetAmount: null },
      ]);
      const { balances } = balancesDouble(
        [sourceRow({ cashboxId, type: 'CASHBOX_TRANSFER', referenceMonth: new Date(Date.UTC(2026, 4, 1)), amount: 2_000 })],
        [destinationRow({ destinationCashboxId: otherCashboxId, referenceMonth: new Date(Date.UTC(2026, 4, 1)), amount: 2_000 })],
      );
      const service = new ReportsService(prisma, balances);

      const result = await service.cashboxes(userId, 2026);

      const source = result.cashboxes.find((c) => c.cashboxId === cashboxId)!;
      const destination = result.cashboxes.find((c) => c.cashboxId === otherCashboxId)!;
      expect(source).toMatchObject({ transfersOut: 2_000, deposits: 0, withdrawals: 0, closingBalance: -2_000 });
      expect(destination).toMatchObject({ transfersIn: 2_000, deposits: 0, withdrawals: 0, closingBalance: 2_000 });
      expect(source.closingBalance + destination.closingBalance).toBe(0);
    });

    it('keeps two deleted cashboxes with distinct labels as separate rows, grouped by cashboxLabel', async () => {
      const { prisma, cashboxFindMany } = prismaDouble();
      cashboxFindMany.mockResolvedValue([]);
      const { balances } = balancesDouble([
        sourceRow({ cashboxId: null, cashboxLabel: 'Fundo de obras', type: 'CASHBOX_IN', referenceMonth: new Date(Date.UTC(2026, 1, 1)), amount: 900 }),
        sourceRow({ cashboxId: null, cashboxLabel: 'Reforma da cozinha', type: 'CASHBOX_OUT', referenceMonth: new Date(Date.UTC(2026, 1, 1)), amount: 1_800 }),
      ]);
      const service = new ReportsService(prisma, balances);

      const result = await service.cashboxes(userId, 2026);

      expect(result.cashboxes.every((c) => c.cashboxId === null)).toBe(true);
      expect(result.cashboxes.map((c) => c.name).sort()).toEqual(['Fundo de obras', 'Reforma da cozinha']);
    });

    it('truncates a deleted cashbox at its last active month, leaving later months null', async () => {
      const { prisma, cashboxFindMany } = prismaDouble();
      cashboxFindMany.mockResolvedValue([]);
      const { balances } = balancesDouble([
        sourceRow({ cashboxId: null, cashboxLabel: 'Fundo de obras', type: 'CASHBOX_IN', referenceMonth: new Date(Date.UTC(2026, 6, 1)), amount: 900 }),
        sourceRow({ cashboxId: null, cashboxLabel: 'Fundo de obras', type: 'CASHBOX_OUT', referenceMonth: new Date(Date.UTC(2026, 6, 1)), amount: 900 }),
      ]);
      const service = new ReportsService(prisma, balances);

      const result = await service.cashboxes(userId, 2026);

      const deleted = result.cashboxes[0]!;
      expect(deleted.months[6]).toMatchObject({ month: 7, balance: 0 });
      expect(deleted.months[7]).toMatchObject({ month: 8, balance: null });
      expect(deleted.months[11]).toMatchObject({ month: 12, balance: null });
      expect(deleted.closingBalance).toBe(0);
      expect(deleted.isActive).toBeNull();
      expect(deleted.targetAmount).toBeNull();
    });

    it('includes a live cashbox with no movement in the requested year, carrying zeros and its identity', async () => {
      const { prisma, cashboxFindMany } = prismaDouble();
      cashboxFindMany.mockResolvedValue([{ id: cashboxId, name: 'Emergência', isActive: false, targetAmount: 10_000 }]);
      const { balances } = balancesDouble([]);
      const service = new ReportsService(prisma, balances);

      const result = await service.cashboxes(userId, 2026);

      expect(result.cashboxes).toEqual([
        {
          cashboxId,
          name: 'Emergência',
          isActive: false,
          targetAmount: 10_000,
          openingBalance: 0,
          deposits: 0,
          withdrawals: 0,
          transfersIn: 0,
          transfersOut: 0,
          closingBalance: 0,
          months: Array.from({ length: 12 }, (_, i) => ({ month: i + 1, deposits: 0, withdrawals: 0, balance: 0 })),
        },
      ]);
    });
  });
});
