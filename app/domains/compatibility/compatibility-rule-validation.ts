import type {
  CompatibilityRuleOperator,
  CompatibilityRuleSeverity,
  CompatibilityValidationError,
} from "./types";
import type { SpecificationDataType } from "../product-specifications/types";

export const COMPATIBILITY_RULE_OPERATORS: CompatibilityRuleOperator[] = [
  "EQUALS",
  "IN",
  "GREATER_THAN_OR_EQUAL",
  "LESS_THAN_OR_EQUAL",
];

export const COMPATIBILITY_RULE_SEVERITIES: CompatibilityRuleSeverity[] = [
  "error",
  "warning",
];

const MAX_MESSAGE_LENGTH = 240;

export function validateRuleOperator(operator: unknown): CompatibilityValidationError | null {
  if (
    typeof operator !== "string" ||
    !COMPATIBILITY_RULE_OPERATORS.includes(operator as CompatibilityRuleOperator)
  ) {
    return { field: "operator", message: "Choose a supported compatibility operator." };
  }
  return null;
}

export function validateRuleSeverity(severity: unknown): CompatibilityValidationError | null {
  if (
    typeof severity !== "string" ||
    !COMPATIBILITY_RULE_SEVERITIES.includes(severity as CompatibilityRuleSeverity)
  ) {
    return { field: "severity", message: "Choose a supported rule severity." };
  }
  return null;
}

export function validateRuleMessage(message: string): CompatibilityValidationError | null {
  if (!message.trim()) {
    return { field: "message", message: "Compatibility message is required." };
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    return {
      field: "message",
      message: `Compatibility message must be ${MAX_MESSAGE_LENGTH} characters or fewer.`,
    };
  }
  return null;
}

export function validateOperatorForDataTypes(
  operator: CompatibilityRuleOperator,
  sourceDataType: SpecificationDataType,
  targetDataType: SpecificationDataType
): CompatibilityValidationError | null {
  if (operator === "IN") {
    if (targetDataType !== "STRING_ARRAY") {
      return { field: "operator", message: "IN rules require a target array field." };
    }
    if (sourceDataType !== "STRING") {
      return { field: "operator", message: "IN rules currently require a source string field." };
    }
    return null;
  }

  if (operator === "GREATER_THAN_OR_EQUAL" || operator === "LESS_THAN_OR_EQUAL") {
    if (sourceDataType !== "NUMBER" || targetDataType !== "NUMBER") {
      return { field: "operator", message: "Comparison rules require number fields." };
    }
    return null;
  }

  if (sourceDataType !== targetDataType) {
    return { field: "operator", message: "EQUALS rules require matching data types." };
  }

  return null;
}
