import { type PrismaService } from '../../prisma/prisma.service';

import { ReportsService } from './reports.service';

const userId = '11111111-1111-1111-1111-111111111111';
const catA = '22222222-2222-2222-2222-222222222222';
const catB = '33333333-3333-3333-3333-333333333333';
const sub1 = '44444444-4444-4444-4444-444444444444';
const sub2 = '55555555-5555-5555-5555-555555555555';

const row = (amount: number, count = 1) => ({ _sum: { amount }, _count: { _all: count } });

/** `$transaction` runs the callback against the same `groupBy` double, `Promise.all`-style — same convention as `BalancesService`'s spec. */
const prismaDouble = (): { prisma: PrismaService; groupBy: jest.Mock; categoryFindMany: jest.Mock; cashboxFindMany: jest.Mock } => {
  const groupBy = jest.fn().mockResolvedValue([]);
  const transaction = { groupBy };
  const $transaction = jest.fn((fn: (tx: { transaction: typeof transaction }) => unknown) => fn({ transaction }));
  const categoryFindMany = jest.fn().mockResolvedValue([]);
  const cashboxFindMany = jest.fn().mockResolvedValue([]);
  const category = { findMany: categoryFindMany };
  const cashbox = { findMany: cashboxFindMany };

  return { prisma: { transaction, $transaction, category, cashbox } as unknown as PrismaService, groupBy, categoryFindMany, cashboxFindMany };
};

describe('ReportsService', () => {
  describe('getMonthly', () => {
    it('starts the twelve-month window at April 2026 for a March 2027 request', async () => {
      const { prisma, groupBy } = prismaDouble();
      const service = new ReportsService(prisma);

      await service.getMonthly(userId, 2027, 3);

      const calls = groupBy.mock.calls as [{ where: { referenceMonth: unknown } }][];
      expect(calls[0]![0].where.referenceMonth).toEqual({ gte: new Date(Date.UTC(2026, 3, 1)), lte: new Date(Date.UTC(2027, 2, 1)) });
    });

    it('nests two subcategory rows under their category, with amounts and percentages summing to 100', async () => {
      const { prisma, groupBy, categoryFindMany } = prismaDouble();
      const service = new ReportsService(prisma);
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
      const service = new ReportsService(prisma);
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
      const service = new ReportsService(prisma);
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
      const service = new ReportsService(prisma);
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
      const service = new ReportsService(prisma);
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
      const service = new ReportsService(prisma);

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
      const service = new ReportsService(prisma);
      const now = new Date(Date.UTC(2027, 5, 1)); // current month is well past 2026

      await service.getYearly(userId, 2026, false, now);

      const calls = groupBy.mock.calls as [{ where: { referenceMonth: { gte: Date; lte: Date } } }][];
      const call = calls[0]![0];
      // Window end is Dec 2026 -> window start is Jan 2026 -> range covers exactly Jan-Dec 2026.
      expect(call.where.referenceMonth).toEqual({ gte: new Date(Date.UTC(2026, 0, 1)), lte: new Date(Date.UTC(2026, 11, 1)) });
    });

    it('queries back into the prior year when the requested year is the current, unfinished one', async () => {
      const { prisma, groupBy } = prismaDouble();
      const service = new ReportsService(prisma);
      const now = new Date(Date.UTC(2026, 2, 15)); // "today" is March 2026

      await service.getYearly(userId, 2026, false, now);

      const calls = groupBy.mock.calls as [{ where: { referenceMonth: { gte: Date; lte: Date } } }][];
      const call = calls[0]![0];
      // Window end is the current month (March 2026) -> window start reaches back to April 2025.
      expect(call.where.referenceMonth).toEqual({ gte: new Date(Date.UTC(2025, 3, 1)), lte: new Date(Date.UTC(2026, 11, 1)) });
    });

    it('reaches back to January of the prior year, and no further, when compare is set', async () => {
      const { prisma, groupBy } = prismaDouble();
      const service = new ReportsService(prisma);
      const now = new Date(Date.UTC(2027, 5, 1));

      await service.getYearly(userId, 2026, true, now);

      const calls = groupBy.mock.calls as [{ where: { referenceMonth: { gte: Date; lte: Date } } }][];
      const call = calls[0]![0];
      expect(call.where.referenceMonth).toEqual({ gte: new Date(Date.UTC(2025, 0, 1)), lte: new Date(Date.UTC(2026, 11, 1)) });
    });

    it('reports the averageWindow so the UI can label the column', async () => {
      const { prisma } = prismaDouble();
      const service = new ReportsService(prisma);
      const now = new Date(Date.UTC(2026, 2, 15));

      const result = await service.getYearly(userId, 2026, false, now);

      expect(result.averageWindow).toEqual({ from: '2025-04-01', to: '2026-03-01' });
    });

    it('folds twelve monthly rows into one zero-filled row per category, with the row total and column totals matching', async () => {
      const { prisma, groupBy, categoryFindMany } = prismaDouble();
      const service = new ReportsService(prisma);
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
      const service = new ReportsService(prisma);
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
      const service = new ReportsService(prisma);
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
      const service = new ReportsService(prisma);
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
      const service = new ReportsService(prisma);
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
      const service = new ReportsService(prisma);
      const now = new Date(Date.UTC(2027, 5, 1));

      groupBy.mockResolvedValueOnce([{ categoryId: catA, referenceMonth: new Date(Date.UTC(2025, 5, 1)), type: 'EXPENSE', ...row(300) }]);

      const result = await service.getYearly(userId, 2026, false, now);

      expect(result.categories).toEqual([]);
    });

    it('includes a comparison block for the prior year when compare is true, without a monthlyAverage on its rows', async () => {
      const { prisma, groupBy, categoryFindMany } = prismaDouble();
      const service = new ReportsService(prisma);
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
      const service = new ReportsService(prisma);

      const result = await service.getYearly(userId, 2026, false, new Date(Date.UTC(2027, 5, 1)));

      expect(result.comparison).toBeUndefined();
    });

    it('returns the zeroed structure for a year with no data', async () => {
      const { prisma } = prismaDouble();
      const service = new ReportsService(prisma);

      const result = await service.getYearly(userId, 2026, false, new Date(Date.UTC(2027, 5, 1)));

      expect(result.categories).toEqual([]);
      expect(result.months).toHaveLength(12);
      expect(result.months.every((m) => m.income === 0 && m.expense === 0 && m.balance === 0)).toBe(true);
      expect(result.totals).toEqual({ income: 0, expense: 0, balance: 0 });
    });
  });
});
