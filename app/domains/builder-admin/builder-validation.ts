import type {
  Builder,
  BuilderStep,
  BuilderValidationError,
  BuilderStatus,
  StepCatalogAssignment,
} from "./types";

const MAX_NAME_LENGTH = 120;

export function validateBuilderName(name: string): BuilderValidationError | null {
  if (!name || typeof name !== "string" || name.trim() === "") {
    return { field: "name", message: "Builder name is required." };
  }
  if (name.length > MAX_NAME_LENGTH) {
    return {
      field: "name",
      message: `Builder name must be ${MAX_NAME_LENGTH} characters or fewer.`,
    };
  }
  return null;
}

export function validateBuilderStatusTransition(
  currentStatus: BuilderStatus,
  nextStatus: BuilderStatus
): BuilderValidationError | null {
  const allowed: Record<BuilderStatus, BuilderStatus[]> = {
    draft: ["published", "archived"],
    published: ["archived"],
    archived: ["published"],
  };
  if (!allowed[currentStatus].includes(nextStatus)) {
    return {
      field: "status",
      message: `Cannot transition from ${currentStatus} to ${nextStatus}.`,
    };
  }
  return null;
}

export function validatePublishRequirements(
  builder: Pick<Builder, "name" | "status">,
  enabledStepCount: number
): BuilderValidationError | null {
  const nameError = validateBuilderName(builder.name);
  if (nameError) {
    return nameError;
  }
  if (enabledStepCount === 0) {
    return {
      field: "steps",
      message: "Builder must have at least one enabled step to publish.",
    };
  }
  return null;
}

export function validateStepName(name: string): BuilderValidationError | null {
  if (!name || typeof name !== "string" || name.trim() === "") {
    return { field: "name", message: "Step name is required." };
  }
  return null;
}

export function validateStepPosition(position: number): BuilderValidationError | null {
  if (!Number.isInteger(position) || position < 1) {
    return { field: "position", message: "Step position must be a positive integer." };
  }
  return null;
}

export function validateCatalogReferenceType(
  referenceType: unknown
): BuilderValidationError | null {
  if (referenceType !== "product" && referenceType !== "variant") {
    return {
      field: "referenceType",
      message: "Reference type must be either product or variant.",
    };
  }
  return null;
}

export function validateCatalogAssignmentInput(
  data: Partial<StepCatalogAssignment>
): BuilderValidationError | null {
  const typeError = validateCatalogReferenceType(data.referenceType);
  if (typeError) {
    return typeError;
  }

  if (data.referenceType === "product") {
    if (!data.shopifyProductId || typeof data.shopifyProductId !== "string") {
      return {
        field: "shopifyProductId",
        message: "Product assignments require a valid Shopify product ID.",
      };
    }
  }

  if (data.referenceType === "variant") {
    if (!data.shopifyVariantId || typeof data.shopifyVariantId !== "string") {
      return {
        field: "shopifyVariantId",
        message: "Variant assignments require a valid Shopify variant ID.",
      };
    }
  }

  return null;
}

export function validateBuilder(
  data: Partial<Builder> & { shopId: string }
): BuilderValidationError | null {
  if (!data.name) {
    return { field: "name", message: "Builder name is required." };
  }
  return validateBuilderName(data.name);
}

export function validateStep(
  data: Partial<BuilderStep> & { shopId: string; builderId: string }
): BuilderValidationError | null {
  if (!data.name) {
    return { field: "name", message: "Step name is required." };
  }
  if (!data.position || !Number.isInteger(data.position) || data.position < 1) {
    return { field: "position", message: "Step position must be a positive integer." };
  }
  return null;
}

export function normalizePositions(steps: BuilderStep[]): BuilderStep[] {
  return steps
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((step, index) => ({ ...step, position: index + 1 }));
}

export function isStaleSave(
  providedVersion: number | undefined,
  currentVersion: number
): boolean {
  return typeof providedVersion !== "number" || providedVersion < currentVersion;
}
