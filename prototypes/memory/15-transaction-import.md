# 15 — CSV transaction import

Status: **under review** in `15-transaction-import.html`, issue #228.

## Question

Which structure makes row selection, exceptions, and confirmation clearest: preview-first (A), a
guided sequence (B), or a split workspace (C)?

## Fixed by Plan 0002

- Model, active account, and CSV file are required.
- New rows start selected; duplicate and invalid rows are visible but disabled.
- A preview writes nothing. Imported rows are drafts.
- No importable selection disables confirmation and explains why.
- The result reports imported, duplicate, invalid, and user-excluded counts with expandable detail.
- The mobile preview remains a horizontally scrolling table with the selection column frozen.
