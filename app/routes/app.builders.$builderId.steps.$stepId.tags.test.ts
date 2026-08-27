import { describe, it, expect, vi, beforeEach } from "vitest";
import { action as tagsAction, loader as tagsLoader } from "./app.builders.$builderId.steps.$stepId.tags";

vi.mock("../shopify.server", () => ({
  authenticate: { admin: vi.fn() },
}));

vi.mock("../domains/builder-admin/builder.server", () => ({
  getCatalogAssignmentsForStep: vi.fn(),
}));

vi.mock("../domains/compatibility/compatibility-tag.server", () => ({
  createCompatibilityTag: vi.fn(),
  getTagsForStep: vi.fn(),
}));

vi.mock("../domains/compatibility/tag-value-assignment.server", () => ({
  setTagValue: vi.fn(),
  getValuesForStep: vi.fn(),
}));

import { authenticate } from "../shopify.server";
import { getCatalogAssignmentsForStep } from "../domains/builder-admin/builder.server";
import { createCompatibilityTag, getTagsForStep } from "../domains/compatibility/compatibility-tag.server";
import { setTagValue, getValuesForStep } from "../domains/compatibility/tag-value-assignment.server";

describe("app.builders.$builderId.steps.$stepId.tags route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads assignments, tags, and values for the step", async () => {
    (authenticate.admin as any).mockResolvedValue({ session: { shop: "shop-1" } });
    (getCatalogAssignmentsForStep as any).mockResolvedValue([{ id: "assignment-1" }]);
    (getTagsForStep as any).mockResolvedValue([{ id: "tag-1", name: "Socket Type" }]);
    (getValuesForStep as any).mockResolvedValue([]);

    const request = new Request("http://localhost/app/builders/builder-1/steps/step-1/tags");
    const result = await tagsLoader({ request, params: { builderId: "builder-1", stepId: "step-1" } } as any);

    expect(result).toEqual({
      builderId: "builder-1",
      stepId: "step-1",
      assignments: [{ id: "assignment-1" }],
      tags: [{ id: "tag-1", name: "Socket Type" }],
      values: [],
    });
  });

  it("creates a tag", async () => {
    (authenticate.admin as any).mockResolvedValue({ session: { shop: "shop-1" } });
    (createCompatibilityTag as any).mockResolvedValue({ id: "tag-1", name: "Socket Type" });

    const formData = new FormData();
    formData.set("intent", "create-tag");
    formData.set("name", "Socket Type");
    formData.set("role", "standard");
    const request = new Request("http://localhost/app/builders/builder-1/steps/step-1/tags", {
      method: "POST",
      body: formData,
    });

    const response = await tagsAction({ request, params: { builderId: "builder-1", stepId: "step-1" } } as any);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.feedback.type).toBe("success");
    expect(createCompatibilityTag).toHaveBeenCalledWith("shop-1", {
      stepId: "step-1",
      name: "Socket Type",
      role: "standard",
    });
  });

  it("sets a tag value manually", async () => {
    (authenticate.admin as any).mockResolvedValue({ session: { shop: "shop-1" } });
    (setTagValue as any).mockResolvedValue({ id: "value-1" });

    const formData = new FormData();
    formData.set("intent", "set-value");
    formData.set("tagId", "tag-1");
    formData.set("assignmentId", "assignment-1");
    formData.set("value", "AM5");
    const request = new Request("http://localhost/app/builders/builder-1/steps/step-1/tags", {
      method: "POST",
      body: formData,
    });

    const response = await tagsAction({ request, params: { builderId: "builder-1", stepId: "step-1" } } as any);
    expect(response.status).toBe(200);
    expect(setTagValue).toHaveBeenCalledWith("shop-1", {
      tagId: "tag-1",
      assignmentId: "assignment-1",
      value: "AM5",
    });
  });

  it("returns a validation error when tag creation fails", async () => {
    (authenticate.admin as any).mockResolvedValue({ session: { shop: "shop-1" } });
    (createCompatibilityTag as any).mockRejectedValue(new Error("Tag name is required."));

    const formData = new FormData();
    formData.set("intent", "create-tag");
    formData.set("name", "");
    const request = new Request("http://localhost/app/builders/builder-1/steps/step-1/tags", {
      method: "POST",
      body: formData,
    });

    const response = await tagsAction({ request, params: { builderId: "builder-1", stepId: "step-1" } } as any);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.feedback.type).toBe("validation");
  });
});
