// Negative-offset zone (UTC-3): any accidental local-time getter makes the January 31 cases fail loudly.
process.env.TZ = 'America/Sao_Paulo';

import { resolveReferenceMonthOnCreate, resolveReferenceMonthOnUpdate, resolveSettlementDate, startOfMonthUtc } from './reference-month';

describe('resolveSettlementDate', () => {
  it('uses the transaction date except when a card reference month is later', () => {
    const date = new Date('2026-03-15T00:00:00.000Z');
    expect(resolveSettlementDate(date, new Date('2026-04-01T00:00:00.000Z'), true)).toEqual(new Date('2026-04-01T00:00:00.000Z'));
    expect(resolveSettlementDate(date, new Date('2026-04-01T00:00:00.000Z'), false)).toEqual(date);
  });
});

const utc = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

const expectFirstOfMonthUtc = (value: Date) => {
  expect(value.getUTCDate()).toBe(1);
  expect(value.getUTCHours()).toBe(0);
  expect(value.getUTCMinutes()).toBe(0);
  expect(value.getUTCSeconds()).toBe(0);
  expect(value.getUTCMilliseconds()).toBe(0);
};

describe('startOfMonthUtc', () => {
  it.each([
    ['month boundary, last day', utc('2026-01-31'), utc('2026-01-01')],
    ['year boundary, last day', utc('2026-12-31'), utc('2026-12-01')],
    ['leap day', utc('2024-02-29'), utc('2024-02-01')],
    ['already first of month is idempotent', utc('2026-03-01'), utc('2026-03-01')],
    ['time components zeroed', new Date('2026-05-17T23:45:12.345Z'), utc('2026-05-01')],
  ])('%s', (_label, input, expected) => {
    const result = startOfMonthUtc(input);
    expect(result).toEqual(expected);
    expectFirstOfMonthUtc(result);
  });
});

describe('resolveReferenceMonthOnCreate', () => {
  it.each([
    ['derives from date when referenceMonth absent', { date: utc('2026-01-31') }, utc('2026-01-01')],
    ['derives from date when referenceMonth null', { date: utc('2026-12-31'), referenceMonth: null }, utc('2026-12-01')],
    ['supplied referenceMonth wins', { date: utc('2026-01-31'), referenceMonth: utc('2026-02-01') }, utc('2026-02-01')],
    ['supplied mid-month referenceMonth is normalized', { date: utc('2026-01-31'), referenceMonth: utc('2026-02-14') }, utc('2026-02-01')],
  ])('%s', (_label, input, expected) => {
    const result = resolveReferenceMonthOnCreate(input);
    expect(result).toEqual(expected);
    expectFirstOfMonthUtc(result);
  });
});

describe('resolveReferenceMonthOnUpdate', () => {
  const nonCard = { date: utc('2026-01-15'), referenceMonth: utc('2026-01-01'), isCreditCard: false };
  const card = { date: utc('2026-01-15'), referenceMonth: utc('2025-12-01'), isCreditCard: true };

  it.each([
    ['explicit referenceMonth wins over recomputation', nonCard, { date: utc('2026-03-10'), referenceMonth: utc('2026-05-20') }, utc('2026-05-01')],
    ['explicit referenceMonth wins on a card transaction', card, { referenceMonth: utc('2026-02-14') }, utc('2026-02-01')],
    ['non-card date change recomputes', nonCard, { date: utc('2026-03-31') }, utc('2026-03-01')],
    ['card date change preserves referenceMonth', card, { date: utc('2026-03-31') }, utc('2025-12-01')],
    ['unchecking isCreditCard recomputes from current date', card, { isCreditCard: false }, utc('2026-01-01')],
    ['unchecking isCreditCard with a date change recomputes from the new date', card, { date: utc('2026-04-30'), isCreditCard: false }, utc('2026-04-01')],
    ['checking isCreditCard alone preserves referenceMonth', nonCard, { isCreditCard: true }, utc('2026-01-01')],
    ['no-op patch leaves referenceMonth untouched', nonCard, {}, utc('2026-01-01')],
    ['same date resubmitted is not a change', nonCard, { date: utc('2026-01-15') }, utc('2026-01-01')],
  ])('%s', (_label, current, patch, expected) => {
    const result = resolveReferenceMonthOnUpdate(current, patch);
    expect(result).toEqual(expected);
    expectFirstOfMonthUtc(result);
  });

  it('keeps a hand-picked referenceMonth on a non-card transaction when nothing relevant changed', () => {
    const handPicked = { date: utc('2026-01-15'), referenceMonth: utc('2026-02-01'), isCreditCard: false };
    expect(resolveReferenceMonthOnUpdate(handPicked, {})).toEqual(utc('2026-02-01'));
  });
});
