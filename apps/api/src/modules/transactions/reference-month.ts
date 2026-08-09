/**
 * `referenceMonth` derivation rules (ADR-0009).
 *
 * All arithmetic goes through `Date.UTC` / `getUTC*`: `@db.Date` columns come back from Prisma as
 * UTC-midnight dates, and local-time getters would roll January 31 into February on a negative-offset host.
 */

/** First of the month, UTC midnight. Also the normalizer for a supplied `referenceMonth`. */
export function startOfMonthUtc(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

/** Create: supplied `referenceMonth` wins (normalized), otherwise derived from `date`. */
export function resolveReferenceMonthOnCreate(input: { date: Date; referenceMonth?: Date | null }): Date {
  return startOfMonthUtc(input.referenceMonth ?? input.date);
}

/**
 * Update: explicit `referenceMonth` wins; otherwise a non-credit-card transaction recomputes only when
 * `date` changed or `isCreditCard` went true -> false. Credit-card transactions never recompute.
 */
export function resolveReferenceMonthOnUpdate(
  current: { date: Date; referenceMonth: Date; isCreditCard: boolean },
  patch: { date?: Date; referenceMonth?: Date | null; isCreditCard?: boolean },
): Date {
  if (patch.referenceMonth) {
    return startOfMonthUtc(patch.referenceMonth);
  }

  const effectiveDate = patch.date ?? current.date;
  const effectiveIsCreditCard = patch.isCreditCard ?? current.isCreditCard;
  const dateChanged = patch.date !== undefined && patch.date.getTime() !== current.date.getTime();
  const cardUnchecked = current.isCreditCard && patch.isCreditCard === false;

  if (!effectiveIsCreditCard && (dateChanged || cardUnchecked)) {
    return startOfMonthUtc(effectiveDate);
  }

  return current.referenceMonth;
}
