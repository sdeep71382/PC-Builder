import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPrisma } = vi.hoisted(() => {
  const steps: Record<string, { id: string; shopId: string }> = {
    "step-1": { id: "step-1", shopId: "shop-1" },
  };
  const tags: Record<string, { id: string; shopId: string; stepId: string; name: string; role: string }> = {
    "tag-1": { id: "tag-1", shopId: "shop-1", stepId: "step-1", name: "Socket Type", role: "standard" },
    "tag-2": { id: "tag-2", shopId: "shop-1", stepId: "step-1", name: "Power Draw", role: "powerDraw" },
  };
  const assignments: Record<string, { id: string; shopId: string; stepId: string }> = {
    "assignment-1": { id: "assignment-1", shopId: "shop-1", stepId: "step-1" },
  };
  const values: Record<string, { tagId: string; assignmentId: string; value: string }> = {};

  const prisma = {
    builderStep: {
      findFirst: vi.fn(({ where }: { where: { id: string; shopId: string } }) => {
        const step = steps[where.id];
        return step && step.shopId === where.shopId ? step : null;
      }),
    },
    compatibilityTag: {
      findFirst: vi.fn(
        ({ where }: { where: { stepId: string; shopId: string; name: string } }) => {
          return (
            Object.values(tags).find(
              (tag) =>
                tag.stepId === where.stepId && tag.shopId === where.shopId && tag.name === where.name
            ) || null
          );
        }
      ),
    },
    stepCatalogAssignment: {
      findFirst: vi.fn(
        ({ where }: { where: { id: string; shopId: string; stepId: string } }) => {
          const assignment = assignments[where.id];
          return assignment && assignment.shopId === where.shopId && assignment.stepId === where.stepId
            ? assignment
            : null;
        }
      ),
    },
    tagValueAssignment: {
      upsert: vi.fn(
        ({
          where,
          create,
        }: {
          where: { tagId_assignmentId: { tagId: string; assignmentId: string } };
          create: { tagId: string; assignmentId: string; value: string };
        }) => {
          const key = `${where.tagId_assignmentId.tagId}:${where.tagId_assignmentId.assignmentId}`;
          values[key] = create;
          return create;
        }
      ),
    },
  };

  return { mockPrisma: { prisma, values } };
});

vi.mock("../../db.server", () => ({ default: mockPrisma.prisma }));

import { importCompatibilityValuesCsv } from "./csv-import.server";

describe("importCompatibilityValuesCsv", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects the whole import when the step doesn't belong to the shop", async () => {
    await expect(
      importCompatibilityValuesCsv("shop-2", "step-1", "assignment-1,Socket Type,AM5")
    ).rejects.toThrow("Step not found.");
  });

  it("applies a valid standard-tag row", async () => {
    const results = await importCompatibilityValuesCsv(
      "shop-1",
      "step-1",
      "assignment-1,Socket Type,AM5"
    );
    expect(results).toEqual([{ row: 1, success: true, message: "Value saved." }]);
  });

  it("rejects a row with an unrecognized tag", async () => {
    const results = await importCompatibilityValuesCsv(
      "shop-1",
      "step-1",
      "assignment-1,Nonexistent Tag,AM5"
    );
    expect(results[0].success).toBe(false);
    expect(results[0].message).toContain("Unrecognized tag");
  });

  it("rejects a row referencing a catalog assignment not on the step", async () => {
    const results = await importCompatibilityValuesCsv(
      "shop-1",
      "step-1",
      "assignment-missing,Socket Type,AM5"
    );
    expect(results[0].success).toBe(false);
    expect(results[0].message).toContain("not assigned to this step");
  });

  it("rejects a non-numeric value for a powerDraw tag", async () => {
    const results = await importCompatibilityValuesCsv(
      "shop-1",
      "step-1",
      "assignment-1,Power Draw,lots"
    );
    expect(results[0].success).toBe(false);
  });

  it("rejects a malformed row (wrong column count) without blocking other rows", async () => {
    const csv = "assignment-1,Socket Type\nassignment-1,Power Draw,125";
    const results = await importCompatibilityValuesCsv("shop-1", "step-1", csv);
    expect(results[0].success).toBe(false);
    expect(results[1].success).toBe(true);
  });

  it("overwrites an existing value for the same tag/assignment pair (FR-004a)", async () => {
    await importCompatibilityValuesCsv("shop-1", "step-1", "assignment-1,Socket Type,AM4");
    await importCompatibilityValuesCsv("shop-1", "step-1", "assignment-1,Socket Type,AM5");
    expect(mockPrisma.values["tag-1:assignment-1"].value).toBe("AM5");
  });
});
