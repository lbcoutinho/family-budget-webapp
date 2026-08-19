import { badRequest } from '../../common/api-error';

/**
 * Splits `totalCents` into `count` parts that sum exactly to `totalCents` (M7-T04, ADR-0014).
 *
 * The remainder of the integer division lands entirely on the **final** installment —
 * €100.00 / 3 -> `[3333, 3333, 3334]` — so every earlier row is a round, predictable amount and only
 * the last one absorbs the odd cent. Money stays integer cents throughout; no float division (ADR-0005).
 */
export function splitInstallments(totalCents: number, count: number): number[] {
  if (count < 1) {
    throw badRequest('INSTALLMENT_COUNT_INVALID', 'installments must be at least 1.');
  }

  if (totalCents < count) {
    throw badRequest('INSTALLMENT_AMOUNT_TOO_LOW', 'totalAmount must be at least 1 cent per installment.');
  }

  const base = Math.floor(totalCents / count);
  const split = new Array<number>(count).fill(base);

  split[count - 1] = totalCents - base * (count - 1);

  return split;
}
