import { describe, it, expect } from "vitest";
import {
  validateCatalogReferenceType,
  validateCatalogAssignmentInput,
} from "./builder-validation";

describe("validateCatalogReferenceType", () => {
  it("rejects unknown type", () => {
    expect(validateCatalogReferenceType("unknown")).not.toBeNull();
  });

  it("accepts product", () => {
    expect(validateCatalogReferenceType("product")).toBeNull();
  });

  it("accepts variant", () => {
    expect(validateCatalogReferenceType("variant")).toBeNull();
  });
});

describe("validateCatalogAssignmentInput", () => {
  it("rejects missing referenceType", () => {
    expect(validateCatalogAssignmentInput({})).not.toBeNull();
  });

  it("rejects product without shopifyProductId", () => {
    expect(
      validateCatalogAssignmentInput({
        referenceType: "product",
      })
    ).not.toBeNull();
  });

  it("rejects variant without shopifyVariantId", () => {
    expect(
      validateCatalogAssignmentInput({
        referenceType: "variant",
      })
    ).not.toBeNull();
  });

  it("accepts product with shopifyProductId", () => {
    expect(
      validateCatalogAssignmentInput({
        referenceType: "product",
        shopifyProductId: "gid://shopify/Product/1",
      })
    ).toBeNull();
  });

  it("accepts variant with shopifyVariantId", () => {
    expect(
      validateCatalogAssignmentInput({
        referenceType: "variant",
        shopifyVariantId: "gid://shopify/ProductVariant/1",
      })
    ).toBeNull();
  });
});
