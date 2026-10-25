# CodeLine CRM Smart Setup

This document records the original Smart Setup implementation. The current four-stage flow, editable recommendations, checklist, and latest verification results are documented in [personalized-setup-report.md](personalized-setup-report.md).

## What existed

The application uses Next.js server actions, Prisma/PostgreSQL, database-backed login sessions, shared roles, per-user permission grants, and active organization membership checks. Business records and configuration already belong to an organization. The existing public registration creates an ADMIN, a department, and an organization membership.

Implemented CRM capabilities include clients/companies, leads, contacts, deals, pipelines and stages, tasks, tickets, calendar, proposals, and typed custom fields. Organization settings already hold enabled modules and configurable lists. Settings and pipeline screens can revise configuration without deleting records. There is no general property inventory, course/enrollment module, or generic customer import. The existing school import is a separate, school-specific workflow.

The previous onboarding had four screens combining account/company data, priority, plan selection, and optional email authorization. Preferences were stored in browser local storage, with no configuration engine. Its enabled-module setting did not filter the navigation. A new organization reached the existing broad dashboard with empty statistics and school-focused controls.

## Implemented flow

Account creation asks for name, email, password, and confirmation. Passwords stay in component memory and are cleared after account creation. Registration establishes the account and its tenant before the three setup screens:

1. **Your business:** company/team name, industry, and team-size range.
2. **Your priorities:** an industry-adapted question with three business-language choices; an optional tracking-method question. Skipping selects sales/starting-fresh defaults.
3. **Review and start:** supported modules, actual suggested stages and optional lead fields, availability notes, and **Create my workspace**. The standard option uses the generic sales setup without extra custom fields.

There are no mandatory billing, email integration, or tutorial screens. Provisioning leads directly to `/dashboard`, which has a localized workspace summary and an inline form to add a real customer/lead. It offers links to records, teammate creation, and settings according to the user's permissions. It creates no sample records or invented statistics. Subsequent customer creation remains available on this focused dashboard.

Recommended text fields can be entered later on the lead detail screen through the existing lead-update/custom-value services. Definitions and values both persist; record-update permission and tenant checks apply. The existing custom-field display also shows saved lead values.

The intended human completion time is approximately **2–4 minutes**, assuming the user has their account/company details ready and normal service latency. This is an estimate, **not validated usability performance**. Automated browser journeys exercise functionality, not users' understanding or decision time.

## Templates

Templates are versioned in `src/lib/onboarding/templates.ts`. The preview and server use the same deterministic registry. Unknown industry values and arbitrary configuration keys are rejected; “Other” is the supported generic option.

| Industry | Sales stages before Won/Lost | Optional lead field | Specific limitation |
| --- | --- | --- | --- |
| Professional services | New inquiry → Discovery → Proposal → Agreement | Service of interest | Proposals reuse the current proposal feature |
| Real estate | New inquiry → Needs confirmed → Viewing → Offer | Property of interest | Calendar appointments; no property inventory |
| Education/training | New inquiry → Course interest → Consultation → Registration offer | Course of interest | Tasks/follow-ups; no catalog/enrollment records |
| Software/technology | New inquiry → Qualified → Demo → Proposal | Solution of interest | Proposals reuse the current proposal feature |
| Sales/commerce | New inquiry → Qualified → Quote → Negotiation | Product of interest | Existing CRM opportunities; no inventory implied |
| Other | New → Qualified → Meeting → Proposal | Customer interest | Generic supported CRM |

Every setup starts with overview, clients, contacts, leads, and follow-up tasks. Sales adds deals/stages; services/technology also recommend proposals. Follow-ups/requests add calendar and tickets. Real estate/training recommend calendar. Relationship-focused setups omit sales stages. Tracking answers affect first-dashboard guidance; team size is retained as a preference and never changes access rights.

## Persistence and security

`OrganizationSettings.onboardingState` stores versioned progress, validated answers, owner ID, current step, and lifecycle timestamps. A null value identifies an existing organization; those users retain their previous dashboard/navigation and are never forced into setup. Authenticated incomplete owners are redirected back to their saved screen when entering dashboard routes.

Inputs are autosaved after 650 ms, with a saved-state indicator. Continue, Back, and Finish later flush the current valid draft through a serialized client request queue. Refreshing/reopening resumes the last successful server save. An abrupt close before the debounce or before a network request succeeds can lose the most recent unsaved edit; previously saved progress is preserved. Passwords and business answers are not saved in browser local storage.

Server actions obtain the authenticated user themselves and revalidate active membership. No organization ID, role ID, permission list, module list, field definition, or stage payload is accepted from the wizard. Only the original owner with organization-management permission can change pending setup. New owners receive a server-defined allowlist through the existing `UserPermission` model. It does not grant platform authority or global role management; shared role grants for existing tenants remain unchanged. The public signup always uses ADMIN and `isPlatformAdmin: false`.

The unique user email and registration transaction prevent duplicate tenants/accounts. Credential-verified recovery is limited to active, unrestricted, non-platform owners of a pending workspace, with exactly one active membership and matching ADMIN role. It also recovers when account creation committed but the login-cookie response failed. It never changes an existing user's role.

Provisioning uses a serializable transaction and a conditional claim on the saved draft. Organization defaults, modules, optional custom fields, pipeline/stages, completed state, and completion events commit together. Write conflicts are retried; a partial failure rolls back configuration and leaves the draft resumable. Repeating completion returns the completed state and cannot reapply a template. Existing pipelines/field definitions are preserved. Later revisions use Settings and Pipelines; hiding navigation does not delete records or replace authorization checks.

Desktop and mobile navigation read the same persisted module choices and intersect them with existing permissions. Workspace menu choices can be revised in Settings. The onboarding, review, welcome screen, and new menu controls support Arabic RTL and English LTR, native labelled controls, keyboard input, responsive cards, clear errors, dark mode, and Tajawal for Arabic.

## Migrations

Three additive migrations were implemented and applied to the **local PostgreSQL database**:

- `20261013140000_smart_setup`: adds nullable `OrganizationSettings.onboardingState`. No duplicate organization/onboarding model or dynamic tables are introduced.
- `20261013141000_ticket_priority_settings`: adds the already-declared `ticketPriorities` setting if missing. Integration testing found that the pre-existing schema/code used it without a migration.
- `20261013142000_workspace_owner_permission_catalog`: inserts missing existing CRM capability definitions without changing existing role grants. The local seed had replaced the catalog after sales/configuration migrations. Signup assigns the fixed capabilities only to its new owner. The seed now retains those definitions for future seed runs; the destructive seed was **not run**.

Deployment requires the normal `prisma migrate deploy`, generated Prisma client, and a server restart. The verified local preview is on port 3002; older running development servers may still hold the previous Prisma client. No external hosting deployment was performed. Unrelated pre-existing integration/schema work remains outside this change.

## Measurement

The existing audit stream records anonymous signup starts with an opaque HTTP-only attempt cookie, signup completion, setup start, progress saves, completed/skipped steps, resume/abandon, successful/failed provisioning, and the first persisted client/lead creation. Metadata uses step/template/version and timing values, without email addresses, passwords, customer names, or raw business answers. First-use events come from record services after persistence and are claimed once per organization.

Run the read-only aggregate report:

```powershell
npx tsx scripts/onboarding-metrics.ts
# Optional: $env:ONBOARDING_METRICS_DAYS='30'
```

The report includes signup/onboarding conversion, organizations completing each step, skipped steps, explicit abandonment, resumes, inactive drafts, provisioning failure rate, and median/p90 time to a usable workspace and first useful action. Skipped optional screens count as advancing that step. Durations use server timestamps. Browser-close abandonment events are best effort; inactive drafts and missing later funnel events support inferred drop-off. No third-party analytics dependency was added. Evaluate real-user completion times before making any five-minute claim.

## Verification

- **57 focused tests passed** across nine files: 12 template/input tests, seven bilingual UI tests, 12 real PostgreSQL onboarding tests, and 26 existing session/platform/request/tenant/web-security tests.
- PostgreSQL coverage includes industry persistence, skips, Arabic stages, standard setup, resume, wrong-role/tenant payload rejection, missing auth, non-owner denial, concurrent account/tenant creation, login-cookie failure recovery, concurrent completion, injected provisioning failure after pipeline writes and recovery, legacy organizations, immutable completion, once-only first-use telemetry, and actual custom-value persistence/permission/cross-tenant checks. All tagged fixtures are removed after tests.
- **48 browser layout checks passed:** three screens × two languages × two themes × four widths (320, 390, 820, 1440). Two real browser journeys passed signup, reload/new-context resume, provisioning, real lead creation, recommended-field entry/persistence, permission-aware desktop/mobile navigation, and menu revision without deleting the lead. There were no page errors, horizontal overflow, or unlabelled wizard controls. Screenshots were inspected, including Arabic desktop and dark mobile layouts. Browser fixtures were removed.
- Automated end-to-end timings with screenshot capture: approximately **18.5 seconds English** and **14.4 seconds Arabic** on the final visual pass. These figures are not representative human usability results.
- TypeScript, lint, production build, Prisma validation, migration deployment/status, and the read-only metrics command were run. Lint/build retain the existing Next.js custom-font warning; no new lint errors were reported.
- The entire Vitest suite was also run: **413 passed, 28 failed, 15 skipped** across 50 files (eight failed files, including one fixture-dependent suite failing during setup). This is not a green full-suite result. The opt-in onboarding PostgreSQL suite accounts for 11 of the skipped tests in that run and passed separately.

The full-suite failures are outside the new onboarding tests:

| Files | Observed cause |
| --- | --- |
| `unit/permissions`, `unit/ai_assistant_help`, `security/privacy_and_immutability` | Fixtures expect an unmarked SUPER_ADMIN role to bypass checks; the current platform boundary requires the explicit marker |
| `unit/password_reset`, `security/password_reset_security` | Short/malformed fixture tokens are rejected by the current token validation before the outcomes those tests expect |
| `unit/reset_password_redirect` | Existing reset page lacks the React binding expected by the current Vitest JSX transformation |
| `security/resource_guard_database` | Cross-organization test requires a second seeded organization |
| `security/tenant_final_crud_actions` | Required `tenant-org-a`/`tenant-org-b` fixture records are absent |

These failures were reported without weakening the platform boundary, modifying unrelated reset functionality, or running the destructive application seed.

Re-run focused database tests only against a local PostgreSQL database:

```powershell
$env:RUN_SMART_SETUP_DB='1'
npx vitest run tests/unit/smart_setup.test.ts tests/unit/smart_setup_ui.test.tsx tests/integration/smart_setup_database.test.ts
```

The browser script is `scripts/smart-setup-qa.cjs`. It uses an existing Playwright installation supplied through `PLAYWRIGHT_MODULE`, Chrome supplied through `CHROME_EXECUTABLE` if needed, and a localhost server (default port 3002). It adds no application/browser dependency. Screenshots and `results.json` default to the OS temporary folder `codeline-smart-setup-qa`.

## Remaining limits

Human usability testing is still required. General customer import, property inventory, and course/enrollment modules remain unsupported and are described honestly. Email authorization and pricing remain available through the existing product surfaces rather than being prerequisites. Existing detailed CRM/settings pages retain their current localization/design outside the new onboarding surfaces. Persistent browser-close telemetry cannot be guaranteed when the browser or network stops abruptly.
