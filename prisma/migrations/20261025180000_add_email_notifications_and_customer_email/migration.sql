-- Durable notification preferences and delivery records.
ALTER TABLE "Notification"
  ADD COLUMN "inAppVisible" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE "UserNotificationPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "inAppEnabled" BOOLEAN NOT NULL DEFAULT true,
    "emailEnabled" BOOLEAN NOT NULL DEFAULT true,
    "categories" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "UserNotificationPreference_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "NotificationDelivery" (
    "id" TEXT NOT NULL,
    "notificationId" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'EMAIL',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "providerMessageId" TEXT,
    "lastError" TEXT,
    "nextAttemptAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "NotificationDelivery_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CustomerEmail" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "recipientEmail" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "bodyText" TEXT NOT NULL,
    "relatedEntityType" TEXT NOT NULL,
    "relatedEntityId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "providerMessageId" TEXT,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CustomerEmail_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserNotificationPreference_userId_key" ON "UserNotificationPreference"("userId");
CREATE INDEX "UserNotificationPreference_organizationId_idx" ON "UserNotificationPreference"("organizationId");
CREATE UNIQUE INDEX "NotificationDelivery_notificationId_channel_key" ON "NotificationDelivery"("notificationId", "channel");
CREATE INDEX "NotificationDelivery_status_nextAttemptAt_idx" ON "NotificationDelivery"("status", "nextAttemptAt");
CREATE UNIQUE INDEX "CustomerEmail_idempotencyKey_key" ON "CustomerEmail"("idempotencyKey");
CREATE INDEX "CustomerEmail_organizationId_createdAt_idx" ON "CustomerEmail"("organizationId", "createdAt");
CREATE INDEX "CustomerEmail_organizationId_relatedEntityType_relatedEntityId_idx" ON "CustomerEmail"("organizationId", "relatedEntityType", "relatedEntityId");

ALTER TABLE "UserNotificationPreference"
  ADD CONSTRAINT "UserNotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "UserNotificationPreference_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "NotificationDelivery"
  ADD CONSTRAINT "NotificationDelivery_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "Notification"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CustomerEmail"
  ADD CONSTRAINT "CustomerEmail_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "CustomerEmail_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "CustomerEmail_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "ExternalIntegration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- The capability is available only on Scale and Enterprise. Existing custom
-- plan edits are preserved; this only appends the approved entitlement.
UPDATE "PlatformPlan"
SET "features" = ("features"::jsonb || '["email_customer_send"]'::jsonb)::text,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "slug" IN ('scale', 'enterprise')
  AND NOT ("features"::jsonb ? 'email_customer_send');

INSERT INTO "Permission" ("id", "code", "name", "module", "description") VALUES
  (gen_random_uuid()::text, 'notification_preferences.view', 'View notification preferences', 'notification_preferences', 'View personal notification delivery preferences'),
  (gen_random_uuid()::text, 'notification_preferences.manage', 'Manage notification preferences', 'notification_preferences', 'Manage personal notification delivery preferences'),
  (gen_random_uuid()::text, 'email_integrations.view', 'View email integrations', 'email_integrations', 'View organization email provider connections'),
  (gen_random_uuid()::text, 'email_integrations.manage', 'Manage email integrations', 'email_integrations', 'Connect, reauthorize, test, or disconnect an organization email provider'),
  (gen_random_uuid()::text, 'customer_email.view', 'View customer email history', 'customer_email', 'View customer email activity'),
  (gen_random_uuid()::text, 'customer_email.send', 'Send customer emails', 'customer_email', 'Send one-to-one customer emails from CRM records')
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "RolePermission" ("id", "roleId", "permissionId")
SELECT gen_random_uuid()::text, role."id", permission."id"
FROM "Role" role
CROSS JOIN "Permission" permission
WHERE role."name" IN ('SUPER_ADMIN', 'PLATFORM_ADMIN')
  AND permission."code" IN (
    'notification_preferences.view', 'notification_preferences.manage',
    'email_integrations.view', 'email_integrations.manage',
    'customer_email.view', 'customer_email.send'
  )
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
