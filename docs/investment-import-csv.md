# Normalized investment CSV

Use UTF-8 CSV with a comma delimiter and exactly one row per Investment Trade. Timestamps must be UTC (`Z`); quantities are exact decimal strings; EUR values are positive integer cents.

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

Checklist: one trade per row; preserve source IDs; convert timestamps to UTC; never round quantities; use integer EUR cents; ensure names/codes already exist; preview the whole file and resolve every error before confirmation.

Prompt for normalization: “Convert this export to the normalized investment CSV schema above. Produce one row per trade, never separate acquired/disposed/fee rows. Preserve exact quantities and stable source IDs. Convert execution timestamps to ISO-8601 UTC ending in Z and EUR values to integer cents. Do not invent missing values; leave optional fields blank and report every missing required value separately.”
