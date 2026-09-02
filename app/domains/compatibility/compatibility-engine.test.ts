import { describe, expect, it } from "vitest";
import {
  evaluateBuild,
  evaluateCandidate,
  evaluateRule,
  getCompatibleVariants,
  getViolations,
} from "./compatibility-engine";
import type { CompatibilityRule, CompatibilitySelection } from "./types";

const baseRule = {
  shopId: "shop-a",
  builderId: "builder-a",
  comparisonValue: null,
  severity: "error",
  enabled: true,
  createdAt: new Date(),
  updatedAt: new Date(),
} satisfies Partial<CompatibilityRule>;

function rule(input: Partial<CompatibilityRule> & Pick<
  CompatibilityRule,
  "id" | "sourceCategory" | "sourceField" | "operator" | "targetCategory" | "targetField"
>): CompatibilityRule {
  return {
    ...baseRule,
    message: input.message ?? "Configured incompatibility message.",
    ...input,
  } as CompatibilityRule;
}

function selection(
  category: string,
  specifications: Record<string, unknown>,
  variantId = category
): CompatibilitySelection {
  return {
    category,
    shopifyProductId: `gid://shopify/Product/${variantId}`,
    shopifyVariantId: `gid://shopify/ProductVariant/${variantId}`,
    specifications,
  };
}

const cpuSocketRule = rule({
  id: "cpu-board-socket",
  sourceCategory: "CPU",
  sourceField: "socket",
  operator: "EQUALS",
  targetCategory: "Motherboard",
  targetField: "socket",
  message: "CPU socket must match motherboard socket.",
});

const memoryRule = rule({
  id: "board-ram-memory",
  sourceCategory: "Motherboard",
  sourceField: "memoryType",
  operator: "EQUALS",
  targetCategory: "RAM",
  targetField: "memoryType",
});

const gpuCaseRule = rule({
  id: "gpu-case-length",
  sourceCategory: "GPU",
  sourceField: "lengthMm",
  operator: "LESS_THAN_OR_EQUAL",
  targetCategory: "Case",
  targetField: "maxGpuLengthMm",
});

const coolerCaseRule = rule({
  id: "cooler-case-height",
  sourceCategory: "Cooler",
  sourceField: "heightMm",
  operator: "LESS_THAN_OR_EQUAL",
  targetCategory: "Case",
  targetField: "maxCoolerHeightMm",
});

const cpuCoolerRule = rule({
  id: "cpu-cooler-socket",
  sourceCategory: "CPU",
  sourceField: "socket",
  operator: "IN",
  targetCategory: "Cooler",
  targetField: "supportedSockets",
});

describe("deterministic compatibility engine", () => {
  it("passes AM5 CPU with AM5 motherboard", () => {
    const result = evaluateBuild({
      rules: [cpuSocketRule],
      selections: [
        selection("CPU", { socket: "AM5" }),
        selection("Motherboard", { socket: "AM5" }),
      ],
    });

    expect(result.status).toBe("PASS");
    expect(result.compatible).toBe(true);
  });

  it("fails AM5 CPU with LGA1700 motherboard", () => {
    const result = evaluateBuild({
      rules: [cpuSocketRule],
      selections: [
        selection("CPU", { socket: "AM5" }),
        selection("Motherboard", { socket: "LGA1700" }),
      ],
    });

    expect(result.status).toBe("FAIL");
    expect(result.compatible).toBe(false);
    expect(result.violations[0]).toMatchObject({
      ruleId: "cpu-board-socket",
      sourceValue: "AM5",
      targetValue: "LGA1700",
      operator: "EQUALS",
    });
  });

  it("passes DDR5 motherboard with DDR5 RAM", () => {
    const result = evaluateBuild({
      rules: [memoryRule],
      selections: [
        selection("Motherboard", { memoryType: "DDR5" }),
        selection("RAM", { memoryType: "DDR5" }),
      ],
    });

    expect(result.status).toBe("PASS");
  });

  it("fails DDR5 motherboard with DDR4 RAM", () => {
    const result = evaluateBuild({
      rules: [memoryRule],
      selections: [
        selection("Motherboard", { memoryType: "DDR5" }),
        selection("RAM", { memoryType: "DDR4" }),
      ],
    });

    expect(getViolations(result)).toHaveLength(1);
  });

  it("passes 304mm GPU with 360mm case max GPU length", () => {
    const result = evaluateBuild({
      rules: [gpuCaseRule],
      selections: [
        selection("GPU", { lengthMm: 304 }),
        selection("Case", { maxGpuLengthMm: 360 }),
      ],
    });

    expect(result.status).toBe("PASS");
  });

  it("fails 380mm GPU with 360mm case max GPU length", () => {
    const result = evaluateBuild({
      rules: [gpuCaseRule],
      selections: [
        selection("GPU", { lengthMm: 380 }),
        selection("Case", { maxGpuLengthMm: 360 }),
      ],
    });

    expect(result.status).toBe("FAIL");
  });

  it("passes AM5 CPU when cooler supports AM4 and AM5", () => {
    const result = evaluateBuild({
      rules: [cpuCoolerRule],
      selections: [
        selection("CPU", { socket: "AM5" }),
        selection("Cooler", { supportedSockets: ["AM4", "AM5"] }),
      ],
    });

    expect(result.status).toBe("PASS");
  });

  it("fails AM5 CPU when cooler only supports LGA1700", () => {
    const result = evaluateBuild({
      rules: [cpuCoolerRule],
      selections: [
        selection("CPU", { socket: "AM5" }),
        selection("Cooler", { supportedSockets: ["LGA1700"] }),
      ],
    });

    expect(result.status).toBe("FAIL");
  });

  it("ignores disabled rules", () => {
    const result = evaluateBuild({
      rules: [{ ...cpuSocketRule, enabled: false }],
      selections: [
        selection("CPU", { socket: "AM5" }),
        selection("Motherboard", { socket: "LGA1700" }),
      ],
    });

    expect(result.status).toBe("PASS");
  });

  it("returns UNKNOWN for missing source specification", () => {
    const result = evaluateBuild({
      rules: [cpuSocketRule],
      selections: [
        selection("CPU", {}),
        selection("Motherboard", { socket: "AM5" }),
      ],
    });

    expect(result.status).toBe("UNKNOWN");
    expect(result.unknowns[0].reason).toContain("Missing CPU.socket");
  });

  it("returns UNKNOWN for missing target specification", () => {
    const result = evaluateBuild({
      rules: [cpuSocketRule],
      selections: [
        selection("CPU", { socket: "AM5" }),
        selection("Motherboard", {}),
      ],
    });

    expect(result.status).toBe("UNKNOWN");
    expect(result.unknowns[0].reason).toContain("Missing Motherboard.socket");
  });

  it("passes numeric boundary comparisons", () => {
    const result = evaluateBuild({
      rules: [gpuCaseRule],
      selections: [
        selection("GPU", { lengthMm: 360 }),
        selection("Case", { maxGpuLengthMm: 360 }),
      ],
    });

    expect(result.status).toBe("PASS");
  });

  it("handles malformed values as UNKNOWN", () => {
    const result = evaluateRule({
      rule: gpuCaseRule,
      source: selection("GPU", { lengthMm: "long" }),
      target: selection("Case", { maxGpuLengthMm: 360 }),
    });

    expect(result.status).toBe("UNKNOWN");
    expect(result.unknowns[0].reason).toContain("unexpected shape");
  });

  it("evaluates candidate against only relevant rules", () => {
    const result = evaluateCandidate({
      rules: [cpuSocketRule, memoryRule],
      selections: [
        selection("CPU", { socket: "AM5" }),
        selection("RAM", { memoryType: "DDR4" }),
      ],
      candidate: selection("Motherboard", { socket: "LGA1700", memoryType: "DDR4" }),
    });

    expect(result.status).toBe("FAIL");
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].ruleId).toBe("cpu-board-socket");
  });

  it("returns all failures across a full build", () => {
    const result = evaluateBuild({
      rules: [cpuSocketRule, memoryRule, gpuCaseRule, coolerCaseRule, cpuCoolerRule],
      selections: [
        selection("CPU", { socket: "AM5" }),
        selection("Motherboard", { socket: "LGA1700", memoryType: "DDR5" }),
        selection("RAM", { memoryType: "DDR4" }),
        selection("GPU", { lengthMm: 380 }),
        selection("Case", { maxGpuLengthMm: 360, maxCoolerHeightMm: 160 }),
        selection("Cooler", { heightMm: 170, supportedSockets: ["LGA1700"] }),
      ],
    });

    expect(result.status).toBe("FAIL");
    expect(result.violations.map((violation) => violation.ruleId)).toEqual([
      "cpu-board-socket",
      "board-ram-memory",
      "gpu-case-length",
      "cooler-case-height",
      "cpu-cooler-socket",
    ]);
  });

  it("does not evaluate rules from another shop or builder when caller scopes rules", () => {
    const scopedRules = [
      cpuSocketRule,
      {
        ...memoryRule,
        id: "other-shop-rule",
        shopId: "shop-b",
        builderId: "builder-b",
      },
    ].filter((candidateRule) => (
      candidateRule.shopId === "shop-a" && candidateRule.builderId === "builder-a"
    ));

    const result = evaluateBuild({
      rules: scopedRules,
      selections: [
        selection("CPU", { socket: "AM5" }),
        selection("Motherboard", { socket: "AM5", memoryType: "DDR5" }),
        selection("RAM", { memoryType: "DDR4" }),
      ],
    });

    expect(result.status).toBe("PASS");
  });

  it("returns only compatible variants from candidate options", () => {
    const candidates = [
      selection("Motherboard", { socket: "AM5" }, "board-good"),
      selection("Motherboard", { socket: "LGA1700" }, "board-bad"),
    ];

    const compatible = getCompatibleVariants(candidates, [cpuSocketRule], [
      selection("CPU", { socket: "AM5" }),
    ]);

    expect(compatible.map((candidate) => candidate.shopifyVariantId)).toEqual([
      "gid://shopify/ProductVariant/board-good",
    ]);
  });

  it("evaluates the requested PC Builder sample parts deterministically", () => {
    const ryzenTestA = selection("CPU", { socket: "AM5", tdp: 120 }, "ryzen-test-a");
    const intelTestB = selection("CPU", { socket: "LGA1700", tdp: 125 }, "intel-test-b");
    const boardA = selection("Motherboard", { socket: "AM5", memoryType: "DDR5" }, "board-a");
    const boardB = selection("Motherboard", { socket: "LGA1700", memoryType: "DDR5" }, "board-b");
    const ramA = selection("RAM", { memoryType: "DDR5" }, "ram-a");
    const ramB = selection("RAM", { memoryType: "DDR4" }, "ram-b");
    const gpuA = selection("GPU", { lengthMm: 304, tdp: 320 }, "gpu-a");
    const gpuB = selection("GPU", { lengthMm: 380, tdp: 450 }, "gpu-b");
    const caseA = selection(
      "Case",
      { maxGpuLengthMm: 360, maxCoolerHeightMm: 170 },
      "case-a"
    );
    const coolerA = selection(
      "Cooler",
      { supportedSockets: ["AM5", "AM4"], heightMm: 160 },
      "cooler-a"
    );
    const coolerB = selection(
      "Cooler",
      { supportedSockets: ["LGA1700"], heightMm: 160 },
      "cooler-b"
    );
    const rules = [cpuSocketRule, memoryRule, gpuCaseRule, coolerCaseRule, cpuCoolerRule];

    expect(evaluateBuild({
      rules,
      selections: [ryzenTestA, boardA, ramA, gpuA, caseA, coolerA],
    }).status).toBe("PASS");

    expect(evaluateBuild({
      rules,
      selections: [ryzenTestA, boardB, ramA, gpuA, caseA, coolerA],
    }).violations.map((violation) => violation.ruleId)).toEqual(["cpu-board-socket"]);

    expect(evaluateBuild({
      rules,
      selections: [intelTestB, boardB, ramA, gpuA, caseA, coolerB],
    }).status).toBe("PASS");

    expect(evaluateBuild({
      rules,
      selections: [ryzenTestA, boardA, ramB, gpuA, caseA, coolerA],
    }).violations.map((violation) => violation.ruleId)).toEqual(["board-ram-memory"]);

    expect(evaluateBuild({
      rules,
      selections: [ryzenTestA, boardA, ramA, gpuB, caseA, coolerA],
    }).violations.map((violation) => violation.ruleId)).toEqual(["gpu-case-length"]);

    expect(evaluateBuild({
      rules,
      selections: [ryzenTestA, boardA, ramA, gpuA, caseA, coolerB],
    }).violations.map((violation) => violation.ruleId)).toEqual(["cpu-cooler-socket"]);
  });

  it("requires PSU wattage to cover component TDP with 20% headroom", () => {
    const result = evaluateBuild({ rules: [], selections: [
      selection("CPU", { tdp: 120 }),
      selection("GPU", { tdp: 320 }),
      selection("PSU", { wattage: 500 }),
    ] });
    expect(result.compatible).toBe(false);
    expect(result.violations[0].ruleId).toBe("power-budget");
    expect(result.violations[0].message).toContain("528W");
  });

  it("accepts a PSU with sufficient headroom", () => {
    expect(evaluateBuild({ rules: [], selections: [
      selection("CPU", { tdp: 120 }),
      selection("GPU", { tdp: 320 }),
      selection("PSU", { wattage: 550 }),
    ] }).status).toBe("PASS");
  });
});
