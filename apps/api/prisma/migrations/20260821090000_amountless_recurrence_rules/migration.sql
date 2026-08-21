-- AlterTable
ALTER TABLE "recurrence_rules" ALTER COLUMN "amount" DROP NOT NULL;

-- AlterTable
ALTER TABLE "transactions" ALTER COLUMN "amount" DROP NOT NULL;

-- DropConstraint (hand-written, same as the constraints below: `prisma migrate dev` cannot see a
-- CHECK constraint, so it never drops or recreates one on its own — ADR-0020)
ALTER TABLE "recurrence_rules" DROP CONSTRAINT "recurrence_rule_amount_positive";

-- CreateIndex (hand-written: Prisma's schema language cannot express a CHECK constraint)
-- Written by hand, and preserved by hand. Relaxed from "always positive" to "null or positive" —
-- null now means a variable amount (ADR-0020), never a real zero.
ALTER TABLE "recurrence_rules" ADD CONSTRAINT "recurrence_rule_amount_positive" CHECK ("amount" IS NULL OR "amount" > 0);

-- CreateIndex (hand-written: Prisma's schema language cannot express a CHECK constraint)
-- Written by hand, and preserved by hand. A rule that auto-confirms must know what it confirms
-- (ADR-0020) — null amount is legal only when `autoConfirm = false`.
ALTER TABLE "recurrence_rules" ADD CONSTRAINT "recurrence_rule_amount_required_when_auto_confirm" CHECK ("amount" IS NOT NULL OR "auto_confirm" = false);

-- DropConstraint (hand-written, same as the constraints below)
ALTER TABLE "transactions" DROP CONSTRAINT "transaction_amount_positive";

-- CreateIndex (hand-written: Prisma's schema language cannot express a CHECK constraint)
-- Written by hand, and preserved by hand. Relaxed from "always positive" to "null or positive" —
-- null now means unknown yet (ADR-0020), never a real zero.
ALTER TABLE "transactions" ADD CONSTRAINT "transaction_amount_positive" CHECK ("amount" IS NULL OR "amount" > 0);

-- CreateIndex (hand-written: Prisma's schema language cannot express a CHECK constraint)
-- Written by hand, and preserved by hand. A confirmed transaction always has an amount (ADR-0020)
-- — the empty amount is only ever visible inside a draft (ADR-0012).
ALTER TABLE "transactions" ADD CONSTRAINT "transaction_amount_required_when_confirmed" CHECK ("amount" IS NOT NULL OR "status" = 'DRAFT');
