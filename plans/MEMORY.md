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

| Milestone | GitHub Milestone | Status |
|---|---|---|
| M1 — Foundation | [milestone #1](https://github.com/lbcoutinho/family-budget-webapp/milestone/1) | Created 2026-07-25 |
| M2 — Authentication | [milestone #2](https://github.com/lbcoutinho/family-budget-webapp/milestone/2) | Created 2026-07-26; #18 widened 2026-07-27 |
| M3 — Master data | [milestone #3](https://github.com/lbcoutinho/family-budget-webapp/milestone/3) | Created 2026-08-02; T10–T14 added 2026-08-04 |
| M4 — Transactions (API) | [milestone #4](https://github.com/lbcoutinho/family-budget-webapp/milestone/4) | Created 2026-08-07; T01–T09 planned; T10 added 2026-08-07 |
| M5 — Entries (UI) | —  | Not started |
| M6 — Reports | — |  Not started |
| M7 — Recurrence | —  | Not started |
| M8 — Voice entry | —  | Not started |


| Issue | Task | Created Date |
|---|---|------------|
| [#1](https://github.com/lbcoutinho/family-budget-webapp/issues/1) | M1-T01 — pnpm monorepo with workspaces | 2026-07-25 |
| [#2](https://github.com/lbcoutinho/family-budget-webapp/issues/2) | M1-T02 — ESLint, Prettier, Husky, lint-staged | 2026-07-25 |
| [#3](https://github.com/lbcoutinho/family-budget-webapp/issues/3) | M1-T03 — Docker Compose + environment validation | 2026-07-25 |
| [#4](https://github.com/lbcoutinho/family-budget-webapp/issues/4) | M1-T04 — NestJS bootstrap with health check | 2026-07-25 |
| [#5](https://github.com/lbcoutinho/family-budget-webapp/issues/5) | M1-T05 — Vite, Tailwind, shadcn/ui bootstrap | 2026-07-25 |
| [#6](https://github.com/lbcoutinho/family-budget-webapp/issues/6) | M1-T06 — GitHub Actions CI pipeline | 2026-07-25 |
| [#7](https://github.com/lbcoutinho/family-budget-webapp/issues/7) | M1-T07 — OpenAPI → TypeScript client (Orval) | 2026-07-25 |
| [#17](https://github.com/lbcoutinho/family-budget-webapp/issues/17) | M2-T01 — User model and Prisma setup | 2026-07-26 |
| [#18](https://github.com/lbcoutinho/family-budget-webapp/issues/18) | M2-T02 — argon2 hashing service and initial user seed | 2026-07-26 |
| [#19](https://github.com/lbcoutinho/family-budget-webapp/issues/19) | M2-T03 — Local login with Passport and JWT issuance | 2026-07-26 |
| [#20](https://github.com/lbcoutinho/family-budget-webapp/issues/20) | M2-T04 — Global JWT guard and @CurrentUser decorator | 2026-07-26 |
| [#21](https://github.com/lbcoutinho/family-budget-webapp/issues/21) | M2-T05 — Axios instance with refresh interceptor | 2026-07-26 |
| [#22](https://github.com/lbcoutinho/family-budget-webapp/issues/22) | M2-T06 — Login screen and route protection | 2026-07-26 |
| [#45](https://github.com/lbcoutinho/family-budget-webapp/issues/45) | M3-T01 — `Account` model and migration | 2026-08-02 |
| [#46](https://github.com/lbcoutinho/family-budget-webapp/issues/46) | M3-T02 — Accounts API with deactivation | 2026-08-02 |
| [#47](https://github.com/lbcoutinho/family-budget-webapp/issues/47) | M3-T03 — `Category` model with hierarchy and partial index | 2026-08-02 |
| [#48](https://github.com/lbcoutinho/family-budget-webapp/issues/48) | M3-T04 — Categories API with the two-level rule | 2026-08-02 |
| [#49](https://github.com/lbcoutinho/family-budget-webapp/issues/49) | M3-T05 — `Cashbox` model and API | 2026-08-02 |
| [#50](https://github.com/lbcoutinho/family-budget-webapp/issues/50) | M3-T06 — Base layout and navigation | 2026-08-02 |
| [#51](https://github.com/lbcoutinho/family-budget-webapp/issues/51) | M3-T07 — Accounts screen | 2026-08-02 |
| [#52](https://github.com/lbcoutinho/family-budget-webapp/issues/52) | M3-T08 — Categories screen | 2026-08-02 |
| [#53](https://github.com/lbcoutinho/family-budget-webapp/issues/53) | M3-T09 — Cashboxes screen | 2026-08-02 |
| [#70](https://github.com/lbcoutinho/family-budget-webapp/issues/70) | M3-T10 — i18n foundation on the web | 2026-08-04 |
| [#71](https://github.com/lbcoutinho/family-budget-webapp/issues/71) | M3-T11 — Stable error codes on API business errors | 2026-08-04 |
| [#72](https://github.com/lbcoutinho/family-budget-webapp/issues/72) | M3-T12 — `locale` on `User` + `PATCH /api/users/me` | 2026-08-04 |
| [#73](https://github.com/lbcoutinho/family-budget-webapp/issues/73) | M3-T13 — Settings › General screen | 2026-08-04 |
| [#74](https://github.com/lbcoutinho/family-budget-webapp/issues/74) | M3-T14 — Deploy to Vercel | 2026-08-04 |
| [#84](https://github.com/lbcoutinho/family-budget-webapp/issues/84) | M4-T09 — Cashbox deletion by zero balance (moved from M3-T15; user renaming issue on GitHub) | 2026-08-06 |
| [#89](https://github.com/lbcoutinho/family-budget-webapp/issues/89) | M4-T10 — Cashboxes summary cards | 2026-08-07 |
