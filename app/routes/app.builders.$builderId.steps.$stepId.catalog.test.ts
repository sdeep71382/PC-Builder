import { describe, it, expect, vi, beforeEach } from "vitest";
import { action as stepCatalogAction, loader as stepCatalogLoader } from "./app.builders.$builderId.steps.$stepId.catalog";

vi.mock("../shopify.server", () => ({
  authenticate: {
    admin: vi.fn(),
  },
}));

vi.mock("../domains/builder-admin/builder.server", () => ({
  createCatalogAssignment: vi.fn(),
  removeCatalogAssignment: vi.fn(),
  getCatalogAssignmentsForStep: vi.fn(),
}));

vi.mock("../domains/builder-admin/catalog-assignment.server", () => ({
  findShopifyProduct: vi.fn(),
  findShopifyVariant: vi.fn(),
  lookupShopifyCatalog: vi.fn(),
}));

import { authenticate } from "../shopify.server";
import {
  createCatalogAssignment,
  removeCatalogAssignment,
  getCatalogAssignmentsForStep,
} from "../domains/builder-admin/builder.server";
import {
  findShopifyProduct,
  findShopifyVariant,
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
    (lookupShopifyCatalog as any).mockResolvedValue({ type: "success", products: [], variants: [] });

    const request = new Request("http://localhost/app/builders/builder-1/steps/step-1/catalog");
    const result = await stepCatalogLoader({ request, params: { builderId: "builder-1", stepId: "step-1" } } as any);
    expect(result).toEqual({
      builderId: "builder-1",
      stepId: "step-1",
      assignments: [],
      catalog: { type: "success", products: [], variants: [] },
    });
  });

  it("creates a catalog assignment when the product exists", async () => {
    (authenticate.admin as any).mockResolvedValue({ session: { shop: "shop-1" }, admin: mockAdmin });
    (findShopifyProduct as any).mockResolvedValue({
      type: "success",
      product: { id: "gid://shopify/Product/1", title: "Widget" },
    });
    (createCatalogAssignment as any).mockResolvedValue({
      id: "assignment-1",
      shopId: "shop-1",
      builderId: "builder-1",
      stepId: "step-1",
      referenceType: "product",
      shopifyProductId: "gid://shopify/Product/1",
      shopifyVariantId: null,
      position: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const formData = new FormData();
    formData.set("referenceType", "product");
    formData.set("shopifyProductId", "gid://shopify/Product/1");
    const request = new Request("http://localhost/app/builders/builder-1/steps/step-1/catalog", {
      method: "POST",
      body: formData,
    });

    const response = await stepCatalogAction({ request, params: { builderId: "builder-1", stepId: "step-1" } } as any);
    expect(response.status).toBe(302);
    expect(findShopifyProduct).toHaveBeenCalledWith(mockAdmin, "gid://shopify/Product/1");
    expect(createCatalogAssignment).toHaveBeenCalledWith("shop-1", {
      builderId: "builder-1",
      stepId: "step-1",
      referenceType: "product",
      shopifyProductId: "gid://shopify/Product/1",
      shopifyVariantId: null,
    });
  });

  it("rejects assignment when the product does not exist in Shopify", async () => {
    (authenticate.admin as any).mockResolvedValue({ session: { shop: "shop-1" }, admin: mockAdmin });
    (findShopifyProduct as any).mockResolvedValue({ type: "success", product: null });

    const formData = new FormData();
    formData.set("referenceType", "product");
    formData.set("shopifyProductId", "gid://shopify/Product/999999");
    const request = new Request("http://localhost/app/builders/builder-1/steps/step-1/catalog", {
      method: "POST",
      body: formData,
    });

    const response = await stepCatalogAction({ request, params: { builderId: "builder-1", stepId: "step-1" } } as any);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.feedback.type).toBe("validation");
    expect(createCatalogAssignment).not.toHaveBeenCalled();
  });

  it("returns temporary feedback when the Shopify lookup fails", async () => {
    (authenticate.admin as any).mockResolvedValue({ session: { shop: "shop-1" }, admin: mockAdmin });
    (findShopifyVariant as any).mockResolvedValue({ type: "failure", message: "Shopify is unavailable" });

    const formData = new FormData();
    formData.set("referenceType", "variant");
    formData.set("shopifyVariantId", "gid://shopify/ProductVariant/1");
    const request = new Request("http://localhost/app/builders/builder-1/steps/step-1/catalog", {
      method: "POST",
      body: formData,
    });

    const response = await stepCatalogAction({ request, params: { builderId: "builder-1", stepId: "step-1" } } as any);
    expect(response.status).toBe(503);
    const data = await response.json();
    expect(data.feedback).toEqual({ type: "temporary", message: "Shopify is unavailable" });
    expect(createCatalogAssignment).not.toHaveBeenCalled();
  });

  it("removes a catalog assignment", async () => {
    (authenticate.admin as any).mockResolvedValue({ session: { shop: "shop-1" }, admin: mockAdmin });
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
});
