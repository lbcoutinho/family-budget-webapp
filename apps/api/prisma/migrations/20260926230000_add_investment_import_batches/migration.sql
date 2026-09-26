CREATE TABLE "import_batches" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "row_count" INTEGER NOT NULL,
  "file_fingerprint" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "import_batches_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "investment_trades"
  ADD COLUMN "import_batch_id" UUID,
  ADD COLUMN "source_key" TEXT,
  ADD COLUMN "external_id" TEXT,
  ADD COLUMN "content_fingerprint" TEXT;

CREATE INDEX "import_batches_user_id_created_at_idx" ON "import_batches"("user_id", "created_at");
CREATE INDEX "investment_trades_import_batch_id_idx" ON "investment_trades"("import_batch_id");
CREATE UNIQUE INDEX "investment_trades_source_key_external_id_key" ON "investment_trades"("source_key", "external_id");
CREATE UNIQUE INDEX "investment_trades_source_key_content_fingerprint_key" ON "investment_trades"("source_key", "content_fingerprint");

ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "investment_trades" ADD CONSTRAINT "investment_trades_import_batch_id_fkey" FOREIGN KEY ("import_batch_id") REFERENCES "import_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
