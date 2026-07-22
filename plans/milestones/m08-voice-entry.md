# M8 — Voice entry

**Goal:** read the bank statement aloud and have the entries extracted, reviewed and approved.

**Definition of done:** the user records a month's statement by speaking, then approves the entries in bulk after review.

**Depends on:** M5 complete.

> No voice-created entry affects a balance or a report before manual approval. Every one starts with `status = DRAFT`.

---

## M8-T01 — Audio capture and transcription

### Why this is needed
The first stage of the flow. Isolated behind an interface so the provider can be swapped without touching anything else.

### Implementation notes
- A `TranscriptionProvider` interface with a `WebSpeechProvider` implementation
- Web Speech API with `lang: 'pt-BR'`, continuous mode and interim results
- Recording component with idle, listening and processing states
- Partial transcript displayed live
- Detection of an unavailable API, falling back to pasted text input
- Denied microphone permission handled with a clear message
- Pause and clear controls

### Acceptance criteria
- [ ] Recording starts and stops from the UI controls
- [ ] Partial text appears while speaking
- [ ] A browser without support shows the text fallback
- [ ] Denied permission shows guidance
- [ ] The accumulated transcript can be edited manually before submission

### Tests
- Unit with a mocked Web Speech API: recording lifecycle; result accumulation; fallback; denied permission

---

## M8-T02 — LLM parsing endpoint

### Why this is needed
Turns free text into structured entries. It needs its own pull request for the prompt and output validation.

### Implementation notes
- `POST /transactions/parse` accepting `{ transcript }`
- The API key lives **exclusively on the backend** and is never exposed to the client
- Prompt includes the user's context: active accounts, categories and cashboxes with their ids
- Structured output validated; any item that fails validation is discarded with its reason logged
- Response: a list of candidate entries with a confidence level and any unresolved fields
- Relative dates ("the 5th") resolved against the supplied reference month
- Euro amounts converted to cents
- Timeout and provider-failure handling
- Rate limiting on the endpoint

### Acceptance criteria
- [ ] A transcript with several entries returns several candidates
- [ ] An unidentified category comes back null rather than invented
- [ ] Amounts are converted correctly to cents
- [ ] Relative dates resolve against the reference month
- [ ] Invalid model output does not break the request
- [ ] The API key never appears in a response or a log
- [ ] Provider failure returns a handled 503

### Tests
- Unit with a mocked provider: multi-item parsing; unresolved field; amount conversion; malformed output
- Integration: the full endpoint against the mock; rate limiting

---

## M8-T03 — Draft persistence

### Why this is needed
Materializes the candidates as `DRAFT` transactions, guaranteeing they affect nothing until approved.

### Implementation notes
- `POST /transactions/bulk-draft` creating several `DRAFT` transactions in one database transaction
- `source = VOICE`
- **Relaxed validation**: a draft may have required fields empty, to be completed during review
- **Full validation applied only at confirmation**
- `GET /transactions?status=DRAFT` for listing
- `POST /transactions/:id/confirm` applying the M4-T02 validator
- `POST /transactions/bulk-confirm` for bulk approval
- Confirming a `CASHBOX_OUT` checks the balance at approval time, not at creation time

### Acceptance criteria
- [ ] Drafts are created in bulk
- [ ] An incomplete draft is accepted on creation
- [ ] Confirming an incomplete draft returns 400 naming the missing fields
- [ ] Drafts affect neither balances nor reports
- [ ] Bulk confirmation is atomic: if one fails, it reports which and confirms none
- [ ] Discarding a draft removes it permanently

### Tests
- Unit: relaxed versus full validation
- Integration: bulk creation; individual and bulk confirmation; no effect on balances; bulk atomicity

---

## M8-T04 — Draft review screen

### Why this is needed
Where the user corrects whatever the model got wrong. It is also the system's deduplication mechanism (see ADR-0013).

### Implementation notes
- `/voice` route holding the recorder and the candidate list
- Each candidate rendered as an inline-editable row
- Unresolved fields highlighted
- Low confidence flagged
- Per-row actions: edit, discard, approve
- Bulk actions: approve all valid, discard all
- Counters for valid and pending items
- **Possible-duplicate warning**: client-side comparison against existing entries in the month (same date and amount), non-blocking
- Leaving the screen with pending drafts asks for confirmation

### Acceptance criteria
- [ ] Candidates are listed after transcription
- [ ] Missing fields are highlighted
- [ ] Inline edits persist to the draft
- [ ] Bulk approval confirms only the valid entries
- [ ] A possible duplicate is flagged without preventing approval
- [ ] Approved entries leave the list and appear on the monthly tab
- [ ] Leaving with pending drafts asks for confirmation

### Tests
- Integration with MSW: full flow from transcription through candidates and editing to approval; missing-field highlighting; duplicate detection; partial bulk approval
