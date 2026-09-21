-- Migration: 20260918000001_calendar_multi_assignee_event_types
-- Purpose: Add CalendarEventAssignee for multi-assignee support.
--          Preserves existing userId assignments by seeding the new table.
--          Non-destructive: the userId column on CalendarEvent is NOT dropped.

-- 1. Create the new CalendarEventAssignee table
CREATE TABLE "CalendarEventAssignee" (
    "id"        TEXT NOT NULL,
    "eventId"   TEXT NOT NULL,
    "userId"    TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CalendarEventAssignee_pkey" PRIMARY KEY ("id")
);

-- 2. Unique constraint: one row per (event, user)
CREATE UNIQUE INDEX "CalendarEventAssignee_eventId_userId_key"
    ON "CalendarEventAssignee"("eventId", "userId");

-- 3. Indexes for fast lookups
CREATE INDEX "CalendarEventAssignee_eventId_idx" ON "CalendarEventAssignee"("eventId");
CREATE INDEX "CalendarEventAssignee_userId_idx"  ON "CalendarEventAssignee"("userId");

-- 4. Foreign keys
ALTER TABLE "CalendarEventAssignee"
    ADD CONSTRAINT "CalendarEventAssignee_eventId_fkey"
    FOREIGN KEY ("eventId") REFERENCES "CalendarEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CalendarEventAssignee"
    ADD CONSTRAINT "CalendarEventAssignee_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 5. Seed: copy existing single-assignee relationships into the new table
INSERT INTO "CalendarEventAssignee" ("id", "eventId", "userId", "createdAt")
SELECT
    gen_random_uuid()::text,
    ce."id",
    ce."userId",
    ce."createdAt"
FROM "CalendarEvent" ce
WHERE ce."userId" IS NOT NULL
ON CONFLICT ("eventId", "userId") DO NOTHING;
