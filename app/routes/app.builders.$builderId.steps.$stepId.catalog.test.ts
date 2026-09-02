import { describe, it, expect, vi, beforeEach } from "vitest";
import { action as stepCatalogAction, loader as stepCatalogLoader } from "./app.builders.$builderId.steps.$stepId.catalog";

vi.mock("../shopify.server", () => ({
  authenticate: {
    admin: vi.fn(),
  },
}));

vi.mock("../domains/builder-admin/builder.server", () => ({
  replaceStepCollectionAssignment: vi.fn(),
  removeCatalogAssignment: vi.fn(),
  getCatalogAssignmentsForStep: vi.fn(),
  getStepsForBuilder: vi.fn(),
}));

vi.mock("../domains/builder-admin/catalog-assignment.server", () => ({
  findShopifyCollection: vi.fn(),
  lookupShopifyCatalog: vi.fn(),
}));

import { authenticate } from "../shopify.server";
import {
  replaceStepCollectionAssignment,
  removeCatalogAssignment,
  getCatalogAssignmentsForStep,
  getStepsForBuilder,
} from "../domains/builder-admin/builder.server";
import {
  findShopifyCollection,
  lookupShopifyCatalog,
} from "../domains/builder-admin/catalog-assignment.server";

const mockAdmin = { graphql: vi.fn() } as any;

describe("app.builders.$builderId.steps.$stepId.catalog route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads assignments and the Shopify catalog", async () => {
    (authenticate.admin as any).mockResolvedValue({ session: { shop: "shop-1" }, admin: mockAdmin });
    (getCatalogAssignmentsForStep as any).mockResolvedValue([]);
    (lookupShopifyCatalog as any).mockResolvedValue({ type: "success", collections: [], products: [], variants: [] });
    (getStepsForBuilder as any).mockResolvedValue([
      { id: "step-1", name: "Processor" },
    ]);

    const request = new Request("http://localhost/app/builders/builder-1/steps/step-1/catalog");
    const result = await stepCatalogLoader({ request, params: { builderId: "builder-1", stepId: "step-1" } } as any);
    expect(result).toEqual({
      builderId: "builder-1",
      stepId: "step-1",
      stepName: "Processor",
      assignments: [],
      catalog: { type: "success", collections: [], products: [], variants: [] },
    });
  });

  it("assigns a collection when the collection exists", async () => {
    (authenticate.admin as any).mockResolvedValue({ session: { shop: "shop-1" }, admin: mockAdmin });
    (getStepsForBuilder as any).mockResolvedValue([{ id: "step-1", name: "Processor" }]);
    (findShopifyCollection as any).mockResolvedValue({
      type: "success",
      collection: {
        id: "gid://shopify/Collection/1",
        title: "Processors",
        handle: "processors",
        image: null,
        productCount: 8,
      },
    });
    (replaceStepCollectionAssignment as any).mockResolvedValue({
      id: "assignment-1",
      shopId: "shop-1",
      builderId: "builder-1",
      stepId: "step-1",
      referenceType: "collection",
      shopifyCollectionId: "gid://shopify/Collection/1",
      shopifyProductId: undefined,
      shopifyVariantId: undefined,
      position: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const formData = new FormData();
    formData.set("referenceType", "collection");
    formData.set("shopifyCollectionId", "gid://shopify/Collection/1");
    const request = new Request("http://localhost/app/builders/builder-1/steps/step-1/catalog", {
      method: "POST",
      body: formData,
    });

    const response = await stepCatalogAction({ request, params: { builderId: "builder-1", stepId: "step-1" } } as any);
    expect(response.status).toBe(302);
    expect(findShopifyCollection).toHaveBeenCalledWith(mockAdmin, "gid://shopify/Collection/1");
    expect(replaceStepCollectionAssignment).toHaveBeenCalledWith("shop-1", {
      builderId: "builder-1",
      stepId: "step-1",
      shopifyCollectionId: "gid://shopify/Collection/1",
    });
  });

  it("replaces a collection assignment by using the replace service", async () => {
    (authenticate.admin as any).mockResolvedValue({ session: { shop: "shop-1" }, admin: mockAdmin });
    (getStepsForBuilder as any).mockResolvedValue([{ id: "step-1", name: "Processor" }]);
    (findShopifyCollection as any).mockResolvedValue({
      type: "success",
      collection: {
        id: "gid://shopify/Collection/2",
        title: "Motherboards",
        handle: "motherboards",
        image: null,
        productCount: 8,
      },
    });
    (replaceStepCollectionAssignment as any).mockResolvedValue({ id: "assignment-2" });

    const formData = new FormData();
    formData.set("referenceType", "collection");
    formData.set("shopifyCollectionId", "gid://shopify/Collection/2");
    const request = new Request("http://localhost/app/builders/builder-1/steps/step-1/catalog", {
      method: "POST",
      body: formData,
    });

    const response = await stepCatalogAction({ request, params: { builderId: "builder-1", stepId: "step-1" } } as any);

    expect(response.status).toBe(302);
    expect(replaceStepCollectionAssignment).toHaveBeenCalledWith("shop-1", {
      builderId: "builder-1",
      stepId: "step-1",
      shopifyCollectionId: "gid://shopify/Collection/2",
    });
  });

  it("rejects product assignment on the collection-only route", async () => {
    (authenticate.admin as any).mockResolvedValue({ session: { shop: "shop-1" }, admin: mockAdmin });
    (getStepsForBuilder as any).mockResolvedValue([{ id: "step-1", name: "Processor" }]);

    const formData = new FormData();
    formData.set("referenceType", "product");
    formData.set("shopifyProductId", "gid://shopify/Product/1");
    const request = new Request("http://localhost/app/builders/builder-1/steps/step-1/catalog", {
      method: "POST",
      body: formData,
    });

    const response = await stepCatalogAction({ request, params: { builderId: "builder-1", stepId: "step-1" } } as any);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.feedback.type).toBe("validation");
    expect(replaceStepCollectionAssignment).not.toHaveBeenCalled();
  });

  it("rejects assignment when the collection does not exist in Shopify", async () => {
    (authenticate.admin as any).mockResolvedValue({ session: { shop: "shop-1" }, admin: mockAdmin });
    (getStepsForBuilder as any).mockResolvedValue([{ id: "step-1", name: "Processor" }]);
    (findShopifyCollection as any).mockResolvedValue({ type: "success", collection: null });

    const formData = new FormData();
    formData.set("referenceType", "collection");
    formData.set("shopifyCollectionId", "gid://shopify/Collection/999999");
    const request = new Request("http://localhost/app/builders/builder-1/steps/step-1/catalog", {
      method: "POST",
      body: formData,
    });

    const response = await stepCatalogAction({ request, params: { builderId: "builder-1", stepId: "step-1" } } as any);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.feedback.type).toBe("validation");
    expect(replaceStepCollectionAssignment).not.toHaveBeenCalled();
  });

  it("returns temporary feedback when the Shopify collection lookup fails", async () => {
    (authenticate.admin as any).mockResolvedValue({ session: { shop: "shop-1" }, admin: mockAdmin });
    (getStepsForBuilder as any).mockResolvedValue([{ id: "step-1", name: "Processor" }]);
    (findShopifyCollection as any).mockResolvedValue({ type: "failure", message: "Shopify is unavailable" });

    const formData = new FormData();
    formData.set("referenceType", "collection");
    formData.set("shopifyCollectionId", "gid://shopify/Collection/1");
    const request = new Request("http://localhost/app/builders/builder-1/steps/step-1/catalog", {
      method: "POST",
      body: formData,
    });

    const response = await stepCatalogAction({ request, params: { builderId: "builder-1", stepId: "step-1" } } as any);
    expect(response.status).toBe(503);
    const data = await response.json();
    expect(data.feedback).toEqual({ type: "temporary", message: "Shopify is unavailable" });
    expect(replaceStepCollectionAssignment).not.toHaveBeenCalled();
  });

  it("removes a catalog assignment", async () => {
    (authenticate.admin as any).mockResolvedValue({ session: { shop: "shop-1" }, admin: mockAdmin });
    (getStepsForBuilder as any).mockResolvedValue([{ id: "step-1", name: "Processor" }]);
    (getCatalogAssignmentsForStep as any).mockResolvedValue([{ id: "assignment-1" }]);
    (removeCatalogAssignment as any).mockResolvedValue(undefined);

    const formData = new FormData();
    formData.set("assignmentId", "assignment-1");
    const request = new Request("http://localhost/app/builders/builder-1/steps/step-1/catalog", {
      method: "POST",
      body: formData,
    });

    const response = await stepCatalogAction({ request, params: { builderId: "builder-1", stepId: "step-1" } } as any);
    expect(response.status).toBe(302);
    expect(removeCatalogAssignment).toHaveBeenCalledWith("shop-1", "assignment-1");
  });

  it("rejects removal when the assignment is not on the step", async () => {
    (authenticate.admin as any).mockResolvedValue({ session: { shop: "shop-1" }, admin: mockAdmin });
    (getStepsForBuilder as any).mockResolvedValue([{ id: "step-1", name: "Processor" }]);
    (getCatalogAssignmentsForStep as any).mockResolvedValue([{ id: "assignment-on-other-step" }]);

    const formData = new FormData();
    formData.set("assignmentId", "assignment-1");
    const request = new Request("http://localhost/app/builders/builder-1/steps/step-1/catalog", {
      method: "POST",
      body: formData,
    });

    const response = await stepCatalogAction({ request, params: { builderId: "builder-1", stepId: "step-1" } } as any);
    expect(response.status).toBe(404);
    expect(removeCatalogAssignment).not.toHaveBeenCalled();
  });

  it("rejects action when the step is not part of the builder", async () => {
    (authenticate.admin as any).mockResolvedValue({ session: { shop: "shop-1" }, admin: mockAdmin });
    (getStepsForBuilder as any).mockResolvedValue([{ id: "different-step", name: "Other" }]);

    const formData = new FormData();
    formData.set("referenceType", "collection");
    formData.set("shopifyCollectionId", "gid://shopify/Collection/1");
    const request = new Request("http://localhost/app/builders/builder-1/steps/step-1/catalog", {
      method: "POST",
      body: formData,
    });

    const response = await stepCatalogAction({ request, params: { builderId: "builder-1", stepId: "step-1" } } as any);
    expect(response.status).toBe(404);
    expect(findShopifyCollection).not.toHaveBeenCalled();
    expect(replaceStepCollectionAssignment).not.toHaveBeenCalled();
  });
});
