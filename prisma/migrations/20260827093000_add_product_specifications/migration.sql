CREATE TABLE "specification_definitions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "dataType" TEXT NOT NULL,
    "unit" TEXT,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "config" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "product_specifications" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopId" TEXT NOT NULL,
    "shopifyProductId" TEXT NOT NULL,
    "shopifyVariantId" TEXT NOT NULL,
    "specificationDefinitionId" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "product_specifications_specificationDefinitionId_fkey" FOREIGN KEY ("specificationDefinitionId") REFERENCES "specification_definitions" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "specification_definitions_shopId_category_key_key" ON "specification_definitions"("shopId", "category", "key");
CREATE INDEX "specification_definitions_shopId_idx" ON "specification_definitions"("shopId");
CREATE INDEX "specification_definitions_shopId_category_idx" ON "specification_definitions"("shopId", "category");

CREATE UNIQUE INDEX "product_specifications_shopId_shopifyVariantId_specificationDefinitionId_key" ON "product_specifications"("shopId", "shopifyVariantId", "specificationDefinitionId");
CREATE INDEX "product_specifications_shopId_idx" ON "product_specifications"("shopId");
CREATE INDEX "product_specifications_shopId_shopifyProductId_idx" ON "product_specifications"("shopId", "shopifyProductId");
CREATE INDEX "product_specifications_shopId_shopifyVariantId_idx" ON "product_specifications"("shopId", "shopifyVariantId");
CREATE INDEX "product_specifications_specificationDefinitionId_idx" ON "product_specifications"("specificationDefinitionId");
