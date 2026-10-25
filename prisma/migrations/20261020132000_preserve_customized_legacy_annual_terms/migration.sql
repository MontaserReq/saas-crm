-- The preceding additive migration can safely recognize canonical monthly
-- values. If a deployment had customized the legacy discount while retaining
-- that monthly value, do not silently convert it to the approved annual total;
-- require an explicit annual price from Super Admin instead.
UPDATE "PlatformPlan"
SET "annualPrice" = NULL
WHERE "slug" IN ('starter', 'growth', 'scale')
  AND "annualDiscountPercent" IS DISTINCT FROM 17
  AND "pricingVersion" = 1;
