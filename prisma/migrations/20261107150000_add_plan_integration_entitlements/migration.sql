CREATE TABLE "PlatformPlanIntegration" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformPlanIntegration_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PlatformPlanIntegration_planId_provider_key" ON "PlatformPlanIntegration"("planId", "provider");
CREATE INDEX "PlatformPlanIntegration_provider_enabled_idx" ON "PlatformPlanIntegration"("provider", "enabled");

ALTER TABLE "PlatformPlanIntegration" ADD CONSTRAINT "PlatformPlanIntegration_planId_fkey" FOREIGN KEY ("planId") REFERENCES "PlatformPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
