import { distributePercentages, rollingAverage } from './report-math';

const sumOf = (values: number[]) => values.reduce((total, value) => total + value, 0);

describe('distributePercentages', () => {
  it('a non-even 3-way split still sums to exactly 100.00', () => {
    const result = distributePercentages([100, 100, 100], 300);
    expect(sumOf(result)).toBe(100);
    expect(result).toEqual([33.34, 33.33, 33.33]);
  });

  it('total === 0 yields all zeros, no NaN', () => {
    const result = distributePercentages([100, 200], 0);
    expect(result).toEqual([0, 0]);
    expect(result.some(Number.isNaN)).toBe(false);
  });

  it('empty amounts returns an empty array', () => {
    expect(distributePercentages([], 500)).toEqual([]);
  });

  it('a zero amount stays zero without disturbing the other shares', () => {
    const result = distributePercentages([0, 150, 350], 500);
    expect(result).toEqual([0, 30, 70]);
    expect(sumOf(result)).toBe(100);
  });
});

describe('rollingAverage', () => {
  it.each([
    ['3 non-zero months in a 12-length window average over the non-zero count', [0, 0, 0, 0, 0, 0, 0, 0, 0, 1000, 2000, 3000], 2000],
    ['a single non-zero month averages to its own amount', [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 500], 500],
    ['an all-zero window averages to 0', new Array(12).fill(0), 0],
    ['a sum/count that does not divide evenly rounds the result', [100, 100, 101, 0, 0, 0, 0, 0, 0, 0, 0, 0], 100],
  ])('%s', (_label, amountsByMonth, expected) => {
    expect(rollingAverage(amountsByMonth as number[])).toBe(expected);
  });
});
