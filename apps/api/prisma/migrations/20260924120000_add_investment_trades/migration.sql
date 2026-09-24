CREATE TABLE "investment_trades" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "account_id" UUID NOT NULL,
  "acquired_instrument_id" UUID NOT NULL,
  "acquired_quantity" DECIMAL(36,18) NOT NULL,
  "disposed_instrument_id" UUID NOT NULL,
  "disposed_quantity" DECIMAL(36,18) NOT NULL,
  "asset_listing_id" UUID,
  "executed_at" TIMESTAMPTZ(3) NOT NULL,
  "execution_value" INTEGER NOT NULL,
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "investment_trades_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "investment_trades_user_id_executed_at_idx" ON "investment_trades"("user_id", "executed_at");
CREATE INDEX "investment_trades_account_id_executed_at_idx" ON "investment_trades"("account_id", "executed_at");
CREATE INDEX "investment_trades_acquired_instrument_id_idx" ON "investment_trades"("acquired_instrument_id");
CREATE INDEX "investment_trades_disposed_instrument_id_idx" ON "investment_trades"("disposed_instrument_id");
CREATE INDEX "investment_trades_asset_listing_id_idx" ON "investment_trades"("asset_listing_id");

ALTER TABLE "investment_trades" ADD CONSTRAINT "investment_trades_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "investment_trades" ADD CONSTRAINT "investment_trades_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "investment_trades" ADD CONSTRAINT "investment_trades_acquired_instrument_id_fkey" FOREIGN KEY ("acquired_instrument_id") REFERENCES "instruments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "investment_trades" ADD CONSTRAINT "investment_trades_disposed_instrument_id_fkey" FOREIGN KEY ("disposed_instrument_id") REFERENCES "instruments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "investment_trades" ADD CONSTRAINT "investment_trades_asset_listing_id_fkey" FOREIGN KEY ("asset_listing_id") REFERENCES "asset_listings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
