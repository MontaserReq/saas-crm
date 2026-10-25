-- The product owner approved Starter as the trial entitlement source. Fail the
-- migration rather than silently granting a different or inactive plan.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM "PlatformPlan"
    WHERE "slug" = 'starter'
      AND "isActive" = true
  ) THEN
    RAISE EXCEPTION 'An active Starter platform plan is required before configuring trial entitlements';
  END IF;
END $$;

-- These are lifecycle policy values only. The Starter catalog row, prices,
-- quotas, and persisted feature entitlements are intentionally left unchanged.
INSERT INTO "PlatformSetting" ("id", "key", "value", "updatedAt") VALUES
  ('policy_signup_default_plan_starter', 'signup_default_plan_slug', 'starter', CURRENT_TIMESTAMP),
  ('policy_paid_start_confirmation', 'paid_subscription_start_policy', 'payment_confirmation', CURRENT_TIMESTAMP),
  ('policy_paid_monthly_one_month', 'paid_subscription_monthly_months', '1', CURRENT_TIMESTAMP),
  ('policy_paid_annual_twelve_months', 'paid_subscription_annual_months', '12', CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO UPDATE
SET "value" = EXCLUDED."value",
    "updatedAt" = CURRENT_TIMESTAMP;
