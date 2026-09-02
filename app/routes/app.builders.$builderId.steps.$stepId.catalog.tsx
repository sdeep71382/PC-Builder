import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { redirect, useActionData, useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import {
  removeCatalogAssignment,
  getCatalogAssignmentsForStep,
  getStepsForBuilder,
  replaceStepCollectionAssignment,
} from "../domains/builder-admin/builder.server";
import {
  findShopifyCollection,
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
  const steps = await getStepsForBuilder(session.shop, builderId);
  const step = steps.find((candidate) => candidate.id === stepId);
  if (!step) {
    throw new Response("Not Found", { status: 404 });
  }

  const [assignments, catalog] = await Promise.all([
    getCatalogAssignmentsForStep(session.shop, step.id),
    lookupShopifyCatalog(admin),
  ]);
  return { builderId, stepId, stepName: step.name, assignments, catalog };
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

  const steps = await getStepsForBuilder(session.shop, builderId);
  const step = steps.find((candidate) => candidate.id === stepId);
  if (!step) {
    return Response.json(
      { feedback: { type: "authorization", message: "Step not found for this builder." } },
      { status: 404 },
    );
  }

  if (assignmentId) {
    const stepAssignments = await getCatalogAssignmentsForStep(session.shop, step.id);
    const assignment = stepAssignments.find((candidate) => candidate.id === assignmentId);
    if (!assignment) {
      return Response.json(
        { feedback: { type: "authorization", message: "Assignment not found for this step." } },
        { status: 404 },
      );
    }

    try {
      await removeCatalogAssignment(session.shop, assignment.id);
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
  }

  if (referenceType === "collection" && shopifyCollectionId) {
    try {
      await replaceStepCollectionAssignment(session.shop, {
        builderId,
        stepId,
        shopifyCollectionId,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to assign collection.";
      const type = message.includes("not found") ? "authorization" : "validation";
      return Response.json({ feedback: { type, message } }, { status: 400 });
    }
    return redirect(`/app/builders/${builderId}/steps/${stepId}/catalog`);
  }

  return Response.json(
    { feedback: { type: "validation", message: "Only Shopify collection assignments are supported for this step." } },
    { status: 400 },
  );
};

export default function StepCatalog() {
  const { assignments, builderId, stepId, stepName, catalog } = useLoaderData<typeof loader>();
  const actionData = useActionData<ActionData>();
  return (
    <CatalogAssignmentPicker
      assignments={assignments}
      builderId={builderId}
      stepId={stepId}
      stepName={stepName}
      catalog={catalog}
      feedback={actionData?.feedback ?? null}
    />
  );
}
