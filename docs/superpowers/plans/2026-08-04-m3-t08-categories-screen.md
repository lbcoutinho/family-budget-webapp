# M3-T08 - Categories

**Date:** 2026-08-04
**Tickets:** #52 (M3-T08 Categories)
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

## 4. Shared checklist per PR

- Issue created before the branch (`github-mirroring` skill), branch off `main`, never commit to `main`.
- `pnpm --filter web test`, `pnpm -r typecheck`, `pnpm lint` green before the PR. Watch
  `i18next/no-literal-string` — it fails on any literal in a `.tsx` under `features/**`.
- Both locale files in the same commit; pt-BR first (keys are typed from it), en-US at parity.
- PR body via the `create-pr` skill. Record every prototype divergence there.
