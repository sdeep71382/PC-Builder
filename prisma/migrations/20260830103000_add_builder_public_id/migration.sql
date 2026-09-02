ALTER TABLE "builders" ADD COLUMN "publicId" TEXT;
CREATE UNIQUE INDEX "builders_publicId_key" ON "builders"("publicId");
