ALTER TABLE "investment_trades"
  ADD COLUMN "fee_instrument_id" UUID,
  ADD COLUMN "fee_quantity" DECIMAL(36,18),
  ADD COLUMN "fee_value" INTEGER;

CREATE INDEX "investment_trades_fee_instrument_id_idx" ON "investment_trades"("fee_instrument_id");

ALTER TABLE "investment_trades"
  ADD CONSTRAINT "investment_trades_fee_instrument_id_fkey"
  FOREIGN KEY ("fee_instrument_id") REFERENCES "instruments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
