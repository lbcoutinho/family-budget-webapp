import { type PrismaService } from '../../prisma/prisma.service';

import { ReportsService } from './reports.service';

const userId = '11111111-1111-1111-1111-111111111111';
const catA = '22222222-2222-2222-2222-222222222222';
const catB = '33333333-3333-3333-3333-333333333333';
const sub1 = '44444444-4444-4444-4444-444444444444';
const sub2 = '55555555-5555-5555-5555-555555555555';

const row = (amount: number) => ({ _sum: { amount } });

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

      expect(result.categories).toHaveLength(1);
      const [category] = result.categories;
      expect(category!.amount).toBe(1_000);
      expect(category!.subcategories).toEqual(
        expect.arrayContaining([
          { subcategoryId: sub1, name: 'Supermarket', amount: 600, percentage: 60 },
          { subcategoryId: sub2, name: 'Butcher', amount: 400, percentage: 40 },
        ]),
      );
      const percentageSum = category!.subcategories.reduce((sum, s) => sum + s.percentage, 0);
      expect(percentageSum).toBe(100);
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
});
