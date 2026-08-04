# M3-T07 / T08 / T09 — the three master-data screens

**Date:** 2026-08-04
**Tickets:** #51 (M3-T07 Accounts), #52 (M3-T08 Categories), #53 (M3-T09 Cashboxes)
**Depends on:** M3-T10 (i18n foundation, merged) and M3-T11 (error codes, PR #76) — both must be on
`main` before the first of these branches is cut.

Each ticket is one branch and one pull request, planned here in the order they should be built.
The three screens share a shape (list → dialog → confirm → invalidate), and T07 is written first
because it is the one that introduces the shared pieces the other two import.

---

## 0. Status and blockers

| Ticket | Prototype | Blocked? |
|---|---|---|
| M3-T07 Accounts | `prototypes/approved/03-accounts.html` | No — UI gate cleared. One open product decision, §1.1 |
| M3-T08 Categories | `prototypes/approved/04-categories.html` | No |
| M3-T09 Cashboxes | `prototypes/05-cashboxes.html` — **still under review** | **Yes** — design approval gate, §3.0 |

Root `MEMORY.md` still claims 03 and 04 are under review. That line is stale (they were approved on
2026-08-04, commits `88b7d7f` and `cb7aad7`); correct it in whichever branch lands first.

**Build order: T07 → T08 → T09.** Not a technical dependency, a duplication one: T07 adds the
shadcn primitives (`switch`, `badge`, `skeleton`) and the shared `common.*` keys the other two
reuse, and settles the create/edit dialog shape. Building T09 first means writing that twice.

Deliberately not built here: no shared "master-data CRUD screen" abstraction. Three screens that
look alike are not a pattern yet — extract only if a fourth appears.

---

## 1. M3-T07 — Accounts screen (#51)

### 1.1 Open decision, resolve before coding — the `type` column

The approved prototype draws a **Tipo** column (Conta corrente / Poupança / Carteira / Cartão de
crédito) and `prototypes/MEMORY.md` records it as kept. But `model Account` in
`apps/api/prisma/schema.prisma` has **no `type` field**, and neither do `AccountDto`,
`CreateAccountDto` or `UpdateAccountDto`. There is nothing to render and nothing to submit. Do not
invent a client-only field.

Three ways out:

- **(a)** Add an `AccountType` enum + column to `Account` — migration, DTO change, `pnpm gen`, API
  tests. That is a **separate ticket and PR** (one migration per task), and T07 then depends on it.
- **(b)** Amend the prototype to drop the column, noted in the PR body.
- **(c) Recommended — ship T07 without it now**, exactly as the current-balance column was split off
  to M5-T06, and log the type column as a follow-up.

Everything below assumes **(c)**.

The **current-balance column and the "Total das contas ativas" footer** are already settled as out
of scope: they need computed balances, so they land with M5-T06. Say so in the PR body.

### 1.2 Files

Added, under `apps/web/src/features/accounts/`:

| File | Holds |
|---|---|
| `accounts-page.tsx` | Route component: `PageHeader` (actions = "Mostrar inativas" switch + "Nova conta") + `PageContent`, the list query, dialog and confirm state, all mutations |
| `accounts-table.tsx` | Presentation only — rows, inactive dimming, per-row actions |
| `account-dialog.tsx` | Create and edit in one dialog, RHF + Zod |
| `accounts-page.test.tsx`, `account-dialog.test.tsx` | Vitest + Testing Library + MSW |

Changed: `apps/web/src/app/router.tsx` — replace the `RoutePlaceholder` on the `accounts` route
with `<AccountsPage />` (replace, never add a second route); both locale files.

Not changed: `packages/api-client/` already exports the accounts tag. No `pnpm gen`, no API change.

No `use-accounts.ts` wrapper and no shared `CurrencyInput` component yet — one caller each.

### 1.3 shadcn/ui

Present: `button`, `card`, `dialog`, `input`, `label`, `select`, `sonner`, `table`, plus
`components/confirm-dialog.tsx`, `components/empty-state.tsx`, `components/page-header.tsx`
from M3-T06 — reuse those three, do not re-implement them.

Add: `pnpm dlx shadcn@latest add switch badge skeleton` (run inside `apps/web`). The prototype's
loading state is skeleton rows, not a spinner. Do **not** add `form`; `login-page.tsx` uses bare
`register()` + `<Label>` + `<Input>` and that is the precedent.

### 1.4 Data layer

All imports from `@family-budget/api-client`: `useListAccounts`, `getListAccountsQueryKey`,
`useCreateAccount`, `useUpdateAccount`, `useDeleteAccount`, `useActivateAccount`,
`useDeactivateAccount`, and the DTO types.

- `useListAccounts(showInactive ? { includeInactive: true } : undefined)` — flipping the switch
  changes the key, so React Query fetches the second list and keeps both cached.
- One invalidation for all five mutations:
  `queryClient.invalidateQueries({ queryKey: ['/accounts'] })`. The prefix match hits both cache
  entries. No per-params keys, no `setQueryData`, no optimistic updates.

### 1.5 Form

Zod schema with translation keys as messages (the `login-page.tsx` pattern):

```
name:           trim, min 1 → 'accounts.form.nameRequired', max 80 → 'accounts.form.nameTooLong'
initialBalance: string, refined with parseCurrencyInput(v) !== null
                → 'accounts.form.initialBalanceInvalid'
```

`initialBalance` stays a **string** in form state and is converted once, on submit, with
`parseCurrencyInput` from `lib/money.ts` — money never goes through anything else. On blur,
re-format the field from the parsed cents; that is the whole "mask", no masking library. Plain
`<Input inputMode="decimal" className="text-right tabular-nums">`.

This is what makes `"1.234,56"` post as `123456`, and `"1234.56"` post the same.

`sortOrder` exists in the DTOs but has no UI (the prototype is alphabetical). Omit it; the API
defaults it.

### 1.6 States

- **Loading** — table header plus three `Skeleton` rows, inside the same `Card`, so nothing jumps.
- **Empty** — `EmptyState` with a wallet icon, `accounts.empty.title` / `.description`, and a
  working "Nova conta" action.
- **Error** — `EmptyState` with an alert icon and a retry button calling `refetch()`.
- **Every mutation error** — `apiErrorMessage(error, t)`, never `error.message`. Inside the dialog
  a create/edit failure renders above the footer and keeps the typed values.
- **Deactivate** — `ConfirmDialog`. **Activate** — no confirmation.
- **Delete 409 (`RECORD_IN_USE`)** — the confirm dialog stays open showing the translated message
  and offers "Desativar" instead.
- Row actions are icon buttons, always rendered (never hover-only), each with an `aria-label`.

### 1.7 i18n

Reuse `nav.accounts`, `common.cancel/confirm/loading`, `errors.RECORD_IN_USE`,
`errors.DUPLICATE_NAME`, `errors.UNKNOWN`.

New shared `common.*`: `save`, `close`, `retry`, `edit`, `delete`, `actions`.

New `accounts.*`: `new`, `showInactive`, `columns.name`, `inactiveBadge`, `actions.deactivate`,
`actions.activate`, `form.{createTitle,editTitle,name,namePlaceholder,nameRequired,nameTooLong,
initialBalance,initialBalanceHint,initialBalanceInvalid}`, `deactivate.{title,description,confirm}`,
`delete.{title,description,confirm,blockedTitle}`, `empty.{title,description}`,
`error.{title,description}`.

pt-BR wording comes verbatim from the approved prototype; en-US at parity in the same PR
(`locale-parity.test.ts` gates it, and keys are typed from the pt-BR file).

**Prototype divergence to record in the PR:** the drawn deactivate and 409 copy names a transaction
count ("os **47** lançamentos"). There is no transaction count in the API until M4, so both strings
ship count-free.

### 1.8 Tests

`account-dialog.test.tsx` — `1.234,56` posts `123456`; `1234.56` posts `123456`; empty posts `0`;
blank name blocks submit with no request reaching MSW; garbage in the amount shows the invalid
message.

`accounts-page.test.tsx` (MSW, one per acceptance criterion) — default list sends no
`includeInactive` and shows only active rows; the toggle sends `?includeInactive=true` and renders
the "inativa" badge; create and edit reflect without a reload; deactivation fires no request until
the confirm is clicked; a 409 on delete shows the translated message and offers deactivation; the
empty state renders and its action opens the dialog; the error state retries.

---

## 2. M3-T08 — Categories screen (#52)

Not blocked. The tree, not the CRUD, is the whole ticket.

### 2.1 Files

Added, under `apps/web/src/features/categories/`:

| File | Holds |
|---|---|
| `categories-page.tsx` | Route component, kind tabs, "mostrar inativas", search box, the single list query, dialog state and all mutations |
| `category-tree.tsx` | Root and child rows, expand/collapse, per-row actions, the desktop middle column, the mobile in-row add button. Pure presentation |
| `category-dialog.tsx` | All four cases in one dialog — new/edit root, new/edit subcategory. The `parentId` prop is what switches it |
| `color-picker.tsx` | Ten swatches (`aria-pressed`) plus a hex input, one controlled `string \| null` |
| `category-colors.ts` | `CATEGORY_PALETTE` — ten hex literals mirrored from `--category-1…10` |
| `categories-page.test.tsx` | Vitest + Testing Library + MSW |

Changed: `router.tsx` (replace the placeholder), both locale files.

### 2.2 shadcn/ui

Add `tabs` (the Despesa/Receita segmented control — `TabsList`/`TabsTrigger` gives roving tabindex
and ARIA for free), plus `switch` and `badge` if T07 has not already added them. Not needed:
`tooltip`, `alert-dialog` (`ConfirmDialog` exists), `form`.

### 2.3 Tree, tabs, search, expand state

One query: `useListCategories({ tree: true, includeInactive: showInactive })` — `tree: true` makes
the API nest children in `CategoryDto.children`, so the client never groups by `parentId`. Every
mutation invalidates the prefix `getListCategoriesQueryKey()`, hitting both cache variants.

- **Kind separation** — `Tabs` with `EXPENSE` as the default (matching the prototype's
  `aria-selected`), roots filtered during render. Two `TabsContent` panels, same component, one
  request.
- **Search** ("Buscar categoria…") — client-side, derived during render: a root matches if its own
  name or any child's matches; a matching root shows only its matching children. No debounce, no
  extra state beyond the input string. Ceiling: it searches the loaded tree only, which is fine at
  a dozen categories.
- **Expand/collapse** — `useState<ReadonlySet<string>>` lifted to the page so it survives a tab
  switch, toggled from a plain event handler. Nothing is reset when the kind, the toggle or the
  query changes: ids are stable, and a stale id simply matches no visible root. That is how
  `react-hooks/set-state-in-effect` is satisfied — by having nothing to reset. The one derived
  rule: while the search string is non-empty, every matching root reads as open
  (`query !== '' || expanded.has(root.id)`).

Markup is a `Table` with the prototype's three columns; the caret button carries `aria-expanded`
and a translated `aria-label`. The colour disc renders on root rows only.

### 2.4 The "+ Subcategoria" flow

The button lives in the root row's middle cell, always visible (never inside a hover-only
container — that was an explicit review correction). Clicking it opens the dialog with `parentId`
set, which changes the dialog in three ways:

- **Parent** is a `<Label>` followed by a `<span>` with the parent's colour disc and name — not a
  disabled `<Input>`, not a disabled `<Select>`. Nothing in that block is a form control.
- **Colour picker is not rendered at all** (sending `color` would 400 with
  `CATEGORY_SUBCATEGORY_COLOR_NOT_ALLOWED`), replaced by the prototype's hint line about inheriting
  the parent's colour.
- **Kind tabs are not rendered** — inherited. Do not send `kind`; the API infers it and rejects a
  mismatch.

Body sent for a subcategory: `{ name, parentId }`. For a root: `{ name, kind, color }` (`kind` is
required), with the prototype's info callout about the automatic "Outros".

### 2.5 Responsive — the part the prototype does not draw

The middle column (subcategory count + add button) is dropped below the `shell:` breakpoint
(900 px, `styles/index.css`) with `hidden shell:table-cell` on the header and cell. The replacement:
when a root is expanded, render **one extra row after its last subcategory** holding a full-width
"+ Subcategoria" button, `shell:hidden`, calling the same `onAddSubcategory(root)` handler. One
handler, two call sites.

Both buttons exist in the DOM at all viewports (CSS toggles them), so give them the same accessible
name and assert **reachability** in the test rather than visibility. Also drop the search field's
fixed width on mobile so the tabs + switch row wraps.

### 2.6 Colour picker

The `--category-1…10` variables are in `:root` but are **not** registered in `@theme inline`, so
there are no `bg-category-N` utilities and `getComputedStyle` returns nothing under jsdom. The API
stores `#RRGGBB`. So `category-colors.ts` holds the ten hex literals with a comment naming
`styles/index.css` as the source of truth and a `ponytail:` note on the duplication — a runtime
CSS-variable read is dead in tests.

Ten `<button type="button" aria-pressed style={{ background }}>` with translated `aria-label`s, plus
a hex `<Input>` beside them (not behind a disclosure — settled) and a live preview chip. A valid
`/^#[0-9a-f]{6}$/i` clears every `aria-pressed`; picking a swatch fills the input; an invalid hex
blocks submit. `--category-10` (grey) is reserved for "Outros".

### 2.7 Business errors

Every mutation's `onError` calls `toast.error(apiErrorMessage(error, t))`. The codes this screen can
reach — `CATEGORY_LAST_ACTIVE_SUBCATEGORY`, `DUPLICATE_NAME`, `RECORD_IN_USE`, `RECORD_NOT_FOUND`,
`CATEGORY_ROOT_KIND_REQUIRED`, `CATEGORY_SUBCATEGORY_COLOR_NOT_ALLOWED`,
`CATEGORY_SUBCATEGORY_KIND_MISMATCH`, `CATEGORY_TREE_TOO_DEEP`, `INTERNAL_ERROR` — **already have
`errors.*` keys in both locale files** from M3-T11. This ticket adds none.

The last-active-subcategory rule is **not** pre-checked client-side: the server stays the authority
and the 409 is what the user sees. Deactivating a root goes through `ConfirmDialog` first with the
prototype's warning (pluralised child count, `variant` stays `default` — deactivation is
reversible); deleting uses `variant="destructive"`.

### 2.8 i18n

Three shared `common.*` keys (`save`, `edit`, `delete`) if T07 has not added them, plus the
`categories.*` block: title/new/search/clearSearch/showInactive, `kind.{EXPENSE,INCOME}`,
`column.{name,subcategories,actions}`, `expand`/`collapse` with `{{name}}`, `addSubcategory` and
`addSubcategoryFor`, `badge.{inactive,automatic}`, `action.{deactivate,activate}`,
`dialog.{newRoot,editRoot,newChild,editChild}`,
`field.{parent,name,namePlaceholder,childPlaceholder,kind,color,colorHex}`,
`color.{swatch,swatchGrey,invalid}`, `nameRequired`, `hint.{inheritsColor,automaticOthers}`,
`deactivate.{title,description_one,description_other}`, `delete.{title,description}`,
`empty.{EXPENSE.title,INCOME.title,description,searchTitle,searchDescription}`,
`error.{title,description,retry}`.

pt-BR verbatim from the approved prototype, en-US at parity.

### 2.9 Tests

Fixture: two expense roots (Moradia with four children including one inactive and the automatic
"Outros"; Transporte) and one income root, in the July-2026 sample-data convention. Every test
declares its own `GET /api/categories` handler — MSW is strict.

One per acceptance criterion: tree renders (children hidden until the caret is clicked,
`aria-expanded` flips, colour disc on roots only); income and expense separate without a second
request; subcategory creation shows the parent as a label — assert `queryByLabelText('Categoria')`
finds no form control — and posts `{ name, parentId }` with no `kind` and no `color`; the
deactivation cascade shows the inactive badge on the root and every child; the last-subcategory 409
renders the pt-BR string and the API's English `message` appears nowhere in the DOM; an unknown code
falls back to `errors.UNKNOWN`; mobile reachability via `stubMatchMedia(COMPACT_VIEWPORT)`; empty and
error states.

### 2.10 Risks

- Confirm how `?tree=true` interacts with `includeInactive` — whether inactive children are nested
  under an active root or dropped changes the cascade test's second assertion.
- The palette duplication (§2.6) is a knowing trade, marked with a `ponytail:` comment.
- The deactivate button on a last active subcategory looks disabled but is clickable — a deliberate
  deviation from a literal reading of the prototype. Call it out in the PR body.

---

## 3. M3-T09 — Cashboxes screen (#53)

### 3.0 Blocked — do not cut this branch yet

`prototypes/05-cashboxes.html` is **not** in `prototypes/approved/`. `plans/0002-screens.md` §4 and
`prototypes/MEMORY.md` both read "v2 — under review". Per `CLAUDE.md`, no screen is written in React
without an approved prototype.

To unblock, in one commit: the user design-approves 05 (the five "Decisões a aprovar" at the bottom
of the file, plus the three deferrals in §3.1); `git mv` it into `approved/`; update the status
table and the link in `prototypes/index.html`; update §4 of `plans/0002-screens.md`; update the
status table and add the decision bullets in `prototypes/MEMORY.md`.

### 3.1 Three drawn elements that cannot ship in T09

| Drawn | Why it can't ship | Proposal |
|---|---|---|
| Four summary cards (Total guardado, Meta total, Resgatado em julho, Caixinhas ativas) | Three of the four need balances or month flow; no `Transaction` model until M4, no balances endpoint until M4-T07 | Ship none — drawing zeros lies. They arrive with the balances endpoint. The prototype itself calls "Caixinhas ativas" the most dispensable of the four |
| Per-card **Depositar / Resgatar** buttons | They open the operations dialog, which is **M5-T04** | Omit; M5-T04 adds them and the disabled-on-inactive rule |
| Top-bar **Movimentar caixinha** | Same dialog | Omit; M5-T04 |

If the user would rather see them drawn but disabled, that is a decision to take at the approval
gate — not something to improvise during implementation.

### 3.2 Files

Added, under `apps/web/src/features/cashboxes/`: `cashboxes-page.tsx` (header actions = show-inactive
switch + "Nova caixinha", the list query, the three dialogs, the loading/empty/error branches),
`cashbox-card.tsx` (pure props), `cashbox-form-dialog.tsx` (create and edit in one), `cashbox-balance.ts`
(the placeholder seam, §3.4), `cashboxes-page.test.tsx`.

Changed: `router.tsx`; both locale files; `apps/web/src/styles/index.css` — register the cashbox
amber as a token (`--cashbox: #8a6008`, the darkened value from `prototypes/_shared/proto.css`, and
`--color-cashbox` in `@theme inline` so `text-cashbox` exists); `apps/api/prisma/seed.ts` (§3.3);
`apps/api/test/e2e/seed.e2e-spec.ts`.

Nothing changes in `apps/api/src/modules/cashboxes/` or `packages/api-client/` — the API is done and
the client is generated. No `pnpm gen`.

### 3.3 Seed — the demo user has no cashboxes

Copy `seedAccounts` exactly: `upsert` on the `userId_name` compound unique with `update: {}`, so a
rerun never resets an edited row. Demo user only, never the owner. Three rows, so the screen can
exercise the show-inactive toggle against real data:

```
Férias 2027  | "Duas semanas na Grécia, em julho"        | targetAmount 500_000 | active
Obras        | "Cozinha e casa de banho"                 | targetAmount null    | active
Carro novo   | "Encerrada — o carro foi comprado em maio"| targetAmount null    | inactive
```

`targetAmount` in cents. No balance is seeded — balances are computed, never stored.

`removeFixtures()` in `seed.e2e-spec.ts` must delete the demo user's cashboxes **before** the user
(`onDelete: Restrict`, P2003 otherwise), and gains one `it` asserting the three rows exist for the
demo user and none for the owner.

### 3.4 The balance placeholder — the one thing worth getting right

Balances land in M4-T07 (`GET /cashboxes/balances`). Until then a balance is **unknown**, which is
not zero. `cashbox-balance.ts` is roughly eight lines:

```ts
export const BALANCE_UNKNOWN = null;

// ponytail: placeholder until M4-T07. Swap the body for the generated balances hook;
// the signature and every call site stay as they are.
export function useCashboxBalances(): Map<string, number> {
  return EMPTY_BALANCES; // module-level Map, so identity is stable across renders
}
```

Exactly two call sites read `balances.get(id) ?? BALANCE_UNKNOWN`. **The M4-T07 swap is: replace the
body. Nothing else moves.**

While the balance is `null`: the amber balance line renders an em dash at `opacity-60` with an
`aria-label` saying it is not computed yet; a card with a `targetAmount` renders the `Progress`
indeterminate (Radix does this with `value={null}`) and shows only the goal amount — no percentage,
no "Meta atingida". A card without a goal shows **no goal block and no caption saying so**.

When balances exist, the percentage label and the green-when-reached bar are already written and
unit-testable by injecting a balance into `CashboxCard`.

### 3.5 Layout, CRUD, states

Grid of cards, `repeat(auto-fill, minmax(268px, 1fr))`. Card body: name + "inativa" badge and the
description, icon actions right-aligned, then the balance in `font-display tabular-nums text-cashbox`,
then the goal block. Inactive cards are muted.

Form fields: `name` (required, max 80), `description` (optional, max 500 — single-line `Input`, the
prototype does not draw a textarea), `targetAmount` (optional, `inputMode="decimal"`, converted with
`parseCurrencyInput`; empty → `null`).

**Deactivation is never blocked by a balance** — requiring an empty cashbox was explicitly rejected
in review. The confirm dialog carries the prototype's warning, with a variant naming the amount once
balances exist (one ternary on `balance === null || balance === 0` picks between the two strings).

Delete uses the destructive confirm; a 409 surfaces `apiErrorMessage(error, t)` →
`errors.RECORD_IN_USE`, which already exists. No new error codes.

Loading is the prototype's pulsing card skeletons; the empty state explains what a cashbox is
(acceptance criterion); the error state uses `apiErrorMessage(error, t)` and a retry button.

### 3.6 shadcn/ui and i18n

Add `progress` (Radix gives `role="progressbar"` and `aria-valuenow` for free, which the tests assert
against), plus `switch` and `badge` if T07 has not added them.

The `cashboxes.*` block covers new/showInactive/inactive/deactivate/activate,
`goal{Target,Progress,Reached}`, `balancePending`, `form.*` (titles, three fields, placeholders,
hint, three validation messages), `deactivateTitle`, `deactivateWarning` and
`deactivateWarningWithBalance`, `activateTitle`/`activateDescription`,
`deleteTitle`/`deleteDescription`, `empty.{title,description}`, `error.title`.

Most wording is lifted from the prototype; the ones that are **not drawn anywhere** —
`balancePending`, `form.editTitle`, the three validation messages, `activate*`, `deleteDescription`,
and `deactivateWarning` (the prototype only draws the with-amount version) — need the user's sign-off
at the approval gate.

### 3.7 Tests

Harness: `createMemoryRouter` on `/cashboxes` with the real routes, `AuthProvider`, `retry: false`.
MSW is strict, so each test declares the refresh handler too.

One per acceptance criterion: the list hides the inactive row by default; create posts
`targetAmount: 500000` for `5.000,00` typed and the card appears without a reload; edit prefills and
`PATCH`es; delete → 409 shows the translated message; **the goal is optional** — submitting a blank
goal posts `targetAmount: null` and that card renders no goal block; deactivation asks for
confirmation and the warning names the balance path; the toggle reveals the inactive card with its
badge; goal rendering with an injected balance (46% → `aria-valuenow=46`; above target → "Meta
atingida"); the **balance placeholder** test (em dash, indeterminate bar) — a deliberate tripwire
that fails when M4-T07 swaps the hook, which is exactly when it should be rewritten; the error state.

### 3.8 Risks

- The blocker (§3.0) — everything above is worthless until 05 is in `approved/`.
- The four summary cards are the biggest open item. If the user wants "Total guardado" visible in
  M3, there is no honest source for it. Get an explicit "ships with M4-T07" at the gate.
- The three deferrals must be recorded in `prototypes/MEMORY.md` at approval time, not discovered in
  review — the 03-accounts balance column is the precedent for how to word them.
- `prototypes/index.html` has a prose line listing which tickets each approval unblocks; it is easy
  to move the file and forget the sentence. Same commit, per `CLAUDE.md`.

---

## 4. Shared checklist per PR

- Issue created before the branch (`github-mirroring` skill), branch off `main`, never commit to `main`.
- `pnpm --filter web test`, `pnpm -r typecheck`, `pnpm lint` green before the PR. Watch
  `i18next/no-literal-string` — it fails on any literal in a `.tsx` under `features/**`.
- Both locale files in the same commit; pt-BR first (keys are typed from it), en-US at parity.
- PR body via the `pr-description` skill. Record every prototype divergence there.
- Rewrite root `MEMORY.md` at the end of each ticket — including the stale 03/04 approval line.
