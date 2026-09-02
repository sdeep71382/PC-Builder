DROP TABLE IF EXISTS "ai_tag_suggestions";
DROP TABLE IF EXISTS "tag_value_assignments";
DROP TABLE IF EXISTS "compatibility_tags";
DROP TABLE IF EXISTS "builds";
DROP TABLE IF EXISTS "ai_integrations";

ALTER TABLE "builders" DROP COLUMN "powerSupplyStepId";
ALTER TABLE "builders" DROP COLUMN "headroomPercentage";
ALTER TABLE "builders" DROP COLUMN "buildRetentionDays";
ALTER TABLE "builders" DROP COLUMN "showOutOfStockGreyedOut";
