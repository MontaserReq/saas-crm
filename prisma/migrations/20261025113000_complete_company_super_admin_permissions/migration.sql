-- Complete the tenant RBAC catalog and make Company Super Admin the full
-- authority for every operational permission in the company workspace.
-- This is additive and idempotent so it safely repairs existing installs.

INSERT INTO "Permission" ("id", "code", "name", "module", "description") VALUES
  (gen_random_uuid()::text, 'departments.view', 'View Departments', 'departments', 'View company departments'),
  (gen_random_uuid()::text, 'schools.view_all', 'View All Customers', 'schools', 'View all tenant customer records'),
  (gen_random_uuid()::text, 'analytics.view_users', 'View User Analytics', 'analytics', 'View analytics by user'),
  (gen_random_uuid()::text, 'analytics.view_tickets', 'View Ticket Analytics', 'analytics', 'View ticket analytics'),
  (gen_random_uuid()::text, 'analytics.view_time_spent', 'View Time Analytics', 'analytics', 'View time-spent analytics'),
  (gen_random_uuid()::text, 'messages.view_all', 'View All Messages', 'messages', 'View all company message threads'),
  (gen_random_uuid()::text, 'chat.attachments', 'Send Chat Attachments', 'chat', 'Send attachments in team chat')
ON CONFLICT ("code") DO NOTHING;

-- A Company Super Admin is not limited by the stale subset that may have been
-- stored when the workspace was first created. Keep the database grant in
-- sync with the effective application-level authority.
INSERT INTO "RolePermission" ("id", "roleId", "permissionId")
SELECT gen_random_uuid()::text, role."id", permission."id"
FROM "Role" role
CROSS JOIN "Permission" permission
WHERE role."name" = 'SUPER_ADMIN'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
