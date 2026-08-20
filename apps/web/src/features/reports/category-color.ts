/**
 * The charts' colour rule (`prototypes/memory/11-charts.md`): `Category.color` wins whenever set,
 * so a category has the same colour in every chart and every month. Without one, a deterministic
 * pick from the same ten-swatch palette the categories screen uses — same id, same colour, no
 * randomness across renders. The uncategorized bucket (`id === null`) always gets the palette's
 * grey, the swatch the rest of the app already reserves for "Outros".
 *
 * Ten colours and "every category is drawn" means collisions are expected once there are more
 * than ten distinctly-coloured categories — deliberately not solved here. The prototype's answer
 * is the amount label next to every slice, not a bigger palette (rejected in the design system:
 * past ten, swatches stop being distinguishable).
 */

import { AUTOMATIC_CATEGORY_COLOR, CATEGORY_PALETTE } from '@/features/categories/category-colors';

function hashId(id: string): number {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) {
    hash = (hash * 31 + id.charCodeAt(index)) | 0;
  }
  return Math.abs(hash);
}

/** Deterministic pick from a palette, keyed by a stable id/string — no randomness across renders. Shared by `categoryColor` below and `cashbox-evolution-panel.tsx`'s per-cashbox line colour. */
export function paletteColor(key: string, palette: readonly string[] = CATEGORY_PALETTE): string {
  return palette[hashId(key) % palette.length]!;
}

export function categoryColor(id: string | null, color: string | null): string {
  if (color) return color;
  if (id === null) return AUTOMATIC_CATEGORY_COLOR!;
  return paletteColor(id);
}
