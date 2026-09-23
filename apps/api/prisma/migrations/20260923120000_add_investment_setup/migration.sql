CREATE TYPE "financial_institution_kind" AS ENUM ('BANK', 'BROKER', 'EXCHANGE');
CREATE TYPE "instrument_type" AS ENUM ('FIAT', 'STABLECOIN', 'CRYPTOCURRENCY', 'STOCK', 'ETF', 'ETC');

CREATE TABLE "financial_institutions" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "kind" "financial_institution_kind" NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "financial_institutions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "instruments" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "type" "instrument_type" NOT NULL,
  "display_precision" INTEGER NOT NULL DEFAULT 2,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "instruments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "asset_listings" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "instrument_id" UUID NOT NULL,
  "quote_instrument_id" UUID NOT NULL,
  "market" TEXT NOT NULL,
  "ticker" TEXT NOT NULL,
  "isin" TEXT,
  "provider_symbol" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "asset_listings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "financial_institutions_user_id_name_key" ON "financial_institutions"("user_id", "name");
CREATE INDEX "financial_institutions_user_id_is_active_idx" ON "financial_institutions"("user_id", "is_active");
CREATE UNIQUE INDEX "instruments_user_id_code_key" ON "instruments"("user_id", "code");
CREATE INDEX "instruments_user_id_is_active_idx" ON "instruments"("user_id", "is_active");
CREATE UNIQUE INDEX "asset_listings_user_id_instrument_id_market_ticker_key" ON "asset_listings"("user_id", "instrument_id", "market", "ticker");
CREATE INDEX "asset_listings_user_id_is_active_idx" ON "asset_listings"("user_id", "is_active");

ALTER TABLE "financial_institutions" ADD CONSTRAINT "financial_institutions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "instruments" ADD CONSTRAINT "instruments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "asset_listings" ADD CONSTRAINT "asset_listings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "asset_listings" ADD CONSTRAINT "asset_listings_instrument_id_fkey" FOREIGN KEY ("instrument_id") REFERENCES "instruments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "asset_listings" ADD CONSTRAINT "asset_listings_quote_instrument_id_fkey" FOREIGN KEY ("quote_instrument_id") REFERENCES "instruments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
