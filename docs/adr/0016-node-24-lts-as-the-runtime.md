# ADR-0016 — Node 24 LTS as the runtime

**Status:** Accepted
**Date:** 2026-07-25

## Context

`plans/milestones/m01-foundation.md` (M1-T01) specified Node 22 LTS, chosen when the plan was
written. By the time the monorepo was actually scaffolded, Node 22 had moved into maintenance
LTS and Node 24 ("Krypton", latest 24.18.0) was the active LTS line — the version already
installed on the development machine.

The runtime version is not a free choice made per workspace: it fixes the `@types/node` major,
the Node version CI runs on (M1-T06), the base image of any future container, and the minimum
`pnpm` release available. Deciding it once, explicitly, is cheaper than discovering the
mismatch when the API is deployed.

## Decision

Target **Node 24 LTS**. `.nvmrc` pins `24`, the root `package.json` declares
`engines.node: ">=24.0.0 <25.0.0"`, and `@types/node` tracks the same major (`^24.13.3`).

The range is enforced rather than advisory: `engineStrict: true` in `pnpm-workspace.yaml` turns
a mismatched runtime into `ERR_PNPM_UNSUPPORTED_ENGINE` at install time, instead of the warning
pnpm prints by default.

The upper bound keeps the runtime on a single major, so `@types/node` cannot silently describe
APIs the runtime does not have. Moving to the next LTS is then a deliberate edit, recorded by a
new ADR.

## Alternatives considered

| Alternative | Why it was rejected |
|---|---|
| Node 22 LTS, as originally planned | Maintenance LTS: security fixes only, and it would have to be replaced before the project's first release |
| Node 26 (`latest` on npm) | Not the active LTS at this date; the toolchain (NestJS, Prisma, Vite) validates against LTS lines |
| Open-ended `>=24` with no upper bound | Would let a machine on the next major install successfully while `@types/node` still describes 24 |
| Leaving `engines` as a warning | pnpm only warns by default, so the pin would be documentation rather than a constraint |

## Consequences

### Positive
- Active LTS: security and bugfix support throughout the project's development
- One runtime major across `.nvmrc`, `engines`, `@types/node` and (later) CI and Docker images
- A wrong local runtime fails at `pnpm install`, with the expected range in the message

### Negative
- Contributors on Node 22 must upgrade before they can install
- `plans/milestones/m01-foundation.md` and `CLAUDE.md` no longer match their original text and had
  to be corrected

### Risks and mitigations
- A library in a later milestone may not yet support Node 24 → the stack (NestJS 11, Prisma,
  Vite) already supports it; if a specific package does not, pin that package rather than
  downgrading the runtime
- CI drifting from the local runtime → M1-T06 must read the version from `.nvmrc` instead of
  hardcoding it in the workflow
