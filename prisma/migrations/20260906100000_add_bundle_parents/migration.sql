CREATE TABLE "bundle_parents" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "shopId" TEXT NOT NULL,
  "shopifyProductId" TEXT NOT NULL,
  "shopifyVariantId" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);

CREATE UNIQUE INDEX "bundle_parents_shopId_key" ON "bundle_parents"("shopId");
