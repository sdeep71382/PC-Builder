import { PrismaClient } from "@prisma/client";
import type {
  Builder,
  BuilderStep,
  BuilderWithSteps,
  BuilderStatus,
  CatalogReferenceType,
  StepCatalogAssignment,
} from "./types";
import {
  validateBuilder,
  validateBuilderName,
  validateBuilderStatusTransition,
  validateCatalogAssignmentInput,
  validatePublishRequirements,
  validateStep,
  validateStepName,
  validateStepPosition,
  isStaleSave,
} from "./builder-validation";

const prisma = new PrismaClient();

export async function listBuilders(shopId: string): Promise<Builder[]> {
  const builders = await prisma.builder.findMany({
    where: { shopId },
    orderBy: { updatedAt: "desc" },
  });
  return builders.map((builder) => ({
    ...builder,
    status: builder.status as BuilderStatus,
  }));
}

export async function getBuilder(
  shopId: string,
  builderId: string
): Promise<Builder | null> {
  const builder = await prisma.builder.findFirst({
    where: { id: builderId, shopId },
  });

  if (!builder) {
    return null;
  }

  return {
    ...builder,
    status: builder.status as BuilderStatus,
  };
}

export async function getBuilderWithSteps(
  shopId: string,
  builderId: string
): Promise<BuilderWithSteps | null> {
  const builder = await prisma.builder.findFirst({
    where: { id: builderId, shopId },
    include: {
      builderSteps: {
        orderBy: { position: "asc" },
      },
    },
  });

  if (!builder) {
    return null;
  }

  return {
    id: builder.id,
    shopId: builder.shopId,
    name: builder.name,
    description: builder.description,
    status: builder.status as BuilderStatus,
    version: builder.version,
    createdAt: builder.createdAt,
    updatedAt: builder.updatedAt,
    steps: builder.builderSteps.map((step) => ({
      id: step.id,
      shopId: step.shopId,
      builderId: step.builderId,
      name: step.name,
      position: step.position,
      enabled: step.enabled,
      required: step.required,
      version: step.version,
      createdAt: step.createdAt,
      updatedAt: step.updatedAt,
    })),
  };
}

export async function createBuilder(
  shopId: string,
  data: { name: string; description?: string }
): Promise<Builder> {
  const error = validateBuilder({ ...data, shopId });
  if (error) {
    throw new Error(error.message);
  }

  const builder = await prisma.builder.create({
    data: {
      shopId,
      name: data.name.trim(),
      description: data.description?.trim(),
    },
  });
  return { ...builder, status: builder.status as BuilderStatus };
}

export async function updateBuilder(
  shopId: string,
  builderId: string,
  data: {
    name?: string;
    description?: string;
    version: number;
  }
): Promise<Builder> {
  const existing = await prisma.builder.findFirst({
    where: { id: builderId, shopId },
  });

  if (!existing) {
    throw new Error("Builder not found.");
  }

  if (isStaleSave(data.version, existing.version)) {
    throw new Error("Stale save. Please refresh and try again.");
  }

  const updateData: {
    name?: string;
    description?: string;
    version: number;
  } = { version: existing.version + 1 };

  if (data.name !== undefined) {
    const nameError = validateBuilderName(data.name);
    if (nameError) {
      throw new Error(nameError.message);
    }
    updateData.name = data.name.trim();
  }

  if (data.description !== undefined) {
    updateData.description = data.description?.trim();
  }

  const builder = await prisma.builder.update({
    where: { id: builderId },
    data: updateData,
  });
  return { ...builder, status: builder.status as BuilderStatus };
}

export async function updateBuilderStatus(
  shopId: string,
  builderId: string,
  nextStatus: BuilderStatus,
  version: number
): Promise<Builder> {
  const existing = await prisma.builder.findFirst({
    where: { id: builderId, shopId },
  });

  if (!existing) {
    throw new Error("Builder not found.");
  }

  if (isStaleSave(version, existing.version)) {
    throw new Error("Stale save. Please refresh and try again.");
  }

  const transitionError = validateBuilderStatusTransition(
    existing.status as BuilderStatus,
    nextStatus
  );
  if (transitionError) {
    throw new Error(transitionError.message);
  }

  const stepCount = await prisma.builderStep.count({
    where: { builderId, shopId, enabled: true },
  });

  if (nextStatus === "published") {
    const publishError = validatePublishRequirements(
      { ...existing, status: existing.status as BuilderStatus },
      stepCount
    );
    if (publishError) {
      throw new Error(publishError.message);
    }
  }

  const builder = await prisma.builder.update({
    where: { id: builderId },
    data: { status: nextStatus, version: existing.version + 1 },
  });
  return { ...builder, status: builder.status as BuilderStatus };
}

export async function createStep(
  shopId: string,
  builderId: string,
  data: { name: string; position: number; enabled?: boolean; required?: boolean }
): Promise<BuilderStep> {
  const existing = await prisma.builder.findFirst({
    where: { id: builderId, shopId },
  });

  if (!existing) {
    throw new Error("Builder not found.");
  }

  const error = validateStep({ ...data, shopId, builderId });
  if (error) {
    throw new Error(error.message);
  }

  return prisma.builderStep.create({
    data: {
      shopId,
      builderId,
      name: data.name.trim(),
      position: data.position,
      enabled: data.enabled ?? true,
      required: data.required ?? true,
    },
  });
}

export async function updateStep(
  shopId: string,
  stepId: string,
  data: {
    name?: string;
    position?: number;
    enabled?: boolean;
    required?: boolean;
    version: number;
  }
): Promise<BuilderStep> {
  const existing = await prisma.builderStep.findFirst({
    where: { id: stepId, shopId },
  });

  if (!existing) {
    throw new Error("Step not found.");
  }

  if (isStaleSave(data.version, existing.version)) {
    throw new Error("Stale save. Please refresh and try again.");
  }

  const updateData: {
    name?: string;
    position?: number;
    enabled?: boolean;
    required?: boolean;
    version: number;
  } = { version: existing.version + 1 };

  if (data.name !== undefined) {
    const nameError = validateStepName(data.name);
    if (nameError) {
      throw new Error(nameError.message);
    }
    updateData.name = data.name.trim();
  }

  if (data.position !== undefined) {
    const positionError = validateStepPosition(data.position);
    if (positionError) {
      throw new Error(positionError.message);
    }
    updateData.position = data.position;
  }

  if (data.enabled !== undefined) {
    updateData.enabled = data.enabled;
  }

  if (data.required !== undefined) {
    updateData.required = data.required;
  }

  return prisma.builderStep.update({
    where: { id: stepId },
    data: updateData,
  });
}

export async function deleteStep(
  shopId: string,
  stepId: string
): Promise<void> {
  const existing = await prisma.builderStep.findFirst({
    where: { id: stepId, shopId },
  });

  if (!existing) {
    throw new Error("Step not found.");
  }

  await prisma.stepCatalogAssignment.deleteMany({
    where: { stepId, shopId },
  });

  await prisma.builderStep.delete({
    where: { id: stepId },
  });

  const remainingSteps = await prisma.builderStep.findMany({
    where: { builderId: existing.builderId, shopId },
    orderBy: { position: "asc" },
  });

  const normalized = remainingSteps.map((step, index) => ({
    ...step,
    position: index + 1,
  }));

  await prisma.$transaction(
    normalized.map((step) =>
      prisma.builderStep.update({
        where: { id: step.id },
        data: { position: step.position },
      })
    )
  );
}

export async function reorderSteps(
  shopId: string,
  builderId: string,
  stepIds: string[]
): Promise<BuilderStep[]> {
  const builder = await prisma.builder.findFirst({
    where: { id: builderId, shopId },
  });

  if (!builder) {
    throw new Error("Builder not found.");
  }

  const steps = await prisma.builderStep.findMany({
    where: { builderId, shopId },
  });

  const stepMap = new Map(steps.map((step) => [step.id, step]));
  const ordered: BuilderStep[] = [];

  for (let i = 0; i < stepIds.length; i++) {
    const step = stepMap.get(stepIds[i]);
    if (!step) {
      throw new Error(`Step ${stepIds[i]} not found.`);
    }
    ordered.push(step);
  }

  const normalized = ordered.map((step, index) => ({
    ...step,
    position: index + 1,
  }));

  await prisma.$transaction(
    normalized.map((step, index) =>
      prisma.builderStep.update({
        where: { id: step.id },
        data: { position: index + 1 },
      })
    )
  );

  return prisma.builderStep.findMany({
    where: { builderId, shopId },
    orderBy: { position: "asc" },
  });
}

export async function getStepsForBuilder(
  shopId: string,
  builderId: string
): Promise<BuilderStep[]> {
  return prisma.builderStep.findMany({
    where: { builderId, shopId },
    orderBy: { position: "asc" },
  });
}

export async function createCatalogAssignment(
  shopId: string,
  data: {
    builderId: string;
    stepId: string;
    referenceType: CatalogReferenceType;
    shopifyProductId?: string;
    shopifyVariantId?: string;
    position?: number;
  }
): Promise<StepCatalogAssignment> {
  const builder = await prisma.builder.findFirst({
    where: { id: data.builderId, shopId },
  });

  if (!builder) {
    throw new Error("Builder not found.");
  }

  const step = await prisma.builderStep.findFirst({
    where: { id: data.stepId, shopId },
  });

  if (!step) {
    throw new Error("Step not found.");
  }

  const inputError = validateCatalogAssignmentInput(data);
  if (inputError) {
    throw new Error(inputError.message);
  }

  const assignment = await prisma.stepCatalogAssignment.create({
    data: {
      shopId,
      builderId: data.builderId,
      stepId: data.stepId,
      referenceType: data.referenceType,
      shopifyProductId: data.shopifyProductId,
      shopifyVariantId: data.shopifyVariantId,
      position: data.position,
    },
  });
  return { ...assignment, referenceType: assignment.referenceType as CatalogReferenceType };
}

export async function removeCatalogAssignment(
  shopId: string,
  assignmentId: string
): Promise<void> {
  const existing = await prisma.stepCatalogAssignment.findFirst({
    where: { id: assignmentId, shopId },
  });

  if (!existing) {
    throw new Error("Assignment not found.");
  }

  await prisma.stepCatalogAssignment.delete({
    where: { id: assignmentId },
  });
}

export async function getCatalogAssignmentsForStep(
  shopId: string,
  stepId: string
): Promise<StepCatalogAssignment[]> {
  const assignments = await prisma.stepCatalogAssignment.findMany({
    where: { stepId, shopId },
    orderBy: { position: "asc" },
  });
  return assignments.map((assignment) => ({
    ...assignment,
    referenceType: assignment.referenceType as CatalogReferenceType,
  }));
}
