-- Add granular permissions for changing a member's department and password.
INSERT INTO "Permission" ("id", "code", "name", "module", "description")
VALUES
  (gen_random_uuid()::text, 'users.update_department', 'Users update department', 'users', 'Change a member department'),
  (gen_random_uuid()::text, 'users.change_password', 'Users change password', 'users', 'Change a member password')
ON CONFLICT ("code") DO UPDATE SET
  "module" = EXCLUDED."module",
  "description" = EXCLUDED."description";
