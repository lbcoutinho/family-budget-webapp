# M3 — Master data

**Goal:** full CRUD for accounts, categories and cashboxes, with deactivation, on both the API and the UI.

**Definition of done:** everything required to record transactions in M4 can be created through the interface.

**Depends on:** M2 complete.

## Execution order (T10 and T11 come before T07–T09)

T10–T14 were added after T01–T09 were already mirrored as GitHub issues, so their numbers continue
the sequence while their position in the work does not. **The order below is the order to build
in**; ask before deviating from it.

| Order | Ticket | Why here |
|---|---|---|
| 1 | M3-T10 | The i18n foundation has to exist before any screen is written, or the screen is written twice |
| 2 | M3-T11 | Error codes, so the screens can show a translated 409 rather than the API's English sentence |
| 3 | M3-T07, M3-T08, M3-T09 | The three master-data screens, written with `t()` from the start (each blocked on its own approved prototype) |
| 4 | M3-T12 | `locale` on `User` — needs the client to have somewhere to put it |
| 5 | M3-T13 | Settings › General, the screen that sets the preference |
| 6 | M3-T14 | Deploy, last: it deploys what the milestone built |

Design behind T10–T13: `docs/superpowers/specs/2026-08-04-i18n-design.md`.

---

## M3-T01 — `Account` model and migration

### Why this is needed
The first domain entity. It establishes the `userId` + `isActive` + `sortOrder` pattern the others follow.

### Implementation notes
- `Account` model: `id`, `userId`, `name`, `initialBalance` (Int, cents), `isActive`, `sortOrder`, timestamps
- `@@unique([userId, name])`
- `@@index([userId, isActive])`
- Foreign key to `User` with no cascade toward domain data
- Seed with two sample accounts

### Acceptance criteria
- [ ] Migration applies cleanly
- [ ] Duplicate names for the same user are rejected by the database
- [ ] `initialBalance` is an integer, with a schema comment stating the unit is cents

### Tests
- Integration: creation; unique violation surfaces a Prisma error

---

## M3-T02 — Accounts API with deactivation

### Why this is needed
Establishes the module pattern (controller/service/DTO), the ownership guard and the deactivation behaviour that the other entities reuse.

### Implementation notes
- `AccountsModule` with CRUD: `GET /accounts`, `GET /accounts/:id`, `POST`, `PATCH`, `DELETE`
- `DELETE` **does not soft-delete**: it returns 409 when transactions exist, otherwise deletes for real
- `PATCH /accounts/:id/deactivate` and `/activate`
- Query param `?includeInactive=true` (default `false`)
- Query param `?includeId=<uuid>` to return one specific inactive record, required when editing older transactions
- Every query filtered by the `userId` from the token; another user's resource returns 404, not 403
- DTOs using `class-validator` with `@ApiProperty` decorators
- Reusable `assertOwnership(entity, userId)` helper in `common/`

### Acceptance criteria
- [ ] Full CRUD works
- [ ] Listing hides inactive records by default
- [ ] `?includeId` returns the requested inactive record alongside the active ones
- [ ] Deleting an account with transactions returns 409 with a clear message
- [ ] Accessing another user's resource returns 404
- [ ] Endpoints appear in Swagger

### Tests
- Unit: service for each operation; the delete-blocking rule
- Integration: CRUD over HTTP; isolation between users; behaviour of `includeInactive` and `includeId`

---

## M3-T03 — `Category` model with hierarchy and partial index

### Why this is needed
The self-relation and the uniqueness constraint on root categories hit a PostgreSQL pitfall that must be handled in the migration.

### Implementation notes
- `Category` model: `id`, `userId`, `parentId`, `name`, `kind` (enum), `color`, `isActive`, `sortOrder`, timestamps
- `CategoryTree` self-relation (`parent` / `children`)
- `CategoryKind` enum: `EXPENSE`, `INCOME`
- `@@unique([userId, parentId, name])` for subcategories
- **Partial index via raw SQL in the migration** for root categories, because `NULL != NULL` in PostgreSQL:
  ```sql
  CREATE UNIQUE INDEX category_root_name_unique
    ON categories (user_id, name) WHERE parent_id IS NULL;
  ```
- `@@index([userId, parentId, isActive])`

### Acceptance criteria
- [ ] Migration applies with the partial index
- [ ] Two root categories with the same name are rejected
- [ ] Two subcategories with the same name under different parents are allowed
- [ ] Two subcategories with the same name under the same parent are rejected

### Tests
- Integration: the four uniqueness scenarios above

---

## M3-T04 — Categories API with the two-level rule

### Why this is needed
Concentrates the hierarchy rules. Without depth validation in the service, the schema happily accepts infinite trees.

### Implementation notes
- CRUD with validation: when creating a subcategory, `parent.parentId` must be `NULL`
- Creating a root category automatically creates an `"Other"` subcategory (same `kind`) in the same database transaction
- Block converting a category that has children into a subcategory
- Block changing `kind` when linked transactions exist
- Deactivating a parent cascades to its children in the same transaction
- Block deactivating the last active subcategory of an active parent
- `GET /categories?tree=true` returns a nested structure; without the param, a flat list
- `color` validated as a hex value (`#RRGGBB`)

### Acceptance criteria
- [ ] Creating a subcategory under a subcategory returns 400
- [ ] A new root category ships with an "Other" subcategory
- [ ] Deactivating a parent deactivates its children
- [ ] Deactivating the last active subcategory returns 409
- [ ] Changing `kind` with linked transactions returns 409
- [ ] `?tree=true` returns the assembled tree
- [ ] An invalid color returns 400

### Tests
- Unit: each validation rule in isolation
- Integration: creation with the automatic "Other"; deactivation cascade; the 409 blocks

---

## M3-T05 — `Cashbox` model and API

### Why this is needed
The last master-data entity. It follows the established pattern, so it fits in a single task.

### Implementation notes
- `Cashbox` model: `id`, `userId`, `name`, `description`, `targetAmount` (nullable Int), `isActive`, `sortOrder`, timestamps
- `@@unique([userId, name])`
- CRUD following the M3-T02 pattern: `DELETE` returns 409 when transactions exist, otherwise
  deletes for real
- `targetAmount` is an optional goal with no effect on balance calculation
- Balance is **not** stored — it is computed in M4-T07
- ADR-0019 later narrows this delete rule to "blocked only when the balance is non-zero"; that
  change is M4-T09, not this ticket

### Acceptance criteria
- [ ] Full CRUD works
- [ ] Deactivation is available
- [ ] Deleting a cashbox with transactions returns 409
- [ ] `targetAmount` accepts null
- [ ] Isolation by `userId`

### Tests
- Unit: full service coverage
- Integration: CRUD over HTTP; delete blocking

---

## M3-T06 — Base layout and navigation

### Why this is needed
The application shell. It must exist before the master-data screens to avoid reworking structure.

### Implementation notes
- `AppLayout` with a sidebar on desktop and a collapsible menu on mobile
- Navigation items: Month, Reports, Accounts, Categories, Cashboxes
- Active route indicated visually
- Header with the user's name and a logout action
- Shared components under `components/`: `PageHeader`, `EmptyState`, `LoadingSpinner`, `ConfirmDialog`
- `lib/money.ts` with `formatCents` and `parseCurrencyInput` (pt-BR locale, € symbol)
- `lib/date.ts` with month helpers (`startOfMonth`, `formatMonth`, `monthRange`)

### Acceptance criteria
- [ ] Navigation works across all routes
- [ ] The active route is highlighted
- [ ] Layout is usable on a mobile viewport
- [ ] Logout works
- [ ] `formatCents(123456)` returns `"1.234,56 €"`
- [ ] `parseCurrencyInput` accepts both `"1.234,56"` and `"1234.56"`

### Tests
- Unit: money and date helpers, including rounding and negative values
- Unit: layout renders the navigation items; the active item receives the correct class

---

## M3-T07 — Accounts screen

### Why this is needed
The first CRUD screen. It defines the table-plus-dialog pattern reused by the others.

### Implementation notes
- `/accounts` route listing data through the Orval-generated hook
- Table with name, type and status — no balance column yet; it lands in M5-T06 once
  `GET /accounts/balances` exists (`prototypes/approved/03-accounts.html`)
- Initial balance stays in the create/edit dialog only, never in the list
- Create/edit dialog using React Hook Form + Zod
- Masked currency input, converted to cents on submit
- Active/inactive toggle with confirmation
- "Show inactive" toggle
- TanStack Query cache invalidation after mutations
- Loading, empty and error states handled

### Acceptance criteria
- [ ] The list shows only active records by default
- [ ] Create and edit work and reflect in the list without a reload
- [ ] A value typed as "1.234,56" is sent as `123456`
- [ ] Deactivation asks for confirmation
- [ ] A 409 on delete shows a comprehensible message
- [ ] The empty state guides the user to create their first account

### Tests
- Unit: currency conversion in the form; validation
- Integration with MSW: listing, creation, editing, deactivation, 409 handling

---

## M3-T08 — Categories screen

### Why this is needed
The most complex master-data screen because of the hierarchy. It deserves its own pull request.

### Implementation notes
- `/categories` route with a tree view (expandable parent revealing its children)
- Visual separation between income and expense categories (tabs or groups)
- Creating a subcategory from its parent, with `parentId` pre-filled; the dialog shows the parent
  as a label with its colour swatch, not an editable or disabled input — the parent can't be
  changed from this dialog, so nothing here should look editable
- Color picker for `color`, with a suggested palette
- "Inactive" badge on deactivated records when the toggle is on
- Specific messages for the business 409s (last subcategory, kind change with transactions)
- A subcategory count column and a "+ Subcategoria" button in the parent row's middle column. On
  mobile that column is dropped — **the add-subcategory action must still be reachable**, moved
  inside the expanded parent row. The prototype (`prototypes/approved/04-categories.html`) doesn't
  draw this mobile state; don't let the desktop layout be the only one implemented

### Acceptance criteria
- [ ] The tree renders parents and children correctly
- [ ] Creating a subcategory from its parent pre-fills the relation and shows the parent as a
  read-only label with its colour, not an input
- [ ] Income and expense categories appear separately
- [ ] The selected color is persisted and displayed
- [ ] Deactivating a parent reflects on its children after invalidation
- [ ] 409 errors display the backend's specific message
- [ ] On mobile, the subcategory count is dropped but adding a subcategory is still reachable
  from inside the expanded parent row

### Tests
- Integration with MSW: tree rendering; subcategory creation; deactivation cascade; last-subcategory error

---

## M3-T09 — Cashboxes screen

### Why this is needed
Completes the master data. Follows the M3-T07 pattern.

### Implementation notes
- `/cashboxes` route with a card list
- Fields: name, description, optional goal (`targetAmount`)
- Balance shown as a placeholder until M4-T07; the progress bar against the goal is prepared
- CRUD and deactivation following the established pattern
- A delete action alongside edit and deactivate (`prototypes/memory/05-cashboxes.md`), unlike
  Accounts/Categories: the confirmation states that deletion is permanent and only possible while
  the balance is zero; a non-zero balance shows the backend's 409 instead of deleting. Deactivation
  stays the reversible default action on the card (ADR-0019). Until M4-T09 lands, the backend still
  blocks on "has transactions" — with no `Transaction` model yet, no cashbox can have any, so the
  screen behaves as specified either way

### Acceptance criteria
- [ ] Full CRUD works
- [ ] The goal is optional and can be left blank
- [ ] Deactivation asks for confirmation and stays the default, reversible action
- [ ] The empty state explains what a cashbox is
- [ ] A zero-balance cashbox can be deleted from its card, with a confirmation stating the deletion
  is permanent
- [ ] A non-zero-balance cashbox shows the 409 message instead of deleting

### Tests
- Integration with MSW: full CRUD; optional goal

---

## M3-T10 — i18n foundation on the web

**Build first — before M3-T07/T08/T09.**

### Why this is needed
Every UI string is a literal inside the component that renders it (~35 of them). A second language
cannot be added without touching every component, and the three screens still to be written would
add thirty more literals each. See `docs/superpowers/specs/2026-08-04-i18n-design.md`.

### Implementation notes
- `i18next` + `react-i18next` in `apps/web`
- `src/i18n/locales/pt-BR.json` and `en-US.json`, single namespace; keys grouped by domain
  (`nav.month`, `common.loading`, `errors.<CODE>`)
- pt-BR is the default and the source of truth for wording; en-US kept at parity in the same PR
- Resolution order: `localStorage` mirror → `navigator.language` → `pt-BR` (the `User.locale`
  step arrives with M3-T12)
- Extract the existing strings: `nav-items.ts` holds a key not a label, `RoutePlaceholder` takes
  `titleKey`, plus `loading-spinner`, `page-header`, `route-placeholder`, `router.tsx` and the
  auth screens
- `lib/money.ts` and `lib/date.ts` keep owning formatting but receive the active locale instead of
  a hardcoded `pt-BR`
- ESLint `i18next/no-literal-string` over `features/**` and `components/**` `.tsx`, with an
  allowlist — without it the structure decays within two screens
- Record **ADR-0018 — Internationalization**, and update the "UI strings pt-BR" convention in
  `CLAUDE.md`

### Acceptance criteria
- [ ] No user-facing literal remains in `components/` or `features/`; the ESLint rule proves it
- [ ] Both locale files hold the same key set
- [ ] Switching the locale at runtime re-renders every string, including dates and money
- [ ] ADR-0018 is written and `CLAUDE.md` updated

### Tests
- Existing tests resolve accessible names through the real `i18n` instance initialised to pt-BR in
  the test setup, so no string is duplicated between test and locale file
- Unit: a key missing from `en-US` fails a parity test

---

## M3-T11 — Stable error codes on the API

**Build second — before M3-T07/T08/T09.**

### Why this is needed
The API's business errors are English sentences, and M3-T08 was written to display them verbatim.
A pt-BR user would read English. The API stays monolingual and answers with codes; the web
translates.

### Implementation notes
- Business errors respond with `{ statusCode, code, message }`; `code` in SCREAMING_SNAKE from one
  shared enum, `message` English and never rendered
- Codes existing today: last active subcategory, two-level tree violation, category as its own
  parent, root category without `kind`, duplicate name (P2002), record in use (P2003)
- `PrismaExceptionFilter` emits `code` for the mappings it already performs
- Web resolves `errors.<CODE>`; an unknown code falls back to a generic translated message, never
  to the English `message`
- Comment on issue #52 amending M3-T08's "displays the backend's specific message" to mean the
  translated message for the returned code

### Acceptance criteria
- [ ] Every business exception carries a code from the enum
- [ ] The OpenAPI error schema documents `code`, so the generated client types it
- [ ] An unknown code renders the generic message, not the English one

### Tests
- Unit: the filter maps P2002/P2003 to their codes
- e2e: the last-active-subcategory 409 carries its code
- Web integration with MSW: a 409 with a known code renders the translated string; an unknown code
  renders the fallback

---

## M3-T12 — `locale` on `User`

### Why this is needed
The language must be a user preference that follows the account, not a browser setting.

### Implementation notes
- `locale String @default("pt-BR")` on `User`; one migration
- `PATCH /api/users/me` accepting `locale` only, validated against the supported-locale list
- `AuthUserDto` carries `locale`, so the app wakes up in the right language without an extra
  request
- The web resolution order gains its first step: `User.locale` → `localStorage` mirror →
  `navigator.language` → `pt-BR`

### Acceptance criteria
- [x] An unsupported locale is rejected with 400
- [x] The session response carries the locale
- [x] A reload keeps the chosen language, on any device

### Tests
- e2e: patch and read back; unsupported value rejected
- Web integration: the session's locale wins over `navigator.language`

---

## M3-T13 — Settings › General screen

**Blocked:** `prototypes/07-settings-general.html` does not exist. It must be drawn, reviewed and
moved to `prototypes/approved/` before any React is written.

### Why this is needed
The place where the language is chosen — and where later preferences (theme, date format) will
land without inventing a new screen for each.

### Implementation notes
- New nav item **Geral** inside the Configurações group, above Contas and Categorias
- `/settings/general` route
- One "Idioma" section: a `Select` offering Português (Brasil) and English (US), saved immediately
  with a toast, no Save button
- Update `plans/0002-screens.md` and `prototypes/index.html` with the screen

### Acceptance criteria
- [ ] Changing the language switches the interface without a reload
- [ ] The choice survives a logout and login
- [ ] A failed save reverts the control and explains itself

### Tests
- Integration with MSW: change, persistence, failure path

---

## M3-T14 — Deploy to Vercel

**Do not execute before discussing the approach.** The options below were raised and deliberately
left open; settle them at the start of the ticket, then record the choice as an ADR.

### Why this is needed
The milestone's output should be reachable at a URL rather than only on the developer's machine.

### The open question
Vercel hosts `apps/web` naturally (a static Vite SPA). The API is NestJS + Prisma + PostgreSQL,
which is not Vercel's terrain and needs a managed database regardless.

- **A** — Web on Vercel only, `VITE_API_URL` pointing at the API hosted elsewhere (Railway /
  Render / Fly, plus Neon). Keeps Nest on a normal Node runtime; costs two providers plus CORS and
  environment wiring. *Provisional recommendation.*
- **B** — Everything on Vercel: static web, Nest as a single serverless handler, Postgres on Neon
  or Vercel Postgres. One provider and one bill, paid for with Nest cold starts and Prisma
  connection pooling in a serverless runtime.
- **C** — Web on Vercel against mocks, no real API, as a showcase deploy until M5 delivers visible
  value.

### Implementation notes
- Whatever is chosen: production build in CI, environment variables documented in
  `.env.example`, `CORS_ORIGIN` set to the deployed origin, and a preview deployment per pull
  request if the choice allows it
- The `deploy-to-vercel` skill covers the Vercel side once the shape is decided

### Acceptance criteria
- [ ] The approach was discussed and recorded as an ADR before any configuration was written
- [ ] The deployed application loads and authenticates against whatever backend the choice implies
- [ ] Secrets live in the provider, never in the repository

