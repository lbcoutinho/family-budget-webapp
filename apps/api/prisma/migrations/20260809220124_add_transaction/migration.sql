-- CreateEnum
CREATE TYPE "transaction_type" AS ENUM ('INCOME', 'EXPENSE', 'TRANSFER', 'CASHBOX_IN', 'CASHBOX_OUT', 'CASHBOX_TRANSFER');

-- CreateEnum
CREATE TYPE "transaction_status" AS ENUM ('DRAFT', 'CONFIRMED');

-- CreateEnum
CREATE TYPE "transaction_source" AS ENUM ('MANUAL', 'VOICE', 'RECURRING');

-- CreateTable
CREATE TABLE "transactions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "transaction_type" NOT NULL,
    "status" "transaction_status" NOT NULL DEFAULT 'CONFIRMED',
    "source" "transaction_source" NOT NULL DEFAULT 'MANUAL',
    "amount" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "reference_month" DATE NOT NULL,
    "description" TEXT NOT NULL,
    "notes" TEXT,
    "is_credit_card" BOOLEAN NOT NULL DEFAULT false,
    "account_id" UUID,
    "destination_account_id" UUID,
    "category_id" UUID,
    "subcategory_id" UUID,
    "cashbox_id" UUID,
    "destination_cashbox_id" UUID,
    "cashbox_label" TEXT,
    "destination_cashbox_label" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "transactions_user_id_reference_month_status_idx" ON "transactions"("user_id", "reference_month", "status");

-- CreateIndex
CREATE INDEX "transactions_user_id_type_reference_month_idx" ON "transactions"("user_id", "type", "reference_month");

-- CreateIndex
CREATE INDEX "transactions_user_id_category_id_reference_month_idx" ON "transactions"("user_id", "category_id", "reference_month");

-- CreateIndex
CREATE INDEX "transactions_user_id_cashbox_id_idx" ON "transactions"("user_id", "cashbox_id");

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_destination_account_id_fkey" FOREIGN KEY ("destination_account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_subcategory_id_fkey" FOREIGN KEY ("subcategory_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_cashbox_id_fkey" FOREIGN KEY ("cashbox_id") REFERENCES "cashboxes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_destination_cashbox_id_fkey" FOREIGN KEY ("destination_cashbox_id") REFERENCES "cashboxes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex (hand-written: Prisma's schema language cannot express a CHECK constraint)
-- Written by hand, and preserved by hand: `prisma migrate dev` does not know about it, so a later
-- migration must never be allowed to drop it. Guarantees `amount` is never zero or negative — the
-- sign of a movement is derived from `type`, never stored (`AGENTS.md`, domain rules).
ALTER TABLE "transactions" ADD CONSTRAINT "transaction_amount_positive" CHECK ("amount" > 0);

-- CreateIndex (hand-written: Prisma's schema language cannot express a CHECK constraint)
-- Written by hand, and preserved by hand, same as above. Guarantees `reference_month` always falls
-- on the first of the month (ADR-0009), so the monthly tab and every report can group by it without
-- a normalization step.
ALTER TABLE "transactions" ADD CONSTRAINT "transaction_reference_month_first_day"
  CHECK (EXTRACT(DAY FROM "reference_month") = 1);
