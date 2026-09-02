import type {
  CompatibilityEvaluationResult,
  CompatibilityRule,
  CompatibilitySelection,
  CompatibilityUnknown,
  CompatibilityViolation,
} from "./types";

interface EvaluationInput {
  rules: CompatibilityRule[];
  selections: CompatibilitySelection[];
}

interface CandidateEvaluationInput extends EvaluationInput {
  candidate: CompatibilitySelection;
}

interface RuleEvaluationInput {
  rule: CompatibilityRule;
  source?: CompatibilitySelection;
  target?: CompatibilitySelection;
}

const PASS_RESULT: CompatibilityEvaluationResult = {
  status: "PASS",
  compatible: true,
  violations: [],
  unknowns: [],
};

export function evaluateBuild(input: EvaluationInput): CompatibilityEvaluationResult {
  return evaluateSelections(input.rules, input.selections);
}

export function evaluateCandidate(input: CandidateEvaluationInput): CompatibilityEvaluationResult {
  return evaluateSelections(input.rules, [...input.selections, input.candidate], {
    candidateCategory: input.candidate.category,
  });
}

export function getViolations(result: CompatibilityEvaluationResult): CompatibilityViolation[] {
  return result.violations;
}

export function getCompatibleVariants<T extends CompatibilitySelection>(
  candidates: T[],
  rules: CompatibilityRule[],
  selections: CompatibilitySelection[]
): T[] {
  return candidates.filter((candidate) =>
    evaluateCandidate({ rules, selections, candidate }).compatible
  );
}

export function evaluateRule(input: RuleEvaluationInput): CompatibilityEvaluationResult {
  const { rule, source, target } = input;

  if (!rule.enabled) {
    return PASS_RESULT;
  }

  if (!source || !target) {
    return unknownResult(rule, "Both selections required by this rule are not present.");
  }

  const sourceValue = source.specifications[rule.sourceField];
  const targetValue = target.specifications[rule.targetField];

  if (isMissingValue(sourceValue)) {
    return unknownResult(rule, `Missing ${rule.sourceCategory}.${rule.sourceField}.`);
  }
  if (isMissingValue(targetValue)) {
    return unknownResult(rule, `Missing ${rule.targetCategory}.${rule.targetField}.`);
  }

  const compatible = compareValues(rule, sourceValue, targetValue);
  if (compatible === null) {
    return unknownResult(rule, "Specification value has an unexpected shape.");
  }

  if (compatible) {
    return PASS_RESULT;
  }

  return {
    status: "FAIL",
    compatible: false,
    violations: [violationFor(rule, sourceValue, targetValue)],
    unknowns: [],
  };
}

function evaluateSelections(
  rules: CompatibilityRule[],
  selections: CompatibilitySelection[],
  options: { candidateCategory?: string } = {}
): CompatibilityEvaluationResult {
  const selectionByCategory = new Map(
    selections.map((selection) => [normalizeCategory(selection.category), selection])
  );
  const violations: CompatibilityViolation[] = [];
  const unknowns: CompatibilityUnknown[] = [];

  for (const rule of rules) {
    if (!rule.enabled) continue;
    if (options.candidateCategory && !ruleTouchesCategory(rule, options.candidateCategory)) {
      continue;
    }

    const result = evaluateRule({
      rule,
      source: selectionByCategory.get(normalizeCategory(rule.sourceCategory)),
      target: selectionByCategory.get(normalizeCategory(rule.targetCategory)),
    });
    violations.push(...result.violations);
    unknowns.push(...result.unknowns);
  }

  const powerViolation = evaluatePowerBudget(selections);
  if (powerViolation) violations.push(powerViolation);

  return resultFrom(violations, unknowns);
}

function evaluatePowerBudget(selections: CompatibilitySelection[]): CompatibilityViolation | undefined {
  const psu = selections.find((selection) => normalizeCategory(selection.category) === "psu");
  if (!psu || typeof psu.specifications.wattage !== "number") return undefined;
  const powerDraw = selections
    .filter((selection) => normalizeCategory(selection.category) !== "psu")
    .reduce((sum, selection) => sum + (typeof selection.specifications.tdp === "number" ? selection.specifications.tdp : 0), 0);
  const required = Math.ceil(powerDraw * 1.2);
  if (powerDraw <= 0 || psu.specifications.wattage >= required) return undefined;
  return {
    ruleId: "power-budget",
    sourceCategory: "Build",
    sourceField: "powerDraw",
    sourceValue: powerDraw,
    targetCategory: "PSU",
    targetField: "wattage",
    targetValue: psu.specifications.wattage,
    operator: "GREATER_THAN_OR_EQUAL",
    severity: "error",
    message: `The selected components require at least ${required}W of PSU capacity, but this power supply provides ${psu.specifications.wattage}W.`,
  };
}

function compareValues(
  rule: CompatibilityRule,
  sourceValue: unknown,
  targetValue: unknown
): boolean | null {
  if (rule.operator === "EQUALS") {
    if (!isComparableScalar(sourceValue) || !isComparableScalar(targetValue)) {
      return null;
    }
    return sourceValue === targetValue;
  }

  if (rule.operator === "IN") {
    if (typeof sourceValue !== "string" || !isStringArray(targetValue)) {
      return null;
    }
    return targetValue.includes(sourceValue);
  }

  if (rule.operator === "GREATER_THAN_OR_EQUAL") {
    if (typeof sourceValue !== "number" || typeof targetValue !== "number") {
      return null;
    }
    return sourceValue >= targetValue;
  }

  if (rule.operator === "LESS_THAN_OR_EQUAL") {
    if (typeof sourceValue !== "number" || typeof targetValue !== "number") {
      return null;
    }
    return sourceValue <= targetValue;
  }

  return null;
}

function resultFrom(
  violations: CompatibilityViolation[],
  unknowns: CompatibilityUnknown[]
): CompatibilityEvaluationResult {
  if (violations.length > 0) {
    return { status: "FAIL", compatible: false, violations, unknowns };
  }
  if (unknowns.length > 0) {
    return { status: "UNKNOWN", compatible: false, violations, unknowns };
  }
  return PASS_RESULT;
}

function ruleTouchesCategory(rule: CompatibilityRule, category: string): boolean {
  const normalized = normalizeCategory(category);
  return normalizeCategory(rule.sourceCategory) === normalized || normalizeCategory(rule.targetCategory) === normalized;
}

function normalizeCategory(category: string): string {
  const value = category.trim().toLowerCase().replace(/[\s_-]/g, "");
  return ({ processor: "cpu", processors: "cpu", cpu: "cpu", memory: "ram", ram: "ram", graphicscard: "gpu", graphicscards: "gpu", gpu: "gpu", powersupply: "psu", power: "psu", psu: "psu", cooling: "cooler", cooler: "cooler" } as Record<string, string>)[value] ?? value;
}

function isMissingValue(value: unknown): boolean {
  return value === undefined || value === null || value === "";
}

function isComparableScalar(value: unknown): value is string | number | boolean {
  return ["string", "number", "boolean"].includes(typeof value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function violationFor(
  rule: CompatibilityRule,
  sourceValue: unknown,
  targetValue: unknown
): CompatibilityViolation {
  return {
    ruleId: rule.id,
    sourceCategory: rule.sourceCategory,
    sourceField: rule.sourceField,
    sourceValue,
    targetCategory: rule.targetCategory,
    targetField: rule.targetField,
    targetValue,
    operator: rule.operator,
    severity: rule.severity,
    message: rule.message.trim() || fallbackMessage(rule, sourceValue, targetValue),
  };
}

function unknownResult(
  rule: CompatibilityRule,
  reason: string
): CompatibilityEvaluationResult {
  return {
    status: "UNKNOWN",
    compatible: false,
    violations: [],
    unknowns: [
      {
        ruleId: rule.id,
        sourceCategory: rule.sourceCategory,
        sourceField: rule.sourceField,
        targetCategory: rule.targetCategory,
        targetField: rule.targetField,
        operator: rule.operator,
        reason,
        message: rule.message.trim() || `Compatibility could not be confirmed: ${reason}`,
      },
    ],
  };
}

function fallbackMessage(
  rule: CompatibilityRule,
  sourceValue: unknown,
  targetValue: unknown
): string {
  return `${rule.sourceCategory} ${rule.sourceField} (${formatValue(
    sourceValue
  )}) is not compatible with ${rule.targetCategory} ${rule.targetField} (${formatValue(
    targetValue
  )}).`;
}

function formatValue(value: unknown): string {
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return "unknown";
}
