-- Tenant-scoped Smart Lead Discovery staging records. These rows are
-- intentionally separate from Lead: discovered data is untrusted until a
-- user explicitly imports it through LeadService.
CREATE TABLE "LeadDiscoveryJob" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "stage" TEXT NOT NULL DEFAULT 'UNDERSTANDING',
    "requestedCount" INTEGER NOT NULL,
    "filters" TEXT NOT NULL DEFAULT '{}',
    "aiProviderId" TEXT,
    "searchProviderId" TEXT,
    "error" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LeadDiscoveryJob_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LeadDiscoveryResult" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "website" TEXT,
    "normalizedDomain" TEXT,
    "industry" TEXT,
    "businessDescription" TEXT,
    "country" TEXT,
    "city" TEXT,
    "phone" TEXT,
    "normalizedPhone" TEXT,
    "email" TEXT,
    "normalizedEmail" TEXT,
    "linkedin" TEXT,
    "instagram" TEXT,
    "companySize" TEXT,
    "leadRelevanceScore" INTEGER NOT NULL DEFAULT 0,
    "dataCompleteness" INTEGER NOT NULL DEFAULT 0,
    "qualificationReason" TEXT,
    "verificationStatus" TEXT NOT NULL DEFAULT 'UNVERIFIED',
    "conflictDetails" TEXT,
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "importedLeadId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LeadDiscoveryResult_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LeadDiscoverySource" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "resultId" TEXT,
    "url" TEXT NOT NULL,
    "title" TEXT,
    "snippet" TEXT,
    "content" TEXT,
    "sourceType" TEXT NOT NULL DEFAULT 'SEARCH_RESULT',
    "query" TEXT,
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "collectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LeadDiscoverySource_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LeadDiscoveryImport" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "resultId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "leadId" TEXT,
    "importedById" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LeadDiscoveryImport_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LeadDiscoveryImport_jobId_resultId_key" ON "LeadDiscoveryImport"("jobId", "resultId");
CREATE INDEX "LeadDiscoveryJob_organizationId_createdAt_idx" ON "LeadDiscoveryJob"("organizationId", "createdAt");
CREATE INDEX "LeadDiscoveryJob_organizationId_status_idx" ON "LeadDiscoveryJob"("organizationId", "status");
CREATE INDEX "LeadDiscoveryJob_createdById_createdAt_idx" ON "LeadDiscoveryJob"("createdById", "createdAt");
CREATE INDEX "LeadDiscoveryResult_jobId_leadRelevanceScore_idx" ON "LeadDiscoveryResult"("jobId", "leadRelevanceScore");
CREATE INDEX "LeadDiscoveryResult_normalizedDomain_idx" ON "LeadDiscoveryResult"("normalizedDomain");
CREATE INDEX "LeadDiscoveryResult_normalizedEmail_idx" ON "LeadDiscoveryResult"("normalizedEmail");
CREATE INDEX "LeadDiscoveryResult_normalizedPhone_idx" ON "LeadDiscoveryResult"("normalizedPhone");
CREATE INDEX "LeadDiscoveryResult_normalizedName_idx" ON "LeadDiscoveryResult"("normalizedName");
CREATE INDEX "LeadDiscoverySource_jobId_idx" ON "LeadDiscoverySource"("jobId");
CREATE INDEX "LeadDiscoverySource_resultId_idx" ON "LeadDiscoverySource"("resultId");
CREATE INDEX "LeadDiscoverySource_url_idx" ON "LeadDiscoverySource"("url");
CREATE INDEX "LeadDiscoveryImport_organizationId_createdAt_idx" ON "LeadDiscoveryImport"("organizationId", "createdAt");
CREATE INDEX "LeadDiscoveryImport_leadId_idx" ON "LeadDiscoveryImport"("leadId");

ALTER TABLE "LeadDiscoveryJob" ADD CONSTRAINT "LeadDiscoveryJob_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LeadDiscoveryJob" ADD CONSTRAINT "LeadDiscoveryJob_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LeadDiscoveryResult" ADD CONSTRAINT "LeadDiscoveryResult_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "LeadDiscoveryJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LeadDiscoverySource" ADD CONSTRAINT "LeadDiscoverySource_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "LeadDiscoveryJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LeadDiscoverySource" ADD CONSTRAINT "LeadDiscoverySource_resultId_fkey" FOREIGN KEY ("resultId") REFERENCES "LeadDiscoveryResult"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LeadDiscoveryImport" ADD CONSTRAINT "LeadDiscoveryImport_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "LeadDiscoveryJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LeadDiscoveryImport" ADD CONSTRAINT "LeadDiscoveryImport_resultId_fkey" FOREIGN KEY ("resultId") REFERENCES "LeadDiscoveryResult"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LeadDiscoveryImport" ADD CONSTRAINT "LeadDiscoveryImport_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LeadDiscoveryImport" ADD CONSTRAINT "LeadDiscoveryImport_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LeadDiscoveryImport" ADD CONSTRAINT "LeadDiscoveryImport_importedById_fkey" FOREIGN KEY ("importedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
