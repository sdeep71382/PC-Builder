import { describe, it, expect, vi, beforeEach } from "vitest";
import { action as builderStepsAction, loader as builderStepsLoader } from "./app.builders.$builderId.steps";

vi.mock("../shopify.server", () => ({
  authenticate: {
    admin: vi.fn(),
  },
}));

vi.mock("../domains/builder-admin/builder.server", () => ({
  createDefaultPcBuilderSteps: vi.fn(),
  createStep: vi.fn(),
  deleteStep: vi.fn(),
  getStepsForBuilder: vi.fn(),
  reorderSteps: vi.fn(),
  updateStep: vi.fn(),
}));

import { authenticate } from "../shopify.server";
import {
  createDefaultPcBuilderSteps,
  deleteStep,
  getStepsForBuilder,
  updateStep,
} from "../domains/builder-admin/builder.server";

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

  it("creates default steps for an empty builder", async () => {
    (authenticate.admin as any).mockResolvedValue({ session: { shop: "shop-1" } });
    (createDefaultPcBuilderSteps as any).mockResolvedValue([]);

    const formData = new FormData();
    formData.set("intent", "create-defaults");
    const request = new Request("http://localhost/app/builders/builder-1/steps", {
      method: "POST",
      body: formData,
    });

    const response = await builderStepsAction({ request, params: { builderId: "builder-1" } } as any);
    expect(response.status).toBe(200);
    expect(createDefaultPcBuilderSteps).toHaveBeenCalledWith("shop-1", "builder-1");
  });

  it("updates a step through the builder-scoped service", async () => {
    (authenticate.admin as any).mockResolvedValue({ session: { shop: "shop-1" } });
    (updateStep as any).mockResolvedValue({ id: "step-1" });

    const formData = new FormData();
    formData.set("intent", "update");
    formData.set("stepId", "step-1");
    formData.set("name", "Processor");
    formData.set("enabled", "on");
    formData.set("required", "on");
    formData.set("version", "3");
    const request = new Request("http://localhost/app/builders/builder-1/steps", {
      method: "POST",
      body: formData,
    });

    const response = await builderStepsAction({ request, params: { builderId: "builder-1" } } as any);
    expect(response.status).toBe(200);
    expect(updateStep).toHaveBeenCalledWith("shop-1", "builder-1", "step-1", {
      name: "Processor",
      enabled: true,
      required: true,
      version: 3,
    });
  });

  it("deletes a step through the builder-scoped service", async () => {
    (authenticate.admin as any).mockResolvedValue({ session: { shop: "shop-1" } });
    (deleteStep as any).mockResolvedValue(undefined);

    const formData = new FormData();
    formData.set("intent", "delete");
    formData.set("stepId", "step-1");
    const request = new Request("http://localhost/app/builders/builder-1/steps", {
      method: "POST",
      body: formData,
    });

    const response = await builderStepsAction({ request, params: { builderId: "builder-1" } } as any);
    expect(response.status).toBe(200);
    expect(deleteStep).toHaveBeenCalledWith("shop-1", "builder-1", "step-1");
  });
});
