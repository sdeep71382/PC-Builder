-- CreateTable
CREATE TABLE "builder_discounts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopId" TEXT NOT NULL,
    "builderId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "thresholdAmount" DECIMAL NOT NULL,
    "discountPercentage" DECIMAL NOT NULL,
    "label" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "builder_discounts_builderId_fkey" FOREIGN KEY ("builderId") REFERENCES "builders" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "builder_discounts_builderId_key" ON "builder_discounts"("builderId");

-- CreateIndex
CREATE INDEX "builder_discounts_shopId_idx" ON "builder_discounts"("shopId");
