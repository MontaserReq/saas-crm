ALTER TABLE "Role" ADD COLUMN "organizationId" TEXT;

CREATE INDEX "Role_organizationId_idx" ON "Role"("organizationId");

ALTER TABLE "Role"
ADD CONSTRAINT "Role_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
