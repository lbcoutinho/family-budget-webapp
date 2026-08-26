---
name: create-issue
description: Create well-scoped issues with titles, body templates, and labels. Use when asked to create an issue.
---

## Issue title
- Short sentence describing the issue. Use imperative mood: "add", "fix", "remove" — not "added", "adds", "adding"
- No trailing period

## Issue body

Use the matching template. List every independently verifiable outcome supported by the request; do not leave placeholder checkboxes.

### New Feature

```markdown
## What to build

Describe the user-facing capability and the problem it solves.

## Acceptance criteria
```

### Bug

```markdown
## Actual behavior

Describe what happens and its impact.

## Expected behavior

Describe what should happen instead.

## Steps to reproduce

1. ...
2. ...

## Acceptance criteria
```

### Enhancement

```markdown
## Current behavior

Describe the limitation in the existing experience.

## Proposed change

Describe the user-facing improvement.

## Acceptance criteria
```

## Notes

- Acceptance criteria should be list with checkboxes with every independently verifiable outcome supported by the request.
- If the request cannot produce a concrete acceptance criterion, ask one decision-rich question and wait before creating the issue.

## Labels

Decide labels from the request. Can have one or multiple.
1. Layers
- `backend`
- `frontend`
- `infra`
2. Nature
- `enhancement`
- `new-feature`
- `bug`
- `prototyping`
- `documentation`

## Boundaries

Only defines the format and conventions for new issues. Do not define how and where issues are created.
