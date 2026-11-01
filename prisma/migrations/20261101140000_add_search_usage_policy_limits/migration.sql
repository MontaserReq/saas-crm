ALTER TABLE "OrganizationAiUsagePolicy"
  ADD COLUMN "monthlySearchRequestLimit" INTEGER,
  ADD COLUMN "monthlySearchCostLimitUsd" DOUBLE PRECISION;
