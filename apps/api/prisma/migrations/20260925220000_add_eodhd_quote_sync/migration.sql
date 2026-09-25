ALTER TYPE "market_quote_source" ADD VALUE 'EODHD';
ALTER TYPE "market_quote_status" ADD VALUE 'ERROR';

CREATE TYPE "market_quote_sync_status" AS ENUM ('SUCCESS', 'FAILED', 'UNSUPPORTED');

CREATE TABLE "market_quote_syncs" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "asset_listing_id" UUID NOT NULL,
  "status" "market_quote_sync_status" NOT NULL,
  "attempt_count" INTEGER NOT NULL DEFAULT 1,
  "attempted_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "market_quote_syncs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "market_quote_syncs_asset_listing_id_key" ON "market_quote_syncs"("asset_listing_id");
CREATE INDEX "market_quote_syncs_user_id_attempted_at_idx" ON "market_quote_syncs"("user_id", "attempted_at");

ALTER TABLE "market_quote_syncs" ADD CONSTRAINT "market_quote_syncs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "market_quote_syncs" ADD CONSTRAINT "market_quote_syncs_asset_listing_id_fkey" FOREIGN KEY ("asset_listing_id") REFERENCES "asset_listings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
