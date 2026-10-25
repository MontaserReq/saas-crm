# Personalized CodeLine CRM setup — 13 October 2026

## Existing architecture

The working tree already contained Smart Setup and many unrelated in-progress changes. This implementation extends those files; it does not introduce another onboarding system or replace those changes.

The application uses Next.js App Router, React, TypeScript, Zod, Prisma and PostgreSQL. Registration creates an Organization, its Management department, an ADMIN user and an active OrganizationMember in one transaction. Authentication uses the existing database-backed login session and signed cookie. The owner receives the existing fixed permission allowlist; onboarding accepts no role, permission, tenant or plan identifiers. Active organization membership is resolved on the server. The shared role and platform-admin rules remain unchanged.

OrganizationSettings already stores enabledModules, CRM lists, priorities and nullable onboardingState. Pipelines and ordered PipelineStages, CustomFieldDefinitions and values, customer/contact/lead records, deals, tasks, calendar, tickets and proposals already exist. The existing desktop and mobile navigation respects saved module preferences and permission checks. The I18nProvider and next-themes supply Arabic/English and theme support. Existing AuditLog records provide funnel instrumentation.

Pricing in src/lib/plans.ts is explicitly an indicative proposal. There is no persisted subscription or entitlement model. Paid-plan restrictions cannot be truthfully enforced from that pricing catalog. Client-provided plan IDs are rejected; the engine accepts only implemented modules. An authoritative server-side subscription/entitlement model is required before selling restricted modules. No billing model or plan assignment was invented for onboarding.

## Implemented flow

Registration keeps its existing name, email, password and confirmation fields. Passwords remain in component memory and are cleared after successful registration. The subsequent focused setup has four stages:

1. **Business profile:** company/team name, a short industry choice including agencies/consulting and Other, and an optional description capped at 500 characters.
2. **Goals and team:** multiple selections for customers, leads/opportunities, pipelines, follow-ups, support, internal tasks/appointments, or other processes; a simple team range. Tracking-method details are optional and collapsed. Customers can skip to sales defaults.
3. **Recommended setup:** supported modules with checkboxes; optional pipeline-stage editing under progressive disclosure; a concise field preview. Customers can accept, reset recommendations, or choose standard setup. Deals and pipelines are toggled together. Overview remains available.
4. **Workspace creation:** a short summary with one primary Create my workspace action. The backend applies the validated configuration and redirects to /dashboard.

Answers, customizations, standard-versus-personalized choice, and current stage are saved to the existing tenant-owned onboardingState. Valid edits are debounced; Continue, Back and Finish later flush through the serialized save queue. Invalid edits stay visible and prevent advancement; Back remains available. Four-stage progress, native labeled controls, focus on the new stage heading, loading states and bilingual retry messages support keyboard and mobile use. Arabic team ranges use an explicit LTR bidi span. Refresh resumes from the saved stage. Optional description text is workspace context; the deterministic selections drive recommendations.

The normal CRM overview is available immediately after creation. A relevant optional getting-started checklist can be dismissed and resumed, including after refresh. It offers first customer/lead creation, teammates for teams larger than one, pipeline customization when selected, and a follow-up task when selected. Optional checklist checkboxes are user acknowledgements; first customer completion comes from the existing persisted-record event. The overview is translated and filters its cards, queries and activity to selected modules and existing view permissions. Legacy workspaces keep their existing routing and dashboard branch.

## Configuration and persistence

The deterministic registry in src/lib/onboarding/templates.ts is shared by preview and provisioning. Industry selects actual stage/field templates, and selected goals combine existing modules. A module override can select only the supported enum; dashboard is required and sales modules must be paired. Pipeline overrides accept 1–8 distinct nonempty open-stage names with a maximum of 80 characters each; the server supplies ordered OPEN stages and fixed WON/LOST outcomes. Extra lead fields are optional TEXT definitions and are created only when leads are selected. Existing task priority choices are reused; no new category model or sample tasks are introduced.

Older version-one drafts that lack goals keep their priority-based recommendations. Existing completed three-stage states remain valid. A null onboardingState continues to identify a legacy workspace that does not enter new-organization setup.

Server actions authenticate independently. OnboardingService checks active membership, the organization-settings permission and the persisted original owner. Strict input schemas reject unknown fields, client plan/tenant/role identifiers, unsupported goals/modules and invalid stages. Server provisioning recomputes the proposal from validated saved answers rather than accepting raw database definitions.

An optimistic row claim and serializable transaction serialize progress, provisioning and checklist changes, retrying known write conflicts. Completion is immutable on retries. Existing active pipelines and field definitions are preserved, and existing configured client types, lead statuses, ticket priorities and branding are retained. Failures roll back configuration writes and leave the draft available. No customer records, sales activity, invitations or integrations are fabricated. Checklist updates cannot reapply provisioning. Workspace entry is recorded once and telemetry failures do not block access.

No AI provider, network generation, arbitrary code execution or new dependency is required.

## Files changed in this extension

| Files | Purpose |
| --- | --- |
| src/lib/onboarding/templates.ts | Goal/industry registry, strict customization schemas, four-stage state and checklist lifecycle |
| src/server/services/OnboardingService.ts | Progress and completion validation, preservation, checklist updates and audit events |
| src/server/actions/onboarding.ts | Authenticated checklist action and explicit invalid-input errors |
| src/components/onboarding/OnboardingFlow.tsx | Four-stage bilingual wizard, multi-goal choices, persistence and focus |
| src/components/onboarding/SetupRecommendation.tsx | New editable module/stage recommendation component |
| src/components/onboarding/WorkspaceWelcome.tsx | Optional, persistent and relevant getting-started checklist |
| src/app/(dashboard)/dashboard/page.tsx | Normal overview alongside checklist, permission-filtered modules and once-only entry |
| src/components/crm/CrmDashboardSummary.tsx | Bilingual overview with relevant cards and sections |
| src/server/services/CrmWorkspaceService.ts | Tenant-scoped and permission-filtered personalized dashboard queries |
| scripts/onboarding-metrics.ts | Four-stage funnel, CRM entry and recommendation-versus-customization metrics |
| scripts/smart-setup-qa.cjs | Four-stage real browser journeys, customized persistence and checklist checks |
| tests/unit/smart_setup.test.ts; tests/unit/smart_setup_ui.test.tsx | Expanded deterministic, schema and bilingual wizard coverage |
| tests/integration/smart_setup_database.test.ts | PostgreSQL customization, preservation, isolation and checklist coverage |
| tests/unit/onboarding_checklist.test.tsx | Dismissal, resume, relevance, retry and RTL tests |
| tests/security/onboarding_dashboard.test.ts | Permission and tenant boundary tests for the overview |
| README.md; docs/smart-setup.md; this report | Current usage and verification documentation |

## Migrations and environment

This extension introduces **no new migration or application environment variable**. It adds backward-compatible properties to existing JSON state. The earlier additive Smart Setup migrations and current generated Prisma client must already be deployed through the repository's ordinary deployment process. Existing local migrations, environment, subscription/pricing proposals and unrelated integration work were preserved. No destructive application seed was run.

Browser QA used an existing Playwright installation and Chrome, supplied through the existing QA environment options, without adding a package. The isolated development preview used NEXT_DIST_DIR=.next-smart-setup-qa on port 3002; production compilation used .next-smart-setup-build so the user's existing port-3000 checkout was undisturbed.

## Verification results

- **55 focused tests passed across eight files**, including **15 real local PostgreSQL integration tests**. Coverage includes registration recovery, simultaneous registration, owner permissions, defaults, multiple industries and goals, unsupported inputs, injection of tenant/role/plan identifiers, Arabic stages, concurrent completion, rollback and retry, restored progress, customization persistence, checklist isolation, retained existing configuration and once-only real-record/entry events. Database fixtures were removed by their exact IDs. Intentional injected failures and write-conflict logs are expected in the successful test output.
- **64 browser layout checks passed:** four stages × two languages × two themes × widths 320, 390, 820 and 1440. No horizontal overflow or unlabelled wizard input/select/textarea controls were found.
- **Two full browser journeys passed**, exercising signup, reload and another browser-context resume, multiple goals, module choices, renamed pipeline stages, final-review refresh, workspace creation, checklist dismissal/resume across refresh, real lead creation, field-value persistence, desktop/mobile navigation and later menu edits. Both reported zero JavaScript page errors. Screenshots were inspected, including the English recommendations and Arabic dark mobile confirmation. Tagged test organizations and records were removed.
- Documented automated signup-to-dashboard times were **54.2 seconds English** and **51.7 seconds Arabic**, including screenshot capture, layout changes and local development compilation/resource contention. These are automated test timings, not representative human usability results.
- A final 14-test wizard/checklist/dashboard pass also passed after the last UI copy and focus refinements. TypeScript no-emit check passed. ESLint passed with the existing root-layout custom-font warning. The production build passed. Prisma schema validation passed. The read-only aggregate metrics command completed successfully.
- The **full suite is not green:** **434 passed, 27 failed, 19 skipped**. The failures are in seven pre-existing suites listed below. All new/updated onboarding suites passed. The opt-in PostgreSQL onboarding tests were skipped in the full-suite run and passed in the focused database run.

| Full-suite failures | Observed limitation |
| --- | --- |
| tests/security/password_reset_security.test.ts; tests/unit/password_reset.test.ts | Fixture tokens do not satisfy the existing validation; expected token/password outcomes differ |
| tests/unit/reset_password_redirect.test.tsx | Existing reset page lacks the React binding expected by Vitest's JSX transformation |
| tests/unit/permissions.test.ts; tests/unit/ai_assistant_help.test.ts; tests/security/privacy_and_immutability.test.ts | Fixtures assume an unmarked SUPER_ADMIN bypasses checks; existing platform authority requires an explicit marker |
| tests/security/tenant_final_crud_actions.test.ts | Suite setup requires absent tenant-org-a/tenant-org-b fixtures |

Initial QA attempts encountered a cold-page language/hydration timeout and an outdated mobile-menu selector that selected another expanded-state control. The final four-stage browser run passed after correcting the selector. A type-check run overlapped Next.js regeneration and reported missing generated files; its subsequent standalone run passed. These were not hidden as successful test results.

Focused tests can be repeated against local PostgreSQL:

```powershell
$env:RUN_SMART_SETUP_DB='1'
npx vitest run tests/unit/smart_setup.test.ts tests/unit/smart_setup_ui.test.tsx tests/unit/signup_retry_race.test.ts tests/unit/onboarding_checklist.test.tsx tests/security/onboarding_dashboard.test.ts tests/integration/smart_setup_database.test.ts tests/security/login_routing.test.ts tests/security/platform-boundary.test.ts
npx tsc --noEmit
npm run lint
$env:NEXT_DIST_DIR='.next-smart-setup-build'
npm run build
```

Browser checks are in scripts/smart-setup-qa.cjs. Final screenshots/results were saved to C:/Users/m2s0m/AppData/Local/Temp/codeline-personalized-setup-qa. Full-suite JSON was saved to C:/Users/m2s0m/AppData/Local/Temp/codeline-personalized-tests.json. Those are local QA artifacts, not application data.

## Limits and real completion-time measurement

General customer CSV/Excel import, a project module, property inventory and training enrollment/catalog modules are not supported by the current product. Existing school import is not presented as general customer import. Internal operations use actual tasks and appointments. Optional OAuth routes exist, but there is no verified settings entry for completing integration setup, so an integration checklist item was not fabricated. Optional typed custom fields and detailed views retain their existing configuration surfaces. Advanced task categories and new industry-specific modules need architecture beyond this onboarding extension. Billing entitlements need a persisted authoritative model; rejection of client plan IDs is not equivalent to paid-plan enforcement.

The existing audit stream now additionally records business selection, generated recommendations, completion, actual server dashboard entry and the chosen recommendation/customization mode. Raw descriptions, stage names, customer names, passwords and tokens are excluded from onboarding event metadata. CRM entry records the server route access, not a confirmed browser paint. Browser-close abandonment remains best effort.

Run `npx tsx scripts/onboarding-metrics.ts` for conversion, four-stage completion, failures, pending drafts, median/p90 signup-to-workspace and signup-to-first-record durations, and setup choice counts. A rolling window can contain starts and completions from different cohorts; validate a fixed signup cohort for formal funnel reporting. Local development/test data is not representative production usage.

For a practical five-minute study, recruit at least 10–15 first-time users across supported industries, English/Arabic, desktop/mobile and mixed technical familiarity. Start a stopwatch at the first account screen and stop when the participant sees their usable CRM overview. Keep optional invitations, imports and integrations outside essential setup. Record completion, stage hesitation, errors and retries; use a test workspace per participant with no seeded customers. Report median, p90 and the proportion finishing within 300 seconds. Separately report unusual network outages and any sessions interrupted by researchers. Compare observer timing with server audit timestamps, which begin with the signup-start request and end at successful workspace commit. The five-minute target has **not** been empirically established with representative users.
