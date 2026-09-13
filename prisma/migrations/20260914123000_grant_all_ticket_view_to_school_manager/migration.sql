INSERT INTO "RolePermission" ("id", "roleId", "permissionId")
SELECT md5('all-ticket-view-' || r."id" || '-' || p."id"), r."id", p."id"
FROM "Role" r
JOIN "Permission" p ON p."code" = 'tickets.view_all'
WHERE r."name" = 'SCHOOL_MANAGER'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
