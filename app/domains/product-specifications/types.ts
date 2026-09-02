export type SpecificationDataType =
  | "STRING"
  | "NUMBER"
  | "BOOLEAN"
  | "STRING_ARRAY";

export type SpecificationSource = "manual" | "import" | "ai_suggestion";

export interface SpecificationDefinition {
  id: string;
  shopId: string;
  category: string;
  key: string;
  label: string;
  dataType: SpecificationDataType;
  unit: string | null;
  required: boolean;
  config: unknown;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductSpecification {
  id: string;
  shopId: string;
  shopifyProductId: string;
  shopifyVariantId: string;
  specificationDefinitionId: string;
  value: unknown;
  source: SpecificationSource;
  verified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ShopifyCollectionProduct {
  id: string;
  title: string;
  handle: string;
  featuredImage: {
    url: string;
    altText: string | null;
  } | null;
  variants: ShopifyProductVariant[];
}

export interface ShopifyProductVariant {
  id: string;
  title: string;
  sku: string | null;
}

export interface SpecificationValidationError {
  field: string;
  message: string;
}
