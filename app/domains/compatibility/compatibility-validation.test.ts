import { describe, it, expect } from "vitest";
import {
  validateTagName,
  validateTagRole,
  validateTagValue,
  validateHeadroomPercentage,
  validateBuildRetentionDays,
  isNumericRole,
} from "./compatibility-validation";

describe("validateTagName", () => {
  it("rejects blank name", () => {
    expect(validateTagName("")).not.toBeNull();
  });

  it("rejects overly long name", () => {
    expect(validateTagName("a".repeat(121))).not.toBeNull();
  });

  it("accepts a valid name", () => {
    expect(validateTagName("Socket Type")).toBeNull();
  });
});

describe("validateTagRole", () => {
  it("rejects an unknown role", () => {
    expect(validateTagRole("unknown")).not.toBeNull();
  });

  it("accepts standard, powerDraw, and outputWattage", () => {
    expect(validateTagRole("standard")).toBeNull();
    expect(validateTagRole("powerDraw")).toBeNull();
    expect(validateTagRole("outputWattage")).toBeNull();
  });
});

describe("isNumericRole", () => {
  it("is false for standard", () => {
    expect(isNumericRole("standard")).toBe(false);
  });

  it("is true for powerDraw and outputWattage", () => {
    expect(isNumericRole("powerDraw")).toBe(true);
    expect(isNumericRole("outputWattage")).toBe(true);
  });
});

describe("validateTagValue", () => {
  it("rejects a blank value", () => {
    expect(validateTagValue("standard", "")).not.toBeNull();
  });

  it("accepts any non-blank value for a standard tag", () => {
    expect(validateTagValue("standard", "AM5")).toBeNull();
  });

  it("rejects a non-numeric value for a powerDraw tag", () => {
    expect(validateTagValue("powerDraw", "high")).not.toBeNull();
  });

  it("rejects a negative number for an outputWattage tag", () => {
    expect(validateTagValue("outputWattage", "-100")).not.toBeNull();
  });

  it("accepts a non-negative number for a powerDraw tag", () => {
    expect(validateTagValue("powerDraw", "125")).toBeNull();
  });
});

describe("validateHeadroomPercentage", () => {
  it("rejects a negative value", () => {
    expect(validateHeadroomPercentage(-1)).not.toBeNull();
  });

  it("rejects a non-integer value", () => {
    expect(validateHeadroomPercentage(1.5)).not.toBeNull();
  });

  it("accepts zero and positive integers", () => {
    expect(validateHeadroomPercentage(0)).toBeNull();
    expect(validateHeadroomPercentage(20)).toBeNull();
  });
});

describe("validateBuildRetentionDays", () => {
  it("rejects zero or negative values", () => {
    expect(validateBuildRetentionDays(0)).not.toBeNull();
    expect(validateBuildRetentionDays(-5)).not.toBeNull();
  });

  it("accepts a positive integer", () => {
    expect(validateBuildRetentionDays(30)).toBeNull();
  });
});
