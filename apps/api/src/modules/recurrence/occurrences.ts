import { startOfMonthUtc } from '../transactions/reference-month';

/**
 * Occurrence calculation for `RecurrenceRule` (M7-T02, ADR-0014). Pure — no Prisma — so the
 * termination logic (`until`/`endDate`/`totalOccurrences`) is unit-testable without a database.
 *
 * All arithmetic goes through `Date.UTC` / `getUTC*`, mirroring `reference-month.ts`: `@db.Date`
 * columns come back from Prisma as UTC-midnight dates, and local-time getters would roll a
 * month-end date into the next month on a negative-offset host.
 */

export interface RecurrenceRuleLike {
  frequency: 'MONTHLY' | 'YEARLY';
  interval: number;
  dayOfMonth: number;
  startDate: Date;
  endDate: Date | null;
  totalOccurrences: number | null;
  generatedUntil: Date | null;
  isActive: boolean;
}

export { startOfMonthUtc as referenceMonthFor };

/** `min(dayOfMonth, daysInMonth)` — 31 becomes 28/29 in February, 30 in April. */
function clampDayOfMonth(year: number, month: number, dayOfMonth: number): number {
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return Math.min(dayOfMonth, daysInMonth);
}

function occurrenceDate(year: number, month: number, dayOfMonth: number): Date {
  return new Date(Date.UTC(year, month, clampDayOfMonth(year, month, dayOfMonth)));
}

/**
 * Occurrences strictly after the last generated one (or `startDate`, on the first run), up to and
 * including `until`, further bounded by `endDate` and `totalOccurrences`.
 *
 * `alreadyGenerated` is the count of transactions this rule has produced in earlier runs — needed
 * because `totalOccurrences` caps the lifetime count, not just this batch.
 */
export function computeOccurrences(rule: RecurrenceRuleLike, until: Date, alreadyGenerated = 0): Date[] {
  if (!rule.isActive) {
    return [];
  }

  if (rule.totalOccurrences !== null && alreadyGenerated >= rule.totalOccurrences) {
    return [];
  }

  const step = rule.frequency === 'YEARLY' ? 12 * rule.interval : rule.interval;
  const startMonth = rule.startDate.getUTCMonth();

  // First run starts at `startDate`'s month; a subsequent run starts one step after
  // `generatedUntil`'s month, so the same occurrence is never produced twice.
  let year: number;
  let month: number;

  if (rule.generatedUntil === null) {
    year = rule.startDate.getUTCFullYear();
    month = startMonth;
  } else {
    year = rule.generatedUntil.getUTCFullYear();
    month = rule.generatedUntil.getUTCMonth() + step;
  }

  const occurrences: Date[] = [];
  let count = alreadyGenerated;

  for (;;) {
    if (month >= 12) {
      year += Math.floor(month / 12);
      month = month % 12;
    }

    const date = occurrenceDate(year, month, rule.dayOfMonth);

    if (date.getTime() > until.getTime()) {
      break;
    }

    if (rule.endDate !== null && date.getTime() > rule.endDate.getTime()) {
      break;
    }

    if (rule.totalOccurrences !== null && count >= rule.totalOccurrences) {
      break;
    }

    occurrences.push(date);
    count += 1;
    month += step;
  }

  return occurrences;
}
