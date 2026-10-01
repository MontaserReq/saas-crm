CREATE TABLE "CustomFieldDefinition" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "description" TEXT,
  "fieldType" TEXT NOT NULL,
  "required" BOOLEAN NOT NULL DEFAULT false,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "searchable" BOOLEAN NOT NULL DEFAULT false,
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  "options" JSONB,
  "createdById" TEXT,
  "updatedById" TEXT,
  "archivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CustomFieldDefinition_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CustomFieldValue" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "fieldDefinitionId" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "valueText" TEXT,
  "valueNumber" DECIMAL(65,30),
  "valueBoolean" BOOLEAN,
  "valueDate" TIMESTAMP(3),
  "valueJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CustomFieldValue_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CustomFieldDefinition_organizationId_entityType_key_key" ON "CustomFieldDefinition"("organizationId", "entityType", "key");
CREATE INDEX "CustomFieldDefinition_organizationId_entityType_active_displayOrder_idx" ON "CustomFieldDefinition"("organizationId", "entityType", "active", "displayOrder");
CREATE UNIQUE INDEX "CustomFieldValue_organizationId_fieldDefinitionId_entityType_entityId_key" ON "CustomFieldValue"("organizationId", "fieldDefinitionId", "entityType", "entityId");
CREATE INDEX "CustomFieldValue_organizationId_entityType_entityId_idx" ON "CustomFieldValue"("organizationId", "entityType", "entityId");
CREATE INDEX "CustomFieldValue_organizationId_fieldDefinitionId_idx" ON "CustomFieldValue"("organizationId", "fieldDefinitionId");

ALTER TABLE "CustomFieldDefinition" ADD CONSTRAINT "CustomFieldDefinition_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CustomFieldDefinition" ADD CONSTRAINT "CustomFieldDefinition_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CustomFieldDefinition" ADD CONSTRAINT "CustomFieldDefinition_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CustomFieldValue" ADD CONSTRAINT "CustomFieldValue_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CustomFieldValue" ADD CONSTRAINT "CustomFieldValue_fieldDefinitionId_fkey" FOREIGN KEY ("fieldDefinitionId") REFERENCES "CustomFieldDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
