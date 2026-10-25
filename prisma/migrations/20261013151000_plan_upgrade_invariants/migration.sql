-- The organization row lock serializes requests and plan changes. The index
-- also enforces one pending request when writing outside the service.
CREATE UNIQUE INDEX "PlanUpgradeRequest_one_pending_per_organization"
ON "PlanUpgradeRequest" ("organizationId") WHERE "status" = 'PENDING';

ALTER TABLE "PlanUpgradeRequest" ADD CONSTRAINT "PlanUpgradeRequest_status_check"
CHECK ("status" IN ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'));
ALTER TABLE "PlanUpgradeRequest" ADD CONSTRAINT "PlanUpgradeRequest_interval_check"
CHECK ("billingInterval" IN ('monthly', 'annual'));

-- Provide the existing public catalog without overwriting administrator edits.
INSERT INTO "PlatformPlan" ("id", "slug", "name", "descriptionEn", "descriptionAr", "monthlyPrice", "annualDiscountPercent", "userLimit", "features", "availability", "recommended", "updatedAt") VALUES
('platform-starter', 'starter', 'Starter', 'For small businesses and early-stage teams.', 'للشركات الصغيرة والفرق في بداياتها.', 39, 17, 3, '["crm","tasks","permissions","custom-fields","import-export","search","reports","ai-limited"]', 'self_serve', false, CURRENT_TIMESTAMP),
('platform-growth', 'growth', 'Growth', 'For growing teams with more advanced operations.', 'للفرق النامية ذات الاحتياجات التشغيلية المتقدمة.', 99, 17, 10, '["crm","tasks","permissions-advanced","custom-fields-expanded","import-mappings","search","analytics","workflows","integrations","audit-expanded","ai-expanded"]', 'self_serve', true, CURRENT_TIMESTAMP),
('platform-scale', 'scale', 'Scale', 'For larger teams with complex processes and governance.', 'للفرق الأكبر ذات العمليات والحوكمة المعقدة.', 199, 17, 25, '["crm","tasks","permissions-advanced","custom-fields-expanded","import-advanced","search","analytics-advanced","workflows-advanced","integrations","audit-governance","ai-expanded","priority-support-proposed"]', 'self_serve', false, CURRENT_TIMESTAMP),
('platform-enterprise', 'enterprise', 'Enterprise', 'For organizations that need a tailored operating model.', 'للمؤسسات التي تحتاج نموذج تشغيل مخصصاً.', NULL, NULL, NULL, '["crm","tasks","permissions-advanced","custom-fields-expanded","import-advanced","search","analytics-advanced","workflows-advanced","integrations","audit-governance","ai-expanded","assisted-onboarding","custom-integrations"]', 'contact_sales', false, CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO NOTHING;
