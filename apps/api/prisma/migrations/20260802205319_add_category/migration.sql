-- CreateEnum
CREATE TYPE "category_kind" AS ENUM ('EXPENSE', 'INCOME');

-- CreateTable
CREATE TABLE "categories" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "parent_id" UUID,
    "name" TEXT NOT NULL,
    "kind" "category_kind" NOT NULL,
    "color" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "categories_user_id_parent_id_is_active_idx" ON "categories"("user_id", "parent_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "categories_user_id_parent_id_name_key" ON "categories"("user_id", "parent_id", "name");

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateIndex (hand-written: Prisma cannot express a partial index)
-- The unique index above constrains subcategories only. A root category has `parent_id IS NULL`,
-- and PostgreSQL treats every NULL as distinct, so without this a user could hold any number of
-- roots called "Alimentação". Written by hand, and preserved by hand: `prisma migrate dev` does
-- not know about it, so a later migration must never be allowed to drop it.
CREATE UNIQUE INDEX "category_root_name_unique"
  ON "categories" ("user_id", "name") WHERE "parent_id" IS NULL;
