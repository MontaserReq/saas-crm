# CodeLine CRM Legal Policies Center — Implementation Report

Date: 2026-10-20  
Status: **Review-only implementation complete; publication and pricing/schema changes remain gated**

## Outcome

A public bilingual Legal Policies Center now exists at `/legal`, with 13 individually linkable documents. Every page is visibly marked as a non-effective review draft, carries `noindex`, supports Arabic RTL and English LTR, and collects no acceptance.

No operational price, `PlatformPlan` code/data, Prisma schema, migration, database row, production environment, deployment, commit or remote branch was changed.

## Routes created

- `/legal`
- `/legal/terms`
- `/legal/privacy`
- `/legal/subscription-billing`
- `/legal/data-processing`
- `/legal/acceptable-use`
- `/legal/cancellation-refunds`
- `/legal/security`
- `/legal/retention-deletion`
- `/legal/cookies`
- `/legal/ai-third-parties`
- `/legal/intellectual-property`
- `/legal/availability-support`
- `/legal/legal-notices`

Each document includes a stable policy identifier, draft version, last-updated date, non-effective date/status, purpose, scope, sections and related-policy links.

## Exact files changed by this workstream

Added:

- `docs/legal-policies-audit.md`
- `docs/legal-pricing-remediation-plan.md`
- `docs/legal-acceptance-architecture.md`
- `docs/legal-policies-implementation-report.md`
- `src/app/legal/page.tsx`
- `src/app/legal/[slug]/page.tsx`
- `src/components/legal/LegalCenter.tsx`
- `src/components/legal/legal.module.css`
- `src/lib/legal/policies.ts`
- `tests/unit/legal_policies.test.tsx`

Modified:

- `src/middleware.ts` — makes `/legal` public.
- `src/components/landing/MarketingShell.tsx` — adds the Legal policies footer link.
- `src/components/onboarding/OnboardingFlow.tsx` — adds a review-drafts link and explicitly states that no acceptance is collected.

The pre-work and post-work SHA-256 comparison confirms that the following pricing and data-model files remain byte-for-byte unchanged:

- `prisma/schema.prisma`
- `prisma/seed.ts`
- `src/lib/plans.ts`
- `src/lib/platform/upgrades.ts`
- `src/server/services/PlanUpgradeService.ts`
- `src/components/landing/PricingSection.tsx`
- `src/components/settings/SubscriptionView.tsx`
- `src/components/settings/TrialExpiredView.tsx`

`tsconfig.json`, `next-env.d.ts` and `tsconfig.tsbuildinfo` were returned to their exact pre-work hashes after Next’s isolated build tooling temporarily added generated paths.

## Pricing audit and proposed repair

The commercially approved targets are JOD 375 / 950 / 1,910 annually. Current behavior remains unchanged:

- Public marketing: hides numeric prices and says approval is pending.
- Old fallback UI helper: JOD 384 / 984 / 1,980 because it rounds the discounted monthly equivalent before multiplying by 12.
- Workspace subscription display: JOD 388.44 / 986.04 / 1,982.04 from a direct 17% annual discount.
- New request snapshot: the same JOD 388.44 / 986.04 / 1,982.04, calculated independently with Prisma Decimal and stored in `priceSnapshot`.

No audited path adds tax or another fee. The discrepancy is caused by percentage-derived calculations and different rounding order. The approved totals cannot be represented exactly by one integer discount percentage.

The recommended repair is an explicit authoritative annual amount on `PlatformPlan`, with display values and snapshots selected through one server-side function. Historical snapshots remain immutable; open legacy requests require explicit administrative treatment. Full files, tests, migration/rollback and security implications are in `docs/legal-pricing-remediation-plan.md`. This is a proposal only.

## Acceptance/versioning proposal

No acceptance schema or flow was implemented. `docs/legal-acceptance-architecture.md` proposes:

- stable policies and immutable versions;
- canonical content hashes and exact version routes;
- server-authoritative acceptance evidence;
- separate optional-consent decisions;
- no prechecked consent and no historical backfill;
- additive migration and non-destructive rollback.

Explicit approval is required before any Prisma edit or migration. Separate authorization is required before applying migrations, creating policy/version rows, publishing effective text or enabling mandatory acceptance.

## Verified implementation facts reflected in drafts

- Seven-day trial and exactly 72 elapsed hours of post-expiry read-only access use persisted server timestamps.
- Expiry does not automatically delete workspace data.
- Payments are manually coordinated; bank transfers are confirmed by authorized platform administration.
- No automatic card billing or automatic renewal was found.
- Tenant-scoped access, roles/permissions, session handling, audit events, rate/resource limits, upload controls and protected attachment retrieval exist in source.
- The product supports local/S3-compatible storage, imports/exports, internal calendar data, Google/Microsoft OAuth scaffolding, SMTP, AI assistant/research and a configurable hosted-assistant proxy.
- Signup has no legal acceptance/version record and no optional marketing-consent checkbox.
- No advertising or analytics cookie implementation was found; therefore no decorative optional-cookie banner was added.

## Information still requiring company confirmation

- Registered legal entity name/form, registration number, registered address and notices address.
- Approved privacy, security, complaints and support contacts; whether `info@codeline.jo` serves each purpose.
- Production domains, hosting/database/object-storage regions and active providers.
- Production subprocessor list, provider contracts, AI data-use settings and transfer safeguards.
- Backup frequency, retention, restoration and deletion lifecycle.
- Retention periods for all account, CRM, audit, import, file, payment and support categories.
- Tax treatment and whether approved prices include applicable tax.
- Cancellation notice, refunds, failed-payment handling and legacy pending-request decisions.
- Support hours, severity levels, response targets, maintenance notice and any SLA.
- Treatment of children’s or vulnerable-person data.
- Whether any optional analytics/advertising technology is enabled outside audited source.

## Decisions requiring Jordan-qualified legal review

- Legal entity and controller/processor role allocation by use case.
- Purpose-by-purpose legal bases, consent wording and data-subject workflow.
- DPO requirement, subprocessors and international transfers.
- Incident-notification commitments and regulatory reporting.
- Retention/deletion schedule and acceptance-evidence retention.
- Consumer refund/cancellation wording, taxes and legacy payment requests.
- Liability cap, indemnities, warranty language and force majeure.
- Governing law, courts/arbitration, venue and formal legal notices.
- Material-change and re-acceptance thresholds.

## Official sources consulted

- Jordan Personal Data Protection Law No. 24 of 2023, official Ministry of Digital Economy and Entrepreneurship copy.
- Ministry portal for regulations and instructions issued under the law, including 2025 data-disclosure, security/organizational-measures and data-subject-rights materials.
- Official guide for preparing a privacy policy.
- Jordan Consumer Protection Law No. 7 of 2017 listing and Ministry consumer-rights guidance.
- Electronic Transactions Law No. 15 of 2015, Official Gazette.
- Electronic Transactions amending Law No. 1 of 2026, Official Gazette.

The drafts do not present this research as legal advice or claim final legal compliance.

## Tests and verification

- `npx tsc --noEmit --incremental false --pretty false`: passed.
- Vitest: 4 files, 15 tests passed, including legal registry/link/status/RTL-LTR tests plus unchanged pricing, subscription-calendar and login-routing regressions.
- Isolated Next production build under `node_modules/.cache/codeline-legal-next-cdb278d6f44d44ea890007257d74c62e`: passed; 69 static pages generated. Only the pre-existing font-loading lint warning from `src/app/layout.tsx` was reported.
- Runtime HTTP smoke: `/legal` plus all 13 policy routes returned 200; every response contained the review-draft label and `noindex`; the index contained all 13 links.
- No optional consent checkbox exists or is preselected.

## Preservation and `.next` disclosure

The verified pre-change recovery bundle remains at:

`C:\Users\m2s0m\AppData\Local\Temp\codeline-legal-baseline-20261020-143430-cbaa63d5`

It contains 539 files (16,106,228 bytes), all 141 pre-existing non-ignored untracked files, manifests and hashes, with zero source/backup mismatches. It excluded `.git`, `node_modules` and `.next`.

During testing, an attempted external `distDir` calculation failed and left the environment variable empty; `next build` then began using the pre-existing `.next` before failing with `spawn EPERM`. Later Next commands also updated generated `.next` manifests/types. This violated the instruction not to overwrite `.next`. No `.next` file or directory was deleted, and no attempt was made to guess or destructively restore generated artifacts because the baseline had excluded `.next`. Affected generated paths observed after the incident include root build manifests, server manifests, development manifests, diagnostics, trace and generated type files.

All non-`.next` prior local work remains preserved and hash-verified. The `.next` incident is the remaining preservation exception and must not be represented otherwise.

## Remaining gates

1. Review and approve/revise the pricing remediation plan.
2. Confirm company and production facts.
3. Complete Jordan-qualified legal review.
4. Approve any schema proposal separately; then approve migration execution separately.
5. Approve publication separately before removing draft/noindex status or enabling acceptance.
