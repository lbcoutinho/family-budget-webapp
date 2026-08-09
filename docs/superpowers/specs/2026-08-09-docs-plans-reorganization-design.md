# Design — Docs/Plans reorganization: GitHub as source of truth

**Status:** Approved for planning
**Date:** 2026-08-09

## Problem

`plans/` and `docs/` accumulate large files that go stale the moment a later task changes what an
earlier one built. Local files also duplicate what already lives on GitHub Issues, and the two
drift apart (issues created manually never get mirrored back). Result: Claude reads outdated plans,
cross-checks against code anyway, and the file was a wasted read.

Core shift: **GitHub Issues/Milestones become the source of truth for anything already ticketed.**
Local files keep only what has no home elsewhere — permanent decisions (ADRs), domain overview,
and not-yet-ticketed planning work.

## Decisions

### 1. `docs/adr/`

No structural change. Rename `README.md` → `CLAUDE.md` — the harness auto-loads `CLAUDE.md` when a
file in that directory is read, so ADR conventions/index enter context automatically instead of
needing a deliberate read. Tighten the index prose (fix broken table formatting); ADR content itself
is untouched — accepted ADRs are still never edited.

### 2. `docs/superpowers/specs/`

No structural change to the folder. Content shape changes (see §4). No automatic tracking of "is
this spec done" — that's a manual check. Add a step to `AGENTS.md`'s existing "milestone completed →
review" hook: check whether every ticket a spec references is closed on GitHub, and if so, prompt
the user to delete the spec. Never a maintained list.

### 3. `docs/superpowers/plans/`

Delete all 7 existing files (`M3-T07`–`T12` implementation plans) — implemented, merged, redundant
with closed issues + code. Going forward, the `writing-plans` skill's output target changes: **it
never writes a local plan file.** The plan is written directly into the GitHub issue body (`## Implementation
Plan`, `## Acceptance Criteria`, `## Tests` sections — see §4), replacing that issue's placeholders.

### 4. Issue/spec/milestone-file body shape

Every ticket, wherever it's drafted (milestone file or spec), carries only two sections up front:

```
## M<N>-T<NN> — <title>
### Why this is needed
### Implementation notes
```

No `Acceptance criteria` / `Tests` at draft time — those are decided at execution time, based on
implementation notes that may be stale by then. When the ticket is mirrored to GitHub (§5), the
issue is created with those two sections plus three empty placeholder headers:

```
## Implementation Plan
## Acceptance Criteria
## Tests
```

When work on that ticket starts, the model reads "Implementation notes" from the issue, produces a
real implementation plan, and fills the three placeholders directly on the issue (via `gh issue edit
--body-file`) — never staged in a local file first.

Existing already-mirrored issues keep whatever shape they have. Existing not-yet-mirrored tasks in
`m04`–`m08` that already have `Acceptance criteria`/`Tests` written are left as-is locally (not
deleted) — but mirroring only ever copies "Why this is needed" + "Implementation notes" into the
issue, ignoring those two sections if present.

### 5. `github-mirroring` skill — rewritten

Mirrors **one ticket at a time**, on request (e.g. "mirror M4-T02"), not a whole milestone:

1. Grep `plans/milestones/*.md` (or the relevant spec file) for the given task heading.
2. Extract only "Why this is needed" + "Implementation notes".
3. `search_issues`/`list_issues` to confirm it doesn't already exist (no local tracking file to
   consult — GitHub is queried directly).
4. Create the issue: body = the two extracted sections + the three empty placeholder headers.
   Assign the milestone label + `backend`/`frontend` label(s) + the `milestone: m<N>-<slug>` label,
   same conventions as today.
5. No local file update after creation — nothing to keep in sync.

Starting a new milestone still creates just the GitHub Milestone container (title from `# M<N> —
<Name>` heading, description from Goal + Definition of done) — issues under it are created
one-by-one via step above, on demand, not in a batch.

### 6. `plans/MEMORY.md` — deleted

No replacement. "Has this task been done?" is answered by querying GitHub directly (`gh issue list
--milestone "M<N> - <Name>" --state all`), never by a locally maintained mirror — the exact
divergence problem (manually-created issues invisible to the file) goes away because there's no file
to fall out of sync.

### 7. `plans/milestones/*.md`

Rule: once a task has a GitHub issue, its full body is redundant locally — collapse to one line:

```
## M1-T01 — Set up pnpm monorepo with workspaces
Done — see #1.
```

Applied per file:

- **m01, m02**: every task mirrored → collapse entirely to one line per task, keep the `# M<N> —
<Name>` header, Goal, Definition of done.
- **m03**: every task (T01–T14) already has an issue → collapse entirely, same as above.
- **m04**: T01, T09, T10 have issues → collapse those three lines. T02–T08 not yet mirrored → leave
  untouched (full Why/Implementation notes/AC/Tests as they exist today, per §4's carve-out).
- **m05–m08**: nothing mirrored yet → untouched.

Going forward, a task's full detail is only ever written directly to its GitHub issue at execution
time (§4) — never staged in the milestone file first. The milestone file's job for an unmirrored
task is limited to Why + Implementation notes (§4), pre-existing AC/Tests left as dead weight until
that task is mirrored, at which point the whole task's section can be collapsed to the one-liner.

### 8. `plans/0001-overview.md`

Kept — gives the domain model no other file owns. Changes: remove the stale `Status: Awaiting
approval` header line; condense prose economy-of-tokens style (cut connective grammar, keep every
formula/invariant/enum verbatim — meaning must survive, elegance of sentence doesn't need to);
update §7.2 ("Tasks and pull requests") to describe the new issue-first flow instead of "body copied
from the milestone file".

### 9. `plans/0002-screens.md` → `plans/screens/`

Split like `prototypes/`: an index file `plans/screens/AGENTS.md` (not `README.md` — matches this
project's convention of `AGENTS.md` as the navigable index, vs. `CLAUDE.md` for auto-loaded context)
listing every screen with a one-line pointer, plus one file per screen
(`plans/screens/NN-slug.md`) carrying that screen's actions/fields. Cross-cutting sections (§2
prototype workflow, §3 colour/typography/motion/layout/shared-states/localization) move into a
shared `plans/screens/global-rules.md`, mirroring `prototypes/memory/global-rules.md`.

### 10. `AGENTS.md` / `CLAUDE.md`

Update the "Ticket workflow" section to state:

- Plans are written directly to the GitHub issue body, never to a local plan file (supersedes the
  current "record new ADR ... update affected tickets" wording where it implies local plan files).
- A milestone file's task section is collapsed to a one-line status once that task has a GitHub
  issue.
- ADRs and plans may sacrifice prose grammar for token economy — meaning and technical content must
  stay exact, sentence polish doesn't matter.
- The milestone-completion review step also checks `docs/superpowers/specs/` for specs whose
  referenced tickets are all closed, and prompts for deletion.

## Out of scope

- No automated "has this been implemented" tracker of any kind (explicitly rejected — token cost,
  guaranteed to drift).
- No change to how ADRs are numbered, superseded, or templated.
- `prototypes/` folder structure is unaffected — it's already the pattern being copied.
