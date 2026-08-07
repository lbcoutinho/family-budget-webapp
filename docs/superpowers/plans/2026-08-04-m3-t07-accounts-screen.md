# M3-T07 - Accounts

**Date:** 2026-08-04
**Tickets:** #51 (M3-T07 Accounts)
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

## 4. Shared checklist per PR

- Issue created before the branch (`github-mirroring` skill), branch off `main`, never commit to `main`.
- `pnpm --filter web test`, `pnpm -r typecheck`, `pnpm lint` green before the PR. Watch
  `i18next/no-literal-string` — it fails on any literal in a `.tsx` under `features/**`.
- Both locale files in the same commit; pt-BR first (keys are typed from it), en-US at parity.
- PR body via the `create-pr` skill. Record every prototype divergence there.
