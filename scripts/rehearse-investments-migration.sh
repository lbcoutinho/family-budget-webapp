#!/usr/bin/env bash

set -euo pipefail

usage() {
  cat <<'EOF'
Usage: REHEARSAL_DATABASE_URL=... REHEARSAL_CONFIRM=restored-production-copy scripts/rehearse-investments-migration.sh --as-of YYYY-MM-DD --report-month YYYY-MM --output DIRECTORY

Runs the committed Prisma migration chain against an isolated restored copy, records pre/post
invariants, and fails when a protected value changes. It never restores backups or resets a database.
EOF
}

as_of=''
report_month=''
output=''
while (($#)); do
  case "$1" in
    --as-of) as_of="${2:-}"; shift 2 ;;
    --report-month) report_month="${2:-}"; shift 2 ;;
    --output) output="${2:-}"; shift 2 ;;
    --help) usage; exit 0 ;;
    *) usage >&2; exit 2 ;;
  esac
done

[[ "${REHEARSAL_CONFIRM:-}" == 'restored-production-copy' ]] || { echo 'Set REHEARSAL_CONFIRM=restored-production-copy.' >&2; exit 2; }
[[ -n "${REHEARSAL_DATABASE_URL:-}" && -n "$as_of" && -n "$report_month" && -n "$output" ]] || { usage >&2; exit 2; }
[[ "$as_of" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ && "$report_month" =~ ^[0-9]{4}-[0-9]{2}$ ]] || { echo 'Use ISO dates.' >&2; exit 2; }
[[ ! -e "$output" ]] || { echo "Output directory already exists: $output" >&2; exit 2; }

mkdir -p "$output/pre" "$output/post"
export DATABASE_URL="$REHEARSAL_DATABASE_URL"

query() {
  psql -X --set ON_ERROR_STOP=1 --no-align --tuples-only --field-separator $'\t' "$DATABASE_URL" -c "$1"
}

transaction_snapshot="SELECT count(*), md5(coalesce(string_agg(to_jsonb(t)::text, E'\\n' ORDER BY t.id), '')) FROM \"transactions\" AS t;"
budget_snapshot="SELECT \"user_id\", \"reference_month\", coalesce(sum(\"amount\") FILTER (WHERE \"type\" = 'INCOME' AND \"status\" = 'CONFIRMED'), 0), coalesce(sum(\"amount\") FILTER (WHERE \"type\" = 'EXPENSE' AND \"status\" = 'CONFIRMED'), 0) FROM \"transactions\" WHERE \"reference_month\" = '$report_month-01'::date GROUP BY \"user_id\", \"reference_month\" ORDER BY \"user_id\", \"reference_month\";"
movement_sum="coalesce(sum(case when t.\"account_id\" = a.\"id\" then case t.\"type\" when 'INCOME' then t.\"amount\" when 'CASHBOX_OUT' then t.\"amount\" when 'TRANSFER' then -t.\"amount\" when 'EXPENSE' then -t.\"amount\" when 'CASHBOX_IN' then -t.\"amount\" else 0 end when t.\"destination_account_id\" = a.\"id\" and t.\"type\" = 'TRANSFER' then t.\"amount\" else 0 end) filter (where t.\"status\" = 'CONFIRMED' and t.\"settlement_date\" <= '$as_of'::date), 0)"

query "$transaction_snapshot" >"$output/pre/transactions.tsv"
query 'SELECT "id", "user_id", "initial_balance" FROM "accounts" ORDER BY "id";' >"$output/pre/initial-balances.tsv"
query "SELECT a.\"id\", a.\"user_id\", a.\"initial_balance\" + $movement_sum FROM \"accounts\" AS a LEFT JOIN \"transactions\" AS t ON (t.\"account_id\" = a.\"id\" OR t.\"destination_account_id\" = a.\"id\") AND t.\"user_id\" = a.\"user_id\" WHERE a.\"created_at\" <= ('$as_of'::date + interval '1 day') GROUP BY a.\"id\", a.\"user_id\", a.\"initial_balance\" ORDER BY a.\"id\";" >"$output/pre/account-balances.tsv"
query "$budget_snapshot" >"$output/pre/budget-report.tsv"

pnpm --filter api exec prisma migrate deploy --config prisma.config.ts |& tee "$output/migrate-deploy.log"

query "$transaction_snapshot" >"$output/post/transactions.tsv"
query "SELECT aib.\"account_id\", aib.\"user_id\", (aib.\"quantity\" * 100)::bigint FROM \"account_initial_balances\" AS aib JOIN \"instruments\" AS i ON i.\"id\" = aib.\"instrument_id\" WHERE i.\"code\" = 'EUR' ORDER BY aib.\"account_id\";" >"$output/post/initial-balances.tsv"
query "SELECT aib.\"account_id\", aib.\"quantity\" FROM \"account_initial_balances\" AS aib JOIN \"instruments\" AS i ON i.\"id\" = aib.\"instrument_id\" WHERE i.\"code\" = 'EUR' AND aib.\"quantity\" * 100 <> trunc(aib.\"quantity\" * 100) ORDER BY aib.\"account_id\";" >"$output/post/initial-balance-violations.tsv"
query "SELECT a.\"id\", a.\"user_id\", coalesce((aib.\"quantity\" * 100)::bigint, 0) + $movement_sum FROM \"accounts\" AS a LEFT JOIN \"account_initial_balances\" AS aib ON aib.\"account_id\" = a.\"id\" AND aib.\"instrument_id\" = (SELECT i.\"id\" FROM \"instruments\" AS i WHERE i.\"user_id\" = a.\"user_id\" AND i.\"code\" = 'EUR') LEFT JOIN \"transactions\" AS t ON (t.\"account_id\" = a.\"id\" OR t.\"destination_account_id\" = a.\"id\") AND t.\"user_id\" = a.\"user_id\" WHERE a.\"created_at\" <= ('$as_of'::date + interval '1 day') GROUP BY a.\"id\", a.\"user_id\", aib.\"quantity\" ORDER BY a.\"id\";" >"$output/post/account-balances.tsv"
query "$budget_snapshot" >"$output/post/budget-report.tsv"
query "SELECT a.\"id\", a.\"name\", a.\"kind\" FROM \"accounts\" AS a WHERE a.\"kind\" IN ('BANK', 'BROKERAGE', 'EXCHANGE') AND a.\"financial_institution_id\" IS NULL ORDER BY a.\"kind\", a.\"name\", a.\"id\";" >"$output/institution-onboarding.tsv"

diff -u "$output/pre/transactions.tsv" "$output/post/transactions.tsv"
[[ ! -s "$output/post/initial-balance-violations.tsv" ]] || { echo 'EUR initial balance is not an exact cent value.' >&2; exit 1; }
diff -u "$output/pre/initial-balances.tsv" "$output/post/initial-balances.tsv"
diff -u "$output/pre/account-balances.tsv" "$output/post/account-balances.tsv"
diff -u "$output/pre/budget-report.tsv" "$output/post/budget-report.tsv"
printf 'Rehearsal passed. Results recorded in %s\n' "$output"
