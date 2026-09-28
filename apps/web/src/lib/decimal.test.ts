import { describe, expect, it } from 'vitest';

import { formatDecimal } from './decimal';

describe('formatDecimal', () => {
  it('formats exact integer quantities without a decimal separator at zero precision', () => {
    expect(formatDecimal('123.456', 'en-US', 0)).toBe('123');
  });
});
