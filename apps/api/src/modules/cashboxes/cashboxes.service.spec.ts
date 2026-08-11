import { NotFoundException } from '@nestjs/common';

import { type Cashbox } from '../../generated/prisma/client';
import { type PrismaService } from '../../prisma/prisma.service';
import { type BalancesService } from '../transactions/balances.service';

import { CashboxesService } from './cashboxes.service';

const userId = '11111111-1111-1111-1111-111111111111';
const otherUserId = '22222222-2222-2222-2222-222222222222';
const cashboxId = '33333333-3333-3333-3333-333333333333';

const row = (overrides: Partial<Cashbox> = {}): Cashbox => ({
  id: cashboxId,
  userId,
  name: 'Fundo de emergência',
  description: 'Seis meses de despesas fixas.',
  targetAmount: 500_000,
  isActive: true,
  sortOrder: 0,
  createdAt: new Date('2026-07-01T10:00:00.000Z'),
  updatedAt: new Date('2026-07-02T10:00:00.000Z'),
  ...overrides,
});

/**
 * `$transaction` runs its callback against the same `cashbox`/`transaction` doubles, so `remove`'s
 * zero-balance guard (which reads `transaction.groupBy` and writes `cashbox.delete` inside the
 * callback) can be asserted on exactly like the calls it made outside one.
 */
const prismaDouble = (): {
  prisma: PrismaService;
  cashbox: Record<'findMany' | 'findUnique' | 'create' | 'update' | 'delete', jest.Mock>;
  groupBy: jest.Mock;
} => {
  const cashbox = {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };
  const groupBy = jest.fn().mockResolvedValue([]);
  const $transaction = jest.fn((fn: (tx: { cashbox: typeof cashbox; transaction: { groupBy: typeof groupBy } }) => unknown) =>
    fn({ cashbox, transaction: { groupBy } }),
  );

  return { prisma: { cashbox, $transaction } as unknown as PrismaService, cashbox, groupBy };
};

describe('CashboxesService', () => {
  let service: CashboxesService;
  let cashbox: ReturnType<typeof prismaDouble>['cashbox'];
  let groupBy: jest.Mock;
  let sumByCashbox: jest.Mock;

  beforeEach(() => {
    const double = prismaDouble();

    cashbox = double.cashbox;
    groupBy = double.groupBy;
    sumByCashbox = jest.fn().mockResolvedValue(new Map<string, number>());
    service = new CashboxesService(double.prisma, { sumByCashbox } as unknown as BalancesService);
  });

  describe('findAll', () => {
    it('hides inactive cashboxes by default and orders by sort order then name', async () => {
      cashbox.findMany.mockResolvedValue([row()]);

      await expect(service.findAll(userId, {})).resolves.toEqual([
        {
          id: cashboxId,
          name: 'Fundo de emergência',
          description: 'Seis meses de despesas fixas.',
          targetAmount: 500_000,
          isActive: true,
          sortOrder: 0,
          createdAt: '2026-07-01T10:00:00.000Z',
          updatedAt: '2026-07-02T10:00:00.000Z',
        },
      ]);

      expect(cashbox.findMany).toHaveBeenCalledWith({
        where: { userId, OR: [{ isActive: true }] },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      });
    });

    it('keeps a goalless cashbox null rather than turning it into a zero', async () => {
      cashbox.findMany.mockResolvedValue([row({ description: null, targetAmount: null })]);

      await expect(service.findAll(userId, {})).resolves.toMatchObject([{ description: null, targetAmount: null }]);
    });

    it('drops the visibility filter entirely for includeInactive', async () => {
      cashbox.findMany.mockResolvedValue([]);

      await service.findAll(userId, { includeInactive: true });

      expect(cashbox.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId } }));
    });

    it('lets includeId through alongside the active ones', async () => {
      cashbox.findMany.mockResolvedValue([]);

      await service.findAll(userId, { includeId: cashboxId });

      expect(cashbox.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId, OR: [{ isActive: true }, { id: cashboxId }] } }));
    });

    // A branch of `{ id: undefined }` would match every row, inactive ones included — the exact
    // leak the array-building in `visibility()` exists to avoid.
    it('never emits an OR branch with an undefined id', async () => {
      cashbox.findMany.mockResolvedValue([]);

      await service.findAll(userId, { includeInactive: false, includeId: undefined });

      expect(cashbox.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId, OR: [{ isActive: true }] } }));
    });
  });

  describe('findBalances', () => {
    it('reports 0 for a cashbox with no confirmed transactions and includes inactive ones', async () => {
      const untouchedId = '44444444-4444-4444-4444-444444444444';
      cashbox.findMany.mockResolvedValue([row(), row({ id: untouchedId, isActive: false, targetAmount: null })]);
      sumByCashbox.mockResolvedValue(new Map([[cashboxId, 6_000]]));

      await expect(service.findBalances(userId)).resolves.toEqual([
        { cashboxId, name: 'Fundo de emergência', isActive: true, targetAmount: 500_000, balance: 6_000 },
        { cashboxId: untouchedId, name: 'Fundo de emergência', isActive: false, targetAmount: null, balance: 0 },
      ]);
      expect(cashbox.findMany).toHaveBeenCalledWith({ where: { userId }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] });
    });

    it('passes asOf through to the aggregation', async () => {
      const asOf = new Date('2026-08-31T00:00:00.000Z');
      cashbox.findMany.mockResolvedValue([]);

      await service.findBalances(userId, asOf);

      expect(sumByCashbox).toHaveBeenCalledWith(userId, asOf);
    });
  });

  describe('ownership', () => {
    it.each([
      ['findOne', () => service.findOne(userId, cashboxId)],
      ['update', () => service.update(userId, cashboxId, { name: 'Renamed' })],
      ['setActive', () => service.setActive(userId, cashboxId, false)],
      ['remove', () => service.remove(userId, cashboxId)],
    ])("answers 404, not 403, when %s hits another user's cashbox", async (_name, call) => {
      cashbox.findUnique.mockResolvedValue(row({ userId: otherUserId }));

      await expect(call()).rejects.toThrow(NotFoundException);
      expect(cashbox.update).not.toHaveBeenCalled();
      expect(cashbox.delete).not.toHaveBeenCalled();
    });

    it('answers 404 for an id that does not exist at all', async () => {
      cashbox.findUnique.mockResolvedValue(null);

      await expect(service.findOne(userId, cashboxId)).rejects.toThrow(NotFoundException);
    });
  });

  it('creates with the userId from the token, never from the body', async () => {
    cashbox.create.mockResolvedValue(row());

    await service.create(userId, { name: 'Fundo de emergência', targetAmount: 500_000 });

    expect(cashbox.create).toHaveBeenCalledWith({ data: { name: 'Fundo de emergência', targetAmount: 500_000, userId } });
  });

  it('passes an explicit null through, so an edit can clear the goal', async () => {
    cashbox.findUnique.mockResolvedValue(row());
    cashbox.update.mockResolvedValue(row({ targetAmount: null }));

    await expect(service.update(userId, cashboxId, { targetAmount: null })).resolves.toMatchObject({ targetAmount: null });
    expect(cashbox.update).toHaveBeenCalledWith({ where: { id: cashboxId }, data: { targetAmount: null } });
  });

  it.each([
    ['activate', true],
    ['deactivate', false],
  ])('flips isActive for %s', async (_name, isActive) => {
    cashbox.findUnique.mockResolvedValue(row());
    cashbox.update.mockResolvedValue(row({ isActive }));

    await expect(service.setActive(userId, cashboxId, isActive)).resolves.toMatchObject({ isActive });
    expect(cashbox.update).toHaveBeenCalledWith({ where: { id: cashboxId }, data: { isActive } });
  });

  it('deletes for real rather than soft-deleting, once the balance is confirmed zero', async () => {
    cashbox.findUnique.mockResolvedValue(row());
    cashbox.delete.mockResolvedValue(row());
    groupBy.mockResolvedValue([]);

    await service.remove(userId, cashboxId);

    expect(cashbox.delete).toHaveBeenCalledWith({ where: { id: cashboxId } });
    // Not a disguised deactivation: nothing was written to `isActive`.
    expect(cashbox.update).not.toHaveBeenCalled();
  });

  // ADR-0019: a non-zero balance blocks the delete outright — the guard, not the foreign key
  // (which no longer fires; `onDelete: SetNull` since M4-T01), is what stands in the way now.
  it('refuses to delete a cashbox that still holds a balance', async () => {
    cashbox.findUnique.mockResolvedValue(row());
    groupBy.mockResolvedValue([{ type: 'CASHBOX_IN', cashboxId, destinationCashboxId: null, _sum: { amount: 5_000 } }]);

    await expect(service.remove(userId, cashboxId)).rejects.toMatchObject({
      response: { code: 'CASHBOX_NOT_EMPTY' },
    });
    expect(cashbox.delete).not.toHaveBeenCalled();
  });
});
