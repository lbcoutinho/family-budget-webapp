# 15 — CSV transaction import (`/transactions/import`)

**Prototype ticket:** #228. **Implementation tickets:** #231 and #232.

| Action | Result |
| --- | --- |
| Import CSV from Transactions | Opens import; without a saved model, routes to Settings › General |
| Select model, active account, and file | Generates a preview without writing transactions |
| Toggle a new row | Includes or excludes it; duplicate and invalid rows stay disabled |
| Confirm import | Revalidates and atomically creates selected rows as drafts |
| Expand a result group | Shows original line numbers and invalid reasons |
| Return to Transactions | Leaves the completed result and returns to the ledger |

Desktop and phone keep the preview as a horizontally scrollable table with its selection column
frozen. Status and error messages use live regions; dialogs move focus inside and restore it to the
trigger. See Plan 0002 §9 and `prototypes/approved/15-transaction-import.html`.
