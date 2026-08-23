# 15 — CSV transaction import

Status: **approved** in `approved/15-transaction-import.html`, issue #228.

## Question

Variant A was approved: preview-first, with source controls above the table. Variants B and C were discarded.

## Fixed by Plan 0002

- Model, active account, and CSV file are required.
- New rows start selected; duplicate and invalid rows are visible but disabled.
- A preview writes nothing. Imported rows are drafts.
- No importable selection disables confirmation and explains why.
- The result reports imported, duplicate, invalid, and user-excluded counts with expandable detail.
- The mobile preview remains a horizontally scrolling table with the selection column frozen.
