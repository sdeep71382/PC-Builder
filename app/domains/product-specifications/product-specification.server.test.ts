import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrismaClient } = vi.hoisted(() => {
  let definitionIdCounter = 1;
  let specificationIdCounter = 1;

  const definitions: Record<string, {
    id: string;
    shopId: string;
    category: string;
    key: string;
    label: string;
    dataType: string;
    unit: string | null;
    required: boolean;
    config: unknown;
    createdAt: Date;
    updatedAt: Date;
  }> = {};
  const specifications: Record<string, {
    id: string;
    shopId: string;
    shopifyProductId: string;
    shopifyVariantId: string;
    specificationDefinitionId: string;
    value: unknown;
    source: string;
    verified: boolean;
    createdAt: Date;
    updatedAt: Date;
  }> = {};

  function uniqueSpecKey(shopId: string, variantId: string, definitionId: string) {
    return `${shopId}:${variantId}:${definitionId}`;
  }

  const prisma = {
    specificationDefinition: {
      count: vi.fn(({ where }) => {
        return Object.values(definitions).filter(
          (definition) => definition.shopId === where.shopId
        ).length;
      }),
      upsert: vi.fn(({ where, update, create }) => {
        const existing = Object.values(definitions).find(
          (definition) =>
            definition.shopId === where.shopId_category_key.shopId &&
            definition.category === where.shopId_category_key.category &&
            definition.key === where.shopId_category_key.key
        );
        if (existing) {
          definitions[existing.id] = { ...existing, ...update, updatedAt: new Date() };
          return definitions[existing.id];
        }
        const id = `definition-${definitionIdCounter++}`;
        definitions[id] = {
          id,
          shopId: create.shopId,
          category: create.category,
          key: create.key,
          label: create.label,
          dataType: create.dataType,
          unit: create.unit ?? null,
          required: create.required ?? false,
          config: create.config ?? null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        return definitions[id];
      }),
      create: vi.fn(({ data }) => {
        const id = `definition-${definitionIdCounter++}`;
        definitions[id] = {
          id,
          shopId: data.shopId,
          category: data.category,
          key: data.key,
          label: data.label,
          dataType: data.dataType,
          unit: data.unit ?? null,
          required: data.required ?? false,
          config: data.config ?? null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        return definitions[id];
      }),
      findMany: vi.fn(({ where }) => {
        return Object.values(definitions).filter((definition) => {
          if (where.shopId && definition.shopId !== where.shopId) return false;
          if (where.category && definition.category !== where.category) return false;
          if (where.id?.in && !where.id.in.includes(definition.id)) return false;
          return true;
        });
      }),
    },
    productSpecification: {
      findMany: vi.fn(({ where }) => {
        return Object.values(specifications).filter((specification) => {
          if (where.shopId && specification.shopId !== where.shopId) return false;
          if (where.shopifyVariantId && specification.shopifyVariantId !== where.shopifyVariantId) return false;
          if (where.shopifyVariantId?.in && !where.shopifyVariantId.in.includes(specification.shopifyVariantId)) return false;
          if (
            where.specificationDefinitionId?.in &&
            !where.specificationDefinitionId.in.includes(specification.specificationDefinitionId)
          ) {
            return false;
          }
          return true;
        });
      }),
      upsert: vi.fn(({ where, update, create }) => {
        const key = uniqueSpecKey(
          where.shopId_shopifyVariantId_specificationDefinitionId.shopId,
          where.shopId_shopifyVariantId_specificationDefinitionId.shopifyVariantId,
          where.shopId_shopifyVariantId_specificationDefinitionId.specificationDefinitionId
        );
        const existing = specifications[key];
        if (existing) {
          specifications[key] = { ...existing, ...update, updatedAt: new Date() };
          return specifications[key];
        }
        specifications[key] = {
          id: `specification-${specificationIdCounter++}`,
          shopId: create.shopId,
          shopifyProductId: create.shopifyProductId,
          shopifyVariantId: create.shopifyVariantId,
          specificationDefinitionId: create.specificationDefinitionId,
          value: create.value,
          source: create.source,
          verified: create.verified,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        return specifications[key];
      }),
      deleteMany: vi.fn(({ where }) => {
        for (const [key, specification] of Object.entries(specifications)) {
          if (
            specification.shopId === where.shopId &&
            specification.shopifyVariantId === where.shopifyVariantId &&
            specification.specificationDefinitionId === where.specificationDefinitionId
          ) {
            delete specifications[key];
          }
        }
      }),
    },
    $transaction: vi.fn((operations) => Promise.all(operations)),
  };

  const MockPrismaClient = function () {
    return prisma;
  };

  return { mockPrismaClient: MockPrismaClient };
});

vi.mock("@prisma/client", () => ({
  PrismaClient: mockPrismaClient,
  Prisma: {},
}));

import {
  createSpecificationDefinition,
  ensureDefaultSpecificationDefinitions,
  findShopifyVariantInCollection,
  getSpecificationDefinitionsForStep,
  getSpecificationsForVariant,
  saveProductSpecifications,
} from "./product-specification.server";

describe("product specification persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("seeds default definitions without creating duplicates repeatedly", async () => {
    await ensureDefaultSpecificationDefinitions("shop-a");
    await ensureDefaultSpecificationDefinitions("shop-a");

    const cpuDefinitions = await getSpecificationDefinitionsForStep("shop-a", "Processor");
    expect(cpuDefinitions.some((definition) => definition.key === "socket")).toBe(true);
    expect(cpuDefinitions.filter((definition) => definition.key === "socket")).toHaveLength(1);
  });

  it("stores and updates variant specification values", async () => {
    const definition = await createSpecificationDefinition("shop-b", {
      category: "CPU",
      key: "tdp",
      label: "TDP",
      dataType: "NUMBER",
      unit: "W",
      required: true,
      config: null,
    });

    await saveProductSpecifications("shop-b", {
      shopifyProductId: "gid://shopify/Product/1",
      shopifyVariantId: "gid://shopify/ProductVariant/10",
      values: { [definition.id]: "120" },
    });
    await saveProductSpecifications("shop-b", {
      shopifyProductId: "gid://shopify/Product/1",
      shopifyVariantId: "gid://shopify/ProductVariant/10",
      values: { [definition.id]: "105" },
    });

    const values = await getSpecificationsForVariant("shop-b", "gid://shopify/ProductVariant/10");
    expect(values).toHaveLength(1);
    expect(values[0].value).toBe(105);
  });

  it("rejects wrong datatype values", async () => {
    const definition = await createSpecificationDefinition("shop-c", {
      category: "CPU",
      key: "tdp",
      label: "TDP",
      dataType: "NUMBER",
      unit: "W",
      required: true,
      config: null,
    });

    await expect(
      saveProductSpecifications("shop-c", {
        shopifyProductId: "gid://shopify/Product/1",
        shopifyVariantId: "gid://shopify/ProductVariant/10",
        values: { [definition.id]: "high" },
      })
    ).rejects.toThrow("must be a number");
  });

  it("enforces cross-shop definition isolation", async () => {
    const definition = await createSpecificationDefinition("shop-d", {
      category: "CPU",
      key: "socket",
      label: "Socket",
      dataType: "STRING",
      unit: null,
      required: true,
      config: null,
    });

    await expect(
      saveProductSpecifications("shop-e", {
        shopifyProductId: "gid://shopify/Product/1",
        shopifyVariantId: "gid://shopify/ProductVariant/10",
        values: { [definition.id]: "AM5" },
      })
    ).rejects.toThrow("invalid for this shop");
  });
});

describe("Shopify collection variant validation", () => {
  it("rejects a variant that is missing from the assigned collection", async () => {
    const admin = {
      graphql: vi.fn(async () => ({
        json: async () => ({
          collection: {
            products: {
              nodes: [
                {
                  id: "gid://shopify/Product/1",
                  title: "CPU",
                  handle: "cpu",
                  featuredImage: null,
                  variants: {
                    nodes: [{ id: "gid://shopify/ProductVariant/1", title: "Default Title", sku: null }],
                  },
                },
              ],
            },
          },
        }),
      })),
    };

    const result = await findShopifyVariantInCollection(
      admin as never,
      "gid://shopify/Collection/1",
      "gid://shopify/Product/1",
      "gid://shopify/ProductVariant/2"
    );

    expect(result.type).toBe("failure");
  });
});
