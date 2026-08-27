import { randomBytes } from "node:crypto";
import prisma from "../../db.server";
import type { Build, BuildSelections } from "./types";

export type BuildLookupResult =
  | { type: "found"; build: Build }
  | { type: "expired" }
  | { type: "not_found" };

function toDomain(record: {
  id: string;
  shopId: string;
  builderId: string;
  token: string;
  selections: unknown;
  startedAt: Date;
  completedAt: Date | null;
  addedToCartAt: Date | null;
  convertedAt: Date | null;
  lastActivityAt: Date;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}): Build {
  return {
    ...record,
    selections: (record.selections as BuildSelections) ?? {},
  };
}

function generateToken(): string {
  return randomBytes(24).toString("base64url");
}

async function computeExpiry(shopId: string, builderId: string): Promise<Date> {
  const builder = await prisma.builder.findFirst({ where: { id: builderId, shopId } });
  const retentionDays = builder?.buildRetentionDays ?? 30;
  return new Date(Date.now() + retentionDays * 24 * 60 * 60 * 1000);
}

export async function createBuild(shopId: string, builderId: string): Promise<Build> {
  const builder = await prisma.builder.findFirst({ where: { id: builderId, shopId } });
  if (!builder) {
    throw new Error("Builder not found.");
  }

  const now = new Date();
  const expiresAt = await computeExpiry(shopId, builderId);

  const build = await prisma.build.create({
    data: {
      shopId,
      builderId,
      token: generateToken(),
      selections: {},
      startedAt: now,
      lastActivityAt: now,
      expiresAt,
    },
  });
  return toDomain(build);
}

export async function getBuildByToken(
  shopId: string,
  token: string
): Promise<BuildLookupResult> {
  const build = await prisma.build.findFirst({ where: { token, shopId } });
  if (!build) {
    return { type: "not_found" };
  }
  if (build.expiresAt.getTime() < Date.now()) {
    return { type: "expired" };
  }
  return { type: "found", build: toDomain(build) };
}

async function touchBuild(shopId: string, build: { id: string; builderId: string }): Promise<void> {
  const expiresAt = await computeExpiry(shopId, build.builderId);
  await prisma.build.update({
    where: { id: build.id },
    data: { lastActivityAt: new Date(), expiresAt },
  });
}

async function isBuildComplete(
  shopId: string,
  builderId: string,
  selections: BuildSelections
): Promise<boolean> {
  const requiredSteps = await prisma.builderStep.findMany({
    where: { builderId, shopId, enabled: true, required: true },
  });
  return requiredSteps.every((step) => Boolean(selections[step.id]));
}

export async function recordSelection(
  shopId: string,
  token: string,
  data: { stepId: string; assignmentId: string }
): Promise<Build> {
  const lookup = await getBuildByToken(shopId, token);
  if (lookup.type === "not_found") {
    throw new Error("Build not found.");
  }
  if (lookup.type === "expired") {
    throw new Error("Build expired.");
  }

  const step = await prisma.builderStep.findFirst({
    where: { id: data.stepId, shopId, builderId: lookup.build.builderId },
  });
  if (!step) {
    throw new Error("Step not found.");
  }

  const assignment = await prisma.stepCatalogAssignment.findFirst({
    where: { id: data.assignmentId, shopId, stepId: data.stepId },
  });
  if (!assignment) {
    throw new Error("This item is not assigned to that step.");
  }

  const selections: BuildSelections = { ...lookup.build.selections, [data.stepId]: data.assignmentId };

  const updateData: {
    selections: BuildSelections;
    completedAt?: Date;
  } = { selections };

  if (!lookup.build.completedAt) {
    const complete = await isBuildComplete(shopId, lookup.build.builderId, selections);
    if (complete) {
      updateData.completedAt = new Date();
    }
  }

  await touchBuild(shopId, lookup.build);
  const updated = await prisma.build.update({
    where: { id: lookup.build.id },
    data: updateData,
  });
  return toDomain(updated);
}

export async function markAddedToCart(shopId: string, token: string): Promise<Build> {
  const lookup = await getBuildByToken(shopId, token);
  if (lookup.type !== "found") {
    throw new Error("Build not found.");
  }

  const updated = await prisma.build.update({
    where: { id: lookup.build.id },
    data: lookup.build.addedToCartAt ? {} : { addedToCartAt: new Date() },
  });
  return toDomain(updated);
}

export async function markConvertedByToken(shopId: string, token: string): Promise<void> {
  const build = await prisma.build.findFirst({ where: { token, shopId } });
  if (!build || build.convertedAt) {
    return;
  }
  await prisma.build.update({
    where: { id: build.id },
    data: { convertedAt: new Date() },
  });
}
