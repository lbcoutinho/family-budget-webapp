---
name: create-pr
description: Template for creating a pull request (PR). Use this whenever opening pull requests or asked to draft/write/open/create a PR.
---

# PR title

Conventional Commits format. No fluff. Why over what.

- `<type>(<scope>): <imperative summary>` — `<scope>` optional
- Types: `feat`, `fix`, `refactor`, `perf`, `docs`, `test`, `chore`, `build`, `ci`, `style`, `revert`
- Imperative mood: "add", "fix", "remove" — not "added", "adds", "adding"
- ≤50 chars when possible, hard cap 72
- all lowercase, no trailing period

# PR description format

Every PR body most follow the format below. Fill in the placeholders — don't invent new section headings, and drop a section only if it is genuinely empty (e.g.
no ADR-worthy decisions were made).

```markdown
Closes #<issue-number>.

<A short paragraph on what this PR prepares/delivers and why, in plain language.>

#### Decisions worth a look

<Detailed on issue #<issue-number>; the short version:>

1. <Decision + the constraint or trade-off that forced it.>
2. <Decision + why the alternative was rejected.>
3. <Any naming/scoping choice made to keep a later ticket's plan working verbatim.>
4. <Any version pin and why (e.g. toolchain compatibility).>
5. <Anything intentionally deferred to a later ticket, and which one.>

#### Verification

<How this was checked — commands run and their expected/actual result. If no automated tests apply yet, say so explicitly and list the manual checks instead.>

- `<command>` → `<expected output>`
- `<command>` → `<expected output>`

---

🤖 Built with <models used in commits>
```

## Notes

- "Decisions worth a look" is for choices a reviewer wouldn't expect from the ticket alone (trade-offs, deferred work, version pins)
- Read commit messages for Co-Authored-By trailers and replace in <models used in commits>
- Keep "Verification" honest: if nothing was actually run, say so instead of listing commands that weren't executed.
- Link Milestones to PRs.
- Copy labels from ticket associated. If no ticket, add labels to indicate what kind of work was done: backend, frontend, bug, documentation, prototyping, enhancement
- After push, check "Acceptance criteria" in issue body and parent issue body and mark the checkboxes for validations done
