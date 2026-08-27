import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { redirect, useActionData, useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import {
  createCatalogAssignment,
  removeCatalogAssignment,
  getCatalogAssignmentsForStep,
  getStepsForBuilder,
} from "../domains/builder-admin/builder.server";
import {
  findShopifyCollection,
  findShopifyProduct,
  findShopifyVariant,
  lookupShopifyCatalog,
} from "../domains/builder-admin/catalog-assignment.server";
import { CatalogAssignmentPicker } from "../components/builder-admin/CatalogAssignmentPicker";

interface ActionData {
  feedback?: {
    type: "success" | "validation" | "authorization" | "stale" | "temporary";
    message: string;
  };
}

function formString(value: FormDataEntryValue | null): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const builderId = params.builderId;
  const stepId = params.stepId;
  if (!builderId || !stepId) {
    throw new Response("Not Found", { status: 404 });
  }
  const [assignments, catalog, steps] = await Promise.all([
    getCatalogAssignmentsForStep(session.shop, stepId),
    lookupShopifyCatalog(admin),
    getStepsForBuilder(session.shop, builderId),
  ]);
  const step = steps.find((candidate) => candidate.id === stepId);
  return { builderId, stepId, stepName: step?.name ?? "Step", assignments, catalog };
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const builderId = params.builderId;
  const stepId = params.stepId;
  if (!builderId || !stepId) {
    return Response.json(
      { feedback: { type: "validation", message: "Builder and step IDs are required." } },
      { status: 400 },
    );
  }
  const formData = await request.formData();
  const assignmentId = formData.get("assignmentId");
  const referenceType = formData.get("referenceType");
  const shopifyCollectionId = formString(formData.get("shopifyCollectionId"));
  const shopifyProductId = formString(formData.get("shopifyProductId"));
  const shopifyVariantId = formString(formData.get("shopifyVariantId"));

  if (assignmentId) {
    try {
      await removeCatalogAssignment(session.shop, assignmentId as string);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to remove assignment.";
      return Response.json({ feedback: { type: "authorization", message } }, { status: 400 });
    }
    return redirect(`/app/builders/${builderId}/steps/${stepId}/catalog`);
  }

  if (referenceType === "collection" && shopifyCollectionId) {
    const lookup = await findShopifyCollection(admin, shopifyCollectionId);
    if (lookup.type === "failure") {
      return Response.json({ feedback: { type: "temporary", message: lookup.message } }, { status: 503 });
    }
    if (!lookup.collection) {
      return Response.json(
        {
          feedback: {
            type: "validation",
            message: "The selected collection is missing, invalid, or not available to this shop.",
          },
        },
        { status: 400 },
      );
    }
  } else if (referenceType === "product" && shopifyProductId) {
    const lookup = await findShopifyProduct(admin, shopifyProductId);
    if (lookup.type === "failure") {
      return Response.json({ feedback: { type: "temporary", message: lookup.message } }, { status: 503 });
    }
    if (!lookup.product) {
      return Response.json(
        {
          feedback: {
            type: "validation",
            message: "The selected product is missing, invalid, or not available to this shop.",
          },
        },
        { status: 400 },
      );
    }
  } else if (referenceType === "variant" && shopifyVariantId) {
    const lookup = await findShopifyVariant(admin, shopifyVariantId);
    if (lookup.type === "failure") {
      return Response.json({ feedback: { type: "temporary", message: lookup.message } }, { status: 503 });
    }
    if (!lookup.variant) {
      return Response.json(
        {
          feedback: {
            type: "validation",
            message: "The selected variant is missing, invalid, or not available to this shop.",
          },
        },
        { status: 400 },
      );
    }
  }

  if (referenceType && (shopifyCollectionId || shopifyProductId || shopifyVariantId)) {
    try {
      await createCatalogAssignment(session.shop, {
        builderId,
        stepId,
        referenceType: referenceType as "collection" | "product" | "variant",
        shopifyCollectionId,
        shopifyProductId,
        shopifyVariantId,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create assignment.";
      const type = message.includes("not found") ? "authorization" : "validation";
      return Response.json({ feedback: { type, message } }, { status: 400 });
    }
    return redirect(`/app/builders/${builderId}/steps/${stepId}/catalog`);
  }

  return Response.json(
    { feedback: { type: "validation", message: "Invalid catalog assignment input." } },
    { status: 400 },
  );
};

export default function StepCatalog() {
  const { assignments, builderId, stepName, catalog } = useLoaderData<typeof loader>();
  const actionData = useActionData<ActionData>();
  return (
    <CatalogAssignmentPicker
      assignments={assignments}
      builderId={builderId}
      stepName={stepName}
      catalog={catalog}
      feedback={actionData?.feedback ?? null}
    />
  );
}
