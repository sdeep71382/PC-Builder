import prisma from "../../db.server";
import type { CompatibilityTagRole } from "./types";
import { validateTagValue } from "./compatibility-validation";

export interface CsvRowResult {
  row: number;
  success: boolean;
  message: string;
}

interface ParsedRow {
  row: number;
  catalogReference: string;
  tagName: string;
  value: string;
}

interface MalformedRow {
  row: number;
  message: string;
}

function parseCsvContent(content: string): (ParsedRow | MalformedRow)[] {
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line, index) => {
      const row = index + 1;
      const parts = line.split(",").map((part) => part.trim());
      if (parts.length !== 3 || parts.some((part) => part === "")) {
        return {
          row,
          message:
            "Each row must have exactly three non-empty columns: catalog_reference,tag_name,value.",
        };
      }
      const [catalogReference, tagName, value] = parts;
      return { row, catalogReference, tagName, value };
    });
}

function isMalformed(row: ParsedRow | MalformedRow): row is MalformedRow {
  return !("catalogReference" in row);
}

export async function importCompatibilityValuesCsv(
  shopId: string,
  stepId: string,
  csvContent: string
): Promise<CsvRowResult[]> {
  const step = await prisma.builderStep.findFirst({ where: { id: stepId, shopId } });
  if (!step) {
    throw new Error("Step not found.");
  }

  const rows = parseCsvContent(csvContent);
  const results: CsvRowResult[] = [];

  for (const row of rows) {
    if (isMalformed(row)) {
      results.push({ row: row.row, success: false, message: row.message });
      continue;
    }

    try {
      const tag = await prisma.compatibilityTag.findFirst({
        where: { stepId, shopId, name: row.tagName },
      });
      if (!tag) {
        results.push({
          row: row.row,
          success: false,
          message: `Unrecognized tag "${row.tagName}" on this step.`,
        });
        continue;
      }

      const assignment = await prisma.stepCatalogAssignment.findFirst({
        where: { id: row.catalogReference, shopId, stepId },
      });
      if (!assignment) {
        results.push({
          row: row.row,
          success: false,
          message: `Catalog reference "${row.catalogReference}" is not assigned to this step.`,
        });
        continue;
      }

      const valueError = validateTagValue(tag.role as CompatibilityTagRole, row.value);
      if (valueError) {
        results.push({ row: row.row, success: false, message: valueError.message });
        continue;
      }

      await prisma.tagValueAssignment.upsert({
        where: { tagId_assignmentId: { tagId: tag.id, assignmentId: assignment.id } },
        create: {
          shopId,
          tagId: tag.id,
          assignmentId: assignment.id,
          value: row.value.trim(),
        },
        update: { value: row.value.trim() },
      });
      results.push({ row: row.row, success: true, message: "Value saved." });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to import row.";
      results.push({ row: row.row, success: false, message });
    }
  }

  return results;
}
