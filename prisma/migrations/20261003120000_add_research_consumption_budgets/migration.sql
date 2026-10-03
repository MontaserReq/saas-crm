ALTER TABLE "OperationExecution"
  ADD COLUMN "researchMaxProviderRequests" INTEGER,
  ADD COLUMN "researchMaxSourceRequests" INTEGER,
  ADD COLUMN "researchMaxSourceRequestsPerSchool" INTEGER,
  ADD COLUMN "researchMaxRetries" INTEGER,
  ADD COLUMN "researchMaxTokens" INTEGER,
  ADD COLUMN "researchMaxDurationMs" INTEGER,
  ADD COLUMN "researchProviderRequests" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "researchSourceRequests" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "researchRetryAttempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "researchInputTokens" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "researchOutputTokens" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "researchTotalTokens" INTEGER NOT NULL DEFAULT 0;
