import { describe, expect, it } from "vitest";
import {
  calculateRunningTotal,
  canProgressFromStep,
  createBuildState,
  filterProductsForSearch,
  goBack,
  goNext,
  selectStepProduct,
  skipOptionalStep,
} from "./build-state";
import type { StorefrontBuilderStepDto, StorefrontProductOptionDto } from "./types";

const cpuStep: StorefrontBuilderStepDto = {
  publicId: "step-cpu",
  key: "processor",
  name: "Processor",
  position: 1,
  required: true,
  state: "ready",
  products: [],
};

const warrantyStep: StorefrontBuilderStepDto = {
  publicId: "step-warranty",
  key: "warranty",
  name: "Warranty",
  position: 2,
  required: false,
  state: "ready",
  products: [],
};

const ryzen: StorefrontProductOptionDto = {
  productId: "gid://shopify/Product/1",
  variantId: "gid://shopify/ProductVariant/1",
  productTitle: "Ryzen Test A",
  variantTitle: null,
  vendor: "AMD",
  sku: "RYZEN-A",
  image: null,
  price: { amount: "399.99", currencyCode: "USD" },
  available: true,
  purchasable: true,
  unavailableReason: null,
  specifications: { socket: "AM5" },
};

const board: StorefrontProductOptionDto = {
  ...ryzen,
  productId: "gid://shopify/Product/2",
  variantId: "gid://shopify/ProductVariant/2",
  productTitle: "Board A",
  vendor: "Board Vendor",
  sku: "BOARD-A",
  price: { amount: "199.01", currencyCode: "USD" },
};

describe("storefront build state", () => {
  it("stores a real Shopify variant selection", () => {
    const state = selectStepProduct(createBuildState("builder-a"), cpuStep.publicId, ryzen);

    expect(state.selections[cpuStep.publicId]).toMatchObject({
      productId: "gid://shopify/Product/1",
      variantId: "gid://shopify/ProductVariant/1",
      specs: { socket: "AM5" },
    });
  });

  it("preserves selections when navigating back", () => {
    const selected = selectStepProduct(createBuildState("builder-a"), cpuStep.publicId, ryzen);
    const next = goNext(selected, [cpuStep, warrantyStep]);
    const back = goBack(next);

    expect(back.currentStep).toBe(0);
    expect(back.selections[cpuStep.publicId]?.variantId).toBe(ryzen.variantId);
  });

  it("allows optional step skip and blocks required step progression without selection", () => {
    const initial = createBuildState("builder-a");

    expect(canProgressFromStep(initial, cpuStep)).toBe(false);
    expect(goNext(initial, [cpuStep, warrantyStep]).currentStep).toBe(0);

    const skipped = skipOptionalStep({ ...initial, currentStep: 1 }, warrantyStep);
    expect(skipped.skippedStepIds).toEqual([warrantyStep.publicId]);
  });

  it("filters products by title, vendor, and SKU", () => {
    expect(filterProductsForSearch([ryzen, board], "amd")).toEqual([ryzen]);
    expect(filterProductsForSearch([ryzen, board], "BOARD-A")).toEqual([board]);
    expect(filterProductsForSearch([ryzen, board], "ryzen")).toEqual([ryzen]);
  });

  it("calculates a running total without hard-coded currency symbols", () => {
    const state = selectStepProduct(createBuildState("builder-a"), cpuStep.publicId, ryzen);
    const withBoard = selectStepProduct(state, "step-board", board);

    expect(calculateRunningTotal(withBoard.selections)).toEqual({
      amount: "599.00",
      currencyCode: "USD",
    });
  });
});
