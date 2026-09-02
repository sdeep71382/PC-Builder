export type BuilderStatus = "draft" | "published" | "archived";

export type CatalogReferenceType = "collection" | "product" | "variant";

export interface Builder {
  id: string;
  publicId: string | null;
  shopId: string;
  name: string;
  description: string | null;
  status: BuilderStatus;
  isDefault: boolean;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface BuilderStep {
  id: string;
  shopId: string;
  builderId: string;
  name: string;
  position: number;
  enabled: boolean;
  required: boolean;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface StepCatalogAssignment {
  id: string;
  shopId: string;
  builderId: string;
  stepId: string;
  referenceType: CatalogReferenceType;
  shopifyCollectionId: string | null;
  shopifyProductId: string | null;
  shopifyVariantId: string | null;
  position: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface BuilderWithSteps extends Builder {
  steps: BuilderStep[];
}

export interface BuilderStepWithAssignments extends BuilderStep {
  assignments: StepCatalogAssignment[];
}

export interface ShopifyProductNode {
  id: string;
  title: string;
}

export interface ShopifyCollectionNode {
  id: string;
  title: string;
  handle: string;
  image: {
    url: string;
    altText: string | null;
  } | null;
  productCount: number | null;
}

export interface ShopifyVariantNode {
  id: string;
  title: string;
  product: ShopifyProductNode;
}

export type ShopifyCatalogResult =
  | {
      type: "success";
      collections: ShopifyCollectionNode[];
      products: ShopifyProductNode[];
      variants: ShopifyVariantNode[];
    }
  | { type: "failure"; message: string };

export type ShopifyCollectionLookupResult =
  | { type: "success"; collection: ShopifyCollectionNode | null }
  | { type: "failure"; message: string };

export type ShopifyProductLookupResult =
  | { type: "success"; product: ShopifyProductNode | null }
  | { type: "failure"; message: string };

export type ShopifyVariantLookupResult =
  | { type: "success"; variant: ShopifyVariantNode | null }
  | { type: "failure"; message: string };

export interface BuilderValidationError {
  field: string;
  message: string;
}

export interface ActionFeedback {
  type: "success" | "validation" | "authorization" | "stale" | "temporary";
  message: string;
}
