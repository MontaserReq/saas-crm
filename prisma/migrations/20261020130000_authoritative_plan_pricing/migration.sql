-- Add explicit, server-authoritative commercial terms without rewriting any
-- historical request snapshot. The percentage column remains legacy metadata.
ALTER TABLE "PlatformPlan"
  ADD COLUMN "annualPrice" DECIMAL(12,2),
  ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'JOD',
  ADD COLUMN "pricingVersion" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "catalogRevision" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "PlatformPlan" ALTER COLUMN "annualDiscountPercent" DROP DEFAULT;

-- Backfill only the known, still-unmodified approved catalogue tuples. A
-- customized record is deliberately left without annual self-service pricing
-- so an administrator must resolve it explicitly instead of receiving a guess.
UPDATE "PlatformPlan"
SET "annualPrice" = CASE "slug"
  WHEN 'starter' THEN 375.00
  WHEN 'growth' THEN 950.00
  WHEN 'scale' THEN 1910.00
END
WHERE ("slug", "monthlyPrice") IN (
  ('starter', 39.00),
  ('growth', 99.00),
  ('scale', 199.00)
);

ALTER TABLE "PlatformPlan"
  ADD CONSTRAINT "PlatformPlan_monthlyPrice_nonnegative" CHECK ("monthlyPrice" IS NULL OR "monthlyPrice" >= 0),
  ADD CONSTRAINT "PlatformPlan_annualPrice_nonnegative" CHECK ("annualPrice" IS NULL OR "annualPrice" >= 0),
  ADD CONSTRAINT "PlatformPlan_annualPrice_not_above_monthly_total" CHECK ("annualPrice" IS NULL OR "monthlyPrice" IS NULL OR "annualPrice" <= "monthlyPrice" * 12),
  ADD CONSTRAINT "PlatformPlan_currency_iso" CHECK ("currency" ~ '^[A-Z]{3}$'),
  ADD CONSTRAINT "PlatformPlan_versions_positive" CHECK ("pricingVersion" > 0 AND "catalogRevision" > 0);

ALTER TABLE "PlanUpgradeRequest"
  ADD COLUMN "pricingVersionSnapshot" INTEGER,
  ADD COLUMN "activatedSubscriptionId" TEXT;

UPDATE "PlanUpgradeRequest" AS request
SET "activatedSubscriptionId" = subscription."id"
FROM "PlatformSubscription" AS subscription
WHERE request."status" = 'ACTIVATED'
  AND subscription."organizationId" = request."organizationId";

ALTER TABLE "PlanUpgradeRequest"
  ADD CONSTRAINT "PlanUpgradeRequest_pricingVersionSnapshot_positive" CHECK ("pricingVersionSnapshot" IS NULL OR "pricingVersionSnapshot" > 0),
  ADD CONSTRAINT "PlanUpgradeRequest_activatedSubscriptionId_fkey" FOREIGN KEY ("activatedSubscriptionId") REFERENCES "PlatformSubscription"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "PlanUpgradeRequest_activatedSubscriptionId_idx" ON "PlanUpgradeRequest"("activatedSubscriptionId");
