import { describe, it, expect } from "vitest";
import {
  validateBuilderName,
  validateBuilderStatusTransition,
  validatePublishRequirements,
  validateStepName,
  validateStepPosition,
  validateCatalogReferenceType,
  validateCatalogAssignmentInput,
  validateBuilder,
  validateStep,
  normalizePositions,
  isStaleSave,
} from "./builder-validation";

describe("validateBuilderName", () => {
  it("rejects missing name", () => {
    expect(validateBuilderName("")).not.toBeNull();
    expect(validateBuilderName(undefined as unknown as string)).not.toBeNull();
  });

  it("rejects blank name", () => {
    expect(validateBuilderName("   ")).not.toBeNull();
  });

  it("rejects name exceeding max length", () => {
    const longName = "a".repeat(121);
    expect(validateBuilderName(longName)).not.toBeNull();
  });

  it("accepts valid name", () => {
    expect(validateBuilderName("My Builder")).toBeNull();
  });
});

describe("validateBuilderStatusTransition", () => {
  it("allows draft -> published", () => {
    expect(validateBuilderStatusTransition("draft", "published")).toBeNull();
  });

  it("allows draft -> archived", () => {
    expect(validateBuilderStatusTransition("draft", "archived")).toBeNull();
  });

  it("allows published -> archived", () => {
    expect(validateBuilderStatusTransition("published", "archived")).toBeNull();
  });

  it("allows archived -> published", () => {
    expect(validateBuilderStatusTransition("archived", "published")).toBeNull();
  });

  it("rejects draft -> draft", () => {
    expect(validateBuilderStatusTransition("draft", "draft")).not.toBeNull();
  });

  it("rejects published -> draft", () => {
    expect(validateBuilderStatusTransition("published", "draft")).not.toBeNull();
  });
});

describe("validatePublishRequirements", () => {
  it("rejects builder with blank name", () => {
    expect(
      validatePublishRequirements({ name: "", status: "draft" }, 1)
    ).not.toBeNull();
  });

  it("rejects builder with no enabled steps", () => {
    expect(
      validatePublishRequirements({ name: "Test", status: "draft" }, 0)
    ).not.toBeNull();
  });

  it("accepts builder with valid name and enabled step", () => {
    expect(
      validatePublishRequirements({ name: "Test", status: "draft" }, 1)
    ).toBeNull();
  });
});

describe("validateStepName", () => {
  it("rejects missing name", () => {
    expect(validateStepName("")).not.toBeNull();
  });

  it("rejects blank name", () => {
    expect(validateStepName("   ")).not.toBeNull();
  });

  it("accepts valid name", () => {
    expect(validateStepName("Processor")).toBeNull();
  });
});

describe("validateStepPosition", () => {
  it("rejects zero", () => {
    expect(validateStepPosition(0)).not.toBeNull();
  });

  it("rejects negative", () => {
    expect(validateStepPosition(-1)).not.toBeNull();
  });

  it("rejects non-integer", () => {
    expect(validateStepPosition(1.5)).not.toBeNull();
  });

  it("accepts positive integer", () => {
    expect(validateStepPosition(1)).toBeNull();
  });
});

describe("validateCatalogReferenceType", () => {
  it("rejects unknown type", () => {
    expect(validateCatalogReferenceType("unknown")).not.toBeNull();
  });

  it("accepts product", () => {
    expect(validateCatalogReferenceType("product")).toBeNull();
  });

  it("accepts collection", () => {
    expect(validateCatalogReferenceType("collection")).toBeNull();
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

  it("rejects collection without shopifyCollectionId", () => {
    expect(
      validateCatalogAssignmentInput({
        referenceType: "collection",
      })
    ).not.toBeNull();
  });

  it("accepts collection with shopifyCollectionId", () => {
    expect(
      validateCatalogAssignmentInput({
        referenceType: "collection",
        shopifyCollectionId: "gid://shopify/Collection/1",
      })
    ).toBeNull();
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

describe("validateBuilder", () => {
  it("rejects blank name", () => {
    expect(validateBuilder({ name: "", shopId: "shop-1" })).not.toBeNull();
  });

  it("accepts valid builder data", () => {
    expect(validateBuilder({ name: "Test", shopId: "shop-1" })).toBeNull();
  });
});

describe("validateStep", () => {
  it("rejects blank name", () => {
    expect(
      validateStep({ name: "", shopId: "shop-1", builderId: "builder-1" })
    ).not.toBeNull();
  });

  it("rejects invalid position", () => {
    expect(
      validateStep({
        name: "Step",
        shopId: "shop-1",
        builderId: "builder-1",
        position: 0,
      })
    ).not.toBeNull();
  });

  it("accepts valid step data", () => {
    expect(
      validateStep({
        name: "Step",
        shopId: "shop-1",
        builderId: "builder-1",
        position: 1,
      })
    ).toBeNull();
  });
});

describe("normalizePositions", () => {
  it("normalizes positions to 1-based sequential order", () => {
    const steps = [
      { id: "a", position: 3 } as any,
      { id: "b", position: 1 } as any,
      { id: "c", position: 2 } as any,
    ];
    const result = normalizePositions(steps);
    expect(result.map((s) => s.position)).toEqual([1, 2, 3]);
  });
});

describe("isStaleSave", () => {
  it("returns true when version is undefined", () => {
    expect(isStaleSave(undefined, 1)).toBe(true);
  });

  it("returns true when version is older", () => {
    expect(isStaleSave(0, 1)).toBe(true);
  });

  it("returns false when version matches", () => {
    expect(isStaleSave(1, 1)).toBe(false);
  });

  it("returns false when version is newer", () => {
    expect(isStaleSave(2, 1)).toBe(false);
  });
});
