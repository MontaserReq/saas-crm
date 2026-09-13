-- Add explicit approval-request permissions and the Super Admin ticket-delete capability.
INSERT INTO "Permission" ("id", "code", "name", "module", "description")
VALUES
  (md5('approval_requests.view' || clock_timestamp()::text), 'approval_requests.view', 'approval requests view', 'approval_requests', 'View school approval requests'),
  (md5('approval_requests.decide' || clock_timestamp()::text), 'approval_requests.decide', 'approval requests decide', 'approval_requests', 'Approve or reject school approval requests'),
  (md5('tickets.delete' || clock_timestamp()::text), 'tickets.delete', 'tickets delete', 'tickets', 'Delete tickets permanently (Super Admin only)')
ON CONFLICT ("code") DO NOTHING;

-- Keep the existing Administrator role able to manage the approval queue.
INSERT INTO "RolePermission" ("id", "roleId", "permissionId")
SELECT md5('approval-role-' || r."id" || '-' || p."id"), r."id", p."id"
FROM "Role" r
JOIN "Permission" p ON p."code" IN ('approval_requests.view', 'approval_requests.decide')
WHERE r."name" = 'ADMIN'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
