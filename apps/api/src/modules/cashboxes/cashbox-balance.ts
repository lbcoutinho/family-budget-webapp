import { type Prisma } from '../../generated/prisma/client';

/**
 * Cashbox balances (`plans/0001-overview.md` §5.4), aggregated in SQL rather than folded from raw
 * rows: `initialBalance + CASHBOX_IN − CASHBOX_OUT`, plus `CASHBOX_TRANSFER` moving money `−` from
 * the source and `+` into the destination (ADR-0007). Takes a `Prisma.TransactionClient` so it can run inside the same
 * `$transaction` as the write that needs the balance — e.g. the zero-balance check before a cashbox
 * delete (ADR-0019) — without a second round trip.
 */
export async function cashboxBalances(client: Prisma.TransactionClient, userId: string, ids: string[]): Promise<Map<string, number>> {
  const [cashboxes, rows] = await Promise.all([
    client.cashbox.findMany({ where: { userId, id: { in: ids } }, select: { id: true, initialBalance: true } }),
    client.transaction.groupBy({
      by: ['type', 'cashboxId', 'destinationCashboxId'],
      _sum: { amount: true },
      where: { userId, status: 'CONFIRMED', OR: [{ cashboxId: { in: ids } }, { destinationCashboxId: { in: ids } }] },
    }),
  ]);
  const balances = new Map<string, number>(ids.map((id) => [id, 0]));
  for (const cashbox of cashboxes) balances.set(cashbox.id, cashbox.initialBalance);

  for (const row of rows) {
    const amount = row._sum.amount ?? 0;

    if (row.type === 'CASHBOX_IN' && row.cashboxId !== null) {
      balances.set(row.cashboxId, (balances.get(row.cashboxId) ?? 0) + amount);
    } else if (row.type === 'CASHBOX_OUT' && row.cashboxId !== null) {
      balances.set(row.cashboxId, (balances.get(row.cashboxId) ?? 0) - amount);
    } else if (row.type === 'CASHBOX_TRANSFER') {
      if (row.cashboxId !== null) {
        balances.set(row.cashboxId, (balances.get(row.cashboxId) ?? 0) - amount);
      }
      if (row.destinationCashboxId !== null) {
        balances.set(row.destinationCashboxId, (balances.get(row.destinationCashboxId) ?? 0) + amount);
      }
    }
  }

  return balances;
}
