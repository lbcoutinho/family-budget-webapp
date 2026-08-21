import { describe, expect, it } from 'vitest';

import { splitInstallments } from './installment-split';

describe('splitInstallments', () => {
  it('puts the remainder on the last installment', () => {
    expect(splitInstallments(10000, 3)).toEqual([3333, 3333, 3334]);
  });

  it('splits evenly when it divides cleanly', () => {
    expect(splitInstallments(9000, 3)).toEqual([3000, 3000, 3000]);
  });

  it('returns an empty split for an invalid count', () => {
    expect(splitInstallments(100, 0)).toEqual([]);
  });

  it('returns an empty split when the total is below one cent per installment', () => {
    expect(splitInstallments(2, 3)).toEqual([]);
  });
});
