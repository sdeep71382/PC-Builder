import type { LoaderFunctionArgs } from "react-router";
import { getDefaultStorefrontBuilder } from "../domains/storefront-builder/storefront-builder.server";
import { authenticatePcBuilderStorefront } from "../domains/storefront-builder/proxy-auth.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const context = await authenticatePcBuilderStorefront(request);
  if (!context) {
    return storefrontJson(
      {
        error: "Builder unavailable.",
        reason: "storefront_shop_unavailable",
      },
      404
    );
  }

  const result = await getDefaultStorefrontBuilder(context.shop, context.admin);
  if (result.type === "unavailable") {
    return storefrontJson(
      {
        error: "Builder unavailable.",
        reason: "no_published_default_builder",
      },
      404
    );
  }

  return storefrontJson(result.data);
}

function storefrontJson(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
