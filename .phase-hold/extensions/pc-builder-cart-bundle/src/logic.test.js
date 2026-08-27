import { describe, it, expect } from "vitest";
import { mergeBuildLines } from "./logic";

function variantLine(id, variantId, quantity, buildId, buildTitle) {
  return {
    id,
    quantity,
    merchandise: { __typename: "ProductVariant", id: variantId },
    attribute: buildId ? { value: buildId } : null,
    buildTitle: buildTitle ? { value: buildTitle } : null,
  };
}

describe("mergeBuildLines", () => {
  it("merges two or more lines sharing a _buildId into one operation", () => {
    const input = {
      cart: {
        lines: [
          variantLine("line-1", "gid://shopify/ProductVariant/1", 1, "build-1", "My PC Build"),
          variantLine("line-2", "gid://shopify/ProductVariant/2", 1, "build-1"),
        ],
      },
    };

    const result = mergeBuildLines(input);
    expect(result.operations).toHaveLength(1);
    expect(result.operations[0]).toEqual({
      merge: {
        cartLines: [
          { cartLineId: "line-1", quantity: 1 },
          { cartLineId: "line-2", quantity: 1 },
        ],
        parentVariantId: "gid://shopify/ProductVariant/1",
        title: "My PC Build",
      },
    });
  });

  it("leaves lines without a _buildId untouched", () => {
    const input = {
      cart: {
        lines: [variantLine("line-1", "gid://shopify/ProductVariant/1", 1, null)],
      },
    };

    expect(mergeBuildLines(input).operations).toEqual([]);
  });

  it("does not merge a build with only one line", () => {
    const input = {
      cart: {
        lines: [variantLine("line-1", "gid://shopify/ProductVariant/1", 1, "build-1")],
      },
    };

    expect(mergeBuildLines(input).operations).toEqual([]);
  });

  it("falls back to a default title when none is provided", () => {
    const input = {
      cart: {
        lines: [
          variantLine("line-1", "gid://shopify/ProductVariant/1", 1, "build-1"),
          variantLine("line-2", "gid://shopify/ProductVariant/2", 1, "build-1"),
        ],
      },
    };

    expect(mergeBuildLines(input).operations[0].merge.title).toBe("Custom PC Build");
  });

  it("keeps unrelated builds in separate merge operations", () => {
    const input = {
      cart: {
        lines: [
          variantLine("line-1", "gid://shopify/ProductVariant/1", 1, "build-1"),
          variantLine("line-2", "gid://shopify/ProductVariant/2", 1, "build-1"),
          variantLine("line-3", "gid://shopify/ProductVariant/3", 1, "build-2"),
          variantLine("line-4", "gid://shopify/ProductVariant/4", 1, "build-2"),
        ],
      },
    };

    const result = mergeBuildLines(input);
    expect(result.operations).toHaveLength(2);
  });

  it("fails safe (skips the group) when the parent line's merchandise isn't a ProductVariant", () => {
    const input = {
      cart: {
        lines: [
          {
            id: "line-1",
            quantity: 1,
            merchandise: { __typename: "CustomProduct" },
            attribute: { value: "build-1" },
            buildTitle: null,
          },
          variantLine("line-2", "gid://shopify/ProductVariant/2", 1, "build-1"),
        ],
      },
    };

    expect(mergeBuildLines(input).operations).toEqual([]);
  });
});
