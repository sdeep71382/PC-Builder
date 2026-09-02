CREATE TABLE "compatibility_rules" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopId" TEXT NOT NULL,
    "builderId" TEXT NOT NULL,
    "sourceCategory" TEXT NOT NULL,
    "sourceField" TEXT NOT NULL,
    "operator" TEXT NOT NULL,
    "targetCategory" TEXT NOT NULL,
    "targetField" TEXT NOT NULL,
    "comparisonValue" JSONB,
    "severity" TEXT NOT NULL DEFAULT 'error',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "message" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "compatibility_rules_builderId_fkey" FOREIGN KEY ("builderId") REFERENCES "builders" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "compatibility_rules_shopId_idx" ON "compatibility_rules"("shopId");
CREATE INDEX "compatibility_rules_builderId_idx" ON "compatibility_rules"("builderId");
CREATE INDEX "compatibility_rules_shopId_builderId_idx" ON "compatibility_rules"("shopId", "builderId");
