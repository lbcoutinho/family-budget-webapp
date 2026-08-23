CREATE TABLE "csv_import_models" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "header_line_count" INTEGER NOT NULL,
    "separator" TEXT NOT NULL,
    "date_header" TEXT NOT NULL,
    "description_header" TEXT NOT NULL,
    "amount_header" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "csv_import_models_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "csv_import_models_header_line_count_range" CHECK ("header_line_count" BETWEEN 1 AND 100),
    CONSTRAINT "csv_import_models_separator_supported" CHECK ("separator" IN (',', ';', E'\t'))
);

CREATE INDEX "csv_import_models_user_id_idx" ON "csv_import_models"("user_id");
CREATE UNIQUE INDEX "csv_import_models_user_name_ci_unique" ON "csv_import_models"("user_id", LOWER("name"));

ALTER TABLE "csv_import_models" ADD CONSTRAINT "csv_import_models_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
