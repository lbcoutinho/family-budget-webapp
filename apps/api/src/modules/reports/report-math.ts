/**
 * Pure aggregation math for the monthly report (M6-T01). No Prisma, no I/O — `ReportsService`
 * composes these from grouped rows.
 */

/**
 * Largest-remainder rounding: raw percentages to 2 decimals, then the rounding drift is handed to
 * the largest remainders so the list sums to exactly 100.00. Assumes `amounts` sums to `total`
 * (the caller passes an exhaustive partition, e.g. every category on one side of the report).
 * `total === 0` (or an empty list) yields all zeros — no division.
 */
export function distributePercentages(amounts: number[], total: number): number[] {
  if (total === 0 || amounts.length === 0) {
    return amounts.map(() => 0);
  }

  // Work in hundredths of a percent (10_000 units = 100.00%) so the remainder comparison and the
  // final division by 100 both stay exact for the 2-decimal contract.
  const scaled = amounts.map((amount) => (amount / total) * 10_000);
  const floored = scaled.map(Math.floor);
  let remainder = 10_000 - floored.reduce((sum, value) => sum + value, 0);

  const byRemainderDesc = scaled.map((value, index) => ({ index, fraction: value - Math.floor(value) })).sort((a, b) => b.fraction - a.fraction);

  const units = [...floored];
  for (const { index } of byRemainderDesc) {
    if (remainder <= 0) break;
    units[index] = (units[index] ?? 0) + 1;
    remainder--;
  }

  return units.map((hundredths) => hundredths / 100);
}

/**
 * The 12 UTC month-starts ending at (and including) `end`. Shared by the monthly report's rolling
 * average (M6-T01) and the yearly report's average window (M6-T02, #182) — both need the same
 * "12 months ending here" enumeration, only the endpoint differs.
 */
export function monthsEndingAt(end: Date): Date[] {
  return Array.from({ length: 12 }, (_, i) => new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - (11 - i), 1)));
}

/**
 * The 12-month window `rollingAverage` is computed over: `from` the 1st of the month 11 months
 * before `endMonth`, `to` is `endMonth` itself, both inclusive. `endMonth` must already be a
 * UTC-midnight month start (callers normalize before calling, same convention as `startOfMonthUtc`).
 */
export function averageWindow(endMonth: Date): { from: Date; to: Date } {
  return { from: monthsEndingAt(endMonth)[0]!, to: endMonth };
}

/**
 * `sum / count of months with a non-zero amount` over the supplied window, `0` when none had
 * movement. One entry per month in the window (12, ending with the requested month) — zero for a
 * month with no activity. Window construction (crossing the year boundary) is the caller's job;
 * this function only sees the amounts.
 */
export function rollingAverage(amountsByMonth: number[]): number {
  const monthsWithMovement = amountsByMonth.filter((amount) => amount !== 0);

  if (monthsWithMovement.length === 0) {
    return 0;
  }

  const sum = monthsWithMovement.reduce((total, amount) => total + amount, 0);
  return Math.round(sum / monthsWithMovement.length);
}
