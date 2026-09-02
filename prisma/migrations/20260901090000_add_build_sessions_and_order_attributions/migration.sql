CREATE TABLE "build_sessions" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "publicSessionId" TEXT NOT NULL,
  "shopId" TEXT NOT NULL,
  "builderId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'STARTED',
  "currency" TEXT,
  "buildValue" DECIMAL,
  "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "validatedAt" DATETIME,
  "cartAddedAt" DATETIME,
  "completedAt" DATETIME,
  "shopifyOrderId" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "build_sessions_builderId_fkey" FOREIGN KEY ("builderId") REFERENCES "builders" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "build_sessions_publicSessionId_key" ON "build_sessions"("publicSessionId");
CREATE INDEX "build_sessions_shopId_idx" ON "build_sessions"("shopId");
CREATE INDEX "build_sessions_shopId_builderId_idx" ON "build_sessions"("shopId", "builderId");
CREATE TABLE "build_selections" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "buildSessionId" TEXT NOT NULL,
  "stepId" TEXT NOT NULL,
  "shopifyProductId" TEXT NOT NULL,
  "shopifyVariantId" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "priceSnapshot" DECIMAL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "build_selections_buildSessionId_fkey" FOREIGN KEY ("buildSessionId") REFERENCES "build_sessions" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "build_selections_buildSessionId_stepId_key" ON "build_selections"("buildSessionId", "stepId");
CREATE INDEX "build_selections_shopifyVariantId_idx" ON "build_selections"("shopifyVariantId");
CREATE TABLE "order_attributions" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "shopId" TEXT NOT NULL,
  "builderId" TEXT NOT NULL,
  "buildSessionId" TEXT NOT NULL,
  "shopifyOrderId" TEXT NOT NULL,
  "shopifyOrderName" TEXT,
  "currency" TEXT,
  "attributedValue" DECIMAL,
  "orderTotal" DECIMAL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "order_attributions_builderId_fkey" FOREIGN KEY ("builderId") REFERENCES "builders" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "order_attributions_buildSessionId_fkey" FOREIGN KEY ("buildSessionId") REFERENCES "build_sessions" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "order_attributions_shopId_shopifyOrderId_buildSessionId_key" ON "order_attributions"("shopId", "shopifyOrderId", "buildSessionId");
CREATE INDEX "order_attributions_shopId_idx" ON "order_attributions"("shopId");
CREATE INDEX "order_attributions_shopId_builderId_idx" ON "order_attributions"("shopId", "builderId");
