-- Reconcile the persisted RBAC catalog with the complete application
-- permission registry. Older production databases were created from a
-- partial catalog, which made whole tenant modules disappear from the role
-- matrix even though the screens and plan entitlements existed.
WITH catalog (code) AS (
  VALUES
    ('activity.view'), ('activity.view_all'), ('activity.view_school'), ('activity.view_ticket'),
    ('ai_assistant.view'),
    ('ai_research.approve'), ('ai_research.create'), ('ai_research.enrich'), ('ai_research.reject'), ('ai_research.run'), ('ai_research.view'),
    ('analytics.view'), ('analytics.view_schools'), ('analytics.view_tickets'), ('analytics.view_time_spent'), ('analytics.view_users'),
    ('approval_requests.decide'), ('approval_requests.view'),
    ('attachments.delete'), ('attachments.download'), ('attachments.upload'), ('attachments.view'),
    ('audit_logs.export'), ('audit_logs.view'),
    ('calendar.create'), ('calendar.delete'), ('calendar.update'), ('calendar.view'), ('calendar.view_all'),
    ('chat.attachments'), ('chat.send'), ('chat.view'),
    ('communications.log'),
    ('custom_fields.create'), ('custom_fields.delete'), ('custom_fields.update'), ('custom_fields.view'),
    ('deals.create'), ('deals.delete'), ('deals.update'), ('deals.view'),
    ('departments.manage'), ('departments.view'),
    ('messages.attachments'), ('messages.delete'), ('messages.groups.create'), ('messages.groups.delete'), ('messages.groups.update'), ('messages.groups.view'), ('messages.send'), ('messages.view'), ('messages.view_all'),
    ('notifications.mark_all_read'), ('notifications.mark_read'), ('notifications.view'),
    ('organization_settings.manage'), ('organization_settings.view'),
    ('pipelines.manage'), ('pipelines.view'),
    ('proposals.create'), ('proposals.delete'), ('proposals.generate'), ('proposals.template.create'), ('proposals.template.delete'), ('proposals.template.update'), ('proposals.template.view'), ('proposals.update'), ('proposals.view'),
    ('reports.export_pdf'), ('reports.generate'), ('reports.view'),
    ('roles.assign'), ('roles.create'), ('roles.delete'), ('roles.update'), ('roles.view'),
    ('schools.approve_delete'), ('schools.approve_edit'), ('schools.assign'), ('schools.create'), ('schools.delete'), ('schools.export'), ('schools.import'), ('schools.update'), ('schools.view'), ('schools.view_all'),
    ('search.view'),
    ('task_types.manage'),
    ('tasks.create'), ('tasks.delete'), ('tasks.update'), ('tasks.view'),
    ('tickets.accept'), ('tickets.add_note'), ('tickets.assign'), ('tickets.close'), ('tickets.complete'), ('tickets.contact_attempt'), ('tickets.correction_approve'), ('tickets.correction_request'), ('tickets.create'), ('tickets.delete'), ('tickets.mark_seen'), ('tickets.reject'), ('tickets.resubmit'), ('tickets.resubmit_approve'), ('tickets.resubmit_request'), ('tickets.transfer'), ('tickets.view_activity'), ('tickets.view_all'), ('tickets.view_assigned'), ('tickets.view_history'),
    ('todo.create'), ('todo.delete'), ('todo.manage_own'), ('todo.update'), ('todo.view'),
    ('users.create'), ('users.disable'), ('users.enable'), ('users.invalidate_sessions'), ('users.manage_access_restrictions'), ('users.manage_permissions'), ('users.manage_reporting'), ('users.manage_roles'), ('users.transfer_work'), ('users.update'), ('users.view'), ('users.view_security'), ('users.view_sessions'),
    ('workflows.activate'), ('workflows.archive'), ('workflows.create'), ('workflows.execute'), ('workflows.executions.view'), ('workflows.update'), ('workflows.view')
)
INSERT INTO "Permission" ("id", "code", "name", "module", "description")
SELECT
  gen_random_uuid()::text,
  catalog.code,
  initcap(replace(catalog.code, '.', ' ')),
  split_part(catalog.code, '.', 1),
  initcap(replace(catalog.code, '.', ' '))
FROM catalog
ON CONFLICT ("code") DO UPDATE SET
  "module" = EXCLUDED."module",
  "description" = COALESCE("Permission"."description", EXCLUDED."description");

-- Keep the tenant owner role complete for existing workspaces. The
-- application still hides the unreleased assistant and school-specific
-- analytics/activity records from the company matrix.
INSERT INTO "RolePermission" ("id", "roleId", "permissionId")
SELECT gen_random_uuid()::text, role."id", permission."id"
FROM "Role" role
CROSS JOIN "Permission" permission
WHERE role."name" = 'SUPER_ADMIN'
  AND permission."code" NOT LIKE 'ai_assistant.%'
  AND permission."code" NOT IN ('activity.view_school', 'analytics.view_schools')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
