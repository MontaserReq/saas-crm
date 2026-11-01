CREATE TABLE "OrganizationAiUsagePolicy" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "monthlyRequestLimit" INTEGER,
    "monthlyCostLimitUsd" DOUBLE PRECISION,
    "maxConcurrentDiscoveries" INTEGER NOT NULL DEFAULT 2,
    "allowPlatformProviders" BOOLEAN NOT NULL DEFAULT true,
    "allowOrganizationProviders" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationAiUsagePolicy_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OrganizationAiUsagePolicy_organizationId_key" ON "OrganizationAiUsagePolicy"("organizationId");
ALTER TABLE "OrganizationAiUsagePolicy" ADD CONSTRAINT "OrganizationAiUsagePolicy_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
