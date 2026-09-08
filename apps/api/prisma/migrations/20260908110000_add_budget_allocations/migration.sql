CREATE TABLE "budget_allocations" (
    "id" UUID NOT NULL,
    "budget_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "target_percentage_basis" INTEGER NOT NULL,
    "adjusted_monthly_amount" INTEGER NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "budget_allocations_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "budget_allocations_target_percentage_check" CHECK ("target_percentage_basis" BETWEEN 0 AND 10000),
    CONSTRAINT "budget_allocations_adjusted_monthly_amount_check" CHECK ("adjusted_monthly_amount" >= 0),
    CONSTRAINT "budget_allocations_budget_id_fkey" FOREIGN KEY ("budget_id") REFERENCES "budgets"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "budget_allocations_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "budget_allocations_budget_id_category_id_key" ON "budget_allocations"("budget_id", "category_id");
CREATE INDEX "budget_allocations_category_id_idx" ON "budget_allocations"("category_id");
