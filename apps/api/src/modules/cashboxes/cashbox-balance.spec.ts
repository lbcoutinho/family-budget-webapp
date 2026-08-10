import { type Prisma } from '../../generated/prisma/client';

import { cashboxBalances } from './cashbox-balance';

const userId = '11111111-1111-1111-1111-111111111111';
const cashboxId = '22222222-2222-2222-2222-222222222222';
const otherCashboxId = '33333333-3333-3333-3333-333333333333';

const prismaDouble = (): { client: Prisma.TransactionClient; groupBy: jest.Mock } => {
  const groupBy = jest.fn();

  return { client: { transaction: { groupBy } } as unknown as Prisma.TransactionClient, groupBy };
};

describe('cashboxBalances', () => {
  it('defaults an id with no rows to 0', async () => {
    const { client, groupBy } = prismaDouble();
    groupBy.mockResolvedValue([]);

    await expect(cashboxBalances(client, userId, [cashboxId])).resolves.toEqual(new Map([[cashboxId, 0]]));
  });

  it('nets CASHBOX_IN minus CASHBOX_OUT', async () => {
    const { client, groupBy } = prismaDouble();
    groupBy.mockResolvedValue([
      { type: 'CASHBOX_IN', cashboxId, destinationCashboxId: null, _sum: { amount: 10_000 } },
      { type: 'CASHBOX_OUT', cashboxId, destinationCashboxId: null, _sum: { amount: 4_000 } },
    ]);

    await expect(cashboxBalances(client, userId, [cashboxId])).resolves.toEqual(new Map([[cashboxId, 6_000]]));
  });

  it('subtracts a transfer from the source and adds it to the destination', async () => {
    const { client, groupBy } = prismaDouble();
    groupBy.mockResolvedValue([{ type: 'CASHBOX_TRANSFER', cashboxId, destinationCashboxId: otherCashboxId, _sum: { amount: 2_500 } }]);

    await expect(cashboxBalances(client, userId, [cashboxId, otherCashboxId])).resolves.toEqual(
      new Map([
        [cashboxId, -2_500],
        [otherCashboxId, 2_500],
      ]),
    );
  });

  it('ignores rows for transaction types that never touch a cashbox', async () => {
    const { client, groupBy } = prismaDouble();
    groupBy.mockResolvedValue([
      { type: 'INCOME', cashboxId: null, destinationCashboxId: null, _sum: { amount: 50_000 } },
      { type: 'CASHBOX_IN', cashboxId, destinationCashboxId: null, _sum: { amount: 1_000 } },
    ]);

    await expect(cashboxBalances(client, userId, [cashboxId])).resolves.toEqual(new Map([[cashboxId, 1_000]]));
  });

  it('filters to CONFIRMED so a DRAFT transaction is excluded at the database level', async () => {
    const { client, groupBy } = prismaDouble();
    groupBy.mockResolvedValue([]);

    await cashboxBalances(client, userId, [cashboxId]);

    const [[call]] = groupBy.mock.calls as [[Prisma.TransactionGroupByArgs]];
    expect(call.where).toMatchObject({ status: 'CONFIRMED' });
  });

  it('scopes to the given userId so another user is excluded at the database level', async () => {
    const { client, groupBy } = prismaDouble();
    groupBy.mockResolvedValue([]);

    await cashboxBalances(client, userId, [cashboxId]);

    const [[call]] = groupBy.mock.calls as [[Prisma.TransactionGroupByArgs]];
    expect(call.where).toMatchObject({ userId });
  });

  it('resolves several ids in one call, each keyed independently', async () => {
    const { client, groupBy } = prismaDouble();
    groupBy.mockResolvedValue([
      { type: 'CASHBOX_IN', cashboxId, destinationCashboxId: null, _sum: { amount: 3_000 } },
      { type: 'CASHBOX_IN', cashboxId: otherCashboxId, destinationCashboxId: null, _sum: { amount: 7_000 } },
    ]);

    await expect(cashboxBalances(client, userId, [cashboxId, otherCashboxId])).resolves.toEqual(
      new Map([
        [cashboxId, 3_000],
        [otherCashboxId, 7_000],
      ]),
    );

    const [[call]] = groupBy.mock.calls as [[Prisma.TransactionGroupByArgs]];
    expect(call.where).toMatchObject({
      OR: [{ cashboxId: { in: [cashboxId, otherCashboxId] } }, { destinationCashboxId: { in: [cashboxId, otherCashboxId] } }],
    });
  });
});
