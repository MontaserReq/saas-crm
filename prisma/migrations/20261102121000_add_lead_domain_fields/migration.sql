ALTER TABLE "Lead" ADD COLUMN "website" TEXT;
ALTER TABLE "Lead" ADD COLUMN "normalizedDomain" TEXT;
CREATE INDEX "Lead_organizationId_normalizedDomain_idx" ON "Lead"("organizationId", "normalizedDomain");
