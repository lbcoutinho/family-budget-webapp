CREATE TABLE "position_adjustments" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "instrument_id" UUID NOT NULL,
    "quantity" DECIMAL(36,18) NOT NULL,
    "cost" INTEGER,
    "effective_at" TIMESTAMPTZ(3) NOT NULL,
    "reason" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "position_adjustments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "balance_adjustments" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "instrument_id" UUID NOT NULL,
    "quantity" DECIMAL(36,18) NOT NULL,
    "effective_at" TIMESTAMPTZ(3) NOT NULL,
    "reason" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "balance_adjustments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "position_adjustments_user_id_effective_at_idx" ON "position_adjustments"("user_id", "effective_at");
CREATE INDEX "position_adjustments_account_id_instrument_id_effective_at_idx" ON "position_adjustments"("account_id", "instrument_id", "effective_at");
CREATE INDEX "balance_adjustments_user_id_effective_at_idx" ON "balance_adjustments"("user_id", "effective_at");
CREATE INDEX "balance_adjustments_account_id_instrument_id_effective_at_idx" ON "balance_adjustments"("account_id", "instrument_id", "effective_at");

ALTER TABLE "position_adjustments" ADD CONSTRAINT "position_adjustments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "position_adjustments" ADD CONSTRAINT "position_adjustments_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "position_adjustments" ADD CONSTRAINT "position_adjustments_instrument_id_fkey" FOREIGN KEY ("instrument_id") REFERENCES "instruments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "balance_adjustments" ADD CONSTRAINT "balance_adjustments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "balance_adjustments" ADD CONSTRAINT "balance_adjustments_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "balance_adjustments" ADD CONSTRAINT "balance_adjustments_instrument_id_fkey" FOREIGN KEY ("instrument_id") REFERENCES "instruments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
