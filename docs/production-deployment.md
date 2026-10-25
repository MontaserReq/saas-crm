# Production deployment

This project is prepared for a Linux server with Docker, Docker Compose, a
public DNS record, and an HTTPS reverse proxy. The application listens on
private port `3000`; it must not be exposed directly to the internet.

## 1. Prepare the server

Install Docker Engine and the Compose plugin. Point a DNS record such as
`crm.example.com` to the server and configure TLS in the reverse proxy.

Copy the project without `.env`, `node_modules`, `.next`, or local `uploads`:

```bash
git clone <repository-url> codeline-crm
cd codeline-crm
cp .env.production.example .env
```

Edit `.env` and replace every placeholder. Generate strong values instead of
reusing local credentials:

```bash
openssl rand -base64 48   # AUTH_SECRET
openssl rand -base64 32   # database password and/or integration key
```

`DATABASE_URL` must use `db` as its hostname because that is the Compose
database service. If the database password contains characters such as `@`,
`#`, `:`, `/`, or `%`, URL-encode it in `DATABASE_URL` while keeping the raw
password in `POSTGRES_PASSWORD`.

Required production values are `POSTGRES_USER`, `POSTGRES_PASSWORD`,
`POSTGRES_DB`, `DATABASE_URL`, `AUTH_SECRET`, `APP_ORIGIN`, `APP_URL`,
`NEXT_PUBLIC_APP_URL`, and `TRUST_PROXY=single-hop`.

## 2. Configure the reverse proxy

Terminate HTTPS at the proxy and forward requests to the app service at
`app:3000` on the Compose network. The proxy must:

- be the only public ingress to the app;
- overwrite `X-Forwarded-For` with one client IP;
- overwrite `X-Forwarded-Proto` with `https`;
- preserve the public `Host` header; and
- support WebSocket/upgrade headers for chat features.

Do not publish port `3000` from `docker-compose.prod.yml` to the public host.

## 3. Build, migrate, and start

Validate the resolved Compose file first. Missing required variables should
stop the command before any container is created:

```bash
docker compose --env-file .env -f docker-compose.prod.yml config --quiet
docker compose --env-file .env -f docker-compose.prod.yml build --pull
docker compose --env-file .env -f docker-compose.prod.yml up -d db
docker compose --env-file .env -f docker-compose.prod.yml run --rm migrator
docker compose --env-file .env -f docker-compose.prod.yml up -d --no-deps app
```

The migrator runs `prisma migrate deploy` only. Never run `prisma db push` or
the demo seed against production.

Check status and health:

```bash
docker compose --env-file .env -f docker-compose.prod.yml ps
docker compose --env-file .env -f docker-compose.prod.yml logs --tail=200 app
curl -fsS https://crm.example.com/api/health
```

The health endpoint must return HTTP `200` and `{ "status": "ok" }`.

## 4. Storage and backups

The default single-server configuration stores uploads in the named
`uploads_data` volume. Back up this volume together with PostgreSQL. For more
than one app instance, configure private S3-compatible storage instead:
set `STORAGE_DRIVER=s3` and all `S3_*` values, then test upload and download
from the public URL.

At minimum, schedule:

1. daily PostgreSQL backups with retention;
2. a backup of `uploads_data` when local storage is used; and
3. a restore rehearsal into an isolated database before the first release.

## 5. Safe updates

```bash
git pull --ff-only
docker compose --env-file .env -f docker-compose.prod.yml build --pull
docker compose --env-file .env -f docker-compose.prod.yml run --rm migrator
docker compose --env-file .env -f docker-compose.prod.yml up -d --no-deps app
docker compose --env-file .env -f docker-compose.prod.yml ps
```

Migrations are forward-only. Take a verified backup before applying a release;
rollback the application image only when it remains compatible with the
database schema. Restore the database only for confirmed data-integrity damage.

## 6. First-release smoke test

After deployment, verify login, creating a company/user, creating a client,
deal, task, ticket, message, upload/download, password reset email, and one
enabled integration. Confirm that the admin audit log records privileged
changes and that tenant data cannot be reached by changing a URL manually.
