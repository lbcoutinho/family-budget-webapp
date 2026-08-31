import { describe, expect, it } from 'vitest';

import { buttonVariants } from './button';

describe('buttonVariants', () => {
  it.each(['default', 'xs', 'sm', 'lg', 'icon', 'icon-xs', 'icon-sm', 'icon-lg'] as const)('keeps %s targets at least 44px for coarse pointers', (size) => {
    expect(buttonVariants({ size })).toContain('[@media(pointer:coarse)]:');
    expect(buttonVariants({ size })).toContain('max-shell:');
    expect(buttonVariants({ size })).toContain(size.startsWith('icon') ? 'size-11' : 'min-h-11');
    if (!size.startsWith('icon')) expect(buttonVariants({ size })).toContain('min-w-11');
  });
});
