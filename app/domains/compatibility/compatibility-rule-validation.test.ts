import { describe, expect, it } from "vitest";
import {
  validateOperatorForDataTypes,
  validateRuleMessage,
  validateRuleOperator,
} from "./compatibility-rule-validation";

describe("compatibility rule validation", () => {
  it("accepts supported operators", () => {
    expect(validateRuleOperator("EQUALS")).toBeNull();
    expect(validateRuleOperator("IN")).toBeNull();
  });

  it("rejects unsupported operators", () => {
    expect(validateRuleOperator("CONTAINS")?.field).toBe("operator");
  });

  it("requires explainable messages", () => {
    expect(validateRuleMessage("")?.message).toBe("Compatibility message is required.");
  });

  it("requires number fields for comparison operators", () => {
    expect(
      validateOperatorForDataTypes("LESS_THAN_OR_EQUAL", "STRING", "NUMBER")?.message
    ).toBe("Comparison rules require number fields.");
  });

  it("requires target arrays for IN operators", () => {
    expect(validateOperatorForDataTypes("IN", "STRING", "STRING_ARRAY")).toBeNull();
    expect(validateOperatorForDataTypes("IN", "STRING", "STRING")?.message).toBe(
      "IN rules require a target array field."
    );
  });
});
