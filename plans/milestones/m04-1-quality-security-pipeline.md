# M4.1 — Quality & Security Pipeline

**Goal:** add a free quality and security layer on top of the existing CI — coverage gates, SAST, secret scanning, and scheduled dependency updates with a safe
auto-merge policy — without a SonarQube server and without duplicating what ESLint, TypeScript and the test suites already cover.

**Definition of done:** every PR to `main` is blocked until lint, typecheck, generated-client verification, unit + integration tests, coverage thresholds, CodeQL
and Gitleaks are green; Dependabot opens grouped version-update PRs every Friday 12:00 `Europe/Lisbon` for npm and GitHub Actions; patch/minor Dependabot PRs
auto-merge after green CI while major PRs wait for manual review; the policy is documented in the repository.

**Depends on:** M4 complete. Source plan: #114.

---

## Baseline (verified 2026-08-12 — do not re-derive)

- `.github/workflows/ci.yml` — one job, `ci`, on `pull_request` + `push: main`, with a `postgres:16-alpine` service and the full boot-time env var set.
  Steps: checkout → `pnpm/action-setup@v6` → `actions/setup-node@v7` (`.nvmrc`, pnpm cache) → `pnpm install --frozen-lockfile` → `pnpm lint` →
  `pnpm -r typecheck` → `pnpm gen` + `git diff --exit-code -- packages/api-client` → `prisma migrate deploy` → `pnpm test` → `pnpm --filter api test:e2e`.
  `.github/workflows/pages.yml` also exists (prototype publishing) and is out of scope.
- **There is no browser E2E suite.** "E2E" in #114 maps to `apps/api` Jest integration tests (`test/jest-e2e.json`, `*.e2e-spec.ts`), already required.
- `apps/api` — Jest, `rootDir: src`, `testRegex: .*\.spec\.ts$`, `collectCoverageFrom: ['**/*.ts', '!**/*.spec.ts', '!generated/**']`,
  `coverageDirectory: ../coverage`. No thresholds, no `test:cov` script.
- `apps/web` — Vitest 4 configured inside `vite.config.ts` (`globals`, `jsdom`, `src/test/setup.ts`). No coverage provider installed.
- Root scripts: `lint`, `typecheck`, `test` (`pnpm -r --if-present test`), plus the `api:*` / `web:*` proxies. No coverage script.
- Repo settings: public (CodeQL and code scanning free), squash-merge only, auto-merge **already enabled**, delete-branch-on-merge on.
- `main` protection: required status check **`ci`** only, `strict: true` (branch must be up to date), 0 required approvals, conversation resolution required,
  no admin enforcement.

Implication: required-check names must stay stable. Keep the single `ci` job (coverage folds into it) and add `codeql` / `gitleaks` as new required contexts.

---

## M4.1-T01 — Coverage thresholds in CI

### Why this is needed

CI proves the tests pass, not that they cover anything. Without a floor, a PR can add an untested module and stay green, and coverage silently decays until the
number is too embarrassing to enforce. A threshold set at the measured baseline freezes the decay today and lets it be ratcheted up later.

### Implementation notes

- Measure the baseline first: `pnpm --filter api test -- --coverage` and (after adding the provider) `pnpm --filter web test -- --coverage`. Record the four
  numbers per app in the PR description.
- Target thresholds are lines/statements/functions 70%, branches 60%. If the baseline is below target, set the threshold **just under the measured baseline**
  (round down to the nearest 5) and leave a `TODO` comment in the config naming the target. Never lower a threshold to make a later PR pass.
- `apps/api` — add `coverageThreshold: { global: { ... } }` to `jest.config.js`; add `"test:cov": "jest --coverage"`. Reporters: `['text-summary', 'lcov']`.
- `apps/web` — add `@vitest/coverage-v8` devDependency; add `test.coverage` to `vite.config.ts` with `provider: 'v8'`, `reporter: ['text-summary', 'lcov']`,
  `thresholds`, and `exclude` for `src/test/**`, `src/**/*.d.ts`, generated files; add `"test:cov": "vitest run --coverage"`.
- Root: `"test:cov": "pnpm -r --if-present test:cov"`, plus `api:test:cov` / `web:test:cov` proxies to match the existing convention.
- In `ci.yml`, **replace** the `pnpm test` step with `pnpm test:cov` — same run, no second pass. Integration tests stay a separate uninstrumented step.
- Git-ignore `coverage/` and `**/coverage/` if not already ignored. No coverage-report upload service in this phase.

### Acceptance criteria

- [ ] `pnpm test:cov` runs both apps and prints a coverage summary each
- [ ] A threshold violation in either app fails the command with a non-zero exit code
- [ ] CI runs the unit suite exactly once (coverage replaces the plain test step)
- [ ] `lcov.info` is produced for both apps
- [ ] Measured baselines and the chosen thresholds are recorded in the PR description
- [ ] Coverage artefacts are git-ignored

### Tests

- Local: run `pnpm test:cov` on a clean tree — passes.
- Local: temporarily raise a threshold above baseline, confirm non-zero exit, revert.
- CI: the PR for this ticket is itself the check.

---

## M4.1-T02 — CodeQL static analysis

### Why this is needed

Nothing in the pipeline looks for security-relevant code patterns — injection paths, unsafe deserialization, path traversal. ESLint is a style/correctness tool
with a type-aware layer, not a taint-tracking engine. CodeQL is free on public repositories and reports into GitHub Code Scanning.

### Implementation notes

- New workflow `.github/workflows/codeql.yml`, job id `codeql` (this becomes the required-check name).
- Triggers: `pull_request` targeting `main` and `push` to `main`. **No schedule** — every change reaches `main` through a PR, so a cron pass only re-scans code
  already scanned; add one later only if CodeQL query-pack updates prove to surface new findings.
- Single language matrix entry: `javascript-typescript` (one CodeQL language covers both).
- `github/codeql-action/init@v4` with `build-mode: none` (interpreted languages need no build) → `github/codeql-action/analyze@v4`. Use the
  `security-and-quality` query suite; if it proves noisy on the existing codebase, fall back to `security-extended` and note why in the workflow.
- Permissions, job-scoped and minimal: `security-events: write`, `contents: read`, `actions: read`. No repo-wide default write.
- Add the same `concurrency` group pattern used by `ci.yml`, keyed on the workflow name, so superseded commits stop consuming minutes.
- Do not add a `codeql-config.yml` with path exclusions in this phase. `.claude/skills/impeccable/**` is vendored third-party JS; exclude it only if it actually
  produces findings, and say so in a comment.

### Acceptance criteria

- [ ] The `codeql` workflow runs on PRs to `main` and on pushes to `main`
- [ ] It analyses JavaScript/TypeScript across `apps/api`, `apps/web` and `packages/`
- [ ] Results appear under Security → Code scanning
- [ ] Workflow permissions are declared at job level and are the minimum listed above
- [ ] The run finishes green on the current codebase, or every finding is triaged (fixed or dismissed with a written reason)

### Tests

- The ticket's own PR must show a completed CodeQL run.
- On a throwaway branch, introduce an obviously vulnerable snippet (e.g. `eval` on request input in a scratch file), confirm CodeQL flags it, then delete the
  branch without merging.

---

## M4.1-T03 — Gitleaks secret scanning

Done — see #129.

---

## M4.1-T04 — Dependabot version updates, weekly

### Why this is needed

Dependencies drift, and a manual `pnpm update` happens roughly never. A scheduled batch keeps drift small enough that each upgrade is reviewable, and pinning
the run to Friday midday keeps the noise out of the rest of the week. Actions versions rot the same way and are the more security-relevant of the two.

### Implementation notes

- New file `.github/dependabot.yml`, `version: 2`.
- Two ecosystems, both `schedule: { interval: weekly, day: friday, time: "12:00", timezone: "Europe/Lisbon" }`:
  - `npm` at `directory: "/"` — Dependabot's npm ecosystem understands pnpm workspaces from `pnpm-lock.yaml` at the root, so one entry covers `apps/api`,
    `apps/web` and `packages/*`. Verify this on the first run; only if root-only proves to miss a workspace, fall back to explicit `directories:` entries.
  - `github-actions` at `directory: "/"`.
- Groups, to cut PR count:
  - npm: one group `npm-minor-patch` matching `patterns: ["*"]` with `update-types: ["minor", "patch"]`, applied to both `dependencies` and `development`
    dependency types. Majors stay ungrouped so each lands in its own reviewable PR.
  - github-actions: one group `actions` matching `["*"]` for minor+patch.
- `open-pull-requests-limit: 10`. Labels: `dependencies`. Commit message prefix `chore(deps)` (and `chore(deps-dev)` for dev) so history stays consistent with
  the project's conventional-commit style.
- **Do not add any `ignore` entry** — majors must still open PRs.
- Separately, in repository settings, confirm Dependency Graph, Dependabot Alerts and Dependabot Security Updates are all enabled. These are independent of the
  weekly schedule: a published CVE should not wait until Friday.

### Acceptance criteria

- [ ] `.github/dependabot.yml` exists and is accepted by GitHub (Insights → Dependency graph → Dependabot shows no config error)
- [ ] npm and github-actions are both scheduled Friday 12:00 `Europe/Lisbon`
- [ ] Minor + patch updates arrive grouped; majors arrive as individual PRs
- [ ] No `ignore` rules are present
- [ ] Dependency Graph, Alerts and Security Updates are enabled in settings
- [ ] Dependabot is not a job inside `ci.yml`

### Tests

- Trigger a manual run from the Dependabot page ("Check for updates") and confirm PRs open with the expected grouping and labels — do not wait a week to find
  out the config is wrong.
- Confirm the opened PRs run the full check set (`ci`, `codeql`, `gitleaks`).

---

## M4.1-T05 — Auto-merge for Dependabot patch and minor

### Why this is needed

The point of a weekly batch is that it does not become weekly manual work. Patch and minor bumps under a green pipeline carry little enough risk to merge
themselves; majors carry breaking changes by definition and stay a human decision. GitHub's native auto-merge does the waiting, so the workflow never merges
anything itself.

### Implementation notes

- New workflow `.github/workflows/dependabot-automerge.yml`, on `pull_request_target` with types `[opened, synchronize, reopened, ready_for_review]`.
  `pull_request_target` is required so the job gets a writable token — Dependabot PRs run with a read-only `GITHUB_TOKEN` under `pull_request`.
- Guard the job with `if: github.actor == 'dependabot[bot]' && github.event.pull_request.user.login == 'dependabot[bot]'`.
- **Because it is `pull_request_target`, the workflow must never check out or execute PR code.** Its only steps are `dependabot/fetch-metadata@v2` and a
  `gh pr merge --auto --squash` call. This constraint is the whole security argument; state it in a comment at the top of the file.
- Merge only when `steps.meta.outputs.update-type` is `version-update:semver-patch` or `version-update:semver-minor`. `--squash` matches the repo's only allowed
  merge method.
- `--auto` enables GitHub auto-merge, which honours every required status check and does not merge on red. Do not call `gh pr review --approve`; with 0 required
  approvals it is unnecessary, and self-approval would only mask a future review requirement.
- Permissions: `contents: write`, `pull-requests: write`. `GITHUB_TOKEN` only — no PAT.
- Note the interaction with `strict: true` branch protection: an out-of-date Dependabot PR needs a rebase before it can merge. Dependabot rebases its own PRs
  automatically, so leave `strict` on and revisit only if rerun churn becomes a real cost.

### Acceptance criteria

- [ ] The workflow only ever acts on PRs authored by `dependabot[bot]`
- [ ] It never checks out or runs PR-authored code
- [ ] Patch and minor PRs get GitHub auto-merge enabled
- [ ] Major PRs get no auto-merge and stay open
- [ ] Merges are squash merges
- [ ] Permissions are limited to `contents: write` + `pull-requests: write`, using `GITHUB_TOKEN`

### Tests

- Patch: auto-merge enabled → merges once every required check is green.
- Minor: same as patch.
- Major: auto-merge is not enabled; the PR is still open after CI passes.
- Red CI: a patch/minor PR with a failing required check stays open and unmerged.
- Non-Dependabot PR: the job is skipped.

Evidence for each scenario (PR link + observed outcome) goes in the M4.1-T07 validation note.

---

## M4.1-T06 — Required checks on `main`

### Why this is needed

Auto-merge is only as safe as the list of checks it waits for. Today `ci` is the only required context, so a CodeQL or Gitleaks failure would not stop a merge —
which would make the two previous tickets decorative.

### Implementation notes

- Repository-settings change, not a code change. Executed via the GitHub UI or `gh api`; record the final state in the PR description since it is not tracked
  in git.
- Extend required status checks on `main` from `["ci"]` to `["ci", "codeql", "gitleaks"]`. Names must match the job ids created in T02 and T03 — verify against
  a completed run before saving, as a misspelled context silently blocks every PR forever.
- Add each new check only after its workflow has completed successfully at least once on `main`; otherwise GitHub cannot resolve the context.
- Keep: `strict: true`, conversation resolution required, no force pushes, no deletions, 0 required approvals.
- Do not grant Dependabot any bypass, and do not add it to a bypass actor list.
- Coverage and the integration tests need no separate context — they are steps inside the `ci` job.

### Acceptance criteria

- [ ] `main` requires `ci`, `codeql` and `gitleaks`
- [ ] All three contexts resolve (no permanently pending check on a fresh PR)
- [ ] No bypass actors are configured for Dependabot or anyone else
- [ ] Auto-merge remains enabled at repository level; squash remains the only merge method
- [ ] A PR with any one of the three failing cannot be merged

### Tests

- Open a scratch PR with a deliberate lint error: merge is blocked, `ci` red.
- Reuse the T03 planted-secret branch: merge is blocked with `ci` green and `gitleaks` red.
- Confirm a normal green PR still merges.

---

## M4.1-T07 — Document the pipeline and validate end to end

### Why this is needed

An automated merge policy that nobody can find is a surprise waiting to happen — the next person to see a dependency PR merge itself needs to know that was
intended, and under which rules. This ticket also carries the one-off proof that the whole chain behaves as specified.

### Implementation notes

- Add a "Quality & security checks" section to `CONTRIBUTING.md` (the developer-facing document since the M3/M4 split) and a short pointer from `README.md`.
  Cover: what runs on a PR, the coverage thresholds and where they are configured, CodeQL, Gitleaks, the Dependabot schedule, the auto-merge policy, and the
  manual-review rule for majors.
- Include the summary block from #114:

  ```text
  Regular pull requests:
    lint + typecheck + generated-client check + tests + coverage + integration tests + CodeQL + Gitleaks

  Dependabot version updates:
    Friday, 12:00 Europe/Lisbon

  Dependabot patch/minor:
    auto-merge after green CI

  Dependabot major:
    manual review
  ```

- Update the `## Commands` section of the root `AGENTS.md` with `pnpm test:cov` and the `api:test:cov` / `web:test:cov` proxies.
- Final least-privilege pass: every workflow declares explicit `permissions`; none uses a PAT; `dependabot-automerge.yml` still checks out nothing.
- Record the scenario evidence from T05 and T06 (PR links, observed outcomes) as a comment on the milestone tracking issue, and close #114.

### Acceptance criteria

- [ ] `CONTRIBUTING.md` documents all seven items above
- [ ] `README.md` links to that section
- [ ] `AGENTS.md` lists the coverage commands
- [ ] Every workflow file has an explicit `permissions` block; no PATs anywhere
- [ ] Scenarios A–F from #114 are each recorded with a link and an outcome
- [ ] Every Definition-of-Done checkbox in #114 is ticked, and #114 is closed

### Tests

- Documentation only — the tests are the recorded scenario evidence.
