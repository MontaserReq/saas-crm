-- Add an explicit user-deletion capability to the tenant RBAC catalog.
INSERT INTO "Permission" ("id", "code", "name", "module", "description")
VALUES (
  gen_random_uuid()::text,
  'users.delete',
  'Users delete',
  'users',
  'Delete a user when no linked data remains'
)
ON CONFLICT ("code") DO UPDATE SET
  "module" = EXCLUDED."module",
  "description" = EXCLUDED."description";
