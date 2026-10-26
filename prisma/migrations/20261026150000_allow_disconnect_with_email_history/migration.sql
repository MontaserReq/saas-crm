-- Keep sent-email history when an organization disconnects its provider.
ALTER TABLE "CustomerEmail" DROP CONSTRAINT "CustomerEmail_integrationId_fkey";

ALTER TABLE "CustomerEmail" ALTER COLUMN "integrationId" DROP NOT NULL;

ALTER TABLE "CustomerEmail"
  ADD CONSTRAINT "CustomerEmail_integrationId_fkey"
  FOREIGN KEY ("integrationId") REFERENCES "ExternalIntegration"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
