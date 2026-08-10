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

pnpm --filter api db:migrate
pnpm --filter api db:seed

pnpm --filter api test:e2e