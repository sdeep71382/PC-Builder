import { Prisma, PrismaClient } from "@prisma/client";
import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";
import type {
  ProductSpecification,
  ShopifyCollectionProduct,
  ShopifyProductVariant,
  SpecificationDefinition,
  SpecificationSource,
} from "./types";
import {
  DEFAULT_SPECIFICATION_DEFINITIONS,
  inferSpecificationCategory,
} from "./specification-definitions";
import {
  parseSpecificationValue,
  validateSpecificationDefinitionInput,
} from "./product-specification-validation";

const prisma = new PrismaClient();


const SHOPIFY_LOOKUP_ERROR =
  "Shopify product lookup is temporarily unavailable. Please try again.";

export async function ensureDefaultSpecificationDefinitions(
  shopId: string
): Promise<void> {
  const existingDefinitions = await prisma.specificationDefinition.findMany({
    where: { shopId },
    select: { category: true, key: true },
  });
  const existingKeys = new Set(
    existingDefinitions.map((definition) => `${definition.category}:${definition.key}`)
  );
  const missingDefinitions = DEFAULT_SPECIFICATION_DEFINITIONS.filter(
    (definition) => !existingKeys.has(`${definition.category}:${definition.key}`)
  );

  if (missingDefinitions.length === 0) {
    return;
  }

  await prisma.$transaction(
    missingDefinitions.map((definition) =>
      prisma.specificationDefinition.upsert({
        where: {
          shopId_category_key: {
            shopId,
            category: definition.category,
            key: definition.key,
          },
        },
        update: {
          label: definition.label,
          dataType: definition.dataType,
          unit: definition.unit ?? null,
          required: definition.required ?? false,
          config: toJsonInput(definition.config ?? null),
        },
        create: {
          shopId,
          category: definition.category,
          key: definition.key,
          label: definition.label,
          dataType: definition.dataType,
          unit: definition.unit ?? null,
          required: definition.required ?? false,
          config: toJsonInput(definition.config ?? null),
        },
      })
    )
  );
}

export async function getSpecificationDefinitionsForStep(
  shopId: string,
  stepName: string
): Promise<SpecificationDefinition[]> {
  const category = inferSpecificationCategory(stepName);
  const definitions = await prisma.specificationDefinition.findMany({
    where: { shopId, category },
    orderBy: { key: "asc" },
  });
  return definitions.map(toDefinition);
}

export async function createSpecificationDefinition(
  shopId: string,
  data: Omit<SpecificationDefinition, "id" | "shopId" | "createdAt" | "updatedAt">
): Promise<SpecificationDefinition> {
  const error = validateSpecificationDefinitionInput(data);
  if (error) {
    throw new Error(error.message);
  }

  const definition = await prisma.specificationDefinition.create({
    data: {
      shopId,
      category: data.category.trim(),
      key: data.key.trim(),
      label: data.label.trim(),
      dataType: data.dataType,
      unit: data.unit?.trim() || null,
      required: data.required,
      config: toJsonInput(data.config ?? null),
    },
  });
  return toDefinition(definition);
}

export async function getSpecificationsForVariant(
  shopId: string,
  shopifyVariantId: string
): Promise<ProductSpecification[]> {
  const specifications = await prisma.productSpecification.findMany({
    where: { shopId, shopifyVariantId },
  });
  return specifications.map(toProductSpecification);
}

export async function getSpecificationCompletionForVariants(
  shopId: string,
  shopifyVariantIds: string[],
  definitions: SpecificationDefinition[]
): Promise<Record<string, { completed: number; requiredMissing: number; total: number }>> {
  if (shopifyVariantIds.length === 0 || definitions.length === 0) {
    return {};
  }

  const values = await prisma.productSpecification.findMany({
    where: {
      shopId,
      shopifyVariantId: { in: shopifyVariantIds },
      specificationDefinitionId: { in: definitions.map((definition) => definition.id) },
    },
  });

  const requiredDefinitionIds = new Set(
    definitions.filter((definition) => definition.required).map((definition) => definition.id)
  );
  const byVariant: Record<string, Set<string>> = {};
  for (const variantId of shopifyVariantIds) {
    byVariant[variantId] = new Set();
  }
  for (const value of values) {
    byVariant[value.shopifyVariantId]?.add(value.specificationDefinitionId);
  }

  const completion: Record<string, { completed: number; requiredMissing: number; total: number }> = {};
  for (const variantId of shopifyVariantIds) {
    const present = byVariant[variantId] ?? new Set<string>();
    const requiredMissing = [...requiredDefinitionIds].filter((id) => !present.has(id)).length;
    completion[variantId] = {
      completed: present.size,
      requiredMissing,
      total: definitions.length,
    };
  }
  return completion;
}

export async function saveProductSpecifications(
  shopId: string,
  data: {
    shopifyProductId: string;
    shopifyVariantId: string;
    values: Record<string, string | undefined>;
    source?: SpecificationSource;
    verified?: boolean;
  }
): Promise<void> {
  if (!data.shopifyProductId.startsWith("gid://shopify/Product/")) {
    throw new Error("A valid Shopify product ID is required.");
  }
  if (!data.shopifyVariantId.startsWith("gid://shopify/ProductVariant/")) {
    throw new Error("A valid Shopify variant ID is required.");
  }

  const definitions = await prisma.specificationDefinition.findMany({
    where: { shopId, id: { in: Object.keys(data.values) } },
  });
  const definitionById = new Map(definitions.map((definition) => [definition.id, toDefinition(definition)]));
  const requestedIds = Object.keys(data.values);

  if (definitions.length !== requestedIds.length) {
    throw new Error("One or more specification definitions are invalid for this shop.");
  }

  const operations = [];
  for (const definitionId of requestedIds) {
    const definition = definitionById.get(definitionId);
    if (!definition) {
      throw new Error("Specification definition not found.");
    }
    const parsed = parseSpecificationValue(definition, data.values[definitionId]);
    if (parsed.error) {
      throw new Error(parsed.error.message);
    }

    if (parsed.value === null) {
      operations.push(
        prisma.productSpecification.deleteMany({
          where: {
            shopId,
            shopifyVariantId: data.shopifyVariantId,
            specificationDefinitionId: definition.id,
          },
        })
      );
      continue;
    }

    operations.push(
      prisma.productSpecification.upsert({
        where: {
          shopId_shopifyVariantId_specificationDefinitionId: {
            shopId,
            shopifyVariantId: data.shopifyVariantId,
            specificationDefinitionId: definition.id,
          },
        },
        update: {
          shopifyProductId: data.shopifyProductId,
          value: toJsonInput(parsed.value),
          source: data.source ?? "manual",
          verified: data.verified ?? true,
        },
        create: {
          shopId,
          shopifyProductId: data.shopifyProductId,
          shopifyVariantId: data.shopifyVariantId,
          specificationDefinitionId: definition.id,
          value: toJsonInput(parsed.value),
          source: data.source ?? "manual",
          verified: data.verified ?? true,
        },
      })
    );
  }

  await prisma.$transaction(operations);
}

export async function listShopifyProductsForCollection(
  admin: AdminApiContext,
  shopifyCollectionId: string
): Promise<
  | { type: "success"; products: ShopifyCollectionProduct[] }
  | { type: "failure"; message: string }
> {
  try {
    const result = await withTimeout(
      admin.graphql(
        `#graphql
          query ProductsForCollection($id: ID!) {
            collection(id: $id) {
              id
              products(first: 100) {
                nodes {
                  id
                  title
                  handle
                  featuredImage {
                    url
                    altText
                  }
                  variants(first: 50) {
                    nodes {
                      id
                      title
                      sku
                    }
                  }
                }
              }
            }
          }
        `,
        { variables: { id: shopifyCollectionId } }
      ),
      10000,
      "Shopify took too long to return products for this collection."
    );

    const json = (await withTimeout(
      result.json(),
      10000,
      "Shopify took too long to return products for this collection."
    )) as {
      data?: {
        collection: {
          products: {
            nodes: Array<{
              id: string;
              title: string;
              handle: string;
              featuredImage: { url: string; altText: string | null } | null;
              variants: { nodes: ShopifyProductVariant[] };
            }>;
          };
        } | null;
      };
      collection?: {
        products: {
          nodes: Array<{
            id: string;
            title: string;
            handle: string;
            featuredImage: { url: string; altText: string | null } | null;
            variants: { nodes: ShopifyProductVariant[] };
          }>;
        };
      } | null;
    };
    const collection = json.data?.collection ?? json.collection ?? null;

    if (!collection) {
      return { type: "failure", message: "Assigned Shopify collection is no longer available." };
    }

    return {
      type: "success",
      products: collection.products.nodes.map((product) => ({
        id: product.id,
        title: product.title,
        handle: product.handle,
        featuredImage: product.featuredImage,
        variants: product.variants.nodes,
      })),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : SHOPIFY_LOOKUP_ERROR;
    return { type: "failure", message: message || SHOPIFY_LOOKUP_ERROR };
  }
}

export async function findShopifyVariantInCollection(
  admin: AdminApiContext,
  shopifyCollectionId: string,
  shopifyProductId: string,
  shopifyVariantId: string
): Promise<
  | { type: "success"; product: ShopifyCollectionProduct; variant: ShopifyProductVariant }
  | { type: "failure"; message: string }
> {
  const productsResult = await listShopifyProductsForCollection(admin, shopifyCollectionId);
  if (productsResult.type === "failure") {
    return productsResult;
  }

  const product = productsResult.products.find((candidate) => candidate.id === shopifyProductId);
  const variant = product?.variants.find((candidate) => candidate.id === shopifyVariantId);

  if (!product || !variant) {
    return {
      type: "failure",
      message: "Selected product variant is not available in this assigned Shopify collection.",
    };
  }

  return { type: "success", product, variant };
}

function toDefinition(definition: {
  id: string;
  shopId: string;
  category: string;
  key: string;
  label: string;
  dataType: string;
  unit: string | null;
  required: boolean;
  config: unknown;
  createdAt: Date;
  updatedAt: Date;
}): SpecificationDefinition {
  return {
    ...definition,
    dataType: definition.dataType as SpecificationDefinition["dataType"],
  };
}

function toProductSpecification(specification: {
  id: string;
  shopId: string;
  shopifyProductId: string;
  shopifyVariantId: string;
  specificationDefinitionId: string;
  value: unknown;
  source: string;
  verified: boolean;
  createdAt: Date;
  updatedAt: Date;
}): ProductSpecification {
  return {
    ...specification,
    source: specification.source as ProductSpecification["source"],
  };
}

function toJsonInput(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message: string
): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeout = setTimeout(() => reject(new Error(message)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}
