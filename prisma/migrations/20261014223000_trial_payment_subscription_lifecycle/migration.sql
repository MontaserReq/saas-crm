-- Preserve trial history independently from the current paid subscription
-- window. A database check prevents accidental trial-duration drift.
ALTER TABLE "PlatformSubscription"
  ADD COLUMN "trialStartedAt" TIMESTAMP(3),
  ADD COLUMN "trialEndsAt" TIMESTAMP(3);

UPDATE "PlatformSubscription"
SET "trialStartedAt" = "startsAt", "trialEndsAt" = "endsAt"
WHERE "status" = 'TRIAL' AND "endsAt" IS NOT NULL;

ALTER TABLE "PlatformSubscription" ADD CONSTRAINT "PlatformSubscription_trial_window_check"
CHECK (
  ("trialStartedAt" IS NULL AND "trialEndsAt" IS NULL)
  OR ("trialStartedAt" IS NOT NULL AND "trialEndsAt" = "trialStartedAt" + INTERVAL '7 days')
);

-- Extend the existing upgrade request into a manual-payment activation
-- request. Historical rows remain readable; new requests snapshot commercial
-- terms from the authoritative catalog and workspace currency.
ALTER TABLE "PlanUpgradeRequest"
  ADD COLUMN "priceSnapshot" DECIMAL(12,2),
  ADD COLUMN "currencySnapshot" TEXT,
  ADD COLUMN "confirmedAmount" DECIMAL(12,2),
  ADD COLUMN "confirmedCurrency" TEXT,
  ADD COLUMN "paymentReference" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "paymentNote" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "paymentConfirmedById" TEXT,
  ADD COLUMN "paymentConfirmedAt" TIMESTAMP(3),
  ADD COLUMN "activatedAt" TIMESTAMP(3);

DROP INDEX IF EXISTS "PlanUpgradeRequest_one_pending_per_organization";
ALTER TABLE "PlanUpgradeRequest" DROP CONSTRAINT IF EXISTS "PlanUpgradeRequest_status_check";

UPDATE "PlanUpgradeRequest" SET "status" = 'PENDING_PAYMENT' WHERE "status" = 'PENDING';
UPDATE "PlanUpgradeRequest" SET "status" = 'ACTIVATED', "activatedAt" = COALESCE("reviewedAt", "updatedAt") WHERE "status" = 'APPROVED';

CREATE UNIQUE INDEX "PlanUpgradeRequest_one_open_per_organization"
ON "PlanUpgradeRequest" ("organizationId")
WHERE "status" IN ('PENDING_PAYMENT', 'PAYMENT_CONFIRMED');

CREATE INDEX "PlanUpgradeRequest_payment_status_createdAt_idx"
ON "PlanUpgradeRequest" ("status", "createdAt");

ALTER TABLE "PlanUpgradeRequest" ADD CONSTRAINT "PlanUpgradeRequest_status_check"
CHECK ("status" IN ('PENDING_PAYMENT', 'PAYMENT_CONFIRMED', 'ACTIVATED', 'REJECTED', 'CANCELLED'));

ALTER TABLE "PlanUpgradeRequest" ADD CONSTRAINT "PlanUpgradeRequest_snapshot_check"
CHECK (
  ("priceSnapshot" IS NULL AND "currencySnapshot" IS NULL)
  OR ("priceSnapshot" IS NOT NULL AND "priceSnapshot" >= 0 AND length("currencySnapshot") BETWEEN 3 AND 12)
);

ALTER TABLE "PlanUpgradeRequest" ADD CONSTRAINT "PlanUpgradeRequest_confirmation_check"
CHECK (
  ("paymentConfirmedAt" IS NULL AND "paymentConfirmedById" IS NULL AND "confirmedAmount" IS NULL AND "confirmedCurrency" IS NULL)
  OR ("paymentConfirmedAt" IS NOT NULL AND "paymentConfirmedById" IS NOT NULL AND "confirmedAmount" IS NOT NULL AND "confirmedAmount" >= 0 AND "confirmedCurrency" IS NOT NULL)
);

ALTER TABLE "PlanUpgradeRequest" ADD CONSTRAINT "PlanUpgradeRequest_paymentConfirmedById_fkey"
FOREIGN KEY ("paymentConfirmedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
