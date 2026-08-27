import prisma from "../../db.server";
import type { CompatibilityTag, CompatibilityTagRole, CompatibilityTagWithValues } from "./types";
import { validateTagName, validateTagRole } from "./compatibility-validation";

function toDomain(tag: {
  id: string;
  shopId: string;
  stepId: string;
  builderId: string;
  name: string;
  role: string;
  createdAt: Date;
  updatedAt: Date;
}): CompatibilityTag {
  return { ...tag, role: tag.role as CompatibilityTagRole };
}

export async function createCompatibilityTag(
  shopId: string,
  data: { stepId: string; name: string; role?: CompatibilityTagRole }
): Promise<CompatibilityTag> {
  const step = await prisma.builderStep.findFirst({
    where: { id: data.stepId, shopId },
  });
  if (!step) {
    throw new Error("Step not found.");
  }

  const role = data.role ?? "standard";
  const nameError = validateTagName(data.name);
  if (nameError) {
    throw new Error(nameError.message);
  }
  const roleError = validateTagRole(role);
  if (roleError) {
    throw new Error(roleError.message);
  }

  const builder = await prisma.builder.findFirst({
    where: { id: step.builderId, shopId },
  });
  if (!builder) {
    throw new Error("Builder not found.");
  }

  if (role === "outputWattage" && builder.powerSupplyStepId !== step.id) {
    throw new Error(
      "An outputWattage tag can only be defined on the builder's power-supply step."
    );
  }
  if (role === "powerDraw" && builder.powerSupplyStepId === step.id) {
    throw new Error(
      "A powerDraw tag cannot be defined on the power-supply step."
    );
  }

  const existing = await prisma.compatibilityTag.findFirst({
    where: { stepId: data.stepId, shopId, name: data.name.trim() },
  });
  if (existing) {
    throw new Error("A tag with this name already exists on this step.");
  }

  const tag = await prisma.compatibilityTag.create({
    data: {
      shopId,
      stepId: data.stepId,
      builderId: step.builderId,
      name: data.name.trim(),
      role,
    },
  });
  return toDomain(tag);
}

export async function updateCompatibilityTag(
  shopId: string,
  tagId: string,
  data: { name?: string; role?: CompatibilityTagRole }
): Promise<CompatibilityTag> {
  const existing = await prisma.compatibilityTag.findFirst({
    where: { id: tagId, shopId },
  });
  if (!existing) {
    throw new Error("Tag not found.");
  }

  const updateData: { name?: string; role?: CompatibilityTagRole } = {};

  if (data.name !== undefined) {
    const nameError = validateTagName(data.name);
    if (nameError) {
      throw new Error(nameError.message);
    }
    updateData.name = data.name.trim();
  }

  if (data.role !== undefined) {
    const roleError = validateTagRole(data.role);
    if (roleError) {
      throw new Error(roleError.message);
    }
    updateData.role = data.role;
  }

  const tag = await prisma.compatibilityTag.update({
    where: { id: tagId },
    data: updateData,
  });
  return toDomain(tag);
}

export async function getTagsForStep(
  shopId: string,
  stepId: string
): Promise<CompatibilityTag[]> {
  const tags = await prisma.compatibilityTag.findMany({
    where: { stepId, shopId },
    orderBy: { createdAt: "asc" },
  });
  return tags.map(toDomain);
}

export async function getTagsWithValuesForStep(
  shopId: string,
  stepId: string
): Promise<CompatibilityTagWithValues[]> {
  const tags = await prisma.compatibilityTag.findMany({
    where: { stepId, shopId },
    orderBy: { createdAt: "asc" },
    include: { values: true },
  });
  return tags.map((tag) => ({ ...toDomain(tag), values: tag.values }));
}

export async function findTagByName(
  shopId: string,
  stepId: string,
  name: string
): Promise<CompatibilityTag | null> {
  const tag = await prisma.compatibilityTag.findFirst({
    where: { stepId, shopId, name },
  });
  return tag ? toDomain(tag) : null;
}
