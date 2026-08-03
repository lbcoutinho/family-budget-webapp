import { describe, expect, it } from 'vitest';

import { formatCents, parseCurrencyInput } from './money';

describe('formatCents', () => {
  it('formats cents in pt-BR with the euro symbol', () => {
    expect(formatCents(123456)).toBe('1.234,56 €');
    expect(formatCents(0)).toBe('0,00 €');
    expect(formatCents(5)).toBe('0,05 €');
    expect(formatCents(100000000)).toBe('1.000.000,00 €');
  });

  it('keeps the minus on a negative value even without the sign option', () => {
    expect(formatCents(-3500)).toBe('−35,00 €');
  });

  it('shows an explicit sign on both directions when asked', () => {
    expect(formatCents(4290, { sign: true })).toBe('+ 42,90 €');
    expect(formatCents(-4290, { sign: true })).toBe('− 42,90 €');
    expect(formatCents(0, { sign: true })).toBe('+ 0,00 €');
  });

  it('rounds a value that arrived from arithmetic rather than from the database', () => {
    expect(formatCents(1234.4)).toBe('12,34 €');
    expect(formatCents(1234.5)).toBe('12,35 €');
    expect(formatCents(-1234.6)).toBe('−12,35 €');
  });
});

describe('parseCurrencyInput', () => {
  it('accepts both the pt-BR and the plain notation', () => {
    expect(parseCurrencyInput('1.234,56')).toBe(123456);
    expect(parseCurrencyInput('1234.56')).toBe(123456);
    expect(parseCurrencyInput('1234,56')).toBe(123456);
    expect(parseCurrencyInput('1234')).toBe(123400);
  });

  it('reads a lone dot as a thousands separator only when it groups three digits', () => {
    expect(parseCurrencyInput('1.234')).toBe(123400);
    expect(parseCurrencyInput('1.234.567')).toBe(123456700);
    expect(parseCurrencyInput('12.5')).toBe(1250);
  });

  it('accepts what the application itself printed', () => {
    expect(parseCurrencyInput('1.234,56 €')).toBe(123456);
    expect(parseCurrencyInput('−35,00 €')).toBe(-3500);
    expect(parseCurrencyInput('+ 42,90 €')).toBe(4290);
  });

  it('handles the fraction being partial, absent or too long', () => {
    expect(parseCurrencyInput('12,')).toBe(1200);
    expect(parseCurrencyInput('12,5')).toBe(1250);
    expect(parseCurrencyInput(',5')).toBe(50);
    expect(parseCurrencyInput('12,345')).toBe(1235);
  });

  it('returns null for anything that is not a number', () => {
    expect(parseCurrencyInput('')).toBeNull();
    expect(parseCurrencyInput('   ')).toBeNull();
    expect(parseCurrencyInput('abc')).toBeNull();
    expect(parseCurrencyInput('12a,50')).toBeNull();
    expect(parseCurrencyInput('-')).toBeNull();
  });

  it('round-trips a formatted value', () => {
    for (const cents of [0, 5, -3500, 123456, 999999999]) {
      expect(parseCurrencyInput(formatCents(cents))).toBe(cents);
    }
  });
});
