# CodeLine marketing redesign

Implemented in the existing Next.js application on 13 October 2026. The working tree already contained substantial product, security, onboarding, and pricing changes. This work preserves those changes and shares the existing localization, theme provider, authentication actions, and plan configuration.

## Design resources actually inspected and applied

- Read the installed `find-skills/SKILL.md`, inspected the session’s skill catalog and local skill directories, checked the skills.sh directory, and ran `npx skills find 'saas landing conversion pricing'`.
- Loaded the actual [frontend-design instructions](https://raw.githubusercontent.com/anthropics/skills/main/skills/frontend-design/SKILL.md). Applied product-specific art direction, deliberate typography, a compact color system, varied section composition, and screenshot-based critique. These instructions were read from their source, not installed as an application dependency.
- Loaded [web-design-guidelines](https://raw.githubusercontent.com/vercel-labs/agent-skills/main/skills/web-design-guidelines/SKILL.md) and its [current review rules](https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md). Applied semantic navigation, visible focus, accessible controls, reduced motion, responsive content, directional currency handling, and contrast checks.
- Read the installed computer-use skill while investigating visual testing resources. Native Windows automation was not needed; browser verification used Playwright and axe-core from a temporary directory outside the repository.
- Inspected existing Tailwind tokens, global styles, Inter and IBM Plex Sans Arabic, lucide-react, next-themes, translation context, page routes, Prisma models, and product services/components. Tajawal was not loaded by the existing application, so the existing Arabic font was retained.
- No production dependencies, animation libraries, generated images, or stock imagery were added.

## Design and conversion changes

The page now leads with the customer outcome: keep customer context and the next action visible. A large, aligned headline sits beside a readable product concept; previews show real pipeline, customer, and task fields with explicitly illustrative data. Tab changes are user-triggered and do not simulate live business activity.

The palette uses purple `#7728b8`, burgundy `#351829`, near-white `#fcfbfd`, lavender `#f3eff7`, dark text `#302037`, and accessible muted text `#675c6e`. Scoped dark-mode tokens give the same hierarchy a distinct dark presentation. Existing typography is reused.

Editorial benefits, a burgundy operations section, a custom-field preview, a three-step sequence, first-class pricing, a trust section, and native FAQ disclosures create a varied rhythm. The design removes decorative orbit effects, repeated generic cards, unsupported improvement claims, conflicting plan prices, fabricated popularity language, and claims of a working timed trial or complete email synchronization.

The primary action is **Create your workspace**, linking to the real `/onboarding` flow. The secondary conversion is an email inquiry using `info@codeline.jo`, an existing company contact found in the proposal PDF footer. Mail delivery and mailbox ownership were not independently verified.

## Sections

1. Responsive navigation with existing CL brand mark, section anchors, login, language/theme controls, and workspace CTA.
2. Outcome-focused hero with selectable pipeline/customer/task concepts.
3. Three benefits: customer context, sales visibility, and assigned follow-up.
4. Product showcase for tickets, tasks, meetings, and team coordination.
5. Custom fields and accurately scoped import explanation.
6. Workflow, read-only AI assistance with a representative question, and operational visibility.
7. Real onboarding steps and suitable team types.
8. Four proposed plans, Growth recommendation, and a detailed comparison.
9. Verified access/accountability claims.
10. Ten bilingual FAQs covering capabilities, imports, permissions, plans, limits, trial status, Enterprise, and integrations.
11. Final workspace/contact CTA and one shared footer. No nonexistent legal destinations were added.

## Routes and files changed by this work

| Area | Files |
| --- | --- |
| Homepage and metadata | `src/app/page.tsx`, `src/components/landing/LandingPage.tsx` |
| Shared marketing system | `src/components/landing/MarketingShell.tsx`, `marketing.module.css`, `content.ts`, `ProductPreview.tsx`, `PricingSection.tsx` |
| Dedicated pricing | `src/components/pricing/PricingPage.tsx` (existing `/pricing` route retained) |
| Signup copy | `src/components/onboarding/OnboardingFlow.tsx`: indicative plans, honest trial/provider status, unavailable SMTP choice disabled; registration contract retained |
| Public access and theme | `src/middleware.ts`: only exact `/pricing` made public; `src/components/layout/ThemeToggle.tsx`: uses resolved system theme |
| Next.js async compatibility | `src/lib/auth/session.ts`, `src/lib/security/request.ts`, `src/server/actions/auth.ts`, `src/server/actions/users.ts`: await cookies/headers/request context, retaining permission and authentication logic |
| Regression checks | `tests/security/redirect_security.test.ts`, `auth_session_security.test.ts`, `request_context_security.test.ts` |
| Browser tooling | `scripts/marketing-preview.cjs`, `scripts/marketing-qa.cjs` |
| Isolated verification output | `next.config.mjs`, `.gitignore`; Next.js also added generated QA/build type paths to `tsconfig.json` |

Other working-tree changes, including the Next.js upgrade and async dynamic-route adjustments already occurring in the workspace, are not credited to this redesign.

## Product evidence and boundaries

| Capability | Inspected evidence | Public representation |
| --- | --- | --- |
| Customers, contacts, leads, deals, pipelines | Prisma relations; Client/Contact/Lead/Deal/Pipeline services; Client360View; PipelineKanban | Available product concepts with sample records |
| Tasks, tickets, meetings, messages, calendar | CrmTaskService, TicketService, CalendarService, MessageService and corresponding screens | Owners, dates, statuses, history, and coordination; no performance statistics |
| Custom fields | CustomFieldService supports six entity types and typed fields | Text, selections, numbers, dates, currency, and other supported types |
| Excel/CSV importing | SchoolImportModal; `/api/schools/import` and `/commit`; school import tests | **School records only**; column mapping, duplicate checks, and preview. General CRM imports are not implemented |
| Exports | ExportDropdown and school export utilities/tests | Exports on supported screens; no claim of a universal generic CRM importer |
| Workflow automation | WorkflowService conditions, triggers, and action allow-list; service dispatch calls | Supported record-event follow-ups; no advertised tier-specific advanced branching |
| AI assistant | Read-only allow-list in `src/lib/ai-assistant/tools.ts` and AiAssistantToolService | Tickets/tasks/meetings/school queries within permissions; provider setup required |
| Analytics and access | AnalyticsService, permission checks, organization context, AuditService | Ticket/activity metrics and recorded actions; no revenue forecasting or certification claims |
| Email/calendar integrations | OAuth start/callback routes authorize providers and store tokens | Provider authorization exists; completed email/history/contact/calendar synchronization is not advertised |
| Workspace signup | `registerOrganizationAction` creates organization/settings/admin membership and session | Real signup destination; requires working database and initialized ADMIN role |

## Pricing and trial truth

All displayed prices and user counts come from `src/lib/plans.ts`. They remain **proposed**, not final commercial entitlements.

| Plan | Proposed monthly USD price | Proposed users |
| --- | ---: | ---: |
| Starter | $39 | 3 |
| Growth | $99 | 10 |
| Scale | $199 | 25 |
| Enterprise | Custom agreement | Custom agreement |

Every proposed plan retains essential customer/sales records, tasks/tickets, roles/permissions, custom fields, and supported imports/exports. The comparison does not invent enforced advanced entitlements; automation/analytics/AI allowances are explicitly undecided. There is no unlimited-usage claim.

No checkout, paid subscription, enforced user allowance, self-service upgrade/downgrade, annual purchase, or timed trial was found. The configuration has annual-price proposal helpers, but an annual billing toggle is omitted because purchasing is not supported. Seven days is a proposed trial duration; the existing seven-day session expiration is not a trial implementation. Onboarding text was corrected accordingly.

## Verification

- Production build: **passed** after the final onboarding copy corrections, using `NEXT_DIST_DIR=.next-marketing-build` and `npm run build`. Compilation, lint/type validation, all 51 static-page generation steps, and dependency tracing completed successfully.
- `/` and `/pricing` are statically prerendered. The successful build reported homepage route code about 6.87 kB and first-load JS about 156 kB; dedicated pricing about 2.8 kB and 152 kB. These are bundle sizes, not a measured Lighthouse score.
- Changed marketing components passed targeted Next.js lint. Existing unrelated warnings remain for root font loading, hooks, and product images.
- **60 affected regression tests passed in 8 files**, covering proposed pricing, public/protected route boundaries, asynchronous cookie/header APIs, session checks, auth rate-limit wiring, password-change checks, and school import/export behavior.
- Full repository suite snapshot: **393 passed, 32 failed out of 425 tests**. The failed files were password-reset security, password-reset unit/redirect, privacy/immutability, resource-guard database, tenant CRUD actions, AI help, and permissions. This full-suite run preceded the additional async-cookie regression test. No global green-suite claim is made.
- Playwright + axe-core: **12 cases passed**: English/Arabic × light/dark × desktop 1440, tablet 820, mobile 390. Zero detected WCAG A/AA violations and zero page-runtime errors in those cases.
- Additional overflow checks passed at 320, 360, 720, 1050, 1051, 1280, and 1920 pixels. Comparison tables deliberately scroll inside a keyboard-focusable region.
- Checked one header/footer/h1, valid anchor targets, all preview selections, keyboard FAQ toggling, mobile-menu CTA visibility/Escape/focus return, actual language/theme controls and persistence, and unauthenticated `/pricing`, `/login`, and plan-specific `/onboarding` destinations.
- Additional browser checks walked onboarding to plan selection without submitting registration, confirmed Starter selection survived the steps, and confirmed a system-dark theme toggled to light on the first click. These checks passed after the final copy correction.
- Initial screenshot review found narrow mobile plan cards and awkward Arabic currency ordering. Cards now stack on phones with larger text; USD prices are isolated LTR. Initial axe findings identified sample-label contrast at 4.33:1; the updated text color passed the repeated matrix.
- Screenshots were captured for the complete page, hero, and pricing in all 12 cases. Desktop/light and mobile/RTL/dark views, pricing, and product compositions were visually inspected. Reduced-motion emulation was active during the matrix; there are no autoplay or reveal animations.

Browser artifacts are stored outside the repository at:

`C:/Users/m2s0m/.codex/visualizations/2026/10/12/01a13216-7291-7190-be1a-42cedbd7694c/crm-marketing-qa/`

The directory includes `results.json`, full-page PNGs, hero/pricing PNGs, and dedicated product-section captures. QA dependencies live in the temporary `codeline-marketing-qa` directory, not in package.json.

Run the isolated preview with `node scripts/marketing-preview.cjs`. It serves port 3001 and keeps generated output separate from the default build cache. The browser script documents its runtime module/executable environment variables.

## Limits and decisions still outstanding

- Live account creation and authenticated product journeys were not submitted against the database. The public setup screens/routes and backend contract were inspected; provider authorization, real email delivery, paid billing, and production deployment were not exercised.
- No Safari/Firefox, Lighthouse performance score, measured CLS, or exhaustive assistive-technology certification is claimed. Chrome desktop emulation, programmatic checks, screenshot review, and axe are the available verification used.
- Approve final prices, seats, trial rules, advanced usage entitlements, annual terms, Enterprise commitments, and the intended sales contact before treating these proposals as commercial offers.
- Billing/trial enforcement, generic CRM imports, complete provider synchronization, and the repository’s remaining failing tests require separate product/engineering work.
