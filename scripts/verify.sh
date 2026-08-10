#!/usr/bin/env bash

# One-shop execute: lint, typecheck, unit test and e2e tests
# Usage: pnpm verify   (or: bash scripts/verify.sh)
set -euo pipefail

pnpm typecheck
pnpm lint
cd "$(dirname "${BASH_SOURCE[0]}")/../apps/api"
pnpm --filter api test

if docker container inspect family-budget-postgres-test >/dev/null 2>&1; then
  echo "Postgres test container already exists."
else
  docker compose up -d postgres-test
fi

echo "Waiting for postgres test to run e2e tests..."
until docker compose exec -T postgres-test pg_isready -U "${POSTGRES_USER:-budget}" -d "${POSTGRES_DB:-budget}" >/dev/null 2>&1; do
  sleep 1
done

pnpm --filter api db:migrate
pnpm --filter api db:seed

pnpm --filter api test:e2e