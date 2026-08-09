---
name: github-mirroring
description: Mirror a single ticket from this project's plan documents onto GitHub — open the Issue for one task, seeded with its plan text, with the label families applied. Use this when creating the Issue for a ticket immediately before implementing it, or when starting a new milestone (which only creates the Milestone container). Issues are created one at a time, on request — never a whole milestone's worth in one pass.
---

# GitHub issue mirroring

`plans/milestones/*.md` (or the relevant spec file) is the source of truth for a ticket's intent; the GitHub Issue is where the ticket is actually tracked.
GitHub itself is now authoritative for ticketed work — there is no local tracking file to keep in sync. The plan supplies the seed text for a new issue; once
the issue exists, it is worked and updated on GitHub directly.

Two situations bring you here, and they differ in scope:

- **Starting a milestone** — create only the GitHub Milestone container. Issues under it are created one at a time, on demand, via the flow below — not all at
  once.
- **Mirroring a single ticket** — the Issue for one task, created *immediately before*
  implementing it, so GitHub never lags behind the work.

## Mirroring one ticket

1. Grep `plans/milestones/*.md` (or the relevant spec file) for the given task heading (`## M<N>-T<NN> — <title>`).
2. Extract only the task's `### Why this is needed` and `### Implementation notes` subsections — nothing else from the task body.
3. Confirm the ticket doesn't already exist on GitHub. This repository has no `gh` CLI; use the GitHub MCP tools (`mcp__github__*`) — `list_issues` and
   `search_issues` — to check. There is no local tracking file to consult; GitHub is queried directly, every time.
4. Create the issue with `issue_write`:
    - **Title**: `M<N>-T<NN> — <title>` (em dash, as in the heading).
    - **Body**: the two extracted sections, verbatim, followed by three empty placeholder headers:
      `## Implementation Plan`, `## Acceptance Criteria`, `## Tests`.
    - Assigned to the task's Milestone.
    - Labelled with the milestone label plus `backend`/`frontend` as applicable (see below).

## Mapping

| Plan                                                             | GitHub                                                                                                                                                |
|------------------------------------------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------|
| `# M<N> — <Name>` heading in the milestone file                  | Milestone titled `M<N> - <Name>` (hyphen, not em dash), described by the milestone's **Goal** and **Definition of done**                              |
| `## M<N>-T<NN> — <title>` section                                | Issue titled `M<N>-T<NN> — <title>` (em dash, as in the heading)                                                                                      |
| The task's `### Why this is needed` + `### Implementation notes` | Issue body, copied **verbatim**, followed by empty `## Implementation Plan`, `## Acceptance Criteria`, `## Tests` headers, assigned to that Milestone |

Fill in `## Acceptance Criteria` and `## Tests` as unchecked boxes once the implementation plan is known. They are the ticket's definition of done, and checking
them off as the work lands is how the issue stays useful during review.

## Labels

Applied to every issue:

- **`backend`** (`#1D76DB`), **`frontend`** (`#0E8A16`), `ìnfra` (`#5319E7`), `prototyping` (`#FBCA04`), `documentation` (`#0075ca`) — the layer the task
  touches, by judgment from the implementation notes. A task can carry one or multiple.