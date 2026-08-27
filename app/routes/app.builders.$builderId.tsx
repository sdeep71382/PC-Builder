import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Outlet, redirect, useLoaderData, useLocation } from "react-router";
import { authenticate } from "../shopify.server";
import {
  getBuilderWithSteps,
  updateBuilder,
  updateBuilderStatus,
} from "../domains/builder-admin/builder.server";
import { BuilderForm } from "../components/builder-admin/BuilderForm";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const builderId = params.builderId;
  if (!builderId) {
    throw new Response("Not Found", { status: 404 });
  }
  const builder = await getBuilderWithSteps(session.shop, builderId);

  if (!builder) {
    throw redirect("/app/builders");
  }

  return { builder };
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const builderId = params.builderId;
  if (!builderId) {
    return new Response(JSON.stringify({ feedback: { type: "validation" as const, message: "Builder ID is required." } }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  const formData = await request.formData();
  const name = formData.get("name");
  const description = formData.get("description");
  const version = Number(formData.get("version"));
  const statusAction = formData.get("statusAction");

  if (statusAction === "publish" || statusAction === "archive") {
    const nextStatus = statusAction === "publish" ? "published" : "archived";
    try {
      await updateBuilderStatus(session.shop, builderId, nextStatus, version);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update status.";
      const type = message.includes("Stale save") ? "stale" as const : "validation" as const;
      return new Response(JSON.stringify({ feedback: { type, message } }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    return Response.json({
      feedback: {
        type: "success",
        message: nextStatus === "published" ? "Builder published." : "Builder archived.",
      },
    });
  }

  try {
    await updateBuilder(session.shop, builderId, {
      name: typeof name === "string" ? name : "",
      description: typeof description === "string" ? description : undefined,
      version,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save builder.";
    const type = message.includes("Stale save")
      ? "stale"
      : message.includes("not found")
        ? "authorization"
        : "validation";
    return new Response(JSON.stringify({ feedback: { type, message } }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  return redirect(`/app/builders/${builderId}`);
};

export default function BuilderEdit() {
  const { builder } = useLoaderData<typeof loader>();
  const location = useLocation();
  const isChildRoute = location.pathname.includes(`/app/builders/${builder.id}/steps`);

  if (isChildRoute) {
    return <Outlet />;
  }

  return (
    <BuilderForm builder={builder} />
  );
}
