CREATE TYPE "account_kind" AS ENUM ('BANK', 'BROKERAGE', 'EXCHANGE', 'WALLET', 'OTHER');

ALTER TABLE "accounts"
  ADD COLUMN "kind" "account_kind" NOT NULL DEFAULT 'BANK',
  ADD COLUMN "financial_institution_id" UUID;

CREATE TABLE "account_initial_balances" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "account_id" UUID NOT NULL,
  "instrument_id" UUID NOT NULL,
  "quantity" DECIMAL(36,18) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "account_initial_balances_pkey" PRIMARY KEY ("id")
);

INSERT INTO "instruments" ("id", "user_id", "name", "code", "type", "display_precision", "is_active", "sort_order", "created_at", "updated_at")
SELECT md5('EUR:' || account_users."user_id"::text)::uuid, account_users."user_id", 'Euro', 'EUR', 'FIAT', 2, true, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM (SELECT DISTINCT "user_id" FROM "accounts") AS account_users
WHERE NOT EXISTS (SELECT 1 FROM "instruments" WHERE "user_id" = account_users."user_id" AND "code" = 'EUR');

INSERT INTO "account_initial_balances" ("id", "user_id", "account_id", "instrument_id", "quantity", "created_at", "updated_at")
SELECT md5('initial:' || account."id"::text)::uuid, account."user_id", account."id", instrument."id", account."initial_balance"::numeric / 100, account."created_at", CURRENT_TIMESTAMP
FROM "accounts" AS account
JOIN "instruments" AS instrument ON instrument."user_id" = account."user_id" AND instrument."code" = 'EUR';

CREATE UNIQUE INDEX "account_initial_balances_account_id_instrument_id_key" ON "account_initial_balances"("account_id", "instrument_id");
CREATE INDEX "account_initial_balances_user_id_instrument_id_idx" ON "account_initial_balances"("user_id", "instrument_id");
CREATE INDEX "accounts_financial_institution_id_idx" ON "accounts"("financial_institution_id");

ALTER TABLE "accounts" ADD CONSTRAINT "accounts_financial_institution_id_fkey" FOREIGN KEY ("financial_institution_id") REFERENCES "financial_institutions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "account_initial_balances" ADD CONSTRAINT "account_initial_balances_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "account_initial_balances" ADD CONSTRAINT "account_initial_balances_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "account_initial_balances" ADD CONSTRAINT "account_initial_balances_instrument_id_fkey" FOREIGN KEY ("instrument_id") REFERENCES "instruments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
