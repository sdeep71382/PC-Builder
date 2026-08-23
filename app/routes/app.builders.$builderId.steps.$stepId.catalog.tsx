import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { redirect, useActionData, useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import {
  createCatalogAssignment,
  removeCatalogAssignment,
  getCatalogAssignmentsForStep,
} from "../domains/builder-admin/builder.server";
import {
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

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const builderId = params.builderId;
  const stepId = params.stepId;
  if (!builderId || !stepId) {
    throw new Response("Not Found", { status: 404 });
  }
  const assignments = await getCatalogAssignmentsForStep(session.shop, stepId);
  const catalog = await lookupShopifyCatalog(admin);
  return { builderId, stepId, assignments, catalog };
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
  const shopifyProductId = formData.get("shopifyProductId");
  const shopifyVariantId = formData.get("shopifyVariantId");

  if (assignmentId) {
    try {
      await removeCatalogAssignment(session.shop, assignmentId as string);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to remove assignment.";
      return Response.json({ feedback: { type: "authorization", message } }, { status: 400 });
    }
    return redirect(`/app/builders/${builderId}/steps/${stepId}/catalog`);
  }

  if (referenceType === "product" && typeof shopifyProductId === "string" && shopifyProductId) {
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
  } else if (referenceType === "variant" && typeof shopifyVariantId === "string" && shopifyVariantId) {
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

  if (referenceType && (shopifyProductId || shopifyVariantId)) {
    try {
      await createCatalogAssignment(session.shop, {
        builderId,
        stepId,
        referenceType: referenceType as "product" | "variant",
        shopifyProductId: shopifyProductId as string | undefined,
        shopifyVariantId: shopifyVariantId as string | undefined,
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
  const { assignments, catalog } = useLoaderData<typeof loader>();
  const actionData = useActionData<ActionData>();
  return (
    <CatalogAssignmentPicker
      assignments={assignments}
      catalog={catalog}
      feedback={actionData?.feedback ?? null}
    />
  );
}
