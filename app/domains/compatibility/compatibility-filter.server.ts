import prisma from "../../db.server";
import type { BuildSelections, ExcludedOption } from "./types";

export interface CompatibilityFilterResult {
  available: string[];
  excluded: ExcludedOption[];
}

/**
 * Exact-match compatibility filtering for one step, against a shopper's prior
 * selections in earlier steps. Two selections are compatible on a shared
 * standard-role compatibility tag when their values for that tag name are
 * equal; a target item missing a value for a tag name a prior selection
 * constrains is treated as not compatible (FR-005), not as compatible by
 * default. Power-role tags (powerDraw/outputWattage) are handled separately
 * by power-budget.server.ts.
 */
export async function filterStepOptions(
  shopId: string,
  stepId: string,
  priorSelections: BuildSelections
): Promise<CompatibilityFilterResult> {
  const targetTags = await prisma.compatibilityTag.findMany({
    where: { stepId, shopId, role: "standard" },
  });
  const targetTagNames = new Set(targetTags.map((tag) => tag.name));

  const assignments = await prisma.stepCatalogAssignment.findMany({
    where: { stepId, shopId },
  });

  if (targetTagNames.size === 0) {
    // No compatibility tags on this step at all: opt-in filtering means
    // every assigned item is available unfiltered (2026-08-23 clarification).
    return { available: assignments.map((a) => a.id), excluded: [] };
  }

  const targetValues = await prisma.tagValueAssignment.findMany({
    where: { shopId, tag: { stepId, role: "standard" } },
    include: { tag: true },
  });
  const targetValueMap = new Map<string, Record<string, string>>();
  for (const value of targetValues) {
    const existing = targetValueMap.get(value.assignmentId) ?? {};
    existing[value.tag.name] = value.value;
    targetValueMap.set(value.assignmentId, existing);
  }

  const required: Record<string, string> = {};
  for (const [priorStepId, priorAssignmentId] of Object.entries(priorSelections)) {
    if (priorStepId === stepId || !priorAssignmentId) {
      continue;
    }
    const priorValues = await prisma.tagValueAssignment.findMany({
      where: { shopId, assignmentId: priorAssignmentId, tag: { role: "standard" } },
      include: { tag: true },
    });
    for (const value of priorValues) {
      if (targetTagNames.has(value.tag.name)) {
        required[value.tag.name] = value.value;
      }
    }
  }

  const available: string[] = [];
  const excluded: ExcludedOption[] = [];

  for (const assignment of assignments) {
    const values = targetValueMap.get(assignment.id) ?? {};
    let reason: string | null = null;

    for (const [tagName, requiredValue] of Object.entries(required)) {
      const actual = values[tagName];
      if (actual === undefined) {
        reason = `Missing a value for "${tagName}".`;
        break;
      }
      if (actual !== requiredValue) {
        reason = `"${tagName}" is "${actual}", which does not match the required "${requiredValue}".`;
        break;
      }
    }

    if (reason) {
      excluded.push({ assignmentId: assignment.id, reason });
    } else {
      available.push(assignment.id);
    }
  }

  return { available, excluded };
}
