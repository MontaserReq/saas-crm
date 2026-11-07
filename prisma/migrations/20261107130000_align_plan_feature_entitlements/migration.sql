-- Keep the published commercial catalog aligned with the runtime entitlement rules.
-- Starter may use the regular AI assistant, but Smart Research (ai_research) is
-- a Growth+ capability and must not be granted by the Starter catalog row.
UPDATE "PlatformPlan"
SET "features" = '["crm","tasks","permissions","custom-fields","import-export","search","reports","ai-limited"]',
    "catalogRevision" = "catalogRevision" + 1,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "slug" = 'starter';
