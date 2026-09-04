import { Prisma, PrismaClient } from "@prisma/client";
import type {
  CompatibilityRule,
  CompatibilityRuleOperator,
  CompatibilityRuleSeverity,
} from "./types";
import {
  validateOperatorForDataTypes,
  validateRuleMessage,
  validateRuleOperator,
  validateRuleSeverity,
} from "./compatibility-rule-validation";
import type { SpecificationDataType } from "../product-specifications/types";

const prisma = new PrismaClient();


export interface CompatibilityRuleInput {
  sourceCategory: string;
  sourceField: string;
  operator: CompatibilityRuleOperator;
  targetCategory: string;
  targetField: string;
  comparisonValue?: unknown;
  severity: CompatibilityRuleSeverity;
  enabled: boolean;
  message: string;
}

export async function listCompatibilityRules(
  shopId: string,
  builderId: string
): Promise<CompatibilityRule[]> {
  await assertBuilderForShop(shopId, builderId);
  const rules = await prisma.compatibilityRule.findMany({
    where: { shopId, builderId },
    orderBy: { createdAt: "asc" },
  });
  return rules.map(toRule);
}

export async function getCompatibilityRule(
  shopId: string,
  builderId: string,
  ruleId: string
): Promise<CompatibilityRule | null> {
  await assertBuilderForShop(shopId, builderId);
  const rule = await prisma.compatibilityRule.findFirst({
    where: { id: ruleId, shopId, builderId },
  });
  return rule ? toRule(rule) : null;
}

export async function createCompatibilityRule(
  shopId: string,
  builderId: string,
  input: CompatibilityRuleInput
): Promise<CompatibilityRule> {
  await validateRuleInput(shopId, builderId, input);
  const rule = await prisma.compatibilityRule.create({
    data: {
      shopId,
      builderId,
      sourceCategory: input.sourceCategory.trim(),
      sourceField: input.sourceField.trim(),
      operator: input.operator,
      targetCategory: input.targetCategory.trim(),
      targetField: input.targetField.trim(),
      comparisonValue: toNullableJson(input.comparisonValue),
      severity: input.severity,
      enabled: input.enabled,
      message: input.message.trim(),
    },
  });
  return toRule(rule);
}

export async function updateCompatibilityRule(
  shopId: string,
  builderId: string,
  ruleId: string,
  input: CompatibilityRuleInput
): Promise<CompatibilityRule> {
  await assertRuleForShop(shopId, builderId, ruleId);
  await validateRuleInput(shopId, builderId, input);
  const rule = await prisma.compatibilityRule.update({
    where: { id: ruleId },
    data: {
      sourceCategory: input.sourceCategory.trim(),
      sourceField: input.sourceField.trim(),
      operator: input.operator,
      targetCategory: input.targetCategory.trim(),
      targetField: input.targetField.trim(),
      comparisonValue: toNullableJson(input.comparisonValue),
      severity: input.severity,
      enabled: input.enabled,
      message: input.message.trim(),
    },
  });
  return toRule(rule);
}

export async function setCompatibilityRuleEnabled(
  shopId: string,
  builderId: string,
  ruleId: string,
  enabled: boolean
): Promise<CompatibilityRule> {
  await assertRuleForShop(shopId, builderId, ruleId);
  const rule = await prisma.compatibilityRule.update({
    where: { id: ruleId },
    data: { enabled },
  });
  return toRule(rule);
}

export async function deleteCompatibilityRule(
  shopId: string,
  builderId: string,
  ruleId: string
): Promise<void> {
  await assertRuleForShop(shopId, builderId, ruleId);
  await prisma.compatibilityRule.delete({ where: { id: ruleId } });
}

export async function ensureDefaultPcCompatibilityRules(
  shopId: string,
  builderId: string
): Promise<void> {
  await assertBuilderForShop(shopId, builderId);
  const defaults: CompatibilityRuleInput[] = [
    {
      sourceCategory: "CPU",
      sourceField: "socket",
      operator: "EQUALS",
      targetCategory: "Motherboard",
      targetField: "socket",
      severity: "error",
      enabled: true,
      message: "CPU socket must match the motherboard socket.",
    },
    {
      sourceCategory: "Motherboard",
      sourceField: "memoryType",
      operator: "EQUALS",
      targetCategory: "RAM",
      targetField: "memoryType",
      severity: "error",
      enabled: true,
      message: "Motherboard memory type must match the selected memory.",
    },
    {
      sourceCategory: "GPU",
      sourceField: "lengthMm",
      operator: "LESS_THAN_OR_EQUAL",
      targetCategory: "Case",
      targetField: "maxGpuLengthMm",
      severity: "error",
      enabled: true,
      message: "Graphics card length must fit inside the case.",
    },
    {
      sourceCategory: "Cooler",
      sourceField: "heightMm",
      operator: "LESS_THAN_OR_EQUAL",
      targetCategory: "Case",
      targetField: "maxCoolerHeightMm",
      severity: "error",
      enabled: true,
      message: "CPU cooler height must fit inside the case.",
    },
    {
      sourceCategory: "CPU",
      sourceField: "socket",
      operator: "IN",
      targetCategory: "Cooler",
      targetField: "supportedSockets",
      severity: "error",
      enabled: true,
      message: "CPU socket must be supported by the cooler.",
    },
    {
      sourceCategory: "GPU",
      sourceField: "recommendedPsuW",
      operator: "LESS_THAN_OR_EQUAL",
      targetCategory: "PSU",
      targetField: "wattage",
      severity: "error",
      enabled: true,
      message: "Power supply wattage must meet the graphics card recommendation.",
    },
  ];

  for (const rule of defaults) {
    const existing = await prisma.compatibilityRule.findFirst({
      where: {
        shopId,
        builderId,
        sourceCategory: rule.sourceCategory,
        sourceField: rule.sourceField,
        operator: rule.operator,
        targetCategory: rule.targetCategory,
        targetField: rule.targetField,
      },
    });
    if (!existing) {
      await createCompatibilityRule(shopId, builderId, rule);
    }
  }
}

export async function listRuleFieldOptions(shopId: string): Promise<
  Record<string, Array<{ key: string; label: string; dataType: SpecificationDataType }>>
> {
  const definitions = await prisma.specificationDefinition.findMany({
    where: { shopId },
    orderBy: [{ category: "asc" }, { key: "asc" }],
  });
  const options: Record<string, Array<{ key: string; label: string; dataType: SpecificationDataType }>> = {};
  for (const definition of definitions) {
    options[definition.category] ??= [];
    options[definition.category].push({
      key: definition.key,
      label: definition.label,
      dataType: definition.dataType as SpecificationDataType,
    });
  }
  return options;
}

async function validateRuleInput(
  shopId: string,
  builderId: string,
  input: CompatibilityRuleInput
): Promise<void> {
  await assertBuilderForShop(shopId, builderId);

  const operatorError = validateRuleOperator(input.operator);
  if (operatorError) throw new Error(operatorError.message);
  const severityError = validateRuleSeverity(input.severity);
  if (severityError) throw new Error(severityError.message);
  const messageError = validateRuleMessage(input.message);
  if (messageError) throw new Error(messageError.message);

  const [sourceDefinition, targetDefinition] = await Promise.all([
    prisma.specificationDefinition.findFirst({
      where: {
        shopId,
        category: input.sourceCategory.trim(),
        key: input.sourceField.trim(),
      },
    }),
    prisma.specificationDefinition.findFirst({
      where: {
        shopId,
        category: input.targetCategory.trim(),
        key: input.targetField.trim(),
      },
    }),
  ]);

  if (!sourceDefinition) {
    throw new Error("Source specification field is not available for this shop.");
  }
  if (!targetDefinition) {
    throw new Error("Target specification field is not available for this shop.");
  }

  const typeError = validateOperatorForDataTypes(
    input.operator,
    sourceDefinition.dataType as SpecificationDataType,
    targetDefinition.dataType as SpecificationDataType
  );
  if (typeError) {
    throw new Error(typeError.message);
  }
}

async function assertBuilderForShop(shopId: string, builderId: string): Promise<void> {
  const builder = await prisma.builder.findFirst({
    where: { id: builderId, shopId },
  });
  if (!builder) {
    throw new Error("Builder not found.");
  }
}

async function assertRuleForShop(
  shopId: string,
  builderId: string,
  ruleId: string
): Promise<void> {
  const rule = await prisma.compatibilityRule.findFirst({
    where: { id: ruleId, shopId, builderId },
  });
  if (!rule) {
    throw new Error("Compatibility rule not found.");
  }
}

function toRule(rule: {
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
}): CompatibilityRule {
  return {
    ...rule,
    operator: rule.operator as CompatibilityRule["operator"],
    severity: rule.severity as CompatibilityRule["severity"],
  };
}

function toNullableJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
