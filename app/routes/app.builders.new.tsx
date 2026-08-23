import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { redirect, useFetcher } from "react-router";
import { authenticate } from "../shopify.server";
import { createBuilder } from "../domains/builder-admin/builder.server";
import { BuilderForm } from "../components/builder-admin/BuilderForm";

interface ActionData {
  feedback?: {
    type: "success" | "validation" | "authorization" | "stale" | "temporary";
    message: string;
  };
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return null;
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const name = formData.get("name");
  const description = formData.get("description");

  try {
    await createBuilder(session.shop, {
      name: typeof name === "string" ? name : "",
      description: typeof description === "string" ? description : undefined,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create builder.";
    return new Response(JSON.stringify({ feedback: { type: "validation" as const, message } }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  return redirect("/app/builders");
};

export default function NewBuilder() {
  const fetcher = useFetcher<ActionData>();
  const feedback = fetcher.data?.feedback ?? null;

  return <BuilderForm feedback={feedback} />;
}
