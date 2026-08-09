# 13 — Voice entry (`/voice`)

**Ticket:** M8-T01, M8-T04

| Action | Result |
| --- | --- |
| Record / pause / clear | Live partial transcript |
| Edit the transcript | Free text, correctable before extraction |
| Extract | Candidates persisted as `DRAFT` |
| Edit a candidate inline | Saved onto the draft |
| Discard / approve a row | Removes it, or validates and confirms it |
| Approve all valid | Confirms only the complete ones, atomically |

Recording and review live on one route, stacked. Rows with missing fields are highlighted amber
with the approve button disabled; a likely duplicate (same date and amount already in the month)
is flagged but never blocked. Nothing here affects a balance or a report before approval. Leaving
with pending drafts asks for confirmation, and the drafts survive either way. A browser without
the Web Speech API falls back to a text box; a denied microphone permission explains how to
restore it.
