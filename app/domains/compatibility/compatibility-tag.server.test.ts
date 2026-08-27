import { describe, it, expect, vi, beforeEach } from "vitest";
import type { CompatibilityTagRole } from "./types";

const { mockPrisma } = vi.hoisted(() => {
  let builderIdCounter = 1;
  let stepIdCounter = 1;
  let tagIdCounter = 1;

  interface MockBuilder {
    id: string;
    shopId: string;
    powerSupplyStepId: string | null;
  }
  interface MockStep {
    id: string;
    shopId: string;
    builderId: string;
  }
  interface MockTag {
    id: string;
    shopId: string;
    stepId: string;
    builderId: string;
    name: string;
    role: string;
    createdAt: Date;
    updatedAt: Date;
  }

  const builders: Record<string, MockBuilder> = {};
  const steps: Record<string, MockStep> = {};
  const tags: Record<string, MockTag> = {};

  function seedBuilder(shopId: string, powerSupplyStepId: string | null = null): MockBuilder {
    const id = `builder-${builderIdCounter++}`;
    const builder = { id, shopId, powerSupplyStepId };
    builders[id] = builder;
    return builder;
  }

  function seedStep(shopId: string, builderId: string): MockStep {
    const id = `step-${stepIdCounter++}`;
    const step = { id, shopId, builderId };
    steps[id] = step;
    return step;
  }

  const prisma = {
    builderStep: {
      findFirst: vi.fn(({ where }: { where: { id: string; shopId: string } }) => {
        const step = steps[where.id];
        return step && step.shopId === where.shopId ? step : null;
      }),
    },
    builder: {
      findFirst: vi.fn(({ where }: { where: { id: string; shopId: string } }) => {
        const builder = builders[where.id];
        return builder && builder.shopId === where.shopId ? builder : null;
      }),
    },
    compatibilityTag: {
      findFirst: vi.fn(
        ({
          where,
        }: {
          where: { id?: string; shopId: string; stepId?: string; name?: string };
        }) => {
          return (
            Object.values(tags).find((tag) => {
              if (where.id && tag.id !== where.id) return false;
              if (tag.shopId !== where.shopId) return false;
              if (where.stepId && tag.stepId !== where.stepId) return false;
              if (where.name && tag.name !== where.name) return false;
              return true;
            }) || null
          );
        }
      ),
      findMany: vi.fn(
        ({ where }: { where: { stepId: string; shopId: string } }) => {
          return Object.values(tags)
            .filter((tag) => tag.stepId === where.stepId && tag.shopId === where.shopId)
            .map((tag) => ({ ...tag, values: [] }));
        }
      ),
      create: vi.fn(({ data }: { data: Omit<MockTag, "id" | "createdAt" | "updatedAt"> }) => {
        const id = `tag-${tagIdCounter++}`;
        const tag: MockTag = { ...data, id, createdAt: new Date(), updatedAt: new Date() };
        tags[id] = tag;
        return tag;
      }),
      update: vi.fn(({ where, data }: { where: { id: string }; data: Partial<MockTag> }) => {
        const existing = tags[where.id];
        const updated = { ...existing, ...data, updatedAt: new Date() };
        tags[where.id] = updated;
        return updated;
      }),
    },
  };

  return { mockPrisma: { prisma, seedBuilder, seedStep } };
});

vi.mock("../../db.server", () => ({ default: mockPrisma.prisma }));

import {
  createCompatibilityTag,
  updateCompatibilityTag,
  getTagsForStep,
} from "./compatibility-tag.server";

describe("Compatibility tag persistence (tenant isolation)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a standard tag on a step", async () => {
    const builder = mockPrisma.seedBuilder("shop-1");
    const step = mockPrisma.seedStep("shop-1", builder.id);

    const tag = await createCompatibilityTag("shop-1", { stepId: step.id, name: "Socket Type" });
    expect(tag.name).toBe("Socket Type");
    expect(tag.role).toBe("standard");
  });

  it("rejects creating a tag for a step in another shop", async () => {
    const builder = mockPrisma.seedBuilder("shop-1");
    const step = mockPrisma.seedStep("shop-1", builder.id);

    await expect(
      createCompatibilityTag("shop-2", { stepId: step.id, name: "Socket Type" })
    ).rejects.toThrow("Step not found.");
  });

  it("rejects a blank tag name", async () => {
    const builder = mockPrisma.seedBuilder("shop-1");
    const step = mockPrisma.seedStep("shop-1", builder.id);

    await expect(
      createCompatibilityTag("shop-1", { stepId: step.id, name: "" })
    ).rejects.toThrow("Tag name is required.");
  });

  it("rejects a duplicate tag name on the same step", async () => {
    const builder = mockPrisma.seedBuilder("shop-1");
    const step = mockPrisma.seedStep("shop-1", builder.id);
    await createCompatibilityTag("shop-1", { stepId: step.id, name: "Socket Type" });

    await expect(
      createCompatibilityTag("shop-1", { stepId: step.id, name: "Socket Type" })
    ).rejects.toThrow("already exists");
  });

  it("rejects an outputWattage tag on a step that isn't the power-supply step", async () => {
    const builder = mockPrisma.seedBuilder("shop-1", null);
    const step = mockPrisma.seedStep("shop-1", builder.id);

    await expect(
      createCompatibilityTag("shop-1", {
        stepId: step.id,
        name: "Output Wattage",
        role: "outputWattage" as CompatibilityTagRole,
      })
    ).rejects.toThrow("power-supply step");
  });

  it("allows an outputWattage tag on the power-supply step", async () => {
    const builder = mockPrisma.seedBuilder("shop-1");
    const step = mockPrisma.seedStep("shop-1", builder.id);
    builder.powerSupplyStepId = step.id;

    const tag = await createCompatibilityTag("shop-1", {
      stepId: step.id,
      name: "Output Wattage",
      role: "outputWattage" as CompatibilityTagRole,
    });
    expect(tag.role).toBe("outputWattage");
  });

  it("rejects a powerDraw tag on the power-supply step", async () => {
    const builder = mockPrisma.seedBuilder("shop-1");
    const step = mockPrisma.seedStep("shop-1", builder.id);
    builder.powerSupplyStepId = step.id;

    await expect(
      createCompatibilityTag("shop-1", {
        stepId: step.id,
        name: "Power Draw",
        role: "powerDraw" as CompatibilityTagRole,
      })
    ).rejects.toThrow("power-supply step");
  });

  it("updates a tag's name", async () => {
    const builder = mockPrisma.seedBuilder("shop-1");
    const step = mockPrisma.seedStep("shop-1", builder.id);
    const tag = await createCompatibilityTag("shop-1", { stepId: step.id, name: "Socket" });

    const updated = await updateCompatibilityTag("shop-1", tag.id, { name: "Socket Type" });
    expect(updated.name).toBe("Socket Type");
  });

  it("rejects updating a tag from another shop", async () => {
    const builder = mockPrisma.seedBuilder("shop-1");
    const step = mockPrisma.seedStep("shop-1", builder.id);
    const tag = await createCompatibilityTag("shop-1", { stepId: step.id, name: "Socket" });

    await expect(
      updateCompatibilityTag("shop-2", tag.id, { name: "Hacked" })
    ).rejects.toThrow("Tag not found.");
  });

  it("lists only tags for the requesting shop's step", async () => {
    const builderA = mockPrisma.seedBuilder("shop-a");
    const stepA = mockPrisma.seedStep("shop-a", builderA.id);
    await createCompatibilityTag("shop-a", { stepId: stepA.id, name: "Socket Type" });

    const builderB = mockPrisma.seedBuilder("shop-b");
    const stepB = mockPrisma.seedStep("shop-b", builderB.id);
    await createCompatibilityTag("shop-b", { stepId: stepB.id, name: "Memory Type" });

    const tagsForA = await getTagsForStep("shop-a", stepA.id);
    expect(tagsForA).toHaveLength(1);
    expect(tagsForA[0].name).toBe("Socket Type");
  });
});
