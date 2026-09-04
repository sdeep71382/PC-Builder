export type VariantPurchasabilityReason =
  | "AVAILABLE"
  | "PRODUCT_INACTIVE"
  | "NOT_PUBLISHED"
  | "VARIANT_UNAVAILABLE"
  | "VARIANT_NOT_FOUND"
  | "UNKNOWN";

export interface VariantPurchasability {
  purchasable: boolean;
  reason: VariantPurchasabilityReason;
}

export function getVariantPurchasability(input: {
  exists: boolean;
  productStatus?: string | null;
  onlineStorePublished?: boolean | null;
  availableForSale?: boolean | null;
}): VariantPurchasability {
  if (!input.exists) return { purchasable: false, reason: "VARIANT_NOT_FOUND" };
  if (input.productStatus && input.productStatus !== "ACTIVE") {
    return { purchasable: false, reason: "PRODUCT_INACTIVE" };
  }
  if (input.onlineStorePublished === false) {
    return { purchasable: false, reason: "NOT_PUBLISHED" };
  }
  if (input.availableForSale === false) {
    return { purchasable: false, reason: "VARIANT_UNAVAILABLE" };
  }
  if (input.onlineStorePublished == null || input.availableForSale == null) {
    return { purchasable: false, reason: "UNKNOWN" };
  }
  return { purchasable: true, reason: "AVAILABLE" };
}
