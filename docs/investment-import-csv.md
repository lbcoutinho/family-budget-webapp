# Normalized investment CSV

Use UTF-8 CSV with a comma delimiter and exactly one row per Investment Trade. Timestamps must be UTC (`Z`); quantities are exact decimal strings. Keep the original export unchanged and write preparation and enriched results to separate files using the same columns below.

## Preparation versus import-ready files

- **Preparation:** preserve known fee instruments and exact fee quantities even when `fee_value_eur_cents` is unknown. Leave unknown EUR values blank and report them separately. This intermediate file is not import-ready; the current importer rejects partially populated fees and missing execution values.
- **Import-ready:** every execution has a positive integer EUR cents value. Each fee has all three fields populated, or all three blank only when the source confirms there was no fee. Missing information must not be disguised as no fee, zero, or an invented value.

The rules in the table describe the import-ready contract. Enrichment supplies historical valuations; normalization alone must not guess them.

```csv
external_id,executed_at_utc,institution,account,acquired_instrument,acquired_quantity,disposed_instrument,disposed_quantity,fee_instrument,fee_quantity,fee_value_eur_cents,asset_listing_ticker,asset_listing_market,execution_value_eur_cents,notes
kraken-2021-0001,2021-05-14T09:32:00Z,Kraken,Kraken Spot,BTC,0.0042,EUR,180,,,,BTC,KRKN,18000,First purchase
```

| Column                      | Rule                                                                                |
| --------------------------- | ----------------------------------------------------------------------------------- |
| `external_id`               | Stable non-empty source operation identifier.                                       |
| `executed_at_utc`           | ISO-8601 UTC timestamp ending in `Z`.                                               |
| `institution`               | Exact active Financial Institution name; blank only for self-custody.               |
| `account`                   | Exact active Account name; it must belong to `institution`.                         |
| `acquired_instrument`       | Existing active Instrument code.                                                    |
| `acquired_quantity`         | Positive exact decimal with at most 18 places.                                      |
| `disposed_instrument`       | Different existing active Instrument code.                                          |
| `disposed_quantity`         | Positive exact decimal with at most 18 places.                                      |
| `fee_instrument`            | Blank with every fee field, or an existing active Instrument code.                  |
| `fee_quantity`              | Blank with every fee field, or a positive exact decimal with at most 18 places.     |
| `fee_value_eur_cents`       | Blank with every fee field, or positive integer EUR cents.                          |
| `asset_listing_ticker`      | Blank with `asset_listing_market`, or an active acquired-Instrument listing ticker. |
| `asset_listing_market`      | Blank with `asset_listing_ticker`, or that listing's market.                        |
| `execution_value_eur_cents` | Positive integer EUR cents at execution.                                            |
| `notes`                     | Optional free text.                                                                 |

`execution_value_eur_cents` is the gross EUR equivalent of the trade at execution, excluding the separately recorded fee. It feeds acquisition cost and realized results. `fee_value_eur_cents` values the commission at execution; the importer also uses `fee_instrument` and `fee_quantity` to deduct the actual asset paid. A fee mentioned only in `notes` does not affect balances or calculations.

## Normalization prompt

> Convert this export to a preparation CSV using exactly the normalized investment CSV columns above. Preserve the original file and produce one row per trade, never separate acquired/disposed/fee rows. Preserve exact gross acquired/disposed quantities, source references, and stable source IDs. Convert execution timestamps to ISO-8601 UTC ending in Z. Preserve each known fee's instrument and exact quantity in `fee_instrument` and `fee_quantity`, even when its EUR valuation is pending; leave only `fee_value_eur_cents` blank in that case. Do not hide known fees solely in notes or discard them to satisfy import validation. If the source quantities are net of fees, establish and document their meaning before deriving gross quantities so the importer will not deduct a fee twice. Preserve confirmed fee-free trades with all three fee fields blank. Flag unknown fee status, ambiguous grouping, conflicting fee data, or multiple fee instruments for review; do not invent or split trades to fit the schema. Preserve known EUR values as integer cents and leave unavailable valuations blank. Do not infer a historical price or assume stablecoin parity without an explicit valuation policy. Report missing required values and unresolved rows by `external_id`, and label the output as preparation-only until enrichment and import validation pass.

## Enriching the current Binance preparation file

The reviewed `Binance-Investment-Trades-Normalized.csv` snapshot has 658 trades dated from `2021-05-22T18:40:21Z` through `2026-09-19T23:14:53Z`. All execution values and structured fee fields are blank. Notes preserve 558 unvalued fees: 554 BNB, two ETH, one ADA, and one LINK. The remaining 100 rows have no such fee annotation; this alone does not prove they were fee-free. Recount these facts if the input changes.

1. Preserve this file byte-for-byte. Create `Binance-Investment-Trades-Prepared.csv` for recovered fee data and `Binance-Investment-Trades-Enriched.csv` for valuations. Keep all 658 rows, their order, IDs, timestamps, original quantities, account/institution fields, listing fields, and source notes. Do not regenerate IDs or group trades again.
2. Recover each unambiguous `source fees (unvalued): CODE QUANTITY` annotation into `fee_instrument` and `fee_quantity`, preserving the exact quantity string. Cross-check against the original export when available, especially gross versus net acquired quantities. Conflicting annotations or multiple fee instruments remain unresolved. For rows without annotations, verify the original export or flag unknown fee status; do not assume zero fees.
3. Value the gross consideration actually recorded, preferably the fiat or stablecoin leg. Either EUR leg gives its quantity multiplied by 100 without a market lookup. Convert BRL using historical BRL/EUR; convert USDT, USDC, BUSD, and DAI using their own historical prices. For crypto-to-crypto trades, value one documented leg consistently and use the other as a reasonableness check, not an additional amount to sum.
4. Value each fee independently in its own instrument at the execution time. A BNB fee needs BNB/EUR, directly or through a documented historical conversion path. Recovering its quantity is necessary even if the EUR valuation remains unavailable.
5. Produce a separate valuation report keyed by `external_id`, covering both execution and fee values. Record source URLs or request parameters, pair and conversion direction, UTC price timestamp, price field, rates used, raw EUR result, rounding policy, fallback/approximation, and unresolved reason. Keep this detail outside the fixed CSV schema and preserve original notes.
6. Check that every original row and quantity is preserved, IDs are unique, recovered fee counts reconcile, and no unknown valuation became zero or an invented value. Report resolved and unresolved counts separately. The enriched file is import-ready only after all required values, fee status, active entity references, and importer preview errors are resolved.

For the first row, `binance-row-0003`, preserve the acquisition of `0.024 ETH` for `300 BRL` and recover the `0.000024 ETH` fee. Calculate the execution value from historical BRL/EUR and the fee value from historical ETH/EUR. Do not treat this trade as USDT-based. An existing row disposing of `199 EUR` has a gross execution value of `19900` cents; its BNB fee still needs an independent valuation.

## Historical valuation policy and gaps

Use public historical market data; account credentials are not needed to look up public prices. Do not upload the transaction file to obtain quotes. These sources describe the available data, not guaranteed coverage of every pair/date:

- [Binance historical klines](https://developers.binance.com/en/docs/catalog/core-trading-spot-trading/api/rest-api/market#klines): prefer a direct pair available at execution; otherwise use a documented conversion path with matching UTC intervals. Default to the close of the one-minute candle containing the execution timestamp. For `2021-05-22T18:40:21Z`, that candle starts at `18:40:00Z`. This is a minute-level estimate, not an exact price at the execution second. Confirm returned timestamps and pair availability; never silently substitute a current quote or a distant candle. Archived Binance data can be used when the API cannot supply an old or delisted pair, with the same provenance checks.
- If Binance coverage is missing, use another verifiable historical market source with its timestamp and granularity recorded. Hourly or daily prices are explicit approximations, not equivalent to minute data.
- [ECB historical reference rates](https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html): a daily fiat conversion alternative. Rates are quoted as currency units per EUR, so divide the currency amount by the rate. For weekends/holidays, use the latest published rate on or before the execution date and record its actual date. May 22, 2021 was a Saturday. These reference rates are not intraday execution prices.
- Treating one USDT, USDC, BUSD, or DAI as one USD is an optional approximation that requires explicit user acceptance, not the default. Record it per affected valuation and do not use it where historical evidence shows a material departure from parity. BNB always requires its own historical price.
- If no defensible valuation is available, leave the value blank and report the gap. Never interpolate silently, use today's price, inflate a small fee to one cent, or fill zero to pass validation. The current importer rejects a positive fee that rounds to zero EUR cents; report this as a contract limitation requiring review.

Calculate conversions with exact decimal arithmetic, retaining rate precision until the final EUR value. Round once to integer cents using decimal half-up rounding and document that policy. Preserve crypto quantities without rounding. If a pair is `EURUSDT`, its price is USDT per EUR: divide USDT by that price. If a pair is `BNBUSDT`, multiply the BNB quantity by that price before converting USDT to EUR.

```text
execution_value_eur_cents = round_half_up(gross_leg_quantity × EUR_per_leg_unit × 100)
fee_value_eur_cents       = round_half_up(fee_quantity × EUR_per_fee_unit × 100)
```

## Enrichment prompt

> Enrich my current `Binance-Investment-Trades-Normalized.csv` with historical Binance prices, document alternatives for gaps, and recover fees from notes. Follow the current-file recovery steps and historical valuation policy above. Preserve the original file, all rows, stable IDs, timestamps, quantities, and source notes. Produce separate prepared and enriched CSVs using exactly the existing columns, plus a valuation report keyed by `external_id`. Recover known fee instruments and exact quantities even when EUR values remain pending. Use actual EUR consideration directly; otherwise value the documented gross trade leg and each fee separately at execution, using Binance one-minute candle closes where available. Record every source, rate, conversion path, UTC price timestamp, rounding decision, and fallback. Do not assume stablecoins equal USD without my explicit acceptance, invent prices, disguise missing fees as fee-free, or use zero to bypass validation. Flag uncertain gross/net quantities, unknown fee status, multiple fee instruments, missing historical coverage, and fees rounding to zero cents. Keep unresolved rows in the preparation output and report why they are not import-ready. Reconcile row counts and recovered fees with the reviewed snapshot, and state whether the enriched file meets the current importer contract. Do not import or modify application data.

Import-ready checklist: one trade per row; stable source IDs; UTC timestamps; exact gross quantities; positive integer EUR cents; complete known fees; confirmed fee-free rows; existing active names/codes; preview the whole file and resolve every error before confirmation.
