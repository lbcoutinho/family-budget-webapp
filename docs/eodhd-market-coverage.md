# EODHD Market Coverage

**Status:** Validated on 2026-09-21 with the configured EODHD free-plan key.

This check deliberately introduces no provider abstraction or synchronization code. It validates the symbols and endpoint that a later market-data implementation can use.

## Coverage matrix

The `GET /api/eod/{symbol}?from=2026-09-18&to=2026-09-18&fmt=json` endpoint returned HTTP 200 and one daily bar for every supported row below. The exchange-symbol lists authenticated with the same key identified the listing metadata before the endpoint check.

| Planning instrument | Provider symbol | Listing / quote currency | Endpoint result                                                  |
| ------------------- | --------------- | ------------------------ | ---------------------------------------------------------------- |
| IWDA                | `IWDA.AS`       | Euronext Amsterdam / EUR | Supported                                                        |
| EUNL                | `EUNL.XETRA`    | XETRA / EUR              | Supported                                                        |
| IMAE                | `IMAE.AS`       | Euronext Amsterdam / EUR | Supported                                                        |
| SXR8                | `SXR8.XETRA`    | XETRA / EUR              | Supported                                                        |
| 8PSB                | `8PSB.XETRA`    | XETRA / EUR              | Supported                                                        |
| BTC                 | `BTC-USD.CC`    | CC / USD                 | Supported                                                        |
| ETH                 | `ETH-USD.CC`    | CC / USD                 | Supported                                                        |
| SOL                 | `SOL-USD.CC`    | CC / USD                 | Supported                                                        |
| LINK                | `LINK-USD.CC`   | CC / USD                 | Supported                                                        |
| AAVE                | `AAVE-USD.CC`   | CC / USD                 | Supported                                                        |
| ADA                 | `ADA-USD.CC`    | CC / USD                 | Supported                                                        |
| NEAR                | `NEAR-USD.CC`   | CC / USD                 | Supported                                                        |
| USD to EUR          | `USDEUR.FOREX`  | FOREX / EUR              | Supported; multiply USD quotes by this rate                      |
| EUR to USD          | `EURUSD.FOREX`  | FOREX / USD              | Supported reciprocal cross-check; not required for EUR valuation |

`SXR8` appeared twice in the supplied planning list and is intentionally represented once.

## Unsupported or ambiguous symbol

| Planning instrument | Result                                                                                                                                                                                        | Fallback                                                                                                                                                                                |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| POL                 | `POL-USD` was absent from the authenticated `CC` symbol list and `POL-USD.CC` returned HTTP 200 with an empty array. Do not silently substitute `MATIC-USD` or another Polygon-related token. | Save a manual USD or EUR Market Quote with its market date and source. Recheck the `CC` symbol list before enabling automatic coverage if a specific provider symbol becomes available. |

## Free-plan contract and synchronization implications

- The validated key reports a 20-call daily allowance. After exhausting that daily allowance during this validation, two successful EOD calls reduced its extra-call balance from 500 to 498 while the daily counter remained at 20. Extra API Calls are consumed only after the daily allowance and are available to buy in 100,000-call bundles for €5; they do not extend the one-year historical-data limit. EOD, live-delayed, exchange-symbol-list, and failed symbol lookups each cost one call; the daily counter resets at midnight GMT. A daily refresh of the 12 supported assets plus `USDEUR.FOREX` costs 13 calls, leaving seven calls for retries. Refreshing all four exchange lists costs four further calls and should be done only when adding or repairing a listing.
- The free plan exposes EOD history for any ticker only for the previous year. It cannot backfill the portfolio history that starts in 2021; imported trades must keep their supplied execution-time EUR values instead of deriving historic values from EODHD.
- The EOD endpoint is the validated contract for the initial daily quote sync. EODHD publishes exchange-traded EOD data 2–3 hours after the relevant market closes. The Live (Delayed) endpoint is available on the free plan and costs one call per symbol; its stock quotes are delayed 15–20 minutes, while the provider describes the snapshot as refreshing about once a minute. A later implementation must display the provider timestamp and never label this as real-time.
- Crypto and forex trade 24/7. Their current UTC-day EOD bar is partial, while an ETF's latest bar is its previous completed market session. Treat the UTC date of a crypto/forex bar as an in-progress day until it closes; do not compare it as a settled daily close with an ETF bar from the same calendar date.
- On a missing or failed automatic quote, preserve the last valid quote, mark its date and status stale, and show a warning rather than erasing the EUR valuation. A manual quote remains the fallback for unsupported listings such as `POL`.

## Sources

- [EOD historical data API](https://eodhd.com/financial-apis/api-for-historical-data-and-volumes) — endpoint contract, free-plan history limit, EOD publication timing, and 24/7 UTC-day behavior.
- [API limits](https://eodhd.com/financial-apis/api-limits) — per-endpoint call cost, daily reset, and usage endpoint.
- [Live (Delayed) API](https://eodhd.com/financial-apis/live-ohlcv-stocks-api) — delayed-quote contract and timing.
- [Supported crypto currencies](https://eodhd.com/financial-apis/list-supported-crypto-currencies) — `CC` symbol discovery and cryptocurrency pair syntax.
