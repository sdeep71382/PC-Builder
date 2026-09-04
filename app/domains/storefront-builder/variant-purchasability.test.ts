import { describe, expect, it } from "vitest";
import { getVariantPurchasability } from "./variant-purchasability";

describe("variant purchasability", () => {
  it.each([
    [{ exists: false }, "VARIANT_NOT_FOUND"],
    [{ exists: true, productStatus: "DRAFT", onlineStorePublished: true, availableForSale: true }, "PRODUCT_INACTIVE"],
    [{ exists: true, productStatus: "ACTIVE", onlineStorePublished: false, availableForSale: true }, "NOT_PUBLISHED"],
    [{ exists: true, productStatus: "ACTIVE", onlineStorePublished: true, availableForSale: false }, "VARIANT_UNAVAILABLE"],
  ])("rejects %s", (input, reason) => {
    expect(getVariantPurchasability(input)).toEqual({ purchasable: false, reason });
  });

  it("accepts an active, published, available variant", () => {
    expect(
      getVariantPurchasability({
        exists: true,
        productStatus: "ACTIVE",
        onlineStorePublished: true,
        availableForSale: true,
      })
    ).toEqual({ purchasable: true, reason: "AVAILABLE" });
  });
});
