export interface CompatibilityValidationError {
  field: string;
  message: string;
}

export type CompatibilityRuleOperator =
  | "EQUALS"
  | "IN"
  | "GREATER_THAN_OR_EQUAL"
  | "LESS_THAN_OR_EQUAL";

export type CompatibilityRuleSeverity = "error" | "warning";

export interface CompatibilityRule {
  id: string;
  shopId: string;
  builderId: string;
  sourceCategory: string;
  sourceField: string;
  operator: CompatibilityRuleOperator;
  targetCategory: string;
  targetField: string;
  comparisonValue: unknown;
  severity: CompatibilityRuleSeverity;
  enabled: boolean;
  message: string;
  createdAt: Date;
  updatedAt: Date;
}

export type CompatibilityEvaluationStatus = "PASS" | "FAIL" | "UNKNOWN";

export interface CompatibilitySelection {
  category: string;
  shopifyProductId: string;
  shopifyVariantId: string;
  specifications: Record<string, unknown>;
}

export interface CompatibilityViolation {
  ruleId: string;
  sourceCategory: string;
  sourceField: string;
  sourceValue: unknown;
  targetCategory: string;
  targetField: string;
  targetValue: unknown;
  operator: CompatibilityRuleOperator;
  severity: CompatibilityRuleSeverity;
  message: string;
}

export interface CompatibilityUnknown {
  ruleId: string;
  sourceCategory: string;
  sourceField: string;
  targetCategory: string;
  targetField: string;
  operator: CompatibilityRuleOperator;
  reason: string;
  message: string;
}

export interface CompatibilityEvaluationResult {
  status: CompatibilityEvaluationStatus;
  compatible: boolean;
  violations: CompatibilityViolation[];
  unknowns: CompatibilityUnknown[];
}
