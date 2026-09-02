import { describe, it, expect, vi, beforeEach } from "vitest";
import { action as builderEditAction, loader as builderEditLoader } from "./app.builders.$builderId";

vi.mock("../shopify.server", () => ({
  authenticate: {
    admin: vi.fn(),
  },
}));

vi.mock("../domains/builder-admin/builder.server", () => ({
  getBuilderWithSteps: vi.fn(),
  makeBuilderDefault: vi.fn(),
  updateBuilder: vi.fn(),
  updateBuilderStatus: vi.fn(),
}));

import { authenticate } from "../shopify.server";
import {
  getBuilderWithSteps,
  makeBuilderDefault,
  updateBuilder,
} from "../domains/builder-admin/builder.server";

describe("app.builders.$builderId route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns builder for authenticated shop", async () => {
    const mockBuilder = {
      id: "builder-1",
      shopId: "shop-1",
      name: "Test",
      description: null,
      status: "draft" as const,
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      steps: [],
    };
    (authenticate.admin as any).mockResolvedValue({ session: { shop: "shop-1" } });
    (getBuilderWithSteps as any).mockResolvedValue(mockBuilder);

    const request = new Request("http://localhost/app/builders/builder-1");
    const result = await builderEditLoader({ request, params: { builderId: "builder-1" } } as any);
    expect(result).toEqual({ builder: mockBuilder });
  });

  it("redirects stale or missing builder URLs to the builders list", async () => {
    (authenticate.admin as any).mockResolvedValue({ session: { shop: "shop-1" } });
    (getBuilderWithSteps as any).mockResolvedValue(null);

    const request = new Request("http://localhost/app/builders/builder-1");
    let error: Response | undefined;
    try {
      await builderEditLoader({ request, params: { builderId: "builder-1" } } as any);
    } catch (e) {
      error = e as Response;
    }
    expect(error?.status).toBe(302);
    expect(error?.headers.get("Location")).toBe("/app/builders");
  });

  it("rejects stale saves", async () => {
    (authenticate.admin as any).mockResolvedValue({ session: { shop: "shop-1" } });
    (updateBuilder as any).mockRejectedValue(new Error("Stale save. Please refresh and try again."));

    const formData = new FormData();
    formData.set("name", "Updated");
    formData.set("version", "1");
    const request = new Request("http://localhost/app/builders/builder-1", {
      method: "POST",
      body: formData,
    });

    const response = await builderEditAction({ request, params: { builderId: "builder-1" } } as any);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.feedback.type).toBe("stale");
  });

  it("sets a published builder as the default for the authenticated shop", async () => {
    (authenticate.admin as any).mockResolvedValue({ session: { shop: "shop-1" } });
    (makeBuilderDefault as any).mockResolvedValue({
      id: "builder-1",
      status: "published",
      isDefault: true,
      version: 2,
    });

    const formData = new FormData();
    formData.set("statusAction", "makeDefault");
    formData.set("version", "1");
    const request = new Request("http://localhost/app/builders/builder-1", {
      method: "POST",
      body: formData,
    });

    const response = await builderEditAction({ request, params: { builderId: "builder-1" } } as any);
    const data = await response.json();

    expect(makeBuilderDefault).toHaveBeenCalledWith("shop-1", "builder-1", 1);
    expect(data.feedback.message).toBe("Default storefront builder updated.");
  });
});
