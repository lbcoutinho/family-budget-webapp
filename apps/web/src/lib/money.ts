/**
 * Money is integer cents everywhere in the application — never a float, never a Decimal — and this
 * file is the only place that turns those cents into something a person reads, or reads something
 * a person typed back into cents.
 *
 * Single currency (euro), single locale for the numbers (pt-BR): `1.234,56 €`.
 */

// Built once: constructing an `Intl.NumberFormat` per row is the expensive half of formatting a
// table, and this one never varies.
const decimal = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** U+2212, the typographic minus. Wider than a hyphen and aligned with the digits. */
const MINUS = '−';

export interface FormatCentsOptions {
  /**
   * Show an explicit `+` on positive values, as the entry rows do where the sign carries the
   * meaning. Off by default: a balance is just a number, and a `+` in front of every one of them
   * is noise.
   */
  sign?: boolean;
}

/**
 * `formatCents(123456)` → `"1.234,56 €"`, `formatCents(-3500)` → `"−35,00 €"`.
 *
 * A negative value keeps its minus whatever `sign` says: there it is information, not decoration.
 */
export function formatCents(cents: number, { sign = false }: FormatCentsOptions = {}): string {
  // Cents are integers by contract; rounding here means a value that slipped through arithmetic
  // (a division, an average) still prints as money instead of as `1.234,565 €`.
  const rounded = Math.round(cents);
  const amount = decimal.format(Math.abs(rounded) / 100);

  if (rounded < 0) {
    return sign ? `${MINUS} ${amount} €` : `${MINUS}${amount} €`;
  }

  return sign ? `+ ${amount} €` : `${amount} €`;
}

/**
 * The other direction: what someone typed into a currency field, as integer cents.
 *
 * Both notations are accepted, because both are typed in practice — `"1.234,56"` by anyone using
 * the pt-BR keyboard the interface is written for, and `"1234.56"` by anyone whose habits come
 * from a spreadsheet or a US locale. Returns `null` when the input is not a number at all, so the
 * caller can tell "empty or nonsense" from a legitimate zero.
 */
export function parseCurrencyInput(input: string): number | null {
  // Currency symbol, spaces and the typographic minus are all things a user can paste back in
  // from a formatted value. `\s` already covers the non-breaking space `Intl` can emit.
  const cleaned = input.replace(/[\s\u20ac]/g, '').replace(new RegExp(MINUS, 'g'), '-');

  if (cleaned === '') {
    return null;
  }

  const negative = cleaned.startsWith('-');
  const digitsAndSeparators = cleaned.replace(/^[+-]/, '');

  if (!/^[\d.,]+$/.test(digitsAndSeparators)) {
    return null;
  }

  const decimalSeparator = findDecimalSeparator(digitsAndSeparators);
  const [whole = '', fraction = ''] = split(digitsAndSeparators, decimalSeparator);

  if (whole === '' && fraction === '') {
    return null;
  }

  // Anything past the second decimal is rounded rather than rejected: a pasted `"12,345"` is a
  // value, not a typo, and cents are as fine as this application gets.
  const cents = Math.round(Number(`${whole || '0'}.${fraction || '0'}`) * 100);

  if (!Number.isFinite(cents)) {
    return null;
  }

  return negative ? -cents : cents;
}

/**
 * Which of `.` and `,` is the decimal point in what was typed.
 *
 * With both present the answer is easy — the rightmost one wins, the other groups thousands. With
 * only dots it is genuinely ambiguous, and the tie-break is the group size: `1.234` is a thousand
 * separator (pt-BR), `1234.56` is a decimal point, because a thousands group is always exactly
 * three digits. A comma alone is always the decimal point; nobody groups thousands with commas in
 * a pt-BR field.
 */
function findDecimalSeparator(value: string): ',' | '.' | null {
  const lastComma = value.lastIndexOf(',');
  const lastDot = value.lastIndexOf('.');

  if (lastComma >= 0) {
    return lastComma > lastDot ? ',' : '.';
  }

  if (lastDot < 0) {
    return null;
  }

  const isGrouping = value
    .split('.')
    .slice(1)
    .every((group) => group.length === 3);

  return isGrouping ? null : '.';
}

function split(value: string, separator: ',' | '.' | null): [string, string] {
  const digitsOnly = (part: string) => part.replace(/[.,]/g, '');

  if (separator === null) {
    return [digitsOnly(value), ''];
  }

  const at = value.lastIndexOf(separator);

  return [digitsOnly(value.slice(0, at)), digitsOnly(value.slice(at + 1))];
}
