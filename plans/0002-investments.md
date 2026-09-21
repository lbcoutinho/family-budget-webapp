# Plan 0002 — Investments

**Status:** Specified
**Parent issue:** [#392](https://github.com/lbcoutinho/family-budget-webapp/issues/392)
**Last updated:** 2026-09-21

## Problem Statement

The application records a Transfer into a brokerage or exchange Account, but cannot record what happens after the money arrives. A €3,000 transfer is funding, not an investment: the user may leave it untouched and buy assets gradually over several months. Without Investment Trades, the application cannot distinguish idle cash from invested capital, reconcile custody locations, calculate positions and weighted-average cost, or report the amount actually invested each month.

The user currently maintains purchases and sales in spreadsheets with instrument code, institution, market, execution date, transaction value, quantity, execution price, fees, notes, current quote, allocation, and profit or loss. The cryptocurrency exchange export represents one trade as separate acquired, disposed, and fee rows, sometimes using a third Instrument such as BNB for the fee. Historical records begin in 2021 and cannot reasonably be entered manually.

## Solution

Add an Investments area based on ADR-0025. An Account becomes a custody location that may hold one or more Instruments. A Transfer continues to fund an Account without counting as an investment. An Investment Trade exchanges one acquired Instrument for one disposed Instrument inside the same Account and may pay its Trade Fee with a third Instrument.

The application derives Instrument Balances, Investment Positions, weighted-average cost, realized and unrealized result, current EUR valuation, and monthly investment flow. It supports manual entry and a fixed normalized CSV import with preview, duplicate protection, reconciliation, and whole-batch rollback. Current market quotes come from EODHD when configured, with manual quotes and visible stale states as fallbacks.

V1 uses tables and totals only. Every Investments screen requires an approved disposable prototype before implementation.

## User Stories

1. As a user, I want a Transfer to a brokerage or exchange Account to remain funding, so that it is not reported as an Expense or investment purchase.
2. As a user, I want to see uninvested money held at an exchange, so that transferred cash does not disappear before I buy an asset.
3. As a user, I want one Account to hold several Instruments, so that one exchange or cold wallet is not fragmented into artificial Accounts.
4. As a user, I want ordinary bank Accounts to remain simple, so that multi-instrument custody does not complicate everyday budgeting.
5. As a user, I want Accounts grouped by Financial Institution, so that balances belonging to the same bank, broker, or exchange are recognizable together.
6. As a user, I want a cold wallet represented without a Financial Institution, so that self-custodied assets still have a custody location.
7. As a user, I want to register fiat currencies, stablecoins, cryptocurrencies, stocks, ETFs, and ETCs, so that the Instruments I actually hold are represented.
8. As a user, I want an Investment Asset separated from its market-specific Asset Listings, so that the same ISIN can be traded under different tickers and exchanges.
9. As a user, I want to record the Instrument acquired and quantity received, so that purchases and currency conversions increase the correct balance.
10. As a user, I want to record the Instrument disposed and quantity spent, so that purchases, sales, and conversions reduce the correct balance.
11. As a user, I want to record a Trade Fee in either currency or another Investment Asset, so that fees such as BNB are reflected accurately.
12. As a user, I want EUR-to-USDC represented by the same trade model as USDC-to-BTC, so that conversions and purchases follow one consistent rule.
13. As a user, I want every Investment Trade tied to one Account, so that I always know where the resulting assets are held.
14. As a user, I want the application to reject disposal of more units than an Account holds, so that long-only positions cannot become accidentally negative.
15. As a user, I want trade quantities and prices stored without floating-point loss, so that small cryptocurrency values remain exact.
16. As a user, I want four decimal places by default in summary tables, so that the interface remains readable.
17. As a user, I want full available precision in forms and operation details, so that displayed summaries never destroy underlying information.
18. As a user, I want Investment Trades stored in UTC and presented in Europe/Lisbon, so that operations are assigned to my local calendar correctly.
19. As a user, I want the application to derive an Execution Price from the acquired and disposed quantities, so that exchange exports do not require redundant data.
20. As a user, I want non-EUR operations to retain their EUR equivalent at execution, so that cost and result remain comparable in the Base Currency.
21. As a user, I want purchase fees included in weighted-average cost, so that the position reflects the full acquisition cost.
22. As a user, I want sale fees deducted from proceeds, so that realized result reflects what I actually received.
23. As a user, I want a sale to remove units at the existing weighted-average cost, so that selling does not distort the cost of units left behind.
24. As a user, I want a later purchase to recompute weighted-average cost from the remaining cost basis, so that historical sales do not re-enter the calculation.
25. As a user, I want a fee paid with an Investment Asset to reduce that asset's position, so that the physical quantity remains reconcilable.
26. As a user, I want asset-denominated fees to produce their own realized result, so that disposing of a fee asset is not hidden.
27. As a user, I want positions calculated separately per Account and Investment Asset, so that each custody location remains reconcilable.
28. As a user, I want positions consolidated across Accounts, so that I can see my total exposure to one Investment Asset.
29. As a user, I want the overview to show quantity, remaining cost, weighted-average price, current quote, current value, and profit or loss, so that it replaces my spreadsheet summary.
30. As a user, I want realized and unrealized results shown separately, so that completed gains do not distort open positions.
31. As a user, I want total result in EUR, so that Instruments quoted in different currencies can be compared.
32. As a user, I want Investment Purchase Amount based on purchases rather than Transfers, so that gradual investment after a large deposit is reported in the correct months.
33. As a user, I want monthly purchases, sales, Net Investment Flow, Trade Fees, and realized result, so that I can understand investment activity throughout a year.
34. As a user, I want to select a month from the annual flow table, so that I can inspect the operations behind its totals.
35. As a user, I want current Instrument Balances shown in their native units and as a current EUR equivalent, so that I can understand both custody and consolidated value.
36. As a user, I want the quote date visible, so that I know whether a valuation is current.
37. As a user, I want automatic quote synchronization after login when data is stale, so that a computer that was off for a week catches up when used again.
38. As a user, I want a failed or missing quote to preserve the last valid value with a warning, so that a provider outage does not erase my portfolio valuation.
39. As a user, I want retry synchronization to target only failed or missing quotes, so that it does not waste the provider's daily limit on successful results.
40. As a user, I want to enter a Market Quote manually, so that unsupported listings do not block portfolio use.
41. As a user, I want Investments to work without an EODHD key, so that automatic market data remains optional.
42. As a user, I want to import one normalized CSV row per Investment Trade, so that exports from different sources share one application format.
43. As a user, I want a documented CSV template, example, validation checklist, and GPT normalization prompt, so that I can transform my historical exports safely.
44. As a user, I want imported timestamps to include UTC explicitly, so that an exchange export cannot silently shift operations into the wrong month.
45. As a user, I want each imported operation to have a stable external identifier, so that reimporting the same history is rejected.
46. As a user, I want content fingerprints checked as well as external identifiers, so that the same trade cannot be imported under a different generated identifier unnoticed.
47. As a user, I want the whole CSV validated and simulated before anything is saved, so that one malformed row cannot leave a partial history.
48. As a user, I want calculated positions and balances compared with values I enter from the real exchange or wallet, so that missing historical operations become visible.
49. As a user, I want unexplained Investment Position differences recorded as explicit Position Adjustments, so that reconciliation does not fabricate purchases or sales.
50. As a user, I want unexplained currency differences recorded as explicit Balance Adjustments, so that reconciliation does not fabricate Income or Expense.
51. As a user, I want an imported batch recorded as one unit, so that I can audit when and from which file the history was loaded.
52. As a user, I want to preview the effect of rolling back an Import Batch, so that I understand which later positions will change.
53. As a user, I want to roll back an entire Import Batch, so that a systematic transformation mistake can be corrected safely.
54. As a user, I want to edit a historical manual Investment Trade, so that incorrect data can be repaired.
55. As a user, I want later positions and results recalculated after a historical edit or rollback, so that derived values never retain stale calculations.
56. As a user, I want referenced Institutions, Instruments, Asset Listings, and Accounts deactivated rather than deleted, so that historical operations remain readable.
57. As a user, I want one unified portfolio table filterable by Instrument type, Financial Institution, and Account, so that separate spreadsheet tabs are unnecessary.
58. As a user, I want no investment charts in V1, so that the first release focuses on trustworthy quantities and calculations.
59. As a user, I want prototypes approved before Investments screens are implemented, so that navigation and workflows are settled cheaply.
60. As a user, I want the existing budget reports to remain separate from investment market valuation in V1, so that current reports do not imply unavailable historical prices.

## Implementation Decisions

- ADR-0025 is authoritative: Accounts are custody locations, balances are keyed by Account and Instrument, and the EUR budget ledger remains separate from Investment Trades.
- Every new domain entity carries `userId`, and every read and mutation is scoped to the authenticated user.
- Instruments have a type: fiat, stablecoin, cryptocurrency, stock, ETF, or ETC. EUR remains the Base Currency.
- Financial Institutions minimally store identity, name, kind, active state, and ordering. An Account may omit the relationship for self-custody.
- Account kinds are bank, brokerage, exchange, wallet, and other. The kind controls valid Instrument combinations and available UI actions without introducing an `isMultiCurrency` flag.
- Existing Account initial balances migrate to EUR Initial Balances. Multi-instrument custody supports one Initial Balance per Account and Instrument.
- Investment Assets and Asset Listings are separate. A listing has its ticker, market, quote Instrument, optional ISIN, optional provider symbol, and active state. Multiple listings may point to one Investment Asset.
- `Transaction` keeps its existing budget semantics and schema responsibilities. It is not widened with investment-specific nullable fields.
- One Investment Trade belongs to one Account and contains acquired and disposed Instrument legs plus an optional Trade Fee leg. Each leg stores an exact quantity.
- Investment Trades have no draft state. Manual entries are confirmed immediately; imports are previewed before their atomic confirmation.
- Investment quantities support 18 decimal places. Unit prices and exchange rates support 12 decimal places. Fixed-precision values are serialized as strings, never JSON numbers.
- EUR budget values and consolidated EUR results remain integer cents. A non-EUR trade records the execution-time EUR equivalent or rate needed to derive it; historical cost never changes when current FX changes.
- Investment Trades store an execution instant in UTC. Investment months are derived in Europe/Lisbon and have no independent Reference Month.
- Funding is an existing Transfer. It changes Instrument Balances but never Investment Purchase Amount, Net Investment Flow, or Expense totals.
- `BalancesService` keeps the highest shared balance seam. Its interface returns exact quantities by Account and Instrument, optionally as of a time, and hides aggregation of Initial Balances, Transactions, Investment Trades, Position Adjustments, and Balance Adjustments.
- `BalancesService` never loads Market Quotes or calculates cost basis, realized result, or market value.
- The investment position module replays effective operations chronologically per Account and Investment Asset. It returns quantity, remaining cost basis, weighted-average cost, and realized result through one interface.
- A purchase adds its execution-time EUR value and Trade Fee value to the acquired position's cost. Weighted-average cost is remaining cost divided by remaining quantity.
- A sale removes sold quantity at the pre-sale weighted-average cost. Realized result is net EUR proceeds minus removed cost. The weighted-average cost of the remaining units is unchanged.
- A Trade Fee paid in an Investment Asset removes that quantity from its position, records the disposal result, and adds its execution-time EUR value to the acquired asset's cost when applicable.
- A pure currency or stablecoin conversion does not count as an Investment Purchase. V1 reports combined EUR result and does not attribute return separately to asset movement and FX movement.
- Long-only validation rejects a disposed or fee quantity greater than the available non-bank Instrument Balance. Bank fiat balances may remain negative under existing overdraft behavior.
- Position Adjustments are explicit, require a reason, never count as purchases or sales, and require EUR cost for an unexplained positive quantity. Negative adjustments remove units at the current weighted-average cost.
- Balance Adjustments reconcile currency Instrument Balances, require a reason, and never count as Income, Expense, Transfer, or investment activity.
- Historical edits, adjustment changes, and Import Batch rollback recalculate every later derived position affected by the change.
- The primary market-data implementation calls EODHD directly. Its server-side key is optional configuration; no provider-selection framework is introduced.
- Market Quotes store listing, quoted price and Instrument, market date, synchronization instant, source, and status. V1 retains the latest valid quote rather than a daily history.
- Automatic synchronization runs on the first authenticated use when quotes are stale. A retry action selects only missing or failed quotes and preserves every last valid quote on error.
- Manual quotes pass through the same valuation interface and remain available when EODHD is unconfigured or lacks a listing.
- The current EUR equivalent uses the latest available Instrument-to-EUR Market Quote and always displays its market date or stale state.
- The Investments navigation contains overview, operations, monthly flow, and import/reconciliation surfaces. Institutions, Instruments, and Asset Listings are secondary management actions inside Investments.
- The overview uses one table with type, institution, and Account filters. It shows native quantities and prices alongside EUR cost, value, and result.
- The monthly flow is an annual table with one row per month for Investment Purchase Amount, net sales, Net Investment Flow, Trade Fees, and realized result. Selecting a month filters its operations.
- Existing budget reports remain cash-focused and do not add historical investment market valuation in V1.
- The normalized CSV contains one row per Investment Trade with stable external ID, UTC execution instant, Account and Institution identity, acquired and disposed Instruments and quantities, optional listing, optional Trade Fee Instrument and quantity, required EUR execution values for non-EUR historical calculations, and optional notes.
- The normalization guide provides the fixed schema, a complete example, a checklist, and a reusable GPT prompt. Exchange-specific parsers are not built.
- The import preview parses and validates the entire file, groups no vendor-specific rows, computes duplicate fingerprints, simulates balances and positions, and reports all errors without writes.
- Import confirmation writes the valid batch atomically as confirmed operations. A failure writes nothing.
- External IDs are unique per source Institution. Content fingerprints provide a second duplicate warning for equivalent normalized trades.
- Reconciliation accepts manually entered real quantities and currency balances after simulation, then exposes differences without silently generating adjustments.
- Import Batch rollback is whole-batch only, requires impact preview and confirmation, and recalculates later positions. Partial rollback and transformation-rule editing are not supported.
- Referenced Accounts, Financial Institutions, Instruments, and Asset Listings are deactivated rather than deleted.
- Every new Investments screen is blocked on an approved disposable prototype covering its responsive behavior, states, and primary interactions.
- The OpenAPI document remains the contract source and the typed client is regenerated rather than edited manually.

## Testing Decisions

- The primary test seam is the authenticated HTTP interface backed by the test database. Tests create domain operations and assert observable balances, positions, flows, validation errors, and rollback results rather than internal query structure.
- Balance behavior is verified through the Accounts and Investments responses that consume `BalancesService`. Existing balance tests provide prior art for confirmed-only aggregation and source/destination signs.
- The investment position interface receives focused tests for chronological weighted-average calculations, partial sales, later purchases, third-Instrument fees, historical edits, and long-only rejection. These tests assert returned positions and results, not replay internals.
- The import interface is tested from uploaded normalized CSV through preview, atomic confirmation, duplicate rejection, reconciliation differences, and whole-batch rollback. Malformed input must leave the database unchanged.
- The EODHD dependency is a true external seam. Production uses one EODHD adapter; tests use a mock adapter for success, unsupported symbols, stale values, provider errors, and selective retry.
- Market valuation tests fix quote dates and rates explicitly. No test depends on the current network, wall clock, or live market price.
- Web integration tests cover the four Investments surfaces through generated client mocks, following the existing Testing Library and MSW patterns. They assert user-visible totals, filters, stale/error states, forms, preview, reconciliation, and confirmations.
- OpenAPI coverage verifies that fixed-precision values are strings and that regenerated client types preserve this contract.
- Migration verification proves that each existing Account receives the same EUR Initial Balance and that pre-investment budget balances remain unchanged.
- Prototype approval is a prerequisite, not a visual-regression substitute. Implementation tests cover behavior and accessibility after the approved design exists.

## Out of Scope

- Historical daily Market Quotes, historical valuation, charts, and immutable monthly investment closes.
- Allocation targets and rebalance recommendations.
- Separate attribution of asset return and FX return.
- Fiscal lots, short positions, and tax reports.
- Dividends, interest, staking, farming, and rewards.
- Splits, mergers, ticker changes, and other corporate actions.
- Transfers of Investment Assets between custody Accounts.
- Futures, options, and other derivatives.
- Multiple quote providers, fallback routing, intraday prices, and real-time prices.
- TER and distribution-policy tracking.
- Exchange-specific importers.
- Investment market valuation inside the existing historical budget reports.

## Further Notes

- This plan is the durable project specification. The GitHub parent issue contains only V1 and owns every later V1 prototype and implementation ticket as a sub-issue.
- The current spreadsheet screenshots are design references, not schemas. The approved prototypes decide the final presentation.
- Before market-data implementation, a short coverage check must verify the actual ETF listings, cryptocurrency pairs, and EUR conversion symbols against an EODHD free key.
- No V1 code may be implemented before the corresponding screen prototype is approved.

## Roadmap

### V2 — historical analysis, planning, and advanced accounting

V2 starts with a new grilling rather than inheriting silent assumptions from V1.

#### Historical Market Quotes and gap recovery

- Store daily close history rather than only the last valid quote.
- Recover days missed while the personal computer was off.
- Decide provider retention limits, backfill strategy, market calendars, 24/7 cryptocurrency day boundaries, and behavior when a historical quote cannot be found.
- Decide whether a corrected provider value rewrites history or creates a revision.

#### Historical portfolio evolution and immutable closes

- Graph portfolio value, cost basis, realized result, and Net Investment Flow over time.
- Decide whether history is recomputed from operations and quotes or read from explicit monthly close snapshots.
- Define how late imports and historical corrections affect a previously closed month.
- Define missing-quote behavior and how mixed market dates are disclosed.

#### Allocation targets and rebalancing

- Store desired allocation per Investment Asset or group.
- Calculate current allocation and value to buy or sell.
- Decide whether targets are global, per Account, per Instrument type, or hierarchical.
- Decide how uninvested currencies and Fee Assets participate in allocation totals.

#### Asset return versus FX return

- Decompose combined EUR result into local-market return and currency return.
- Example: ten $100 units bought when €1 = $1 later become $120 each while €1 = $1.20. The asset contributes +20%, FX offsets it, and combined EUR return is 0%.
- Decide the mathematical attribution method for cross terms and trades funded from previously converted currency balances.

#### Fiscal lots beyond weighted-average cost

- Preserve acquisition lots and support jurisdiction-specific disposal rules.
- Example: ten units at €100 plus ten at €200, then sale of fifteen at €250. Weighted average produces €1,500 profit; FIFO produces €1,750.
- Decide supported jurisdictions, FIFO versus specific identification, fee allocation, transfers between lots, and correction rules.

#### Short positions

- Model borrowed quantity, collateral, financing cost, margin, liquidation, and realized result.
- Revisit the V1 invariant that non-bank Instrument Balances cannot become negative.

#### Tax reports

- Define report jurisdiction, fiscal year, taxable events, FX rules, fee treatment, and evidence requirements.
- Determine whether generated reports are advisory summaries or filing-ready artifacts.

### V3 — income, custody, complex products, and richer market data

- Dividends and interest, including withholding and reinvestment.
- Staking, farming, airdrops, and other rewards.
- Splits, reverse splits, mergers, ticker changes, spin-offs, and other corporate actions.
- Transfers of Investment Assets between exchanges, brokers, and wallets with preserved cost basis.
- Futures, options, and other derivatives.
- Multiple quote providers, coverage fallback, conflict resolution, and provider health.
- Intraday or real-time quotes and their licensing, refresh, and rate-limit implications.
- TER and distribution-policy metadata when portfolio analysis uses them.

### Deliberately not planned

- Vendor-specific exchange or brokerage importers. The normalized application CSV remains the supported seam unless repeated use proves a dedicated adapter necessary.
