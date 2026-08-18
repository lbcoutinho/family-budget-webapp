---
name: create-issue
description: Create or mirror a single ticket/issue. Use to create an issue by user request or use to mirror issue from project's plan/spec documents onto GitHub.
model: haiku
---

# Usages

Two possible scenarios:
1. User asks for a new ticket/issue to register a future task
2. User asks to create/mirror an issue that is present in a plan stored in the project files

To identify which scenario you're in:

1. Grep `plans/milestones/*.md` and `docs/superpowers/specs/*.md` for the given task heading (`M<N>-T<NN> — <title>`).
2. If found then this is scenario #2 otherwise it's scenario #1

Independently of the scenario:
- Apply labels
- Link to the associated Milestone when mirroring from a plan/spec
- Use `rtk gh` CLI for all operations (or directly `gh` CLI if RTK fails)

## Scenario 1: User asks for a new ticket/issue

- Create the issue with section `### Why this is needed` and `### Implementation notes` followed by three empty placeholder headers:
  `## Implementation Plan`, `## Acceptance Criteria`, `## Tests`.
- The first two sections content should be derived from the conversation/brainstorming with the user. 
- If user request was too vague to derive content for the issue then suggest starting a brainstorming
- If a brainstorming is rejected then create the issue with:

```
### Why this is needed

<Summary of the user request>

### Implementation notes

Must do a brainstorming to understand the requirements
```


## Scenario 2: User asks to create/mirror a issue from a plan

`plans/milestones/*.md` and `docs/superpowers/specs/*.md` is the source of truth for a ticket's intent; the GitHub Issue is where the ticket is actually tracked.
GitHub itself is now authoritative for ticketed work — there is no local tracking file to keep in sync. The plan supplies the seed text for a new issue; once
the issue exists, it is worked and updated on GitHub directly.

1. Grep `plans/milestones/*.md` and `docs/superpowers/specs/*.md` for the given task heading (`## M<N>-T<NN> — <title>`).
2. Extract only the task's `### Why this is needed` and `### Implementation notes` subsections — nothing else from the task body.
3. Confirm the ticket doesn't already exist on GitHub Issue.
4. Create the issue:
    - **Title**: `M<N>-T<NN> — <title>` (em dash, as in the heading).
    - **Body**: the two extracted sections, verbatim, followed by three empty placeholder headers:
      `## Implementation Plan`, `## Acceptance Criteria`, `## Tests`.

## Mapping

| Plan                                                             | GitHub                                                                                                                                                |
|------------------------------------------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------|
| `# M<N> — <Name>` heading in the milestone file                  | Milestone titled `M<N> - <Name>` (hyphen, not em dash), described by the milestone's **Goal** and **Definition of done**                              |
| `## M<N>-T<NN> — <title>` section                                | Issue titled `M<N>-T<NN> — <title>` (em dash, as in the heading)                                                                                      |
| The task's `### Why this is needed` + `### Implementation notes` | Issue body, copied **verbatim**, followed by empty `## Implementation Plan`, `## Acceptance Criteria`, `## Tests` headers, assigned to that Milestone |

Fill in `## Acceptance Criteria` and `## Tests` as unchecked boxes once the implementation plan is known. They are the ticket's definition of done, and checking
them off as the work lands is how the issue stays useful during review.

## Labels

Apply labels corresponding to the layer the task touches, by judgment from the implementation notes. A task can carry one or multiple.

- `backend`
- `frontend`
- `ìnfra`
- `prototyping`
- `documentation` 