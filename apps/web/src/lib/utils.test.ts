import { describe, expect, it } from 'vitest';

import { cn } from './utils';

describe('cn', () => {
  it('keeps custom font sizes separate from text colors', () => {
    expect(cn('text-sm', 'text-sidebar-nav', 'text-muted-foreground')).toBe('text-sidebar-nav text-muted-foreground');
  });
});
