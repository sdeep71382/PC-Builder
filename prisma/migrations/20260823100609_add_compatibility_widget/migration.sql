-- CreateTable
CREATE TABLE "compatibility_tags" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopId" TEXT NOT NULL,
    "stepId" TEXT NOT NULL,
    "builderId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'standard',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "compatibility_tags_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "builder_steps" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "tag_value_assignments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "tag_value_assignments_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "compatibility_tags" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "tag_value_assignments_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "step_catalog_assignments" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "builds" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopId" TEXT NOT NULL,
    "builderId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "selections" JSONB NOT NULL,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    "addedToCartAt" DATETIME,
    "convertedAt" DATETIME,
    "lastActivityAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "builds_builderId_fkey" FOREIGN KEY ("builderId") REFERENCES "builders" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ai_tag_suggestions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "suggestedValue" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" DATETIME,
    CONSTRAINT "ai_tag_suggestions_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "compatibility_tags" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ai_tag_suggestions_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "step_catalog_assignments" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ai_integrations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopId" TEXT NOT NULL,
    "geminiApiKeyEncrypted" TEXT,
    "builtInAiEntitled" BOOLEAN NOT NULL DEFAULT false,
    "disclosureAcceptedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_builders" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "powerSupplyStepId" TEXT,
    "headroomPercentage" INTEGER NOT NULL DEFAULT 20,
    "buildRetentionDays" INTEGER NOT NULL DEFAULT 30,
    "showOutOfStockGreyedOut" BOOLEAN NOT NULL DEFAULT false
);
INSERT INTO "new_builders" ("createdAt", "description", "id", "name", "shopId", "status", "updatedAt", "version") SELECT "createdAt", "description", "id", "name", "shopId", "status", "updatedAt", "version" FROM "builders";
DROP TABLE "builders";
ALTER TABLE "new_builders" RENAME TO "builders";
CREATE INDEX "builders_shopId_idx" ON "builders"("shopId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "compatibility_tags_shopId_idx" ON "compatibility_tags"("shopId");

-- CreateIndex
CREATE INDEX "compatibility_tags_stepId_idx" ON "compatibility_tags"("stepId");

-- CreateIndex
CREATE INDEX "compatibility_tags_builderId_idx" ON "compatibility_tags"("builderId");

-- CreateIndex
CREATE UNIQUE INDEX "compatibility_tags_stepId_name_key" ON "compatibility_tags"("stepId", "name");

-- CreateIndex
CREATE INDEX "tag_value_assignments_shopId_idx" ON "tag_value_assignments"("shopId");

-- CreateIndex
CREATE INDEX "tag_value_assignments_assignmentId_idx" ON "tag_value_assignments"("assignmentId");

-- CreateIndex
CREATE UNIQUE INDEX "tag_value_assignments_tagId_assignmentId_key" ON "tag_value_assignments"("tagId", "assignmentId");

-- CreateIndex
CREATE UNIQUE INDEX "builds_token_key" ON "builds"("token");

-- CreateIndex
CREATE INDEX "builds_shopId_idx" ON "builds"("shopId");

-- CreateIndex
CREATE INDEX "builds_builderId_idx" ON "builds"("builderId");

-- CreateIndex
CREATE INDEX "builds_token_idx" ON "builds"("token");

-- CreateIndex
CREATE INDEX "ai_tag_suggestions_shopId_idx" ON "ai_tag_suggestions"("shopId");

-- CreateIndex
CREATE INDEX "ai_tag_suggestions_tagId_idx" ON "ai_tag_suggestions"("tagId");

-- CreateIndex
CREATE INDEX "ai_tag_suggestions_assignmentId_idx" ON "ai_tag_suggestions"("assignmentId");

-- CreateIndex
CREATE UNIQUE INDEX "ai_integrations_shopId_key" ON "ai_integrations"("shopId");
