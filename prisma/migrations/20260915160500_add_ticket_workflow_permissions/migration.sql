INSERT INTO "Permission" ("id", "code", "name", "module", "description") VALUES
('perm-ticket-correction-request', 'tickets.correction_request', 'Request Ticket Correction', 'tickets', 'Submit corrected information for an admin decision'),
('perm-ticket-resubmit-request', 'tickets.resubmit_request', 'Request Ticket Resubmission', 'tickets', 'Submit a rejected ticket for admin approval'),
('perm-ticket-correction-approve', 'tickets.correction_approve', 'Approve Ticket Corrections', 'tickets', 'Approve or reject corrected ticket information'),
('perm-ticket-resubmit-approve', 'tickets.resubmit_approve', 'Approve Ticket Resubmissions', 'tickets', 'Approve or reject ticket resubmission and reassignment')
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "RolePermission" ("id", "roleId", "permissionId")
SELECT 'rp-' || r."id" || '-ticket-correction-request', r."id", p."id"
FROM "Role" r CROSS JOIN "Permission" p
WHERE r."name" IN ('SUPER_ADMIN', 'ADMIN', 'SCHOOL_MANAGER', 'MEMBER') AND p."code" = 'tickets.correction_request'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

INSERT INTO "RolePermission" ("id", "roleId", "permissionId")
SELECT 'rp-' || r."id" || '-ticket-resubmit-request', r."id", p."id"
FROM "Role" r CROSS JOIN "Permission" p
WHERE r."name" IN ('SUPER_ADMIN', 'ADMIN', 'SCHOOL_MANAGER', 'MEMBER') AND p."code" = 'tickets.resubmit_request'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

INSERT INTO "RolePermission" ("id", "roleId", "permissionId")
SELECT 'rp-' || r."id" || '-ticket-correction-approve', r."id", p."id"
FROM "Role" r CROSS JOIN "Permission" p
WHERE r."name" IN ('SUPER_ADMIN', 'ADMIN') AND p."code" = 'tickets.correction_approve'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

INSERT INTO "RolePermission" ("id", "roleId", "permissionId")
SELECT 'rp-' || r."id" || '-ticket-resubmit-approve', r."id", p."id"
FROM "Role" r CROSS JOIN "Permission" p
WHERE r."name" IN ('SUPER_ADMIN', 'ADMIN') AND p."code" = 'tickets.resubmit_approve'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
