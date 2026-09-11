import { describe, expect, test } from "vitest";
import { cartTransformRun } from "../src/cart_transform_run.js";

describe("PC Builder cart transform", () => {
  test("uses the first selected component variant as the visible bundle parent", () => {
    const result = cartTransformRun({
      cart: {
        lines: [
          {
            id: "gid://shopify/CartLine/1",
            quantity: 1,
            session: { value: "pcb_build_1" },
            parent: { value: "gid://shopify/ProductVariant/101" },
            component: { value: "CPU" },
            merchandise: {
              __typename: "ProductVariant",
              id: "gid://shopify/ProductVariant/101",
              title: "Default Title",
              product: { title: "Xeon Builder CPU" },
            },
          },
          {
            id: "gid://shopify/CartLine/2",
            quantity: 1,
            session: { value: "pcb_build_1" },
            parent: { value: "gid://shopify/ProductVariant/101" },
            component: { value: "Case" },
            merchandise: {
              __typename: "ProductVariant",
              id: "gid://shopify/ProductVariant/505",
              title: "Default Title",
              product: { title: "Full Tower Builder Case" },
            },
          },
        ],
      },
    });

    expect(result).toEqual({
      operations: [
        {
          linesMerge: {
            cartLines: [
              { cartLineId: "gid://shopify/CartLine/1", quantity: 1 },
              { cartLineId: "gid://shopify/CartLine/2", quantity: 1 },
            ],
            parentVariantId: "gid://shopify/ProductVariant/101",
            attributes: [
              { key: "CPU", value: "Xeon Builder CPU" },
              { key: "Case", value: "Full Tower Builder Case" },
            ],
          },
        },
      ],
    });
  });

  test("keeps separate build sessions in separate bundles even when their first variant matches", () => {
    const makeLine = (id, session, variantId, component, title) => ({
      id: `gid://shopify/CartLine/${id}`,
      quantity: 1,
      session: { value: session },
      parent: { value: "gid://shopify/ProductVariant/101" },
      component: { value: component },
      merchandise: {
        __typename: "ProductVariant",
        id: `gid://shopify/ProductVariant/${variantId}`,
        title: "Default Title",
        product: { title },
      },
    });

    const result = cartTransformRun({
      cart: {
        lines: [
          makeLine(1, "pcb_build_1", 101, "CPU", "Xeon Builder CPU"),
          makeLine(2, "pcb_build_1", 505, "Case", "Full Tower Builder Case"),
          makeLine(3, "pcb_build_2", 101, "CPU", "Xeon Builder CPU"),
          makeLine(4, "pcb_build_2", 505, "Case", "Full Tower Builder Case"),
        ],
      },
    });

    expect(result.operations).toHaveLength(2);
    expect(result.operations.map((operation) => operation.linesMerge.cartLines)).toEqual([
      [
        { cartLineId: "gid://shopify/CartLine/1", quantity: 1 },
        { cartLineId: "gid://shopify/CartLine/2", quantity: 1 },
      ],
      [
        { cartLineId: "gid://shopify/CartLine/3", quantity: 1 },
        { cartLineId: "gid://shopify/CartLine/4", quantity: 1 },
      ],
    ]);
  });

  test("applies a percentage price decrease when the shopper unlocked a spend discount", () => {
    const result = cartTransformRun({
      cart: {
        lines: [
          {
            id: "gid://shopify/CartLine/1",
            quantity: 1,
            session: { value: "pcb_build_1" },
            parent: { value: "gid://shopify/ProductVariant/101" },
            component: { value: "CPU" },
            discountPercent: { value: "10" },
            merchandise: {
              __typename: "ProductVariant",
              id: "gid://shopify/ProductVariant/101",
              title: "Default Title",
              product: { title: "Xeon Builder CPU" },
            },
          },
          {
            id: "gid://shopify/CartLine/2",
            quantity: 1,
            session: { value: "pcb_build_1" },
            parent: { value: "gid://shopify/ProductVariant/101" },
            component: { value: "Case" },
            discountPercent: { value: "10" },
            merchandise: {
              __typename: "ProductVariant",
              id: "gid://shopify/ProductVariant/505",
              title: "Default Title",
              product: { title: "Full Tower Builder Case" },
            },
          },
        ],
      },
    });

    expect(result.operations).toHaveLength(1);
    expect(result.operations[0].linesMerge.price).toEqual({
      percentageDecrease: { value: 10 },
    });
  });

  test("ignores an out-of-range discount attribute and merges without a price adjustment", () => {
    const result = cartTransformRun({
      cart: {
        lines: [
          {
            id: "gid://shopify/CartLine/1",
            quantity: 1,
            session: { value: "pcb_build_1" },
            parent: { value: "gid://shopify/ProductVariant/101" },
            component: { value: "CPU" },
            discountPercent: { value: "150" },
            merchandise: {
              __typename: "ProductVariant",
              id: "gid://shopify/ProductVariant/101",
              title: "Default Title",
              product: { title: "Xeon Builder CPU" },
            },
          },
          {
            id: "gid://shopify/CartLine/2",
            quantity: 1,
            session: { value: "pcb_build_1" },
            parent: { value: "gid://shopify/ProductVariant/101" },
            component: { value: "Case" },
            discountPercent: null,
            merchandise: {
              __typename: "ProductVariant",
              id: "gid://shopify/ProductVariant/505",
              title: "Default Title",
              product: { title: "Full Tower Builder Case" },
            },
          },
        ],
      },
    });

    expect(result.operations).toHaveLength(1);
    expect(result.operations[0].linesMerge.price).toBeUndefined();
  });

  test("ignores cart lines without both builder markers", () => {
    const result = cartTransformRun({
      cart: {
        lines: [
          {
            id: "gid://shopify/CartLine/1",
            quantity: 1,
            session: null,
            parent: { value: "gid://shopify/ProductVariant/101" },
            component: { value: "CPU" },
            merchandise: {
              __typename: "ProductVariant",
              id: "gid://shopify/ProductVariant/101",
              title: "Default Title",
              product: { title: "Xeon Builder CPU" },
            },
          },
          {
            id: "gid://shopify/CartLine/2",
            quantity: 1,
            session: { value: "pcb_build_1" },
            parent: null,
            component: { value: "Case" },
            merchandise: {
              __typename: "ProductVariant",
              id: "gid://shopify/ProductVariant/505",
              title: "Default Title",
              product: { title: "Full Tower Builder Case" },
            },
          },
        ],
      },
    });

    expect(result).toEqual({ operations: [] });
  });
});
