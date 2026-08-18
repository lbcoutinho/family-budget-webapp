import { describe, expect, it } from 'vitest';

import { CATEGORY_PALETTE } from '@/features/categories/category-colors';
import { categoryColor } from '@/features/reports/category-color';

const HEX = /^#[0-9a-f]{6}$/i;

describe('categoryColor', () => {
  it('returns the category color when set, ignoring the id', () => {
    expect(categoryColor('cat-1', '#123456')).toBe('#123456');
  });

  it('is deterministic for the same id', () => {
    expect(categoryColor('cat-housing', null)).toBe(categoryColor('cat-housing', null));
  });

  it('returns different palette entries for different ids in the common case', () => {
    expect(categoryColor('cat-housing', null)).not.toBe(categoryColor('cat-groceries', null));
  });

  it('returns a fixed neutral for the uncategorized bucket', () => {
    expect(categoryColor(null, null)).toBe(categoryColor(null, null));
    expect(categoryColor(null, null)).toBe(CATEGORY_PALETTE[CATEGORY_PALETTE.length - 1]);
  });

  it('always returns a valid hex color', () => {
    for (const id of ['a', 'cat-x', 'this-is-a-longer-id-1234', null]) {
      expect(categoryColor(id, null)).toMatch(HEX);
    }
    expect(categoryColor('cat-1', '#abcdef')).toMatch(HEX);
  });
});
