-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "scope" TEXT,
    "expires" DATETIME,
    "accessToken" TEXT NOT NULL,
    "userId" BIGINT,
    "firstName" TEXT,
    "lastName" TEXT,
    "email" TEXT,
    "accountOwner" BOOLEAN NOT NULL DEFAULT false,
    "locale" TEXT,
    "collaborator" BOOLEAN DEFAULT false,
    "emailVerified" BOOLEAN DEFAULT false,
    "refreshToken" TEXT,
    "refreshTokenExpires" DATETIME
);

-- CreateTable
CREATE TABLE "builders" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "builder_steps" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopId" TEXT NOT NULL,
    "builderId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "builder_steps_builderId_fkey" FOREIGN KEY ("builderId") REFERENCES "builders" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "step_catalog_assignments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopId" TEXT NOT NULL,
    "builderId" TEXT NOT NULL,
    "stepId" TEXT NOT NULL,
    "referenceType" TEXT NOT NULL,
    "shopifyProductId" TEXT,
    "shopifyVariantId" TEXT,
    "position" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "step_catalog_assignments_builderId_fkey" FOREIGN KEY ("builderId") REFERENCES "builders" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "step_catalog_assignments_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "builder_steps" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "builders_shopId_idx" ON "builders"("shopId");

-- CreateIndex
CREATE INDEX "builder_steps_shopId_idx" ON "builder_steps"("shopId");

-- CreateIndex
CREATE INDEX "builder_steps_builderId_idx" ON "builder_steps"("builderId");

-- CreateIndex
CREATE INDEX "step_catalog_assignments_shopId_idx" ON "step_catalog_assignments"("shopId");

-- CreateIndex
CREATE INDEX "step_catalog_assignments_builderId_idx" ON "step_catalog_assignments"("builderId");

-- CreateIndex
CREATE INDEX "step_catalog_assignments_stepId_idx" ON "step_catalog_assignments"("stepId");
