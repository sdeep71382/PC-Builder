import { describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    bundleParent: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));

vi.mock("../../db.server", () => ({ default: prismaMock }));

import { ensureBundleParent } from "./bundle-parent.server";

function response(data: unknown) {
  return { json: async () => ({ data }) };
}

describe("ensureBundleParent", () => {
  it("creates, publishes, and stores the app-owned parent when missing", async () => {
    prismaMock.bundleParent.findUnique.mockResolvedValue(null);
    const admin = {
      graphql: vi.fn()
        .mockResolvedValueOnce(response({ products: { nodes: [] } }))
        .mockResolvedValueOnce(response({ products: { nodes: [] } }))
        .mockResolvedValueOnce(response({ productCreate: { product: { id: "product-1", title: "PC Builder Bundle", status: "ACTIVE", tags: ["pc-builder-internal-bundle"], variants: { nodes: [{ id: "variant-1" }] } }, userErrors: [] } }))
        .mockResolvedValueOnce(response({ publications: { nodes: [{ id: "publication-1", name: "Online Store" }] } }))
        .mockResolvedValueOnce(response({ publishablePublish: { userErrors: [] } })),
    } as any;

    await expect(ensureBundleParent("shop-a", admin)).resolves.toBe("variant-1");
    expect(admin.graphql).toHaveBeenCalledTimes(5);
    expect(prismaMock.bundleParent.upsert).toHaveBeenCalledWith({
      where: { shopId: "shop-a" },
      create: { shopId: "shop-a", shopifyProductId: "product-1", shopifyVariantId: "variant-1" },
      update: { shopifyProductId: "product-1", shopifyVariantId: "variant-1" },
    });
  });

  it("reuses the stored parent and repairs its active/tagged state", async () => {
    prismaMock.bundleParent.findUnique.mockResolvedValue({ shopifyProductId: "product-1", shopifyVariantId: "variant-1" });
    const admin = {
      graphql: vi.fn()
        .mockResolvedValueOnce(response({ product: { id: "product-1", title: "PC Builder Bundle", status: "DRAFT", tags: [], variants: { nodes: [{ id: "variant-1" }] } } }))
        .mockResolvedValueOnce(response({ productUpdate: { userErrors: [] } }))
        .mockResolvedValueOnce(response({ publications: { nodes: [{ id: "publication-1", name: "Online Store" }] } }))
        .mockResolvedValueOnce(response({ publishablePublish: { userErrors: [] } })),
    } as any;

    await expect(ensureBundleParent("shop-a", admin)).resolves.toBe("variant-1");
    expect(admin.graphql).toHaveBeenCalledTimes(4);
  });
});
