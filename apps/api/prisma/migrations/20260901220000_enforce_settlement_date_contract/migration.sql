-- Contract settlement dates as the accounting-date source.
UPDATE "transactions"
SET "reference_month" = date_trunc('month', "settlement_date")::date;

ALTER TABLE "transactions" ADD CONSTRAINT "transaction_reference_month_matches_settlement_date"
  CHECK ("reference_month" = date_trunc('month', "settlement_date")::date);

ALTER TABLE "transactions" ADD CONSTRAINT "transaction_credit_card_is_expense"
  CHECK (NOT "is_credit_card" OR "type" = 'EXPENSE');

ALTER TABLE "transactions" ADD CONSTRAINT "transaction_settlement_date_matches_card_rule"
  CHECK (("is_credit_card" AND "settlement_date" >= "date") OR (NOT "is_credit_card" AND "settlement_date" = "date"));
