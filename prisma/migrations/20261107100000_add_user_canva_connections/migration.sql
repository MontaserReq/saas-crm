CREATE TABLE "CanvaConnection" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountEmail" TEXT,
    "accessTokenEncrypted" TEXT NOT NULL,
    "refreshTokenEncrypted" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "scopes" TEXT NOT NULL DEFAULT '[]',
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CanvaConnection_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CanvaConnection_organizationId_userId_key" ON "CanvaConnection"("organizationId", "userId");
CREATE INDEX "CanvaConnection_userId_idx" ON "CanvaConnection"("userId");
CREATE INDEX "CanvaConnection_organizationId_idx" ON "CanvaConnection"("organizationId");
ALTER TABLE "CanvaConnection" ADD CONSTRAINT "CanvaConnection_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CanvaConnection" ADD CONSTRAINT "CanvaConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
