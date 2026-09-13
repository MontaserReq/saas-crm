# Permissions Coverage Matrix

This document describes the current authorization contract. It is documentation only; the database permission catalog and server-side checks are the source of truth.

| Module | Permission | Description | Default roles | Server protected |
| --- | --- | --- | --- | --- |
| Users | `users.view`, `users.create`, `users.update` | View and maintain user records | Admin, Super Admin | Yes |
| Users | `users.disable`, `users.enable` | Disable/enable accounts and revoke sessions | Super Admin | Yes |
| Users | `users.manage_permissions`, `users.manage_roles` | Grant direct permissions and assign roles | Super Admin | Yes |
| Users | `users.view_security`, `users.view_sessions`, `users.manage_access_restrictions` | Security and IP restriction administration | Super Admin | Yes |
| Users | `users.transfer_work`, `users.manage_reporting` | Work transfer and reporting hierarchy | Super Admin | Yes |
| Roles | `roles.view`, `roles.update`, `roles.delete`, `roles.assign` | Role and role-permission administration | Super Admin | Yes |
| Departments | `departments.manage` | Department CRUD and membership | Admin, Super Admin | Yes |
| Task types | `task_types.manage` | Task type CRUD | Admin, Super Admin | Yes |
| Schools | `schools.view`, `schools.view_all`, `schools.create`, `schools.update`, `schools.delete`, `schools.import`, `schools.export`, `schools.assign` | Registry and assignment operations | Role-dependent | Yes |
| School approval | `schools.approve_edit`, `schools.approve_delete` | Approve/reject requested changes | Admin, Super Admin | Yes |
| Tickets | `tickets.view_assigned`, `tickets.view_all`, `tickets.create`, `tickets.mark_seen`, `tickets.accept`, `tickets.reject`, `tickets.add_note`, `tickets.transfer`, `tickets.complete`, `tickets.close`, `tickets.contact_attempt`, `tickets.resubmit`, `tickets.view_history`, `tickets.view_activity`, `tickets.assign` | Ticket lifecycle and scoped access | Role-dependent | Yes |
| Activity | `activity.view`, `activity.view_all`, `activity.view_ticket`, `activity.view_school` | Unified activity and changes log | Role-dependent | Yes |
| Audit logs | `audit_logs.view`, `audit_logs.export` | Sensitive audit access | Super Admin | Yes |
| Messages | `messages.view`, `messages.send`, `messages.attachments`, `messages.delete`, `messages.view_all` | Private internal messaging | Role-dependent | Yes |
| Chat | `chat.view`, `chat.send`, `chat.attachments` | Private direct chat and SSE stream | Role-dependent | Yes |
| Notifications | `notifications.view`, `notifications.mark_read`, `notifications.mark_all_read` | User-owned notification operations | Role-dependent | Yes |
| Calendar | `calendar.view`, `calendar.create`, `calendar.update`, `calendar.delete`, `calendar.view_all` | Scoped calendar events | Role-dependent | Yes |
| To-Do | `todo.view`, `todo.create`, `todo.update`, `todo.delete` | Private owned To-Do items | All operational roles | Yes; owner scoped |
| Attachments | `attachments.upload`, `attachments.view`, `attachments.download`, `attachments.delete` | Authorized file operations | Role-dependent | Yes; parent object scoped |
| Search | `search.view` | Global search over authorized records | Authenticated roles | Yes; object scoped |
| Analytics | `analytics.view`, `analytics.view_users`, `analytics.view_tickets`, `analytics.view_schools`, `analytics.view_time_spent` | Operational reporting | Admin, Super Admin | Yes |
| Reports | `reports.view`, `reports.generate`, `reports.export_pdf` | Report generation and export | Role-dependent | Yes |
| AI School Research | `ai_research.view`, `ai_research.create`, `ai_research.run`, `ai_research.reject`, `ai_research.enrich` | Discovery workspace: create/run research jobs, reject or request enrichment of candidates | Admin, School Manager, Super Admin | Yes |
| AI School Research | `ai_research.approve` | Approve a candidate into the School Registry (also requires `schools.create`) | Admin, Super Admin | Yes |
| AI Knowledge Assistant | `ai_assistant.view` | Read-only CRM chatbot — every tool it calls re-checks the same permission that gates the underlying data (e.g. `schools.view` for school lookups); no tool can create/update/delete anything | All operational roles | Yes |

## Authorization rules

- `Role` and direct `UserPermission` grants are separate. Effective permissions are reloaded from the database on every authenticated request.
- `SUPER_ADMIN` is the system break-glass role and is still enforced through the centralized permission helper for ordinary users.
- A permission never replaces object-level authorization: tickets, messages, chat conversations, attachments, To-Do items, schools, and activity are scoped to the current user unless an explicit all-scope permission exists.
- Reporting hierarchy (`reportsToUserId`) is data ownership/flow, not a permission. Server-side validation rejects self-reference and cycles.
- Disabling a user marks the account inactive and closes active login sessions without deleting historical records.
- Login restrictions are checked server-side and denied attempts are stored in the login/session audit records.
- AI-discovered school candidates are never treated as official School records. Approving a candidate requires both `ai_research.approve` and `schools.create`; the import path re-validates against the same School creation rules as manual entry.
