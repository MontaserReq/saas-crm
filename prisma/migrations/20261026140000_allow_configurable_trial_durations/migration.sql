-- Trial duration is configured per subscription. Keep the window valid without
-- hard-coding the public signup default of seven days in the database.
ALTER TABLE "PlatformSubscription"
  DROP CONSTRAINT IF EXISTS "PlatformSubscription_trial_window_check";

ALTER TABLE "PlatformSubscription"
  ADD CONSTRAINT "PlatformSubscription_trial_window_check"
  CHECK (
    ("trialStartedAt" IS NULL AND "trialEndsAt" IS NULL)
    OR ("trialStartedAt" IS NOT NULL AND "trialEndsAt" IS NOT NULL AND "trialEndsAt" >= "trialStartedAt")
  );
