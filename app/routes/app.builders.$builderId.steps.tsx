import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useActionData, useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import {
  createStep,
  deleteStep,
  getStepsForBuilder,
  reorderSteps,
  updateStep,
} from "../domains/builder-admin/builder.server";
import { StepEditor } from "../components/builder-admin/StepEditor";

interface ActionData {
  feedback?: {
    type: "success" | "validation" | "authorization" | "stale" | "temporary";
    message: string;
  };
}

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const builderId = params.builderId;
  if (!builderId) {
    throw new Response("Not Found", { status: 404 });
  }
  const steps = await getStepsForBuilder(session.shop, builderId);
  return { builderId, steps };
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const builderId = params.builderId;
  if (!builderId) {
    return Response.json(
      { feedback: { type: "validation", message: "Builder ID is required." } },
      { status: 400 },
    );
  }

  const formData = await request.formData();
  const intent = formData.get("intent");

  try {
    if (intent === "create") {
      const currentSteps = await getStepsForBuilder(session.shop, builderId);
      await createStep(session.shop, builderId, {
        name: String(formData.get("name") ?? ""),
        position: currentSteps.length + 1,
        enabled: formData.get("enabled") === "on",
        required: formData.get("required") === "on",
      });
    } else if (intent === "update") {
      await updateStep(session.shop, String(formData.get("stepId") ?? ""), {
        name: String(formData.get("name") ?? ""),
        enabled: formData.get("enabled") === "on",
        required: formData.get("required") === "on",
        version: Number(formData.get("version")),
      });
    } else if (intent === "delete") {
      await deleteStep(session.shop, String(formData.get("stepId") ?? ""));
    } else if (intent === "move-up" || intent === "move-down") {
      const stepId = String(formData.get("stepId") ?? "");
      const currentSteps = await getStepsForBuilder(session.shop, builderId);
      const stepIds = currentSteps.map((step) => step.id);
      const currentIndex = stepIds.indexOf(stepId);
      const targetIndex = intent === "move-up" ? currentIndex - 1 : currentIndex + 1;

      if (currentIndex < 0 || targetIndex < 0 || targetIndex >= stepIds.length) {
        throw new Error("Step cannot be moved in that direction.");
      }

      [stepIds[currentIndex], stepIds[targetIndex]] = [
        stepIds[targetIndex],
        stepIds[currentIndex],
      ];
      await reorderSteps(session.shop, builderId, stepIds);
    } else {
      throw new Error("Unsupported step action.");
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save step.";
    const type = message.includes("Stale save")
      ? "stale"
      : message.includes("not found")
        ? "authorization"
        : "validation";
    return Response.json({ feedback: { type, message } }, { status: 400 });
  }

  return Response.json({
    feedback: { type: "success", message: "Step changes saved." },
  });
};

export default function BuilderSteps() {
  const { builderId, steps } = useLoaderData<typeof loader>();
  const actionData = useActionData<ActionData>();
  return (
    <StepEditor
      steps={steps}
      builderId={builderId}
      feedback={actionData?.feedback ?? null}
    />
  );
}
