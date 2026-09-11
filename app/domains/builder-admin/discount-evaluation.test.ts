import { describe, it, expect } from "vitest";
import { evaluateSpendDiscount } from "./discount-evaluation";

describe("evaluateSpendDiscount", () => {
  it("returns null when there is no rule", () => {
    expect(evaluateSpendDiscount(null, 5000)).toBeNull();
  });

  it("returns null when the rule is disabled", () => {
    expect(
      evaluateSpendDiscount({ enabled: false, thresholdAmount: "1000", discountPercentage: "10" }, 5000)
    ).toBeNull();
  });

  it("returns null when the total has not reached the threshold", () => {
    expect(
      evaluateSpendDiscount({ enabled: true, thresholdAmount: "1000", discountPercentage: "10" }, 999.99)
    ).toBeNull();
  });

  it("applies at exactly the threshold", () => {
    expect(
      evaluateSpendDiscount({ enabled: true, thresholdAmount: "1000", discountPercentage: "10" }, 1000)
    ).toEqual({ percentage: "10", thresholdAmount: "1000" });
  });

  it("applies above the threshold", () => {
    expect(
      evaluateSpendDiscount({ enabled: true, thresholdAmount: "1000", discountPercentage: "7.5" }, 2400.5)
    ).toEqual({ percentage: "7.5", thresholdAmount: "1000" });
  });

  it("guards against a malformed threshold", () => {
    expect(
      evaluateSpendDiscount({ enabled: true, thresholdAmount: "not-a-number", discountPercentage: "10" }, 5000)
    ).toBeNull();
  });
});
