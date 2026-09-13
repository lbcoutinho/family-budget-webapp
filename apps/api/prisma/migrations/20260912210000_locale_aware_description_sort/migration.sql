-- The monthly description sort is pt-BR, independent of the database's default locale.
ALTER TABLE "transactions" ALTER COLUMN "description" TYPE TEXT COLLATE "pt-BR-x-icu";

-- Matches the default monthly filter and its complete deterministic description ordering.
CREATE INDEX "transactions_month_description_sort_idx"
  ON "transactions" ("user_id", "reference_month", "status", "description", "settlement_date" DESC, "created_at" DESC, "id" DESC);
