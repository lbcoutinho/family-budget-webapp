#!/usr/bin/env bash

# End-of-task verification. Run with a flag to pick which app's checks to run:
#   pnpm verify backend   (or: bash scripts/verify.sh backend)  -> lint, typecheck, unit + e2e tests for apps/api
#   pnpm verify frontend  (or: bash scripts/verify.sh frontend) -> lint, typecheck, unit tests for apps/web
# Lint is repo-wide (no per-app split), so both branches run it against the whole repo.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

target="${1:-}"
if [[ "$target" != "backend" && "$target" != "frontend" ]]; then
  echo "Usage: pnpm verify <backend|frontend>" >&2
  exit 1
fi

pnpm lint

if [[ "$target" == "backend" ]]; then
  pnpm api:typecheck
  pnpm api:test

  if docker container inspect family-budget-postgres-test >/dev/null 2>&1; then
    echo "Postgres test container already exists."
  else
    docker compose up -d postgres-test
  fi

  pnpm api:db:migrate
  pnpm api:db:seed
  pnpm api:test:e2e
else
  pnpm web:typecheck
  pnpm web:test
fi
