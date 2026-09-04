import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock, builders } = vi.hoisted(() => {
  const builders: Record<string, any> = {};
  const prismaMock = {
    builder: {
      findFirst: vi.fn(({ where, select }) => {
        const builder = Object.values(builders).find(
          (candidate) =>
            candidate.shopId === where.shopId &&
            (!where.publicId || candidate.publicId === where.publicId) &&
            (where.isDefault === undefined || candidate.isDefault === where.isDefault) &&
            candidate.status === where.status
        );
        if (builder && select?.publicId) {
          return { publicId: builder.publicId };
        }
        return builder ?? null;
      }),
    },
    productSpecification: {
      findMany: vi.fn(({ where }) => [
        {
          shopId: where.shopId,
          shopifyVariantId: "gid://shopify/ProductVariant/1",
          value: "AM5",
          specificationDefinition: { key: "socket" },
        },
      ]),
    },
    compatibilityRule: {
      findMany: vi.fn(() => []),
    },
  };
  return { prismaMock, builders };
});

vi.mock("../../db.server", () => ({
  default: prismaMock,
}));

import {
  getDefaultStorefrontBuilder,
  getPublicStorefrontBuilder,
} from "./storefront-builder.server";

function publishedBuilder(overrides: Record<string, unknown> = {}) {
  return {
    id: "internal-builder-id",
    publicId: "pb_11111111111111111111111111111111",
    shopId: "shop-a",
    name: "Default PC Builder",
    description: "Build a PC.",
    status: "published",
    isDefault: false,
    builderSteps: [
      {
        id: "step-disabled",
        name: "Disabled",
        position: 0,
        enabled: false,
        required: true,
        assignments: [],
      },
      {
        id: "step-cpu",
        name: "Processor",
        position: 1,
        enabled: true,
        required: true,
        assignments: [
          {
            shopifyCollectionId: "gid://shopify/Collection/1",
          },
        ],
      },
      {
        id: "step-ram",
        name: "Memory",
        position: 2,
        enabled: true,
        required: false,
        assignments: [],
      },
    ],
    ...overrides,
  };
}

function storefront(products = defaultProducts()) {
  return {
    graphql: vi.fn(async () => ({
      json: async () => ({
        data: {
          shop: { currencyCode: "USD" },
          collection: {
            products: {
              nodes: products,
            },
          },
        },
      }),
    })),
  };
}

function unavailableStorefront() {
  return {
    graphql: vi.fn(async () => ({
      json: async () => ({ data: { collection: null } }),
    })),
  };
}

function defaultProducts() {
  return [
    {
      id: "gid://shopify/Product/1",
      title: "Ryzen Test A",
      vendor: "AMD",
      status: "ACTIVE",
      featuredImage: { url: "https://cdn.shopify.com/cpu.jpg", altText: "CPU" },
      variants: {
        nodes: [
          {
            id: "gid://shopify/ProductVariant/1",
            title: "Default Title",
            sku: "RYZEN-A",
            availableForSale: true,
            image: null,
            price: "399.99",
          },
          {
            id: "gid://shopify/ProductVariant/2",
            title: "Tray",
            sku: "RYZEN-A-TRAY",
            availableForSale: false,
            image: { url: "https://cdn.shopify.com/tray.jpg", altText: null },
            price: "379.99",
          },
        ],
      },
    },
    {
      id: "gid://shopify/Product/invalid",
      title: "Unavailable Product",
      vendor: "AMD",
      status: "ACTIVE",
      featuredImage: null,
      variants: { nodes: [] },
    },
  ];
}

describe("public storefront builder service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const key of Object.keys(builders)) delete builders[key];
  });

  it("rejects draft and archived builders publicly", async () => {
    builders.draft = publishedBuilder({ status: "draft" });

    const result = await getPublicStorefrontBuilder(
      "shop-a",
      "pb_11111111111111111111111111111111",
      storefront() as never
    );

    expect(result.type).toBe("unavailable");
  });

  it("loads a published builder with ordered enabled steps and assigned collection products", async () => {
    builders.published = publishedBuilder({
      builderSteps: [
        {
          id: "step-ram",
          name: "Memory",
          position: 2,
          enabled: true,
          required: false,
          assignments: [],
        },
        {
          id: "step-cpu",
          name: "Processor",
          position: 1,
          enabled: true,
          required: true,
          assignments: [{ shopifyCollectionId: "gid://shopify/Collection/1" }],
        },
      ],
    });

    const result = await getPublicStorefrontBuilder(
      "shop-a",
      "pb_11111111111111111111111111111111",
      storefront() as never
    );

    expect(result.type).toBe("success");
    if (result.type !== "success") return;
    expect(result.data.builder).not.toHaveProperty("id");
    expect(result.data.builder.steps.map((step) => step.name)).toEqual(["Processor", "Memory"]);
    expect(result.data.builder.steps[1].required).toBe(false);
    expect(result.data.builder.steps[0].products).toHaveLength(2);
    expect(result.data.builder.steps[0].products[0]).toMatchObject({
      productTitle: "Ryzen Test A",
      variantTitle: null,
      available: true,
      specifications: { socket: "AM5" },
    });
    expect(JSON.stringify(result.data)).not.toContain("accessToken");
    expect(JSON.stringify(result.data)).not.toContain("internal-builder-id");
    expect(JSON.stringify(result.data)).not.toContain("step-cpu");
  });

  it("rejects wrong-shop public builder access", async () => {
    builders.published = publishedBuilder({ shopId: "shop-b" });

    const result = await getPublicStorefrontBuilder(
      "shop-a",
      "pb_11111111111111111111111111111111",
      storefront() as never
    );

    expect(result.type).toBe("unavailable");
  });

  it("handles unavailable collections without crashing the builder", async () => {
    builders.published = publishedBuilder();

    const result = await getPublicStorefrontBuilder(
      "shop-a",
      "pb_11111111111111111111111111111111",
      unavailableStorefront() as never
    );

    expect(result.type).toBe("success");
    if (result.type !== "success") return;
    expect(result.data.builder.steps[0].state).toBe("collection_unavailable");
    expect(result.data.builder.steps[0].products).toEqual([]);
  });

  it("loads the shop default published builder without a submitted builder id", async () => {
    builders.default = publishedBuilder({ isDefault: true });

    const result = await getDefaultStorefrontBuilder("shop-a", storefront() as never);

    expect(result.type).toBe("success");
    if (result.type !== "success") return;
    expect(result.data.builder.name).toBe("Default PC Builder");
  });

  it("falls back to a published builder when none is marked default", async () => {
    builders.published = publishedBuilder({ isDefault: false });

    const result = await getDefaultStorefrontBuilder("shop-a", storefront() as never);

    expect(result.type).toBe("success");
  });

  it("rejects malformed public builder identifiers", async () => {
    const result = await getPublicStorefrontBuilder("shop-a", "internal-builder-id", storefront() as never);

    expect(result.type).toBe("unavailable");
    expect(prismaMock.builder.findFirst).not.toHaveBeenCalled();
  });
});
