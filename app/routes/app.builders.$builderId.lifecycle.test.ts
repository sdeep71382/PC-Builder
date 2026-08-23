import { describe, it, expect, vi, beforeEach } from "vitest";
import { action as builderEditAction } from "./app.builders.$builderId";

vi.mock("../shopify.server", () => ({
  authenticate: {
    admin: vi.fn(),
  },
}));

vi.mock("../domains/builder-admin/builder.server", () => ({
  updateBuilderStatus: vi.fn(),
}));

import { authenticate } from "../shopify.server";
import { updateBuilderStatus } from "../domains/builder-admin/builder.server";

describe("app.builders.$builderId lifecycle actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("publishes a builder and returns success feedback", async () => {
    (authenticate.admin as any).mockResolvedValue({ session: { shop: "shop-1" } });
    (updateBuilderStatus as any).mockResolvedValue({ id: "builder-1", status: "published", version: 2 });

    const formData = new FormData();
    formData.set("statusAction", "publish");
    formData.set("version", "1");
    const request = new Request("http://localhost/app/builders/builder-1", {
      method: "POST",
      body: formData,
    });

    const response = await builderEditAction({ request, params: { builderId: "builder-1" } } as any);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.feedback).toEqual({
      type: "success",
      message: "Builder published.",
    });
    expect(updateBuilderStatus).toHaveBeenCalledWith("shop-1", "builder-1", "published", 1);
  });

  it("archives a builder and returns success feedback", async () => {
    (authenticate.admin as any).mockResolvedValue({ session: { shop: "shop-1" } });
    (updateBuilderStatus as any).mockResolvedValue({ id: "builder-1", status: "archived", version: 2 });

    const formData = new FormData();
    formData.set("statusAction", "archive");
    formData.set("version", "1");
    const request = new Request("http://localhost/app/builders/builder-1", {
      method: "POST",
      body: formData,
    });

    const response = await builderEditAction({ request, params: { builderId: "builder-1" } } as any);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.feedback).toEqual({
      type: "success",
      message: "Builder archived.",
    });
    expect(updateBuilderStatus).toHaveBeenCalledWith("shop-1", "builder-1", "archived", 1);
  });

  it("returns validation error for invalid publish attempt", async () => {
    (authenticate.admin as any).mockResolvedValue({ session: { shop: "shop-1" } });
    (updateBuilderStatus as any).mockRejectedValue(new Error("Builder must have at least one enabled step to publish."));

    const formData = new FormData();
    formData.set("statusAction", "publish");
    formData.set("version", "1");
    const request = new Request("http://localhost/app/builders/builder-1", {
      method: "POST",
      body: formData,
    });

    const response = await builderEditAction({ request, params: { builderId: "builder-1" } } as any);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.feedback.type).toBe("validation");
    expect(data.feedback.message).toBe("Builder must have at least one enabled step to publish.");
  });

  it("returns stale feedback when the status update is rejected as stale", async () => {
    (authenticate.admin as any).mockResolvedValue({ session: { shop: "shop-1" } });
    (updateBuilderStatus as any).mockRejectedValue(new Error("Stale save. Please refresh and try again."));

    const formData = new FormData();
    formData.set("statusAction", "publish");
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
});
