---
name: github-mirroring
description: Mirror this project's plan documents onto GitHub — create the Milestone for a plan milestone, open one Issue per task with the plan text copied verbatim, apply the label families, and update plans/MEMORY.md. Use this when starting a milestone (M1, M2, …), when creating the Issue for a ticket before implementing it, when the user asks to create issues/milestones from the plans, or whenever GitHub looks out of sync with plans/milestones/. Drive it automatically at the start of a milestone rather than waiting to be asked.
---

# GitHub milestone/issue mirroring

`plans/milestones/*.md` is the source of truth; GitHub is a mirror of it. The mirror exists so
progress is visible and each ticket has a stable place for deviations and review comments — it
carries no information of its own. That is why issue bodies are copied verbatim: if the two ever
disagree, the plan wins, and any wording drift makes it harder to tell which side is stale.

Two situations bring you here, and they differ in scope:

- **Starting a milestone** — create the GitHub Milestone and every Issue in it, in one pass.
- **Starting a single ticket** — the Issue for that one task, created *immediately before*
  implementing it, so GitHub never lags behind the work.

## Before creating anything

Read `plans/MEMORY.md`. It tracks what has already been mirrored, and its progress table tells
you whether a milestone's issues exist and which numbers they got. Creating a duplicate
milestone or a second issue for the same task is the main failure mode here, and it is annoying
to unwind — GitHub issues cannot be deleted, only closed.

This repository has no `gh` CLI. Use the GitHub MCP tools (`mcp__github__*`): `list_issues` and
`search_issues` to check what exists, `issue_write` to create or update, `list_issue_fields` /
`get_label` when you need to confirm a label is there.

## Mapping

| Plan | GitHub |
|---|---|
| `# M<N> — <Name>` heading in the milestone file | Milestone titled `M<N> - <Name>` (hyphen, not em dash), described by the milestone's **Goal** and **Definition of done** |
| `## M<N>-T<NN> — <title>` section | Issue titled `M<N>-T<NN> — <title>` (em dash, as in the heading) |
| The task's body — *Why this is needed*, *Implementation notes*, *Acceptance criteria*, *Tests* | Issue body, copied **verbatim**, assigned to that Milestone |

Keep the acceptance criteria as unchecked boxes. They are the ticket's definition of done, and
checking them off as the work lands is how the issue stays useful during review.

## Labels

Two families, both applied to every issue:

- **`milestone: m<N>-<slug>`** — one per milestone (e.g. `milestone: m1-foundation`), purple
  `#5319E7`. Create it the first time that milestone's issues are created.
- **`backend`** (blue `#1D76DB`) and/or **`frontend`** (green `#0E8A16`) — the layer the task
  touches, by judgment from the implementation notes. A task can carry both, one, or — rarely,
  for pure docs — neither.

Reuse the same colors for every new milestone so the board stays readable.

## After creating them

Update `plans/MEMORY.md` in the same change:

- the **progress log** row for that milestone — the GitHub Milestone link and
  the status with the date;
- a short per-milestone section listing each issue, its task and its labels, matching the shape
  of the M1 section already there.
- Keep in the **progress log** only the tracking of which milestones and issues where created and when.
- Don't mention other tickets that were out of the plan, labels created, execution order or anything that is not the issue created and date.
- In the Milestones table, keep "Milestone | GitHub Milestone | Status"
- In the Issues table, keep a single table with "Issue | Task | Created Date"

Without that update the next session cannot tell what is mirrored, and the check at the top of
this skill stops working.

## When the plan changes after mirroring

The mirror has to follow, or the two drift apart:

- A ticket's text changed in the plan → update the Issue body to match, and add a comment
  explaining why, so the edit is not silent history rewriting.
- A decision deviates from the ticket → comment on the Issue rather than editing the plan into
  agreement with what you happened to do (`AGENTS.md`, ticket workflow).
- A new ADR affects future tickets → update those tickets in the plan *and* their Issues.
