import { type PrismaService } from '../../prisma/prisma.service';

import { BalancesService } from './balances.service';

const userId = '11111111-1111-1111-1111-111111111111';
const accountId = '22222222-2222-2222-2222-222222222222';
const otherAccountId = '33333333-3333-3333-3333-333333333333';
const cashboxId = '44444444-4444-4444-4444-444444444444';
const otherCashboxId = '55555555-5555-5555-5555-555555555555';

const row = (amount: number) => ({ _sum: { amount } });

/** `$transaction` runs the callback against the same `groupBy` double, `Promise.all`-style. */
const prismaDouble = (): { prisma: PrismaService; groupBy: jest.Mock } => {
  const groupBy = jest.fn();
  const transaction = { groupBy };
  const $transaction = jest.fn((fn: (tx: { transaction: typeof transaction }) => unknown) => fn({ transaction }));

  return { prisma: { transaction, $transaction } as unknown as PrismaService, groupBy };
};

describe('BalancesService', () => {
  describe('sumByAccount', () => {
    it('applies the correct sign for every transaction type', async () => {
      const { prisma, groupBy } = prismaDouble();
      const service = new BalancesService(prisma);

      groupBy
        .mockResolvedValueOnce([
          { ...row(1_000), accountId, type: 'INCOME' },
          { ...row(300), accountId, type: 'EXPENSE' },
          { ...row(200), accountId, type: 'TRANSFER' },
          { ...row(50), accountId, type: 'CASHBOX_IN' },
          { ...row(20), accountId, type: 'CASHBOX_OUT' },
        ])
        .mockResolvedValueOnce([]);

      await expect(service.sumByAccount(userId)).resolves.toEqual(new Map([[accountId, 1_000 - 300 - 200 - 50 + 20]]));
    });

    it('nets a TRANSFER to zero across the two accounts it moves money between', async () => {
      const { prisma, groupBy } = prismaDouble();
      const service = new BalancesService(prisma);

      groupBy
        .mockResolvedValueOnce([{ ...row(500), accountId, type: 'TRANSFER' }])
        .mockResolvedValueOnce([{ ...row(500), destinationAccountId: otherAccountId }]);

      const balances = await service.sumByAccount(userId);

      expect((balances.get(accountId) ?? 0) + (balances.get(otherAccountId) ?? 0)).toBe(0);
    });

    it('always carries status CONFIRMED, and date lte only when asOf is given', async () => {
      const { prisma, groupBy } = prismaDouble();
      const service = new BalancesService(prisma);
      groupBy.mockResolvedValue([]);

      await service.sumByAccount(userId);
      const calls = groupBy.mock.calls as [{ where: Record<string, unknown> }][];
      expect(calls[0]![0].where).toEqual({ userId, status: 'CONFIRMED', accountId: { not: null } });

      const asOf = new Date('2026-08-31T00:00:00.000Z');
      await service.sumByAccount(userId, asOf);
      expect(calls[2]![0].where).toEqual({ userId, status: 'CONFIRMED', date: { lte: asOf }, accountId: { not: null } });
    });

    it('maps an account absent from the grouped rows to no entry, so the caller falls back to initialBalance', async () => {
      const { prisma, groupBy } = prismaDouble();
      const service = new BalancesService(prisma);
      groupBy.mockResolvedValue([]);

      await expect(service.sumByAccount(userId)).resolves.toEqual(new Map());
    });
  });

  describe('sumByCashbox', () => {
    it('applies the correct sign for every relevant transaction type', async () => {
      const { prisma, groupBy } = prismaDouble();
      const service = new BalancesService(prisma);

      groupBy
        .mockResolvedValueOnce([
          { ...row(1_000), cashboxId, type: 'CASHBOX_IN' },
          { ...row(400), cashboxId, type: 'CASHBOX_OUT' },
          { ...row(200), cashboxId, type: 'CASHBOX_TRANSFER' },
        ])
        .mockResolvedValueOnce([]);

      await expect(service.sumByCashbox(userId)).resolves.toEqual(new Map([[cashboxId, 1_000 - 400 - 200]]));
    });

    it('nets a CASHBOX_TRANSFER to zero across the two cashboxes it moves money between', async () => {
      const { prisma, groupBy } = prismaDouble();
      const service = new BalancesService(prisma);

      groupBy
        .mockResolvedValueOnce([{ ...row(2_500), cashboxId, type: 'CASHBOX_TRANSFER' }])
        .mockResolvedValueOnce([{ ...row(2_500), destinationCashboxId: otherCashboxId }]);

      const balances = await service.sumByCashbox(userId);

      expect((balances.get(cashboxId) ?? 0) + (balances.get(otherCashboxId) ?? 0)).toBe(0);
    });
  });
});
