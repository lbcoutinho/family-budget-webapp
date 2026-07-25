# Handoff memory

Where work stopped, so a new session can pick it up immediately. **Keep this short.** Only two
things belong here: work left half-finished, and what the next ticket needs. Everything else —
what was built, why, which trade-offs — lives in the GitHub Issue, the PR body and `docs/adr/`.
Rewrite this file rather than appending to it.

(Distinct from `plans/MEMORY.md`, which only tracks GitHub milestone/issue mirroring.)

---

## Status

**Last done:** M1-T02 — ESLint, Prettier, Husky, lint-staged
([issue #2](https://github.com/lbcoutinho/family-budget-webapp/issues/2),
[PR #9](https://github.com/lbcoutinho/family-budget-webapp/pull/9), open, awaiting review).

Nothing is half-finished.

## Environment note (applies to every session)

The container ships Node 22, but the repo pins Node 24 and `engineStrict` makes `pnpm install`
fail on anything else. First command in a fresh session:

```bash
export NVM_DIR=/opt/nvm && . "$NVM_DIR/nvm.sh" && nvm install 24 && corepack enable
```

## Next: M1-T03 — Docker Compose with PostgreSQL and environment validation

[Issue #3](https://github.com/lbcoutinho/family-budget-webapp/issues/3). Read the ticket in
`plans/milestones/m01-foundation.md` first. Two things the ticket text does not tell you:

- **Ordering problem.** T03 asks for `apps/api/src/config/env.validation.ts` using
  `@nestjs/config` + `class-validator`, but `nest new` only runs in T04, so `apps/api` has no
  NestJS dependencies yet. Either install those two packages by hand now, or do T04 first.
- **First test runner in the repo.** T03's `env.validation.spec.ts` is the first test anywhere,
  so Jest lands in `apps/api` here — and with it the `test` script that the root `pnpm test`
  fans out to.
