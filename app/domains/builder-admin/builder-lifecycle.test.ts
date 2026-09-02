import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Builder, BuilderStep } from "./types";

const { mockPrismaClient } = vi.hoisted(() => {
  const builders: Record<string, Builder> = {};
  const steps: Record<string, BuilderStep> = {};
  let builderIdCounter = 1;
  let stepIdCounter = 1;

  function nextBuilderId() {
    return `builder-${builderIdCounter++}`;
  }

  function nextStepId() {
    return `step-${stepIdCounter++}`;
  }

  function createBuilderInMock(shopId: string, name: string, status: Builder["status"] = "draft"): Builder {
    const id = nextBuilderId();
    const builder: Builder = {
      id,
      publicId: `pb_${id.replace(/[^a-z0-9]/g, "0").padEnd(32, "0").slice(0, 32)}`,
      shopId,
      name,
      description: null,
      status,
      isDefault: false,
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    builders[id] = builder;
    return builder;
  }

  function createStepInMock(shopId: string, builderId: string, enabled: boolean = true): BuilderStep {
    const id = nextStepId();
    const step: BuilderStep = {
      id,
      shopId,
      builderId,
      name: "Step 1",
      position: 1,
      enabled,
      required: true,
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    steps[id] = step;
    return step;
  }

  const prisma = {
    builder: {
      findFirst: vi.fn(({ where }: { where: { id: string; shopId: string } }) => {
        return Object.values(builders).find((b) => b.id === where.id && b.shopId === where.shopId) || null;
      }),
      create: vi.fn(({ data }: { data: any }) => {
        return createBuilderInMock(data.shopId, data.name, data.status);
      }),
      update: vi.fn(({ where, data }: { where: { id: string }; data: any }) => {
        const existing = builders[where.id];
        if (!existing) return null;
        const updated = { ...existing, ...data, updatedAt: new Date() };
        builders[where.id] = updated;
        return updated;
      }),
      count: vi.fn(({ where }: { where: { shopId: string; status?: string; isDefault?: boolean } }) => {
        return Object.values(builders).filter((b) => {
          if (b.shopId !== where.shopId) return false;
          if (where.status && b.status !== where.status) return false;
          if (where.isDefault !== undefined && b.isDefault !== where.isDefault) return false;
          return true;
        }).length;
      }),
      updateMany: vi.fn(({ where, data }: { where: { shopId: string; isDefault?: boolean }; data: Partial<Builder> }) => {
        for (const [id, builder] of Object.entries(builders)) {
          if (
            builder.shopId === where.shopId &&
            (where.isDefault === undefined || builder.isDefault === where.isDefault)
          ) {
            builders[id] = { ...builder, ...data, updatedAt: new Date() };
          }
        }
      }),
    },
    builderStep: {
      create: vi.fn(({ data }: { data: any }) => {
        return createStepInMock(data.shopId, data.builderId, data.enabled);
      }),
      count: vi.fn(({ where }: { where: { builderId: string; shopId: string; enabled: boolean } }) => {
        return Object.values(steps).filter(
          (s) => s.builderId === where.builderId && s.shopId === where.shopId && s.enabled === where.enabled
        ).length;
      }),
    },
    $transaction: vi.fn((fn: any) => fn(prisma)),
  };

  const MockPrismaClient = function () {
    return prisma;
  };

  return { mockPrismaClient: MockPrismaClient };
});

vi.mock("@prisma/client", () => ({
  PrismaClient: mockPrismaClient,
}));

import { updateBuilderStatus, createBuilder, createStep } from "./builder.server";

describe("Builder Administration lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows draft to published when requirements are met", async () => {
    const builder = await createBuilder("shop-1", { name: "Test" });
    await createStep("shop-1", builder.id, { name: "Step", position: 1, enabled: true, required: true });

    const published = await updateBuilderStatus("shop-1", builder.id, "published", builder.version);
    expect(published.status).toBe("published");
  });

  it("rejects publish without enabled steps", async () => {
    const builder = await createBuilder("shop-1", { name: "No Steps" });

    await expect(
      updateBuilderStatus("shop-1", builder.id, "published", builder.version)
    ).rejects.toThrow("at least one enabled step");
  });

  it("allows published to archived", async () => {
    const builder = await createBuilder("shop-1", { name: "Test" });
    await createStep("shop-1", builder.id, { name: "Step", position: 1, enabled: true, required: true });

    const published = await updateBuilderStatus("shop-1", builder.id, "published", builder.version);
    const archived = await updateBuilderStatus("shop-1", builder.id, "archived", published.version);
    expect(archived.status).toBe("archived");
  });

  it("allows archived to published", async () => {
    const builder = await createBuilder("shop-1", { name: "Test" });
    await createStep("shop-1", builder.id, { name: "Step", position: 1, enabled: true, required: true });

    const archived = await updateBuilderStatus("shop-1", builder.id, "archived", builder.version);
    const published = await updateBuilderStatus("shop-1", builder.id, "published", archived.version);
    expect(published.status).toBe("published");
  });

  it("rejects invalid transitions", async () => {
    const builder = await createBuilder("shop-1", { name: "Test" });
    await createStep("shop-1", builder.id, { name: "Step", position: 1, enabled: true, required: true });

    await expect(
      updateBuilderStatus("shop-1", builder.id, "draft", builder.version)
    ).rejects.toThrow("Cannot transition");
  });

  it("rejects a stale status update", async () => {
    const builder = await createBuilder("shop-1", { name: "Test" });
    await createStep("shop-1", builder.id, { name: "Step", position: 1, enabled: true, required: true });

    await expect(
      updateBuilderStatus("shop-1", builder.id, "published", builder.version - 1)
    ).rejects.toThrow("Stale save");
  });
});
