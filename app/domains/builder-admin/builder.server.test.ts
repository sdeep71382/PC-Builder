import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Builder, BuilderStep, StepCatalogAssignment } from "./types";

const { mockPrismaClient } = vi.hoisted(() => {
  let builderIdCounter = 1;
  let stepIdCounter = 1;
  let assignmentIdCounter = 1;

  function nextBuilderId() {
    return `builder-${builderIdCounter++}`;
  }

  function nextStepId() {
    return `step-${stepIdCounter++}`;
  }

  function nextAssignmentId() {
    return `assignment-${assignmentIdCounter++}`;
  }

  const builders: Record<string, Builder> = {};
  const steps: Record<string, BuilderStep> = {};
  const assignments: Record<string, StepCatalogAssignment> = {};

  const prisma = {
    builder: {
      findMany: vi.fn(({ where }: { where: { shopId: string } }) => {
        return Object.values(builders).filter((b) => b.shopId === where.shopId);
      }),
      findFirst: vi.fn(({ where, include }: any) => {
        const builder = Object.values(builders).find((b) => b.id === where.id && b.shopId === where.shopId) || null;
        if (!builder || !include?.builderSteps) return builder;
        const builderSteps = Object.values(steps)
          .filter((s) => s.builderId === builder.id && s.shopId === builder.shopId)
          .sort((a, b) => a.position - b.position);
        return { ...builder, builderSteps };
      }),
      create: vi.fn(({ data }: { data: { shopId: string; name: string; description?: string } }) => {
        const id = nextBuilderId();
        const builder: Builder = {
          id,
          shopId: data.shopId,
          name: data.name,
          description: data.description ?? null,
          status: "draft",
          version: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        builders[id] = builder;
        return builder;
      }),
      update: vi.fn(({ where, data }: { where: { id: string }; data: Partial<Builder> }) => {
        const existing = builders[where.id];
        if (!existing) return null;
        const updated = { ...existing, ...data, updatedAt: new Date() };
        builders[where.id] = updated;
        return updated;
      }),
      count: vi.fn(({ where }: { where: { builderId: string; shopId: string; enabled: boolean } }) => {
        return Object.values(steps).filter(
          (s) => s.builderId === where.builderId && s.shopId === where.shopId && s.enabled === where.enabled
        ).length;
      }),
    },
    builderStep: {
      findMany: vi.fn(({ where }: { where: { builderId: string; shopId: string } }) => {
        return Object.values(steps)
          .filter((s) => s.builderId === where.builderId && s.shopId === where.shopId)
          .sort((a, b) => a.position - b.position);
      }),
      findFirst: vi.fn(({ where }: { where: { id: string; shopId: string } }) => {
        return Object.values(steps).find((s) => s.id === where.id && s.shopId === where.shopId) || null;
      }),
      create: vi.fn(({ data }: { data: any }) => {
        const id = nextStepId();
        const step: BuilderStep = {
          id,
          shopId: data.shopId,
          builderId: data.builderId,
          name: data.name,
          position: data.position,
          enabled: data.enabled ?? true,
          required: data.required ?? true,
          version: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        steps[id] = step;
        return step;
      }),
      update: vi.fn(({ where, data }: { where: { id: string }; data: Partial<BuilderStep> }) => {
        const existing = steps[where.id];
        if (!existing) return null;
        const updated = { ...existing, ...data, updatedAt: new Date() };
        steps[where.id] = updated;
        return updated;
      }),
      delete: vi.fn(({ where }: { where: { id: string } }) => {
        const step = steps[where.id];
        if (step) {
          delete steps[where.id];
          for (const [key, assignment] of Object.entries(assignments)) {
            if (assignment.stepId === where.id) {
              delete assignments[key];
            }
          }
        }
        return step;
      }),
      count: vi.fn(({ where }: { where: { builderId: string; shopId: string; enabled: boolean } }) => {
        return Object.values(steps).filter(
          (s) => s.builderId === where.builderId && s.shopId === where.shopId && s.enabled === where.enabled
        ).length;
      }),
    },
    stepCatalogAssignment: {
      findMany: vi.fn(({ where }: { where: { stepId: string; shopId: string } }) => {
        return Object.values(assignments).filter(
          (a) => a.stepId === where.stepId && a.shopId === where.shopId
        );
      }),
      findFirst: vi.fn(({ where }: { where: { id: string; shopId: string } }) => {
        return Object.values(assignments).find((a) => a.id === where.id && a.shopId === where.shopId) || null;
      }),
      create: vi.fn(({ data }: { data: any }) => {
        const id = nextAssignmentId();
        const assignment: StepCatalogAssignment = {
          id,
          shopId: data.shopId,
          builderId: data.builderId,
          stepId: data.stepId,
          referenceType: data.referenceType,
          shopifyCollectionId: data.shopifyCollectionId ?? null,
          shopifyProductId: data.shopifyProductId ?? null,
          shopifyVariantId: data.shopifyVariantId ?? null,
          position: data.position ?? null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        assignments[id] = assignment;
        return assignment;
      }),
      delete: vi.fn(({ where }: { where: { id: string } }) => {
        const assignment = assignments[where.id];
        if (assignment) {
          delete assignments[where.id];
        }
        return assignment;
      }),
      deleteMany: vi.fn(({ where }: { where: { stepId: string; shopId: string } }) => {
        for (const [key, assignment] of Object.entries(assignments)) {
          if (assignment.stepId === where.stepId && assignment.shopId === where.shopId) {
            delete assignments[key];
          }
        }
      }),
    },
    $transaction: vi.fn((operations: any[]) => Promise.all(operations)),
  };

  const MockPrismaClient = function () {
    return prisma;
  };

  return { mockPrismaClient: MockPrismaClient };
});

vi.mock("@prisma/client", () => ({
  PrismaClient: mockPrismaClient,
}));

import {
  createBuilder,
  createDefaultPcBuilderSteps,
  getBuilder,
  getBuilderWithSteps,
  updateBuilder,
  updateBuilderStatus,
  listBuilders,
  createStep,
  deleteStep,
  reorderSteps,
  createCatalogAssignment,
  removeCatalogAssignment,
  getCatalogAssignmentsForStep,
} from "./builder.server";

describe("Builder Administration persistence (tenant isolation)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("isolates builders by shopId", async () => {
    const shopA = await createBuilder("shop-a", { name: "Shop A Builder" });
    const shopB = await createBuilder("shop-b", { name: "Shop B Builder" });

    const foundInA = await getBuilder("shop-a", shopA.id);
    expect(foundInA).not.toBeNull();
    expect(foundInA!.name).toBe("Shop A Builder");

    const foundInB = await getBuilder("shop-b", shopB.id);
    expect(foundInB).not.toBeNull();
    expect(foundInB!.name).toBe("Shop B Builder");

    const blocked = await getBuilder("shop-a", shopB.id);
    expect(blocked).toBeNull();
  });

  it("lists only builders for the requesting shop", async () => {
    await createBuilder("shop-c", { name: "Shop C Builder" });
    await createBuilder("shop-d", { name: "Shop D Builder" });

    const shopCList = await listBuilders("shop-c");
    expect(shopCList.some((b) => b.name === "Shop C Builder")).toBe(true);
    expect(shopCList.some((b) => b.name === "Shop D Builder")).toBe(false);
  });

  it("rejects stale saves", async () => {
    const builder = await createBuilder("shop-e", { name: "Original" });

    await expect(
      updateBuilder("shop-e", builder.id, {
        name: "Updated",
        version: builder.version - 1,
      })
    ).rejects.toThrow("Stale save");
  });

  it("allows valid updates", async () => {
    const builder = await createBuilder("shop-f", { name: "Original" });

    const updated = await updateBuilder("shop-f", builder.id, {
      name: "Updated",
      version: builder.version,
    });

    expect(updated.name).toBe("Updated");
    expect(updated.version).toBe(builder.version + 1);
  });

  it("enforces publish requirements", async () => {
    const builder = await createBuilder("shop-g", { name: "No Steps" });

    await expect(
      updateBuilderStatus("shop-g", builder.id, "published", builder.version)
    ).rejects.toThrow("at least one enabled step");
  });

  it("rejects a stale status update", async () => {
    const builder = await createBuilder("shop-g2", { name: "Stale target" });
    await createStep("shop-g2", builder.id, {
      name: "Step",
      position: 1,
      enabled: true,
      required: true,
    });

    await expect(
      updateBuilderStatus("shop-g2", builder.id, "published", builder.version - 1)
    ).rejects.toThrow("Stale save");
  });

  it("isolates steps by shopId and builderId", async () => {
    const builder = await createBuilder("shop-h", { name: "With Steps" });
    const otherBuilder = await createBuilder("shop-i", { name: "Other" });

    await createStep("shop-h", builder.id, {
      name: "Step 1",
      position: 1,
      enabled: true,
      required: true,
    });
    await createStep("shop-i", otherBuilder.id, {
      name: "Step 2",
      position: 1,
      enabled: true,
      required: true,
    });

    const stepsResult = await getBuilderWithSteps("shop-h", builder.id);
    expect(stepsResult!.steps).toHaveLength(1);
    expect(stepsResult!.steps[0].name).toBe("Step 1");

    const otherSteps = await getBuilderWithSteps("shop-h", otherBuilder.id);
    expect(otherSteps).toBeNull();
  });

  it("creates default PC builder steps in order for an empty builder", async () => {
    const builder = await createBuilder("shop-h2", { name: "Defaults" });

    const stepsResult = await createDefaultPcBuilderSteps("shop-h2", builder.id);

    expect(stepsResult.map((step) => step.name)).toEqual([
      "Processor",
      "Motherboard",
      "Memory",
      "Graphics card",
      "Storage",
      "Power supply",
      "Case",
    ]);
    expect(stepsResult.map((step) => step.position)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(stepsResult.every((step) => step.enabled && step.required)).toBe(true);
  });

  it("rejects default PC builder steps when custom steps already exist", async () => {
    const builder = await createBuilder("shop-h3", { name: "Has Custom Step" });
    await createStep("shop-h3", builder.id, {
      name: "Custom",
      position: 1,
      enabled: true,
      required: true,
    });

    await expect(
      createDefaultPcBuilderSteps("shop-h3", builder.id)
    ).rejects.toThrow("before custom steps exist");
  });

  it("deletes step-only assignments on step deletion", async () => {
    const builder = await createBuilder("shop-j", { name: "Delete Test" });
    const step = await createStep("shop-j", builder.id, {
      name: "Deletable",
      position: 1,
      enabled: true,
      required: true,
    });

    await createCatalogAssignment("shop-j", {
      builderId: builder.id,
      stepId: step.id,
      referenceType: "product",
      shopifyProductId: "gid://shopify/Product/1",
    });

    await deleteStep("shop-j", step.id);

    const assignments = await getCatalogAssignmentsForStep("shop-j", step.id);
    expect(assignments).toHaveLength(0);
  });

  it("rejects cross-shop catalog assignment removal", async () => {
    const builder = await createBuilder("shop-k", { name: "Assignments" });
    const step = await createStep("shop-k", builder.id, {
      name: "Step",
      position: 1,
      enabled: true,
      required: true,
    });

    const assignment = await createCatalogAssignment("shop-k", {
      builderId: builder.id,
      stepId: step.id,
      referenceType: "product",
      shopifyProductId: "gid://shopify/Product/1",
    });

    await expect(
      removeCatalogAssignment("shop-l", assignment.id)
    ).rejects.toThrow("not found");

    await expect(
      removeCatalogAssignment("shop-k", "non-existent")
    ).rejects.toThrow("not found");
  });

  it("normalizes step positions on reorder", async () => {
    const builder = await createBuilder("shop-m", { name: "Reorder" });
    const step1 = await createStep("shop-m", builder.id, {
      name: "A",
      position: 1,
      enabled: true,
      required: true,
    });
    const step2 = await createStep("shop-m", builder.id, {
      name: "B",
      position: 2,
      enabled: true,
      required: true,
    });

    const reordered = await reorderSteps("shop-m", builder.id, [
      step2.id,
      step1.id,
    ]);

    expect(reordered[0].id).toBe(step2.id);
    expect(reordered[0].position).toBe(1);
    expect(reordered[1].id).toBe(step1.id);
    expect(reordered[1].position).toBe(2);
  });
});
