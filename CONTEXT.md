# Family Budget

The shared language for a personal and family budget managed on a cash basis. It records where money and investment assets are held, why money moved, and the accounting month in which it belongs.

## Money locations

**Account**:
A place where one or more Instruments are held, such as a bank account, brokerage or exchange account, cash envelope, meal card, or cold wallet.
_Avoid_: Bank account (when referring to every Account), Financial Institution

**Cashbox**:
Money reserved for a purpose and held separately from Accounts. It has its own balance and is funded or withdrawn through Cashbox Movements.
_Avoid_: Category, expense

**Initial Balance**:
The quantity of an Instrument already held in an Account before its first recorded operation.

**Instrument**:
Something measured in units and held in an Account, including fiat currency, stablecoin, cryptocurrency, stock, ETF, or ETC.
_Avoid_: Investment Asset (when referring to currencies and assets together)

**Instrument Balance**:
The quantity of one Instrument held in one Account, derived from its Initial Balance and recorded operations.
_Avoid_: Market value, Investment Position

**Base Currency**:
Euro, the currency into which other currencies are converted for consolidated balances and reports.
_Avoid_: Account currency

**Financial Institution**:
A bank, broker, or cryptocurrency exchange that holds one or more Accounts.
_Avoid_: Account

## Investments

**Investment Asset**:
A non-fiat Instrument held for investment, such as a stock, ETF, ETC, or cryptocurrency.
_Avoid_: Item, token (when referring to every asset type)

**Asset Listing**:
A market-specific listing of an Investment Asset, identified by its ticker and market. Multiple listings may represent the same underlying asset.
_Avoid_: Investment Asset

**Investment Trade**:
An exchange within one Account consisting of one acquired Instrument, one disposed Instrument, and optionally one Instrument paid as a Trade Fee. It represents currency conversion, purchase, or sale without being an Expense or Transfer.
_Avoid_: Transaction, contribution, Currency Exchange

**Investment Position**:
The quantity and remaining cost basis of one Investment Asset held in one Account, derived from its recorded operations.
_Avoid_: Account balance

**Position Adjustment**:
An explicit reconciliation between a calculated Investment Position and a verified real quantity when the missing history cannot be reconstructed. It is neither a purchase nor a sale.
_Avoid_: Investment Trade

**Investment Funding**:
A Transfer that moves a currency Instrument into an Account for future Investment Trades. It does not itself acquire an Investment Asset.
_Avoid_: Investment, Expense

**Investment Purchase Amount**:
The value in the Base Currency spent on Investment Trades that acquire Investment Assets during a period, including purchase fees. It excludes Investment Funding.
_Avoid_: Transfer amount, Account funding

**Net Investment Flow**:
Investment Purchase Amount minus net sale proceeds in the Base Currency during a period.
_Avoid_: Remaining cost basis

**Execution Price**:
The amount of the disposed Instrument per unit of the acquired Instrument in an Investment Trade.
_Avoid_: Market quote

**Market Quote**:
An observed market price per unit of one Instrument, expressed in another Instrument at a stated time.
_Avoid_: Execution price

**Trade Fee**:
A quantity of an Instrument paid as a charge attached to an Investment Trade.
_Avoid_: Expense Transaction

**Fee Asset**:
An Investment Asset held primarily to pay Trade Fees. Its position and cost basis remain tracked even when it is hidden from the main portfolio view.

**Balance Adjustment**:
An explicit reconciliation between a calculated currency Instrument Balance and a verified real quantity when the missing history cannot be reconstructed. It is neither Income nor Expense.
_Avoid_: Transaction correction

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
The first day of the accounting month, used to group a Transaction in the monthly view and reports. It may differ from the Settlement Date and is chosen independently when needed.
_Avoid_: Transaction date

## Planning

**Budget**:
A User-owned plan for one calendar quarter. It stores expected Income and planning notes; it does not move money, change Transactions, affect reports, alter Account balances, or set a Cashbox target.
_Avoid_: Transaction, report, Account balance, Cashbox target

## Confirmation

**Draft Transaction**:
A Transaction awaiting review that does not affect balances or reports.

**Confirmed Transaction**:
A Transaction accepted into the budget that affects balances and reports.
