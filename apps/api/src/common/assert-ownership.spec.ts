import { NotFoundException } from '@nestjs/common';

import { assertOwnership } from './assert-ownership';

describe('assertOwnership', () => {
  const userId = '11111111-1111-1111-1111-111111111111';

  it('returns the row when it belongs to the caller', () => {
    const row = { userId, name: 'Millennium' };

    expect(assertOwnership(row, userId)).toBe(row);
  });

  it("reports another account's row as missing, not as forbidden", () => {
    expect(() => assertOwnership({ userId: '22222222-2222-2222-2222-222222222222' }, userId)).toThrow(NotFoundException);
  });

  it('treats an absent row the same way', () => {
    expect(() => assertOwnership(null, userId)).toThrow(NotFoundException);
    expect(() => assertOwnership(undefined, userId)).toThrow(NotFoundException);
  });
});
