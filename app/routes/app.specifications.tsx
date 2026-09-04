import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useActionData, useLoaderData, useNavigation } from "react-router";
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
      await seedDemoSpecifications(session.shop, products, definitions);
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

async function seedDemoSpecifications(
  shopId: string,
  products: ShopifyCollectionProduct[],
  definitions: Awaited<ReturnType<typeof getSpecificationDefinitionsForStep>>
): Promise<void> {
  const demoProducts = products.filter((product) => /builder/i.test(product.title));
  if (demoProducts.length === 0 || definitions.length === 0) return;

  await Promise.all(
    demoProducts.flatMap((product) =>
      product.variants.map((variant) =>
        saveProductSpecifications(shopId, {
          shopifyProductId: product.id,
          shopifyVariantId: variant.id,
          values: Object.fromEntries(
            definitions.map((definition) => [
              definition.id,
              demoValue(definition.category, definition.key, product.title),
            ])
          ),
          source: "manual",
          verified: true,
        })
      )
    )
  );
}

function demoValue(category: string, key: string, title: string): string {
  const text = title.toLowerCase();
  const categoryName = category.toLowerCase();
  if (key === "brand") return "PC Builder Demo";
  if (key === "series") return title.replace(/builder.*$/i, "").trim() || "Demo Series";
  if (key === "generation") return "Demo Generation";
  if (key === "socket") return text.includes("ryzen") || /b650|x670|x870/.test(text) ? "AM5" : "LGA1700";
  if (key === "supportedMemoryType") return text.includes("ryzen") || /b650|x670|x870/.test(text) ? "DDR5" : "DDR4";
  if (key === "memoryType") return text.includes("ddr4") || text.includes("b760") ? "DDR4" : "DDR5";
  if (key === "tdp") return text.includes("4080") ? "320" : text.includes("ryzen") ? "120" : "125";
  if (key === "integratedGraphics") return categoryName === "cpu" ? "false" : "false";
  if (key === "chipset") return title.replace(/builder.*$/i, "").trim() || "Demo Chipset";
  if (key === "formFactor" || key === "formFactorSupport") return "ATX, Micro-ATX, Mini-ITX";
  if (key === "pcieVersion") return "4.0";
  if (key === "m2Slots") return "2";
  if (key === "maxMemory") return "128";
  if (key === "capacityGb") return text.includes("2tb") ? "2000" : text.includes("1tb") ? "1000" : "32";
  if (key === "speedMhz") return "6000";
  if (key === "modules") return "2";
  if (key === "lengthMm") return text.includes("4080") ? "304" : "280";
  if (key === "recommendedPsuW") return text.includes("4080") ? "850" : "650";
  if (key === "wattage") return (text.match(/(\d+)w/)?.[1] ?? "650");
  if (key === "efficiency") return "80+ Gold";
  if (key === "maxGpuLengthMm") return text.includes("rgb") ? "280" : text.includes("full tower") ? "400" : "360";
  if (key === "maxCoolerHeightMm") return "170";
  if (key === "psuSupport") return "ATX, SFX";
  if (key === "supportedSockets") return "AM5, AM4, LGA1700";
  if (key === "coolerType") return "Air cooler";
  if (key === "heightMm") return "155";
  if (key === "radiatorSizeMm") return "240";
  if (key === "tdpCapacity") return "180";
  if (key === "storageType") return "NVMe SSD";
  if (key === "interface") return "PCIe 4.0 NVMe";
  if (key === "readSpeedMbps") return "7000";
  if (key === "writeSpeedMbps") return "5000";
  return "Demo value";
}

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
  const navigation = useNavigation();

  if (navigation.state === "loading") {
    return (
      <s-page heading="Product specifications">
        <div className="builder-admin" aria-busy="true">
          <div className="builder-card builder-card--loading" role="status" aria-live="polite">
            <div className="builder-skeleton builder-skeleton--card-title" />
            <div className="builder-skeleton builder-skeleton--text" />
            <div className="builder-skeleton builder-skeleton--text builder-skeleton--short" />
          </div>
          <div className="builder-admin__grid builder-admin__grid--two">
            <div className="builder-card">
              <div className="builder-skeleton builder-skeleton--card-title" />
              <div className="builder-skeleton-list">
                {Array.from({ length: 5 }, (_, index) => (
                  <div className="builder-skeleton builder-skeleton--row" key={index} />
                ))}
              </div>
            </div>
            <div className="builder-card">
              <div className="builder-skeleton builder-skeleton--card-title" />
              {Array.from({ length: 6 }, (_, index) => (
                <div className="builder-skeleton builder-skeleton--input" key={index} />
              ))}
            </div>
          </div>
        </div>
      </s-page>
    );
  }

  return (
    <SpecificationWorkspace
      {...data}
      feedback={actionData?.feedback ?? null}
    />
  );
}
