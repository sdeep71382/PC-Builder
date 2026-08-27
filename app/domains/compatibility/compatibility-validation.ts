import type {
  CompatibilityTagRole,
  CompatibilityValidationError,
} from "./types";

const MAX_TAG_NAME_LENGTH = 120;

const VALID_ROLES: CompatibilityTagRole[] = ["standard", "powerDraw", "outputWattage"];

export function validateTagName(name: string): CompatibilityValidationError | null {
  if (!name || typeof name !== "string" || name.trim() === "") {
    return { field: "name", message: "Tag name is required." };
  }
  if (name.length > MAX_TAG_NAME_LENGTH) {
    return {
      field: "name",
      message: `Tag name must be ${MAX_TAG_NAME_LENGTH} characters or fewer.`,
    };
  }
  return null;
}

export function validateTagRole(role: unknown): CompatibilityValidationError | null {
  if (typeof role !== "string" || !VALID_ROLES.includes(role as CompatibilityTagRole)) {
    return {
      field: "role",
      message: "Tag role must be one of standard, powerDraw, or outputWattage.",
    };
  }
  return null;
}

export function isNumericRole(role: CompatibilityTagRole): boolean {
  return role === "powerDraw" || role === "outputWattage";
}

export function validateTagValue(
  role: CompatibilityTagRole,
  value: string
): CompatibilityValidationError | null {
  if (!value || typeof value !== "string" || value.trim() === "") {
    return { field: "value", message: "Tag value is required." };
  }
  if (isNumericRole(role)) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return {
        field: "value",
        message: "This tag requires a non-negative number.",
      };
    }
  }
  return null;
}

export function validateHeadroomPercentage(
  headroomPercentage: number
): CompatibilityValidationError | null {
  if (!Number.isInteger(headroomPercentage) || headroomPercentage < 0) {
    return {
      field: "headroomPercentage",
      message: "Headroom percentage must be a non-negative integer.",
    };
  }
  return null;
}

export function validateBuildRetentionDays(
  buildRetentionDays: number
): CompatibilityValidationError | null {
  if (!Number.isInteger(buildRetentionDays) || buildRetentionDays < 1) {
    return {
      field: "buildRetentionDays",
      message: "Build retention days must be a positive integer.",
    };
  }
  return null;
}
