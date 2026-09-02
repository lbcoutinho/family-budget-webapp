-- Align the database default with `settlementDate @default(now())` in Prisma.
ALTER TABLE "transactions" ALTER COLUMN "settlement_date" SET DEFAULT CURRENT_TIMESTAMP;
