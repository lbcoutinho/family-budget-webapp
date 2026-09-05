-- Reference month is an accounting classification independent from settlement timing.
ALTER TABLE "transactions" DROP CONSTRAINT "transaction_reference_month_matches_settlement_date";
