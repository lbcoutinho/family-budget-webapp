# ADR-0018 — Internationalization

**Status:** Accepted
**Date:** 2026-08-04

## Context

The interface is written in Brazilian Portuguese, and every string is a literal sitting in the
component that renders it — `nav-items.ts`, `route-placeholder.tsx`, `loading-spinner.tsx`,
`page-header.tsx`, the auth screens, `router.tsx`. Roughly 35 strings at the time this was written,
with nothing stopping the next screen from adding thirty more.

Two things follow from that:

1. A second language cannot be added without touching every component.
2. The API speaks English. Its business errors (`This is the last active subcategory…`) are
   already scheduled to be shown verbatim to the user — M3-T08's acceptance criteria say "409
   errors display the backend's specific message". A pt-BR user would read an English sentence.

The goal is a structure that supports pt-BR and en-US now and more locales later, with the
language chosen by the user through the interface.

## Decision

Four decisions, delivered as M3-T10 (this ADR) through M3-T13:

**D1 — Translation lives in the web client; the API speaks in codes.** Every business error
carries a stable `code` (`CATEGORY_LAST_ACTIVE_SUBCATEGORY`) alongside its English `message`. The
`message` is for logs and debugging and is never rendered. The web client maps `code` to a
translated string. The API therefore has no i18n dependency, no `Accept-Language` handling, and no
locale files. (Delivered by M3-T11.)

**D2 — `i18next` + `react-i18next`.** Chosen over a hand-rolled dictionary because en-US is meant
to be a real, published locale rather than a placeholder: plural rules, interpolation, lazy-loaded
locale bundles and language detection are wanted eventually, and writing them by hand costs more
than the two dependencies.

**D3 — pt-BR and en-US from the first commit.** One locale rots: with a single file nobody notices
a hardcoded string. Two locales plus an ESLint rule make a regression visible immediately. pt-BR is
the default and the source of truth for wording; en-US is kept at parity — a key added to one is
added to the other in the same pull request.

**D4 — The preference lives on `User`.** `User.locale`, one column, one migration, edited through
`PATCH /api/users/me`. Not a `UserSettings` table: there is exactly one preference today, and a
one-row table for one value is ceremony. `localStorage` holds a mirror, used only before the
session is known (the login screen) and to avoid a flash of the wrong language on boot — a cache,
never the source of truth. Resolution order: `User.locale` → `localStorage` mirror →
`navigator.language` → `pt-BR`. (`User.locale` itself arrives with M3-T12; until then, resolution
stops at the `localStorage` mirror.)

### What M3-T10 shipped

- `i18next` and `react-i18next` in `apps/web`; `eslint-plugin-i18next` at the repository root.
- `apps/web/src/i18n/index.ts` — the one i18n instance, single `translation` namespace, both
  locale files imported statically (two locales of ~40 keys do not justify lazy-loaded bundles).
  Subscribes to `languageChanged` to write the `localStorage` mirror.
- `apps/web/src/i18n/i18next.d.ts` — types `t()`'s keys from the pt-BR file, so a mistyped key is
  a compile error.
- `apps/web/src/i18n/locales/pt-BR.json` and `en-US.json`, held at parity by
  `locale-parity.test.ts`; `runtime-locale.test.tsx` proves a language change re-renders.
- Every literal in `components/` and `features/` moved to a key: `nav-items` holds `labelKey`,
  `RoutePlaceholder` takes `titleKey`, the login schema's zod messages are keys translated where
  they render.
- `lib/money.ts` and `lib/date.ts` take the active locale and cache one `Intl` formatter per
  locale, instead of a single module-level formatter hardcoded to pt-BR.
- `eslint-plugin-i18next`'s `no-literal-string` rule, `markupOnly` with `onlyAttribute` for
  `title`/`alt`/`placeholder`/`aria-label`, over `apps/web/src/{features,components}/**/*.tsx`,
  ignoring `components/ui/**` (shadcn is vendored, not hand-written).
- **No `i18next-browser-languagedetector`:** the resolution order is four lines, and `User.locale`
  (M3-T12) will front it anyway.
- **`errors.*` deliberately out of scope**: the codes it keys off are defined by M3-T11; writing
  the group now means inventing them twice.

## Alternatives considered

| Alternative | Why it was rejected |
|---|---|
| API localizing through `Accept-Language` | Puts translation in two codebases and makes every error message a backend deploy |
| `@lingui/react` | Smaller bundle, but adds a build plugin and an extraction step for no benefit at this size |
| A `UserSettings` table for the locale preference | Ceremony for exactly one value; promoting a column to a table later is a mechanical migration |
| `i18next-browser-languagedetector` | The whole resolution order needed today is four lines, and `User.locale` will front it once M3-T12 lands |
| Single locale (pt-BR only), add en-US later | A single file lets a hardcoded string go unnoticed; two locales plus the ESLint rule make the regression visible immediately |

## Consequences

### Positive
- A second language cannot silently regress: `no-literal-string` fails the build on a hardcoded
  string, and `locale-parity.test.ts` fails on a key missing from either locale file.
- A mistyped or removed translation key is a TypeScript compile error, not a runtime blank string.
- The API stays free of an i18n dependency; error codes double as a stable contract for any future
  client (the M8 voice entry included).
- `lib/money.ts` and `lib/date.ts` already take a locale parameter, so a runtime language switch
  reformats amounts and dates without further changes.

### Negative
- Every new user-facing string must be added to both locale files in the same PR, and the login
  schema's zod messages must be translated at the render site rather than at validation time
  (`t` does not exist at the module level where the schema is built).
- Two locale files to maintain from day one, for a single-locale user base today.

### Risks and mitigations
- The `errors.*` key group does not exist yet — until M3-T11 lands, no error code can be
  translated; mitigated by M3-T11 being the very next ticket.
- Both locale bundles load eagerly; if the key count grows enough to matter, lazy-loaded bundles
  are the documented next step (not needed at ~40 keys per locale).
