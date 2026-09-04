import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";
import prisma from "../../db.server";
import type {
  StorefrontBuilderDto,
  StorefrontBuilderResult,
  StorefrontBuilderStepDto,
  StorefrontProductOptionDto,
  StorefrontCompatibilityRuleDto,
} from "./types";
import { inferSpecificationCategory } from "../product-specifications/specification-definitions";
import { evaluateBuild } from "../compatibility/compatibility-engine";
import type { CompatibilitySelection, CompatibilityRuleOperator, CompatibilityRuleSeverity } from "../compatibility/types";
import type { StorefrontValidationResult, StorefrontValidationError } from "./types";
import { upsertValidatedBuild } from "../build-sessions/build-session.server";
import { getVariantPurchasability } from "./variant-purchasability";

const STOREFRONT_LOOKUP_TIMEOUT_MS = 10000;

export async function getPublicStorefrontBuilder(
  shopId: string,
  publicBuilderId: string,
  admin: AdminApiContext
): Promise<StorefrontBuilderResult> {
  if (!isPublicBuilderId(publicBuilderId)) {
    return { type: "unavailable" };
  }

  const builder = await prisma.builder.findFirst({
    where: { shopId, publicId: publicBuilderId, status: "published" },
    include: {
      builderSteps: {
        where: { enabled: true },
        orderBy: { position: "asc" },
        include: {
          assignments: {
            where: { referenceType: "collection" },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      },
    },
  });

  if (!builder || !builder.publicId) {
    return { type: "unavailable" };
  }

  const steps: StorefrontBuilderStepDto[] = [];
  const compatibilityRules = await prisma.compatibilityRule.findMany({
    where: { shopId, builderId: builder.id, enabled: true },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      sourceCategory: true,
      sourceField: true,
      operator: true,
      targetCategory: true,
      targetField: true,
      severity: true,
      message: true,
    },
  });
  const enabledSteps = builder.builderSteps
    .filter((step) => step.enabled)
    .sort((a, b) => a.position - b.position);

  for (const step of enabledSteps) {
    const assignment = step.assignments[0];
    if (!assignment?.shopifyCollectionId) {
    steps.push(stepDto(step, [], "no_collection"));
      continue;
    }

    const productsResult = await listCollectionProducts(admin, assignment.shopifyCollectionId);
    if (productsResult.type === "failure") {
      console.warn("PC Builder storefront collection unavailable", {
        shopId,
        builderPublicId: publicBuilderId,
        stepId: step.id,
        collectionId: assignment.shopifyCollectionId,
      });
      steps.push(stepDto(step, [], "collection_unavailable"));
      continue;
    }

    const variantIds = productsResult.products.map((product) => product.variantId);
    const specifications = await loadVariantSpecifications(shopId, variantIds);
    const products = productsResult.products.map((product) => ({
      ...product,
      specifications: specifications[product.variantId] ?? {},
    }));

    steps.push(stepDto(step, products, products.length > 0 ? "ready" : "no_products"));
  }

  return {
    type: "success",
    data: {
      builder: {
        publicId: builder.publicId,
        name: builder.name,
        description: builder.description,
      steps,
      compatibilityRules: compatibilityRules.map(toStorefrontRule),
      },
    },
  };
}

function toStorefrontRule(rule: {
  id: string;
  sourceCategory: string;
  sourceField: string;
  operator: string;
  targetCategory: string;
  targetField: string;
  severity: string;
  message: string;
}): StorefrontCompatibilityRuleDto {
  return {
    id: rule.id,
    sourceCategory: rule.sourceCategory,
    sourceField: rule.sourceField,
    operator: rule.operator as StorefrontCompatibilityRuleDto["operator"],
    targetCategory: rule.targetCategory,
    targetField: rule.targetField,
    severity: rule.severity as StorefrontCompatibilityRuleDto["severity"],
    message: rule.message,
  };
}

export async function getDefaultStorefrontBuilder(
  shopId: string,
  admin: AdminApiContext
): Promise<StorefrontBuilderResult> {
  const defaultBuilder = await prisma.builder.findFirst({
    where: { shopId, status: "published", isDefault: true },
    orderBy: { updatedAt: "desc" },
    select: { publicId: true },
  });
  const fallbackBuilder = defaultBuilder
    ? null
    : await prisma.builder.findFirst({
        where: { shopId, status: "published" },
        orderBy: { updatedAt: "desc" },
        select: { publicId: true },
      });
  const publicId = defaultBuilder?.publicId ?? fallbackBuilder?.publicId ?? null;
  if (!publicId) {
    return { type: "unavailable" };
  }
  return getPublicStorefrontBuilder(shopId, publicId, admin);
}

export async function validateBuildForCart(
  shopId: string,
  publicBuilderId: string,
  submittedSelections: Record<string, string>,
  admin: AdminApiContext,
  sessionId: string
): Promise<StorefrontValidationResult> {
  const builder = await prisma.builder.findFirst({
    where: { shopId, publicId: publicBuilderId, status: "published" },
    include: { builderSteps: { where: { enabled: true }, orderBy: { position: "asc" }, include: { assignments: { where: { referenceType: "collection" }, take: 1 } } } },
  });
  if (!builder) throw new Error("Builder is not available.");

  const errors: StorefrontValidationError[] = [];
  const selected: CompatibilitySelection[] = [];
  const cartSelections: StorefrontValidationResult["selections"] = [];
  const pendingSelections: Array<{ step: typeof builder.builderSteps[number]; stepKey: string; variantId: string; product: StorefrontProductOptionDto }> = [];
  for (const step of builder.builderSteps) {
    const stepKeyValue = inferSpecificationCategory(step.name);
    const submittedStepKey = `step-${step.position}-${stepKey(step.name)}`;
    const variantId = submittedSelections[submittedStepKey] ?? submittedSelections[step.id];
    if (!variantId) {
      if (step.required) errors.push({ type: "MISSING_REQUIRED_STEP", stepKey: stepKeyValue, message: `Choose an option for ${step.name}.` });
      continue;
    }
    const collectionId = step.assignments[0]?.shopifyCollectionId;
    if (!collectionId) {
      errors.push({ type: "NOT_IN_STEP_CATALOG", stepKey: stepKeyValue, variantId, message: `${step.name} is not connected to a catalog.` });
      continue;
    }
    const catalog = await listCollectionProducts(admin, collectionId);
    const product = catalog.type === "success" ? catalog.products.find((candidate) => candidate.variantId === variantId) : undefined;
    if (!product) {
      errors.push({ type: "NOT_IN_STEP_CATALOG", stepKey: stepKeyValue, variantId, message: "This product is no longer available in this builder step." });
      continue;
    }
    if (!product.purchasable) {
      const type = product.unavailableReason === "NOT_PUBLISHED" ? "NOT_PUBLISHED" : product.unavailableReason === "PRODUCT_INACTIVE" ? "PRODUCT_INACTIVE" : product.unavailableReason === "VARIANT_NOT_FOUND" ? "VARIANT_NOT_FOUND" : product.unavailableReason === "UNKNOWN" ? "UNKNOWN" : "VARIANT_UNAVAILABLE";
      errors.push({ type, stepKey: stepKeyValue, variantId, message: type === "NOT_PUBLISHED" ? `${product.productTitle} is not currently available on the Online Store.` : `${product.productTitle} is currently unavailable for purchase.` });
    }
    pendingSelections.push({ step, stepKey: stepKeyValue, variantId, product });
  }
  const specs = await loadVariantSpecifications(shopId, pendingSelections.map((item) => item.variantId));
  for (const item of pendingSelections) {
    selected.push({ category: item.stepKey, shopifyProductId: item.product.productId, shopifyVariantId: item.variantId, specifications: specs[item.variantId] ?? {} });
    cartSelections.push({ stepKey: item.stepKey, stepId: item.step.id, productId: item.product.productId, variantId: item.variantId, price: item.product.price });
  }
  const rules = await prisma.compatibilityRule.findMany({ where: { shopId, builderId: builder.id, enabled: true }, orderBy: { createdAt: "asc" } });
  const compatibility = evaluateBuild({ rules: rules.map(toRule), selections: selected });
  for (const violation of compatibility.violations) errors.push({ type: "INCOMPATIBLE", message: violation.message });
  for (const unknown of compatibility.unknowns) errors.push({ type: "UNKNOWN", message: unknown.message });
  const valid = errors.length === 0;
  if (valid) {
    await upsertValidatedBuild({
      shopId,
      builderId: builder.id,
      publicSessionId: sessionId,
      currency: cartSelections[0]?.price.currencyCode ?? "",
      selections: cartSelections.map((selection) => ({
        stepId: selection.stepId,
        productId: selection.productId,
        variantId: selection.variantId,
        price: selection.price.amount,
      })),
    });
  }
  return { valid, sessionId, errors, selections: cartSelections };
}

function toRule(rule: { id: string; shopId: string; builderId: string; sourceCategory: string; sourceField: string; operator: string; targetCategory: string; targetField: string; comparisonValue: unknown; severity: string; enabled: boolean; message: string; createdAt: Date; updatedAt: Date }) {
  return { ...rule, operator: rule.operator as CompatibilityRuleOperator, severity: rule.severity as CompatibilityRuleSeverity };
}

function isPublicBuilderId(value: string): boolean {
  return /^pb_[a-f0-9]{32}$/.test(value);
}

function stepDto(
  step: {
    id: string;
    name: string;
    position: number;
    required: boolean;
  },
  products: StorefrontProductOptionDto[],
  state: StorefrontBuilderStepDto["state"]
): StorefrontBuilderStepDto {
  return {
    publicId: `step-${step.position}-${stepKey(step.name)}`,
    key: inferSpecificationCategory(step.name),
    name: step.name,
    position: step.position,
    required: step.required,
    products,
    state,
  };
}

function stepKey(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

async function loadVariantSpecifications(
  shopId: string,
  variantIds: string[]
): Promise<Record<string, Record<string, unknown>>> {
  if (variantIds.length === 0) return {};

  const rows = await prisma.productSpecification.findMany({
    where: { shopId, shopifyVariantId: { in: variantIds } },
    include: { specificationDefinition: true },
  });
  const byVariant: Record<string, Record<string, unknown>> = {};
  for (const row of rows) {
    byVariant[row.shopifyVariantId] ??= {};
    byVariant[row.shopifyVariantId][row.specificationDefinition.key] = row.value;
  }
  return byVariant;
}

async function listCollectionProducts(
  admin: AdminApiContext,
  collectionId: string
): Promise<
  | { type: "success"; products: StorefrontProductOptionDto[] }
  | { type: "failure"; message: string }
> {
  try {
    const response = await withTimeout(
      admin.graphql(
        `#graphql
          query PcBuilderCollectionProducts($id: ID!) {
            shop {
              currencyCode
            }
            collection(id: $id) {
              products(first: 100) {
                nodes {
                  id
                  title
                  vendor
                  status
                  featuredImage {
                    url
                    altText
                  }
                  variants(first: 20) {
                    nodes {
                      id
                      title
                      sku
            availableForSale
                  product {
                    id
                  }
                      image {
                        url
                        altText
                      }
                      price
                      inventoryQuantity
                    }
                  }
                }
              }
            }
          }
        `,
        { variables: { id: collectionId } }
      ) as Promise<Response>,
      STOREFRONT_LOOKUP_TIMEOUT_MS,
      "Shopify storefront lookup timed out."
    );
    const json = (await withTimeout(
      response.json(),
      STOREFRONT_LOOKUP_TIMEOUT_MS,
      "Shopify storefront response timed out."
    )) as StorefrontCollectionResponse;
    if (json.errors?.length) {
      console.error("PC Builder Shopify collection query failed", {
        collectionId,
        errors: json.errors.map((error) => error.message),
      });
      return { type: "failure", message: "Collection unavailable." };
    }
    const collection = json.data?.collection ?? null;
    if (!collection) {
      return { type: "failure", message: "Collection unavailable." };
    }
    const currencyCode = json.data?.shop?.currencyCode ?? "USD";

    return {
      type: "success",
      products: collection.products.nodes.flatMap((product) =>
        product.variants.nodes
          .filter((variant) => Boolean(variant?.id && variant.price))
          .map((variant) => {
            const purchasability = getVariantPurchasability({
              exists: true,
              productStatus: product.status,
              onlineStorePublished: true,
              availableForSale: variant.availableForSale,
            });
            return {
              productId: product.id,
              variantId: variant.id,
              productTitle: product.title,
              variantTitle: variant.title && variant.title !== "Default Title" ? variant.title : null,
              vendor: product.vendor || null,
              sku: variant.sku || null,
              image: variant.image ?? product.featuredImage ?? null,
              price: {
                amount: variant.price,
                currencyCode,
              },
              available: variant.availableForSale,
              purchasable: purchasability.purchasable,
              unavailableReason:
                purchasability.purchasable || purchasability.reason === "AVAILABLE"
                  ? null
                  : purchasability.reason,
              specifications: {},
            };
          })
      ),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Collection unavailable.";
    return { type: "failure", message };
  }
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeout = setTimeout(() => reject(new Error(message)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

interface StorefrontCollectionResponse {
  errors?: Array<{ message: string }>;
  data?: {
    shop: {
      currencyCode: string;
    } | null;
    collection: {
      products: {
        nodes: Array<{
          id: string;
          title: string;
          vendor: string;
          status: string;
          featuredImage: { url: string; altText: string | null } | null;
          variants: {
            nodes: Array<{
              id: string;
              title: string;
              sku: string | null;
              availableForSale: boolean;
              image: { url: string; altText: string | null } | null;
              price: string;
              inventoryQuantity: number | null;
            }>;
          };
        }>;
      };
    } | null;
  };
}
