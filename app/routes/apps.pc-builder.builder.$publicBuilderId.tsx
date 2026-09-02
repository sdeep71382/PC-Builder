import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { getPublicStorefrontBuilder } from "../domains/storefront-builder/storefront-builder.server";

export async function loader({ request, params }: LoaderFunctionArgs) {
  const publicBuilderId = params.publicBuilderId ?? "";
  const { session, admin } = await authenticate.public.appProxy(request);

  if (!session || !admin) {
    return storefrontJson({ error: "Builder unavailable." }, 404);
  }

  const result = await getPublicStorefrontBuilder(session.shop, publicBuilderId, admin);
  if (result.type === "unavailable") {
    return storefrontJson({ error: "Builder unavailable." }, 404);
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
