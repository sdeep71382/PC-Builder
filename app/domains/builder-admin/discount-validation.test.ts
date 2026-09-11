import { describe, it, expect } from "vitest";
import { validateDiscountInput } from "./discount-validation";

describe("validateDiscountInput", () => {
  it("accepts a valid threshold and percentage", () => {
    expect(
      validateDiscountInput({ enabled: true, thresholdAmount: "1500", discountPercentage: "10" })
    ).toBeNull();
  });

  it("rejects a zero or negative threshold", () => {
    expect(
      validateDiscountInput({ enabled: true, thresholdAmount: "0", discountPercentage: "10" })
    )?.toMatchObject({ field: "thresholdAmount" });
    expect(
      validateDiscountInput({ enabled: true, thresholdAmount: "-5", discountPercentage: "10" })
    )?.toMatchObject({ field: "thresholdAmount" });
  });

  it("rejects a non-numeric threshold", () => {
    expect(
      validateDiscountInput({ enabled: true, thresholdAmount: "abc", discountPercentage: "10" })
    )?.toMatchObject({ field: "thresholdAmount" });
  });

  it("rejects a percentage outside (0, 100]", () => {
    expect(
      validateDiscountInput({ enabled: true, thresholdAmount: "1000", discountPercentage: "0" })
    )?.toMatchObject({ field: "discountPercentage" });
    expect(
      validateDiscountInput({ enabled: true, thresholdAmount: "1000", discountPercentage: "101" })
    )?.toMatchObject({ field: "discountPercentage" });
  });

  it("allows a 100% discount", () => {
    expect(
      validateDiscountInput({ enabled: true, thresholdAmount: "1000", discountPercentage: "100" })
    ).toBeNull();
  });

  it("rejects an overly long label", () => {
    expect(
      validateDiscountInput({
        enabled: true,
        thresholdAmount: "1000",
        discountPercentage: "10",
        label: "a".repeat(121),
      })
    )?.toMatchObject({ field: "label" });
  });
});
