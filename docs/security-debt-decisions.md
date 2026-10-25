# Security debt decisions

Date: 2026-10-21

## Development dependency findings

`npm audit` reports seven high-severity package nodes and zero critical nodes.
The exact installed paths are:

- `tailwindcss@3.4.19 -> chokidar@3.6.0 -> braces@3.0.3`;
- `tailwindcss@3.4.19 -> micromatch@4.0.8 -> braces@3.0.3`;
- `tailwindcss@3.4.19 -> fast-glob@3.3.3 -> micromatch@4.0.8`;
- `eslint-config-next@15.5.28 -> @next/eslint-plugin-next@15.5.28 -> fast-glob@3.3.1 -> micromatch@4.0.8`.

The advisory is the `braces` deeply nested-pattern stack-exhaustion issue
(GHSA-vfj7-8cjw-p6xm); npm expands the transitive effects into seven findings.
The affected graph is build/lint tooling and is absent from the standalone
runtime. `npm audit --omit=dev --audit-level=high` remains the production gate.

Decision: time-bound deferment, not acceptance as permanently safe. Do not run
Tailwind/ESLint against untrusted glob input, keep CI runners ephemeral and
resource-limited, and review monthly. Npm's suggested fixes are breaking or
unsafe for this stack: Tailwind 4.3.3 requires a planned CSS/config migration;
the ESLint suggestion downgrades `eslint-config-next` to 14.2.35 while the app
runs Next 15.5.28. Create separate upgrade branches with visual regression,
lint, build, and browser gates rather than using `npm audit fix --force`.

## Content Security Policy

Decision: required before production launch; staged rollout is pending real
OAuth, analytics/widget, font, and AI/chatbot origins. Start with a narrowly
scoped `Content-Security-Policy-Report-Only` header and a report endpoint. Build
the policy from observed legitimate violations, not broad wildcards.

Target policy: `default-src 'self'`; `object-src 'none'`; `base-uri 'self'`;
`frame-ancestors 'none'`; strict `form-action`; explicit `connect-src`,
`img-src`, `font-src`, and `frame-src`; and nonce-based `script-src`/`style-src`
where the deployed Next.js rendering path requires it. Generate a per-request
cryptographic nonce in middleware, pass it through the server render, inventory
and remove avoidable inline code, and validate hydration, theme bootstrap,
OAuth callbacks, chatbot/widget loading, PDF/download, and both languages.
Move to enforcing mode only after a staging observation window has no unexplained
violations. Do not use `unsafe-eval`; do not treat `unsafe-inline` as the final
state.

## PostgreSQL row-level security

Decision: materially valuable defense in depth, but deferred from this release
because the current Prisma architecture uses pooled shared-role connections and
does not establish transaction-local tenant context for every query. Enabling a
naive policy now could either break background/platform operations or, worse,
reuse leaked session context across pooled requests.

The implementation project must:

1. inventory every tenant-owned table and add consistent organization keys;
2. use a restricted runtime role while retaining separate migration and tightly
   controlled platform/background roles;
3. wrap each tenant operation in a transaction that performs
   `SET LOCAL app.organization_id = ...`, with context derived from the verified
   session rather than request input;
4. define `USING` and `WITH CHECK` policies, force RLS for the runtime role, and
   make missing context deny by default;
5. prove pool reset behavior, cross-tenant denial, platform administration,
   migrations, jobs, imports, and restore procedures under the real pooler.

Until then, server-derived organization context, tenant-scoped queries,
database constraints, authorization rechecks, and adversarial DB tests remain
the primary boundary. This is not a claim that RLS is enabled.
