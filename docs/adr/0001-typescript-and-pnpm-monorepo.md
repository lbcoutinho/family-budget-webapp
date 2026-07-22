# ADR-0001 — TypeScript strict mode and pnpm monorepo

**Status:** Accepted
**Date:** 2026-07-22

## Context

A financial application whose frontend and backend need to share types and a generated HTTP client. Type errors in monetary values and dates are expensive and hard to catch through manual testing.

## Decision

Use TypeScript with `strict: true` across the project, and organize the repository as a monorepo using pnpm workspaces (`apps/api`, `apps/web`, `packages/api-client`).

## Alternatives considered

| Alternative | Why it was rejected |
|---|---|
| JavaScript | Unacceptable in a financial domain |
| Two separate repositories | The generated client would require registry publishing or manual copying |
| npm or yarn workspaces | pnpm is faster and uses less disk; its workspace support is mature |
| Nx or Turborepo | Configuration overhead disproportionate to two applications |

## Consequences

### Positive
- One install, one lint configuration, one CI pipeline
- The generated client is consumed by path, with no publishing step
- `tsconfig.base.json` enforces the same strictness on both sides

### Negative
- Developers unfamiliar with pnpm need an initial setup step
- Symlinked `node_modules` can confuse older tooling

### Risks and mitigations
- Libraries assuming npm hoisting may break → address case by case through `.npmrc`
