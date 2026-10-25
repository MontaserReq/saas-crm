# Staging acceptance plan

Date: 2026-10-21

This is the release-candidate acceptance checklist. Local evidence is useful,
but it does not substitute for checks against the real staging ingress,
managed database, mail provider, object store, OAuth clients, or AI accounts.

## Automated local gate

Prerequisites: Node.js 20, a loopback PostgreSQL server represented by
`DATABASE_URL`, Docker, and the Playwright Chromium installed by
`npx playwright install chromium`.

```bash
npm ci
npx prisma generate
npm run lint
npm run typecheck
npm run test:db:disposable
npm run test:e2e:isolated
npm run db:rehearse-backup
npm audit --omit=dev --audit-level=high
npm run build
```

Both isolated scripts use randomly named synthetic databases, validate their
targets, and delete only resources they created. They must never be pointed at
staging or production. The browser suite covers registration, onboarding,
login/logout, generic password-reset behavior, pricing interval changes,
authenticated dashboard/client/deal/task routes, expired-trial restriction,
English LTR, Arabic RTL, representative widths, keyboard focus, dialog focus,
and automated WCAG 2 A/AA rules. The server test suite remains authoritative
for cross-tenant and authorization paths that a browser smoke cannot safely
prove.

## Staging sign-off record

Record date/time, operator, release image digest, migration job identifier,
and links to logs/screenshots for every row. A failed or unexecuted required row
blocks production review.

| Area | Acceptance action | Expected result | Local status | Staging status |
| --- | --- | --- | --- | --- |
| Health/TLS | Probe `/api/health` internally and via public HTTPS; inspect certificate chain and HTTP-to-HTTPS redirect | 200 JSON internally and externally; valid hostname/chain; no public direct app port | Health route tested | Pending ingress |
| Registration | Create a new synthetic workspace from `/onboarding` | One tenant, owner membership, Starter trial, and completed setup | Automated | Pending staging |
| Login/logout | Sign in, exercise session, log out, replay prior cookie | Valid login works; logout revokes DB session; old cookie is rejected | Automated + server tests | Pending staging |
| Password reset | Request reset for known and unknown addresses, use the delivered link once, then retry it | Same public response; delivered mail; three-minute, one-use token; sessions revoked | UI/security tests | Pending SMTP |
| Tenant isolation | Use two tenants to attempt URL/API/file/search/import access to each other's IDs | Every read/write/download is denied without existence leakage | Server DB suites | Pending staging |
| Plan request | Select monthly and annual plans and create a payment request | Authoritative amount/currency/version snapshot; duplicate pending request prevented | Unit/security suites | Pending staging |
| Payment activation | Confirm bank reference as platform admin, activate, and retry action | Amount/currency validation; atomic activation; retry is idempotent | Security/integration suites | Pending operator workflow |
| Renewal/cancellation | Exercise renewal and cancellation policy with dated synthetic subscriptions | Correct access window and preserved immutable billing history | Service tests | Pending staging |
| Trial/grace | Advance synthetic subscription through day 7 and 72 elapsed hours after expiry | Active trial, then read-only grace, then restricted trial-expired route | Automated expiry + unit tests | Pending staging clock exercise |
| Import/download | Import valid CSV/XLSX and malformed/oversized samples; download tenant files/exports | Valid rows scoped to tenant; unsafe inputs rejected; private authorized download | Security/unit suites | Pending private storage |
| OAuth | Connect each enabled provider, reject tampered/expired state, refresh, disconnect | Exact callback origin/scopes; encrypted tokens; tenant/user-bound state | Security tests | Pending provider credentials |
| AI | Run one allowed request, provider failure, retry, budget exhaustion, and cancellation | Leases/budgets enforced; recoverable state; no secret or cross-tenant leakage | Unit/security suites | Pending provider key/quota |
| SMTP | Verify SPF/DKIM/DMARC alignment, sender, bounce path, reset delivery, and alert delivery | Mail arrives without leaking tokens to logs | Not locally verifiable | Pending credentials/DNS |
| Object storage | Upload/download/delete with private bucket and expired/tampered URL attempts | No public listing; least-privilege key; encrypted transport/storage; tenant checks | App boundary tested | Pending S3 credentials |
| Monitoring/alerts | Force a health failure, 5xx, failed migration, backup failure, SMTP failure, storage failure, and expired operation lease | Dashboard receives metrics/logs; on-call receives deduplicated actionable alert | Not locally verifiable | Pending monitoring/alert channel |
| Backup/restore | Run provider-native backup, restore to a newly named isolated database, compare migrations/counts, connect app read-only | Checksum/identifier retained; restore measured and consistent | Local rehearsal available | Pending managed DB |

## Operational readiness checklist

- TLS/ingress: only the ingress is public; app and PostgreSQL ports are private;
  ingress overwrites forwarding headers; HSTS is enabled after HTTPS is proven;
  `TRUST_PROXY=single-hop` is used only for exactly one trusted proxy.
- Database/network: separate least-privilege runtime and migration credentials;
  TLS required; inbound rules restricted to app/migrator; connection and disk
  alerts configured; provider backups and point-in-time recovery enabled.
- SMTP: dedicated credential, verified sender/domain, TLS, rate/bounce limits,
  and reset plus operational-alert delivery tested.
- Object storage: `STORAGE_DRIVER=s3`; private bucket; public ACLs blocked;
  server-side encryption, lifecycle/retention, CORS, size/type limits, and a key
  limited to the required bucket/prefix.
- Monitoring: collect redacted structured application/ingress/database metrics
  and logs; alert on health, 5xx/latency, restart loops, auth/rate-limit spikes,
  migration/backup/storage/SMTP/OAuth/provider failures, DB saturation/disk,
  payment activation failures, and stuck/expired leases.
- Alert delivery: at least two recipients or an on-call route; warning and
  critical severities; deduplication, acknowledgement, escalation, and a test
  event recorded before sign-off.
- Secret rotation: inventory owner/location/last-rotated/expiry for database,
  `AUTH_SECRET`, integration encryption, SMTP, S3, OAuth, AI, and alert tokens.
  Use dual-key overlap where supported; otherwise schedule maintenance. Rotating
  `AUTH_SECRET` revokes sessions. Rotating the integration encryption key needs
  an explicit token re-encryption or reconnect procedure. Never bake runtime
  secrets into an image or expose them through `NEXT_PUBLIC_*`.

## Recovery sequence

1. Freeze writes and identify the last known-good recovery point.
2. Restore into a new database; never overwrite the damaged database in place.
3. Run `npx prisma migrate status` and compare critical table counts/checksums.
4. Start one application instance with the restored URL on a private network;
   probe health and perform read-only tenant checks.
5. Approve the cutover as an incident decision, retain the old database, and
   monitor closely. Record recovery-point and recovery-time outcomes.
