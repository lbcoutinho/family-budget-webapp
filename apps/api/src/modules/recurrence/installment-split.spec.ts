import { BadRequestException } from '@nestjs/common';

import { splitInstallments } from './installment-split';

describe('splitInstallments', () => {
  it('divides evenly when totalCents is a multiple of count', () => {
    expect(splitInstallments(9_000, 3)).toEqual([3_000, 3_000, 3_000]);
  });

  it('puts a remainder of 1 cent on the final installment', () => {
    expect(splitInstallments(10_000, 3)).toEqual([3_333, 3_333, 3_334]);
  });

  it('puts a remainder of 2 cents on the final installment', () => {
    expect(splitInstallments(10_000, 4)).toEqual([2_500, 2_500, 2_500, 2_500]);
    expect(splitInstallments(10_001, 4)).toEqual([2_500, 2_500, 2_500, 2_501]);
    expect(splitInstallments(10_002, 4)).toEqual([2_500, 2_500, 2_500, 2_502]);
  });

  it('splits €100.00 into 3 as 3333 / 3333 / 3334', () => {
    expect(splitInstallments(10_000, 3)).toEqual([3_333, 3_333, 3_334]);
  });

  it('allows exactly 1 cent per installment as the floor', () => {
    expect(splitInstallments(3, 3)).toEqual([1, 1, 1]);
  });

  it('rejects a count below 1', () => {
    expect(() => splitInstallments(1_000, 0)).toThrow(BadRequestException);
  });

  it('rejects totalCents below count', () => {
    expect(() => splitInstallments(2, 3)).toThrow(BadRequestException);
  });

  it.each([
    [100, 1],
    [100, 3],
    [101, 3],
    [999, 7],
    [1, 1],
    [12_345, 11],
    [1_000_000, 37],
  ])('sums exactly to total and keeps every installment >= 1 cent (total=%d, count=%d)', (total, count) => {
    const split = splitInstallments(total, count);

    expect(split).toHaveLength(count);
    expect(split.reduce((sum, cents) => sum + cents, 0)).toBe(total);
    expect(split.every((cents) => cents >= 1)).toBe(true);
  });
});
