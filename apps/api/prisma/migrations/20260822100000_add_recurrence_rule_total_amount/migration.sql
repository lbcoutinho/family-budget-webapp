-- AlterTable
ALTER TABLE "recurrence_rules" ADD COLUMN "total_amount" INTEGER;

-- Backfill installment plans from the amounts already materialized on their transaction rows.
-- Open-ended rules and plans without materialized entries remain NULL.
UPDATE "recurrence_rules" AS rule
SET "total_amount" = totals.total_amount
FROM (
  SELECT "recurrence_rule_id", SUM("amount")::INTEGER AS total_amount
  FROM "transactions"
  WHERE "recurrence_rule_id" IS NOT NULL
  GROUP BY "recurrence_rule_id"
) AS totals
WHERE rule."id" = totals."recurrence_rule_id"
  AND rule."total_occurrences" IS NOT NULL;
