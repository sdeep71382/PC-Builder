import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useActionData, useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import {
  getCatalogAssignmentsForStep,
  getStepsForBuilder,
  listBuilders,
} from "../domains/builder-admin/builder.server";
import {
  ensureDefaultSpecificationDefinitions,
  findShopifyVariantInCollection,
  getSpecificationCompletionForVariants,
  getSpecificationDefinitionsForStep,
  getSpecificationsForVariant,
  listShopifyProductsForCollection,
  saveProductSpecifications,
} from "../domains/product-specifications/product-specification.server";
import { SpecificationWorkspace } from "../components/product-specifications/SpecificationWorkspace";
import type { ShopifyCollectionProduct } from "../domains/product-specifications/types";

interface ActionData {
  feedback?: {
    type: "success" | "validation" | "authorization" | "temporary";
    message: string;
  };
}

function getSearchParam(request: Request, key: string): string | null {
  return new URL(request.url).searchParams.get(key);
}

async function loadBuilderSteps(shopId: string) {
  const builders = await listBuilders(shopId);
  return Promise.all(
    builders.map(async (builder) => ({
      ...builder,
      steps: await getStepsForBuilder(shopId, builder.id),
    }))
  );
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  await ensureDefaultSpecificationDefinitions(session.shop);

  const builders = await loadBuilderSteps(session.shop);
  const selectedBuilderId = getSearchParam(request, "builderId");
  const selectedStepId = getSearchParam(request, "stepId");
  const selectedProductId = getSearchParam(request, "productId");
  const selectedVariantId = getSearchParam(request, "variantId");

  const selectedBuilder = builders.find((builder) => builder.id === selectedBuilderId) ?? null;
  const selectedStep =
    selectedBuilder?.steps.find((step) => step.id === selectedStepId) ?? null;

  if (selectedBuilderId && !selectedBuilder) {
    throw new Response("Not Found", { status: 404 });
  }

  if (selectedStepId && !selectedStep) {
    throw new Response("Not Found", { status: 404 });
  }

  const definitions = selectedStep
    ? await getSpecificationDefinitionsForStep(session.shop, selectedStep.name)
    : [];
  const assignments = selectedStep
    ? await getCatalogAssignmentsForStep(session.shop, selectedStep.id)
    : [];
  const assignment =
    assignments.find((candidate) => candidate.referenceType === "collection") ?? null;

  let products: ShopifyCollectionProduct[] = [];
  let lookupError: string | null = null;
  if (assignment?.shopifyCollectionId) {
    const productsResult = await listShopifyProductsForCollection(
      admin,
      assignment.shopifyCollectionId
    );
    if (productsResult.type === "success") {
      products = productsResult.products;
    } else {
      lookupError = productsResult.message;
    }
  }

  const variantIds = products.flatMap((product) =>
    product.variants.map((variant) => variant.id)
  );
  const completion = await getSpecificationCompletionForVariants(
    session.shop,
    variantIds,
    definitions
  );

  const selectedVariantBelongsToCollection =
    products.some(
      (product) =>
        product.id === selectedProductId &&
        product.variants.some((variant) => variant.id === selectedVariantId)
    );
  const values =
    selectedVariantId && selectedVariantBelongsToCollection
      ? await getSpecificationsForVariant(session.shop, selectedVariantId)
      : [];

  return {
    builders,
    selectedBuilderId,
    selectedStepId,
    selectedProductId,
    selectedVariantId,
    selectedStep,
    assignment,
    definitions,
    products,
    values,
    completion,
    lookupError,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const shopifyProductId = String(formData.get("shopifyProductId") ?? "");
  const shopifyVariantId = String(formData.get("shopifyVariantId") ?? "");

  const url = new URL(request.url);
  const builderId = url.searchParams.get("builderId");
  const stepId = url.searchParams.get("stepId");
  if (!builderId || !stepId) {
    return Response.json(
      { feedback: { type: "validation", message: "Builder and step are required." } },
      { status: 400 }
    );
  }

  const steps = await getStepsForBuilder(session.shop, builderId);
  const step = steps.find((candidate) => candidate.id === stepId);
  if (!step) {
    return Response.json(
      { feedback: { type: "authorization", message: "Step not found for this builder." } },
      { status: 404 }
    );
  }

  const assignments = await getCatalogAssignmentsForStep(session.shop, step.id);
  const assignment = assignments.find((candidate) => candidate.referenceType === "collection");
  if (!assignment?.shopifyCollectionId) {
    return Response.json(
      { feedback: { type: "validation", message: "Assign a collection before saving specifications." } },
      { status: 400 }
    );
  }

  const variantLookup = await findShopifyVariantInCollection(
    admin,
    assignment.shopifyCollectionId,
    shopifyProductId,
    shopifyVariantId
  );
  if (variantLookup.type === "failure") {
    return Response.json(
      { feedback: { type: "validation", message: variantLookup.message } },
      { status: 400 }
    );
  }

  const definitions = await getSpecificationDefinitionsForStep(session.shop, step.name);
  const values: Record<string, string | undefined> = {};
  for (const definition of definitions) {
    const value = formData.get(`spec_${definition.id}`);
    values[definition.id] = typeof value === "string" ? value : undefined;
  }

  try {
    await saveProductSpecifications(session.shop, {
      shopifyProductId,
      shopifyVariantId,
      values,
      source: "manual",
      verified: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save specifications.";
    return Response.json({ feedback: { type: "validation", message } }, { status: 400 });
  }

  return Response.json({
    feedback: { type: "success", message: "Specifications saved." },
  });
};

export default function ProductSpecificationsRoute() {
  const data = useLoaderData<typeof loader>();
  const actionData = useActionData<ActionData>();
  return (
    <SpecificationWorkspace
      {...data}
      feedback={actionData?.feedback ?? null}
    />
  );
}
