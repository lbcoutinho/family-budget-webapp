import { type Occurrence, computeOccurrences } from './occurrences';

/** An installment plan is always monthly, step 1, open-ended-cap-free for this purpose — the dialog
 * just needs `count` consecutive monthly dates from `firstPaymentDate`, day-of-month clamped the
 * same way a fixed rule is (M7-T02). Delegates to `computeOccurrences` so both previews share one
 * clamping implementation. */
export function installmentOccurrenceDates(firstPaymentDate: string, count: number): Occurrence[] {
  if (count < 1) return [];

  const [year, month, day] = firstPaymentDate.split('-').map(Number);
  if (!year || !month || !day) return [];

  const until = new Date(year, month - 1 + count, 0);

  return computeOccurrences(
    {
      frequency: 'MONTHLY',
      interval: 1,
      dayOfMonth: day,
      startDate: firstPaymentDate,
      endDate: null,
      totalOccurrences: count,
      generatedUntil: null,
    },
    until,
  );
}
