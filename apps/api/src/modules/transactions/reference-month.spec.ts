process.env.TZ = 'America/Sao_Paulo';

import { startOfMonthUtc } from './reference-month';

describe('startOfMonthUtc', () => {
  it.each([
    [new Date('2026-01-31T00:00:00.000Z'), new Date('2026-01-01T00:00:00.000Z')],
    [new Date('2026-12-31T00:00:00.000Z'), new Date('2026-12-01T00:00:00.000Z')],
  ])('derives the reference month from the settlement date', (settlementDate, expected) => {
    expect(startOfMonthUtc(settlementDate)).toEqual(expected);
  });
});
