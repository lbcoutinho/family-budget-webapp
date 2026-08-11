# Web

React 19 application using:

- Vite
- TypeScript
- Tailwind CSS v4
- shadcn/ui
- TanStack Query
- Vitest
- Testing Library
- MSW

## Architecture

Organize code by feature, not by file type.

Prefer:src/features/accounts/categories/cashboxes/
over: src/components/hooks/services/

when code belongs to a specific domain feature.

`src/` layout, non-obvious folders only:

- `app/` — app shell: router (`router.tsx`), providers (`providers.tsx`), `layout/` (nav, page chrome).
- `components/ui/` — shadcn/ui primitives; `components/` root — shared components built on top of them (`page-header`, `confirm-dialog`, `empty-state`, …).
- `lib/` — cross-feature utilities: `money.ts` (cents formatting), `date.ts`, `api-error.ts` (API error-code mapping), `utils.ts` (`cn` helper).
- `i18n/` — i18next setup + `locales/` (pt-BR, en-US). pt-BR is the default locale and the source of truth for wording, en-US is kept at parity
- `test/` — Vitest setup and MSW server (`setup.ts`, `server.ts`), not feature tests (those live next to their code under `features/`).

## API access

Use `@family-budget/api-client`.

Never:

- call backend endpoints using ad-hoc fetch wrappers when an API-client operation exists;
- duplicate API request/response types;
- manually edit generated API-client code.

Use TanStack Query for server state.

## Money

Never perform money calculations using floating-point euro values.

Domain values use integer cents.

Formatting belongs in:

`src/lib/money.ts`

## UI implementation

Approved prototypes are authoritative for screen implementation.

Before implementing a screen:

1. Find its approved prototype.
2. Check `prototypes/MEMORY.md`.
3. Check the design system.
4. Implement against the approved design.

Impeccable findings are advisory and must not override approved prototypes.

## Components

Prefer existing shadcn/ui components before creating custom primitives.

Check existing project components before adding another abstraction.

## Testing

Use:

- Vitest
- Testing Library
- MSW

Prefer user-observable behavior.

Avoid testing implementation details.

## UI prototypes (blocking rule for every screen)

- No screen is written in React without an approved prototype. Prototypes live in `prototypes/` — throwaway HTML, one shared `_shared/proto.css` +
  `proto.js`. Purpose: settle concept, colour, typography, spacing and animation while changing one's mind is still free.
- Before implementing any screen ticket, check `prototypes/approved/`. Prototype missing or still under review → stop and ask, don't improvise UI.
- An approved prototype may be edited when implementation reveals a problem — say so in the PR. What must never happen is a built screen silently diverging from it.
