-- CreateTable
CREATE TABLE "cashboxes" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "target_amount" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cashboxes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cashboxes_user_id_is_active_idx" ON "cashboxes"("user_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "cashboxes_user_id_name_key" ON "cashboxes"("user_id", "name");

-- AddForeignKey
ALTER TABLE "cashboxes" ADD CONSTRAINT "cashboxes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
