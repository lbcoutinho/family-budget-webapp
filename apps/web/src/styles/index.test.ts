import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const stylesheet = readFileSync(resolve(process.cwd(), 'src/styles/index.css'), 'utf8');

describe('shared motion', () => {
  it('collapses animation and transition timing when reduced motion is preferred', () => {
    expect(stylesheet).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)/);
    expect(stylesheet).toMatch(/animation-duration:\s*1ms\s*!important/);
    expect(stylesheet).toMatch(/transition-duration:\s*1ms\s*!important/);
    expect(stylesheet).toMatch(/animation-iteration-count:\s*1\s*!important/);
  });
});
