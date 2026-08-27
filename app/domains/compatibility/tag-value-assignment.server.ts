import prisma from "../../db.server";
import type { CompatibilityTagRole, TagValueAssignment } from "./types";
import { validateTagValue } from "./compatibility-validation";

export async function setTagValue(
  shopId: string,
  data: { tagId: string; assignmentId: string; value: string }
): Promise<TagValueAssignment> {
  const tag = await prisma.compatibilityTag.findFirst({
    where: { id: data.tagId, shopId },
  });
  if (!tag) {
    throw new Error("Tag not found.");
  }

  const assignment = await prisma.stepCatalogAssignment.findFirst({
    where: { id: data.assignmentId, shopId },
  });
  if (!assignment) {
    throw new Error("Catalog assignment not found.");
  }
  if (assignment.stepId !== tag.stepId) {
    throw new Error("This product or variant is not assigned to the tag's step.");
  }

  const valueError = validateTagValue(tag.role as CompatibilityTagRole, data.value);
  if (valueError) {
    throw new Error(valueError.message);
  }

  const value = await prisma.tagValueAssignment.upsert({
    where: { tagId_assignmentId: { tagId: data.tagId, assignmentId: data.assignmentId } },
    create: {
      shopId,
      tagId: data.tagId,
      assignmentId: data.assignmentId,
      value: data.value.trim(),
    },
    update: {
      value: data.value.trim(),
    },
  });
  return value;
}

export async function getValuesForStep(
  shopId: string,
  stepId: string
): Promise<TagValueAssignment[]> {
  const values = await prisma.tagValueAssignment.findMany({
    where: { shopId, tag: { stepId } },
  });
  return values;
}

export async function getValuesForAssignment(
  shopId: string,
  assignmentId: string
): Promise<TagValueAssignment[]> {
  const values = await prisma.tagValueAssignment.findMany({
    where: { shopId, assignmentId },
  });
  return values;
}
