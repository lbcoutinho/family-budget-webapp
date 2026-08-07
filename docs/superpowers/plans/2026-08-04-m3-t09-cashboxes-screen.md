# M3-T09 - Cashboxes

**Date:** 2026-08-04
**Tickets:** #53 (M3-T09 Cashboxes)
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

## 3. M3-T09 — Cashboxes screen (#53)

### 3.0 Blocked — do not cut this branch yet

`prototypes/05-cashboxes.html` is **not** in `prototypes/approved/`. `plans/0002-screens.md` §4 and
`prototypes/MEMORY.md` both read "v2 — under review". Per `CLAUDE.md`, no screen is written in React
without an approved prototype.

To unblock, in one commit: the user design-approves 05 (the five "Decisões a aprovar" at the bottom
of the file, plus the three deferrals in §3.1); `git mv` it into `approved/`; update the status
table and the link in `prototypes/index.html`; update §4 of `plans/0002-screens.md`; update the
status table in `prototypes/MEMORY.md` and add the decision bullets to `prototypes/memory/05-cashboxes.md`.

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
- The three deferrals must be recorded in `prototypes/memory/05-cashboxes.md` at approval time, not discovered in
  review — the 03-accounts balance column is the precedent for how to word them.
- `prototypes/index.html` has a prose line listing which tickets each approval unblocks; it is easy
  to move the file and forget the sentence. Same commit, per `CLAUDE.md`.

---

## 4. Shared checklist per PR

- Issue created before the branch (`github-mirroring` skill), branch off `main`, never commit to `main`.
- `pnpm --filter web test`, `pnpm -r typecheck`, `pnpm lint` green before the PR. Watch
  `i18next/no-literal-string` — it fails on any literal in a `.tsx` under `features/**`.
- Both locale files in the same commit; pt-BR first (keys are typed from it), en-US at parity.
- PR body via the `create-pr` skill. Record every prototype divergence there.
