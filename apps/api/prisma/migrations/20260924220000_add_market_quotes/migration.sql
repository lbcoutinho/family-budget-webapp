CREATE TYPE "market_quote_source" AS ENUM ('MANUAL');
CREATE TYPE "market_quote_status" AS ENUM ('VALID');

CREATE TABLE "market_quotes" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "asset_listing_id" UUID NOT NULL,
  "quote_instrument_id" UUID NOT NULL,
  "price" DECIMAL(36,12) NOT NULL,
  "market_date" DATE NOT NULL,
  "synchronized_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "source" "market_quote_source" NOT NULL DEFAULT 'MANUAL',
  "status" "market_quote_status" NOT NULL DEFAULT 'VALID',
  CONSTRAINT "market_quotes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "market_quotes_asset_listing_id_key" ON "market_quotes"("asset_listing_id");
CREATE INDEX "market_quotes_user_id_market_date_idx" ON "market_quotes"("user_id", "market_date");
CREATE INDEX "market_quotes_quote_instrument_id_idx" ON "market_quotes"("quote_instrument_id");

ALTER TABLE "market_quotes" ADD CONSTRAINT "market_quotes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "market_quotes" ADD CONSTRAINT "market_quotes_asset_listing_id_fkey" FOREIGN KEY ("asset_listing_id") REFERENCES "asset_listings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "market_quotes" ADD CONSTRAINT "market_quotes_quote_instrument_id_fkey" FOREIGN KEY ("quote_instrument_id") REFERENCES "instruments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
