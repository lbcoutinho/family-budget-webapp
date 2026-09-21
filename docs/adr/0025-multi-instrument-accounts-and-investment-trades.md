# ADR-0025 — Multi-instrument accounts and investment trades

**Status:** Accepted
**Date:** 2026-09-21

## Context

An Account can represent a bank, broker, cryptocurrency exchange, or cold wallet. Brokerage and custody Accounts may hold several currencies and investment assets at once: for example, EUR can be transferred into an exchange, traded for USDC, and later traded for BTC while a fee is paid in BNB. Modeling each currency as a separate Account fragments one custody location, and putting these operations in `Transaction` would mix the budget ledger with quantities, listings, prices, and fee assets that do not apply to income or expenses.

ADR-0005 assumes one currency and integer cents everywhere. That remains appropriate for the EUR budget ledger, but it cannot represent fractional asset quantities, unit prices, exchange rates, or stablecoins with more than two decimal places.

## Decision

An Account is a custody location that holds one or more Instruments. Instruments include fiat currencies, stablecoins, cryptocurrencies, stocks, ETFs, and ETCs. Each Account type constrains which Instruments it may hold; simple bank Accounts remain single-currency while exchange and wallet Accounts may hold several Instruments.

The balance of an Account is a set of exact quantities keyed by Account and Instrument. Existing initial EUR balances migrate to an EUR Instrument balance. Investment positions remain associated with the Account that holds them, including self-custodied wallet Accounts without a Financial Institution.

`Transaction` remains the EUR budget ledger for income, expenses, transfers, and cashbox movements. Funding an investment Account remains a Transfer and does not count as an investment purchase.

`InvestmentTrade` is separate from `Transaction`. One trade occurs inside one Account and records one acquired Instrument, one disposed Instrument, and optionally one Instrument paid as a fee. This single shape represents fiat-to-stablecoin conversion, purchases, sales, and crypto-to-crypto exchange. A trade counts toward the Investment Purchase Amount only when it acquires an Investment Asset.

Investment quantities support up to 18 decimal places. Unit prices and exchange rates support up to 12 decimal places. These fixed-precision values cross JSON boundaries as strings, never binary floating-point numbers. Budget amounts and consolidated EUR results continue to use integer cents under ADR-0005.

`BalancesService` derives Instrument Balances from initial balances, `Transaction`, `InvestmentTrade`, and explicit reconciliation adjustments. It returns quantities only; cost basis, market quotes, and EUR valuation remain outside its interface.

This ADR narrows ADR-0005: integer cents remain the monetary representation for the EUR budget ledger and consolidated EUR results, while instrument quantities, unit prices, and exchange rates use exact fixed-precision decimals.

## Alternatives considered

| Alternative | Why it was rejected |
|---|---|
| One currency per Account | Splits one exchange or wallet into artificial Accounts and still cannot naturally locate its investment assets. |
| A separate Currency Exchange entity | EUR-to-USDC and USDC-to-BTC have the same acquired/disposed/fee shape; two concepts would duplicate rules. |
| Add investment columns and types to `Transaction` | Produces a wide table of unrelated nullable fields and couples the budget ledger to investment rules. |
| Replace every operation with a generic double-entry ledger | Rewrites the working budget model and exposes accounting machinery the requested features do not need. |
| Binary floating-point quantities | Cannot represent money, fractional assets, or repeated cost-basis calculations exactly. |

## Consequences

### Positive

- One Account accurately represents one custody location and all Instruments held there.
- Currency conversion, purchases, sales, and third-Instrument fees use one trade rule.
- The budget ledger remains focused on cash-basis income, expenses, transfers, and reports.
- Balances have one small interface even though their implementation aggregates multiple sources.

### Negative

- Account balance APIs and screens must evolve from one EUR integer to multiple Instrument quantities.
- Existing initial balances require migration to EUR Instrument balances.
- Consolidated totals require a Market Quote into EUR and must expose stale or missing quotes.
- Decimal strings require explicit parsing and arithmetic in every investment calculation.

### Risks and mitigations

- Instrument precision may be lost at a JSON or JavaScript boundary → serialize fixed-precision values as strings and test round trips.
- A trade could dispose more than the Account holds → reject negative non-bank Instrument Balances; short positions require a later decision.
- The same value could be counted as both funding and investment → Transfers never contribute to Investment Purchase Amount; only qualifying `InvestmentTrade` records do.
- Valuation failures could block balance reads → balances return quantities without calling the quote provider; valuation handles missing or stale quotes separately.
