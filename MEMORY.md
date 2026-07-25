# Handoff memory

Where work stopped, so a new session can pick it up immediately. **Keep this short.** Only two
things belong here: work left half-finished, and what the next ticket needs. Everything else —
what was built, why, which trade-offs — lives in the GitHub Issue, the PR body and `docs/adr/`.
Rewrite this file rather than appending to it.

(Distinct from `plans/MEMORY.md`, which only tracks GitHub milestone/issue mirroring.)

---

## Status

**Last done:** M1-T03 — Docker Compose + PostgreSQL + env validation
([issue #3](https://github.com/lbcoutinho/family-budget-webapp/issues/3),
[PR #12](https://github.com/lbcoutinho/family-budget-webapp/pull/12), open, awaiting review).

Nothing is half-finished.

## Environment note (applies to every session)

The container ships Node 22, but the repo pins Node 24 and `engineStrict` makes `pnpm install`
fail on anything else. First command in a fresh session:

```bash
export NVM_DIR=/opt/nvm && . "$NVM_DIR/nvm.sh" && nvm install 24 && corepack enable
```

## Next: M1-T04 — Bootstrap the NestJS API with a health check

Read the ticket in `plans/milestones/m01-foundation.md` first. Carry-over from T03:

- **Wire the env validator.** `validate()` from `apps/api/src/config/env.validation.ts` already
  exists (with tests). T04 must import it into `ConfigModule.forRoot({ isGlobal: true, validate })`
  in the new `AppModule` — this is the deferred half of T03 (see issue #3 comment).
- **`nest new` into an already-populated `apps/api`.** The dir already has `package.json`,
  `tsconfig.json`, `jest.config.js`, `src/config/`, and installed deps (class-validator,
  class-transformer, reflect-metadata, jest, ts-jest). Scaffold carefully — don't clobber these;
  merge Nest's additions instead of overwriting.
- **Delete the `src/index.ts` placeholder** once `main.ts` / `app.module.ts` exist.
