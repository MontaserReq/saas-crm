-- CreateTable
CREATE TABLE "SchoolResearchJob" (
    "id" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'FIND_NEW',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "location" TEXT NOT NULL,
    "area" TEXT,
    "schoolType" TEXT,
    "requestedCount" INTEGER NOT NULL,
    "requiredFields" TEXT NOT NULL,
    "error" TEXT,
    "aiCallCount" INTEGER NOT NULL DEFAULT 0,
    "sourceCount" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SchoolResearchJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchoolResearchCandidate" (
    "id" TEXT NOT NULL,
    "researchJobId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "city" TEXT,
    "area" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "website" TEXT,
    "contactPerson" TEXT,
    "schoolType" TEXT,
    "address" TEXT,
    "confidence" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "matchedSchoolId" TEXT,
    "rejectionReason" TEXT,
    "researchNotes" TEXT,
    "importedSchoolId" TEXT,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchoolResearchCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchoolResearchSource" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "collectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SchoolResearchSource_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SchoolResearchJob_createdById_createdAt_idx" ON "SchoolResearchJob"("createdById", "createdAt");

-- CreateIndex
CREATE INDEX "SchoolResearchJob_status_idx" ON "SchoolResearchJob"("status");

-- CreateIndex
CREATE UNIQUE INDEX "SchoolResearchCandidate_importedSchoolId_key" ON "SchoolResearchCandidate"("importedSchoolId");

-- CreateIndex
CREATE INDEX "SchoolResearchCandidate_researchJobId_status_idx" ON "SchoolResearchCandidate"("researchJobId", "status");

-- CreateIndex
CREATE INDEX "SchoolResearchCandidate_normalizedName_idx" ON "SchoolResearchCandidate"("normalizedName");

-- CreateIndex
CREATE INDEX "SchoolResearchCandidate_matchedSchoolId_idx" ON "SchoolResearchCandidate"("matchedSchoolId");

-- CreateIndex
CREATE INDEX "SchoolResearchSource_candidateId_idx" ON "SchoolResearchSource"("candidateId");

-- AddForeignKey
ALTER TABLE "SchoolResearchJob" ADD CONSTRAINT "SchoolResearchJob_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolResearchCandidate" ADD CONSTRAINT "SchoolResearchCandidate_researchJobId_fkey" FOREIGN KEY ("researchJobId") REFERENCES "SchoolResearchJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolResearchCandidate" ADD CONSTRAINT "SchoolResearchCandidate_matchedSchoolId_fkey" FOREIGN KEY ("matchedSchoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolResearchCandidate" ADD CONSTRAINT "SchoolResearchCandidate_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolResearchSource" ADD CONSTRAINT "SchoolResearchSource_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "SchoolResearchCandidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
