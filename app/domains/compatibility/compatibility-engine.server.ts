import { PrismaClient } from "@prisma/client";
import { evaluateBuild } from "./compatibility-engine";
import type {
  CompatibilityEvaluationResult,
  CompatibilityRule,
  CompatibilitySelection,
} from "./types";

const prisma = new PrismaClient();


export async function evaluateBuildForVariantSelections(
  shopId: string,
  builderId: string,
  selections: Array<{
    category: string;
    shopifyProductId: string;
    shopifyVariantId: string;
  }>
): Promise<CompatibilityEvaluationResult> {
  const builder = await prisma.builder.findFirst({
    where: { id: builderId, shopId },
    select: { id: true },
  });
  if (!builder) {
    throw new Error("Builder not found.");
  }

  const [rules, specifications] = await Promise.all([
    prisma.compatibilityRule.findMany({
      where: { shopId, builderId, enabled: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.productSpecification.findMany({
      where: {
        shopId,
        shopifyVariantId: { in: selections.map((selection) => selection.shopifyVariantId) },
      },
      include: { specificationDefinition: true },
    }),
  ]);

  const specsByVariant = new Map<string, Record<string, unknown>>();
  for (const specification of specifications) {
    const values = specsByVariant.get(specification.shopifyVariantId) ?? {};
    values[specification.specificationDefinition.key] = specification.value;
    specsByVariant.set(specification.shopifyVariantId, values);
  }

  const normalizedSelections: CompatibilitySelection[] = selections.map((selection) => ({
    ...selection,
    specifications: specsByVariant.get(selection.shopifyVariantId) ?? {},
  }));

  return evaluateBuild({
    rules: rules.map(toRule),
    selections: normalizedSelections,
  });
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
