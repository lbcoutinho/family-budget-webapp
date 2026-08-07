# M3-T09 — Cashboxes screen (#53)

Supersedes `2026-08-04-m3-t09-cashboxes-screen.md`, written while the prototype was still under
review. Prototype 05 is now approved and ADR-0019 is accepted; the deferrals below are decided, not
proposed.

## Context

M3 master data is one screen short. `Account` and `Category` screens shipped (M3-T07, M3-T08);
`Cashbox` has a finished API (`apps/api/src/modules/cashboxes/`), a generated client
(`useListCashboxes` … `useDeactivateCashbox`), a nav entry, and an approved prototype
(`prototypes/approved/05-cashboxes.html`). What is missing is the React screen: `/cashboxes` still
renders `<RoutePlaceholder ticket="M3-T09" />` (`apps/web/src/app/router.tsx:35`).

The screen is a card grid, not a table — that is the one real difference from Accounts. Everything
else (list query, create/edit dialog, deactivate/activate, delete with a 409 branch, show-inactive
toggle, loading/empty/error states) is the Accounts pattern.

**A cashbox has no balance yet.** There is no `Transaction` model until M4, so nothing can compute
one. `GET /cashboxes/balances` is M4-T07. The screen therefore renders a card that is honest about
what it does not know, and three drawn-but-undeliverable elements are deferred.

### The three deferrals (decided, record them in the PR)

| Drawn in prototype | Ships in | Why not now |
|---|---|---|
| Four summary cards (ativas / depositado / resgatado / total guardado) | **New M4 ticket, created as step 0 below** | Three of four need balances or month flow. Drawing zeros lies |
| Per-card **Depositar / Resgatar** | M5-T04 | They open the operations dialog, which is M5-T04 |
| Topbar **Movimentar caixinha** | M5-T04 | Same dialog |

The delete-blocked copy in the prototype ("tem 9 movimentos registrados") predates ADR-0019. The
i18n string is written to the **ADR-0019 rule — blocked when the balance is not zero** — and the
prototype's dialog copy is corrected in the same PR. (In M3 the backend still 409s on a foreign key,
but with no `Transaction` model no cashbox can have one, so the branch is unreachable either way.)

---

## Step 0 — before the branch (two chores)

1. **New M4 ticket for the summary cards.** Dispatch a subagent (`model: haiku`) to add
   `M4-T10 — Cashboxes summary cards` to `plans/milestones/m04-transactions-api.md` (after M4-T09,
   the current last task) and mirror it as a GitHub issue via the `github-mirroring` skill,
   milestone `M4`, labels `frontend`. Content: the four cards from
   `prototypes/approved/05-cashboxes.html` in monthly-report order, fed by
   `GET /cashboxes/balances` (M4-T07) and the month's `CASHBOX_IN`/`CASHBOX_OUT` flow; depends on
   M4-T07; the two middle cards are month-scoped and name the month in the label
   (`prototypes/memory/05-cashboxes.md`).
2. **Refresh issue #53's body** — it still says "Until M3-T15 lands"; M3-T15 became M4-T09. Add a
   comment recording the three deferrals above rather than editing the accepted text.

Then: branch off `main`, `feat/m3-t09-cashboxes-screen`.

---

## Files

**New**, `apps/web/src/features/cashboxes/` (dir exists, holds only `.gitkeep`):

- `cashboxes-page.tsx` — route component. Mirrors `apps/web/src/features/accounts/accounts-page.tsx`
  1:1: `showInactive` switch + "Nova caixinha" in `PageHeader`; `useListCashboxes(showInactive ? { includeInactive: true } : undefined)`;
  `editing<CashboxDto|'new'|null>` / `deactivating` / `deleting` / `deleteBlocked` state; the four
  mutually-exclusive branches (`isPending` → skeleton, `isError` → `EmptyState` + retry,
  `length === 0` → empty state, else grid). Invalidate with `getListCashboxesQueryKey()` (the
  categories-page form, not the accounts-page hand-written array).
- `cashbox-card.tsx` — exports `CashboxCard` + `CashboxGridSkeleton`. Pure props, `balance: number | null`.
- `cashbox-dialog.tsx` — create + edit in one `Dialog`, react-hook-form + zod, copied from
  `account-dialog.tsx`.
- `cashboxes-page.test.tsx`, `cashbox-card.test.tsx`.

**Changed:**

- `apps/web/src/app/router.tsx` — swap the `RoutePlaceholder` for `<CashboxesPage />`.
- `apps/web/src/i18n/locales/pt-BR.json` + `en-US.json` — the `cashboxes` block, same commit
  (`locale-parity.test.ts` fails otherwise). pt-BR is the source of truth.
- `apps/web/src/styles/index.css` — add `--cashbox: #8a6008` next to `--category-*`, **and**
  `--color-cashbox` under `@theme inline` so `text-cashbox` exists (the `--category-*` tokens are
  in `:root` only and have no utility — do not repeat that).
- `apps/api/prisma/seed.ts` + `apps/api/test/e2e/seed.e2e-spec.ts` — see below.
- `prototypes/approved/05-cashboxes.html` — delete-dialog copy to the ADR-0019 wording.

**Untouched:** `apps/api/src/modules/cashboxes/`, `packages/api-client/`. API is done, client is
generated. **No `pnpm gen`.**

---

## The card

Grid `repeat(auto-fill, minmax(268px, 1fr))`. Card = name + `inativa` `Badge` + description; three
ghost icon actions right (pencil / x-or-check / trash, same set as Accounts + Categories); then the
balance in `font-display tabular-nums text-cashbox` at display size; then the goal block when
`targetAmount !== null`. Inactive cards muted. No `Depositar`/`Resgatar` footer (deferral 2).

**Balance is `null` in M3.** `cashboxes-page.tsx` passes `balance={null}` — a literal, no hook, no
placeholder module. M4-T07 replaces that one prop expression with the balances query.

While `balance === null`: the amber line renders an em dash at `opacity-60` with an `aria-label`
saying it is not computed yet; a card with a goal shows only `meta 5.000,00 €` and **no bar** (a bar
at 0% would be a claim about money). No goal → no goal block and no caption saying so
(`prototypes/memory/05-cashboxes.md`).

When a balance is passed, the bar renders: a plain `<div role="progressbar" aria-valuenow={pct}
aria-valuemin={0} aria-valuemax={100}>` with an inner width-`%` div. **Do not add shadcn `progress`**
— three lines of div beat a new Radix dependency for one bar. `pct = Math.min(100, round(balance / targetAmount * 100))`;
at ≥ 100% the bar turns green and the label reads "Meta atingida" instead of "N% da meta"; nothing
is blocked (prototype decision 3). This path is unreachable in M3 and is covered by
`cashbox-card.test.tsx` injecting a balance directly.

---

## Form and CRUD

Fields: `name` (required, trimmed, max 80), `description` (optional, max 500, single-line `Input` —
the prototype draws no textarea; empty → `null` so the API clears it), `targetAmount` (optional,
`inputMode="decimal"`, `parseCurrencyInput` from `apps/web/src/lib/money.ts`, empty → `null`).
Hint under the goal field, lifted from the prototype.

Deactivate: `ConfirmDialog`, `variant="default"`, warning that the balance stays in the total and
that only new deposits/withdrawals are blocked. **Never blocked by a balance** — requiring an empty
cashbox was rejected in review.

Delete: `ConfirmDialog`, `variant="destructive"`, copy stating deletion is permanent. On a 409 reuse
the accounts-page `deleteBlocked` pattern verbatim (`error.response.data.code === 'RECORD_IN_USE'`
→ swap the dialog to `apiErrorMessage(error, t)` + a "Desativar" confirm). No new error codes.

Helpers to reuse, all existing: `apiErrorMessage` (`apps/web/src/lib/api-error.ts`), `formatCents` /
`parseCurrencyInput` (`lib/money.ts`), `ConfirmDialog`, `EmptyState`, `PageHeader`/`PageContent`
(`apps/web/src/components/`), `Switch`, `Badge`, `Skeleton`, `Card` (all already in
`components/ui/`).

---

## Seed

`seedCashboxes(prisma, demoUserId)` next to `seedAccounts` in `apps/api/prisma/seed.ts` — same
`upsert` on the `userId_name` compound unique with `update: {}` so a rerun never resets an edited
row. **Demo user only, never the owner.** Three rows so the toggle has real data:

```
Férias 2027 | "Duas semanas na Grécia, em julho"         | targetAmount 500_000 | active
Obras       | "Cozinha e casa de banho"                  | targetAmount null    | active
Carro novo  | "Encerrada — o carro foi comprado em maio" | targetAmount null    | inactive
```

Cents. No balance seeded — balances are computed, never stored.

`seed.e2e-spec.ts`: add `prisma.cashbox.deleteMany({ where: owner })` to `removeFixtures` **before**
`user.deleteMany` (`onDelete: Restrict`, P2003 otherwise); one `it` asserting three rows for the demo
user and none for the owner; `cashbox.count` → 3 in the idempotency test.

---

## i18n

New `cashboxes` block in both locales: `new`, `showInactive`, `inactiveBadge`,
`actions.{edit,deactivate,activate,delete}`, `balancePending`, `goal.{target,progress,reached}`,
`form.{createTitle,editTitle,name,namePlaceholder,nameRequired,nameTooLong,description,descriptionPlaceholder,descriptionTooLong,target,targetPlaceholder,targetHint,targetInvalid}`,
`deactivate.{title,description,confirm}`, `activate.{title,description,confirm}`,
`delete.{title,description,confirm,blockedTitle}`, `empty.{title,description}`,
`error.{title,description}`.

Wording is lifted from the prototype where it is drawn. Not drawn anywhere and therefore newly
written: `balancePending`, `form.editTitle`, the validation messages, `activate.*`, and
`delete.blockedTitle` (ADR-0019 wording — non-zero balance, not "has transactions"). Filenames,
comments, commits stay en-US.

---

## Tests

Harness copied from `accounts-page.test.tsx`: local `renderPage()` with a `QueryClient`
(`retry: false`), `QueryClientProvider` + `TooltipProvider`, `server.use(...)` per test, assertions
in **pt-BR** (`setup.ts` pins `DEFAULT_LOCALE`). MSW is strict — every request a test triggers needs
a handler.

`cashboxes-page.test.tsx`, one per acceptance criterion:

- inactive row hidden by default; the toggle reveals it with its `inativa` badge
- create: typing `5.000,00` posts `targetAmount: 500000`, card appears without a reload
- **goal is optional**: blank goal posts `targetAmount: null`, that card renders no goal block
- edit prefills and `PATCH`es
- deactivate asks for confirmation (default variant, reversible) and calls `/deactivate`
- delete asks for confirmation stating permanence; a 409 shows the translated `RECORD_IN_USE`
  message and offers deactivate instead
- empty state explains what a cashbox is
- error state + "Tentar de novo" retry

`cashbox-card.test.tsx`:

- `balance={null}` → em dash, no progress bar even with a goal (**deliberate tripwire: this test is
  meant to fail at M4-T07, which is when it gets rewritten**)
- `balance` injected, 2_300_00 against 5_000_00 → `aria-valuenow=46`
- balance above target → "Meta atingida", green bar

---

## Verification

```bash
pnpm --filter web test
pnpm -r typecheck
pnpm lint          # watch i18next/no-literal-string — it fails on any literal in features/**
pnpm --filter api test:e2e -- seed        # seed fixtures
```

Then run it for real: `docker compose up -d`, reseed, `pnpm dev`, log in as the demo user, open
`/cashboxes` — three cards, "Carro novo" hidden until the toggle, create/edit/deactivate/delete all
round-trip, em dash where the balance goes.

---

## PR

Issue first (`github-mirroring`), branch off `main`, never commit to `main`, never merge. PR body via
the `create-pr` skill, recording: the three deferrals, the new M4 ticket, the prototype
delete-copy correction, and the plain-div progress bar instead of shadcn `progress`.
