import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useActionData, useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import { getBuilder } from "../domains/builder-admin/builder.server";
import { getBuilderDiscount, upsertBuilderDiscount } from "../domains/builder-admin/discount.server";
import { BuilderDiscountManager } from "../components/builder-admin/BuilderDiscountManager";

interface ActionData {
  feedback?: {
    type: "success" | "validation" | "authorization";
    message: string;
  };
}

function formString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const builderId = params.builderId;
  if (!builderId) {
    throw new Response("Not Found", { status: 404 });
  }

  const builder = await getBuilder(session.shop, builderId);
  if (!builder) {
    throw new Response("Not Found", { status: 404 });
  }

  const discount = await getBuilderDiscount(session.shop, builderId);

  return { builder, discount };
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const builderId = params.builderId;
  if (!builderId) {
    return Response.json(
      { feedback: { type: "validation", message: "Builder ID is required." } },
      { status: 400 }
    );
  }

  const formData = await request.formData();

  try {
    await upsertBuilderDiscount(session.shop, builderId, {
      enabled: formData.get("enabled") === "on",
      thresholdAmount: formString(formData, "thresholdAmount"),
      discountPercentage: formString(formData, "discountPercentage"),
      label: formString(formData, "label"),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save discount.";
    const type = message.includes("not found") ? "authorization" : "validation";
    return Response.json({ feedback: { type, message } }, { status: 400 });
  }

  return Response.json({
    feedback: { type: "success", message: "Discount settings saved." },
  });
};

export default function BuilderDiscount() {
  const { builder, discount } = useLoaderData<typeof loader>();
  const actionData = useActionData<ActionData>();

  return (
    <BuilderDiscountManager
      builder={builder}
      discount={discount}
      feedback={actionData?.feedback ?? null}
    />
  );
}
