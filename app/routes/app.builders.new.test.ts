import { describe, it, expect, vi, beforeEach } from "vitest";
import { action as newBuilderAction } from "./app.builders.new";

vi.mock("../shopify.server", () => ({
  authenticate: {
    admin: vi.fn(),
  },
}));

vi.mock("../domains/builder-admin/builder.server", () => ({
  createBuilder: vi.fn(),
}));

import { authenticate } from "../shopify.server";
import { createBuilder } from "../domains/builder-admin/builder.server";

describe("app.builders.new route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a draft builder and redirects", async () => {
    (authenticate.admin as any).mockResolvedValue({ session: { shop: "shop-1" } });
    (createBuilder as any).mockResolvedValue({ id: "builder-1", shopId: "shop-1", name: "Test", status: "draft", version: 1, createdAt: new Date(), updatedAt: new Date() });

    const formData = new FormData();
    formData.set("name", "Test Builder");
    const request = new Request("http://localhost/app/builders/new", {
      method: "POST",
      body: formData,
    });

    const response = await newBuilderAction({ request } as any);
    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("/app/builders");
  });

  it("returns validation error for missing name", async () => {
    (authenticate.admin as any).mockResolvedValue({ session: { shop: "shop-1" } });
    (createBuilder as any).mockRejectedValue(new Error("Builder name is required."));

    const formData = new FormData();
    formData.set("name", "");
    const request = new Request("http://localhost/app/builders/new", {
      method: "POST",
      body: formData,
    });

    const response = await newBuilderAction({ request } as any);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.feedback.type).toBe("validation");
    expect(data.feedback.message).toBe("Builder name is required.");
  });
});
