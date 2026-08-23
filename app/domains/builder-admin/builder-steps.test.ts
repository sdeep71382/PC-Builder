import { describe, it, expect } from "vitest";
import {
  validateStepName,
  validateStepPosition,
  validateStep,
  normalizePositions,
} from "./builder-validation";

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
  it("sorts by existing position and reassigns sequential positions", () => {
    const steps = [
      { id: "a", position: 3 } as any,
      { id: "b", position: 1 } as any,
      { id: "c", position: 2 } as any,
    ];
    const result = normalizePositions(steps);
    expect(result.map((s) => s.position)).toEqual([1, 2, 3]);
    expect(result.map((s) => s.id)).toEqual(["b", "c", "a"]);
  });

  it("handles single step", () => {
    const steps = [{ id: "a", position: 1 } as any];
    const result = normalizePositions(steps);
    expect(result[0].position).toBe(1);
  });
});
