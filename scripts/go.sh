#!/usr/bin/env bash
# One-shot dev bootstrap: node version, deps, db up, migrate, seed, dev servers.
# Usage: pnpm go   (or: bash scripts/go.sh)
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

if command -v nvm >/dev/null 2>&1; then
  nvm use >/dev/null 2>&1 || nvm use "$(cat .nvmrc)"
fi

pnpm install

if docker container inspect family-budget-postgres >/dev/null 2>&1; then
  echo "Postgres container already exists."
else
  docker compose up -d postgres
fi

echo "Waiting for postgres..."
until docker compose exec -T postgres pg_isready -U "${POSTGRES_USER:-budget}" -d "${POSTGRES_DB:-budget}" >/dev/null 2>&1; do
  sleep 1
done

pnpm --filter api db:migrate
pnpm --filter api db:seed

pnpm dev
