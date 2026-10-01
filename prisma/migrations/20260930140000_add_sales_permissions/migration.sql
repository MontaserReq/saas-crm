-- Register Phase 3B permissions without changing existing role definitions.
INSERT INTO "Permission" ("id", "code", "name", "module", "description") VALUES
  (gen_random_uuid()::text, 'deals.view', 'View Deals', 'deals', 'View tenant-scoped deals'),
  (gen_random_uuid()::text, 'deals.create', 'Create Deals', 'deals', 'Create deals'),
  (gen_random_uuid()::text, 'deals.update', 'Update Deals', 'deals', 'Update deals and stages'),
  (gen_random_uuid()::text, 'deals.delete', 'Archive Deals', 'deals', 'Archive deals'),
  (gen_random_uuid()::text, 'pipelines.view', 'View Pipelines', 'pipelines', 'View tenant-scoped pipelines'),
  (gen_random_uuid()::text, 'pipelines.manage', 'Manage Pipelines', 'pipelines', 'Create and configure pipelines and stages'),
  (gen_random_uuid()::text, 'tasks.view', 'View CRM Tasks', 'tasks', 'View tenant-scoped CRM tasks'),
  (gen_random_uuid()::text, 'tasks.create', 'Create CRM Tasks', 'tasks', 'Create CRM tasks'),
  (gen_random_uuid()::text, 'tasks.update', 'Update CRM Tasks', 'tasks', 'Update and complete CRM tasks'),
  (gen_random_uuid()::text, 'tasks.delete', 'Archive CRM Tasks', 'tasks', 'Archive CRM tasks')
ON CONFLICT ("code") DO NOTHING;

-- Existing administrators and managers receive the new sales foundation
-- permissions. Membership and tenant scope remain enforced by application code.
INSERT INTO "RolePermission" ("id", "roleId", "permissionId")
SELECT gen_random_uuid()::text, r."id", p."id"
FROM "Role" r CROSS JOIN "Permission" p
WHERE r."name" IN ('ADMIN', 'SUPER_ADMIN', 'SCHOOL_MANAGER')
  AND p."code" IN ('deals.view', 'deals.create', 'deals.update', 'deals.delete', 'pipelines.view', 'pipelines.manage', 'tasks.view', 'tasks.create', 'tasks.update', 'tasks.delete')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
