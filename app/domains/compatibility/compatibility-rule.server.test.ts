import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrismaClient, resetRules } = vi.hoisted(() => {
  let ruleIdCounter = 1;
  const builders = {
    "builder-a": { id: "builder-a", shopId: "shop-a" },
    "builder-b": { id: "builder-b", shopId: "shop-b" },
  };
  const definitions = [
    { id: "cpu-socket", shopId: "shop-a", category: "CPU", key: "socket", label: "Socket", dataType: "STRING" },
    { id: "board-socket", shopId: "shop-a", category: "Motherboard", key: "socket", label: "Socket", dataType: "STRING" },
    { id: "board-memory", shopId: "shop-a", category: "Motherboard", key: "memoryType", label: "Memory type", dataType: "STRING" },
    { id: "ram-memory", shopId: "shop-a", category: "RAM", key: "memoryType", label: "Memory type", dataType: "STRING" },
    { id: "gpu-length", shopId: "shop-a", category: "GPU", key: "lengthMm", label: "Length", dataType: "NUMBER" },
    { id: "gpu-psu", shopId: "shop-a", category: "GPU", key: "recommendedPsuW", label: "Recommended PSU", dataType: "NUMBER" },
    { id: "psu-wattage", shopId: "shop-a", category: "PSU", key: "wattage", label: "Wattage", dataType: "NUMBER" },
    { id: "case-gpu", shopId: "shop-a", category: "Case", key: "maxGpuLengthMm", label: "Max GPU length", dataType: "NUMBER" },
    { id: "cooler-height", shopId: "shop-a", category: "Cooler", key: "heightMm", label: "Height", dataType: "NUMBER" },
    { id: "case-cooler", shopId: "shop-a", category: "Case", key: "maxCoolerHeightMm", label: "Max cooler height", dataType: "NUMBER" },
    { id: "cooler-sockets", shopId: "shop-a", category: "Cooler", key: "supportedSockets", label: "Supported sockets", dataType: "STRING_ARRAY" },
  ];
  let rules: Record<string, {
    id: string;
    shopId: string;
    builderId: string;
    sourceCategory: string;
    sourceField: string;
    operator: string;
    targetCategory: string;
    targetField: string;
    comparisonValue: unknown;
    severity: string;
    enabled: boolean;
    message: string;
    createdAt: Date;
    updatedAt: Date;
  }> = {};

  const prisma = {
    builder: {
      findFirst: vi.fn(({ where }) => {
        return Object.values(builders).find(
          (builder) => builder.id === where.id && builder.shopId === where.shopId
        ) ?? null;
      }),
    },
    specificationDefinition: {
      findFirst: vi.fn(({ where }) => {
        return definitions.find(
          (definition) =>
            definition.shopId === where.shopId &&
            definition.category === where.category &&
            definition.key === where.key
        ) ?? null;
      }),
      findMany: vi.fn(({ where }) => {
        return definitions.filter((definition) => definition.shopId === where.shopId);
      }),
    },
    compatibilityRule: {
      findMany: vi.fn(({ where }) => {
        return Object.values(rules).filter(
          (rule) => rule.shopId === where.shopId && rule.builderId === where.builderId
        );
      }),
      findFirst: vi.fn(({ where }) => {
        return Object.values(rules).find(
          (rule) =>
            rule.shopId === where.shopId &&
            rule.builderId === where.builderId &&
            (where.id === undefined || rule.id === where.id) &&
            (where.sourceCategory === undefined || rule.sourceCategory === where.sourceCategory) &&
            (where.sourceField === undefined || rule.sourceField === where.sourceField) &&
            (where.operator === undefined || rule.operator === where.operator) &&
            (where.targetCategory === undefined || rule.targetCategory === where.targetCategory) &&
            (where.targetField === undefined || rule.targetField === where.targetField)
        ) ?? null;
      }),
      count: vi.fn(({ where }) => {
        return Object.values(rules).filter(
          (rule) => rule.shopId === where.shopId && rule.builderId === where.builderId
        ).length;
      }),
      create: vi.fn(({ data }) => {
        const id = `rule-${ruleIdCounter++}`;
        rules[id] = {
          id,
          shopId: data.shopId,
          builderId: data.builderId,
          sourceCategory: data.sourceCategory,
          sourceField: data.sourceField,
          operator: data.operator,
          targetCategory: data.targetCategory,
          targetField: data.targetField,
          comparisonValue: data.comparisonValue ?? null,
          severity: data.severity,
          enabled: data.enabled,
          message: data.message,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        return rules[id];
      }),
      update: vi.fn(({ where, data }) => {
        rules[where.id] = { ...rules[where.id], ...data, updatedAt: new Date() };
        return rules[where.id];
      }),
      delete: vi.fn(({ where }) => {
        const existing = rules[where.id];
        delete rules[where.id];
        return existing;
      }),
    },
  };

  const MockPrismaClient = function () {
    return prisma;
  };

  function resetRules() {
    ruleIdCounter = 1;
    rules = {};
  }

  return { mockPrismaClient: MockPrismaClient, resetRules };
});

vi.mock("@prisma/client", () => ({
  PrismaClient: mockPrismaClient,
  Prisma: {},
}));

import {
  createCompatibilityRule,
  deleteCompatibilityRule,
  ensureDefaultPcCompatibilityRules,
  listCompatibilityRules,
  setCompatibilityRuleEnabled,
} from "./compatibility-rule.server";

describe("compatibility rule service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetRules();
  });

  it("creates a deterministic rule for valid specification fields", async () => {
    const rule = await createCompatibilityRule("shop-a", "builder-a", {
      sourceCategory: "CPU",
      sourceField: "socket",
      operator: "EQUALS",
      targetCategory: "Motherboard",
      targetField: "socket",
      severity: "error",
      enabled: true,
      message: "Socket must match.",
    });

    expect(rule.sourceField).toBe("socket");
    expect(rule.operator).toBe("EQUALS");
  });

  it("rejects unknown fields", async () => {
    await expect(
      createCompatibilityRule("shop-a", "builder-a", {
        sourceCategory: "CPU",
        sourceField: "missing",
        operator: "EQUALS",
        targetCategory: "Motherboard",
        targetField: "socket",
        severity: "error",
        enabled: true,
        message: "Invalid.",
      })
    ).rejects.toThrow("Source specification field");
  });

  it("enforces builder shop scoping", async () => {
    await expect(
      createCompatibilityRule("shop-a", "builder-b", {
        sourceCategory: "CPU",
        sourceField: "socket",
        operator: "EQUALS",
        targetCategory: "Motherboard",
        targetField: "socket",
        severity: "error",
        enabled: true,
        message: "Socket must match.",
      })
    ).rejects.toThrow("Builder not found");
  });

  it("creates default PC rules once", async () => {
    await ensureDefaultPcCompatibilityRules("shop-a", "builder-a");
    await ensureDefaultPcCompatibilityRules("shop-a", "builder-a");

    const rules = await listCompatibilityRules("shop-a", "builder-a");
    expect(rules).toHaveLength(6);
    expect(rules.some((rule) => rule.operator === "IN")).toBe(true);
    expect(rules.some((rule) => rule.sourceField === "recommendedPsuW")).toBe(true);
  });

  it("enables, disables, and deletes rules with shop scope", async () => {
    const rule = await createCompatibilityRule("shop-a", "builder-a", {
      sourceCategory: "CPU",
      sourceField: "socket",
      operator: "EQUALS",
      targetCategory: "Motherboard",
      targetField: "socket",
      severity: "error",
      enabled: true,
      message: "Socket must match.",
    });

    const disabled = await setCompatibilityRuleEnabled("shop-a", "builder-a", rule.id, false);
    expect(disabled.enabled).toBe(false);

    await expect(
      setCompatibilityRuleEnabled("shop-b", "builder-a", rule.id, true)
    ).rejects.toThrow("Compatibility rule not found");

    await deleteCompatibilityRule("shop-a", "builder-a", rule.id);
    expect(await listCompatibilityRules("shop-a", "builder-a")).toHaveLength(0);
  });
});
