import { describe, expect, it } from "vitest";
import {
  parseSpecificationValue,
  validateSpecificationDefinitionInput,
} from "./product-specification-validation";

const baseDefinition = {
  key: "tdp",
  label: "TDP",
  dataType: "NUMBER" as const,
  required: true,
};

describe("product specification validation", () => {
  it("validates required definition fields", () => {
    expect(
      validateSpecificationDefinitionInput({
        category: "",
        key: "socket",
        label: "Socket",
        dataType: "STRING",
      })
    ).toEqual({ field: "category", message: "Specification category is required." });
  });

  it("parses numbers", () => {
    expect(parseSpecificationValue(baseDefinition, "120")).toEqual({
      value: 120,
      error: null,
    });
  });

  it("rejects wrong number values", () => {
    expect(parseSpecificationValue(baseDefinition, "fast").error?.message).toBe(
      "TDP must be a number."
    );
  });

  it("normalizes string arrays", () => {
    expect(
      parseSpecificationValue(
        {
          key: "supportedSockets",
          label: "Supported sockets",
          dataType: "STRING_ARRAY",
          required: true,
        },
        "AM5, LGA1700, AM4"
      )
    ).toEqual({ value: ["AM5", "LGA1700", "AM4"], error: null });
  });
});
