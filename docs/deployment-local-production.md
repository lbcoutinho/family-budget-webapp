# Local production deployment

This deployment runs the real production configuration on one computer at
`https://family-budget.localhost`. Nginx serves the web build and forwards `/api` to the internal
API container; the API is not exposed directly. PostgreSQL persists in a production-only volume
and is reachable for local debugging on `127.0.0.1:5434`.

## Prerequisites

- Docker Engine with Docker Compose v2
- `mkcert` and its platform trust-store dependency
- `openssl`
- Port 443 and port 5434 available on localhost

Install `mkcert` using its official instructions or your operating system package manager, then
install its local certificate authority:

```bash
mkcert -install
mkdir -p .certs
mkcert \
  -cert-file .certs/family-budget.localhost.pem \
  -key-file .certs/family-budget.localhost-key.pem \
  family-budget.localhost localhost 127.0.0.1 ::1
```

The `.certs/` directory contains a private key and is ignored by Git. Never commit or share it.
The reserved `.localhost` domain resolves to the local machine without a DNS entry.

## Configure the environment

Create the ignored production environment file:

```bash
cp .env.prod.example .env.prod
```

Generate independent values. A hexadecimal database password is intentional: it can be copied
into `DATABASE_URL` without URL encoding.

```bash
openssl rand -hex 32       # POSTGRES_PASSWORD
openssl rand -base64 48   # JWT_SECRET
openssl rand -base64 48   # REFRESH_TOKEN_SECRET
openssl rand -base64 24   # optional starting point for SEED_USER_PASSWORD
```

Edit `.env.prod` and replace every placeholder. `POSTGRES_PASSWORD` must also replace the password
inside `DATABASE_URL`; its host stays `postgres` and its port stays `5432` because those values are
used inside the Compose network. Keep these fixed values:

```dotenv
NODE_ENV=production
PORT=3000
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d
CORS_ORIGIN=https://family-budget.localhost
```

Set `ADMIN_EMAIL` and `SEED_USER_EMAIL` to the same address. The API needs `ADMIN_EMAIL` to permit
that user to download database backups. Do not reuse any generated secret for another variable.

Every production command below passes `--env-file .env.prod` explicitly. Without it, Compose will
not read the production settings.

## Build and start

Build the local `family-budget-api:prod` and `family-budget-web:prod` images and start the stack:

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build
docker compose --env-file .env.prod -f docker-compose.prod.yml ps -a
```

PostgreSQL starts first. The one-shot `migrate` service applies committed migrations with
`prisma migrate deploy`; only a successful migration allows the API to start, and only a healthy
API allows Nginx to start. An exited migration container with status `0` is expected.

Create the single production login after the first successful start:

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml --profile tools run --rm --no-deps seed
```

The command is manual and idempotent. In production it creates or updates only the user; it never
adds sample financial data. Running it again replaces that user's password with the current
`SEED_USER_PASSWORD`.

Open `https://family-budget.localhost` and sign in with `SEED_USER_EMAIL` and
`SEED_USER_PASSWORD`. Verify the API independently:

```bash
curl --fail https://family-budget.localhost/api/health
```

## Operate the stack

Show status and follow logs:

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml ps -a
docker compose --env-file .env.prod -f docker-compose.prod.yml logs -f web api postgres
```

Stop and restart without removing containers or data:

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml stop
docker compose --env-file .env.prod -f docker-compose.prod.yml start
```

Remove the containers and network while retaining the named database volume:

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml down
```

Never add `--volumes`/`-v` to `down` unless you deliberately intend to delete the production
database.

To connect with a local PostgreSQL client, use host `127.0.0.1`, port `5434`, and the
`POSTGRES_USER`, `POSTGRES_PASSWORD`, and `POSTGRES_DB` values from `.env.prod`. The database port
is bound to loopback and is not available to other computers.

## Update the application

After reviewing and pulling new code, rebuild and recreate the stack:

```bash
git pull --ff-only
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build
docker compose --env-file .env.prod -f docker-compose.prod.yml ps -a
```

The migration gate runs on every deployment. Expect a short outage while the single API and web
containers are recreated.

## Rehearse the Investments migration

Before deploying the Investments migration, perform this rehearsal against an access-controlled
restore of a fresh production backup. It proves the committed migration chain without changing
production. Do not use `prisma migrate dev`, `prisma migrate reset`, or any reset command.

1. Download a new custom-format backup as described below. Validate it before restoring and record
   its SHA-256 digest, creation time, source version, and the operator who received it:

   ```bash
   sha256sum production-before-investments.dump
   pg_restore --list production-before-investments.dump >/dev/null
   ```

   Keep the dump and the restored database on encrypted, access-controlled storage.

2. Restore the dump into an isolated PostgreSQL 16+ instance with a newly created empty database.
   Confirm its transaction count and backup digest before proceeding. Its connection URL must not
   point to production.
3. From the reviewed release checkout, run the rehearsal with a date and accounting month that are
   relevant to the deployment window:

   ```bash
   export REHEARSAL_DATABASE_URL='postgresql://...isolated-restored-copy...'
   export REHEARSAL_CONFIRM='restored-production-copy'
   scripts/rehearse-investments-migration.sh \
     --as-of 2026-09-29 \
     --report-month 2026-09 \
     --output /secure/path/investments-migration-rehearsal
   ```

   The script uses the same non-interactive `prisma migrate deploy` operation as the deployment
   gate. Preserve its output directory with the backup metadata. It records and compares the
   transaction count/checksum, per-account EUR balances, and monthly budget totals. It also proves
   every pre-existing scalar initial balance became exactly one EUR instrument initial balance and
   writes the Bank/Brokerage/Exchange accounts still awaiting progressive financial-institution
   onboarding.

4. Proceed only when the command exits successfully and an operator reviews the generated
   `institution-onboarding.tsv`. Any mismatch, migration failure, unexpected transaction change,
   unavailable backup metadata, or inability to complete the smoke check is a release failure.
   Keep production on its existing release; do not retry against production.
5. Record the command's start/end time and resulting artifact directory in the release record.
   The expected availability impact is the normal short outage while the single API and web
   containers are recreated after the migration gate completes.
6. After production deployment, verify the migration container exited with status `0`, then sign
   in and check the Accounts page, one monthly balance report, one monthly budget report, and
   `curl --fail https://family-budget.localhost/api/health`.

If deployment fails after the backup has been validated, an authorized operator recovers from that
backup manually; this is not part of the deployment command:

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml stop api web
docker compose --env-file .env.prod -f docker-compose.prod.yml exec -T postgres sh -c \
  'pg_restore --clean --if-exists --no-owner -U "$POSTGRES_USER" -d "$POSTGRES_DB"' \
  < production-before-investments.dump
```

Validate the restored transaction count/checksum against the rehearsal artifacts before accepting
the recovery. Restart only from a clean checkout at the previous reviewed release, following
**Update the application** above. Never use a reset command as recovery.

## Download a backup

Sign in as `ADMIN_EMAIL`, open **Settings → General → Administration**, and choose **Create
backup**. The API runs `pg_dump` inside its container and streams the resulting `.dump` file to the
browser, so the file is saved on the host rather than inside a container.

The dump contains financial and authentication data and is not encrypted. Store it in an encrypted
location. Restore procedures are intentionally documented separately and are not repeated here.
