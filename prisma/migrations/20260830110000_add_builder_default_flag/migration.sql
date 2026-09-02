ALTER TABLE "builders" ADD COLUMN "isDefault" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX "builders_shopId_isDefault_idx" ON "builders"("shopId", "isDefault");

UPDATE "builders"
SET "isDefault" = true
WHERE "id" IN (
  SELECT "id"
  FROM "builders" b
  WHERE b."status" = 'published'
    AND NOT EXISTS (
      SELECT 1
      FROM "builders" existing
      WHERE existing."shopId" = b."shopId"
        AND existing."status" = 'published'
        AND existing."updatedAt" > b."updatedAt"
    )
);
