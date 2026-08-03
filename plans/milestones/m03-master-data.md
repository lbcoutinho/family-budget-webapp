# M3 — Master data

**Goal:** full CRUD for accounts, categories and cashboxes, with deactivation, on both the API and the UI.

**Definition of done:** everything required to record transactions in M4 can be created through the interface.

**Depends on:** M2 complete.

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
- CRUD following the M3-T02 pattern
- Deletion blocked when transactions exist
- `targetAmount` is an optional goal with no effect on balance calculation
- Balance is **not** stored — it is computed in M4-T07

### Acceptance criteria
- [ ] Full CRUD works
- [ ] Deactivation is available
- [ ] Deleting with transactions returns 409
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

### Acceptance criteria
- [ ] Full CRUD works
- [ ] The goal is optional and can be left blank
- [ ] Deactivation asks for confirmation
- [ ] The empty state explains what a cashbox is

### Tests
- Integration with MSW: full CRUD; optional goal
