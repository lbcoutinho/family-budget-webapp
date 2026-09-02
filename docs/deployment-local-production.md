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

## Download a backup

Sign in as `ADMIN_EMAIL`, open **Settings → General → Administration**, and choose **Create
backup**. The API runs `pg_dump` inside its container and streams the resulting `.dump` file to the
browser, so the file is saved on the host rather than inside a container.

The dump contains financial and authentication data and is not encrypted. Store it in an encrypted
location. Restore procedures are intentionally documented separately and are not repeated here.
