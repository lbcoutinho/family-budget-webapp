/**
 * Mirrors `--category-1…10` in `styles/index.css`, which is the source of truth. Not read from
 * there at runtime: those variables live in `:root`, not `@theme inline`, so there is no
 * `bg-category-N` utility and `getComputedStyle` returns nothing under jsdom.
 *
 * ponytail: hand-kept duplicate of the CSS values. Upgrade to a single source (e.g. a build step
 * that reads one from the other) if the two ever drift.
 */
export const CATEGORY_PALETTE = ['#1f6f54', '#1f5aa8', '#a85c1a', '#a32c3d', '#7a45b5', '#0f7c82', '#b5407e', '#4c6019', '#6f3d24', '#4a5568'] as const;

/** Reserved for "Outros" in the prototype — the tenth swatch is always grey. */
export const AUTOMATIC_CATEGORY_COLOR = CATEGORY_PALETTE[CATEGORY_PALETTE.length - 1];

/** Every root gets one on creation (`categories.service.ts`); never renamed by the UI. */
export const AUTOMATIC_SUBCATEGORY_NAME = 'Outros';
