# Family Budget

The shared language for a personal and family budget managed on a cash basis. It records where money is, why it moved, and the accounting month in which it belongs.

## Money locations

**Account**:
Any place that can receive income and pay expenses, such as a bank account, cash envelope, meal card, or wallet.
_Avoid_: Bank account (when referring to every money location)

**Cashbox**:
Money reserved for a purpose and held separately from Accounts. It has its own balance and is funded or withdrawn through Cashbox Movements.
_Avoid_: Category, expense

**Initial Balance**:
The amount already held in an Account before its first recorded Transaction.

## Ledger

**Transaction**:
A single recorded movement of money in the budget.
_Avoid_: Entry, ledger line

**Income**:
A Transaction that adds money to an Account.
_Avoid_: Revenue

**Expense**:
A Transaction that removes money from an Account in exchange for a purchase or obligation. It is the only Transaction type counted as an expense in reports.
_Avoid_: Cashbox deposit

**Transfer**:
A Transaction that moves money from one Account to another without changing the total held in Accounts.
_Avoid_: Expense, income

**Cashbox Movement**:
A Transaction that deposits money into a Cashbox, withdraws it to an Account, or transfers it between Cashboxes. It is not an Expense.
_Avoid_: Cashbox category

## Classification and accounting time

**Category**:
A top-level classification for Income or Expense Transactions.

**Subcategory**:
A second-level classification within a Category.

**Transaction Date**:
The day on which the underlying financial event happened.
_Avoid_: Reference month

**Settlement Date**:
The day a Transaction affects Account and Cashbox balances. It equals the Transaction Date for a non-card Transaction and cannot precede it for a credit-card Transaction.
_Avoid_: Reference month

**Reference Month**:
The first day of the Settlement Date's month, used to group a Transaction in the monthly view and reports. It is derived, never chosen independently.
_Avoid_: Transaction date

## Confirmation

**Draft Transaction**:
A Transaction awaiting review that does not affect balances or reports.

**Confirmed Transaction**:
A Transaction accepted into the budget that affects balances and reports.
