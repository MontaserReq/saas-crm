-- CreateTable
CREATE TABLE "PlatformPlan" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "descriptionEn" TEXT NOT NULL DEFAULT '',
    "descriptionAr" TEXT NOT NULL DEFAULT '',
    "monthlyPrice" DECIMAL(12,2),
    "annualDiscountPercent" INTEGER DEFAULT 17,
    "userLimit" INTEGER,
    "features" TEXT NOT NULL DEFAULT '[]',
    "availability" TEXT NOT NULL DEFAULT 'self_serve',
    "recommended" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformSubscription" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'TRIAL',
    "billingInterval" TEXT NOT NULL DEFAULT 'monthly',
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3),
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanUpgradeRequest" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "fromPlanId" TEXT,
    "planId" TEXT NOT NULL,
    "billingInterval" TEXT NOT NULL DEFAULT 'monthly',
    "reason" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewNote" TEXT NOT NULL DEFAULT '',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanUpgradeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformSupportCase" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "subject" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "contactEmail" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "resolution" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformSupportCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformSetting" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformSetting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlatformPlan_slug_key" ON "PlatformPlan"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformSubscription_organizationId_key" ON "PlatformSubscription"("organizationId");

-- CreateIndex
CREATE INDEX "PlatformSubscription_planId_status_idx" ON "PlatformSubscription"("planId", "status");

-- CreateIndex
CREATE INDEX "PlanUpgradeRequest_organizationId_createdAt_idx" ON "PlanUpgradeRequest"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "PlanUpgradeRequest_status_createdAt_idx" ON "PlanUpgradeRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "PlatformSupportCase_organizationId_status_idx" ON "PlatformSupportCase"("organizationId", "status");

-- CreateIndex
CREATE INDEX "PlatformSupportCase_status_createdAt_idx" ON "PlatformSupportCase"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformSetting_key_key" ON "PlatformSetting"("key");

-- AddForeignKey
ALTER TABLE "PlatformSubscription" ADD CONSTRAINT "PlatformSubscription_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformSubscription" ADD CONSTRAINT "PlatformSubscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "PlatformPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanUpgradeRequest" ADD CONSTRAINT "PlanUpgradeRequest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanUpgradeRequest" ADD CONSTRAINT "PlanUpgradeRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanUpgradeRequest" ADD CONSTRAINT "PlanUpgradeRequest_planId_fkey" FOREIGN KEY ("planId") REFERENCES "PlatformPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanUpgradeRequest" ADD CONSTRAINT "PlanUpgradeRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformSupportCase" ADD CONSTRAINT "PlatformSupportCase_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

