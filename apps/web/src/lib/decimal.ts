export function formatDecimal(value: string, locale: string, maximumFractionDigits = 4): string {
  const [whole, fraction = ''] = value.split('.');
  const formattedWhole = new Intl.NumberFormat(locale).format(BigInt(whole ?? '0'));
  if (maximumFractionDigits === 0) return formattedWhole;
  const separator = new Intl.NumberFormat(locale).formatToParts(1.1).find((part) => part.type === 'decimal')?.value ?? '.';
  return `${formattedWhole}${separator}${fraction.padEnd(maximumFractionDigits, '0').slice(0, maximumFractionDigits)}`;
}
