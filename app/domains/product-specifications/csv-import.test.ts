import { describe, expect, it } from "vitest";
import { buildSpecificationImportPlan, parseCsv } from "./csv-import";
import type { ShopifyCollectionProduct, SpecificationDefinition } from "./types";

function definition(overrides: Partial<SpecificationDefinition> = {}): SpecificationDefinition {
  return {
    id: "def-socket",
    shopId: "shop-a",
    category: "cpu",
    key: "socket",
    label: "Socket",
    dataType: "STRING",
    unit: null,
    required: false,
    config: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function product(overrides: Partial<ShopifyCollectionProduct> = {}): ShopifyCollectionProduct {
  return {
    id: "gid://shopify/Product/1",
    title: "Ryzen 7 Builder CPU",
    handle: "ryzen-7-builder-cpu",
    featuredImage: null,
    variants: [{ id: "gid://shopify/ProductVariant/1", title: "Default Title", sku: "RYZEN7-A" }],
    ...overrides,
  };
}

describe("parseCsv", () => {
  it("parses a simple comma-separated grid", () => {
    expect(parseCsv("handle,sku\nryzen-7,RYZEN7-A\n")).toEqual([
      ["handle", "sku"],
      ["ryzen-7", "RYZEN7-A"],
    ]);
  });

  it("handles quoted fields with embedded commas and escaped quotes", () => {
    expect(parseCsv('handle,label\nryzen-7,"6-core, 12-thread ""Zen 4"""\n')).toEqual([
      ["handle", "label"],
      ["ryzen-7", '6-core, 12-thread "Zen 4"'],
    ]);
  });

  it("skips blank lines", () => {
    expect(parseCsv("handle,sku\n\nryzen-7,RYZEN7-A\n\n")).toEqual([
      ["handle", "sku"],
      ["ryzen-7", "RYZEN7-A"],
    ]);
  });
});

describe("buildSpecificationImportPlan", () => {
  const definitions = [definition()];
  const products = [product()];

  it("matches a row by SKU and maps known columns to their definition ids", () => {
    const plan = buildSpecificationImportPlan(
      "sku,socket,unknown_column\nRYZEN7-A,AM5,ignored\n",
      definitions,
      products
    );

    expect(plan.errors).toEqual([]);
    expect(plan.entries).toEqual([
      {
        shopifyProductId: "gid://shopify/Product/1",
        shopifyVariantId: "gid://shopify/ProductVariant/1",
        productTitle: "Ryzen 7 Builder CPU",
        variantTitle: "Default Title",
        values: { "def-socket": "AM5" },
      },
    ]);
  });

  it("matches a row by handle when the product has a single variant", () => {
    const plan = buildSpecificationImportPlan(
      "handle,socket\nryzen-7-builder-cpu,AM5\n",
      definitions,
      products
    );

    expect(plan.errors).toEqual([]);
    expect(plan.entries).toHaveLength(1);
    expect(plan.entries[0].shopifyVariantId).toBe("gid://shopify/ProductVariant/1");
  });

  it("reports an error when a handle matches more than one variant", () => {
    const multiVariantProduct = product({
      variants: [
        { id: "gid://shopify/ProductVariant/1", title: "8-core", sku: "" },
        { id: "gid://shopify/ProductVariant/2", title: "16-core", sku: "" },
      ],
    });

    const plan = buildSpecificationImportPlan(
      "handle,socket\nryzen-7-builder-cpu,AM5\n",
      definitions,
      [multiVariantProduct]
    );

    expect(plan.entries).toEqual([]);
    expect(plan.errors).toEqual([
      { row: 2, message: expect.stringContaining("multiple variants") },
    ]);
  });

  it("reports an error when the SKU is not found", () => {
    const plan = buildSpecificationImportPlan("sku,socket\nMISSING-SKU,AM5\n", definitions, products);

    expect(plan.entries).toEqual([]);
    expect(plan.errors).toEqual([
      { row: 2, message: expect.stringContaining("MISSING-SKU") },
    ]);
  });

  it("rejects a CSV missing both handle and sku columns", () => {
    const plan = buildSpecificationImportPlan("socket\nAM5\n", definitions, products);

    expect(plan.entries).toEqual([]);
    expect(plan.errors).toEqual([
      { row: 1, message: expect.stringContaining("handle") },
    ]);
  });

  it("treats a blank cell as clearing the specification value", () => {
    const plan = buildSpecificationImportPlan("sku,socket\nRYZEN7-A,\n", definitions, products);

    expect(plan.errors).toEqual([]);
    expect(plan.entries[0].values).toEqual({ "def-socket": undefined });
  });
});
