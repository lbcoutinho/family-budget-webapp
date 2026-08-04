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
| M2 — Authentication | [milestone #2](https://github.com/lbcoutinho/family-budget-webapp/milestone/2) | [#17](https://github.com/lbcoutinho/family-budget-webapp/issues/17)–[#22](https://github.com/lbcoutinho/family-budget-webapp/issues/22) | Created 2026-07-26; #18 widened 2026-07-27 |
| M3 — Master data | [milestone #3](https://github.com/lbcoutinho/family-budget-webapp/milestone/3) | [#45](https://github.com/lbcoutinho/family-budget-webapp/issues/45)–[#53](https://github.com/lbcoutinho/family-budget-webapp/issues/53), [#70](https://github.com/lbcoutinho/family-budget-webapp/issues/70)–[#74](https://github.com/lbcoutinho/family-budget-webapp/issues/74) | Created 2026-08-02; T10–T14 added 2026-08-04 |
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

**2026-07-27 — demo account folded into M2-T02.** A seventh task, *M2-T07 — Registration restricted
to a single allowed email*, was briefly opened as [#27](https://github.com/lbcoutinho/family-budget-webapp/issues/27)
and then **closed as not planned**: M2-T02 already covers a single account created from the
environment, so a sign-up endpoint was solving a problem the seed does not have. The part worth
keeping — a demo account on the `+demo` sub-address — moved into M2-T02, and
[#18](https://github.com/lbcoutinho/family-budget-webapp/issues/18)'s body was updated to match the
plan. GitHub issues cannot be deleted, so #27 stays closed as the record of that detour.

### M3 — Master data (2026-08-02)

Created GitHub Milestone `M3 - Master data` (#3) and 9 issues from `plans/milestones/m03-master-data.md`:

| Issue | Task | Labels |
|---|---|---|
| [#45](https://github.com/lbcoutinho/family-budget-webapp/issues/45) | M3-T01 — `Account` model and migration | backend |
| [#46](https://github.com/lbcoutinho/family-budget-webapp/issues/46) | M3-T02 — Accounts API with deactivation | backend |
| [#47](https://github.com/lbcoutinho/family-budget-webapp/issues/47) | M3-T03 — `Category` model with hierarchy and partial index | backend |
| [#48](https://github.com/lbcoutinho/family-budget-webapp/issues/48) | M3-T04 — Categories API with the two-level rule | backend |
| [#49](https://github.com/lbcoutinho/family-budget-webapp/issues/49) | M3-T05 — `Cashbox` model and API | backend |
| [#50](https://github.com/lbcoutinho/family-budget-webapp/issues/50) | M3-T06 — Base layout and navigation | frontend |
| [#51](https://github.com/lbcoutinho/family-budget-webapp/issues/51) | M3-T07 — Accounts screen | frontend |
| [#52](https://github.com/lbcoutinho/family-budget-webapp/issues/52) | M3-T08 — Categories screen | frontend |
| [#53](https://github.com/lbcoutinho/family-budget-webapp/issues/53) | M3-T09 — Cashboxes screen | frontend |

New label created: `milestone: m3-master-data` (purple `#5319E7`).

The three screen tickets (#51, #52, #53) are blocked on the prototype gate: `prototypes/approved/`
holds only `00-design-system`, `01-login` and `06-month`, so accounts, categories and cashboxes
have no approved prototype yet.

**2026-08-04 — T10–T14 mirrored.** Five tickets added to M3 by
`docs/superpowers/specs/2026-08-04-i18n-design.md` (i18n foundation, error codes, `User.locale`,
Settings › General, Vercel deploy) and mirrored to the existing `M3 - Master data` milestone:

| Issue | Task | Labels |
|---|---|---|
| [#70](https://github.com/lbcoutinho/family-budget-webapp/issues/70) | M3-T10 — i18n foundation on the web | frontend |
| [#71](https://github.com/lbcoutinho/family-budget-webapp/issues/71) | M3-T11 — Stable error codes on API business errors | backend, frontend |
| [#72](https://github.com/lbcoutinho/family-budget-webapp/issues/72) | M3-T12 — `locale` on `User` + `PATCH /api/users/me` | backend, frontend |
| [#73](https://github.com/lbcoutinho/family-budget-webapp/issues/73) | M3-T13 — Settings › General screen | frontend |
| [#74](https://github.com/lbcoutinho/family-budget-webapp/issues/74) | M3-T14 — Deploy to Vercel | backend, frontend |

No new label: all five carry `milestone: m3-master-data`. **Execution order is not numeric** — see
`docs/superpowers/specs/2026-08-04-i18n-design.md` and `MEMORY.md` (root) for the order T10 → T11 →
T07/T08/T09 → T12 → T13 → T14.
