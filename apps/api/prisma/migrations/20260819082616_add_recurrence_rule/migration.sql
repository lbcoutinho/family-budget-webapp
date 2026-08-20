-- CreateEnum
CREATE TYPE "frequency" AS ENUM ('MONTHLY', 'YEARLY');

-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "installment_number" INTEGER,
ADD COLUMN     "installment_total" INTEGER,
ADD COLUMN     "recurrence_rule_id" UUID;

-- CreateTable
CREATE TABLE "recurrence_rules" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "transaction_type" NOT NULL,
    "amount" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "notes" TEXT,
    "account_id" UUID,
    "category_id" UUID,
    "subcategory_id" UUID,
    "frequency" "frequency" NOT NULL,
    "interval" INTEGER NOT NULL DEFAULT 1,
    "day_of_month" INTEGER NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE,
    "total_occurrences" INTEGER,
    "auto_confirm" BOOLEAN NOT NULL DEFAULT true,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "generated_until" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recurrence_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "recurrence_rules_user_id_is_active_idx" ON "recurrence_rules"("user_id", "is_active");

-- CreateIndex
CREATE INDEX "recurrence_rules_user_id_is_active_generated_until_idx" ON "recurrence_rules"("user_id", "is_active", "generated_until");

-- AddForeignKey
ALTER TABLE "recurrence_rules" ADD CONSTRAINT "recurrence_rules_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurrence_rules" ADD CONSTRAINT "recurrence_rules_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurrence_rules" ADD CONSTRAINT "recurrence_rules_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurrence_rules" ADD CONSTRAINT "recurrence_rules_subcategory_id_fkey" FOREIGN KEY ("subcategory_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_recurrence_rule_id_fkey" FOREIGN KEY ("recurrence_rule_id") REFERENCES "recurrence_rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex (hand-written: Prisma's schema language cannot express a CHECK constraint)
-- Written by hand, and preserved by hand: `prisma migrate dev` does not know about it, so a later
-- migration must never be allowed to drop it. Guarantees `amount` is never zero or negative — the
-- sign of a movement is derived from `type`, never stored (`AGENTS.md`, domain rules), same as
-- `transaction_amount_positive` on `transactions`.
ALTER TABLE "recurrence_rules" ADD CONSTRAINT "recurrence_rule_amount_positive" CHECK ("amount" > 0);

-- CreateIndex (hand-written: Prisma's schema language cannot express a CHECK constraint)
-- Written by hand, and preserved by hand, same as above. `dayOfMonth` is a calendar day; 31 in a
-- short month falls back to the last day of that month, in the generator (ADR-0014).
ALTER TABLE "recurrence_rules" ADD CONSTRAINT "recurrence_rule_day_of_month_range"
  CHECK ("day_of_month" BETWEEN 1 AND 31);

-- CreateIndex (hand-written: Prisma's schema language cannot express a CHECK constraint)
-- Written by hand, and preserved by hand, same as above. `interval` is "every N months/years", so
-- zero or negative has no meaning.
ALTER TABLE "recurrence_rules" ADD CONSTRAINT "recurrence_rule_interval_positive" CHECK ("interval" > 0);

-- CreateIndex (hand-written: Prisma's schema language cannot express a CHECK constraint)
-- Written by hand, and preserved by hand, same as above. Null `totalOccurrences` means
-- open-ended; a value means installments, and must be >= 1 (ADR-0014).
ALTER TABLE "recurrence_rules" ADD CONSTRAINT "recurrence_rule_total_occurrences_positive"
  CHECK ("total_occurrences" IS NULL OR "total_occurrences" >= 1);

-- CreateIndex (hand-written: Prisma's schema language cannot express a partial unique index)
-- Written by hand, and preserved by hand, same as above. Second idempotency guard (ADR-0014): a
-- rule produces at most one entry per reference month. Partial, because manual entries share the
-- column with a NULL rule id, and NULL != NULL lets any number of them share a month.
CREATE UNIQUE INDEX "transaction_recurrence_month_unique"
  ON "transactions" ("recurrence_rule_id", "reference_month")
  WHERE "recurrence_rule_id" IS NOT NULL;
