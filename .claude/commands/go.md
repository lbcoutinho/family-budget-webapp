---
description: Bootstrap and start the dev environment (node version, install, docker db, migrate, seed, dev servers)
---

Run `pnpm go` (executes `scripts/go.sh`) via the Bash tool. That script, in order:

1. `nvm use` (Node version from `.nvmrc`)
2. `pnpm install`
3. `docker compose up -d postgres`
4. wait for postgres healthy
5. `pnpm --filter api db:migrate`
6. `pnpm --filter api db:seed`
7. `pnpm dev` (starts api + web) in its own terminal window, so it doesn't block the calling shell
