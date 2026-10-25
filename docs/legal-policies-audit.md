# CodeLine CRM Legal Policies Center — Audit Gate

Status: **Commercial targets confirmed; operational pricing reconciliation remains separately gated**  
Audit date: 2026-10-20  
Repository branch: `phase/02-auth-security`  
Audited commit: `83f14d9ff8b1bcc809bd3f43fac9a11de2b885ee`

This report records the pre-drafting audit required by the Legal Policies Center brief. It is not legal advice and does not publish, approve, or make any policy text binding.

## Preservation baseline

Before any repository change, the existing worktree was copied to:

`C:\Users\m2s0m\AppData\Local\Temp\codeline-legal-baseline-20261020-143430-cbaa63d5`

Verification results:

- 539 source files and 539 backup files.
- 16,106,228 source bytes preserved.
- All 141 non-ignored untracked files were included.
- SHA-256 comparison found 0 missing files and 0 mismatches.
- The bundle contains source and backup manifests, Git status, deleted-file and untracked-file lists, and binary patches for tracked/staged changes.
- `.git`, `.next`, and `node_modules` were intentionally excluded. `.next` was not modified or deleted.

The worktree was already substantially dirty, including modified tracked files, one tracked deletion (`src/app/(dashboard)/page.tsx`), and 141 untracked files. Those changes predate this legal workstream and must be preserved.

## Verified commercial-policy conflict

The requested policy states these approved annual prices:

| Plan | Requested monthly | Requested annual |
| --- | ---: | ---: |
| Starter | JOD 39 | JOD 375 |
| Growth | JOD 99 | JOD 950 |
| Scale | JOD 199 | JOD 1,910 |
| Enterprise | Contact sales | Contact sales |

The current implementation has no dedicated annual-price field. It stores a 17% annual discount and derives totals in multiple ways:

| Plan | Public helper total | Upgrade/payment snapshot total | Requested annual |
| --- | ---: | ---: | ---: |
| Starter | JOD 384 | JOD 388.44 | JOD 375 |
| Growth | JOD 984 | JOD 986.04 | JOD 950 |
| Scale | JOD 1,980 | JOD 1,982.04 | JOD 1,910 |

Evidence:

- `src/lib/plans.ts` stores monthly prices and `annualDiscountPercent: 17`; its public helper first rounds the monthly equivalent, then multiplies by 12.
- `src/lib/platform/upgrades.ts` computes another annual catalog value directly from monthly price and discount.
- `src/server/services/PlanUpgradeService.ts` independently computes the authoritative request `priceSnapshot` from monthly price and the 17% discount.
- `prisma/schema.prisma` and the catalog migrations store `monthlyPrice` and `annualDiscountPercent`, but not an explicit annual total.
- `tests/unit/pricing.test.ts` currently asserts Growth annual pricing of JOD 984.
- `src/components/landing/PricingSection.tsx` says JOD prices and annual billing are awaiting commercial approval and deliberately hides amounts, which also conflicts with the brief's statement that the listed schedule is approved.

On 2026-10-20, the product owner confirmed that JOD 375 / 950 / 1,910 are the approved annual commercial targets. That confirmation does not authorize changing runtime prices, `PlatformPlan`, Prisma, migrations, stored financial snapshots, or public price display. The detailed, approval-gated repair plan is recorded in `docs/legal-pricing-remediation-plan.md`.

## Subscription lifecycle facts verified so far

- New workspaces use a seven-day trial window. The migration includes a database check requiring `trialEndsAt = trialStartedAt + INTERVAL '7 days'` when both values are present.
- Access is calculated from persisted server timestamps and `Date` comparisons.
- `READ_ONLY_GRACE_MS` is exactly `72 * 60 * 60 * 1000`.
- Trial and paid expiries enter read-only access for the first 72 elapsed hours after the stored expiry timestamp.
- Mutation permissions are removed while read-only; permitted data remains viewable.
- After the 72-hour grace, the code still reports an expired read-only state. It does not automatically delete workspace data.
- Paid activation is a manual payment-confirmation flow. A platform-authorized user records confirmation; the requested price and confirmed amount/currency must match before activation.
- Configured paid periods are one UTC calendar month or twelve UTC calendar months, beginning from payment confirmation under the current settings migration.
- No automatic card billing or automatic renewal implementation was found in the audited code.

## Other verified implementation facts

- Public routes currently include `/`, `/pricing`, `/onboarding`, `/login`, password-reset pages, and `/public-search`. No public legal-policy routes currently exist.
- The public marketing shell supports Arabic/English switching and sets RTL/LTR direction.
- The published contact found in the marketing and proposal code is `info@codeline.jo`; the proposal footer also says “Amman, Jordan.” These do not verify a registered legal entity name, registration number, registered office, or privacy officer.
- Signup currently creates an account and workspace without a contractual-terms acceptance control or a policy-version acceptance record.
- The schema has no dedicated immutable policy publication/version model and no user-policy acceptance model.
- Optional onboarding goal checkboxes are not legal consent controls. No optional marketing-consent checkbox was found in signup.
- Tenant-scoped roles, permissions, session records, audit logs, data imports/exports, attachment storage, password reset, Google/Microsoft OAuth scaffolding, SMTP integration, internal calendar data, and AI assistant/research features are implemented.
- AI research uses a Groq-backed provider in the audited source. Provider configuration and contractual data-use terms still require operational confirmation.
- Storage supports local disk or S3-compatible object storage. The production hosting region, active storage driver, subprocessors, backups, disaster recovery, retention periods, and deletion schedule cannot be established from source alone.

## Items requiring company confirmation

- Registered legal entity name, legal form, registration number, registered address, and official notices address.
- Whether `info@codeline.jo` is approved for privacy, support, complaints, legal notices, and data-subject requests, or whether separate addresses apply.
- Production website/application domains and production hosting/database/object-storage regions.
- Actual production subprocessors and their contractual locations/transfer mechanisms.
- Backup schedule, backup retention, restoration process, and deletion behavior.
- Retention periods for account data, CRM records, audit logs, imports, attachments, support records, and expired workspaces.
- Refund, cancellation, dispute, failed-payment, and manual bank-transfer operating rules.
- Service hours, support channels, response targets, maintenance notice practice, and whether any SLA is offered.
- Whether children or vulnerable-person data is prohibited, permitted, or expected in customer-controlled CRM records.
- Cookie/analytics tools actually deployed in production beyond essential session, OAuth-state, language, and theme storage visible in source.

## Decisions required before drafting/public implementation

1. Approve or revise the separate pricing remediation plan before any runtime, schema, catalog, migration, or database change.
2. Separately authorize public price display after the runtime values and financial snapshot path are reconciled.
3. Confirm the missing company and operational facts above; until then, affected documents remain conspicuously marked “Draft — awaiting company confirmation and Jordan-qualified legal review.”
4. Have Jordan-qualified counsel decide the governing-law/jurisdiction language, liability cap, indemnities, statutory consumer-right wording, DPA roles, international transfers, incident-notice language, and re-acceptance thresholds.

## Acceptance architecture status

No schema changes were made. Implementing immutable published policy versions and per-user acceptance records would require a Prisma proposal, security review, migration/rollback plan, and explicit approval before editing `prisma/schema.prisma` or adding/applying a migration.

## Changes made by this legal workstream

- Added the review-only policies center, pricing reconciliation plan, acceptance-architecture proposal, tests and final implementation report described in `docs/legal-policies-implementation-report.md`.
- No pricing implementation, Prisma schema, migration, database row, deployment, commit, push or binding acceptance flow was changed.
- A failed build-isolation attempt did modify generated files inside the pre-existing ignored `.next` directory. Nothing in `.next` was deleted or intentionally restored; exact affected generated paths are disclosed in the final implementation report.
