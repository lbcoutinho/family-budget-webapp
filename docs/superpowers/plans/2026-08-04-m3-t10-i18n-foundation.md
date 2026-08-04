# M3-T10 — i18n foundation on the web — implementation plan

**Date:** 2026-08-04
**Ticket:** `plans/milestones/m03-master-data.md` § M3-T10 (first in the M3 execution order)
**Design:** `docs/superpowers/specs/2026-08-04-i18n-design.md` (D1–D4)
**Branch:** `feat/m3-t10-i18n-foundation`, cut from `main` at `f0e79fe`

Written after reading every file in `apps/web/src` that holds a user-facing literal. Execute it in
the order below: the ESLint rule is what proves the extraction finished, so it lands last.

---

## 0. Before writing code

1. **Mirror M3-T10…T14 as GitHub issues** — they were added after #45–#53 and do not exist on
   GitHub yet. Run the `github-mirroring` skill; create T10's issue first and start from it.
2. This plan's branch is already cut from `main`. Nothing else is in flight.

## 1. Dependencies

- `apps/web` → `i18next`, `react-i18next` (runtime dependencies).
- repository root → `eslint-plugin-i18next` (devDependency; the flat config is CommonJS and the
  plugin ships CommonJS, so `require` works as-is).

**Deliberately not added: `i18next-browser-languagedetector`.** The whole resolution order this
ticket needs is four lines, and `User.locale` (M3-T12) will front it anyway:

```ts
const SUPPORTED = ['pt-BR', 'en-US'] as const;
const stored = localStorage.getItem('locale');
const lng = SUPPORTED.find((l) => l === stored) ?? SUPPORTED.find((l) => navigator.language.startsWith(l.slice(0, 2))) ?? 'pt-BR';
```

Add the detector when a rule appears that this does not express.

## 2. New files

| File | Contents |
| --- | --- |
| `src/i18n/index.ts` | `i18n.use(initReactI18next).init({ resources, lng, fallbackLng: 'pt-BR', interpolation: { escapeValue: false } })`. Single namespace (`translation`). Both locale files imported statically — two locales of ~40 keys do not justify lazy-loaded bundles. Subscribes to `languageChanged` to write the `localStorage` mirror. |
| `src/i18n/locales/pt-BR.json` | Source of truth for the wording. |
| `src/i18n/locales/en-US.json` | Kept at parity in this same PR. |
| `src/i18n/i18next.d.ts` | `declare module 'i18next'` typing `CustomTypeOptions['resources']` from the pt-BR import — a mistyped key becomes a compile error for eight lines of code. |
| `src/i18n/locale-parity.test.ts` | Flattens both files' key sets and asserts they are equal (the ticket's "a key missing from `en-US` fails a parity test"). |

Wiring: `src/main.tsx` imports `@/i18n` before rendering `<Providers />`; `src/test/setup.ts`
imports the same module, so tests resolve accessible names through the real instance in pt-BR and
no string is duplicated between a test and a locale file.

## 3. Key groups

- `app.name` — "Orçamento" (sidebar header and `AuthCard`).
- `nav.*` — `month`, `cashboxes`, `reports`, `voice`, `recurrences`, `settings`, `accounts`,
  `categories`, plus the shell's own labels: `mainNav`, `openMenu`, `closeMenu`, `logout`.
- `common.*` — `loading`, `confirm`, `cancel`.
- `auth.*` — `email`, `password`, `emailPlaceholder`, `submit`, `submitting`, `invalidCredentials`,
  `invalidEmail`, `passwordRequired`, `networkError`.
- `placeholder.*` — `routeTitle`, `routeDescription` (interpolates `{{ticket}}`), `notFound.title`,
  `notFound.heading`, `notFound.description`.

**`errors.*` is out of scope here.** The codes it keys off are defined by M3-T11; writing the group
now means inventing them twice.

## 4. Edits to existing files

- **`components/layout/nav-items.ts`** — `label` becomes `labelKey`.
- **`components/layout/app-sidebar.tsx`** — `t(item.labelKey)`; also "Orçamento", "Navegação
  principal", "Configurações", the `title`/`aria-label` pair on the logout button.
- **`components/layout/route-placeholder.tsx`** — `RoutePlaceholder({ titleKey, ticket })`, rendering
  `t(titleKey)` and `t('placeholder.routeDescription', { ticket })`. `NotFoundPlaceholder` translated
  the same way.
- **`app/router.tsx`** — every `title="Mês"` becomes `titleKey="nav.month"` (seven routes).
- **`components/loading-spinner.tsx`** — the default label stops being a literal: `label ?? t('common.loading')`.
- **`components/page-header.tsx`** — only `aria-label="Abrir menu"`. `title` stays a `ReactNode`; the
  caller translates.
- **`components/confirm-dialog.tsx`** — the `Confirmar` / `Cancelar` defaults.
- **`components/layout/app-layout.tsx`** — "Fechar menu".
- **`features/auth/auth-card.tsx`**, **`features/auth/login-page.tsx`** — every string.

  **Gotcha:** `loginSchema` is module-level, where `t` does not exist. Smallest correct change —
  the zod messages become keys (`z.email('auth.invalidEmail')`) and are translated where they are
  rendered (`{t(errors.email.message)}`). Rebuilding the schema per render to inject `t` costs more
  and buys nothing.

- **`lib/money.ts` and `lib/date.ts`** — add a trailing `locale?: string` parameter defaulting to
  `i18n.language`, and cache the `Intl` formatters in a `Map` keyed by locale instead of the single
  module-level const. There is not one call site outside the tests today, so this is cheap now and
  expensive after three screens ship. `formatMonth`'s leading capital stays: pt-BR month names are
  lowercase and en-US ones are already capitalized, so it is a no-op there.

## 5. ESLint guard

New block in `eslint.config.js`, after `family-budget/web`:

```js
{
  files: ['apps/web/src/{features,components}/**/*.tsx'],
  ignores: ['apps/web/src/components/ui/**'], // shadcn is vendored, not hand-written
  plugins: { i18next },
  rules: {
    'i18next/no-literal-string': ['error', { markupOnly: true, onlyAttribute: ['title', 'alt', 'placeholder', 'aria-label'] }],
  },
}
```

`markupOnly` already silences `className`, `to`, `type` and friends, so no hand-maintained
allowlist is needed.

## 6. Tests

- The existing suites (`app-layout.test.tsx`, `auth-flow.test.tsx`, `login-page.test.tsx`) **must not
  change.** i18n initialised to pt-BR in the setup returns the same accessible names; a suite that
  breaks is pointing at a wrong or missing key.
- New: the key-parity test (§2).
- New: one test calling `i18n.changeLanguage('en-US')` and asserting the sidebar re-renders in
  English — this is what covers the acceptance criterion "switching the locale at runtime
  re-renders every string".

## 7. Documentation

- `docs/adr/0018-internationalization.md` — records D1–D4 from the spec.
- `CLAUDE.md` — the "UI strings pt-BR" convention becomes "UI strings through i18n keys; pt-BR is
  the default locale, en-US is kept at parity".
- Open the PR through the `pr-description` skill.

Documentation work runs on Sonnet 5.

## Execution order

Dependencies → `src/i18n/*` → extract strings file by file → ESLint rule last (it is the proof the
extraction is complete) → documentation.

## Deliberately skipped

Lazy-loaded locale bundles, a language-detector dependency, the `errors.*` group, plurals and
context. Add them when, respectively: a third locale appears, a resolution rule stops fitting in
four lines, M3-T11 lands, and the first string with a count is written.
