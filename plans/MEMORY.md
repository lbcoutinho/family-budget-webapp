# GitHub tracking — progress log and conventions

Tracks how the milestones/tasks in this `plans/` folder are mirrored onto GitHub Issues, and what's been created so far. Update this file whenever a new milestone's issues are created.

---

## Conventions

### Milestones

Each plan milestone (`plans/milestones/mXX-*.md`) maps 1:1 to a **native GitHub Milestone**:

- Title: `M<N> - <Name>` (e.g. `M1 - Foundation`), matching the `# M<N> — <Name>` heading in the milestone file
- Description: the milestone's **Goal** and **Definition of done** paragraphs

### Issues

Each task (`## M<N>-T<NN> — <title>` section in a milestone file) becomes one **GitHub Issue**:

- Title: `M<N>-T<NN> — <task title>`, copied verbatim from the section heading
- Body: the task's content copied verbatim — *Why this is needed*, *Implementation notes*, *Acceptance criteria*, *Tests*
- Assigned to the matching GitHub Milestone

### Labels

Two label families, both applied per issue:

- **`milestone: m<N>-<slug>`** — one label per milestone (e.g. `milestone: m1-foundation`). Created the first time that milestone's issues are created. Purple (`#5319E7`).
- **`backend`** / **`frontend`** — layer the task touches, applied by judgment based on the task's implementation notes (a task can carry both, one, or — rare — neither, e.g. pure docs). `backend` = blue (`#1D76DB`), `frontend` = green (`#0E8A16`).

When creating a new milestone's issues: create its `milestone: m<N>-<slug>` label first (reuse the same colors), then create issues with `--label "milestone: m<N>-<slug>,backend"` (etc.) and `--milestone "M<N> - <Name>"`.

---

## Progress log

| Milestone | GitHub Milestone | Issues | Status |
|---|---|---|---|
| M1 — Foundation | [milestone #1](https://github.com/lbcoutinho/family-budget-webapp/milestone/1) | [#1](https://github.com/lbcoutinho/family-budget-webapp/issues/1)–[#7](https://github.com/lbcoutinho/family-budget-webapp/issues/7) | Created 2026-07-25 |
| M2 — Authentication | [milestone #2](https://github.com/lbcoutinho/family-budget-webapp/milestone/2) | [#17](https://github.com/lbcoutinho/family-budget-webapp/issues/17)–[#22](https://github.com/lbcoutinho/family-budget-webapp/issues/22), [#27](https://github.com/lbcoutinho/family-budget-webapp/issues/27) | Created 2026-07-26; T07 added 2026-07-27 |
| M3 — Master data | — | — | Not started |
| M4 — Transactions (API) | — | — | Not started |
| M5 — Entries (UI) | — | — | Not started |
| M6 — Reports | — | — | Not started |
| M7 — Recurrence | — | — | Not started |
| M8 — Voice entry | — | — | Not started |

### M1 — Foundation (2026-07-25)

Created GitHub Milestone `M1 - Foundation` and 7 issues from `plans/milestones/m01-foundation.md`:

| Issue | Task | Labels |
|---|---|---|
| [#1](https://github.com/lbcoutinho/family-budget-webapp/issues/1) | M1-T01 — pnpm monorepo with workspaces | backend, frontend |
| [#2](https://github.com/lbcoutinho/family-budget-webapp/issues/2) | M1-T02 — ESLint, Prettier, Husky, lint-staged | backend, frontend |
| [#3](https://github.com/lbcoutinho/family-budget-webapp/issues/3) | M1-T03 — Docker Compose + environment validation | backend |
| [#4](https://github.com/lbcoutinho/family-budget-webapp/issues/4) | M1-T04 — NestJS bootstrap with health check | backend |
| [#5](https://github.com/lbcoutinho/family-budget-webapp/issues/5) | M1-T05 — Vite, Tailwind, shadcn/ui bootstrap | frontend |
| [#6](https://github.com/lbcoutinho/family-budget-webapp/issues/6) | M1-T06 — GitHub Actions CI pipeline | backend, frontend |
| [#7](https://github.com/lbcoutinho/family-budget-webapp/issues/7) | M1-T07 — OpenAPI → TypeScript client (Orval) | backend, frontend |

Labels created at this point (reused for all future milestones): `milestone: m1-foundation`, `backend`, `frontend`.

### M2 — Authentication (2026-07-26)

Created GitHub Milestone `M2 - Authentication` (#2) and 6 issues from `plans/milestones/m02-authentication.md`:

| Issue | Task | Labels |
|---|---|---|
| [#17](https://github.com/lbcoutinho/family-budget-webapp/issues/17) | M2-T01 — User model and Prisma setup | backend |
| [#18](https://github.com/lbcoutinho/family-budget-webapp/issues/18) | M2-T02 — argon2 hashing service and initial user seed | backend |
| [#19](https://github.com/lbcoutinho/family-budget-webapp/issues/19) | M2-T03 — Local login with Passport and JWT issuance | backend |
| [#20](https://github.com/lbcoutinho/family-budget-webapp/issues/20) | M2-T04 — Global JWT guard and @CurrentUser decorator | backend |
| [#21](https://github.com/lbcoutinho/family-budget-webapp/issues/21) | M2-T05 — Axios instance with refresh interceptor | frontend |
| [#22](https://github.com/lbcoutinho/family-budget-webapp/issues/22) | M2-T06 — Login screen and route protection | frontend |

New label created: `milestone: m2-authentication` (purple `#5319E7`).

**Added 2026-07-27**, after the milestone was mirrored, so it carries the next free number rather than a
number in sequence with its task id:

| Issue | Task | Labels |
|---|---|---|
| [#27](https://github.com/lbcoutinho/family-budget-webapp/issues/27) | M2-T07 — Registration restricted to a single allowed email | backend |
