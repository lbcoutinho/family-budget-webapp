/**
 * Month helpers. Every screen in the application is anchored to a month — the entry list, both
 * reports, the recurrence preview — so "which month is this, and where does it start and end"
 * belongs in one place rather than in each of them.
 *
 * Everything here works in the browser's local time zone on purpose. A reference month is a label
 * the user picked, not an instant: normalizing it through UTC is what makes July show up as June
 * for anyone west of Greenwich.
 */

import i18n from '@/i18n';

// One formatter per locale rather than one for the whole application: the map is what makes
// switching language at runtime relabel every month.
const monthAndYearFormatters = new Map<string, Intl.DateTimeFormat>();

function monthAndYear(locale: string): Intl.DateTimeFormat {
  const existing = monthAndYearFormatters.get(locale);

  if (existing) {
    return existing;
  }

  const formatter = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' });
  monthAndYearFormatters.set(locale, formatter);

  return formatter;
}

const monthNameFormatters = new Map<string, Intl.DateTimeFormat>();

function monthName(locale: string): Intl.DateTimeFormat {
  const existing = monthNameFormatters.get(locale);

  if (existing) {
    return existing;
  }

  const formatter = new Intl.DateTimeFormat(locale, { month: 'long' });
  monthNameFormatters.set(locale, formatter);

  return formatter;
}

const monthAbbreviationFormatters = new Map<string, Intl.DateTimeFormat>();

function monthAbbreviation(locale: string): Intl.DateTimeFormat {
  const existing = monthAbbreviationFormatters.get(locale);

  if (existing) {
    return existing;
  }

  const formatter = new Intl.DateTimeFormat(locale, { month: 'short' });
  monthAbbreviationFormatters.set(locale, formatter);

  return formatter;
}

/** `formatMonthAbbreviation(new Date(2026, 6, 1))` → `"jul"`. The yearly report matrix's twelve
 * column headers — short enough that twelve of them still fit a table. Defaults to the active
 * language. */
export function formatMonthAbbreviation(date: Date, locale: string = i18n.language): string {
  return monthAbbreviation(locale).format(date).replace('.', '');
}

const fullDateFormatters = new Map<string, Intl.DateTimeFormat>();

function fullDate(locale: string): Intl.DateTimeFormat {
  const existing = fullDateFormatters.get(locale);

  if (existing) {
    return existing;
  }

  const formatter = new Intl.DateTimeFormat(locale, { day: '2-digit', month: '2-digit', year: 'numeric' });
  fullDateFormatters.set(locale, formatter);

  return formatter;
}

/** `formatDate(new Date(2026, 7, 10))` → `"10/08/2026"`. The recurrences screen's occurrence
 * preview and its rules/plans table both show a full day/month/year date — this is the one place
 * that formats it. Defaults to the active language. */
export function formatDate(date: Date, locale: string = i18n.language): string {
  return fullDate(locale).format(date);
}

/** Parses only `YYYY-MM-DD` as a local-time date — not an instant, so no UTC/timezone shift. Every
 * recurrence-rule date field (`startDate`, `endDate`, `generatedUntil`) is this shape. */
export function parseDateOnly(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year!, (month ?? 1) - 1, day ?? 1);
}

/** Formats a local calendar day for API parameters, without turning it into a UTC instant. */
export function formatDateOnly(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

/** The first day of the month the date falls in, at midnight. This is `referenceMonth`'s shape. */
export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

/** `formatMonth(new Date(2026, 6, 15))` → `"Julho de 2026"`. Defaults to the active language. */
export function formatMonth(date: Date, locale: string = i18n.language): string {
  const formatted = monthAndYear(locale).format(date);

  // pt-BR month names are lowercase; the interface uses them as titles ("Julho de 2026"), so the
  // capital is added here rather than by a CSS transform that would also hit the year. It is a
  // no-op in en-US, where `Intl` already capitalizes.
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

/** `formatMonthName(new Date(2026, 6, 15))` → `"julho"`. Lowercase on purpose: used inline in a
 * sentence ("Depositado em julho"), not as a title, so unlike `formatMonth` no capitalization
 * fix-up is applied. Defaults to the active language. */
export function formatMonthName(date: Date, locale: string = i18n.language): string {
  return monthName(locale).format(date);
}

export interface MonthRange {
  /** First day of the month, at midnight. */
  start: Date;
  /** Last day of the month, at 23:59:59.999 — inclusive, so `date <= end` is the whole month. */
  end: Date;
}

/**
 * The half-open alternative (`start <= date < nextStart`) was the other option and is deliberately
 * not what this returns: every consumer so far filters an inclusive range, and an exclusive end
 * that reads as "the 1st of August" invites off-by-one bugs when it is displayed rather than
 * compared.
 */
export function monthRange(date: Date): MonthRange {
  const start = startOfMonth(date);
  // Day 0 of the next month is the last day of this one — no month-length table, and February
  // works in leap years for free.
  const end = new Date(start.getFullYear(), start.getMonth() + 1, 0, 23, 59, 59, 999);

  return { start, end };
}

/** Builds the canonical URL for a local reference month. */
export function monthPath(date: Date): string {
  const year = String(date.getFullYear()).padStart(4, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');

  return `/month/${year}/${month}`;
}

/** The canonical URL for the browser's current local month. */
export function currentMonthPath(date: Date = new Date()): string {
  return monthPath(date);
}

/**
 * Parses only the canonical `:year/:month` route representation. Route months are labels, so
 * construct this in local time instead of interpreting an ISO string as an instant.
 */
export function monthFromPathParams(year: string | undefined, month: string | undefined): Date | undefined {
  if (!year || !month || !/^\d{4}$/.test(year) || !/^(0[1-9]|1[0-2])$/.test(month) || year === '0000') {
    return undefined;
  }

  return new Date(Number(year), Number(month) - 1, 1);
}
