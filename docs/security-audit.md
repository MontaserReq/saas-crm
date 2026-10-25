# Security audit and remediation status

Date: 2026-10-20

This is a source-code and local-verification report, not a claim of absolute
security or a certification of an uninspected production environment.

## Controls verified

- Sessions are signed HttpOnly cookies backed by a live database session.
  Active user, active organization membership, role/direct permissions, plan
  features, subscription window, and IP restrictions are recalculated on each
  authenticated request.
- Platform authority requires both the `SUPER_ADMIN` role and
  `User.isPlatformAdmin = true`; ordinary organization admins fail closed.
- Organization context is server-derived. CRM, tickets, messaging, files,
  search, imports, workflows, billing, OAuth, and AI research use tenant scopes
  or explicit ownership checks. Adversarial local PostgreSQL suites cover core
  cross-tenant and protected-platform-account paths.
- Password reset responses do not enumerate accounts. Tokens are random,
  hashed at rest, expire after three minutes, are atomically single-use, and a
  successful reset revokes active sessions.
- Cookie-authenticated API mutations validate `Origin`/`Referer`; uploads have
  streaming request limits, type/signature checks, Office macro rejection, ZIP
  expansion limits, tenant authorization, and private download disposition.
- Login, reset, public search, chatbot, AI, and import operations use persistent
  PostgreSQL rate limits. Expensive operations also use durable concurrency
  leases, idempotency, ownership fencing, and resource budgets.
- OAuth state is signed, time-limited, and bound to the initiating user,
  provider, scope, and organization. Credential writes reauthorize against
  current database state inside the write transaction; stored tokens use
  authenticated encryption.
- Workflow actions recheck the current actor, membership, execute permission,
  plan feature, and writable subscription in the same transaction as every
  business write. AI research rechecks equivalent current authority before
  provider requests, persisted attempts, candidate writes, and completion.
- Pricing is selected from the authoritative database catalog. Upgrade requests
  snapshot amount, currency, and pricing version; activation uses the immutable
  snapshot and preserves historical requests.
- Production startup validates the exact HTTPS origin and single-hop proxy
  contract. Security headers, an internal PostgreSQL-backed health endpoint,
  a non-root standalone container, and a migration gate are present.

## Dependency status

- `npm audit --omit=dev`: zero production vulnerabilities on 2026-10-20.
- The critical Vitest/Tinypool development chain was removed by upgrading to
  Vitest 4 and Vite 8-compatible React tooling.
- The full development audit still reports high-severity glob-parser findings
  through Tailwind 3 and the Next.js ESLint toolchain. The published `braces`
  dependency has no patched 3.x release; automatic remediation requires a
  breaking Tailwind/toolchain migration. These packages are not copied into the
  standalone runtime artifact. The residual risk is documented rather than
  hidden or force-downgraded.

## Residual risks

- No PostgreSQL row-level security; application scoping remains the primary
  tenant boundary.
- Playwright/axe browser acceptance now runs in CI; it is automated coverage,
  not a complete assistive-technology or WCAG certification.
- No enforcing Content Security Policy yet; the report-only-to-nonce rollout is
  documented in `docs/security-debt-decisions.md` and remains a production gate.
- Backup execution, restore evidence, external monitoring, TLS termination,
  ingress isolation, secret management, and third-party account configuration
  must be verified in the actual release environment.
- AI research runs in-process after request submission. Durable leases prevent
  duplicate authority, but a dedicated queue/worker would improve restart and
  scheduling guarantees.

Operational deployment, rollback, backup, health-check, and monitoring steps
are in `docs/pre-launch-readiness.md`.
