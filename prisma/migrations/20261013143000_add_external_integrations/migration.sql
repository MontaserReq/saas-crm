CREATE TABLE "ExternalIntegration" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "accountEmail" TEXT,
    "accessTokenEncrypted" TEXT NOT NULL,
    "refreshTokenEncrypted" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "scopes" TEXT NOT NULL DEFAULT '[]',
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExternalIntegration_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ExternalIntegration_organizationId_provider_idx" ON "ExternalIntegration"("organizationId", "provider");
CREATE UNIQUE INDEX "ExternalIntegration_organizationId_provider_key" ON "ExternalIntegration"("organizationId", "provider");
ALTER TABLE "ExternalIntegration" ADD CONSTRAINT "ExternalIntegration_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
