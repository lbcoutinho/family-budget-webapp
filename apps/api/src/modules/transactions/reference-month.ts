/**
 * `referenceMonth` is derived from `settlementDate`.
 *
 * All arithmetic goes through `Date.UTC` / `getUTC*`: `@db.Date` columns come back from Prisma as
 * UTC-midnight dates, and local-time getters would roll January 31 into February on a negative-offset host.
 */

/** First of the month, UTC midnight. */
export function startOfMonthUtc(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}
