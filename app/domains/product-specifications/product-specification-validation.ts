import type {
  SpecificationDataType,
  SpecificationDefinition,
  SpecificationValidationError,
} from "./types";

const SUPPORTED_DATA_TYPES: SpecificationDataType[] = [
  "STRING",
  "NUMBER",
  "BOOLEAN",
  "STRING_ARRAY",
];

export function validateSpecificationDefinitionInput(
  data: Pick<SpecificationDefinition, "category" | "key" | "label" | "dataType">
): SpecificationValidationError | null {
  if (!data.category.trim()) {
    return { field: "category", message: "Specification category is required." };
  }
  if (!data.key.trim()) {
    return { field: "key", message: "Specification key is required." };
  }
  if (!data.label.trim()) {
    return { field: "label", message: "Specification label is required." };
  }
  if (!SUPPORTED_DATA_TYPES.includes(data.dataType)) {
    return { field: "dataType", message: "Unsupported specification data type." };
  }
  return null;
}

export function parseSpecificationValue(
  definition: Pick<SpecificationDefinition, "key" | "label" | "dataType" | "required">,
  rawValue: string | undefined
): { value: unknown | null; error: SpecificationValidationError | null } {
  const value = rawValue?.trim() ?? "";

  if (value === "") {
    if (definition.required) {
      return {
        value: null,
        error: {
          field: definition.key,
          message: `${definition.label} is required.`,
        },
      };
    }
    return { value: null, error: null };
  }

  if (definition.dataType === "STRING") {
    return { value, error: null };
  }

  if (definition.dataType === "NUMBER") {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return {
        value: null,
        error: {
          field: definition.key,
          message: `${definition.label} must be a number.`,
        },
      };
    }
    return { value: parsed, error: null };
  }

  if (definition.dataType === "BOOLEAN") {
    const normalized = value.toLowerCase();
    if (["true", "yes", "1", "on"].includes(normalized)) {
      return { value: true, error: null };
    }
    if (["false", "no", "0", "off"].includes(normalized)) {
      return { value: false, error: null };
    }
    return {
      value: null,
      error: {
        field: definition.key,
        message: `${definition.label} must be true or false.`,
      },
    };
  }

  if (definition.dataType === "STRING_ARRAY") {
    const parsed = value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    if (parsed.length === 0 && definition.required) {
      return {
        value: null,
        error: {
          field: definition.key,
          message: `${definition.label} requires at least one value.`,
        },
      };
    }

    return { value: parsed, error: null };
  }

  return {
    value: null,
    error: { field: definition.key, message: "Unsupported specification data type." },
  };
}

export function formatSpecificationValue(value: unknown): string {
  if (Array.isArray(value)) {
    return value.join(", ");
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  if (typeof value === "number" || typeof value === "string") {
    return String(value);
  }
  return "";
}
