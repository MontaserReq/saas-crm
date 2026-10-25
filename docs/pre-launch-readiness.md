# Pre-launch readiness runbook

Date: 2026-10-21

This runbook supports a staging release decision. It does not certify a
production environment that has not been inspected.

## Required release gates

Run from a clean checkout using the committed lockfile:

```bash
npm ci
npx prisma generate
npx prisma validate
npm run lint
npm run typecheck
npm run test:db:disposable
npm run test:e2e:isolated
npm run db:rehearse-backup
npm run build
npm audit --omit=dev --audit-level=high
```

Database-backed tests must use a disposable loopback or CI PostgreSQL database
and the explicit `RUN_*_DB` flags in `.github/workflows/ci.yml`. Never point
those tests or the destructive seed at staging or production.

## Environment checklist

- `DATABASE_URL`: TLS-enabled PostgreSQL credentials with least privilege.
- `AUTH_SECRET`: unique, randomly generated, at least 32 characters; rotate by
  invalidating active sessions during a planned maintenance window.
- `APP_ORIGIN`: exact public HTTPS origin only.
- `APP_URL` and `NEXT_PUBLIC_APP_URL`: same canonical public origin.
- `TRUST_PROXY=single-hop`: only when one sanitizing ingress is the exclusive
  path to the private app port.
- `INTEGRATION_ENCRYPTION_KEY`: independent random secret for OAuth tokens.
- SMTP credentials and sender identity verified before password-reset smoke.
- `STORAGE_DRIVER=s3` and complete private S3-compatible configuration for
  multi-instance production; local storage is not a durable production store.
- OAuth and chatbot variables are optional; leave all related values unset to
  fail closed when the feature is not configured.
- AI provider keys are server-only. Keep every secret out of `NEXT_PUBLIC_*`.

## Backup, migration, deploy, and rollback

1. Take a database backup and prove it can be restored into an isolated
   database before changing the release environment. Record backup identifier,
   checksum, restore duration, row-count checks, and operator.
2. Build through the isolated process in `docs/release-build.md`; scan the
   standalone artifact before it receives environment secrets.
3. Run `npx prisma migrate deploy` once through the migrator job. Do not use
   `prisma db push` or `prisma db seed` in staging or production.
4. Require a successful migrator exit before starting the new application.
5. Probe `GET /api/health` from inside the private network and through the
   public ingress. Expect `200` with `{ "status": "ok" }`.
6. Smoke login, registration/trial provisioning, password reset delivery,
   tenant-scoped CRUD, pricing/upgrade request creation, upload/download, and
   one enabled integration in staging.
7. Roll application traffic back to the prior compatible image if application
   checks fail. Migrations are forward-only: do not automatically drop columns
   or reverse data migrations. Restore the verified backup only for confirmed
   data-integrity damage and only under an incident decision.

The repeatable local rehearsal is `npm run db:rehearse-backup`; its disposable
PostgreSQL container, custom-format dump, SHA-256 checksum, migration check,
connectivity probe, and critical row-count comparison provide practice evidence
only. Provider-native staging recovery still requires sign-off. The complete
acceptance matrix and operational prerequisites are in
`docs/staging-acceptance.md`.

## Monitoring and alerts

Alert on sustained or abrupt changes in:

- health-check failures, restart count, request 5xx rate, and latency;
- authentication failures, password-reset volume, and rate-limit blocks;
- `WORKFLOW_PAUSED_ENTITLEMENT`, workflow failures, expired operation leases,
  AI research failures/budget exhaustion, and import failures;
- payment confirmation/activation failures and rejected pricing invariants;
- database connection saturation, slow queries, disk usage, backup failures,
  and replica/restore lag where applicable;
- storage errors, rejected upload signatures, OAuth failures, and SMTP errors.

Application logs must remain server-side, access-controlled, and redacted. Do
not log passwords, session tokens, reset tokens, OAuth tokens, authorization
headers, SMTP credentials, database URLs, or uploaded document contents.

## Known residual risks

- PostgreSQL row-level security is not enabled; tenant isolation relies on
  server-derived organization context, scoped queries, constraints, and tests.
- Playwright/axe browser acceptance is part of CI and covers critical flows,
  responsive widths, RTL/LTR, and keyboard interactions. This is not a complete
  manual WCAG certification; assistive-technology and staging sign-off remain.
- Content Security Policy is not enabled. Adding it requires a nonce-compatible
  Next.js rollout and integration/widget validation to avoid breaking scripts.
- The full npm audit includes development-only findings in the Tailwind 3 and
  Next ESLint glob toolchain. Production dependency audit is the release gate;
  a Tailwind 4/ESLint toolchain migration should be scheduled separately.

The exact dependency paths, CSP rollout, and RLS architecture decision are in
`docs/security-debt-decisions.md`.
