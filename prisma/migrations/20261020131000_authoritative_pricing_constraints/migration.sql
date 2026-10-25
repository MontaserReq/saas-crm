-- New commercial requests must carry their immutable catalogue version, and a
-- newly activated paid request must identify the resulting subscription.
-- Legacy activated rows with no historical price snapshot remain valid.
ALTER TABLE "PlanUpgradeRequest"
  ADD CONSTRAINT "PlanUpgradeRequest_open_pricing_version_required" CHECK (
    "status" NOT IN ('PENDING_PAYMENT', 'PAYMENT_CONFIRMED')
    OR "pricingVersionSnapshot" IS NOT NULL
  ),
  ADD CONSTRAINT "PlanUpgradeRequest_activation_link_required" CHECK (
    "status" <> 'ACTIVATED'
    OR "priceSnapshot" IS NULL
    OR "activatedSubscriptionId" IS NOT NULL
  );
