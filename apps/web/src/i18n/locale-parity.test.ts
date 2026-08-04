import { describe, expect, it } from 'vitest';

import enUS from './locales/en-US.json';
import ptBR from './locales/pt-BR.json';

/** Every leaf key as a dotted path, so a group added on one side only is reported by name. */
function keyPaths(value: unknown, prefix = ''): string[] {
  if (typeof value !== 'object' || value === null) {
    return [prefix];
  }

  return Object.entries(value).flatMap(([key, child]) => keyPaths(child, prefix === '' ? key : `${prefix}.${key}`));
}

describe('locale files', () => {
  it('hold the same key set', () => {
    expect(keyPaths(enUS).sort()).toEqual(keyPaths(ptBR).sort());
  });
});
