CREATE TABLE "SearchContentCache" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SearchContentCache_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SearchContentCache_url_key" ON "SearchContentCache"("url");
CREATE INDEX "SearchContentCache_expiresAt_idx" ON "SearchContentCache"("expiresAt");
