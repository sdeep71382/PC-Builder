import { describe, it, expect, vi } from "vitest";
import {
  lookupShopifyCatalog,
  findShopifyCollection,
  findShopifyProduct,
  findShopifyVariant,
} from "./catalog-assignment.server";

function mockAdmin(graphql: (...args: unknown[]) => unknown) {
  return { graphql } as any;
}

describe("Shopify catalog lookups", () => {
  it("returns a success result with an empty collection when the collection is not found", async () => {
    const admin = mockAdmin(() => ({
      json: async () => ({ collection: null }),
    }));

    const result = await findShopifyCollection(admin, "gid://shopify/Collection/999999");
    expect(result).toEqual({ type: "success", collection: null });
  });

  it("returns a success result with an empty product when the product is not found", async () => {
    const admin = mockAdmin(() => ({
      json: async () => ({ product: null }),
    }));

    const result = await findShopifyProduct(admin, "gid://shopify/Product/999999");
    expect(result).toEqual({ type: "success", product: null });
  });

  it("returns a success result with an empty variant when the variant is not found", async () => {
    const admin = mockAdmin(() => ({
      json: async () => ({ productVariant: null }),
    }));

    const result = await findShopifyVariant(admin, "gid://shopify/ProductVariant/999999");
    expect(result).toEqual({ type: "success", variant: null });
  });

  it("returns a failure result when the product lookup throws", async () => {
    const admin = mockAdmin(() => {
      throw new Error("Network error");
    });

    const result = await findShopifyProduct(admin, "gid://shopify/Product/1");
    expect(result).toEqual({ type: "failure", message: "Network error" });
  });

  it("returns a failure result when the collection lookup throws", async () => {
    const admin = mockAdmin(() => {
      throw new Error("Network error");
    });

    const result = await findShopifyCollection(admin, "gid://shopify/Collection/1");
    expect(result).toEqual({ type: "failure", message: "Network error" });
  });

  it("returns a failure result when the variant lookup throws", async () => {
    const admin = mockAdmin(() => {
      throw new Error("Network error");
    });

    const result = await findShopifyVariant(admin, "gid://shopify/ProductVariant/1");
    expect(result).toEqual({ type: "failure", message: "Network error" });
  });

  it("returns a failure result when the catalog list lookup throws", async () => {
    const admin = mockAdmin(() => {
      throw new Error("Shopify is unavailable");
    });

    const result = await lookupShopifyCatalog(admin);
    expect(result).toEqual({ type: "failure", message: "Shopify is unavailable" });
  });

  it("returns a success result with products and variants", async () => {
    const admin = mockAdmin(vi.fn()
      .mockResolvedValueOnce({
        json: async () => ({
          collections: {
            nodes: [{ id: "gid://shopify/Collection/1", title: "Processors", handle: "processors" }],
          },
        }),
      })
      .mockResolvedValueOnce({
        json: async () => ({ products: { nodes: [{ id: "gid://shopify/Product/1", title: "Widget" }] } }),
      })
      .mockResolvedValueOnce({
        json: async () => ({
          productVariants: {
            nodes: [
              {
                id: "gid://shopify/ProductVariant/1",
                title: "Small",
                product: { id: "gid://shopify/Product/1", title: "Widget" },
              },
            ],
          },
        }),
      }));

    const result = await lookupShopifyCatalog(admin);
    expect(result).toEqual({
      type: "success",
      collections: [{ id: "gid://shopify/Collection/1", title: "Processors", handle: "processors" }],
      products: [{ id: "gid://shopify/Product/1", title: "Widget" }],
      variants: [
        {
          id: "gid://shopify/ProductVariant/1",
          title: "Small",
          product: { id: "gid://shopify/Product/1", title: "Widget" },
        },
      ],
    });
  });
});
