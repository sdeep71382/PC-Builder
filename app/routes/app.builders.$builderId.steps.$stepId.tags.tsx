import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useActionData, useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import { getCatalogAssignmentsForStep } from "../domains/builder-admin/builder.server";
import {
  createCompatibilityTag,
  getTagsForStep,
} from "../domains/compatibility/compatibility-tag.server";
import {
  getValuesForStep,
  setTagValue,
} from "../domains/compatibility/tag-value-assignment.server";
import type { CompatibilityTagRole } from "../domains/compatibility/types";
import { CompatibilityTagEditor } from "../components/compatibility/CompatibilityTagEditor";
import { TagValueAssignmentGrid } from "../components/compatibility/TagValueAssignmentGrid";

interface ActionData {
  feedback?: {
    type: "success" | "validation" | "authorization" | "stale" | "temporary";
    message: string;
  };
}

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const builderId = params.builderId;
  const stepId = params.stepId;
  if (!builderId || !stepId) {
    throw new Response("Not Found", { status: 404 });
  }

  const [assignments, tags, values] = await Promise.all([
    getCatalogAssignmentsForStep(session.shop, stepId),
    getTagsForStep(session.shop, stepId),
    getValuesForStep(session.shop, stepId),
  ]);

  return { builderId, stepId, assignments, tags, values };
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const builderId = params.builderId;
  const stepId = params.stepId;
  if (!builderId || !stepId) {
    return Response.json(
      { feedback: { type: "validation", message: "Builder and step IDs are required." } },
      { status: 400 },
    );
  }

  const formData = await request.formData();
  const intent = formData.get("intent");

  try {
    if (intent === "create-tag") {
      await createCompatibilityTag(session.shop, {
        stepId,
        name: String(formData.get("name") ?? ""),
        role: (formData.get("role") as CompatibilityTagRole) || "standard",
      });
    } else if (intent === "set-value") {
      await setTagValue(session.shop, {
        tagId: String(formData.get("tagId") ?? ""),
        assignmentId: String(formData.get("assignmentId") ?? ""),
        value: String(formData.get("value") ?? ""),
      });
    } else {
      throw new Error("Unsupported action.");
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save.";
    const type = message.includes("not found") ? "authorization" : "validation";
    return Response.json({ feedback: { type, message } }, { status: 400 });
  }

  return Response.json({ feedback: { type: "success", message: "Changes saved." } });
};

export default function CompatibilityTags() {
  const { assignments, tags, values } = useLoaderData<typeof loader>();
  const actionData = useActionData<ActionData>();

  return (
    <>
      <CompatibilityTagEditor tags={tags} feedback={actionData?.feedback ?? null} />
      <TagValueAssignmentGrid assignments={assignments} tags={tags} values={values} />
    </>
  );
}
