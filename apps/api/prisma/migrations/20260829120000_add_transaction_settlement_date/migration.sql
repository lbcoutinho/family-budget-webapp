-- Expand the transaction date model without changing existing request contracts (ADR-0021).
ALTER TABLE "transactions" ADD COLUMN "settlement_date" DATE NOT NULL DEFAULT CURRENT_DATE;

UPDATE "transactions"
SET "settlement_date" = CASE
  WHEN "is_credit_card" THEN GREATEST("date", "reference_month")
  ELSE "date"
END;
