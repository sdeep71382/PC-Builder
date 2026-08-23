import { describe, it, expect, vi, beforeEach } from "vitest";
import { loader as builderStepsLoader } from "./app.builders.$builderId.steps";

vi.mock("../shopify.server", () => ({
  authenticate: {
    admin: vi.fn(),
  },
}));

vi.mock("../domains/builder-admin/builder.server", () => ({
  createStep: vi.fn(),
  deleteStep: vi.fn(),
  getStepsForBuilder: vi.fn(),
  reorderSteps: vi.fn(),
  updateStep: vi.fn(),
}));

import { authenticate } from "../shopify.server";
import { getStepsForBuilder } from "../domains/builder-admin/builder.server";

describe("app.builders.$builderId.steps route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns steps for the builder", async () => {
    const mockSteps = [
      { id: "step-1", builderId: "builder-1", shopId: "shop-1", name: "Step 1", position: 1, enabled: true, required: true, version: 1, createdAt: new Date(), updatedAt: new Date() },
    ];
    (authenticate.admin as any).mockResolvedValue({ session: { shop: "shop-1" } });
    (getStepsForBuilder as any).mockResolvedValue(mockSteps);

    const request = new Request("http://localhost/app/builders/builder-1/steps");
    const result = await builderStepsLoader({ request, params: { builderId: "builder-1" } } as any);
    expect(result.steps).toEqual(mockSteps);
    expect(result.builderId).toBe("builder-1");
  });

  it("returns empty steps for builder with no steps", async () => {
    (authenticate.admin as any).mockResolvedValue({ session: { shop: "shop-1" } });
    (getStepsForBuilder as any).mockResolvedValue([]);

    const request = new Request("http://localhost/app/builders/builder-1/steps");
    const result = await builderStepsLoader({ request, params: { builderId: "builder-1" } } as any);
    expect(result.steps).toEqual([]);
  });
});
