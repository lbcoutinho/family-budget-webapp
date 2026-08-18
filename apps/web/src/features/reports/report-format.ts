/**
 * Small pure helpers shared by the monthly and yearly views — percentage formatting, the
 * against-the-average colour rule, and the "does this row have real subcategories" check. Kept
 * out of `lib/money.ts` because they are report-specific, not general money formatting.
 */

import { AUTOMATIC_CATEGORY_COLOR } from '@/features/categories/category-colors';
import i18n from '@/i18n';

const MINUS = '−';

const wholeEuroFormatters = new Map<string, Intl.NumberFormat>();

function wholeEuroFormatter(locale: string): Intl.NumberFormat {
  const existing = wholeEuroFormatters.get(locale);
  if (existing) return existing;

  const formatter = new Intl.NumberFormat(locale, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  wholeEuroFormatters.set(locale, formatter);

  return formatter;
}

/** `formatWholeEuros(115000)` → `"1.150 €"`. Only the yearly matrix rounds to whole euros — every
 * other screen keeps cents (`plans/screens/10-yearly-report.md`). */
export function formatWholeEuros(cents: number, { sign = false, locale = i18n.language }: { sign?: boolean; locale?: string } = {}): string {
  const rounded = Math.round(cents / 100);
  const amount = wholeEuroFormatter(locale).format(Math.abs(rounded));

  if (rounded < 0) return sign ? `${MINUS} ${amount} €` : `${MINUS}${amount} €`;

  return sign ? `+ ${amount} €` : `${amount} €`;
}

const percentFormatters = new Map<string, Intl.NumberFormat>();

function percentFormatter(locale: string): Intl.NumberFormat {
  const existing = percentFormatters.get(locale);
  if (existing) return existing;

  const formatter = new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  percentFormatters.set(locale, formatter);

  return formatter;
}

/** `formatPercent(48.8)` → `"48,8%"`. Never signed — the percentage-of-total column is never negative. */
export function formatPercent(value: number, locale: string = i18n.language): string {
  return `${percentFormatter(locale).format(value)}%`;
}

/** `formatSignedPercent(-5.5)` → `"−5,5%"`, `formatSignedPercent(11.9)` → `"+11,9%"`. Used only by the against-the-average column, where the sign is the point. */
export function formatSignedPercent(value: number, locale: string = i18n.language): string {
  const formatted = percentFormatter(locale).format(Math.abs(value));
  return value < 0 ? `${MINUS}${formatted}%` : `+${formatted}%`;
}

/** A category's own colour, or the shared automatic fallback (same rule the categories screen uses). */
export function categoryColor(color: string | null): string {
  // `AUTOMATIC_CATEGORY_COLOR` is the palette's own last entry — always present, but
  // `noUncheckedIndexedAccess` doesn't know that from a computed index.
  return color ?? AUTOMATIC_CATEGORY_COLOR!;
}

/** A row's subcategory list is only worth expanding into when at least one entry has a real
 * subcategory. A category whose transactions never had one still returns a single bucket keyed
 * `subcategoryId: null` — identical in value to the parent row, so expanding it would show nothing
 * new (`prototypes/approved/09-reports-monthly.html`, "Lazer"/"Saúde" carry no expander). */
export function hasSubcategoryBreakdown(subcategories: { subcategoryId: string | null }[]): boolean {
  return subcategories.some((subcategory) => subcategory.subcategoryId !== null);
}

export type AverageTone = 'good' | 'bad' | 'flat' | null;

export interface AverageDelta {
  /** Percentage vs. the rolling average, e.g. `11.9` for "+11,9%". `null` when the average is zero — nothing to compare against. */
  percent: number | null;
  tone: AverageTone;
}

/**
 * The against-the-average column's one and only reversal: an expense above its average reads bad
 * (red), an income above its average reads good (green) — everywhere else in the app red/green
 * mean out/in, never bad/good (`plans/screens/global-rules.md` §2.6, `09-monthly-report.md`).
 */
export function averageDelta(amount: number, average: number, kind: 'INCOME' | 'EXPENSE'): AverageDelta {
  if (average === 0) return { percent: null, tone: null };

  const percent = ((amount - average) / average) * 100;
  if (percent === 0) return { percent, tone: 'flat' };

  const aboveAverage = percent > 0;
  const tone: AverageTone = aboveAverage === (kind === 'EXPENSE') ? 'bad' : 'good';

  return { percent, tone };
}

export const AVERAGE_TONE_CLASS: Record<Exclude<AverageTone, null>, string> = {
  good: 'text-emerald-700',
  bad: 'text-destructive',
  flat: 'text-muted-foreground',
};

/** `monthIndex` is 0-based (0 = January). A month hasn't happened yet when it is later than the
 * current one in the current year, or the requested year is entirely ahead of today — the yearly
 * matrix draws those as `—` and keeps the column rather than hiding it (`10-reports-yearly.html`). */
export function isFutureMonth(year: number, monthIndex: number, now: Date = new Date()): boolean {
  if (year > now.getFullYear()) return true;
  if (year < now.getFullYear()) return false;
  return monthIndex > now.getMonth();
}
