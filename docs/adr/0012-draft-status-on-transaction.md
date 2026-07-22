# ADR-0012 — Draft status on the transaction instead of an import table

**Status:** Accepted
**Date:** 2026-07-22

## Context

Entries created by voice need human review before affecting balances and reports.

The initial proposal was a `VoiceImport` table holding the raw transcript, the extracted payload and a status, with transactions created only after approval.

## Decision

There is no import table. The transaction itself carries two fields:

- `status`: `DRAFT` or `CONFIRMED`
- `source`: `MANUAL`, `VOICE` or `RECURRING`

Voice entries start as `DRAFT` and are edited in place until confirmed. Transcripts are not persisted.

## Alternatives considered

| Alternative | Why it was rejected |
|---|---|
| A `VoiceImport` table | Would duplicate the transaction structure; reprocessing old transcripts is YAGNI for a personal app |
| A generic staging table | The same duplication with more indirection |
| Creating records only after approval, holding everything in frontend state | Work would be lost on page reload |

## Consequences

### Positive
- One fewer table and no duplicated structure
- A draft is editable through the same form as a normal entry
- `source` allows filtering the origin of any entry

### Negative
- **Every balance and report query must filter `status = CONFIRMED`**
- Validation must be relaxed on creation and complete on confirmation
- Transcripts are unavailable for auditing

### Risks and mitigations
- Forgetting the status filter and silently corrupting every total → a default repository scope applying `status = CONFIRMED`, plus integration tests explicitly asserting that `DRAFT` records do not affect balances
