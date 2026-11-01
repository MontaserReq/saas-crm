CREATE TABLE "OrganizationAiProvider" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "baseUrl" TEXT NOT NULL DEFAULT '',
    "model" TEXT NOT NULL,
    "apiKeyEncrypted" TEXT NOT NULL,
    "customHeadersEncrypted" TEXT,
    "organizationRef" TEXT,
    "timeoutMs" INTEGER NOT NULL DEFAULT 45000,
    "maxOutputTokens" INTEGER NOT NULL DEFAULT 4096,
    "temperature" DOUBLE PRECISION NOT NULL DEFAULT 0.2,
    "capabilities" TEXT NOT NULL DEFAULT '[]',
    "featureKeys" TEXT NOT NULL DEFAULT '[]',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationAiProvider_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OrganizationAiProvider_organizationId_name_key" ON "OrganizationAiProvider"("organizationId", "name");
CREATE INDEX "OrganizationAiProvider_organizationId_enabled_idx" ON "OrganizationAiProvider"("organizationId", "enabled");
CREATE INDEX "OrganizationAiProvider_organizationId_isDefault_idx" ON "OrganizationAiProvider"("organizationId", "isDefault");

ALTER TABLE "OrganizationAiProvider" ADD CONSTRAINT "OrganizationAiProvider_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
