# CRM architecture audit

Date: 2026-09-30

## Baseline

- Next.js 14 App Router with server actions and route handlers.
- PostgreSQL/Prisma; existing migrations are present and the seed currently resets data, so it is development-only.
- JWT in an HttpOnly cookie plus a database-backed `LoginSession` check.
- Global RBAC through `User.roleId`, `RolePermission`, and `UserPermission`.
- Existing operational modules: schools, tickets, ticket approvals, calendar, proposals/templates, notes, attachments, messaging/chat, notifications, audit/activity, todos, and AI school research.
- Arabic/English UI and legacy CodeLine/School terminology are embedded in product copy, permissions, seed data, routes, models, and PDF configuration.

## Critical findings

1. There is no `Organization` or membership model. `User`, `Role`, `Department`, and every business record are global.
2. Tenant isolation is therefore not currently enforceable. Adding an organization filter in the UI would not be sufficient.
3. Many services first load records by globally unique ID and authorize only by role or local ownership. This affects school, ticket approval, calendar, proposal, attachment, message attachment, and research flows.
4. Global search scopes tickets for ordinary users, but school and user searches are global; the route has no tenant boundary.
5. Middleware deliberately bypasses all API paths. Every API route must enforce authentication and authorization itself; this is safe only where each route does so consistently.
6. `CalendarService` validates date ordering but does not validate that assignees or related school/ticket records are in the same security context. It also returns an unbounded collection.
7. `ProposalService` resolves templates and schools by ID without an organization/ownership scope. Proposal and template download routes need the same authorization boundary.
8. Attachments store provider keys and uploader IDs, but the schema has no organization ownership column. Access depends on ticket/message traversal and must be made tenant-aware before multi-tenant rollout.
9. Several request/action entrypoints accept `any` or raw strings. Existing Zod validation is used selectively rather than at every mutation boundary.
10. `School`, `SchoolAssignment`, `SchoolResearch*`, and related permissions are core concepts rather than organization-configurable client/lead concepts.
11. Existing indexes are useful for the current single-tenant workload but do not include a tenant key. New composite indexes should be added with the migration that introduces tenant ownership.
12. The README documents `prisma db push`, while the brief requires migration-only production changes. Production documentation should be corrected before release.

## Recommended implementation order

1. Add `Organization`, `OrganizationMember`, organization settings, membership status, and a server-derived organization context. Keep legacy users/records mapped to a single imported CodeLine organization in a forward-only migration.
2. Add organization ownership to users, roles/permissions, teams/departments, and the existing school/ticket/calendar/proposal/file/activity/audit graph. Backfill before making columns required.
3. Introduce reusable tenant-scoped query helpers and change authorization helpers to scope the record lookup and permission check in one operation.
4. Preserve `School` as a compatibility model initially, while adding generic Client/Contact/Lead/Deal models and an explicit School client type. Migrate UI/routes progressively.
5. Scope search, notifications, messaging, AI research, reports, and exports. Add bounded pagination to large collections.
6. Harden storage and download routes: server-side file inspection, safe object keys, tenant/permission checks before provider access, and non-public local files.
7. Add security regression tests for cross-tenant reads/updates/deletes, same-tenant unauthorized access, organization switching, invitations, proposals, tickets, and files.
8. Add organization defaults/modules/branding/timezone/currency and onboarding after the security boundary is in place.

## Explicitly deferred until the boundary exists

- Removing legacy School fields or routes.
- Renaming existing permissions and database tables in place.
- Billing enforcement, a workflow engine, or a new storage/queue infrastructure.
- Strict CSP rollout without testing the current PDF/upload/chat flows.

