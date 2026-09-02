export interface StorefrontBuilderDto {
  builder: {
    publicId: string;
    name: string;
    description: string | null;
    steps: StorefrontBuilderStepDto[];
    compatibilityRules: StorefrontCompatibilityRuleDto[];
  };
}

export interface StorefrontBuilderStepDto {
  publicId: string;
  key: string;
  name: string;
  position: number;
  required: boolean;
  products: StorefrontProductOptionDto[];
  state: "ready" | "no_collection" | "collection_unavailable" | "no_products";
}

export interface StorefrontCompatibilityRuleDto {
  id: string;
  sourceCategory: string;
  sourceField: string;
  operator: "EQUALS" | "IN" | "GREATER_THAN_OR_EQUAL" | "LESS_THAN_OR_EQUAL";
  targetCategory: string;
  targetField: string;
  severity: "error" | "warning";
  message: string;
}

export interface StorefrontProductOptionDto {
  productId: string;
  variantId: string;
  productTitle: string;
  variantTitle: string | null;
  vendor: string | null;
  sku: string | null;
  image: {
    url: string;
    altText: string | null;
  } | null;
  price: {
    amount: string;
    currencyCode: string;
  };
  available: boolean;
  specifications: Record<string, unknown>;
}

export type StorefrontBuilderResult =
  | { type: "success"; data: StorefrontBuilderDto }
  | { type: "unavailable" };

export interface StorefrontBuildSelection {
  productId: string;
  variantId: string;
  price: {
    amount: string;
    currencyCode: string;
  };
  specs: Record<string, unknown>;
}

export interface StorefrontBuildState {
  builderId: string;
  sessionId: string;
  currentStep: number;
  selections: Record<string, StorefrontBuildSelection>;
  skippedStepIds: string[];
}

export interface StorefrontValidationError {
  type: "MISSING_REQUIRED_STEP" | "INVALID_VARIANT" | "OUT_OF_STOCK" | "NOT_IN_STEP_CATALOG" | "INCOMPATIBLE" | "UNKNOWN";
  stepKey?: string;
  variantId?: string;
  message: string;
}

export interface StorefrontValidationResult {
  valid: boolean;
  sessionId: string;
  errors: StorefrontValidationError[];
  selections: Array<{ stepKey: string; stepId: string; productId: string; variantId: string; price: StorefrontProductOptionDto["price"] }>;
}
